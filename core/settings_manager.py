"""
Centralized Application Settings & User Preferences Manager for UpClip Studio — Phase 19.
Stores global application configuration (Appearance, Editing, Playback, Captions, Export, Performance, Shortcuts)
in data/settings.json independently of project files.
"""

import json
from pathlib import Path
from typing import Any, Dict

import config
from core.logger import logger

DATA_DIR = config.ROOT_DIR / "data"
SETTINGS_FILE = DATA_DIR / "settings.json"

DEFAULT_SETTINGS: Dict[str, Any] = {
    "general": {
        "autoSaveEnabled": True,
        "autoSaveIntervalMs": 2000,
        "confirmOnCloseUnsaved": True,
        "defaultProjectName": "Untitled Project",
        "defaultAspectRatio": "9:16",
        "defaultFps": 30
    },
    "appearance": {
        "theme": "dark",  # "dark" or "light"
        "accentColor": "#8B5CF6",
        "uiScale": 100,
        "compactTimeline": False,
        "showSafeGuidesByDefault": True
    },
    "editing": {
        "snapThresholdPx": 8,
        "defaultClipDuration": 4.0,
        "rippleDeleteByDefault": True,
        "smartSplitWordLimit": 5,
        "smartSplitCharLimit": 32
    },
    "playback": {
        "defaultPlaybackSpeed": 1.0,
        "autoLoopPlayback": False,
        "masterVolume": 80,
        "spacebarPlayPause": True
    },
    "captions": {
        "defaultFont": "Inter",
        "defaultFontSize": 34,
        "defaultFontWeight": 800,
        "defaultTextColor": "#FFFFFF",
        "defaultActiveWordColor": "#FBBF24",
        "defaultAnimation": "pop"
    },
    "export": {
        "defaultResolution": "1080p",
        "defaultCodec": "h264",
        "defaultBitrate": "12M",
        "burnCaptionsByDefault": True
    },
    "performance": {
        "hardwareAcceleration": "auto",
        "previewQuality": "high",
        "maxBackgroundThreads": 4,
        "tempCacheLimitGB": 10
    },
    "keyboard": {
        "playPause": "Space",
        "split": "Ctrl+S",
        "duplicate": "Ctrl+D",
        "undo": "Ctrl+Z",
        "redo": "Ctrl+Shift+Z",
        "commandPalette": "Ctrl+K",
        "delete": "Delete"
    }
}


class SettingsManager:
    def __init__(self):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.settings = self._load_settings()

    def _load_settings(self) -> Dict[str, Any]:
        if SETTINGS_FILE.exists():
            try:
                with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                    loaded = json.load(f)
                # Merge defaults for any missing keys
                merged = dict(DEFAULT_SETTINGS)
                for cat, values in loaded.items():
                    if cat in merged and isinstance(values, dict):
                        merged[cat].update(values)
                    else:
                        merged[cat] = values
                return merged
            except Exception as e:
                logger.app(f"Failed to read settings.json: {e}. Using defaults.", level="warning")

        return dict(DEFAULT_SETTINGS)

    def get_settings(self) -> Dict[str, Any]:
        return self.settings

    def get_category(self, category: str) -> Dict[str, Any]:
        return self.settings.get(category, {})

    def update_settings(self, new_settings: Dict[str, Any]) -> Dict[str, Any]:
        for cat, values in new_settings.items():
            if cat in self.settings and isinstance(values, dict):
                self.settings[cat].update(values)
            else:
                self.settings[cat] = values

        try:
            with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                json.dump(self.settings, f, indent=2)
            logger.app("Application settings saved to disk.")
        except Exception as e:
            logger.app(f"Failed to write settings.json: {e}", level="error")

        return self.settings

    def reset_defaults(self) -> Dict[str, Any]:
        self.settings = dict(DEFAULT_SETTINGS)
        try:
            with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                json.dump(self.settings, f, indent=2)
        except Exception:
            pass
        return self.settings


settings_manager = SettingsManager()
