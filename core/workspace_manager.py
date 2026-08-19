"""
Core Workspace, Version Management, Review & System Diagnostics Manager for UpClip Studio.
Provides multi-workspace layouts, named project version snapshots, timestamped review comments,
and real-time system diagnostics.
"""

import os
import sys
import time
import json
import uuid
import platform
import shutil
import subprocess
from pathlib import Path

import config

DATA_DIR = config.ROOT_DIR / "data"
VERSIONS_DIR = DATA_DIR / "versions"
REVIEWS_DIR = DATA_DIR / "reviews"
WORKSPACES_FILE = DATA_DIR / "workspaces.json"

DEFAULT_WORKSPACES = [
    {
        "id": "editing",
        "name": "Editing & Timeline",
        "description": "Standard multi-track editing workspace with media library, timeline, and inspector.",
        "icon": "✂",
        "defaultTool": "media",
        "panels": { "sidebar": True, "timeline": True, "inspector": True }
    },
    {
        "id": "review",
        "name": "Review & Approval",
        "description": "Focused playback interface with timestamped review comments and approval status.",
        "icon": "✓",
        "defaultTool": "notes",
        "panels": { "sidebar": True, "timeline": True, "inspector": False }
    },
    {
        "id": "captions",
        "name": "Audio & Captions",
        "description": "Dedicated subtitles, karaoke timing, and multi-track audio mixdown view.",
        "icon": "💬",
        "defaultTool": "text",
        "panels": { "sidebar": True, "timeline": True, "inspector": True }
    },
    {
        "id": "graphics",
        "name": "Graphics & Motion",
        "description": "Visual shapes, badges, lower thirds, and animated overlays.",
        "icon": "✦",
        "defaultTool": "graphics",
        "panels": { "sidebar": True, "timeline": True, "inspector": True }
    },
    {
        "id": "ai",
        "name": "AI Automation",
        "description": "Scene detection, dead-air auto-trim, and smart 9:16 vertical reframing.",
        "icon": "⚡",
        "defaultTool": "ai",
        "panels": { "sidebar": True, "timeline": True, "inspector": True }
    },
    {
        "id": "minimal",
        "name": "Minimal Canvas",
        "description": "Distraction-free large video preview.",
        "icon": "⬛",
        "defaultTool": "media",
        "panels": { "sidebar": False, "timeline": True, "inspector": False }
    }
]


class WorkspaceManager:
    def __init__(self):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        VERSIONS_DIR.mkdir(parents=True, exist_ok=True)
        REVIEWS_DIR.mkdir(parents=True, exist_ok=True)
        self._init_workspaces()

    def _init_workspaces(self):
        if not WORKSPACES_FILE.exists():
            with open(WORKSPACES_FILE, "w", encoding="utf-8") as f:
                json.dump(DEFAULT_WORKSPACES, f, indent=2)

    def get_workspaces(self):
        try:
            if WORKSPACES_FILE.exists():
                with open(WORKSPACES_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception:
            pass
        return DEFAULT_WORKSPACES

    # =========================================================================
    # PROJECT VERSION MANAGEMENT
    # =========================================================================
    def get_versions(self, project_id):
        v_file = VERSIONS_DIR / f"proj_{project_id}_versions.json"
        if v_file.exists():
            try:
                with open(v_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print("[WORKSPACE] Failed to load project versions:", e)
        return []

    def save_version(self, project_id, version_name, note, editor_state):
        versions = self.get_versions(project_id)
        version_number = len(versions) + 1
        version_id = f"v{version_number}_{int(time.time())}"

        new_version = {
            "id": version_id,
            "versionNumber": version_number,
            "name": version_name or f"Version {version_number}",
            "note": note or "",
            "createdAt": time.strftime("%Y-%m-%d %H:%M:%S"),
            "editorState": editor_state
        }

        versions.append(new_version)
        v_file = VERSIONS_DIR / f"proj_{project_id}_versions.json"
        with open(v_file, "w", encoding="utf-8") as f:
            json.dump(versions, f, indent=2)

        return new_version

    def restore_version(self, project_id, version_id):
        versions = self.get_versions(project_id)
        target = next((v for v in versions if v["id"] == version_id), None)
        return target

    # =========================================================================
    # REVIEW & COMMENTS MANAGEMENT
    # =========================================================================
    def get_review_data(self, project_id):
        r_file = REVIEWS_DIR / f"proj_{project_id}_review.json"
        if r_file.exists():
            try:
                with open(r_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            "status": "In Review",
            "comments": []
        }

    def add_comment(self, project_id, timestamp, author, text):
        review_data = self.get_review_data(project_id)
        comment_id = f"c_{int(time.time())}_{uuid.uuid4().hex[:4]}"

        new_comment = {
            "id": comment_id,
            "timestamp": float(timestamp or 0.0),
            "author": author or "Reviewer",
            "text": text,
            "resolved": False,
            "createdAt": time.strftime("%Y-%m-%d %H:%M:%S")
        }

        review_data["comments"].append(new_comment)
        r_file = REVIEWS_DIR / f"proj_{project_id}_review.json"
        with open(r_file, "w", encoding="utf-8") as f:
            json.dump(review_data, f, indent=2)

        return new_comment

    def toggle_resolve_comment(self, project_id, comment_id):
        review_data = self.get_review_data(project_id)
        for c in review_data.get("comments", []):
            if c["id"] == comment_id:
                c["resolved"] = not c.get("resolved", False)
                break

        r_file = REVIEWS_DIR / f"proj_{project_id}_review.json"
        with open(r_file, "w", encoding="utf-8") as f:
            json.dump(review_data, f, indent=2)

        return review_data

    def update_review_status(self, project_id, status):
        review_data = self.get_review_data(project_id)
        review_data["status"] = status
        r_file = REVIEWS_DIR / f"proj_{project_id}_review.json"
        with open(r_file, "w", encoding="utf-8") as f:
            json.dump(review_data, f, indent=2)

        return review_data

    # =========================================================================
    # SYSTEM DIAGNOSTICS
    # =========================================================================
    def get_diagnostics(self):
        ffmpeg_version = "Unknown"
        try:
            res = subprocess.run([config.FFMPEG_PATH, "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=3)
            first_line = res.stdout.splitlines()[0] if res.stdout else "Available"
            ffmpeg_version = first_line[:50]
        except Exception as e:
            ffmpeg_version = f"Error: {e}"

        disk_usage = shutil.disk_usage(config.ROOT_DIR)
        free_gb = round(disk_usage.free / (1024 ** 3), 2)
        total_gb = round(disk_usage.total / (1024 ** 3), 2)

        return {
            "appName": "UpClip Studio Pro",
            "version": "1.0.0 (Phase 11)",
            "os": f"{platform.system()} {platform.release()} ({platform.machine()})",
            "pythonVersion": sys.version.split()[0],
            "ffmpegPath": config.FFMPEG_PATH,
            "ffmpegVersion": ffmpeg_version,
            "storage": {
                "freeGB": free_gb,
                "totalGB": total_gb,
                "percentFree": round((disk_usage.free / disk_usage.total) * 100, 1)
            },
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }


workspace_manager = WorkspaceManager()
