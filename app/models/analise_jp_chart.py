from datetime import datetime
from typing import Any, Dict

from app.extensions import db


class AnaliseJPChart(db.Model):
    __tablename__ = 'analise_jp_charts'

    id = db.Column(db.Integer, primary_key=True)
    workflow_id = db.Column(db.Integer, db.ForeignKey('workflows.id'), nullable=False, index=True)
    categoria = db.Column(db.String(120), nullable=False)
    nome = db.Column(db.String(150), nullable=False)
    chart_type = db.Column(db.String(50), nullable=False)
    dimensoes = db.Column(db.JSON, nullable=False)
    metricas = db.Column(db.JSON, nullable=False)
    options = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    workflow = db.relationship(
        'Workflow',
        backref=db.backref('analise_jp_charts', lazy='dynamic', cascade='all, delete-orphan')
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'workflow_id': self.workflow_id,
            'categoria': self.categoria,
            'nome': self.nome,
            'chart_type': self.chart_type,
            'dimensoes': list(self.dimensoes or []),
            'metricas': list(self.metricas or []),
            'options': self.options or {},
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

