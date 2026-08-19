# routes/projects.py
"""
Project & Application Management API Endpoints — UpClip Studio Phase 19.
Provides CRUD operations, Schema Validation, Autosave/Recovery, Save As,
Recent Projects Tracking, Global Settings, and Background Task Management.
"""

import json
from flask import Blueprint, request, jsonify

from app import db
from models.project import Project
from core.project_manager import project_manager
from core.settings_manager import settings_manager
from core.progress import task_manager
from core.logger import logger

projects_bp = Blueprint('projects', __name__)


# =========================================================================
# PROJECT CRUD OPERATIONS
# =========================================================================

@projects_bp.route('/api/projects', methods=['GET'])
def list_projects():
    """List all projects ordered by last updated date."""
    projects = Project.query.order_by(Project.updated_at.desc()).limit(20).all()
    return jsonify([p.to_dict() for p in projects])


@projects_bp.route('/api/projects', methods=['POST'])
def create_project():
    """Create a new project with settings (name, aspect ratio, fps, resolution)."""
    data = request.get_json() or {}
    name = data.get('name', 'Untitled Project').strip()
    source_path = data.get('source_path')
    aspect_ratio = data.get('aspect_ratio', data.get('aspectRatio', '9:16'))
    fps = int(data.get('fps', 30))
    resolution = data.get('resolution')

    manifest = project_manager.create_project_manifest(
        name=name,
        source_path=source_path,
        aspect_ratio=aspect_ratio,
        fps=fps,
        resolution=resolution
    )

    proj = Project(
        name=name,
        source_path=source_path,
        status='ready',
        editor_state=json.dumps(manifest)
    )
    db.session.add(proj)
    db.session.commit()

    # Record in recent projects
    project_manager.record_recent_project(
        project_id=proj.id,
        name=proj.name,
        source_path=proj.source_path or "",
        thumbnail_path=proj.thumbnail_path or ""
    )

    logger.project(f"New project created: #{proj.id} - '{proj.name}'")
    return jsonify(proj.to_dict()), 201


@projects_bp.route('/api/projects/<int:proj_id>', methods=['GET'])
def get_project(proj_id):
    """Retrieve project by ID with schema validation and safe migration."""
    proj = Project.query.get_or_404(proj_id)

    # Validate and migrate editor state
    editor_state_dict = {}
    if proj.editor_state:
        try:
            parsed = json.loads(proj.editor_state)
            editor_state_dict = project_manager.validate_and_migrate(parsed)
        except Exception as e:
            logger.project(f"Error parsing editor state for project {proj_id}: {e}", level="warning")
            editor_state_dict = project_manager.create_project_manifest(proj.name, proj.source_path)

    project_dict = proj.to_dict()
    project_dict["editor_state_parsed"] = editor_state_dict

    # Record as recently opened
    project_manager.record_recent_project(
        project_id=proj.id,
        name=proj.name,
        source_path=proj.source_path or "",
        thumbnail_path=proj.thumbnail_path or ""
    )

    return jsonify(project_dict)


@projects_bp.route('/api/projects/<int:proj_id>', methods=['PUT'])
def update_project(proj_id):
    """Update project metadata, name, or full editor state."""
    proj = Project.query.get_or_404(proj_id)
    data = request.get_json() or {}

    for field in ['name', 'status', 'thumbnail_path', 'duration']:
        if field in data and data[field] is not None:
            setattr(proj, field, data[field])

    if 'editor_state' in data:
        editor_state_val = data['editor_state']
        if isinstance(editor_state_val, dict):
            migrated = project_manager.validate_and_migrate(editor_state_val)
            proj.editor_state = json.dumps(migrated)
        elif isinstance(editor_state_val, str):
            try:
                parsed = json.loads(editor_state_val)
                migrated = project_manager.validate_and_migrate(parsed)
                proj.editor_state = json.dumps(migrated)
            except Exception:
                proj.editor_state = editor_state_val

    db.session.commit()

    # Update recent projects tracking
    project_manager.record_recent_project(
        project_id=proj.id,
        name=proj.name,
        source_path=proj.source_path or "",
        thumbnail_path=proj.thumbnail_path or ""
    )

    return jsonify(proj.to_dict())


@projects_bp.route('/api/projects/<int:proj_id>', methods=['DELETE'])
def delete_project(proj_id):
    """Delete a project record and cleanup associated temporary autosave files."""
    proj = Project.query.get_or_404(proj_id)
    if proj.thumbnail_path:
        try:
            import os
            if os.path.exists(proj.thumbnail_path):
                os.remove(proj.thumbnail_path)
        except Exception:
            pass

    project_manager.clear_autosave(proj_id)
    project_manager.remove_recent_project(proj_id)

    db.session.delete(proj)
    db.session.commit()
    logger.project(f"Project #{proj_id} deleted.")
    return jsonify({'result': 'deleted', 'id': proj_id}), 200


# =========================================================================
# SAVE AS & DUPLICATION
# =========================================================================

@projects_bp.route('/api/projects/<int:proj_id>/save-as', methods=['POST'])
def save_project_as(proj_id):
    """Save As: Create a completely independent project clone with a new name."""
    orig = Project.query.get_or_404(proj_id)
    data = request.get_json(silent=True) or {}
    new_name = data.get("name", f"{orig.name} (Copy)").strip()

    # Parse and update name inside editor_state
    new_editor_state = orig.editor_state
    if orig.editor_state:
        try:
            parsed = json.loads(orig.editor_state)
            parsed["name"] = new_name
            new_editor_state = json.dumps(parsed)
        except Exception:
            pass

    clone = Project(
        name=new_name,
        source_path=orig.source_path,
        thumbnail_path=orig.thumbnail_path,
        status='ready',
        duration=orig.duration,
        editor_state=new_editor_state
    )
    db.session.add(clone)
    db.session.commit()

    project_manager.record_recent_project(
        project_id=clone.id,
        name=clone.name,
        source_path=clone.source_path or "",
        thumbnail_path=clone.thumbnail_path or ""
    )

    logger.project(f"Project #{orig.id} saved as new project #{clone.id} ('{clone.name}')")
    return jsonify({
        "success": True,
        "project": clone.to_dict()
    }), 201


@projects_bp.route('/api/projects/<int:proj_id>/duplicate', methods=['POST'])
def duplicate_project(proj_id):
    """Duplicate a project with an independent ID, cloned editor state, and shared source reference."""
    orig = Project.query.get_or_404(proj_id)
    new_name = f"{orig.name} (Copy)"

    clone = Project(
        name=new_name,
        source_path=orig.source_path,
        thumbnail_path=orig.thumbnail_path,
        status='ready',
        duration=orig.duration,
        editor_state=orig.editor_state
    )
    db.session.add(clone)
    db.session.commit()

    project_manager.record_recent_project(
        project_id=clone.id,
        name=clone.name,
        source_path=clone.source_path or "",
        thumbnail_path=clone.thumbnail_path or ""
    )

    return jsonify({
        "success": True,
        "project": clone.to_dict()
    }), 201


@projects_bp.route('/api/projects/<int:proj_id>/save-as-template', methods=['POST'])
def save_project_as_template(proj_id):
    """Convert project visual layout, graphics, and audio structure into a reusable user template."""
    proj = Project.query.get_or_404(proj_id)
    data = request.get_json(silent=True) or {}

    template_name = data.get("name") or f"{proj.name} Template"
    category = data.get("category") or "Custom"
    description = data.get("description") or f"Created from project {proj.name}"

    parsed_editor_state = {}
    if proj.editor_state:
        try:
            parsed_editor_state = json.loads(proj.editor_state)
        except Exception:
            pass

    template_payload = {
        "name": template_name,
        "category": category,
        "aspectRatio": "9:16",
        "description": description,
        "favorite": False,
        "data": {
            "aspectRatio": "9:16",
            "captionStyle": parsed_editor_state.get("captionStyle", {}),
            "graphics": parsed_editor_state.get("graphics", []),
            "audioTracks": parsed_editor_state.get("audioTracks", [])
        }
    }

    from core.preset_manager import preset_manager
    saved = preset_manager.save_user_template(template_payload)

    return jsonify({
        "success": True,
        "template": saved
    }), 201


# =========================================================================
# AUTOSAVE & RECOVERY
# =========================================================================

@projects_bp.route('/api/projects/autosave', methods=['POST'])
def save_project_autosave():
    """Save an emergency debounced autosave snapshot."""
    data = request.get_json(silent=True) or {}
    project_id = data.get("project_id") or data.get("projectId")
    editor_state = data.get("editor_state") or data.get("editorState") or {}

    if not project_id:
        return jsonify({"success": False, "error": "project_id required"}), 400

    saved_path = project_manager.save_autosave_snapshot(project_id, editor_state)
    return jsonify({"success": bool(saved_path), "path": saved_path})


@projects_bp.route('/api/projects/<int:proj_id>/recovery', methods=['GET'])
def get_project_recovery(proj_id):
    """Check for and retrieve latest autosaved recovery snapshot."""
    snapshot = project_manager.get_recovery_snapshot(proj_id)
    if snapshot:
        return jsonify({"success": True, "hasRecovery": True, "recoveryState": snapshot})
    return jsonify({"success": True, "hasRecovery": False})


# =========================================================================
# RECENT PROJECTS
# =========================================================================

@projects_bp.route('/api/projects/recent', methods=['GET'])
def get_recent_projects_list():
    """Retrieve list of recent projects with availability flags."""
    recents = project_manager.get_recent_projects()
    return jsonify({"success": True, "recentProjects": recents})


@projects_bp.route('/api/projects/recent/remove', methods=['POST'])
def remove_recent_project():
    """Remove project from recent list without deleting actual project."""
    data = request.get_json(silent=True) or {}
    project_id = data.get("project_id") or data.get("id")
    if not project_id:
        return jsonify({"success": False, "error": "project_id required"}), 400

    res = project_manager.remove_recent_project(int(project_id))
    return jsonify({"success": res})


# =========================================================================
# APPLICATION SETTINGS & PREFERENCES
# =========================================================================

@projects_bp.route('/api/settings', methods=['GET', 'POST'])
def handle_app_settings():
    """Get or update global application settings."""
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        updated = settings_manager.update_settings(data)
        return jsonify({"success": True, "settings": updated})
    else:
        return jsonify({"success": True, "settings": settings_manager.get_settings()})


@projects_bp.route('/api/settings/reset', methods=['POST'])
def reset_app_settings():
    """Reset application settings to system defaults."""
    res = settings_manager.reset_defaults()
    return jsonify({"success": True, "settings": res})


# =========================================================================
# BACKGROUND TASKS & PROGRESS
# =========================================================================

@projects_bp.route('/api/tasks', methods=['GET'])
def list_active_tasks():
    """Return active background tasks and progress."""
    tasks = task_manager.list_active_tasks()
    return jsonify({"success": True, "tasks": tasks, "count": len(tasks)})


@projects_bp.route('/api/tasks/<task_id>', methods=['GET'])
def get_task_status(task_id):
    """Get specific background task status and logs."""
    task = task_manager.get_task(task_id)
    if task:
        return jsonify({"success": True, "task": task.to_dict()})
    return jsonify({"success": False, "error": "Task not found"}), 404


@projects_bp.route('/api/tasks/<task_id>/cancel', methods=['POST'])
def cancel_task_request(task_id):
    """Cancel a running background task."""
    cancelled = task_manager.cancel_task(task_id)
    if cancelled:
        return jsonify({"success": True, "taskId": task_id, "status": "cancelled"})
    return jsonify({"success": False, "error": "Task not found or already finished"}), 404
