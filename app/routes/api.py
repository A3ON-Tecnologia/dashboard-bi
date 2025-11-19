from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.attributes import flag_modified

from app.extensions import db
from app.models.workflow import Workflow
from app.models.empresa import Empresa
from app.models.arquivo_importado import ArquivoImportado
from app.models.dashboard import Dashboard
from app.models.analise_upload import AnaliseUpload
from app.models.analise_jp_chart import AnaliseJPChart
from app.services.theme_service import get_current_theme, update_theme
from app.services.workflow_import_service import ImportacaoArquivoErro, process_workflow_upload
from app.services.analise_jp_service import (
    ANALISE_JP_CATEGORIES,
    AnaliseJPProcessingError,
    extract_payload,
    normalise_indices,
    slug_to_label,
    validate_category,
    visible_records,
)


api_bp = Blueprint("api", __name__)

WORKFLOW_TYPES = {"balancete", "analise_jp"}
ALLOWED_CHART_TYPES = {"bar", "bar-horizontal", "line", "area", "pie", "donut", "table"}
BALANCETE_METRICS = {
    "valor_periodo_1": {"fallback_label": "Período 1", "value_kind": "currency"},
    "valor_periodo_2": {"fallback_label": "Período 2", "value_kind": "currency"},
    "diferenca_absoluta": {"fallback_label": "Diferença Absoluta", "value_kind": "currency"},
    "diferenca_percentual": {"fallback_label": "Diferença %", "value_kind": "percentage"},
}


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------


def _workflow_or_404(workflow_id: int) -> Workflow:
    return Workflow.query.get_or_404(workflow_id)


def _ensure_workflow_type(workflow: Workflow, expected: str):
    if workflow.tipo != expected:
        return jsonify({"error": f"Workflow não suporta operação para o tipo '{expected}'."}), 400
    return None


def _coerce_float(value: Any) -> Optional[float]:
    if value is None:
        return None

    text = str(value).strip()
    if not text:
        return None

    replacements = {
        "R$": "",
        "r$": "",
        "%": "",
        "\u00a0": "",
        " ": "",
    }
    for needle, replacement in replacements.items():
        text = text.replace(needle, replacement)

    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    else:
        text = text.replace(",", ".")

    try:
        return float(text)
    except ValueError:
        return None


def _delete_file_if_exists(path: Optional[str]) -> None:
    if not path:
        return
    file_path = Path(path)
    if file_path.exists():
        try:
            file_path.unlink()
        except OSError:
            current_app.logger.warning("Falha ao remover arquivo %s", file_path)


def _balancete_dataset_from_upload(arquivo: ArquivoImportado) -> Dict[str, Any]:
    payload = arquivo.dados_extraidos or {}
    indicadores = payload.get("indicadores") or []

    periodo1_label = payload.get("periodo_1_label") or "Período 1"
    periodo2_label = payload.get("periodo_2_label") or "Período 2"

    indicator_options: List[Dict[str, Any]] = []
    for item in indicadores:
        nome = item.get("indicador")
        if nome:
            indicator_options.append({"label": nome, "value": nome})

    value_options: List[Dict[str, Any]] = []
    for key, meta in BALANCETE_METRICS.items():
        label = meta["fallback_label"]
        if key == "valor_periodo_1":
            label = periodo1_label
        elif key == "valor_periodo_2":
            label = periodo2_label
        value_options.append(
            {
                "key": key,
                "label": label,
                "value_kind": meta["value_kind"],
            }
        )

    return {
        "upload": {
            "id": arquivo.id,
            "nome_arquivo": arquivo.nome_arquivo,
            "data_upload": arquivo.data_upload.isoformat() if arquivo.data_upload else None,
        },
        "period_labels": {
            "periodo_1": periodo1_label,
            "periodo_2": periodo2_label,
        },
        "indicator_options": indicator_options,
        "value_options": value_options,
        "records": indicadores,
        "total_indicadores": len(indicadores),
    }


def _latest_balancete_upload(workflow_id: int) -> Optional[ArquivoImportado]:
    return (
        ArquivoImportado.query.filter_by(workflow_id=workflow_id)
        .order_by(ArquivoImportado.data_upload.desc())
        .first()
    )


def _balancete_chart_payload(chart: Dashboard, dataset: Dict[str, Any]) -> Dict[str, Any]:
    indicators = dataset.get("records") or []
    indicator_map = {item.get("indicador"): item for item in indicators if isinstance(item, dict)}

    labels: List[str] = []
    filtered_rows: List[Dict[str, Any]] = []
    indicator_tipos: Dict[str, str] = {}
    
    for indicador in chart.indicadores or []:
        row = indicator_map.get(indicador)
        if not row:
            continue
        labels.append(indicador)
        filtered_rows.append(row)
        indicator_tipos[indicador] = row.get("tipo_valor", "currency")

    if not labels:
        labels = [item.get("indicador", f"Indicador {index + 1}") for index, item in enumerate(indicators)]
        filtered_rows = indicators
        for item in indicators:
            nome = item.get("indicador")
            if nome:
                indicator_tipos[nome] = item.get("tipo_valor", "currency")

    series_payload: List[Dict[str, Any]] = []
    for metric in chart.metricas or []:
        key = metric.get("key")
        if key not in BALANCETE_METRICS:
            continue

        label = metric.get("label")
        if not label:
            label = next(
                (
                    option["label"]
                    for option in dataset.get("value_options", [])
                    if option.get("key") == key
                ),
                BALANCETE_METRICS[key]["fallback_label"],
            )

        values: List[Optional[float]] = []
        raw_values: List[Optional[float]] = []
        for row in filtered_rows:
            value = row.get(key)
            if value is None:
                values.append(None)
                raw_values.append(None)
                continue
            values.append(float(value))
            raw_values.append(float(value))

        series_payload.append(
            {
                "key": key,
                "label": label,
                "color": metric.get("color"),
                "value_kind": BALANCETE_METRICS[key]["value_kind"],
                "values": values,
                "raw_values": raw_values,
            }
        )

    return {
        "chart": chart.to_dict(),
        "data": {
            "labels": labels,
            "series": series_payload,
            "indicator_tipos": indicator_tipos,
        },
    }


def _analise_dataset(upload: AnaliseUpload) -> Dict[str, Any]:
    records = upload.dados_extraidos if isinstance(upload.dados_extraidos, list) else []
    visible = visible_records(records, upload.linhas_ocultas or [])
    total_records = len(records)
    hidden_count = total_records - len(visible)

    field_names: List[str] = []
    reference = visible if visible else records
    for record in reference:
        if isinstance(record, dict):
            field_names = list(record.keys())
            break

    numeric_fields: List[str] = []
    for field in field_names:
        numeric_detected = True
        has_values = False
        for record in visible:
            value = record.get(field)
            if value in (None, ""):
                continue
            has_values = True
            if _coerce_float(value) is None:
                numeric_detected = False
                break
        if numeric_detected and has_values:
            numeric_fields.append(field)

    return {
        "upload": {
            "id": upload.id,
            "nome_arquivo": upload.nome_arquivo,
            "created_at": upload.created_at.isoformat() if upload.created_at else None,
        },
        "records": visible,
        "fields": field_names,
        "numeric_fields": numeric_fields,
        "totals": {
            "total": total_records,
            "visiveis": len(visible),
            "ocultos": hidden_count,
        },
        "linhas_ocultas": normalise_indices(upload.linhas_ocultas or []),
    }


def _analise_chart_payload(chart: AnaliseJPChart, dataset: Dict[str, Any]) -> Dict[str, Any]:
    records = dataset.get("records") or []
    if not isinstance(records, list):
        records = []

    row_indices = []
    if isinstance(chart.options, dict):
        raw_rows = chart.options.get("row_indices")
        if isinstance(raw_rows, Iterable):
            row_indices = normalise_indices(raw_rows)

    if row_indices:
        filtered = []
        for index in row_indices:
            if 0 <= index < len(records):
                filtered.append((index, records[index]))
        indexed_records = filtered
    else:
        indexed_records = list(enumerate(records))

    labels: List[str] = []
    for index, record in indexed_records:
        label_parts: List[str] = []
        for dimension in chart.dimensoes or []:
            value = str(record.get(dimension, "")).strip()
            if value:
                label_parts.append(value)
        if not label_parts:
            label_parts.append(f"Linha {index + 1}")
        labels.append(" • ".join(label_parts))

    series_payload: List[Dict[str, Any]] = []
    for metric in chart.metricas or []:
        key = metric.get("key")
        values: List[Optional[float]] = []
        raw: List[str] = []
        for _, record in indexed_records:
            value = record.get(key)
            raw.append("" if value is None else str(value))
            values.append(_coerce_float(value))

        series_payload.append(
            {
                "key": key,
                "label": metric.get("label") or key,
                "color": metric.get("color"),
                "values": values,
                "raw_values": raw,
            }
        )

    return {
        "chart": chart.to_dict(),
        "data": {
            "labels": labels,
            "series": series_payload,
        },
    }


def serialize_workflow(workflow: Workflow) -> Dict[str, Any]:
    payload = workflow.to_dict()

    if workflow.tipo == "balancete":
        latest_upload = _latest_balancete_upload(workflow.id)
        payload["balancete"] = {
            "has_upload": latest_upload is not None,
            "upload": _balancete_dataset_from_upload(latest_upload) if latest_upload else None,
            "charts": [chart.to_dict() for chart in workflow.dashboards.order_by(Dashboard.created_at.desc())],
        }
    else:
        categories_status = []
        for categoria in ANALISE_JP_CATEGORIES:
            latest = (
                AnaliseUpload.query.filter_by(workflow_id=workflow.id, categoria=categoria)
                .order_by(AnaliseUpload.created_at.desc())
                .first()
            )
            categories_status.append(
                {
                    "slug": categoria,
                    "label": slug_to_label(categoria),
                    "has_upload": bool(latest),
                    "upload": _analise_dataset(latest) if latest else None,
                }
            )
        payload["analise_jp"] = {
            "categories": categories_status,
            "charts": [chart.to_dict() for chart in workflow.analise_jp_charts.order_by(AnaliseJPChart.created_at.desc())],
        }

    return payload


# -----------------------------------------------------------------------------
# Tema
# -----------------------------------------------------------------------------


@api_bp.get("/theme")
def get_theme():
    return jsonify(get_current_theme())


@api_bp.post("/theme")
def set_theme():
    payload = request.get_json(silent=True) or {}
    theme_name = str(payload.get("theme") or "").strip() or "futurist"
    theme = update_theme(theme_name)
    return jsonify({"message": "Tema atualizado com sucesso.", "theme": theme})


# -----------------------------------------------------------------------------
# Workflows
# -----------------------------------------------------------------------------


@api_bp.get("/workflows")
def list_workflows():
    empresa_id = request.args.get("empresa_id", type=int)
    query = Workflow.query
    if empresa_id is not None:
        query = query.filter_by(empresa_id=empresa_id)
    items = query.order_by(Workflow.data_criacao.desc()).all()
    return jsonify(
        {
            "items": [workflow.to_dict() for workflow in items],
            "count": len(items),
        }
    )


@api_bp.post("/workflows")
def create_workflow():
    payload = request.get_json(silent=True) or {}
    nome = str(payload.get("nome") or "").strip()
    descricao = str(payload.get("descricao") or "").strip() or None
    tipo = str(payload.get("tipo") or "").strip()
    empresa_id = payload.get("empresa_id")

    if not nome or not tipo:
        return jsonify({"error": "Informe nome e tipo do workflow."}), 400
    if tipo not in WORKFLOW_TYPES:
        return jsonify({"error": "Tipo de workflow inválido."}), 400

    workflow = Workflow(nome=nome, descricao=descricao, tipo=tipo, empresa_id=empresa_id)
    db.session.add(workflow)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Já existe um workflow com este nome."}), 409

    return jsonify({"message": "Workflow criado com sucesso.", "workflow": workflow.to_dict()}), 201


@api_bp.get("/workflows/<int:workflow_id>")
def retrieve_workflow(workflow_id: int):
    workflow = _workflow_or_404(workflow_id)
    return jsonify(serialize_workflow(workflow))


@api_bp.put("/workflows/<int:workflow_id>")
def update_workflow(workflow_id: int):
    workflow = _workflow_or_404(workflow_id)

    payload = request.get_json(silent=True) or {}
    nome = str(payload.get("nome") or "").strip()
    descricao = str(payload.get("descricao") or "").strip() or None
    tipo = str(payload.get("tipo") or "").strip()
    empresa_id = payload.get("empresa_id")

    if nome:
        workflow.nome = nome
    if descricao is not None or "descricao" in payload:
        workflow.descricao = descricao
    if tipo and tipo in WORKFLOW_TYPES:
        workflow.tipo = tipo
    if "empresa_id" in payload:
        if empresa_id is None:
            workflow.empresa_id = None
        else:
            if not isinstance(empresa_id, int):
                return jsonify({"error": "empresa_id deve ser inteiro."}), 400
            Empresa.query.get_or_404(empresa_id)
            workflow.empresa_id = empresa_id

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Já existe um workflow com este nome."}), 409

    return jsonify({"message": "Workflow atualizado com sucesso.", "workflow": workflow.to_dict()})


@api_bp.delete("/workflows/<int:workflow_id>")
def delete_workflow(workflow_id: int):
    workflow = _workflow_or_404(workflow_id)

    for upload in workflow.arquivos_importados.all():
        _delete_file_if_exists(upload.caminho_arquivo)
    for upload in workflow.analise_uploads.all():
        _delete_file_if_exists(upload.caminho_arquivo)

    db.session.delete(workflow)
    db.session.commit()

    return jsonify({"message": "Workflow removido com sucesso."})


# -----------------------------------------------------------------------------
# Balancete - Uploads e dataset
# -----------------------------------------------------------------------------


@api_bp.post("/workflows/<int:workflow_id>/balancete/upload")
def upload_balancete(workflow_id: int):
    workflow = _workflow_or_404(workflow_id)
    error = _ensure_workflow_type(workflow, "balancete")
    if error:
        return error

    file = request.files.get("arquivo")
    if not file or not file.filename:
        return jsonify({"error": "Nenhum arquivo foi enviado."}), 400

    upload_root = Path(current_app.config["UPLOAD_FOLDER"]) / "balancete" / str(workflow.id)

    try:
        result = process_workflow_upload(file, workflow.id, upload_root)
    except ImportacaoArquivoErro as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception:
        current_app.logger.exception("Falha ao processar upload de balancete.")
        return jsonify({"error": "Erro interno ao processar o arquivo."}), 500

    existing_uploads = ArquivoImportado.query.filter_by(workflow_id=workflow.id).all()
    for existing in existing_uploads:
        _delete_file_if_exists(existing.caminho_arquivo)
        db.session.delete(existing)

    new_upload = ArquivoImportado(
        workflow_id=workflow.id,
        nome_arquivo=result["nome_arquivo"],
        caminho_arquivo=str(result["arquivo_salvo"]),
        dados_extraidos=result["payload"],
    )
    db.session.add(new_upload)
    db.session.commit()

    dataset = _balancete_dataset_from_upload(new_upload)
    return jsonify({"message": "Upload processado com sucesso.", "dataset": dataset}), 201


@api_bp.get("/workflows/<int:workflow_id>/balancete/dataset")
def get_balancete_dataset(workflow_id: int):
    workflow = _workflow_or_404(workflow_id)
    error = _ensure_workflow_type(workflow, "balancete")
    if error:
        return error

    upload = _latest_balancete_upload(workflow.id)
    if not upload:
        return jsonify({"error": "Nenhum upload disponível para este workflow."}), 404

    return jsonify(_balancete_dataset_from_upload(upload))


@api_bp.delete("/workflows/<int:workflow_id>/balancete/upload/<int:upload_id>")
def delete_balancete_upload(workflow_id: int, upload_id: int):
    workflow = _workflow_or_404(workflow_id)
    error = _ensure_workflow_type(workflow, "balancete")
    if error:
        return error

    upload = (
        ArquivoImportado.query.filter_by(workflow_id=workflow.id, id=upload_id)
        .first()
    )
    if not upload:
        return jsonify({"error": "Upload não encontrado."}), 404

    _delete_file_if_exists(upload.caminho_arquivo)
    db.session.delete(upload)
    db.session.commit()

    return jsonify({"message": "Upload removido com sucesso."})


@api_bp.patch("/workflows/<int:workflow_id>/balancete/indicador/<string:indicador_nome>/tipo")
def update_indicador_tipo(workflow_id: int, indicador_nome: str):
    workflow = _workflow_or_404(workflow_id)
    error = _ensure_workflow_type(workflow, "balancete")
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    tipo_valor = str(payload.get("tipo_valor") or "").strip()
    
    if tipo_valor not in {"currency", "percentage", "multiplier"}:
        return jsonify({"error": "Tipo inválido. Use 'currency', 'percentage' ou 'multiplier'."}), 400

    upload = _latest_balancete_upload(workflow.id)
    if not upload:
        return jsonify({"error": "Nenhum upload disponível."}), 404

    dados = upload.dados_extraidos or {}
    indicadores = dados.get("indicadores") or []
    
    updated = False
    for item in indicadores:
        if item.get("indicador") == indicador_nome:
            item["tipo_valor"] = tipo_valor
            updated = True
            break
    
    if not updated:
        return jsonify({"error": "Indicador não encontrado."}), 404

    upload.dados_extraidos = dados
    flag_modified(upload, "dados_extraidos")
    db.session.commit()

    return jsonify({"message": "Tipo do indicador atualizado com sucesso.", "tipo_valor": tipo_valor})


# -----------------------------------------------------------------------------
# Balancete - Gráficos
# -----------------------------------------------------------------------------


def _validate_balancete_chart_payload(payload: Dict[str, Any]) -> Optional[str]:
    nome = str(payload.get("nome") or "").strip()
    chart_type = str(payload.get("chart_type") or "").strip()
    indicadores = payload.get("indicadores")
    metricas = payload.get("metricas")

    if not nome:
        return "Informe um nome para o gráfico."
    if chart_type not in ALLOWED_CHART_TYPES:
        return "Tipo de gráfico inválido."
    if not isinstance(indicadores, list) or not indicadores:
        return "Selecione ao menos um indicador."
    if not isinstance(metricas, list) or not metricas:
        return "Defina pelo menos uma métrica."

    for metrica in metricas:
        if not isinstance(metrica, dict):
            return "Formato de métrica inválido."
        key = metrica.get("key")
        if key not in BALANCETE_METRICS:
            return "Métrica desconhecida."

    return None


def _hydrate_balancete_chart_from_payload(chart: Dashboard, payload: Dict[str, Any]) -> None:
    chart.nome = payload["nome"].strip()
    chart.chart_type = payload["chart_type"].strip()
    chart.indicador_dimensao = payload.get("indicador_dimensao") or "indicador"
    chart.indicadores = list(payload.get("indicadores") or [])
    chart.metricas = []

    for metrica in payload.get("metricas", []):
        key = metrica.get("key")
        if key not in BALANCETE_METRICS:
            continue
        label = metrica.get("label")
        if not label:
            label = BALANCETE_METRICS[key]["fallback_label"]
        chart.metricas.append(
            {
                "key": key,
                "label": label,
                "color": metrica.get("color"),
            }
        )

    options = payload.get("options")
    chart.options = options if isinstance(options, dict) else {}
    # Mapear cores de indicadores vindas do frontend
    indicador_cores = payload.get("indicador_cores")
    if isinstance(indicador_cores, dict):
        # Guardar sob a chave canonical em options
        chart.options["indicator_colors"] = indicador_cores


@api_bp.get("/workflows/<int:workflow_id>/balancete/charts")
def list_balancete_charts(workflow_id: int):
    workflow = _workflow_or_404(workflow_id)
    error = _ensure_workflow_type(workflow, "balancete")
    if error:
        return error

    upload = _latest_balancete_upload(workflow.id)
    dataset = _balancete_dataset_from_upload(upload) if upload else None

    charts = []
    for chart in workflow.dashboards.order_by(Dashboard.created_at.asc()).all():
        chart_payload = chart.to_dict()
        if dataset:
            chart_payload = _balancete_chart_payload(chart, dataset)
        charts.append(chart_payload)

    return jsonify(
        {
            "charts": charts,
            "dataset": dataset,
        }
    )


@api_bp.post("/workflows/<int:workflow_id>/balancete/charts")
def create_balancete_chart(workflow_id: int):
    workflow = _workflow_or_404(workflow_id)
    error = _ensure_workflow_type(workflow, "balancete")
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    validation_error = _validate_balancete_chart_payload(payload)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    chart = Dashboard(workflow_id=workflow.id)
    _hydrate_balancete_chart_from_payload(chart, payload)

    db.session.add(chart)
    db.session.commit()

    upload = _latest_balancete_upload(workflow.id)
    dataset = _balancete_dataset_from_upload(upload) if upload else None

    response_payload = chart.to_dict()
    if dataset:
        response_payload = _balancete_chart_payload(chart, dataset)

    return jsonify({"message": "Gráfico criado com sucesso.", "chart": response_payload}), 201


@api_bp.put("/workflows/<int:workflow_id>/balancete/charts/<int:chart_id>")
def update_balancete_chart(workflow_id: int, chart_id: int):
    workflow = _workflow_or_404(workflow_id)
    error = _ensure_workflow_type(workflow, "balancete")
    if error:
        return error

    chart = (
        Dashboard.query.filter_by(workflow_id=workflow.id, id=chart_id)
        .first_or_404()
    )

    payload = request.get_json(silent=True) or {}
    validation_error = _validate_balancete_chart_payload(payload)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    _hydrate_balancete_chart_from_payload(chart, payload)
    db.session.commit()

    upload = _latest_balancete_upload(workflow.id)
    dataset = _balancete_dataset_from_upload(upload) if upload else None

    response_payload = chart.to_dict()
    if dataset:
        response_payload = _balancete_chart_payload(chart, dataset)

    return jsonify({"message": "Gráfico atualizado com sucesso.", "chart": response_payload})


@api_bp.delete("/workflows/<int:workflow_id>/balancete/charts/<int:chart_id>")
def delete_balancete_chart(workflow_id: int, chart_id: int):
    workflow = _workflow_or_404(workflow_id)
    error = _ensure_workflow_type(workflow, "balancete")
    if error:
        return error

    chart = (
        Dashboard.query.filter_by(workflow_id=workflow.id, id=chart_id)
        .first()
    )
    if not chart:
        return jsonify({"error": "Gráfico não encontrado."}), 404

    db.session.delete(chart)
    db.session.commit()

    return jsonify({"message": "Gráfico removido com sucesso."})


# -----------------------------------------------------------------------------
# Análise JP - Uploads
# -----------------------------------------------------------------------------


@api_bp.get("/workflows/<int:workflow_id>/analise-jp/categories")
def list_analise_categories(workflow_id: int):
    workflow = _workflow_or_404(workflow_id)
    error = _ensure_workflow_type(workflow, "analise_jp")
    if error:
        return error

    categories_meta: List[Dict[str, Any]] = []
    for categoria in ANALISE_JP_CATEGORIES:
        latest = (
            AnaliseUpload.query.filter_by(workflow_id=workflow.id, categoria=categoria)
            .order_by(AnaliseUpload.created_at.desc())
            .first()
        )
        categories_meta.append(
            {
                "slug": categoria,
                "label": slug_to_label(categoria),
                "has_upload": bool(latest),
                "dataset": _analise_dataset(latest) if latest else None,
            }
        )

    return jsonify({"categories": categories_meta})


@api_bp.get("/workflows/<int:workflow_id>/analise-jp/dataset/<string:categoria>")
def get_analise_dataset(workflow_id: int, categoria: str):
    workflow = _workflow_or_404(workflow_id)
    error = _ensure_workflow_type(workflow, "analise_jp")
    if error:
        return error

    try:
        validate_category(categoria)
    except AnaliseJPProcessingError as exc:
        return jsonify({"error": str(exc)}), 400

    upload = (
        AnaliseUpload.query.filter_by(workflow_id=workflow.id, categoria=categoria)
        .order_by(AnaliseUpload.created_at.desc())
        .first()
    )
    if not upload:
        return jsonify({"error": "Nenhum upload encontrado para a categoria informada."}), 404

    dataset = _analise_dataset(upload)
    dataset["categoria"] = categoria
    dataset["categoria_label"] = slug_to_label(categoria)
    return jsonify(dataset)


@api_bp.post("/workflows/<int:workflow_id>/analise-jp/upload/<string:categoria>")
def upload_analise_categoria(workflow_id: int, categoria: str):
    workflow = _workflow_or_404(workflow_id)
    error = _ensure_workflow_type(workflow, "analise_jp")
    if error:
        return error

    try:
        validate_category(categoria)
    except AnaliseJPProcessingError as exc:
        return jsonify({"error": str(exc)}), 400

    file = request.files.get("arquivo")
    if not file or not file.filename:
        return jsonify({"error": "Nenhum arquivo foi enviado."}), 400

    try:
        registros, file_bytes = extract_payload(file)
    except AnaliseJPProcessingError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception:
        current_app.logger.exception("Falha ao processar upload da análise JP.")
        return jsonify({"error": "Erro interno ao processar o arquivo."}), 500

    safe_name = file.filename
    timestamped_name = f"{workflow.id}_{categoria}_{safe_name}"

    upload_root = Path(current_app.config["UPLOAD_FOLDER"]) / "analise_jp" / str(workflow.id)
    destination = upload_root / categoria / timestamped_name
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(file_bytes)

    upload = AnaliseUpload(
        workflow_id=workflow.id,
        categoria=categoria,
        nome_arquivo=safe_name,
        caminho_arquivo=str(destination),
        dados_extraidos=registros,
        linhas_ocultas=[],
    )

    db.session.add(upload)
    db.session.commit()

    dataset = _analise_dataset(upload)
    dataset["categoria"] = categoria
    dataset["categoria_label"] = slug_to_label(categoria)

    return jsonify({"message": "Upload registrado com sucesso.", "dataset": dataset}), 201


@api_bp.delete("/workflows/<int:workflow_id>/analise-jp/upload/<string:categoria>/<int:upload_id>")
def delete_analise_upload(workflow_id: int, categoria: str, upload_id: int):
    workflow = _workflow_or_404(workflow_id)
    error = _ensure_workflow_type(workflow, "analise_jp")
    if error:
        return error

    try:
        validate_category(categoria)
    except AnaliseJPProcessingError as exc:
        return jsonify({"error": str(exc)}), 400

    upload = (
        AnaliseUpload.query.filter_by(workflow_id=workflow.id, categoria=categoria, id=upload_id)
        .first()
    )
    if not upload:
        return jsonify({"error": "Upload não encontrado."}), 404

    _delete_file_if_exists(upload.caminho_arquivo)
    db.session.delete(upload)
    db.session.commit()

    return jsonify({"message": "Upload removido com sucesso."})


# -----------------------------------------------------------------------------
# Análise JP - Gráficos
# -----------------------------------------------------------------------------


def _validate_analise_chart_payload(payload: Dict[str, Any]) -> Optional[str]:
    nome = str(payload.get("nome") or "").strip()
    chart_type = str(payload.get("chart_type") or "").strip()
    categoria = str(payload.get("categoria") or "").strip()
    dimensoes = payload.get("dimensoes")
    metricas = payload.get("metricas")

    if not nome:
        return "Informe um nome para o gráfico."
    if chart_type not in ALLOWED_CHART_TYPES:
        return "Tipo de gráfico inválido."
    if not categoria:
        return "Selecione a categoria de origem."
    if not isinstance(dimensoes, list) or not dimensoes:
        return "Escolha pelo menos uma coluna para composição das linhas."
    if not isinstance(metricas, list) or not metricas:
        return "Defina ao menos uma coluna de valores."

    return None


def _hydrate_analise_chart_from_payload(chart: AnaliseJPChart, payload: Dict[str, Any]) -> None:
    chart.nome = payload["nome"].strip()
    chart.chart_type = payload["chart_type"].strip()
    chart.categoria = payload["categoria"].strip()
    chart.dimensoes = list(payload.get("dimensoes") or [])
    chart.metricas = []

    for metrica in payload.get("metricas", []):
        if not isinstance(metrica, dict):
            continue
        key = metrica.get("key")
        label = metrica.get("label") or key
        chart.metricas.append(
            {
                "key": key,
                "label": label,
                "color": metrica.get("color"),
            }
        )

    options = payload.get("options")
    chart.options = options if isinstance(options, dict) else {}


@api_bp.get("/workflows/<int:workflow_id>/analise-jp/charts")
def list_analise_charts(workflow_id: int):
    workflow = _workflow_or_404(workflow_id)
    error = _ensure_workflow_type(workflow, "analise_jp")
    if error:
        return error

    charts_payload: List[Dict[str, Any]] = []
    for chart in workflow.analise_jp_charts.order_by(AnaliseJPChart.created_at.asc()).all():
        dataset = None
        upload = (
            AnaliseUpload.query.filter_by(workflow_id=workflow.id, categoria=chart.categoria)
            .order_by(AnaliseUpload.created_at.desc())
            .first()
        )
        if upload:
            dataset = _analise_dataset(upload)
        if dataset:
            charts_payload.append(_analise_chart_payload(chart, dataset))
        else:
            charts_payload.append({"chart": chart.to_dict(), "data": None})

    return jsonify({"charts": charts_payload})


@api_bp.post("/workflows/<int:workflow_id>/analise-jp/charts")
def create_analise_chart(workflow_id: int):
    workflow = _workflow_or_404(workflow_id)
    error = _ensure_workflow_type(workflow, "analise_jp")
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    validation_error = _validate_analise_chart_payload(payload)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    chart = AnaliseJPChart(workflow_id=workflow.id)
    _hydrate_analise_chart_from_payload(chart, payload)

    db.session.add(chart)
    db.session.commit()

    upload = (
        AnaliseUpload.query.filter_by(workflow_id=workflow.id, categoria=chart.categoria)
        .order_by(AnaliseUpload.created_at.desc())
        .first()
    )
    dataset = _analise_dataset(upload) if upload else None

    response_payload = chart.to_dict()
    if dataset:
        response_payload = _analise_chart_payload(chart, dataset)

    return jsonify({"message": "Gráfico criado com sucesso.", "chart": response_payload}), 201


@api_bp.put("/workflows/<int:workflow_id>/analise-jp/charts/<int:chart_id>")
def update_analise_chart(workflow_id: int, chart_id: int):
    workflow = _workflow_or_404(workflow_id)
    error = _ensure_workflow_type(workflow, "analise_jp")
    if error:
        return error

    chart = (
        AnaliseJPChart.query.filter_by(workflow_id=workflow.id, id=chart_id)
        .first_or_404()
    )

    payload = request.get_json(silent=True) or {}
    validation_error = _validate_analise_chart_payload(payload)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    _hydrate_analise_chart_from_payload(chart, payload)
    db.session.commit()

    upload = (
        AnaliseUpload.query.filter_by(workflow_id=workflow.id, categoria=chart.categoria)
        .order_by(AnaliseUpload.created_at.desc())
        .first()
    )
    dataset = _analise_dataset(upload) if upload else None

    response_payload = chart.to_dict()
    if dataset:
        response_payload = _analise_chart_payload(chart, dataset)

    return jsonify({"message": "Gráfico atualizado com sucesso.", "chart": response_payload})


@api_bp.delete("/workflows/<int:workflow_id>/analise-jp/charts/<int:chart_id>")
def delete_analise_chart(workflow_id: int, chart_id: int):
    workflow = _workflow_or_404(workflow_id)
    error = _ensure_workflow_type(workflow, "analise_jp")
    if error:
        return error

    chart = (
        AnaliseJPChart.query.filter_by(workflow_id=workflow.id, id=chart_id)
        .first()
    )
    if not chart:
        return jsonify({"error": "Gráfico não encontrado."}), 404

    db.session.delete(chart)
    db.session.commit()

    return jsonify({"message": "Gráfico removido com sucesso."})


# -----------------------------------------------------------------------------
# Empresas
# -----------------------------------------------------------------------------


@api_bp.get("/empresas")
def list_empresas():
    items = Empresa.query.order_by(Empresa.created_at.desc()).all()
    return jsonify({
        "items": [e.to_dict() for e in items],
        "count": len(items),
    })


@api_bp.post("/empresas")
def create_empresa():
    payload = request.get_json(silent=True) or {}
    nome = str(payload.get("nome") or "").strip()
    descricao = str(payload.get("descricao") or "").strip() or None
    if not nome:
        return jsonify({"error": "Informe o nome da empresa."}), 400
    empresa = Empresa(nome=nome, descricao=descricao)
    db.session.add(empresa)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Já existe uma empresa com este nome."}), 409
    return jsonify({"message": "Empresa criada com sucesso.", "empresa": empresa.to_dict()}), 201


@api_bp.get("/empresas/<int:empresa_id>")
def retrieve_empresa(empresa_id: int):
    empresa = Empresa.query.get_or_404(empresa_id)
    return jsonify(empresa.to_dict())


@api_bp.put("/empresas/<int:empresa_id>")
def update_empresa(empresa_id: int):
    empresa = Empresa.query.get_or_404(empresa_id)
    payload = request.get_json(silent=True) or {}
    nome = str(payload.get("nome") or "").strip()
    descricao = str(payload.get("descricao") or "").strip() or None
    if nome:
        empresa.nome = nome
    if descricao is not None or "descricao" in payload:
        empresa.descricao = descricao
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Já existe uma empresa com este nome."}), 409
    return jsonify({"message": "Empresa atualizada com sucesso.", "empresa": empresa.to_dict()})


@api_bp.delete("/empresas/<int:empresa_id>")
def delete_empresa(empresa_id: int):
    empresa = Empresa.query.get_or_404(empresa_id)
    # Se desejar impedir exclusão com workflows vinculados, descomente:
    # if empresa.workflows.count() > 0:
    #     return jsonify({"error": "Não é possível excluir empresa com workflows vinculados."}), 400
    db.session.delete(empresa)
    db.session.commit()
    return jsonify({"message": "Empresa removida com sucesso."})


@api_bp.get("/empresas/<int:empresa_id>/workflows")
def list_empresas_workflows(empresa_id: int):
    Empresa.query.get_or_404(empresa_id)
    items = Workflow.query.filter_by(empresa_id=empresa_id).order_by(Workflow.data_criacao.desc()).all()
    return jsonify({
        "items": [w.to_dict() for w in items],
        "count": len(items),
    })
