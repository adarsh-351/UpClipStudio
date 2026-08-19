"""
Comprehensive Project Management & Lifecycle Engine for UpClip Studio — Phase 19.
Handles Project Schema Versioning, Safe Loading & Migrations, Atomic Persistence,
Autosave & Recovery Snapshots, Save As, Project Duplication, and Recent Projects Tracking.
"""

import os
import json
import time
import shutil
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

import config
from core.constants import CURRENT_PROJECT_SCHEMA_VERSION, ASPECT_RATIO_PRESETS, ASPECT_9_16
from core.logger import logger
from core.exceptions import ProjectError, ProjectNotFoundError, ProjectValidationError

DATA_DIR = config.ROOT_DIR / "data"
PROJECTS_DIR = DATA_DIR / "projects"
AUTOSAVE_DIR = DATA_DIR / "autosave"
RECOVERY_DIR = DATA_DIR / "recovery"
RECENT_PROJECTS_FILE = DATA_DIR / "recent_projects.json"


class ProjectManager:
    def __init__(self):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
        AUTOSAVE_DIR.mkdir(parents=True, exist_ok=True)
        RECOVERY_DIR.mkdir(parents=True, exist_ok=True)
        self._init_storage()

    def _init_storage(self):
        if not RECENT_PROJECTS_FILE.exists():
            with open(RECENT_PROJECTS_FILE, "w", encoding="utf-8") as f:
                json.dump([], f, indent=2)

    # =========================================================================
    # PROJECT CREATION & INITIALIZATION
    # =========================================================================
    def create_project_manifest(
        self,
        name: str,
        source_path: Optional[str] = None,
        aspect_ratio: str = ASPECT_9_16,
        fps: int = 30,
        resolution: Optional[Dict[str, int]] = None
    ) -> Dict[str, Any]:
        """
        Create a new, versioned project manifest with safe default structures.
        """
        if not name or not name.strip():
            name = "Untitled Project"

        aspect_preset = ASPECT_RATIO_PRESETS.get(aspect_ratio, ASPECT_RATIO_PRESETS[ASPECT_9_16])
        w = resolution.get("width") if resolution else aspect_preset["width"]
        h = resolution.get("height") if resolution else aspect_preset["height"]

        now_iso = time.strftime("%Y-%m-%d %H:%M:%S")

        manifest = {
            "schema_version": CURRENT_PROJECT_SCHEMA_VERSION,
            "name": name.strip(),
            "created_at": now_iso,
            "updated_at": now_iso,
            "settings": {
                "aspectRatio": aspect_ratio,
                "fps": fps,
                "width": w,
                "height": h,
                "timecodeMode": "non_drop"
            },
            "source_path": source_path or "",
            "media": [
                {
                    "id": "media_source_1",
                    "filename": source_path,
                    "type": "video",
                    "label": "Source Video"
                }
            ] if source_path else [],
            "timeline": {
                "zoom": 30,
                "snapping": True,
                "inPoint": None,
                "outPoint": None,
                "markers": []
            },
            "clips": [
                {
                    "id": f"clip_src_1",
                    "filename": source_path,
                    "start": 0.0,
                    "end": 0.0,
                    "timelineStart": 0.0,
                    "duration": 0.0,
                    "track": "video",
                    "transform": { "x": 0, "y": 0, "scale": 100, "rotation": 0, "opacity": 100 }
                }
            ] if source_path else [],
            "captions": [],
            "captionStyle": {
                "font_family": "Inter",
                "font_size": 34,
                "font_weight": 800,
                "text_color": "#FFFFFF",
                "active_word_color": "#FBBF24",
                "outline_width": 3,
                "outline_color": "#000000",
                "shadow_blur": 4,
                "shadow_color": "#000000",
                "position": "bottom",
                "animation": "pop"
            },
            "graphics": [],
            "audioTracks": [
                { "id": "track_video_audio", "type": "video_audio", "name": "Video Audio", "volume": 100, "muted": False, "solo": False },
                { "id": "track_music", "type": "music", "name": "Music", "volume": 80, "muted": False, "solo": False, "ducking": { "enabled": True, "amount": 60 } },
                { "id": "track_voice", "type": "voice", "name": "Voice / Voiceover", "volume": 100, "muted": False, "solo": False },
                { "id": "track_sfx", "type": "sfx", "name": "SFX", "volume": 90, "muted": False, "solo": False }
            ],
            "audioClips": [],
            "workspaceState": {
                "activeWorkspace": "editing",
                "activeTab": "media",
                "selectedTool": "select"
            }
        }

        logger.project(f"Created new project manifest: '{name}' (Aspect: {aspect_ratio})")
        return manifest

    # =========================================================================
    # SCHEMA VALIDATION & SAFE MIGRATION
    # =========================================================================
    def validate_and_migrate(self, project_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate and safely migrate older or partial project data structures
        to the current schema version without dropping unknown data.
        """
        if not isinstance(project_data, dict):
            logger.project("Project data is not a dictionary. Returning empty safe project.")
            return self.create_project_manifest("Recovered Project")

        migrated = dict(project_data)

        # 1. Check schema version
        ver = migrated.get("schema_version", 0)
        if ver < 1:
            logger.project(f"Migrating project from legacy schema v{ver} to v{CURRENT_PROJECT_SCHEMA_VERSION}")
            migrated["schema_version"] = CURRENT_PROJECT_SCHEMA_VERSION

        # 2. Safe defaults for required top-level collections
        if "name" not in migrated or not migrated["name"]:
            migrated["name"] = "Untitled Project"

        if "settings" not in migrated or not isinstance(migrated["settings"], dict):
            migrated["settings"] = {
                "aspectRatio": migrated.get("aspectRatio", "9:16"),
                "fps": 30,
                "width": 1080,
                "height": 1920
            }

        if "clips" not in migrated or not isinstance(migrated["clips"], list):
            migrated["clips"] = []

        if "captions" not in migrated or not isinstance(migrated["captions"], list):
            migrated["captions"] = []

        if "graphics" not in migrated or not isinstance(migrated["graphics"], list):
            migrated["graphics"] = []

        if "audioTracks" not in migrated or not isinstance(migrated["audioTracks"], list):
            migrated["audioTracks"] = [
                { "id": "track_video_audio", "type": "video_audio", "name": "Video Audio", "volume": 100, "muted": False },
                { "id": "track_music", "type": "music", "name": "Music", "volume": 80, "muted": False, "ducking": { "enabled": True, "amount": 60 } },
                { "id": "track_voice", "type": "voice", "name": "Voice / Voiceover", "volume": 100, "muted": False },
                { "id": "track_sfx", "type": "sfx", "name": "SFX", "volume": 90, "muted": False }
            ]

        if "audioClips" not in migrated or not isinstance(migrated["audioClips"], list):
            migrated["audioClips"] = []

        if "timeline" not in migrated or not isinstance(migrated["timeline"], dict):
            migrated["timeline"] = { "zoom": 30, "snapping": True, "markers": [] }

        # 3. Sanitize individual clip objects
        valid_clips = []
        for c in migrated["clips"]:
            if isinstance(c, dict):
                c_item = dict(c)
                c_item.setdefault("start", 0.0)
                c_item.setdefault("end", 0.0)
                c_item.setdefault("timelineStart", 0.0)
                c_item.setdefault("track", "video")
                c_item.setdefault("transform", { "x": 0, "y": 0, "scale": 100, "rotation": 0, "opacity": 100 })
                valid_clips.append(c_item)
        migrated["clips"] = valid_clips

        # 4. Sanitize caption objects
        valid_caps = []
        for cap in migrated["captions"]:
            if isinstance(cap, dict):
                cap_item = dict(cap)
                cap_item.setdefault("text", "")
                cap_item.setdefault("start", 0.0)
                cap_item.setdefault("end", 0.0)
                cap_item.setdefault("words", [])
                valid_caps.append(cap_item)
        migrated["captions"] = valid_caps

        return migrated

    # =========================================================================
    # ATOMIC PERSISTENCE & SAFE WRITES
    # =========================================================================
    def atomic_write_json(self, target_path: Path, data: Any):
        """
        Write JSON data atomically to prevent corruption from abrupt termination.
        """
        target_path = Path(target_path)
        target_path.parent.mkdir(parents=True, exist_ok=True)

        temp_fd, temp_file_path = tempfile.mkstemp(dir=str(target_path.parent), prefix="tmp_save_")
        try:
            with os.fdopen(temp_fd, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            shutil.move(temp_file_path, str(target_path))
        except Exception as e:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            logger.project(f"Atomic write error for {target_path}: {e}", level="error")
            raise e

    # =========================================================================
    # AUTOSAVE & RECOVERY MANAGEMENT
    # =========================================================================
    def save_autosave_snapshot(self, project_id: Any, project_dict: Dict[str, Any]) -> str:
        """
        Save a debounced autosave snapshot for emergency session recovery.
        """
        try:
            pid_str = str(project_id)
            autosave_file = AUTOSAVE_DIR / f"autosave_proj_{pid_str}.json"
            self.atomic_write_json(autosave_file, project_dict)
            return str(autosave_file)
        except Exception as e:
            logger.project(f"Autosave snapshot failed for proj_{project_id}: {e}", level="warning")
            return ""

    def get_recovery_snapshot(self, project_id: Any) -> Optional[Dict[str, Any]]:
        """
        Retrieve the latest emergency autosave snapshot if available.
        """
        pid_str = str(project_id)
        autosave_file = AUTOSAVE_DIR / f"autosave_proj_{pid_str}.json"
        if autosave_file.exists():
            try:
                with open(autosave_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return self.validate_and_migrate(data)
            except Exception as e:
                logger.project(f"Recovery read error: {e}", level="warning")
        return None

    def clear_autosave(self, project_id: Any):
        pid_str = str(project_id)
        autosave_file = AUTOSAVE_DIR / f"autosave_proj_{pid_str}.json"
        if autosave_file.exists():
            try:
                autosave_file.unlink()
            except Exception:
                pass

    def get_project(self, project_id: Any) -> Optional[Any]:
        """
        Retrieve project by ID from database or disk manifest.
        """
        try:
            from models.project import Project
            pid = int(str(project_id).replace("proj_", ""))
            return Project.query.get(pid)
        except Exception:
            return self.get_recovery_snapshot(project_id)

    # =========================================================================
    # RECENT PROJECTS TRACKING
    # =========================================================================
    def get_recent_projects(self) -> List[Dict[str, Any]]:
        """
        Return the list of recent projects with disk existence check.
        """
        try:
            if RECENT_PROJECTS_FILE.exists():
                with open(RECENT_PROJECTS_FILE, "r", encoding="utf-8") as f:
                    recents = json.load(f)
                
                # Check file availability
                for r in recents:
                    source_fn = r.get("source_path")
                    if source_fn:
                        p1 = config.INPUT_DIR / source_fn
                        p2 = config.CLIPS_DIR / source_fn
                        r["isAvailable"] = p1.exists() or p2.exists()
                    else:
                        r["isAvailable"] = True

                return recents
        except Exception as e:
            logger.project(f"Failed to load recent projects: {e}", level="warning")

        return []

    def record_recent_project(self, project_id: int, name: str, source_path: str = "", thumbnail_path: str = ""):
        """
        Add or update an entry in the recent projects list.
        """
        try:
            recents = []
            if RECENT_PROJECTS_FILE.exists():
                with open(RECENT_PROJECTS_FILE, "r", encoding="utf-8") as f:
                    recents = json.load(f)

            # Remove existing entry for same ID
            recents = [r for r in recents if r.get("id") != project_id]

            entry = {
                "id": project_id,
                "name": name or f"Project {project_id}",
                "source_path": source_path or "",
                "thumbnail_path": thumbnail_path or "",
                "lastOpened": time.strftime("%Y-%m-%d %H:%M:%S"),
                "isAvailable": True
            }

            recents.insert(0, entry)
            # Limit to last 20 recent projects
            recents = recents[:20]

            self.atomic_write_json(RECENT_PROJECTS_FILE, recents)
        except Exception as e:
            logger.project(f"Failed to record recent project: {e}", level="warning")

    def remove_recent_project(self, project_id: int) -> bool:
        """
        Remove project from the recent projects list without deleting underlying data.
        """
        try:
            if RECENT_PROJECTS_FILE.exists():
                with open(RECENT_PROJECTS_FILE, "r", encoding="utf-8") as f:
                    recents = json.load(f)

                recents = [r for r in recents if r.get("id") != project_id]
                self.atomic_write_json(RECENT_PROJECTS_FILE, recents)
                return True
        except Exception as e:
            logger.project(f"Failed to remove recent project: {e}", level="warning")
        return False


project_manager = ProjectManager()
