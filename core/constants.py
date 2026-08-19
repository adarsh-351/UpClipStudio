"""
Application Constants, Event Types & Schema Metadata for UpClip Studio — Phase 19.
"""

# Schema versioning
CURRENT_PROJECT_SCHEMA_VERSION = 1

# Project dirty states
DIRTY_STATE_CLEAN = "clean"
DIRTY_STATE_DIRTY = "dirty"
DIRTY_STATE_SAVING = "saving"
DIRTY_STATE_SAVED = "saved"
DIRTY_STATE_ERROR = "error"

# Standard Workspaces
WORKSPACE_HOME = "home"
WORKSPACE_AI_CLIPS = "ai_clips"
WORKSPACE_CAPTION_STUDIO = "captions"
WORKSPACE_YT_DOWNLOADER = "youtube"
WORKSPACE_EDITOR = "editor"
WORKSPACE_REVIEW = "review"

ALL_WORKSPACES = [
    WORKSPACE_HOME,
    WORKSPACE_AI_CLIPS,
    WORKSPACE_CAPTION_STUDIO,
    WORKSPACE_YT_DOWNLOADER,
    WORKSPACE_EDITOR,
    WORKSPACE_REVIEW
]

# Standard Aspect Ratios
ASPECT_9_16 = "9:16"
ASPECT_16_9 = "16:9"
ASPECT_1_1 = "1:1"
ASPECT_4_5 = "4:5"

ASPECT_RATIO_PRESETS = {
    ASPECT_9_16: { "width": 1080, "height": 1920, "label": "9:16 Vertical Shorts" },
    ASPECT_16_9: { "width": 1920, "height": 1080, "label": "16:9 Widescreen Landscape" },
    ASPECT_1_1: { "width": 1080, "height": 1080, "label": "1:1 Square Feed" },
    ASPECT_4_5: { "width": 1080, "height": 1350, "label": "4:5 Portrait Feed" }
}

# Task / Background Job Statuses
TASK_STATUS_IDLE = "idle"
TASK_STATUS_LOADING = "loading"
TASK_STATUS_PROCESSING = "processing"
TASK_STATUS_COMPLETED = "completed"
TASK_STATUS_FAILED = "failed"
TASK_STATUS_CANCELLED = "cancelled"

# Application Event Types
EVENT_PROJECT_CREATED = "project.created"
EVENT_PROJECT_LOADED = "project.loaded"
EVENT_PROJECT_SAVED = "project.saved"
EVENT_PROJECT_CHANGED = "project.changed"
EVENT_MEDIA_IMPORTED = "media.imported"
EVENT_MEDIA_REMOVED = "media.removed"
EVENT_WORKSPACE_CHANGED = "workspace.changed"
EVENT_RENDER_STARTED = "render.started"
EVENT_RENDER_COMPLETED = "render.completed"
EVENT_RENDER_FAILED = "render.failed"
