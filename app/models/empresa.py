from datetime import datetime
from typing import Any, Dict

from app.extensions import db


class Empresa(db.Model):
    __tablename__ = 'empresas'

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(255), nullable=False, unique=True)
    descricao = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    workflows = db.relationship(
        'Workflow',
        back_populates='empresa',
        lazy='dynamic'
    )

    def __repr__(self) -> str:
        return f'<Empresa {self.nome}>'

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'nome': self.nome,
            'descricao': self.descricao,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

