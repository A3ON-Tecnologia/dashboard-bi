from __future__ import annotations

import io
from pathlib import Path
from typing import Iterable, List, Optional, Sequence, Set, Tuple

import pandas as pd
from werkzeug.datastructures import FileStorage

ANALISE_JP_CATEGORIES: List[str] = [
    "simples_nacional",
    "lucro_real",
    "banco_horas",
    "notas",
    "lucro_presumido",
    "departamento_pessoal",
    "colaboradores",
    "impostos_fiscal",
    "empresas_mes",
    "servicos_simples",
    "servicos_lucro_presumido",
    "servicos_contabil",
    "servicos_contabil_det",
]

ALLOWED_EXTENSIONS = {".csv", ".xlsx"}


class AnaliseJPProcessingError(ValueError):
    """Erro controlado durante o processamento de uploads da análise JP."""


def slug_to_label(slug: str) -> str:
    parts = [part.capitalize() for part in slug.split("_") if part]
    return " ".join(parts) if parts else slug


def validate_category(categoria: str) -> None:
    if categoria not in ANALISE_JP_CATEGORIES:
        raise AnaliseJPProcessingError("Categoria inválida.")


def _decode_csv_bytes(data: bytes) -> io.StringIO:
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = data.decode("latin-1")
    return io.StringIO(text)


def _load_dataframe(file_bytes: bytes, extension: str) -> pd.DataFrame:
    if extension == ".csv":
        buffer = _decode_csv_bytes(file_bytes)
        dataframe = pd.read_csv(
            buffer,
            sep=None,
            engine="python",
            dtype=str,
            keep_default_na=False,
        )
    else:
        buffer = io.BytesIO(file_bytes)
        dataframe = pd.read_excel(
            buffer,
            engine="openpyxl",
            dtype=str,
            na_filter=False,
        )

    dataframe = dataframe.dropna(how="all")
    if dataframe.empty:
        raise AnaliseJPProcessingError("Arquivo sem dados para processar.")
    return dataframe


def _dataframe_to_records(dataframe: pd.DataFrame) -> List[dict]:
    records: List[dict] = []

    headers = []
    for column in dataframe.columns:
        header = str(column).strip()
        if not header:
            headers.append("Coluna sem nome")
        else:
            headers.append(header)

    for _, row in dataframe.iterrows():
        record = {}
        is_empty = True

        for header, value in zip(headers, row.tolist()):
            value_str = str(value).strip() if value is not None else ""
            if value_str:
                is_empty = False
            record[header] = value_str

        if not is_empty:
            records.append(record)

    if not records:
        raise AnaliseJPProcessingError("Nenhum registro válido encontrado.")

    return records


def extract_payload(file: FileStorage) -> Tuple[List[dict], bytes]:
    filename = file.filename or ""
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise AnaliseJPProcessingError("Formato inválido. Utilize arquivos CSV ou XLSX.")

    file.stream.seek(0)
    file_bytes = file.stream.read()
    if not file_bytes:
        raise AnaliseJPProcessingError("Arquivo vazio.")

    dataframe = _load_dataframe(file_bytes, extension)
    records = _dataframe_to_records(dataframe)
    return records, file_bytes


def normalise_indices(values: Optional[Iterable]) -> List[int]:
    indices: Set[int] = set()
    for value in values or []:
        try:
            index = int(value)
        except (TypeError, ValueError):
            continue
        if index < 0:
            continue
        indices.add(index)
    return sorted(indices)


def visible_records(records: Sequence[dict], hidden_indices: Optional[Sequence[int]]) -> List[dict]:
    hide_set = set(normalise_indices(hidden_indices))
    visible: List[dict] = []
    for index, record in enumerate(records):
        if index in hide_set:
            continue
        if isinstance(record, dict):
            visible.append(record)
    return visible

