from datetime import datetime
from typing import Any, Dict, List

from app.extensions import db


class Dashboard(db.Model):
    __tablename__ = 'dashboards'

    id = db.Column(db.Integer, primary_key=True)
    workflow_id = db.Column(db.Integer, db.ForeignKey('workflows.id'), nullable=False, index=True)
    nome = db.Column(db.String(150), nullable=False)
    chart_type = db.Column(db.String(50), nullable=False)
    indicador_dimensao = db.Column(db.String(64), nullable=False, default='indicador')
    indicadores = db.Column(db.JSON, nullable=False)
    metricas = db.Column(db.JSON, nullable=False)
    options = db.Column(db.JSON, nullable=True)
    colors = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    workflow = db.relationship(
        'Workflow',
        backref=db.backref('dashboards', lazy='dynamic', cascade='all, delete-orphan')
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'workflow_id': self.workflow_id,
            'nome': self.nome,
            'chart_type': self.chart_type,
            'indicador_dimensao': self.indicador_dimensao,
            'indicadores': list(self.indicadores or []),
            'metricas': list(self.metricas or []),
            'options': self.options or {},
            'colors': list(self.colors or []),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

