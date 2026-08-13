"""Caption Studio routes - API endpoints for the React editor."""

import os
import json
import config
from pathlib import Path
from flask import Blueprint, request, jsonify, send_file, render_template

caption_studio_bp = Blueprint("caption_studio", __name__)


@caption_studio_bp.route("/caption-studio")
def caption_studio_page():
    project_id = request.args.get("project_id", "")
    filename = request.args.get("src", "")
    video_param = request.args.get("video", "")
    inherited_style = None
    caption_files = []
    preload_video = None

    if project_id:
        try:
            from core.project_state import project_state
            project = project_state.get_project(project_id)
            if project:
                inherited_style = project.caption_style
                if filename:
                    caption_files = project_state.get_clip_caption_files(project_id, filename)
        except Exception:
            pass

    # If a video param is provided, prepare preload data for the React app
    # Also support ?src= filename (used by YT Downloader and Clip Cutter "Open in Caption Studio")
    video_to_load = video_param or filename
    if video_to_load and not preload_video:
        # Check input dir first, then clips dir
        video_path = config.INPUT_DIR / video_to_load
        video_url = f"/download/input/{video_to_load}"
        if not video_path.exists():
            video_path = config.CLIPS_DIR / video_to_load
            video_url = f"/download/clip/{video_to_load}"
        if video_path.exists():
            try:
                from utils.video_utils import VideoLoader
                loader = VideoLoader(video_path)
                meta = loader.metadata()
                loader.close()
                preload_video = {
                    "filename": video_to_load,
                    "video_url": video_url,
                    "metadata": {
                        "duration": meta.get("duration", 0),
                        "width": meta.get("width", 1080),
                        "height": meta.get("height", 1920),
                    },
                }
            except Exception:
                pass

    return render_template(
        "caption_studio.html",
        project_id=project_id,
        source_filename=filename,
        inherited_style=inherited_style,
        caption_files=caption_files,
        preload_video=preload_video,
    )


@caption_studio_bp.route("/caption-studio/", defaults={"path": ""})
@caption_studio_bp.route("/caption-studio/<path:path>")
def caption_studio_catchall(path):
    return render_template("caption_studio.html")


@caption_studio_bp.route("/api/upload/video", methods=["POST"])
def upload_video():
    if "video" not in request.files:
        return jsonify({"success": False, "error": "No video file provided"}), 400
    file = request.files["video"]
    if file.filename == "":
        return jsonify({"success": False, "error": "Empty filename"}), 400
    from pathlib import Path
    filename = Path(file.filename).name
    config.INPUT_DIR.mkdir(parents=True, exist_ok=True)
    save_path = config.INPUT_DIR / filename
    file.save(str(save_path))
    try:
        from utils.video_utils import VideoLoader
        loader = VideoLoader(save_path)
        info = loader.metadata()
        config.THUMBNAIL_DIR.mkdir(parents=True, exist_ok=True)
        thumb_path = config.THUMBNAIL_DIR / f"{Path(filename).stem}_thumb.jpg"
        loader.thumbnail(thumb_path)
        loader.close()

        project_id = request.form.get("project_id", "")
        if not project_id:
            try:
                from core.project_state import project_state
                proj = project_state.create_project(filename, f"/download/input/{filename}")
                project_id = proj.project_id
            except Exception:
                project_id = ""

        return jsonify({
            "success": True,
            "filename": filename,
            "video_url": f"/download/input/{filename}",
            "metadata": info,
            "project_id": project_id,
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@caption_studio_bp.route("/api/caption-studio/demo", methods=["POST"])
def load_demo():
    return jsonify({
        "success": True,
        "filename": "demo.mp4",
        "video_url": "/static/demo.mp4",
        "metadata": {"duration": 10},
        "demo": True,
    })


@caption_studio_bp.route("/api/caption-studio/auto-caption", methods=["POST"])
def auto_caption():
    data = request.get_json() or {}
    video_filename = data.get("videoFileName")
    language = data.get("language", "en")
    project_id = data.get("project_id", "")
    if not video_filename:
        return jsonify({"success": False, "error": "No video provided"}), 400
    video_path = config.INPUT_DIR / video_filename
    if not video_path.exists():
        return jsonify({"success": False, "error": "Video not found"}), 404
    try:
        from ai.whisper_engine import WhisperEngine
        whisper = WhisperEngine(config.WHISPER_MODEL)
        transcript = whisper.transcribe(video_path, language=language)
        captions = []
        for seg in transcript:
            words = seg["text"].split()
            word_objs = []
            if words:
                word_duration = (seg["end"] - seg["start"]) / len(words)
                for i, w in enumerate(words):
                    word_objs.append({
                        "text": w,
                        "start": seg["start"] + i * word_duration,
                        "end": seg["start"] + (i + 1) * word_duration,
                    })
            captions.append({
                "id": f"cap_{seg['start']}_{seg['end']}",
                "text": seg["text"].strip(),
                "start": seg["start"],
                "end": seg["end"],
                "words": word_objs,
            })

        if project_id:
            from core.project_state import project_state, MediaItem
            srt_content = _build_srt(captions)
            stem = Path(video_filename).stem
            srt_file = config.SUBTITLE_DIR / f"{stem}_captions.srt"
            vtt_file = config.SUBTITLE_DIR / f"{stem}_captions.vtt"
            srt_file.write_text(srt_content, encoding="utf-8")
            vtt_file.write_text(_build_vtt(captions), encoding="utf-8")
            project_state.add_caption_file(project_id, srt_file.name, "srt", f"/download/subtitle/{srt_file.name}")
            project_state.add_caption_file(project_id, vtt_file.name, "vtt", f"/download/subtitle/{vtt_file.name}")

        return jsonify({"success": True, "captions": captions})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@caption_studio_bp.route("/api/caption-studio/import", methods=["POST"])
def import_captions():
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file provided"}), 400
    file = request.files["file"]
    filename = Path(file.filename).name
    project_id = request.form.get("project_id", "")
    try:
        content = file.read().decode("utf-8")
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to read file: {e}"}), 400
    captions = []
    ext = Path(filename).suffix.lower()
    if ext == ".srt":
        blocks = content.strip().split("\n\n")
        for idx, block in enumerate(blocks):
            lines = block.strip().splitlines()
            if len(lines) >= 3:
                time_line = lines[1]
                if " --> " in time_line:
                    start_str, end_str = time_line.split(" --> ")
                    text = " ".join(lines[2:])
                    captions.append({
                        "id": f"imp_{idx}",
                        "text": text,
                        "start": _parse_srt_time(start_str),
                        "end": _parse_srt_time(end_str),
                    })
    elif ext == ".vtt":
        lines = content.splitlines()
        for i, line in enumerate(lines):
            if " --> " in line:
                start_str, end_str = line.split(" --> ")
                text = ""
                if i + 1 < len(lines):
                    text = lines[i + 1].strip()
                captions.append({
                    "id": f"imp_{i}",
                    "text": text,
                    "start": _parse_vtt_time(start_str.strip()),
                    "end": _parse_vtt_time(end_str.strip()),
                })
    else:
        return jsonify({"success": False, "error": "Unsupported file format. Please upload SRT or VTT."}), 400

    if project_id and captions:
        try:
            from core.project_state import project_state
            srt_content = _build_srt(captions)
            vtt_content = _build_vtt(captions)
            stem = Path(filename).stem
            srt_path = config.SUBTITLE_DIR / f"{stem}_imported.srt"
            vtt_path = config.SUBTITLE_DIR / f"{stem}_imported.vtt"
            srt_path.write_text(srt_content, encoding="utf-8")
            vtt_path.write_text(vtt_content, encoding="utf-8")
            project_state.add_caption_file(project_id, srt_path.name, "srt", f"/download/subtitle/{srt_path.name}")
            project_state.add_caption_file(project_id, vtt_path.name, "vtt", f"/download/subtitle/{vtt_path.name}")
        except Exception:
            pass

    return jsonify({"success": True, "captions": captions})


def _parse_srt_time(time_str):
    time_str = time_str.strip()
    if "," in time_str:
        time_str = time_str.replace(",", ".")
    parts = time_str.split(":")
    if len(parts) == 3:
        h, m, s = parts
        return int(h) * 3600 + int(m) * 60 + float(s)
    elif len(parts) == 2:
        m, s = parts
        return int(m) * 60 + float(s)
    return float(time_str)


def _parse_vtt_time(time_str):
    time_str = time_str.strip()
    if time_str.count(":") == 2:
        parts = time_str.split(":")
        h = int(parts[0])
        m = int(parts[1])
        s = float(parts[2])
        return h * 3600 + m * 60 + s
    return float(time_str)


@caption_studio_bp.route("/api/caption-studio/export", methods=["POST"])
def export_video():
    data = request.get_json() or {}
    captions = data.get("captions", [])
    video_filename = data.get("videoFileName")
    project_id = data.get("project_id", "")
    if not video_filename:
        return jsonify({"success": False, "error": "No video provided"}), 400
    video_path = config.INPUT_DIR / video_filename
    if not video_path.exists():
        return jsonify({"success": False, "error": "Video not found"}), 404
    try:
        from ai.subtitle_builder import SubtitleBuilder
        from ai.subtitle_renderer import SubtitleRenderer
        output_path = config.FINAL_DIR / f"captioned_{Path(video_filename).stem}.mp4"
        srt_path = config.SUBTITLE_DIR / f"{Path(video_filename).stem}_caption.srt"
        transcript = [{"start": c["start"], "end": c["end"], "text": c["text"]} for c in captions]
        builder = SubtitleBuilder()
        builder.save_all(transcript, srt_path, srt_path.with_suffix(".vtt"))
        renderer = SubtitleRenderer()
        renderer.burn_subtitle(input_video=video_path, subtitle_file=srt_path, output_video=output_path)

        if project_id:
            try:
                from core.project_state import project_state
                project_state.add_final_export(project_id, output_path.name, f"/download/final/{output_path.name}")
            except Exception:
                pass

        return jsonify({"success": True, "download_url": f"/download/final/{output_path.name}"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@caption_studio_bp.route("/open-caption-studio")
def open_caption_studio():
    """Bridge route: store preload data and redirect to Caption Studio."""
    clip = request.args.get("clip", "")
    video = request.args.get("video", "")
    srt = request.args.get("srt", "")
    vtt = request.args.get("vtt", "")
    style = request.args.get("style", "")
    project_id = request.args.get("project_id", "")

    preload = {
        "clip": clip,
        "video": video,
        "srt": srt,
        "vtt": vtt,
        "style": style,
        "project_id": project_id,
    }
    session["caption_studio_preload"] = preload

    # Redirect to Caption Studio with the video param so it can preload
    redirect_url = f"/caption-studio?video={video}&project_id={project_id}&src={clip}"
    return redirect(redirect_url)


@caption_studio_bp.route("/api/caption-studio/preload", methods=["GET"])
def caption_studio_preload():
    """Return any preloaded data stored in the session."""
    data = session.pop("caption_studio_preload", None)
    return jsonify({"success": True, "preload": data})


@caption_studio_bp.route("/api/caption-studio/export-captions", methods=["POST"])
def export_captions_only():
    """Export captions as SRT/VTT files without rendering the video."""
    data = request.get_json() or {}
    captions = data.get("captions", [])
    project_id = data.get("project_id", "")
    video_filename = data.get("videoFileName", "")
    output_format = data.get("format", "both")  # "srt", "vtt", or "both"

    if not captions:
        return jsonify({"success": False, "error": "No captions to export"}), 400

    try:
        config.SUBTITLE_DIR.mkdir(parents=True, exist_ok=True)
        results = {}

        if output_format in ("srt", "both"):
            srt_content = _build_srt(captions)
            srt_name = f"captions_export.srt"
            srt_path = config.SUBTITLE_DIR / srt_name
            srt_path.write_text(srt_content, encoding="utf-8")
            results["srt"] = {"filename": srt_name, "url": f"/download/subtitle/{srt_name}"}

        if output_format in ("vtt", "both"):
            vtt_content = _build_vtt(captions)
            vtt_name = f"captions_export.vtt"
            vtt_path = config.SUBTITLE_DIR / vtt_name
            vtt_path.write_text(vtt_content, encoding="utf-8")
            results["vtt"] = {"filename": vtt_name, "url": f"/download/subtitle/{vtt_name}"}

        if project_id:
            try:
                from core.project_state import project_state
                for fmt_key, info in results.items():
                    project_state.add_caption_file(
                        project_id, info["filename"], fmt_key, info["url"]
                    )
            except Exception:
                pass

        return jsonify({"success": True, "files": results})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@caption_studio_bp.route("/api/caption-studio/search-replace", methods=["POST"])
def search_replace_captions():
    """Search and replace text across all captions."""
    data = request.get_json() or {}
    captions = data.get("captions", [])
    search_text = data.get("search", "")
    replace_text = data.get("replace", "")
    case_sensitive = data.get("case_sensitive", False)

    if not captions or not search_text:
        return jsonify({"success": False, "error": "No captions or search text provided"}), 400

    try:
        updated = []
        count = 0
        for cap in captions:
            text = cap.get("text", "")
            original_text = text
            if case_sensitive:
                new_text = text.replace(search_text, replace_text)
            else:
                # Case-insensitive replace preserving the original text's casing for the search term
                import re
                new_text = re.sub(
                    re.escape(search_text),
                    replace_text,
                    text,
                    flags=re.IGNORECASE
                )
            if new_text != original_text:
                count += 1
            updated.append({**cap, "text": new_text})

        return jsonify({"success": True, "captions": updated, "replaceCount": count})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@caption_studio_bp.route("/api/caption-studio/auto-split", methods=["POST"])
def auto_split_captions():
    """Auto-split captions that exceed a maximum duration into smaller segments."""
    data = request.get_json() or {}
    captions = data.get("captions", [])
    max_duration = data.get("max_duration", 7.0)

    if not captions:
        return jsonify({"success": False, "error": "No captions provided"}), 400

    try:
        updated = []
        for cap in captions:
            cap_duration = cap.get("end", 0) - cap.get("start", 0)
            if cap_duration > max_duration:
                # Split into equal segments based on word boundaries
                words = cap.get("words", [])
                if not words:
                    words = cap.get("text", "").split()
                total_words = len(words)
                if total_words <= 1:
                    updated.append(cap)
                    continue

                # Determine number of splits
                num_splits = int(cap_duration / max_duration) + 1
                words_per_split = max(1, total_words // num_splits)

                for i in range(num_splits):
                    start_idx = i * words_per_split
                    end_idx = min((i + 1) * words_per_split, total_words) if i < num_splits - 1 else total_words
                    if start_idx >= total_words:
                        break
                    split_words = words[start_idx:end_idx] if isinstance(words, list) and words and isinstance(words[0], dict) else words[start_idx:end_idx]

                    segment_start = cap["start"] + (i * cap_duration / num_splits)
                    segment_end = cap["start"] + ((i + 1) * cap_duration / num_splits) if i < num_splits - 1 else cap["end"]

                    word_texts = [w["text"] if isinstance(w, dict) else str(w) for w in split_words]
                    segment = {
                        "id": f"{cap.get('id', 'cap')}_split_{i}",
                        "text": " ".join(word_texts),
                        "start": segment_start,
                        "end": segment_end,
                    }
                    updated.append(segment)
            else:
                updated.append(cap)

        updated.sort(key=lambda c: c.get("start", 0))
        return jsonify({"success": True, "captions": updated})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def _build_srt(captions):
    lines = []
    for i, cap in enumerate(captions, 1):
        start = _format_srt_time(cap["start"])
        end = _format_srt_time(cap["end"])
        lines.append(f"{i}\n{start} --> {end}\n{cap['text']}")
    return "\n\n".join(lines) + "\n"


def _build_vtt(captions):
    lines = ["WEBVTT\n"]
    for i, cap in enumerate(captions, 1):
        start = _format_vtt_time(cap["start"])
        end = _format_vtt_time(cap["end"])
        lines.append(f"{i}\n{start} --> {end}\n{cap['text']}")
    return "\n\n".join(lines) + "\n"


def _format_srt_time(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:06.3f}".replace(".", ",")


def _format_vtt_time(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:06.3f}"
