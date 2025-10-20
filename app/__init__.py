from pathlib import Path
from datetime import timezone, timedelta

from flask import Flask
from flask_migrate import Migrate

from config import Config
from app.extensions import db

# Criar timezone de São Paulo manualmente (UTC-3)
SAO_PAULO_TZ = timezone(timedelta(hours=-3))
UTC = timezone.utc


def to_sao_paulo(dt, fmt: str = "%d/%m/%Y %H:%M") -> str:
    if not dt:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(SAO_PAULO_TZ).strftime(fmt)


def create_app(config_object: type[Config] = Config) -> Flask:
    template_dir = Path(__file__).resolve().parent / "templates"
    static_dir = Path(__file__).resolve().parent / "static"

    app = Flask(
        __name__,
        template_folder=str(template_dir),
        static_folder=str(static_dir),
    )

    app.config.from_object(config_object)
    app.jinja_env.auto_reload = True
    app.config["TEMPLATES_AUTO_RELOAD"] = True
    app.jinja_env.filters["datetime_sp"] = to_sao_paulo

    upload_path = Path(app.config["UPLOAD_FOLDER"])
    upload_path.mkdir(parents=True, exist_ok=True)

    db.init_app(app)
    Migrate(app, db)

    with app.app_context():
        from app.routes.web import web_bp
        from app.routes.api import api_bp

        app.register_blueprint(web_bp)
        app.register_blueprint(api_bp, url_prefix="/api")

    return app

