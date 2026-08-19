# routes/editor.py
"""Video Editor, Graphics Studio & Audio Studio workspace routes and API endpoints for UpClip Studio."""

import config
import time
import subprocess
from pathlib import Path
from flask import Blueprint, request, jsonify, render_template
import json
from models.project import Project
from app import db
from core.project_state import project_state
from core.project_manager import project_manager

editor_bp = Blueprint("editor", __name__, url_prefix="/editor")


@editor_bp.route("")
@editor_bp.route("/")
def editor_view():
    """Render the main editor page."""
    project_id_raw = request.args.get("project_id") or request.args.get("projectId")
    file_param = request.args.get("file")
    selected_project = None
    
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
                    in_mem_proj.project_id = in_mem_id
                    project_state._projects[in_mem_id] = in_mem_proj
                project_state.set_active_project(in_mem_id)

                # Record in recent projects
                project_manager.record_recent_project(
                    project_id=db_proj.id,
                    name=db_proj.name,
                    source_path=db_proj.source_path or "",
                    thumbnail_path=db_proj.thumbnail_path or ""
                )
        except Exception as e:
            print("Error syncing project state in editor:", e)
            
    return render_template(
        "editor.html",
        project=selected_project,
        file_param=file_param
    )


@editor_bp.route("/api/projects/<int:proj_id>/editor-state", methods=["POST"])
def save_editor_state(proj_id):
    """Save the JSON representation of the editor state (clips, graphics, audio, transforms)."""
    proj = Project.query.get_or_404(proj_id)
    data = request.get_json(silent=True) or {}
    raw_state = data.get("editor_state")

    if isinstance(raw_state, dict):
        migrated = project_manager.validate_and_migrate(raw_state)
        proj.editor_state = json.dumps(migrated)
    elif isinstance(raw_state, str):
        try:
            parsed = json.loads(raw_state)
            migrated = project_manager.validate_and_migrate(parsed)
            proj.editor_state = json.dumps(migrated)
        except Exception:
            proj.editor_state = raw_state
    else:
        proj.editor_state = raw_state

    db.session.commit()

    project_manager.record_recent_project(
        project_id=proj.id,
        name=proj.name,
        source_path=proj.source_path or "",
        thumbnail_path=proj.thumbnail_path or ""
    )

    return jsonify({"success": True, "project": proj.to_dict()})


@editor_bp.route("/api/projects/<int:proj_id>/export-timeline", methods=["POST"])
def export_timeline(proj_id):
    """Export the timeline with video cuts, graphics burning, and multi-track audio mixdown."""
    proj = Project.query.get_or_404(proj_id)
    data = request.get_json(silent=True) or {}
    timeline_clips = data.get("clips", [])
    graphics_layers = data.get("graphics", [])
    audio_tracks = data.get("audioTracks", [])
    audio_clips = data.get("audioClips", [])
    video_audio_vol = float(data.get("videoAudioVolume", 100))
    video_audio_muted = bool(data.get("videoAudioMuted", False))
    canvas_w = data.get("canvasWidth", 360)
    canvas_h = data.get("canvasHeight", 640)
    
    if not timeline_clips:
        return jsonify({"success": False, "error": "Timeline is empty"}), 400
        
    # Create temp directory for segments
    temp_dir = config.OUTPUT_DIR / "temp"
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    temp_files = []
    try:
        # 1. Slice and concatenate base video clips
        for idx, clip in enumerate(timeline_clips):
            filename = clip.get("filename", "")
            start = float(clip.get("start", 0))
            end = float(clip.get("end", 0))
            duration = end - start
            
            if duration <= 0:
                continue
                
            # Resolve input file path
            input_path = config.CLIPS_DIR / filename
            if not input_path.exists():
                input_path = config.INPUT_DIR / filename
            if not input_path.exists():
                return jsonify({"success": False, "error": f"Media file {filename} not found"}), 400
            
            temp_filename = f"seg_{proj_id}_{idx}_{int(time.time() * 1000)}.mp4"
            temp_path = temp_dir / temp_filename
            
            cmd = [
                config.FFMPEG_PATH,
                "-y",
                "-ss", str(start),
                "-i", str(input_path),
                "-t", str(duration),
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-crf", "23",
                "-c:a", "aac",
                "-ar", "44100",
                str(temp_path)
            ]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            temp_files.append(temp_path)
            
        if not temp_files:
            return jsonify({"success": False, "error": "No valid segments could be processed"}), 400
            
        concat_path = temp_dir / f"concat_{proj_id}_{int(time.time())}.txt"
        with open(concat_path, "w", encoding="utf-8") as f:
            for tf in temp_files:
                escaped_path = str(tf.resolve()).replace("\\", "/")
                f.write(f"file '{escaped_path}'\n")
                
        base_video_path = temp_dir / f"base_concat_{proj_id}_{int(time.time())}.mp4"
        
        concat_cmd = [
            config.FFMPEG_PATH,
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(concat_path),
            "-c", "copy",
            str(base_video_path)
        ]
        subprocess.run(concat_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        
        # Clean up temporary manifest and slices
        try:
            concat_path.unlink()
            for tf in temp_files:
                tf.unlink()
        except Exception:
            pass

        current_video_stage = base_video_path

        # 2. Composite Graphics Layers if present
        if graphics_layers and len(graphics_layers) > 0:
            from ai.graphics_renderer import GraphicsRenderer
            graphics_stage_path = temp_dir / f"graphics_stage_{proj_id}_{int(time.time())}.mp4"
            renderer = GraphicsRenderer()
            renderer.composite_graphics(
                input_video=current_video_stage,
                graphics_layers=graphics_layers,
                output_video=graphics_stage_path,
                canvas_width=canvas_w,
                canvas_height=canvas_h
            )
            try:
                current_video_stage.unlink()
            except Exception:
                pass
            current_video_stage = graphics_stage_path

        # 2b. Burn Captions if provided
        captions_data = data.get("captions", [])
        caption_style = data.get("captionStyle", {})
        if captions_data and len(captions_data) > 0:
            from ai.animated_caption_renderer import AnimatedCaptionRenderer
            captions_stage_path = temp_dir / f"captions_stage_{proj_id}_{int(time.time())}.mp4"
            cap_renderer = AnimatedCaptionRenderer()
            cap_result = cap_renderer.render(
                input_video=current_video_stage,
                transcript=captions_data,
                output_video=captions_stage_path,
                opts=caption_style,
            )
            if cap_result and captions_stage_path.exists():
                try:
                    current_video_stage.unlink()
                except Exception:
                    pass
                current_video_stage = captions_stage_path

        # 3. Composite Multi-Track Audio Mix
        final_filename = f"project_{proj_id}_export_{int(time.time())}.mp4"
        final_path = config.FINAL_DIR / final_filename
        config.FINAL_DIR.mkdir(parents=True, exist_ok=True)

        from ai.audio_mixer import AudioMixer
        mixer = AudioMixer()
        mixer.mix_and_export(
            input_video=current_video_stage,
            audio_tracks=audio_tracks,
            audio_clips=audio_clips,
            output_video=final_path,
            video_audio_volume=video_audio_vol,
            video_audio_muted=video_audio_muted
        )

        # Remove temp stage video
        try:
            current_video_stage.unlink()
        except Exception:
            pass

        # Add to the in-memory project history exports list
        in_mem_id = f"proj_{proj_id}"
        project_state.add_final_export(in_mem_id, final_filename, f"/download/final/{final_filename}", "Editor Export")
        
        # Update database project record status
        proj.status = "completed"
        db.session.commit()
        
        return jsonify({
            "success": True,
            "filename": final_filename,
            "url": f"/download/final/{final_filename}"
        })
        
    except Exception as e:
        # Clean up temp files on error
        for tf in temp_files:
            try:
                if tf.exists():
                    tf.unlink()
            except Exception:
                pass
        return jsonify({"success": False, "error": str(e)}), 500


@editor_bp.route("/api/editor/upload-asset", methods=["POST"])
def upload_graphic_asset():
    """Upload custom SVG, PNG, JPG, or WEBP asset for use in graphics layers."""
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file provided"}), 400
    file = request.files["file"]
    if not file or not file.filename:
        return jsonify({"success": False, "error": "Empty filename"}), 400

    filename_str = file.filename
    ext = Path(filename_str).suffix.lower()
    if ext not in (".svg", ".png", ".jpg", ".jpeg", ".webp"):
        return jsonify({"success": False, "error": "Unsupported format. Please upload SVG, PNG, JPG, or WEBP."}), 400

    assets_dir = config.INPUT_DIR / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)
    save_path = assets_dir / filename_str
    file.save(str(save_path))

    return jsonify({
        "success": True,
        "filename": filename_str,
        "url": f"/download/input/assets/{filename_str}",
        "type": "svg" if ext == ".svg" else "image"
    })


@editor_bp.route("/api/editor/upload-audio", methods=["POST"])
def upload_audio_asset():
    """Upload custom MP3, WAV, AAC, M4A, or OGG audio file."""
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file provided"}), 400
    file = request.files["file"]
    if not file or not file.filename:
        return jsonify({"success": False, "error": "Empty filename"}), 400

    filename_str = file.filename
    ext = Path(filename_str).suffix.lower()
    if ext not in (".mp3", ".wav", ".aac", ".m4a", ".ogg", ".flac"):
        return jsonify({"success": False, "error": "Unsupported audio format. Supported: MP3, WAV, AAC, M4A, OGG."}), 400

    audio_dir = config.INPUT_DIR / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    save_path = audio_dir / filename_str
    file.save(str(save_path))

    return jsonify({
        "success": True,
        "filename": filename_str,
        "url": f"/download/input/audio/{filename_str}",
        "type": "audio"
    })


@editor_bp.route("/api/editor/audio-library")
def get_audio_library():
    """Return categorized audio library assets (Music, SFX, Voice, Imported)."""
    from utils.audio_generator import generate_starter_audio_assets
    default_assets = generate_starter_audio_assets("static/audio")

    # Check for user uploaded audio
    user_audio_dir = config.INPUT_DIR / "audio"
    user_assets = []
    if user_audio_dir.exists():
        for p in user_audio_dir.iterdir():
            if p.suffix.lower() in (".mp3", ".wav", ".aac", ".m4a", ".ogg"):
                user_assets.append({
                    "filename": p.name,
                    "category": "imported",
                    "title": p.stem.replace("_", " ").title(),
                    "url": f"/download/input/audio/{p.name}"
                })

    return jsonify({
        "success": True,
        "assets": default_assets + user_assets
    })


# ============================================================
# AI INTELLIGENT EDITING & AUTOMATION ENDPOINTS
# ============================================================

_ai_analysis_cache = {}

@editor_bp.route("/api/editor/ai/analyze", methods=["POST"])
def analyze_video_project():
    """Run comprehensive AI analysis (scenes, silence, highlights, reframing, suggestions) with caching."""
    data = request.get_json(silent=True) or {}
    project_id = data.get("projectId")
    filename = data.get("filename")
    project_data = data.get("projectData", {})

    if not filename and project_id:
        proj = Project.query.get(project_id)
        if proj and proj.source_path:
            filename = proj.source_path

    if not filename:
        return jsonify({"success": False, "error": "No media filename provided"}), 400

    video_path = config.INPUT_DIR / filename
    if not video_path.exists():
        # Check clips dir
        video_path = config.CLIPS_DIR / filename
    if not video_path.exists():
        return jsonify({"success": False, "error": f"Media file not found: {filename}"}), 404

    # Check cache
    cache_key = f"{filename}_{video_path.stat().st_mtime}"
    if cache_key in _ai_analysis_cache and not data.get("forceRefresh"):
        return jsonify({
            "success": True,
            "cached": True,
            **_ai_analysis_cache[cache_key]
        })

    # Run AI engines
    from ai.scene_detector import SceneDetector
    from ai.silence_detector import SilenceDetector
    from ai.highlight_engine import HighlightEngine
    from ai.smart_reframe import SmartReframer
    from ai.ai_advisor import AIAdvisor

    scene_detector = SceneDetector()
    scenes = scene_detector.detect_scenes(video_path)

    silence_detector = SilenceDetector()
    silence_res = silence_detector.detect_silence(video_path)

    highlight_engine = HighlightEngine()
    highlights = highlight_engine.detect_highlights(video_path, scenes=scenes)

    smart_reframer = SmartReframer()
    reframe_res = smart_reframer.compute_reframe(video_path, mode="smart", target_aspect="9:16")

    advisor = AIAdvisor()
    suggestions = advisor.analyze_project(project_data, silences=silence_res.get("silences"), highlights=highlights)

    result = {
        "scenes": scenes,
        "silences": silence_res.get("silences", []),
        "keep_segments": silence_res.get("keep_segments", []),
        "total_silence": silence_res.get("total_silence", 0),
        "highlights": highlights,
        "reframe": reframe_res,
        "suggestions": suggestions
    }

    _ai_analysis_cache[cache_key] = result

    return jsonify({
        "success": True,
        "cached": False,
        **result
    })


@editor_bp.route("/api/editor/ai/detect-silence", methods=["POST"])
def detect_silence_endpoint():
    """Detect dead air and pauses with customizable noise threshold and duration."""
    data = request.get_json(silent=True) or {}
    filename = data.get("filename")
    noise_db = data.get("noiseDb", -30)
    min_duration = data.get("minDuration", 0.5)

    if not filename:
        return jsonify({"success": False, "error": "No filename provided"}), 400

    video_path = config.INPUT_DIR / filename
    if not video_path.exists():
        video_path = config.CLIPS_DIR / filename
    if not video_path.exists():
        return jsonify({"success": False, "error": "Media file not found"}), 404

    from ai.silence_detector import SilenceDetector
    detector = SilenceDetector()
    res = detector.detect_silence(video_path, noise_db=noise_db, min_duration=min_duration)

    return jsonify({
        "success": True,
        **res
    })


@editor_bp.route("/api/editor/ai/smart-reframe", methods=["POST"])
def smart_reframe_endpoint():
    """Compute optimal 9:16 vertical subject framing coordinates."""
    data = request.get_json(silent=True) or {}
    filename = data.get("filename")
    mode = data.get("mode", "smart")
    target_aspect = data.get("targetAspect", "9:16")

    if not filename:
        return jsonify({"success": False, "error": "No filename provided"}), 400

    video_path = config.INPUT_DIR / filename
    if not video_path.exists():
        video_path = config.CLIPS_DIR / filename
    if not video_path.exists():
        return jsonify({"success": False, "error": "Media file not found"}), 404

    from ai.smart_reframe import SmartReframer
    reframer = SmartReframer()
    res = reframer.compute_reframe(video_path, mode=mode, target_aspect=target_aspect)

    return jsonify({
        "success": True,
        **res
    })


# ============================================================
# TEMPLATES, PRESETS & BRAND KIT ENDPOINTS
# ============================================================

@editor_bp.route("/api/editor/templates", methods=["GET"])
def get_templates_list():
    """Return all system and user templates."""
    category = request.args.get("category")
    from core.preset_manager import preset_manager
    templates = preset_manager.get_templates(category=category)
    return jsonify({
        "success": True,
        "templates": templates
    })


@editor_bp.route("/api/editor/templates/<template_id>/create-project", methods=["POST"])
def create_project_from_template(template_id):
    """Instantiate a new project initialized with template configuration."""
    from core.preset_manager import preset_manager
    template = preset_manager.get_template_by_id(template_id)
    if not template:
        return jsonify({"success": False, "error": "Template not found"}), 404

    data = request.get_json(silent=True) or {}
    project_name = data.get("projectName") or f"New {template.get('name', 'Video')}"
    source_path = data.get("sourcePath")

    import json
    new_editor_state = json.dumps({
        "clips": [],
        "graphics": template.get("data", {}).get("graphics", []),
        "audioTracks": template.get("data", {}).get("audioTracks", []),
        "audioClips": [],
        "captionStyle": template.get("data", {}).get("captionStyle", {}),
        "aspectRatio": template.get("data", {}).get("aspectRatio", "9:16")
    })

    new_proj = Project(
        name=project_name,
        source_path=source_path,
        status="ready",
        editor_state=new_editor_state
    )
    db.session.add(new_proj)
    db.session.commit()

    return jsonify({
        "success": True,
        "project": new_proj.to_dict()
    }), 201


@editor_bp.route("/api/editor/presets", methods=["GET"])
def get_all_presets():
    """Return all categorized presets (captions, graphics, audio, export, brand kit)."""
    from core.preset_manager import preset_manager
    presets = preset_manager.get_presets()
    return jsonify({
        "success": True,
        "presets": presets
    })


@editor_bp.route("/api/editor/presets/save", methods=["POST"])
def save_custom_preset():
    """Save a custom user preset."""
    data = request.get_json(silent=True) or {}
    preset_type = data.get("presetType")
    preset_data = data.get("presetData")

    if not preset_type or not preset_data:
        return jsonify({"success": False, "error": "presetType and presetData required"}), 400

    from core.preset_manager import preset_manager
    saved = preset_manager.save_custom_preset(preset_type, preset_data)

    return jsonify({
        "success": True,
        "preset": saved
    })


@editor_bp.route("/api/editor/brand-kit", methods=["GET", "POST"])
def handle_brand_kit():
    """Get or update global Brand Kit settings."""
    from core.preset_manager import preset_manager
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        saved = preset_manager.save_brand_kit(data)
        return jsonify({"success": True, "brandKit": saved})
    else:
        kit = preset_manager.get_brand_kit()
        return jsonify({"success": True, "brandKit": kit})


# ============================================================
# PHASE 10: RENDER QUEUE, PRODUCTION & MEDIA MANAGEMENT
# ============================================================

@editor_bp.route("/api/editor/ready-check", methods=["POST"])
def pre_export_ready_check():
    """Run pre-export asset and technical integrity verification."""
    data = request.get_json(silent=True) or {}
    from core.media_manager import media_manager
    report = media_manager.validate_project(data)
    return jsonify({
        "success": True,
        **report
    })


@editor_bp.route("/api/editor/render-queue/add", methods=["POST"])
def add_to_render_queue():
    """Enqueue a project export job in the background render worker."""
    data = request.get_json(silent=True) or {}
    proj_id = data.get("projectId")
    proj_name = data.get("projectName")
    timeline_data = data.get("timelineData", {})
    export_settings = data.get("exportSettings", {})

    if not proj_id:
        return jsonify({"success": False, "error": "Project ID required"}), 400

    # Auto-create backup before rendering
    from core.media_manager import media_manager
    media_manager.create_project_backup(proj_id, {
        "id": proj_id,
        "name": proj_name,
        "timeline": timeline_data
    })

    from core.render_queue import render_queue_manager
    job = render_queue_manager.add_job(
        project_id=proj_id,
        project_name=proj_name,
        timeline_data=timeline_data,
        export_settings=export_settings
    )

    return jsonify({
        "success": True,
        "job": job
    }), 201


@editor_bp.route("/api/editor/render-queue/status", methods=["GET"])
def get_render_queue_status():
    """Get active render worker status and full job queue."""
    from core.render_queue import render_queue_manager
    status = render_queue_manager.get_status()
    return jsonify({
        "success": True,
        **status
    })


@editor_bp.route("/api/editor/render-queue/cancel/<job_id>", methods=["POST"])
def cancel_render_job(job_id):
    """Cancel an active or queued render job."""
    from core.render_queue import render_queue_manager
    success = render_queue_manager.cancel_job(job_id)
    return jsonify({ "success": success })


@editor_bp.route("/api/editor/render-queue/retry/<job_id>", methods=["POST"])
def retry_render_job(job_id):
    """Retry a failed or cancelled render job."""
    from core.render_queue import render_queue_manager
    job = render_queue_manager.retry_job(job_id)
    if job:
        return jsonify({ "success": True, "job": job })
    return jsonify({ "success": False, "error": "Job not found" }), 404


@editor_bp.route("/api/editor/render-queue/job/<job_id>", methods=["DELETE"])
def remove_render_job(job_id):
    """Remove a job from queue or history."""
    from core.render_queue import render_queue_manager
    success = render_queue_manager.remove_job(job_id)
    return jsonify({ "success": success })


@editor_bp.route("/api/editor/render-queue/clear-history", methods=["POST"])
def clear_render_history():
    """Clear completed jobs from render history."""
    from core.render_queue import render_queue_manager
    render_queue_manager.clear_completed()
    return jsonify({ "success": True })


@editor_bp.route("/api/editor/media/relink", methods=["POST"])
def relink_media_asset():
    """Relink a missing media file."""
    data = request.get_json(silent=True) or {}
    old_filename = data.get("oldFilename")
    new_path = data.get("newPath")

    if not old_filename or not new_path:
        return jsonify({"success": False, "error": "oldFilename and newPath required"}), 400

    from core.media_manager import media_manager
    ok, msg = media_manager.relink_asset(old_filename, new_path)
    return jsonify({ "success": ok, "message": msg })


@editor_bp.route("/api/editor/project/package", methods=["POST"])
def package_project_endpoint():
    """Package project state and source media into a portable zip bundle."""
    data = request.get_json(silent=True) or {}
    proj_id = data.get("projectId")
    if not proj_id:
        return jsonify({"success": False, "error": "projectId required"}), 400

    proj = Project.query.get_or_404(proj_id)
    from core.media_manager import media_manager
    res = media_manager.package_project(proj_id, proj.to_dict())
    return jsonify(res)


@editor_bp.route("/api/editor/cache", methods=["GET", "POST"])
def handle_cache():
    """Get cache stats or clear temporary render cache."""
    from core.media_manager import media_manager
    if request.method == "POST":
        res = media_manager.clear_temp_cache()
        return jsonify(res)
    else:
        stats = media_manager.get_cache_stats()
        return jsonify({ "success": True, "cache": stats })


# ============================================================
# PHASE 11: WORKSPACES, VERSIONS, REVIEWS & DIAGNOSTICS
# ============================================================

@editor_bp.route("/api/editor/workspaces", methods=["GET"])
def get_workspaces_endpoint():
    """Return all available workspace profiles."""
    from core.workspace_manager import workspace_manager
    return jsonify({ "success": True, "workspaces": workspace_manager.get_workspaces() })


@editor_bp.route("/api/editor/projects/<int:proj_id>/versions", methods=["GET"])
def get_project_versions(proj_id):
    """Get all saved versions for a project."""
    from core.workspace_manager import workspace_manager
    versions = workspace_manager.get_versions(proj_id)
    return jsonify({ "success": True, "versions": versions })


@editor_bp.route("/api/editor/projects/<int:proj_id>/versions/save", methods=["POST"])
def save_project_version(proj_id):
    """Create a new named version snapshot."""
    data = request.get_json(silent=True) or {}
    name = data.get("name")
    note = data.get("note", "")
    editor_state = data.get("editorState", {})

    from core.workspace_manager import workspace_manager
    ver = workspace_manager.save_version(proj_id, name, note, editor_state)
    return jsonify({ "success": True, "version": ver })


@editor_bp.route("/api/editor/projects/<int:proj_id>/versions/restore", methods=["POST"])
def restore_project_version(proj_id):
    """Restore project state to a specified version."""
    data = request.get_json(silent=True) or {}
    version_id = data.get("versionId")
    if not version_id:
        return jsonify({ "success": False, "error": "versionId required" }), 400

    from core.workspace_manager import workspace_manager
    ver = workspace_manager.restore_version(proj_id, version_id)
    if ver:
        return jsonify({ "success": True, "version": ver })
    return jsonify({ "success": False, "error": "Version not found" }), 404


@editor_bp.route("/api/editor/projects/<int:proj_id>/review", methods=["GET"])
def get_project_review(proj_id):
    """Get review comments and status for project."""
    from core.workspace_manager import workspace_manager
    data = workspace_manager.get_review_data(proj_id)
    return jsonify({ "success": True, "review": data })


@editor_bp.route("/api/editor/projects/<int:proj_id>/review/comment", methods=["POST"])
def add_review_comment(proj_id):
    """Add a review comment tied to timestamp."""
    data = request.get_json(silent=True) or {}
    timestamp = data.get("timestamp", 0.0)
    author = data.get("author", "Editor")
    text = data.get("text", "")

    if not text:
        return jsonify({ "success": False, "error": "Comment text required" }), 400

    from core.workspace_manager import workspace_manager
    comment = workspace_manager.add_comment(proj_id, timestamp, author, text)
    return jsonify({ "success": True, "comment": comment })


@editor_bp.route("/api/editor/projects/<int:proj_id>/review/comment/<comment_id>/toggle", methods=["POST"])
def toggle_comment_resolved(proj_id, comment_id):
    """Toggle resolved state for a comment."""
    from core.workspace_manager import workspace_manager
    data = workspace_manager.toggle_resolve_comment(proj_id, comment_id)
    return jsonify({ "success": True, "review": data })


@editor_bp.route("/api/editor/projects/<int:proj_id>/review/status", methods=["POST"])
def update_project_review_status(proj_id):
    """Update project approval status."""
    data = request.get_json(silent=True) or {}
    status = data.get("status", "In Review")

    from core.workspace_manager import workspace_manager
    data = workspace_manager.update_review_status(proj_id, status)
    return jsonify({ "success": True, "review": data })


@editor_bp.route("/api/editor/diagnostics", methods=["GET"])
def get_system_diagnostics():
    """Return system information, FFmpeg status, and storage."""
    from core.workspace_manager import workspace_manager
    diag = workspace_manager.get_diagnostics()
    return jsonify({ "success": True, "diagnostics": diag })


# ============================================================
# Media library API (used by MediaManager)
# ============================================================

@editor_bp.route("/api/media/list", methods=["GET"])
def media_list():
    """Return JSON list of media files in MEDIA_ROOT directory."""
    import os
    from pathlib import Path
    media_root = config.MEDIA_ROOT
    media_root_path = Path(media_root)
    media_items = []
    if media_root_path.exists():
        for idx, p in enumerate(media_root_path.iterdir()):
            if p.is_file():
                ext = p.suffix.lower()
                if ext in (".mp4", ".mov", ".avi", ".mkv"):
                    mtype = "video"
                elif ext in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
                    mtype = "image"
                elif ext in (".mp3", ".wav", ".aac", ".m4a", ".flac", ".ogg"):
                    mtype = "audio"
                else:
                    continue
                media_items.append({
                    "id": idx,
                    "filename": p.name,
                    "type": mtype,
                    "path": p.name,  # relative path from MEDIA_ROOT
                })
    return jsonify({"success": True, "media": media_items})


@editor_bp.route("/api/editor/upload-media", methods=["POST"])
def upload_media():
    """Upload a media file into MEDIA_ROOT (used by MediaManager)."""
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file provided"}), 400
    file = request.files["file"]
    if not file or not file.filename:
        return jsonify({"success": False, "error": "Empty filename"}), 400
    filename_str = file.filename
    ext = Path(filename_str).suffix.lower()
    if ext not in (".mp4", ".mov", ".avi", ".mkv", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp3", ".wav", ".aac", ".m4a", ".flac", ".ogg"):
        return jsonify({"success": False, "error": "Unsupported media format"}), 400
    dest_dir = config.MEDIA_ROOT
    dest_dir.mkdir(parents=True, exist_ok=True)
    save_path = dest_dir / filename_str
    file.save(str(save_path))
    return jsonify({"success": True, "filename": filename_str, "url": f"/download/input/{filename_str}"})


@editor_bp.route("/api/editor/media/<int:media_id>", methods=["DELETE"])
def delete_media(media_id):
    """Delete a media file by its id (as returned by /api/media/list)."""
    media_root = config.MEDIA_ROOT
    for idx, p in enumerate(Path(media_root).iterdir()):
        if idx == media_id and p.is_file():
            try:
                p.unlink()
                return jsonify({"success": True})
            except Exception as e:
                return jsonify({"success": False, "error": str(e)}), 500
    return jsonify({"success": False, "error": "Media not found"}), 404


@editor_bp.route("/api/editor/copilot/query", methods=["POST"])
def copilot_query_endpoint():
    """Process natural language prompt with editor context and return structured action preview."""
    data = request.get_json(silent=True) or {}
    prompt = data.get("prompt", "")
    context = data.get("context", {})

    if not prompt:
        return jsonify({ "success": False, "error": "Prompt required" }), 400

    from core.ai_copilot import ai_copilot_engine
    result = ai_copilot_engine.process_query(prompt, context)
    return jsonify(result)


@editor_bp.route("/api/editor/copilot/record", methods=["POST"])
def copilot_record_endpoint():
    """Record an applied AI action into history."""
    data = request.get_json(silent=True) or {}
    from core.ai_copilot import ai_copilot_engine
    entry = ai_copilot_engine.record_action(data)
    return jsonify({ "success": True, "entry": entry })


@editor_bp.route("/api/editor/copilot/settings", methods=["GET", "POST"])
def copilot_settings_endpoint():
    """Get or update AI Copilot settings."""
    from core.ai_copilot import ai_copilot_engine
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        saved = ai_copilot_engine.save_settings(data)
        return jsonify({ "success": True, "settings": saved })
    else:
        return jsonify({ "success": True, "settings": ai_copilot_engine.settings })


@editor_bp.route("/api/editor/copilot/history", methods=["GET"])
def copilot_history_endpoint():
    """Get recent AI actions history."""
    from core.ai_copilot import ai_copilot_engine
    return jsonify({ "success": True, "history": ai_copilot_engine.history })


# ============================================================
# PHASE 13: CONTENT INTELLIGENCE & SMART SHORTS FACTORY
# ============================================================

@editor_bp.route("/api/editor/projects/<int:proj_id>/intelligence/analyze", methods=["POST"])
def analyze_content_intelligence(proj_id):
    """Run or fetch Content Intelligence analysis on project."""
    data = request.get_json(silent=True) or {}
    source_path = data.get("sourcePath", "")
    transcript = data.get("transcript")
    force_refresh = bool(data.get("forceRefresh", False))

    if not source_path:
        from core.project_manager import project_manager
        proj = project_manager.get_project(proj_id)
        if proj:
            source_path = proj.source_path

    from core.content_intelligence import content_intelligence_engine
    result = content_intelligence_engine.analyze_project(
        project_id=proj_id,
        source_path=source_path,
        transcript=transcript,
        force_refresh=force_refresh
    )
    return jsonify(result)


@editor_bp.route("/api/editor/projects/<int:proj_id>/intelligence", methods=["GET"])
def get_content_intelligence(proj_id):
    """Get cached content intelligence data."""
    from core.content_intelligence import content_intelligence_engine
    intel = content_intelligence_engine.get_intelligence(proj_id)
    if intel:
        return jsonify({ "success": True, "intelligence": intel })
    return jsonify({ "success": False, "error": "Not analyzed yet" }), 404


@editor_bp.route("/api/editor/projects/<int:proj_id>/intelligence/topics", methods=["POST"])
def update_project_topics(proj_id):
    """Update topic segments list."""
    data = request.get_json(silent=True) or {}
    topics = data.get("topics", [])
    from core.content_intelligence import content_intelligence_engine
    intel = content_intelligence_engine.update_topics(proj_id, topics)
    return jsonify({ "success": True, "topics": intel.get("topics", []) })


@editor_bp.route("/api/editor/projects/<int:proj_id>/intelligence/search", methods=["GET"])
def search_project_transcript(proj_id):
    """Search transcript index for keywords."""
    query = request.args.get("q", "")
    from core.content_intelligence import content_intelligence_engine
    matches = content_intelligence_engine.search_transcript(proj_id, query)
    return jsonify({ "success": True, "matches": matches })


@editor_bp.route("/api/editor/projects/<int:proj_id>/shorts/create", methods=["POST"])
def create_shorts_from_candidates(proj_id):
    """Generate editable child short projects from candidates."""
    data = request.get_json(silent=True) or {}
    candidates = data.get("candidates", [])
    single_candidate = data.get("candidate")
    preset_name = data.get("presetName", "9:16 Shorts Default")

    from core.shorts_factory import shorts_factory
    if single_candidate:
        res = shorts_factory.create_short_project(proj_id, single_candidate, preset_name)
        return jsonify(res)
    elif candidates:
        res = shorts_factory.bulk_create_shorts(proj_id, candidates, preset_name)
        return jsonify(res)
    else:
        return jsonify({ "success": False, "error": "No candidates provided" }), 400


@editor_bp.route("/api/editor/projects/<int:proj_id>/shorts/bulk-export", methods=["POST"])
def bulk_export_shorts(proj_id):
    """Enqueue child short projects to Render Queue in bulk."""
    data = request.get_json(silent=True) or {}
    project_ids = data.get("projectIds", [])
    export_preset = data.get("exportPreset", "9:16 Vertical Shorts (1080p)")

    from core.shorts_factory import shorts_factory
    res = shorts_factory.bulk_enqueue_shorts(project_ids, export_preset)
    return jsonify(res)


# ============================================================
# PHASE 14: PROFESSIONAL MOTION GRAPHICS & VISUAL DESIGN SYSTEM
# ============================================================

@editor_bp.route("/api/editor/graphics/catalog", methods=["GET"])
def get_graphics_catalog():
    """Return complete motion graphics catalog and motion presets."""
    from core.graphics_manager import graphics_manager
    return jsonify({ "success": True, "catalog": graphics_manager.get_catalog() })


@editor_bp.route("/api/editor/graphics/templates", methods=["GET", "POST"])
def handle_graphics_templates():
    """Retrieve or save reusable custom graphic templates."""
    from core.graphics_manager import graphics_manager
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        name = data.get("name", "Custom Template")
        category = data.get("category", "custom")
        layer_data = data.get("layerData", {})
        saved = graphics_manager.save_custom_template(name, category, layer_data)
        return jsonify({ "success": True, "template": saved })
    else:
        return jsonify({ "success": True, "templates": graphics_manager.templates })


@editor_bp.route("/api/editor/graphics/align", methods=["POST"])
def align_graphic_layer():
    """Compute aligned X/Y coordinates for graphic layer."""
    data = request.get_json(silent=True) or {}
    layer = data.get("layer", {})
    mode = data.get("mode", "center_x")
    canvas_w = int(data.get("canvasWidth", 360))
    canvas_h = int(data.get("canvasHeight", 640))

    from core.graphics_manager import graphics_manager
    aligned = graphics_manager.align_layer(layer, mode, canvas_w, canvas_h)
    return jsonify({ "success": True, "layer": aligned })


@editor_bp.route("/api/editor/graphics/group", methods=["POST"])
def group_graphic_layers():
    """Combine multiple graphic layers into a single grouped layer."""
    data = request.get_json(silent=True) or {}
    layers = data.get("layers", [])

    from core.graphics_manager import graphics_manager
    grp = graphics_manager.group_layers(layers)
    if grp:
        return jsonify({ "success": True, "groupLayer": grp })
    return jsonify({ "success": False, "error": "Need at least 2 layers to group" }), 400


@editor_bp.route("/api/editor/graphics/ungroup", methods=["POST"])
def ungroup_graphic_layers():
    """Unpack a grouped graphic layer into individual child layers."""
    data = request.get_json(silent=True) or {}
    group_layer = data.get("groupLayer", {})

    from core.graphics_manager import graphics_manager
    unpacked = graphics_manager.ungroup_layer(group_layer)
    return jsonify({ "success": True, "layers": unpacked })


@editor_bp.route("/api/editor/graphics/duplicate", methods=["POST"])
def duplicate_graphic_layer():
    """Duplicate graphic layer with new ID and preserved transforms/keyframes."""
    data = request.get_json(silent=True) or {}
    layer = data.get("layer", {})
    from core.graphics_manager import graphics_manager
    dup = graphics_manager.duplicate_layer(layer)
    return jsonify({ "success": True, "layer": dup })


@editor_bp.route("/api/editor/graphics/keyframes", methods=["POST"])
def save_graphic_keyframes():
    """Save keyframes for a graphic layer."""
    data = request.get_json(silent=True) or {}
    graphic_id = data.get("graphic_id", "")
    keyframes = data.get("keyframes", [])

    if not graphic_id:
        return jsonify({ "success": False, "error": "graphic_id required" }), 400

    from core.graphics_manager import graphics_manager
    template = next((t for t in graphics_manager.templates if t.get("id") == graphic_id), None)
    if template:
        template["keyframes"] = keyframes
        graphics_manager._save_templates()

    return jsonify({ "success": True, "graphic_id": graphic_id, "keyframes": keyframes })


@editor_bp.route("/api/editor/graphics/<graphic_id>/keyframes", methods=["GET"])
def get_graphic_keyframes(graphic_id):
    """Load keyframes for a graphic layer."""
    from core.graphics_manager import graphics_manager
    template = next((t for t in graphics_manager.templates if t.get("id") == graphic_id), None)
    if template:
        return jsonify({ "success": True, "graphic_id": graphic_id, "keyframes": template.get("keyframes", []) })

    return jsonify({ "success": True, "graphic_id": graphic_id, "keyframes": [] })


@editor_bp.route("/api/editor/templates/categories", methods=["GET"])
def get_template_categories():
    """Return all template categories and templates grouped by category."""
    from core.preset_manager import preset_manager
    templates = preset_manager.get_templates()
    categories = sorted(set(t.get("category", "Other") for t in templates))
    templates_by_category = {}
    for cat in categories:
        templates_by_category[cat] = [t for t in templates if t.get("category", "Other") == cat]
    return jsonify({ "success": True, "categories": categories, "templates_by_category": templates_by_category })


@editor_bp.route("/api/editor/fonts", methods=["GET"])
def get_fonts_list():
    """Return categorized font list for the editor."""
    font_categories = {
        "Sans Serif": ["Arial", "Inter", "Roboto", "Manrope", "DM Sans"],
        "Bold": ["Anton", "Bebas Neue", "Arial Black"],
        "Display": ["Montserrat", "Oswald", "Poppins"],
        "Modern": ["Plus Jakarta Sans", "DM Sans"],
        "Condensed": ["Anton", "Bebas Neue"],
        "Clean": ["Inter", "Manrope", "DM Sans"],
        "Social": ["Poppins", "Montserrat", "Bebas Neue"],
        "Professional": ["Arial", "Inter", "Roboto", "Montserrat"],
    }
    return jsonify({ "success": True, "categories": font_categories })


# ============================================================
# PHASE 15: PROFESSIONAL AUDIO STUDIO & AUDIO INTELLIGENCE
# ============================================================

@editor_bp.route("/api/editor/audio/waveform", methods=["GET"])
def get_audio_waveform():
    """Return cached or extracted peaks for audio file."""
    filename = request.args.get("filename", "")
    num_peaks = int(request.args.get("numPeaks", 100))

    if not filename:
        return jsonify({ "success": False, "error": "No filename provided" }), 400

    from core.audio_manager import audio_manager
    peaks = audio_manager.get_waveform_peaks(Path(filename), num_peaks)
    return jsonify({ "success": True, "peaks": peaks })


@editor_bp.route("/api/editor/audio/diagnostics", methods=["POST"])
def get_audio_diagnostics():
    """Audit project audio tracks and clips for warnings/errors."""
    data = request.get_json(silent=True) or {}
    tracks = data.get("audioTracks", [])
    clips = data.get("audioClips", [])

    from core.audio_manager import audio_manager
    res = audio_manager.analyze_audio_health(tracks, clips)
    return jsonify(res)


# ============================================================
# CENTRAL MEDIA LIBRARY & ASSET MANAGEMENT ENDPOINTS
# ============================================================

@editor_bp.route("/api/editor/media/library", methods=["GET"])
def get_project_media_library():
    """Return the central media library catalog across video, audio, and image assets."""
    from core.media_manager import media_manager
    assets = media_manager.get_media_library()
    return jsonify({ "success": True, "assets": assets, "count": len(assets) })


@editor_bp.route("/api/editor/media/thumbnail/<filename>", methods=["GET"])
def get_media_thumbnail(filename):
    """Serve cached media thumbnail."""
    from flask import send_from_directory
    from core.media_manager import THUMBNAILS_DIR
    return send_from_directory(THUMBNAILS_DIR, filename)


@editor_bp.route("/api/editor/media/relink", methods=["POST"])
def relink_media_asset():
    """Relink a missing asset reference to a replacement file path."""
    data = request.get_json(silent=True) or {}
    old_filename = data.get("oldFilename", "")
    new_path_str = data.get("newPath", "")

    if not old_filename or not new_path_str:
        return jsonify({ "success": False, "error": "oldFilename and newPath required" }), 400

    from core.media_manager import media_manager
    success, msg = media_manager.relink_asset(old_filename, new_path_str)
    return jsonify({ "success": success, "message": msg })


@editor_bp.route("/api/editor/media/stats", methods=["GET"])
def get_media_cache_stats():
    """Return media cache and temp storage stats."""
    from core.media_manager import media_manager
    stats = media_manager.get_cache_stats()
    return jsonify({ "success": True, "stats": stats })


@editor_bp.route("/api/editor/media/clear-cache", methods=["POST"])
def clear_media_cache():
    """Clear temporary render cache files."""
    from core.media_manager import media_manager
    res = media_manager.clear_temp_cache()
    return jsonify(res)









