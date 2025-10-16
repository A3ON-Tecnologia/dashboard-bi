from datetime import datetime

from app.extensions import db

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    senha_hash = db.Column(db.String(128), nullable=False)
    data_criacao = db.Column(db.DateTime, default=datetime.utcnow)
    data_edicao = db.Column(db.DateTime, onupdate=datetime.utcnow)
    admin = db.Column(db.Boolean, default=False, nullable=False)
    
    def __repr__(self):
        return f'<User {self.email}>'
