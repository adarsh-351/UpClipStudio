"""Caption Studio routes - Dedicated AI Caption Studio 2.0 API & workspace endpoints."""

import os
import json
import re
import time
from pathlib import Path
from flask import Blueprint, request, jsonify, send_file, render_template, session, redirect

import config
from core.project_manager import project_manager

caption_studio_bp = Blueprint("caption_studio", __name__)


@caption_studio_bp.route("/caption-studio")
def caption_studio_page():
    project_id = request.args.get("project_id", "") or request.args.get("projectId", "")
    filename = request.args.get("src", "")
    video_param = request.args.get("video", "")
    inherited_style = None
    caption_files = []
    preload_video = None
    db_project = None

    if project_id:
        try:
            # Try database model first
            from models.project import Project
            clean_id = project_id.replace("proj_", "")
            if clean_id.isdigit():
                p = Project.query.get(int(clean_id))
                if p:
                    db_project = p.to_dict()
                    project_manager.record_recent_project(
                        project_id=p.id,
                        name=p.name,
                        source_path=p.source_path or "",
                        thumbnail_path=p.thumbnail_path or ""
                    )
            if not db_project:
                p = Project.query.filter_by(name=project_id).first()
                if p:
                    db_project = p.to_dict()
        except Exception:
            pass

        try:
            from core.project_state import project_state
            project = project_state.get_project(project_id)
            if project:
                inherited_style = project.caption_style
                if filename:
                    caption_files = project_state.get_clip_caption_files(project_id, filename)
        except Exception:
            pass

    # Resolve video source
    video_to_load = video_param or filename
    if not video_to_load and db_project:
        video_to_load = db_project.get("source_path") or ""

    if video_to_load:
        # Check input dir first, then clips dir, then final dir
        video_path = config.INPUT_DIR / video_to_load
        video_url = f"/download/input/{video_to_load}"
        if not video_path.exists():
            video_path = config.CLIPS_DIR / video_to_load
            video_url = f"/download/clip/{video_to_load}"
        if not video_path.exists():
            video_path = config.FINAL_DIR / video_to_load
            video_url = f"/download/final/{video_to_load}"

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
                preload_video = {
                    "filename": video_to_load,
                    "video_url": video_url,
                    "metadata": {"duration": 0, "width": 1080, "height": 1920},
                }

    return render_template(
        "caption_studio.html",
        project_id=project_id,
        project=db_project,
        source_filename=video_to_load or filename,
        inherited_style=inherited_style,
        caption_files=caption_files,
        preload_video=preload_video,
    )


@caption_studio_bp.route("/caption-studio/", defaults={"path": ""})
@caption_studio_bp.route("/caption-studio/<path:path>")
def caption_studio_catchall(path):
    return render_template("caption_studio.html")


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

    redirect_url = f"/caption-studio?video={video}&project_id={project_id}&src={clip}"
    return redirect(redirect_url)


@caption_studio_bp.route("/api/caption-studio/preload", methods=["GET"])
def caption_studio_preload():
    """Return any preloaded data stored in the session."""
    data = session.pop("caption_studio_preload", None)
    return jsonify({"success": True, "preload": data})


@caption_studio_bp.route("/api/caption-studio/auto-caption", methods=["POST"])
def auto_caption():
    data = request.get_json() or {}
    video_filename = data.get("videoFileName")
    language = data.get("language", "en")
    project_id = data.get("project_id", "")
    if not video_filename:
        return jsonify({"success": False, "error": "No video filename provided"}), 400

    # Locate source video
    video_path = config.INPUT_DIR / video_filename
    if not video_path.exists():
        video_path = config.CLIPS_DIR / video_filename
    if not video_path.exists():
        video_path = config.FINAL_DIR / video_filename
    if not video_path.exists():
        return jsonify({"success": False, "error": f"Video file not found: {video_filename}"}), 404

    try:
        from ai.whisper_engine import WhisperEngine
        whisper = WhisperEngine(config.WHISPER_MODEL)
        transcript = whisper.transcribe(video_path, language=language)
        
        captions = []
        # Chunk large segments into readable short-form caption segments (1-7 words each)
        for seg_idx, seg in enumerate(transcript):
            raw_text = str(seg.get("text", "") or "").strip()
            if not raw_text:
                continue

            words = raw_text.split()
            seg_start = float(seg["start"])
            seg_end = float(seg["end"])
            total_dur = max(0.2, seg_end - seg_start)

            # Target chunk size: 3 to 6 words per segment for readable short-form video
            chunk_size = 5 if len(words) > 6 else len(words)
            if chunk_size == 0:
                continue

            word_dur = total_dur / max(1, len(words))

            for i in range(0, len(words), chunk_size):
                chunk_words = words[i:i + chunk_size]
                chunk_start = seg_start + (i * word_dur)
                chunk_end = seg_start + (min(i + chunk_size, len(words)) * word_dur)

                # Word-level timestamp objects
                word_objs = []
                for w_idx, w in enumerate(chunk_words):
                    w_start = chunk_start + (w_idx * word_dur)
                    w_end = chunk_start + ((w_idx + 1) * word_dur)
                    word_objs.append({
                        "text": w,
                        "start": round(w_start, 2),
                        "end": round(w_end, 2),
                    })

                captions.append({
                    "id": f"cap_{seg_idx}_{i}_{int(chunk_start * 100)}",
                    "text": " ".join(chunk_words),
                    "start": round(chunk_start, 2),
                    "end": round(chunk_end, 2),
                    "words": word_objs,
                })

        # Save initial SRT/VTT for project
        if project_id and captions:
            try:
                from core.project_state import project_state
                srt_content = _build_srt(captions)
                stem = Path(video_filename).stem
                srt_file = config.SUBTITLE_DIR / f"{stem}_captions.srt"
                vtt_file = config.SUBTITLE_DIR / f"{stem}_captions.vtt"
                srt_file.write_text(srt_content, encoding="utf-8")
                vtt_file.write_text(_build_vtt(captions), encoding="utf-8")
                project_state.add_caption_file(project_id, srt_file.name, "srt", f"/download/subtitle/{srt_file.name}")
                project_state.add_caption_file(project_id, vtt_file.name, "vtt", f"/download/subtitle/{vtt_file.name}")
            except Exception:
                pass

        return jsonify({"success": True, "captions": captions})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@caption_studio_bp.route("/api/caption-studio/export", methods=["POST"])
def export_video():
    """Export video with burned animated captions matching the exact user styling."""
    data = request.get_json() or {}
    captions = data.get("captions", [])
    video_filename = data.get("videoFileName", "")
    project_id = data.get("project_id", "")
    style = data.get("style", {})

    if not video_filename:
        return jsonify({"success": False, "error": "No video provided"}), 400

    # Locate source video file
    video_path = config.INPUT_DIR / video_filename
    if not video_path.exists():
        video_path = config.CLIPS_DIR / video_filename
    if not video_path.exists():
        video_path = config.FINAL_DIR / video_filename
    if not video_path.exists():
        return jsonify({"success": False, "error": f"Video not found: {video_filename}"}), 404

    try:
        from ai.animated_caption_renderer import AnimatedCaptionRenderer
        config.FINAL_DIR.mkdir(parents=True, exist_ok=True)
        config.SUBTITLE_DIR.mkdir(parents=True, exist_ok=True)

        stem = Path(video_filename).stem
        output_filename = f"captioned_{stem}.mp4"
        output_path = config.FINAL_DIR / output_filename

        # Render burned captions using AnimatedCaptionRenderer with full styling
        renderer = AnimatedCaptionRenderer()
        result = renderer.render(
            input_video=video_path,
            transcript=captions,
            output_video=output_path,
            opts=style,
        )

        if not result or not output_path.exists():
            return jsonify({"success": False, "error": "FFmpeg caption rendering failed."}), 500

        # Save matching SRT & VTT in subtitle directory
        srt_path = config.SUBTITLE_DIR / f"{stem}_captions.srt"
        vtt_path = config.SUBTITLE_DIR / f"{stem}_captions.vtt"
        srt_path.write_text(_build_srt(captions), encoding="utf-8")
        vtt_path.write_text(_build_vtt(captions), encoding="utf-8")

        if project_id:
            try:
                from core.project_state import project_state
                project_state.add_final_export(project_id, output_path.name, f"/download/final/{output_path.name}")
            except Exception:
                pass

        return jsonify({
            "success": True,
            "filename": output_path.name,
            "download_url": f"/download/final/{output_path.name}",
            "srt_url": f"/download/subtitle/{srt_path.name}",
            "vtt_url": f"/download/subtitle/{vtt_path.name}",
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@caption_studio_bp.route("/api/caption-studio/save-state", methods=["POST"])
def save_caption_state():
    """Save caption state (segments & styling) into SQLite database project."""
    data = request.get_json() or {}
    project_id = data.get("project_id", "")
    captions = data.get("captions", [])
    style = data.get("style", {})

    if not project_id:
        return jsonify({"success": False, "error": "No project_id provided"}), 400

    try:
        from models.project import Project
        from app import db
        clean_id = project_id.replace("proj_", "")
        project = None
        if clean_id.isdigit():
            project = Project.query.get(int(clean_id))
        if not project:
            project = Project.query.filter_by(name=project_id).first()

        if project:
            # Parse existing editor_state or create new dict
            current_state = {}
            if project.editor_state:
                try:
                    current_state = json.loads(project.editor_state)
                except Exception:
                    current_state = {}
            current_state["captions"] = captions
            current_state["caption_style"] = style
            project.editor_state = json.dumps(current_state)
            db.session.commit()
            return jsonify({"success": True, "message": "Caption state saved successfully"})
        else:
            return jsonify({"success": True, "message": "State preserved in memory"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@caption_studio_bp.route("/api/caption-studio/import", methods=["POST"])
def import_captions():
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file provided"}), 400
    file = request.files["file"]
    if not file or not file.filename:
        return jsonify({"success": False, "error": "Empty filename"}), 400
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
                    text = " ".join(lines[2:]).strip()
                    start_sec = _parse_srt_time(start_str)
                    end_sec = _parse_srt_time(end_str)
                    words = text.split()
                    word_dur = (end_sec - start_sec) / max(1, len(words))
                    word_objs = [{
                        "text": w,
                        "start": round(start_sec + i * word_dur, 2),
                        "end": round(start_sec + (i + 1) * word_dur, 2),
                    } for i, w in enumerate(words)]
                    captions.append({
                        "id": f"imp_{idx}",
                        "text": text,
                        "start": start_sec,
                        "end": end_sec,
                        "words": word_objs,
                    })
    elif ext == ".vtt":
        lines = content.splitlines()
        for i, line in enumerate(lines):
            if " --> " in line:
                start_str, end_str = line.split(" --> ")
                text = ""
                if i + 1 < len(lines):
                    text = lines[i + 1].strip()
                start_sec = _parse_vtt_time(start_str.strip())
                end_sec = _parse_vtt_time(end_str.strip())
                words = text.split()
                word_dur = (end_sec - start_sec) / max(1, len(words))
                word_objs = [{
                    "text": w,
                    "start": round(start_sec + idx * word_dur, 2),
                    "end": round(start_sec + (idx + 1) * word_dur, 2),
                } for idx, w in enumerate(words)]
                captions.append({
                    "id": f"imp_{i}",
                    "text": text,
                    "start": start_sec,
                    "end": end_sec,
                    "words": word_objs,
                })
    else:
        return jsonify({"success": False, "error": "Unsupported format. Please upload SRT or VTT."}), 400

    return jsonify({"success": True, "captions": captions})


@caption_studio_bp.route("/api/caption-studio/export-captions", methods=["POST"])
def export_captions_only():
    """Export captions as raw SRT/VTT files without rendering video."""
    data = request.get_json() or {}
    captions = data.get("captions", [])
    project_id = data.get("project_id", "")
    output_format = data.get("format", "both")

    if not captions:
        return jsonify({"success": False, "error": "No captions to export"}), 400

    try:
        config.SUBTITLE_DIR.mkdir(parents=True, exist_ok=True)
        results = {}

        if output_format in ("srt", "both"):
            srt_content = _build_srt(captions)
            srt_name = "captions_export.srt"
            srt_path = config.SUBTITLE_DIR / srt_name
            srt_path.write_text(srt_content, encoding="utf-8")
            results["srt"] = {"filename": srt_name, "url": f"/download/subtitle/{srt_name}"}

        if output_format in ("vtt", "both"):
            vtt_content = _build_vtt(captions)
            vtt_name = "captions_export.vtt"
            vtt_path = config.SUBTITLE_DIR / vtt_name
            vtt_path.write_text(vtt_content, encoding="utf-8")
            results["vtt"] = {"filename": vtt_name, "url": f"/download/subtitle/{vtt_name}"}

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
                new_text = re.sub(re.escape(search_text), replace_text, text, flags=re.IGNORECASE)
            if new_text != original_text:
                count += 1
            updated.append({**cap, "text": new_text})

        return jsonify({"success": True, "captions": updated, "replaceCount": count})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def _chunk_words_intelligently(words, max_words=5, max_chars=32, max_gap=0.6):
    """
    Chunk words into natural, readable short-form caption segments (1-7 words).
    Respects sentence boundaries, punctuation, speech pauses, and character limits
    while strictly preserving word-level timestamps.
    """
    if not words:
        return []

    chunks = []
    current_chunk = []
    current_chars = 0

    for idx, w in enumerate(words):
        w_text = w.get("text", "").strip()
        if not w_text:
            continue

        # Check pause gap from previous word
        has_pause = False
        if current_chunk:
            prev_end = current_chunk[-1].get("end", 0)
            curr_start = w.get("start", 0)
            if (curr_start - prev_end) >= max_gap:
                has_pause = True

        # Check punctuation on previous word
        has_boundary = False
        if current_chunk:
            prev_text = current_chunk[-1].get("text", "")
            if any(prev_text.endswith(p) for p in (".", "!", "?", "...", ":", ";")):
                has_boundary = True

        # Split if max words, max chars, boundary, or speech pause exceeded
        should_split = (
            len(current_chunk) >= max_words or
            (current_chars + len(w_text) + 1 > max_chars and len(current_chunk) >= 2) or
            has_boundary or
            (has_pause and len(current_chunk) >= 1)
        )

        if should_split and current_chunk:
            chunks.append(current_chunk)
            current_chunk = []
            current_chars = 0

        current_chunk.append(w)
        current_chars += len(w_text) + 1

    if current_chunk:
        chunks.append(current_chunk)

    return chunks


@caption_studio_bp.route("/api/caption-studio/auto-split", methods=["POST"])
def auto_split_captions():
    """Auto-split long captions into shorter readable segments (1–7 words) preserving word timestamps."""
    data = request.get_json() or {}
    captions = data.get("captions", [])
    max_words = int(data.get("max_words", 5))
    max_chars = int(data.get("max_chars", 32))

    if not captions:
        return jsonify({"success": False, "error": "No captions provided"}), 400

    try:
        updated = []
        for cap in captions:
            cap_start = float(cap.get("start", 0))
            cap_end = float(cap.get("end", 0))
            cap_duration = max(0.2, cap_end - cap_start)
            words = cap.get("words", [])

            if not words:
                raw_words = cap.get("text", "").split()
                w_dur = cap_duration / max(1, len(raw_words))
                words = [{
                    "text": w,
                    "start": round(cap_start + i * w_dur, 2),
                    "end": round(cap_start + (i + 1) * w_dur, 2),
                } for i, w in enumerate(raw_words)]

            # If segment has more than max_words or excessive duration, chunk intelligently
            if len(words) > max_words or cap_duration > 3.5:
                word_chunks = _chunk_words_intelligently(words, max_words=max_words, max_chars=max_chars)
                for c_idx, chunk in enumerate(word_chunks):
                    if not chunk:
                        continue
                    c_start = chunk[0].get("start", cap_start)
                    c_end = chunk[-1].get("end", cap_end)
                    updated.append({
                        "id": f"{cap.get('id', 'cap')}_split_{c_idx}_{int(c_start * 100)}",
                        "text": " ".join(w["text"] for w in chunk),
                        "start": round(c_start, 2),
                        "end": round(c_end, 2),
                        "words": chunk,
                    })
            else:
                updated.append(cap)

        updated.sort(key=lambda c: c.get("start", 0))
        return jsonify({"success": True, "captions": updated})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@caption_studio_bp.route("/api/caption-studio/style/apply", methods=["POST"])
def apply_caption_style():
    """Apply caption style to single, multiple, or all captions."""
    data = request.get_json(silent=True) or {}
    captions = data.get("captions", [])
    style = data.get("style", {})
    target_ids = data.get("target_ids", [])  # Empty means apply to all
    scope = data.get("scope", "all")  # 'all', 'selected', 'single'

    if not captions:
        return jsonify({"success": False, "error": "No captions provided"}), 400

    try:
        updated = []
        for cap in captions:
            item = dict(cap)
            if scope == "all" or not target_ids or item.get("id") in target_ids:
                item["style"] = style
            updated.append(item)

        return jsonify({"success": True, "captions": updated, "appliedCount": len(updated)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def _parse_srt_time(time_str):
    time_str = time_str.strip()
    if "," in time_str:
        time_str = time_str.replace(",", ".")
    parts = time_str.split(":")
    if len(parts) == 3:
        h, m, s = parts
        return round(int(h) * 3600 + int(m) * 60 + float(s), 2)
    elif len(parts) == 2:
        m, s = parts
        return round(int(m) * 60 + float(s), 2)
    return round(float(time_str), 2)


def _parse_vtt_time(time_str):
    time_str = time_str.strip()
    time_str = time_str.replace(",", ".")
    parts = time_str.split(":")
    if len(parts) == 3:
        h, m, s = parts
        return round(int(h) * 3600 + int(m) * 60 + float(s), 2)
    elif len(parts) == 2:
        m, s = parts
        return round(int(m) * 60 + float(s), 2)
    return round(float(time_str), 2)


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


# ============================================================
# PHASE 18: CAPTION SEGMENT EDITING API
# ============================================================

@caption_studio_bp.route("/api/caption-studio/segments/update", methods=["POST"])
def update_caption_segment():
    data = request.get_json(silent=True) or {}
    captions = data.get("captions", [])
    caption_id = data.get("caption_id", "")
    text = data.get("text")
    start = data.get("start")
    end = data.get("end")
    words = data.get("words")

    cap = next((c for c in captions if c.get("id") == caption_id), None)
    if not cap:
        return jsonify({"success": False, "error": "Caption not found"}), 404

    if text is not None:
        cap["text"] = text
        if words is not None:
            cap["words"] = words
        else:
            raw_words = text.split()
            dur = max(0.1, cap.get("end", 0) - cap.get("start", 0))
            w_dur = dur / max(1, len(raw_words))
            cap["words"] = [
                {"text": w, "start": round(cap["start"] + i * w_dur, 2), "end": round(cap["start"] + (i + 1) * w_dur, 2)}
                for i, w in enumerate(raw_words)
            ]
    if start is not None:
        cap["start"] = float(start)
    if end is not None:
        cap["end"] = float(end)

    captions.sort(key=lambda c: c.get("start", 0))
    return jsonify({"success": True, "captions": captions})


@caption_studio_bp.route("/api/caption-studio/segments/split", methods=["POST"])
def split_caption_segment():
    data = request.get_json(silent=True) or {}
    captions = data.get("captions", [])
    caption_id = data.get("caption_id", "")
    split_time = float(data.get("split_time", 0))

    cap = next((c for c in captions if c.get("id") == caption_id), None)
    if not cap:
        return jsonify({"success": False, "error": "Caption not found"}), 404
    if split_time <= cap.get("start", 0) or split_time >= cap.get("end", 0):
        return jsonify({"success": False, "error": "Split time must be within caption range"}), 400

    words = cap.get("words") or []
    raw_text = cap.get("text", "")
    raw_words = raw_text.split() if raw_text else []
    original_end = cap.get("end", split_time + 1)

    if words and len(words) > 1:
        left_words = [w for w in words if w.get("end", 0) <= split_time]
        right_words = [w for w in words if w.get("start", 0) >= split_time]
        if not left_words:
            mid = max(1, len(words) // 2)
            left_words = words[:mid]
            right_words = words[mid:]
        if not right_words:
            mid = max(1, len(words) // 2)
            right_words = words[mid:]
            left_words = words[:mid]
        cap["text"] = " ".join(w.get("text", "") for w in left_words)
        cap["end"] = split_time
        cap["words"] = left_words
        right_text = " ".join(w.get("text", "") for w in right_words)
        new_words = right_words
    else:
        if not raw_words:
            raw_words = raw_text.split()
        mid = max(1, len(raw_words) // 2)
        left = raw_words[:mid]
        right = raw_words[mid:]
        cap["text"] = " ".join(left)
        cap["end"] = split_time
        total_dur = original_end - cap.get("start", 0)
        w_dur = total_dur / max(1, len(raw_words))
        cap["words"] = [{"text": w, "start": round(cap["start"] + i * w_dur, 2), "end": round(cap["start"] + (i + 1) * w_dur, 2)} for i, w in enumerate(left)]
        right_text = " ".join(right)
        new_words = [{"text": w, "start": round(split_time + i * w_dur, 2), "end": round(split_time + (i + 1) * w_dur, 2)} for i, w in enumerate(right)]

    new_cap = {
        "id": f"cap_{int(time.time() * 1000)}_{abs(hash(split_time)) % 10000}",
        "text": right_text,
        "start": split_time,
        "end": original_end,
        "words": new_words,
    }

    captions.append(new_cap)
    captions.sort(key=lambda c: c.get("start", 0))
    return jsonify({"success": True, "captions": captions})


@caption_studio_bp.route("/api/caption-studio/segments/merge", methods=["POST"])
def merge_caption_segments():
    data = request.get_json(silent=True) or {}
    captions = data.get("captions", [])
    caption_id_a = data.get("caption_id_a", "")
    caption_id_b = data.get("caption_id_b", "")

    idx_a = next((i for i, c in enumerate(captions) if c.get("id") == caption_id_a), None)
    idx_b = next((i for i, c in enumerate(captions) if c.get("id") == caption_id_b), None)

    if idx_a is None or idx_b is None:
        return jsonify({"success": False, "error": "One or both captions not found"}), 404
    if abs(idx_a - idx_b) != 1:
        return jsonify({"success": False, "error": "Captions must be adjacent to merge"}), 400

    first_idx = min(idx_a, idx_b)
    second_idx = max(idx_a, idx_b)
    first = captions[first_idx]
    second = captions[second_idx]

    first["text"] = (first.get("text", "") + " " + second.get("text", "")).strip()
    first["end"] = second.get("end", first.get("end", 0))
    first["words"] = (first.get("words") or []) + (second.get("words") or [])

    captions.pop(second_idx)
    captions.sort(key=lambda c: c.get("start", 0))
    return jsonify({"success": True, "captions": captions})


@caption_studio_bp.route("/api/caption-studio/segments/delete", methods=["POST"])
def delete_caption_segment():
    data = request.get_json(silent=True) or {}
    captions = data.get("captions", [])
    caption_id = data.get("caption_id", "")

    new_captions = [c for c in captions if c.get("id") != caption_id]
    if len(new_captions) == len(captions):
        return jsonify({"success": False, "error": "Caption not found"}), 404

    return jsonify({"success": True, "captions": new_captions})


@caption_studio_bp.route("/api/caption-studio/segments/duplicate", methods=["POST"])
def duplicate_caption_segment():
    data = request.get_json(silent=True) or {}
    captions = data.get("captions", [])
    caption_id = data.get("caption_id", "")

    cap = next((c for c in captions if c.get("id") == caption_id), None)
    if not cap:
        return jsonify({"success": False, "error": "Caption not found"}), 404

    duration = cap.get("end", 0) - cap.get("start", 0)
    offset = min(0.5, duration * 0.3)
    start_offset = cap.get("end", 0) + 0.1
    new_cap = {
        "id": f"cap_{int(time.time() * 1000)}_{abs(hash(caption_id)) % 10000}",
        "text": cap.get("text", ""),
        "start": round(start_offset, 2),
        "end": round(start_offset + duration + offset, 2),
        "words": [
            {"text": w.get("text", ""), "start": round(w.get("start", 0) + start_offset, 2), "end": round(w.get("end", 0) + start_offset, 2)}
            for w in (cap.get("words") or [])
        ],
    }

    captions.append(new_cap)
    captions.sort(key=lambda c: c.get("start", 0))
    return jsonify({"success": True, "captions": captions})


@caption_studio_bp.route("/api/caption-studio/segments/move", methods=["POST"])
def move_caption_segment():
    data = request.get_json(silent=True) or {}
    captions = data.get("captions", [])
    caption_id = data.get("caption_id", "")
    new_start = data.get("start")
    new_end = data.get("end")

    cap = next((c for c in captions if c.get("id") == caption_id), None)
    if not cap:
        return jsonify({"success": False, "error": "Caption not found"}), 404

    if new_start is not None:
        cap["start"] = float(new_start)
    if new_end is not None:
        cap["end"] = float(new_end)

    captions.sort(key=lambda c: c.get("start", 0))
    return jsonify({"success": True, "captions": captions})


@caption_studio_bp.route("/api/caption-studio/segments/reorder", methods=["POST"])
def reorder_caption_segments():
    data = request.get_json(silent=True) or {}
    captions = data.get("captions", [])

    captions.sort(key=lambda c: c.get("start", 0))
    return jsonify({"success": True, "captions": captions})


@caption_studio_bp.route("/api/caption-studio/style/save", methods=["POST"])
def save_caption_style():
    data = request.get_json(silent=True) or {}
    project_id = data.get("project_id", "")
    name = data.get("name", "Custom Style")
    style = data.get("style", {})

    if not style:
        return jsonify({"success": False, "error": "Style data required"}), 400

    try:
        from core.project_state import project_state
        if project_id:
            project = project_state.get_project(project_id)
            if project:
                current_styles = getattr(project, "caption_styles", []) or []
                new_style = {"id": f"cstyle_{int(time.time())}", "name": name, "style": style}
                current_styles.append(new_style)
                project.caption_styles = current_styles
                return jsonify({"success": True, "style": new_style, "styles": current_styles})
    except Exception:
        pass

    return jsonify({"success": True, "style": {"id": f"cstyle_{int(time.time())}", "name": name, "style": style}})


@caption_studio_bp.route("/api/caption-studio/styles", methods=["GET"])
def list_caption_styles():
    project_id = request.args.get("project_id", "")
    builtin_presets = [
        {"id": "cap_clean", "name": "Clean", "category": "Clean", "style": {"font_family": "Inter", "font_size": 32, "font_weight": 700, "text_color": "#FFFFFF", "active_word_color": "#38BDF8", "outline_width": 1, "outline_color": "#000000", "shadow_blur": 2, "shadow_color": "#000000", "animation": "fade_in"}},
        {"id": "cap_bold", "name": "Bold", "category": "Bold", "style": {"font_family": "Anton", "font_size": 44, "font_weight": 800, "text_color": "#FFFFFF", "active_word_color": "#F43F5E", "outline_width": 4, "outline_color": "#000000", "shadow_blur": 6, "shadow_color": "#000000", "animation": "bounce"}},
        {"id": "cap_minimal", "name": "Minimal", "category": "Clean", "style": {"font_family": "DM Sans", "font_size": 28, "font_weight": 600, "text_color": "#FFFFFF", "active_word_color": "#FFFFFF", "background_color": "#000000", "background_opacity": 0.0, "outline_width": 0, "animation": "none"}},
        {"id": "cap_creator", "name": "Creator", "category": "Short-Form", "style": {"font_family": "Poppins", "font_size": 36, "font_weight": 800, "text_color": "#FFFFFF", "active_word_color": "#22D3EE", "background_color": "#0F172A", "background_opacity": 0.5, "outline_width": 2, "animation": "pop"}},
        {"id": "cap_podcast", "name": "Podcast", "category": "Speech", "style": {"font_family": "Montserrat", "font_size": 34, "font_weight": 800, "text_color": "#FFFFFF", "active_word_color": "#FBBF24", "background_color": "#000000", "background_opacity": 0.7, "outline_width": 0, "animation": "fade_in"}},
        {"id": "cap_news", "name": "News", "category": "Editorial", "style": {"font_family": "Arial Black", "font_size": 36, "font_weight": 900, "text_color": "#FFFFFF", "active_word_color": "#EF4444", "background_color": "#1E293B", "background_opacity": 0.85, "outline_width": 2, "animation": "slide_up"}},
        {"id": "cap_gaming", "name": "Gaming", "category": "High Energy", "style": {"font_family": "Bebas Neue", "font_size": 48, "font_weight": 900, "text_color": "#00FF66", "active_word_color": "#FF0055", "outline_width": 4, "outline_color": "#000000", "shadow_blur": 8, "shadow_color": "#000000", "animation": "pop"}},
        {"id": "cap_dynamic", "name": "Dynamic", "category": "Modern", "style": {"font_family": "Plus Jakarta Sans", "font_size": 38, "font_weight": 800, "text_color": "#FFFFFF", "active_word_color": "#A855F7", "outline_width": 3, "outline_color": "#000000", "shadow_blur": 5, "shadow_color": "#000000", "animation": "pop"}},
    ]

    user_styles = []
    try:
        from core.project_state import project_state
        if project_id:
            project = project_state.get_project(project_id)
            if project and getattr(project, "caption_styles", None):
                user_styles = project.caption_styles
    except Exception:
        pass

    return jsonify({"success": True, "styles": builtin_presets + user_styles})
