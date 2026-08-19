"""
Core Managers Facade for UpClip Studio — Phase 19.
Centralizes access to all domain managers.
"""

from core.project_manager import project_manager, ProjectManager
from core.workspace_manager import workspace_manager, WorkspaceManager
from core.settings_manager import settings_manager, SettingsManager
from core.media_manager import media_manager, MediaManager
from core.progress import task_manager, TaskManager
from core.preset_manager import preset_manager, PresetManager
from core.graphics_manager import graphics_manager, GraphicsManager
from core.render_queue import render_queue_manager, RenderQueueManager
from core.logger import logger
