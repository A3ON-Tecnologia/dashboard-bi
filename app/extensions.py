from flask_sqlalchemy import SQLAlchemy

# Centralised extensions module so models and app factory share the same db instance.
db = SQLAlchemy()

