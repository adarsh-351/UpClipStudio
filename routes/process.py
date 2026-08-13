"""Process route - runs the full AI pipeline with live status tracking."""

import threading
from pathlib import Path

import config
from flask import Blueprint, request, jsonify

from utils.ffmpeg_utils import check_ffmpeg
from utils.video_utils import VideoLoader
from utils.scene_detector import SceneDetector
from utils.scene_merger import SceneMerger
from utils.clip_generator import ClipGenerator

from ai.whisper_engine import WhisperEngine
from ai.subtitle_builder import SubtitleBuilder
from ai.subtitle_renderer import SubtitleRenderer
from ai.animated_caption_renderer import AnimatedCaptionRenderer
from ai.translation import translate_transcript

process_bp = Blueprint("process", __name__, url_prefix="/process")

# In-memory job store
JOBS = {}
JOB_COUNTER = 0
JOB_LOCK = threading.Lock()


class PipelineJob:
    """Track the status and progress of a pipeline run."""

    def __init__(self, job_id, filename, settings=None):
        self.job_id = job_id
        self.filename = filename
        self.settings = settings or {}
        self.status = "queued"          # queued | running | done | error
        self.step = ""
        self.steps_completed = 0
        self.total_steps = 9
        self.logs = []
        self.error = None
        self.result = None
        self.finished = False
        self.clips_meta = []
        self.caption_style = None
        self.project_id = None
        self.caption_files = []

    def add_log(self, message):
        self.logs.append(message)

    def set_step(self, index, name, message=""):
        self.step = name
        self.steps_completed = index
        if message:
            self.add_log(message)

    def to_dict(self):
        return {
            "job_id": self.job_id,
            "filename": self.filename,
            "status": self.status,
            "step": self.step,
            "steps_completed": self.steps_completed,
            "total_steps": self.total_steps,
            "logs": self.logs,
            "error": self.error,
            "result": self.result,
            "finished": self.finished,
            "clips_meta": self.clips_meta,
            "caption_style": self.caption_style,
            "project_id": self.project_id,
            "caption_files": self.caption_files,
        }


def _sanitize_subtitle_color(color):
    """Convert a hex color like #FFFFFF or FFFFFF to ASS &H format."""
    color = (color or "").strip().lstrip("#")
    if len(color) != 6:
        return None
    try:
        r, g, b = color[0:2], color[2:4], color[4:6]
        return f"&H{b}{g}{r}&"
    except Exception:
        return None


def _build_style_options(settings):
    """Build a style dict for the subtitle renderer from user settings."""
    sub = settings.get("subtitle", {}) or {}

    style = {}

    # Position -> ASS alignment
    position = sub.get("position", "bottom")
    alignment_map = {
        "bottom": 2,
        "top": 8,
        "middle": 5,
    }
    style["alignment"] = alignment_map.get(position, 2)

    font = sub.get("font")
    if font:
        style["font"] = font

    try:
        size = int(sub.get("size", 22))
        style["font_size"] = size
    except (TypeError, ValueError):
        pass

    color = _sanitize_subtitle_color(sub.get("color"))
    if color:
        style["primary_color"] = color

    try:
        outline = int(sub.get("outline", 2))
        style["outline"] = outline
    except (TypeError, ValueError):
        pass

    try:
        shadow = int(sub.get("shadow", 1))
        style["shadow"] = shadow
    except (TypeError, ValueError):
        pass

    return style or None


def run_pipeline_job(job):
    """Execute the full AI pipeline and update the job status."""

    settings = job.settings
    try:
        job.status = "running"
        job.add_log("Pipeline started.")

        project_id = settings.get("project_id")
        if not project_id:
            from core.project_state import project_state
            video = config.INPUT_DIR / job.filename
            if video.exists():
                from utils.video_utils import VideoLoader
                try:
                    loader = VideoLoader(video)
                    _ = loader.metadata()
                    loader.close()
                except Exception:
                    pass
                proj = project_state.create_project(job.filename, f"/download/input/{job.filename}")
                project_id = proj.project_id
            else:
                project_id = f"proj_{job.job_id}"
        job.project_id = project_id

        # Load settings
        language = settings.get("language", "auto")
        aspect_key = settings.get("aspect", "original")
        clipping_mode = settings.get("clipping_mode", config.CLIPPING_AI)
        clip_duration = settings.get("clip_duration")
        clip_count = settings.get("clip_count")
        naming = settings.get("naming", config.NAME_SEQUENTIAL)
        subtitle_enabled = settings.get("subtitle_enabled", True)
        subtitle_translate = settings.get("subtitle_language", language)
        quality = settings.get("quality", config.DEFAULT_QUALITY)
        caption_enabled = settings.get("caption_enabled", config.CAPTION_ENABLED)

        caption_style_data = settings.get("caption_style")
        if caption_style_data:
            from core.project_state import CaptionStyleConfig
            job.caption_style = CaptionStyleConfig(
                id=caption_style_data.get("id", "custom"),
                name=caption_style_data.get("name", "Custom"),
                font_family=caption_style_data.get("font_family", "Arial Black"),
                font_size=int(caption_style_data.get("font_size", 34)),
                font_weight=int(caption_style_data.get("font_weight", 800)),
                text_color=caption_style_data.get("text_color", "#FFFFFF"),
                active_word_color=caption_style_data.get("active_word_color", "#fbbf24"),
                background_color=caption_style_data.get("background_color", "#000000"),
                background_opacity=float(caption_style_data.get("background_opacity", 0.0)),
                outline_color=caption_style_data.get("outline_color", "#000000"),
                outline_width=int(caption_style_data.get("outline_width", 3)),
                shadow_color=caption_style_data.get("shadow_color", "#000000"),
                shadow_blur=int(caption_style_data.get("shadow_blur", 4)),
                shadow_offset_y=int(caption_style_data.get("shadow_offset_y", 2)),
                position=caption_style_data.get("position", "bottom"),
                animation=caption_style_data.get("animation", "pop"),
                letter_spacing=int(caption_style_data.get("letter_spacing", 0)),
                line_height=float(caption_style_data.get("line_height", 1.2)),
                max_lines=int(caption_style_data.get("max_lines", 2)),
            )
            from core.project_state import project_state
            project_state.set_caption_style(project_id, job.caption_style)

        # Animated caption style options
        caption_opts = {
            "animation": settings.get("caption_animation", config.CAPTION_ANIMATION),
            "position": settings.get("caption_position", config.CAPTION_POSITION),
            "font": settings.get("caption_font", config.CAPTION_FONT),
            "size": settings.get("caption_size", config.CAPTION_FONT_SIZE),
            "color": settings.get("caption_color", config.CAPTION_COLOR),
            "background": settings.get("caption_background", config.CAPTION_BACKGROUND),
            "outline": settings.get("caption_outline", config.CAPTION_OUTLINE),
            "margin_v": settings.get("caption_margin_v", config.CAPTION_MARGIN_V),
            "min_word_ms": settings.get("caption_min_word_ms", config.CAPTION_MIN_WORD_MS),
        }
        if job.caption_style:
            caption_opts["font"] = job.caption_style.font_family
            caption_opts["size"] = job.caption_style.font_size
            caption_opts["color"] = job.caption_style.text_color
            caption_opts["background"] = job.caption_style.background_color
            caption_opts["outline"] = job.caption_style.outline_width
        caption_template = settings.get("caption_template")

        # 1. FFmpeg check
        job.set_step(1, "Checking FFmpeg")
        status, version = check_ffmpeg()
        if not status:
            raise RuntimeError(f"FFmpeg not installed: {version}")
        job.add_log(f"FFmpeg OK - {version}")

        video = config.INPUT_DIR / job.filename
        if not video.exists():
            raise RuntimeError(f"Video not found: {video}")

        # 2. Load video + metadata + thumbnail
        job.set_step(2, "Loading video & metadata")
        loader = VideoLoader(video)
        info = loader.metadata()
        job.add_log(f"Video: {info['width']}x{info['height']}, "
                    f"{info['duration']}s, {info['fps']} fps")

        thumb = config.THUMBNAIL_DIR / f"{Path(job.filename).stem}_thumb.jpg"
        loader.thumbnail(thumb)
        job.add_log(f"Thumbnail saved: {thumb.name}")

        # 3. Frame extraction
        job.set_step(3, "Extracting frames")
        total_frames = loader.extract_frames(config.FRAMES_DIR)
        loader.close()
        job.add_log(f"Frames extracted: {total_frames}")

        # 4. Scene detection
        job.set_step(4, "Detecting scenes")
        detector = SceneDetector(video)
        scenes = detector.detect_scenes(threshold=config.SCENE_THRESHOLD)
        job.add_log(f"Original scenes: {len(scenes)}")

        # 5. Merge scenes
        job.set_step(5, "Merging scenes")
        merger = SceneMerger()
        merged_scenes = merger.merge(scenes)
        job.add_log(f"Merged clips: {len(merged_scenes)}")

        # ---- Clip count validation for COUNT mode ----
        if clipping_mode == config.CLIPPING_COUNT:
            available = len(merged_scenes) if merged_scenes else len(scenes)
            requested = clip_count or 0
            if requested > available:
                job.clip_count_conflict = {
                    "requested": requested,
                    "available": available,
                }
                job.add_log(
                    f"You requested {requested} clips, but only {available} "
                    f"good clips are available. Continuing with {available}."
                )
                clip_count = available

        # 6. Generate clips
        job.set_step(6, "Generating clips")
        generator = ClipGenerator(video)
        # Clear old clips first
        for old in config.CLIPS_DIR.glob("*.mp4"):
            old.unlink()

        # Compute expected clip segments so we can create per-clip subtitles later
        expected_segments = []
        if clipping_mode == config.CLIPPING_DURATION:
            total_dur = int(VideoLoader(video).metadata()["duration"])
            start = 0
            idx = 1
            while start < total_dur:
                end = min(start + (clip_duration or config.CLIP_DURATION), total_dur)
                expected_segments.append({
                    "name": f"AI_Spark_Clip_{idx:03d}",
                    "start": start,
                    "end": end,
                })
                start = end
                idx += 1
        elif clipping_mode == config.CLIPPING_COUNT:
            n = len(merged_scenes) if merged_scenes else len(scenes)
            count = clip_count or 1
            step = max(n / count, 1)
            for i in range(count):
                idx = min(int(i * step), n - 1)
                scene = (merged_scenes or scenes)[idx]
                expected_segments.append({
                    "name": f"AI_Spark_Clip_{i+1:03d}",
                    "start": scene["start"],
                    "end": scene["end"],
                })
        else:
            for idx, scene in enumerate(merged_scenes or scenes, start=1):
                expected_segments.append({
                    "name": f"AI_Spark_Clip_{idx:03d}",
                    "start": scene["start"],
                    "end": scene["end"],
                })

        clips = generator.generate_clips(
            merged_scenes,
            mode=clipping_mode,
            clip_duration=clip_duration,
            clip_count=clip_count,
            aspect_key=aspect_key,
            naming=naming,
            transcript=None,
            fps=config.FPS,
            quality=quality,
        )
        clip_files = [Path(c).name for c in clips]
        job.add_log(f"Clips generated: {len(clips)}")

        # Build clip filename -> segment time mapping
        clip_segment_map = {}
        for seg in expected_segments:
            for cf in clip_files:
                if cf.startswith(seg["name"].rsplit(".", 1)[0]):
                    clip_segment_map[cf] = seg
                    break
        # Fallback: match by index if name matching fails
        if len(clip_segment_map) != len(clip_files):
            for i, cf in enumerate(clip_files):
                if cf not in clip_segment_map and i < len(expected_segments):
                    clip_segment_map[cf] = expected_segments[i]

        # Register clips in project state (source video is NOT included here)
        from core.project_state import project_state
        for clip_path in clips:
            project_state.add_clip(project_id, Path(clip_path).name, f"/download/clip/{Path(clip_path).name}")

        # Build clip metadata for review
        job.clips_meta = [
            {
                "name": name,
                "url": f"/download/clip/{name}",
            }
            for name in clip_files
        ]

        # 7. Whisper transcription (with caching for speed)
        job.set_step(7, "Transcribing with Whisper")
        whisper = WhisperEngine(config.WHISPER_MODEL)

        # Language: auto or specific
        whisper_lang = language if language != "auto" else None
        transcript_file = config.TRANSCRIPT_DIR / f"{Path(job.filename).stem}.json"

        # Reuse cached transcript if available to avoid re-transcription
        transcript = whisper.transcribe_cached(
            video,
            transcript_file,
            language=whisper_lang,
        )
        job.add_log(f"Transcript: {len(transcript)} segments")

        # 8. Subtitle generation (with optional translation)
        job.set_step(8, "Generating subtitles")
        subtitle = SubtitleBuilder()
        stem = Path(job.filename).stem

        # Build subtitle transcript in the requested subtitle language
        subtitle_transcript = translate_transcript(transcript, subtitle_translate)

        srt_file = config.SUBTITLE_DIR / f"{stem}.srt"
        vtt_file = config.SUBTITLE_DIR / f"{stem}.vtt"
        subtitle.save_all(subtitle_transcript, srt_file, vtt_file)
        job.add_log("SRT + VTT subtitle files created.")

        # Associate SRT/VTT with the project
        project_state.add_caption_file(project_id, srt_file.name, "srt", f"/download/subtitle/{srt_file.name}")
        project_state.add_caption_file(project_id, vtt_file.name, "vtt", f"/download/subtitle/{vtt_file.name}")

        job.caption_files = [
            {"filename": srt_file.name, "media_type": "srt", "url": f"/download/subtitle/{srt_file.name}"},
            {"filename": vtt_file.name, "media_type": "vtt", "url": f"/download/subtitle/{vtt_file.name}"},
        ]

        # 9. Apply animated captions directly into each generated clip
        captioned_clips = []
        if caption_enabled:
            job.add_log("Rendering animated captions into each clip...")
            caption_renderer = AnimatedCaptionRenderer()
            caption_dir = config.CLIPS_DIR / "captions"
            caption_dir.mkdir(parents=True, exist_ok=True)
            for stale in caption_dir.glob("*.mp4"):
                stale.unlink(missing_ok=True)

            for clip_path in clips:
                clip_stem = Path(clip_path).stem
                temp_output = clip_path.with_name(f"{clip_stem}_rendered.mp4")
                try:
                    rendered = caption_renderer.render(
                        input_video=clip_path,
                        transcript=subtitle_transcript,
                        output_video=temp_output,
                        opts=caption_opts,
                        template=caption_template,
                    )
                    if rendered and rendered.exists():
                        rendered.replace(clip_path)
                        captioned_clips.append(clip_path)
                except Exception as e:
                    job.add_log(f"Caption render failed for {clip_stem}: {e}")

            if not captioned_clips:
                captioned_clips = list(clips)

            job.add_log(f"Animated captions rendered for {len(captioned_clips)} clips.")
        else:
            captioned_clips = list(clips)

        final_clip_files = [Path(c).name for c in captioned_clips]

        # Per-clip SRT/VTT: create clip-specific subtitle files so each
        # generated clip carries its own associated captions with adjusted timestamps.
        clip_subtitle_map = {}
        for clip_path in captioned_clips:
            clip_name = Path(clip_path).name
            clip_stem = Path(clip_path).stem
            clip_srt = config.SUBTITLE_DIR / f"{clip_stem}.srt"
            clip_vtt = config.SUBTITLE_DIR / f"{clip_stem}.vtt"
            seg = clip_segment_map.get(clip_name)
            try:
                _write_clip_subtitles(
                    subtitle_transcript, clip_srt, clip_vtt,
                    seg["start"] if seg else 0,
                    seg["end"] if seg else None,
                )
                clip_subtitle_map[clip_stem] = {
                    "srt": f"/download/subtitle/{clip_srt.name}",
                    "vtt": f"/download/subtitle/{clip_vtt.name}",
                }
            except Exception:
                pass

        job.result = {
            "filename": job.filename,
            "project_id": project_id,
            "metadata": info,
            "scenes": len(scenes),
            "merged_clips": len(merged_scenes),
            "clips": final_clip_files,
            "clips_meta": job.clips_meta,
            "transcript": transcript,
            "subtitle_transcript": subtitle_transcript,
            "srt": f"/download/subtitle/{stem}.srt",
            "vtt": f"/download/subtitle/{stem}.vtt",
            "transcript_file": f"/download/transcript/{stem}.json",
            "final_video": None,
            "caption_video": None,
            "caption_clips": [],
            "thumbnail": f"/download/thumbnail/{stem}_thumb.jpg",
            "quality": quality,
            "caption_enabled": caption_enabled,
            "clip_count_conflict": getattr(job, "clip_count_conflict", None),
            "source_video": job.filename,
            "caption_style": _style_to_dict(job.caption_style) if job.caption_style else None,
            "clip_subtitle_map": clip_subtitle_map,
        }

        job.status = "done"
        job.finished = True
        job.add_log("Pipeline completed successfully.")

    except Exception as e:
        job.status = "error"
        job.finished = True
        job.error = str(e)
        job.add_log(f"ERROR: {e}")


@process_bp.route("/ffmpeg", methods=["GET"])
def ffmpeg_status():
    """Return whether FFmpeg is available."""
    status, version = check_ffmpeg()
    return jsonify({"success": True, "installed": status, "version": version})


@process_bp.route("/start", methods=["POST"])
def start():
    """Start a new pipeline job for a given video filename."""
    global JOB_COUNTER

    data = request.get_json(silent=True) or {}
    filename = data.get("filename", "")
    settings = data.get("settings", {})

    if not filename:
        return jsonify({"success": False, "error": "No filename provided"}), 400

    video = config.INPUT_DIR / filename
    if not video.exists():
        return jsonify({"success": False, "error": f"Video not found: {filename}"}), 404

    with JOB_LOCK:
        JOB_COUNTER += 1
        job_id = f"job_{JOB_COUNTER}"
        job = PipelineJob(job_id, filename, settings)
        JOBS[job_id] = job

    # Run in background thread
    thread = threading.Thread(
        target=run_pipeline_job,
        args=(job,),
        daemon=True
    )
    thread.start()

    return jsonify({"success": True, "job_id": job_id})


@process_bp.route("/status/<job_id>", methods=["GET"])
def status(job_id):
    """Return the current status of a pipeline job."""
    job = JOBS.get(job_id)
    if not job:
        return jsonify({"success": False, "error": "Job not found"}), 404
    data = job.to_dict()
    data["success"] = True
    return jsonify(data)


# ======================================================
# Clip Review endpoints
# ======================================================

@process_bp.route("/clips/<job_id>", methods=["GET"])
def clips_list(job_id):
    """Return metadata for all generated clips of a job."""
    job = JOBS.get(job_id)
    if not job:
        return jsonify({"success": False, "error": "Job not found"}), 404
    return jsonify({"success": True, "clips": job.clips_meta})


@process_bp.route("/clip/delete", methods=["POST"])
def clip_delete():
    """Delete a generated clip file."""
    data = request.get_json(silent=True) or {}
    filename = Path(data.get("filename", "")).name
    if not filename:
        return jsonify({"success": False, "error": "No filename"}), 400

    clip_path = config.CLIPS_DIR / filename
    if not clip_path.exists():
        return jsonify({"success": False, "error": "Clip not found"}), 404

    try:
        clip_path.unlink()
        return jsonify({"success": True, "deleted": filename})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@process_bp.route("/clip/rename", methods=["POST"])
def clip_rename():
    """Rename a generated clip file."""
    data = request.get_json(silent=True) or {}
    old_name = Path(data.get("old_name", "")).name
    new_name = Path(data.get("new_name", "")).name

    if not old_name or not new_name:
        return jsonify({"success": False, "error": "old_name and new_name required"}), 400

    old_path = config.CLIPS_DIR / old_name
    new_path = config.CLIPS_DIR / new_name

    if not old_path.exists():
        return jsonify({"success": False, "error": "Clip not found"}), 404
    if new_path.exists():
        return jsonify({"success": False, "error": "Target name already exists"}), 400

    try:
        old_path.rename(new_path)
        return jsonify({"success": True, "old": old_name, "new": new_name})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@process_bp.route("/metadata/<filename>", methods=["GET"])
def get_metadata(filename):
    """Get metadata for a file in the input directory."""
    filename = Path(filename).name
    video_path = config.INPUT_DIR / filename

    if not video_path.exists():
        return jsonify({"success": False, "error": "File not found"}), 404

    try:
        loader = VideoLoader(video_path)
        info = loader.metadata()
        loader.close()
        return jsonify({"success": True, "metadata": info})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ======================================================
# Global active jobs
# ======================================================

@process_bp.route("/active-jobs", methods=["GET"])
def active_jobs():
    """Return summary of all active pipeline jobs."""
    with JOB_LOCK:
        jobs = []
        for job in JOBS.values():
            if not job.finished:
                jobs.append({
                    "job_id": job.job_id,
                    "filename": job.filename,
                    "status": job.status,
                    "step": job.step,
                    "steps_completed": job.steps_completed,
                    "total_steps": job.total_steps,
                })
    return jsonify({"success": True, "jobs": jobs, "count": len(jobs)})


@process_bp.route("/clip/send-to-input", methods=["POST"])
def clip_send_to_input():
    """Copy a generated clip to the input directory so it can be used elsewhere."""
    data = request.get_json(silent=True) or {}
    filename = Path(data.get("filename", "")).name
    if not filename:
        return jsonify({"success": False, "error": "No filename"}), 400

    clip_path = config.CLIPS_DIR / filename
    if not clip_path.exists():
        return jsonify({"success": False, "error": "Clip not found"}), 404

    try:
        import shutil
        dest = config.INPUT_DIR / filename
        shutil.copy2(str(clip_path), str(dest))
        return jsonify({"success": True, "filename": filename, "path": f"/download/input/{filename}"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def _style_to_dict(style):
    if not style:
        return None
    return {
        "id": style.id,
        "name": style.name,
        "font_family": style.font_family,
        "font_size": style.font_size,
        "font_weight": style.font_weight,
        "text_color": style.text_color,
        "active_word_color": style.active_word_color,
        "background_color": style.background_color,
        "background_opacity": style.background_opacity,
        "outline_color": style.outline_color,
        "outline_width": style.outline_width,
        "shadow_color": style.shadow_color,
        "shadow_blur": style.shadow_blur,
        "shadow_offset_y": style.shadow_offset_y,
        "position": style.position,
        "animation": style.animation,
        "letter_spacing": style.letter_spacing,
        "line_height": style.line_height,
        "max_lines": style.max_lines,
    }


def _write_clip_subtitles(transcript, srt_path, vtt_path, clip_start, clip_end):
    """Write SRT and VTT files for a clip, adjusting timestamps relative to clip_start."""
    builder = SubtitleBuilder()
    segments = []
    for seg in transcript:
        seg_start = float(seg.get("start", 0))
        seg_end = float(seg.get("end", 0))
        if clip_end is not None:
            if seg_end <= clip_start or seg_start >= clip_end:
                continue
            adj_start = max(0, seg_start - clip_start)
            adj_end = min(clip_end - clip_start, seg_end - clip_start)
        else:
            adj_start = max(0, seg_start - clip_start)
            adj_end = seg_end - clip_start
        if adj_end <= adj_start:
            continue
        segments.append({
            "start": adj_start,
            "end": adj_end,
            "text": seg.get("text", ""),
        })

    srt_path = Path(srt_path)
    vtt_path = Path(vtt_path)
    srt_path.parent.mkdir(parents=True, exist_ok=True)
    vtt_path.parent.mkdir(parents=True, exist_ok=True)
    if segments:
        builder.save_all(segments, srt_path, vtt_path)
