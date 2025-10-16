from datetime import datetime
from typing import Any, Dict

from app.extensions import db


class Workflow(db.Model):
    __tablename__ = 'workflows'

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(255), nullable=False, unique=True)
    descricao = db.Column(db.Text, nullable=True)
    tipo = db.Column(db.Enum('balancete', 'analise_jp', name='workflow_tipo'), nullable=False)
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self) -> str:
        return f'<Workflow {self.nome} ({self.tipo})>'

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'nome': self.nome,
            'descricao': self.descricao,
            'tipo': self.tipo,
            'data_criacao': self.data_criacao.isoformat() if self.data_criacao else None,
        }

