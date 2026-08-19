"""
Centralized Logging Architecture for UpClip Studio — Phase 19.
Organizes structured application logs by category:
Application, Project, Media, AI, Rendering, Export.
"""

import os
import logging
import time
from pathlib import Path

import config

LOGS_DIR = config.ROOT_DIR / "data" / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# Main formatter
FORMATTER = logging.Formatter(
    fmt="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)


def _setup_logger(name: str, log_filename: str) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    
    # Avoid duplicate handlers if reloaded
    if not logger.handlers:
        # File handler
        file_path = LOGS_DIR / log_filename
        fh = logging.FileHandler(file_path, encoding="utf-8")
        fh.setFormatter(FORMATTER)
        logger.addHandler(fh)

        # Stream / Console handler
        sh = logging.StreamHandler()
        sh.setFormatter(FORMATTER)
        logger.addHandler(sh)

    return logger


# Categorized loggers
app_logger = _setup_logger("UpClip.App", "application.log")
project_logger = _setup_logger("UpClip.Project", "project.log")
media_logger = _setup_logger("UpClip.Media", "media.log")
ai_logger = _setup_logger("UpClip.AI", "ai.log")
render_logger = _setup_logger("UpClip.Render", "render.log")
export_logger = _setup_logger("UpClip.Export", "export.log")


class AppLogger:
    """Convenience wrapper for unified logging across categories."""

    @staticmethod
    def app(msg: str, level: str = "info"):
        getattr(app_logger, level.lower(), app_logger.info)(msg)

    @staticmethod
    def project(msg: str, level: str = "info"):
        getattr(project_logger, level.lower(), project_logger.info)(msg)

    @staticmethod
    def media(msg: str, level: str = "info"):
        getattr(media_logger, level.lower(), media_logger.info)(msg)

    @staticmethod
    def ai(msg: str, level: str = "info"):
        getattr(ai_logger, level.lower(), ai_logger.info)(msg)

    @staticmethod
    def render(msg: str, level: str = "info"):
        getattr(render_logger, level.lower(), render_logger.info)(msg)

    @staticmethod
    def export(msg: str, level: str = "info"):
        getattr(export_logger, level.lower(), export_logger.info)(msg)


logger = AppLogger()
