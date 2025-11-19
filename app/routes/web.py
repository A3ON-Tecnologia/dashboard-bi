from __future__ import annotations

from flask import Blueprint, redirect, render_template, url_for

from app.models.workflow import Workflow
from app.models.empresa import Empresa
from app.routes.api import serialize_workflow
from app.services.theme_service import get_theme_context
from app.themes.theme_config import THEMES


web_bp = Blueprint("web", __name__)


def _theme_options() -> list[dict]:
    options = []
    for slug, data in THEMES.items():
        label = data.get("name", slug).replace("_", " ").title()
        options.append(
            {
                "slug": slug,
                "label": label,
                "preview": data.get("bg"),
            }
        )
    return options


@web_bp.route("/")
def index():
    return redirect(url_for("web.list_empresas_view"))


@web_bp.route("/workflows")
def list_workflows_view():
    # Rota descontinuada: manter compatibilidade redirecionando para empresas
    return redirect(url_for("web.list_empresas_view"), code=302)


@web_bp.route("/workflows/<int:workflow_id>")
def workflow_detail_view(workflow_id: int):
    theme = get_theme_context()
    workflow = Workflow.query.get_or_404(workflow_id)
    workflow_payload = serialize_workflow(workflow)
    empresa_payload = workflow.empresa.to_dict() if workflow.empresa else None
    return render_template(
        "workflow_detail.html",
        theme=theme,
        workflow=workflow_payload,
        empresa=empresa_payload,
        theme_options=_theme_options(),
    )


@web_bp.route("/workflows/<int:workflow_id>/dashboards")
def workflow_charts_view(workflow_id: int):
    theme = get_theme_context()
    workflow = Workflow.query.get_or_404(workflow_id)
    workflow_payload = serialize_workflow(workflow)
    empresa_payload = workflow.empresa.to_dict() if workflow.empresa else None
    return render_template(
        "workflow_charts.html",
        theme=theme,
        workflow=workflow_payload,
        empresa=empresa_payload,
        theme_options=_theme_options(),
    )


@web_bp.route("/empresas")
def list_empresas_view():
    theme = get_theme_context()
    empresas = Empresa.query.order_by(Empresa.created_at.desc()).all()
    return render_template(
        "empresas.html",
        theme=theme,
        empresas=[e.to_dict() for e in empresas],
        theme_options=_theme_options(),
    )


@web_bp.route("/empresas/<int:empresa_id>")
def empresa_detail_view(empresa_id: int):
    theme = get_theme_context()
    empresa = Empresa.query.get_or_404(empresa_id)
    workflows = Workflow.query.filter_by(empresa_id=empresa.id).order_by(Workflow.data_criacao.desc()).all()
    return render_template(
        "empresa_detail.html",
        theme=theme,
        empresa=empresa.to_dict(),
        workflows=[w.to_dict() for w in workflows],
        theme_options=_theme_options(),
    )
