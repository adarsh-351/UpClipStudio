"""Home route - serves the marketing home and dashboard pages."""

import config
from flask import Blueprint, render_template, request
from models.project import Project
from core.project_state import project_state

home_bp = Blueprint("home", __name__)


@home_bp.route("/")
def index():
    """Professional marketing home page."""
    return render_template("home.html")


@home_bp.route("/studio")
def studio_hub():
    """Unified studio hub - navigation center for all modules."""
    return render_template("studio_hub.html")


@home_bp.route("/yt-downloader")
def youtube_downloader():
    """Dedicated YouTube downloader page."""
    return render_template("yt_downloader.html")


@home_bp.route("/dashboard")
def dashboard():
    """Main dashboard/workspace page."""
    project_id_raw = request.args.get("project_id")
    file_param = request.args.get("file")
    
    selected_project = None
    presets = []
    
    # Format presets from config
    for k, v in getattr(config, "CAPTION_PRESETS", {}).items():
        presets.append({
            "key": k,
            "name": v.get("name", k),
            "category": "Premium"
        })
        
    if project_id_raw:
        try:
            db_proj = Project.query.get(int(project_id_raw))
            if db_proj:
                selected_project = db_proj.to_dict()
                # Sync in-memory project state
                in_mem_id = f"proj_{db_proj.id}"
                in_mem_proj = project_state.get_project(in_mem_id)
                if not in_mem_proj:
                    in_mem_proj = project_state.create_project(
                        db_proj.source_path or "", 
                        f"/download/input/{db_proj.source_path}" if db_proj.source_path else ""
                    )
                    # Force ID match
                    in_mem_proj.project_id = in_mem_id
                    project_state._projects[in_mem_id] = in_mem_proj
                project_state.set_active_project(in_mem_id)
        except Exception as e:
            print("Error syncing project state:", e)
            
    return render_template(
        "index.html",
        caption_presets=presets,
        project=selected_project,
        file_param=file_param
    )



@home_bp.route("/guide")
def guide():
    """Professional user guide for AI Spark Studio."""
    return render_template("guide.html")


@home_bp.route("/youtube-desk")
def youtube_desk():
    """YouTube Automation Desk page."""
    return render_template("youtube_desk.html")
