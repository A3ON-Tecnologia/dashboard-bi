from flask import session

from app.themes.theme_config import get_theme

DEFAULT_THEME = "futurist"


def get_current_theme() -> dict:
    return get_theme(session.get("theme", DEFAULT_THEME))


def get_theme_context() -> dict:
    return get_current_theme()


def update_theme(theme_name: str) -> dict:
    session["theme"] = theme_name
    return get_theme(theme_name)

