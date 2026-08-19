import threading
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class MediaItem:
    filename: str
    media_type: str  # source | clip | final | srt | vtt | transcript
    label: str = ""
    url: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CaptionStyleConfig:
    id: str
    name: str
    font_family: str = "Arial Black"
    font_size: int = 34
    font_weight: int = 800
    text_color: str = "#FFFFFF"
    active_word_color: str = "#fbbf24"
    background_color: str = "#000000"
    background_opacity: float = 0.0
    outline_color: str = "#000000"
    outline_width: int = 3
    shadow_color: str = "#000000"
    shadow_blur: int = 4
    shadow_offset_y: int = 2
    position: str = "bottom"
    animation: str = "pop"
    letter_spacing: int = 0
    line_height: float = 1.2
    max_lines: int = 2


@dataclass
class ProjectState:
    project_id: str
    source_video: Optional[MediaItem] = None
    clips: List[MediaItem] = field(default_factory=list)
    caption_files: List[MediaItem] = field(default_factory=list)
    final_exports: List[MediaItem] = field(default_factory=list)
    caption_style: Optional[CaptionStyleConfig] = None
    caption_styles: List[Dict[str, Any]] = field(default_factory=list)
    current_module: str = "home"
    navigation_history: List[Dict[str, Any]] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


class ProjectStateManager:
    _instance = None
    _lock = threading.Lock()
    _projects: Dict[str, ProjectState] = {}
    _projects_lock = threading.Lock()
    _active_project_id: Optional[str] = None

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._projects = {}
                cls._instance._projects_lock = threading.Lock()
                cls._instance._active_project_id = None
            return cls._instance

    def create_project(self, source_filename: str, source_url: str = "") -> ProjectState:
        project_id = f"proj_{int(datetime.now().timestamp() * 1000)}"
        source = MediaItem(
            filename=source_filename,
            media_type="source",
            label="Source Video",
            url=source_url,
        )
        project = ProjectState(project_id=project_id, source_video=source)
        with self._projects_lock:
            self._projects[project_id] = project
        self._active_project_id = project_id
        return project

    def get_project(self, project_id: str) -> Optional[ProjectState]:
        with self._projects_lock:
            return self._projects.get(project_id)

    def get_active_project(self) -> Optional[ProjectState]:
        if not self._active_project_id:
            return None
        return self.get_project(self._active_project_id)

    def set_active_project(self, project_id: str):
        with self._projects_lock:
            if project_id in self._projects:
                self._active_project_id = project_id

    def add_clip(self, project_id: str, clip_filename: str, clip_url: str = "", label: str = "") -> Optional[MediaItem]:
        project = self.get_project(project_id)
        if not project:
            return None
        clip = MediaItem(
            filename=clip_filename,
            media_type="clip",
            label=label or Path(clip_filename).name,
            url=clip_url,
        )
        project.clips.append(clip)
        return clip

    def add_caption_file(self, project_id: str, filename: str, media_type: str = "srt", url: str = "") -> Optional[MediaItem]:
        project = self.get_project(project_id)
        if not project:
            return None
        item = MediaItem(
            filename=filename,
            media_type=media_type,
            label=filename,
            url=url,
        )
        project.caption_files.append(item)
        return item

    def add_final_export(self, project_id: str, filename: str, url: str = "", label: str = "") -> Optional[MediaItem]:
        project = self.get_project(project_id)
        if not project:
            return None
        item = MediaItem(
            filename=filename,
            media_type="final",
            label=label or filename,
            url=url,
        )
        project.final_exports.append(item)
        return item

    def set_caption_style(self, project_id: str, style: CaptionStyleConfig):
        project = self.get_project(project_id)
        if not project:
            return
        project.caption_style = style

    def get_caption_style(self, project_id: str) -> Optional[CaptionStyleConfig]:
        project = self.get_project(project_id)
        if not project:
            return None
        return project.caption_style

    def navigate_to(self, project_id: str, module: str, context: Optional[Dict[str, Any]] = None):
        project = self.get_project(project_id)
        if not project:
            return
        if project.current_module and project.current_module != module:
            project.navigation_history.append({
                "from": project.current_module,
                "to": module,
                "timestamp": datetime.now().isoformat(),
                "context": context or {},
            })
        project.current_module = module

    def get_clip_caption_files(self, project_id: str, clip_filename: str) -> List[MediaItem]:
        project = self.get_project(project_id)
        if not project:
            return []
        stem = Path(clip_filename).stem
        return [
            item for item in project.caption_files
            if Path(item.filename).stem == stem
        ]

    def get_source_video(self, project_id: str) -> Optional[MediaItem]:
        project = self.get_project(project_id)
        if not project:
            return None
        return project.source_video

    def get_all_clips(self, project_id: str) -> List[MediaItem]:
        project = self.get_project(project_id)
        if not project:
            return []
        return list(project.clips)

    def get_outputs(self, project_id: str) -> List[MediaItem]:
        project = self.get_project(project_id)
        if not project:
            return []
        return project.clips + project.final_exports

    def delete_clip(self, project_id: str, clip_filename: str) -> bool:
        project = self.get_project(project_id)
        if not project:
            return False
        project.clips = [c for c in project.clips if c.filename != clip_filename]
        return True

    def cleanup_project(self, project_id: str):
        with self._projects_lock:
            if project_id in self._projects:
                del self._projects[project_id]
                if self._active_project_id == project_id:
                    self._active_project_id = None

    def list_all_projects(self) -> List[Dict[str, Any]]:
        summaries = []
        with self._projects_lock:
            for pid, proj in self._projects.items():
                summaries.append({
                    "project_id": pid,
                    "source_video": proj.source_video.filename if proj.source_video else None,
                    "clips": [c.filename for c in proj.clips],
                    "current_module": proj.current_module,
                })
        return summaries

    def find_project_by_filename(self, filename: str) -> Optional[ProjectState]:
        with self._projects_lock:
            for pid, proj in self._projects.items():
                if proj.source_video and proj.source_video.filename == filename:
                    return proj
                for clip in proj.clips:
                    if clip.filename == filename:
                        return proj
        return None


project_state = ProjectStateManager()
