"""Download route - serves generated output files."""

import io
import os
import re
import subprocess
import sys
import zipfile
from urllib.parse import urlparse
from datetime import datetime

import config
from pathlib import Path

from flask import Blueprint, send_from_directory, send_file, jsonify, request

try:
    import yt_dlp
except Exception:  # pragma: no cover
    yt_dlp = None

download_bp = Blueprint("download", __name__, url_prefix="/download")


def safe_send(directory, filename):
    """Send a file from a directory, guarding against path traversal."""
    filename = Path(filename).name
    file_path = Path(directory) / filename
    if not file_path.exists():
        return jsonify({"success": False, "error": "File not found"}), 404
    return send_from_directory(str(directory), filename, as_attachment=True)


@download_bp.route("/input/<filename>")
def input_file(filename):
    return safe_send(config.INPUT_DIR, filename)


@download_bp.route("/thumbnail/<filename>")
def thumbnail(filename):
    return send_from_directory(str(config.THUMBNAIL_DIR), filename)


@download_bp.route("/final/<filename>")
def final_video(filename):
    return safe_send(config.FINAL_DIR, filename)


@download_bp.route("/subtitle/<filename>")
def subtitle(filename):
    return safe_send(config.SUBTITLE_DIR, filename)


@download_bp.route("/transcript/<filename>")
def transcript(filename):
    return safe_send(config.TRANSCRIPT_DIR, filename)


@download_bp.route("/clip/<filename>")
def clip(filename):
    return safe_send(config.CLIPS_DIR, filename)


@download_bp.route("/clip/captions/<filename>")
def clip_caption(filename):
    """Serve per-clip animated caption videos."""
    cap_dir = config.CLIPS_DIR / "captions"
    cap_dir.mkdir(parents=True, exist_ok=True)
    return safe_send(cap_dir, filename)


@download_bp.route("/clip/stream/<filename>")
def clip_stream(filename):
    """Stream a clip for in-browser preview (supports range requests)."""
    filename = Path(filename).name
    file_path = config.CLIPS_DIR / filename
    if not file_path.exists():
        return jsonify({"success": False, "error": "File not found"}), 404
    return send_from_directory(str(config.CLIPS_DIR), filename, as_attachment=False)


@download_bp.route("/frame/<filename>")
def frame(filename):
    return safe_send(config.FRAMES_DIR, filename)


@download_bp.route("/all")
def download_all():
    """
    Download all generated clips as a single ZIP archive.
    """
    clips = sorted(
        [p for p in config.CLIPS_DIR.glob("*.mp4") if p.is_file()],
        key=lambda p: p.name,
    )

    if not clips:
        return jsonify({"success": False, "error": "No clips available"}), 404

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for clip in clips:
            zf.write(clip, arcname=clip.name)

    buffer.seek(0)
    return send_file(
        buffer,
        mimetype="application/zip",
        as_attachment=True,
        download_name="clips.zip",
    )


@download_bp.route("/export/<filename>")
def export(filename):
    """
    Re-encode a clip / final video at the requested quality preset.
    ?quality=360p|720p|1080p|original
    """
    filename = Path(filename).name
    quality_key = request.args.get("quality", config.DEFAULT_QUALITY)

    preset = config.QUALITY_PRESETS.get(
        quality_key,
        config.QUALITY_PRESETS[config.DEFAULT_QUALITY]
    )
    label, max_w, max_h, bitrate = preset

    # Locate the source file (clips dir first, then final dir)
    source = config.CLIPS_DIR / filename
    base_dir = config.CLIPS_DIR
    if not source.exists():
        source = config.FINAL_DIR / filename
        base_dir = config.FINAL_DIR

    if not source.exists():
        return jsonify({"success": False, "error": "File not found"}), 404

    # If original quality, just send the file directly.
    if max_w is None or max_h is None:
        return safe_send(base_dir, filename)

    output_buffer = io.BytesIO()
    output_path = config.OUTPUT_DIR / f"_export_{filename}"

    command = [
        config.FFMPEG_PATH,
        "-y",
        "-i", str(source),
        "-vf", f"scale={max_w}:{max_h}:force_original_aspect_ratio=decrease",
        "-c:v", config.VIDEO_CODEC,
        "-preset", "veryfast",
        "-crf", "23",
        "-c:a", config.AUDIO_CODEC,
        str(output_path),
    ]

    # Add bitrate cap if provided
    if bitrate:
        command.insert(-1, "-b:v")
        command.insert(-1, bitrate)

    try:
        subprocess.run(
            command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )
        if not output_path.exists():
            return jsonify({"success": False, "error": "Export failed"}), 500

        # Stream the generated file back and clean it up.
        result = send_file(
            str(output_path),
            mimetype="video/mp4",
            as_attachment=True,
            download_name=f"{Path(filename).stem}_{label}.mp4",
        )
        try:
            output_path.unlink()
        except Exception:
            pass
        return result
    except subprocess.CalledProcessError:
        try:
            output_path.unlink()
        except Exception:
            pass
        return jsonify({"success": False, "error": "Export failed"}), 500


def _is_valid_youtube_url(value):
    if not value or not isinstance(value, str):
        return False
    cleaned = value.strip()
    if not cleaned:
        return False
    try:
        parsed = urlparse(cleaned)
        host = (parsed.netloc or "").lower()
        path = (parsed.path or "").lower()
        return (
            "youtube.com" in host or "youtu.be" in host or "youtube-nocookie.com" in host
        ) and ("watch" in path or "shorts" in path or "embed" in path or "playlist" in path or path != "")
    except Exception:
        return False


def _find_downloaded_file(directory: Path, preferred_name: str | None = None) -> Path | None:
    """Find the newest downloaded file, even when yt-dlp sanitizes the title."""
    if not directory.exists():
        return None

    files = [
        p for p in directory.iterdir()
        if p.is_file() and p.suffix.lower() in {".mp4", ".webm", ".mkv", ".avi", ".mov", ".m4a", ".mp3", ".wav", ".flv"}
    ]
    if not files:
        return None

    if preferred_name:
        safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", preferred_name).strip("._") or "youtube_video"
        match = next((p for p in files if p.name.startswith(f"{safe_name}.") or p.stem == safe_name), None)
        if match:
            return match

    return max(files, key=lambda p: p.stat().st_mtime)


def _format_size(size_bytes):
    """Format file size in human-readable form."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"


@download_bp.route("/youtube", methods=["POST"])
def download_youtube_video():
    """Download a YouTube video to the input folder for later processing."""
    payload = request.get_json(silent=True) or {}
    url = payload.get("url", "").strip()
    fmt = payload.get("format", "video")  # "video" or "audio"
    quality = payload.get("quality", "best")  # "best", "1080p", "720p", "480p", "360p"

    if not _is_valid_youtube_url(url):
        return jsonify({"success": False, "error": "Please provide a valid YouTube URL."}), 400

    if yt_dlp is None:
        return jsonify({"success": False, "error": "YouTube downloader is not installed."}), 500

    config.INPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_template = str(config.INPUT_DIR / "%(title)s.%(ext)s")

    # Build format selection based on user choice
    if fmt == "audio":
        format_selector = "bestaudio/best"
        postprocessors = [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }]
        merge_format = None
    else:
        # Video format based on quality - prefer combined MP4 to avoid merge issues
        quality_map = {
            "best": "best[ext=mp4]/best[height<=1080]/best[height<=720]/best[height<=480]/best[height<=360]/best",
            "1080p": "best[height<=1080]/best[height<=720]/best[height<=480]/best[height<=360]/best",
            "720p": "best[height<=720]/best[height<=480]/best[height<=360]/best",
            "480p": "best[height<=480]/best[height<=360]/best",
            "360p": "best[height<=360]/best",
        }
        format_selector = quality_map.get(quality, quality_map["best"])
        postprocessors = []
        merge_format = "mp4"

    ydl_opts = {
        "outtmpl": output_template,
        "format": format_selector,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "merge_output_format": merge_format,
        "restrictfilenames": False,
        "postprocessors": postprocessors,
        "format_sort": ["res:1080", "res:720", "res:480", "res:360"],
        "format_sort_force": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
        title = (info or {}).get("title", "youtube_video")
        match = _find_downloaded_file(config.INPUT_DIR, title)
        if not match:
            return jsonify({"success": False, "error": "Download completed but no file was created."}), 500
        return jsonify({
            "success": True,
            "message": "Download completed successfully.",
            "filename": match.name,
            "path": f"/download/input/{match.name}",
            "size": _format_size(match.stat().st_size),
            "format": fmt,
            "quality": quality,
        })
    except Exception as exc:
        return jsonify({"success": False, "error": f"Download failed: {exc}"}), 500


@download_bp.route("/list")
def list_files():
    """List all available generated outputs."""
    data = {
        "input": [p.name for p in config.INPUT_DIR.glob("*") if p.is_file()],
        "thumbnails": [p.name for p in config.THUMBNAIL_DIR.glob("*") if p.is_file()],
        "final": [p.name for p in config.FINAL_DIR.glob("*") if p.is_file()],
        "subtitles": [p.name for p in config.SUBTITLE_DIR.glob("*") if p.is_file()],
        "transcripts": [p.name for p in config.TRANSCRIPT_DIR.glob("*") if p.is_file()],
        "clips": [p.name for p in config.CLIPS_DIR.glob("*") if p.is_file()],
    }
    return jsonify({"success": True, "files": data})


@download_bp.route("/downloaded")
def list_downloaded():
    """List all downloaded YouTube videos with metadata."""
    config.INPUT_DIR.mkdir(parents=True, exist_ok=True)
    video_exts = {".mp4", ".webm", ".mkv", ".avi", ".mov", ".m4a", ".mp3", ".wav", ".flv"}
    files = []
    for p in sorted(config.INPUT_DIR.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if p.is_file() and p.suffix.lower() in video_exts:
            stat = p.stat()
            files.append({
                "name": p.name,
                "size": _format_size(stat.st_size),
                "size_bytes": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M"),
                "path": f"/download/input/{p.name}",
                "stream_path": f"/download/input/stream/{p.name}",
                "is_audio": p.suffix.lower() in {".mp3", ".wav", ".m4a"},
            })
    return jsonify({"success": True, "files": files})


@download_bp.route("/input/stream/<filename>")
def input_stream(filename):
    """Stream a downloaded input file for in-browser preview."""
    filename = Path(filename).name
    file_path = config.INPUT_DIR / filename
    if not file_path.exists():
        return jsonify({"success": False, "error": "File not found"}), 404
    return send_from_directory(str(config.INPUT_DIR), filename, as_attachment=False)


@download_bp.route("/delete", methods=["POST"])
def delete_downloaded():
    """Delete a downloaded file from the input directory."""
    payload = request.get_json(silent=True) or {}
    filename = Path(payload.get("filename", "")).name
    if not filename:
        return jsonify({"success": False, "error": "No filename provided"}), 400

    file_path = config.INPUT_DIR / filename
    if not file_path.exists():
        return jsonify({"success": False, "error": "File not found"}), 404

    try:
        file_path.unlink()
        return jsonify({"success": True, "message": f"Deleted {filename}"})
    except Exception as exc:
        return jsonify({"success": False, "error": f"Delete failed: {exc}"}), 500


@download_bp.route("/delete-all", methods=["POST"])
def delete_all_downloads():
    """Delete all downloaded media in the input directory."""
    try:
        deleted = []
        for item in sorted(config.INPUT_DIR.iterdir(), key=lambda p: p.name):
            if item.is_file():
                item.unlink()
                deleted.append(item.name)
        return jsonify({"success": True, "deleted": deleted, "count": len(deleted)})
    except Exception as exc:
        return jsonify({"success": False, "error": f"Delete all failed: {exc}"}), 500


@download_bp.route("/rename", methods=["POST"])
def rename_downloaded():
    """Rename a downloaded file in the input directory."""
    payload = request.get_json(silent=True) or {}
    old_name = Path(payload.get("old_name", "")).name
    new_name = Path(payload.get("new_name", "")).name

    if not old_name or not new_name:
        return jsonify({"success": False, "error": "Both old and new names required"}), 400

    # Sanitize new name
    new_name = re.sub(r"[^A-Za-z0-9._-]+", "_", new_name).strip("._")
    if not new_name:
        return jsonify({"success": False, "error": "Invalid new name"}), 400

    # Preserve extension
    old_ext = Path(old_name).suffix
    if not Path(new_name).suffix:
        new_name += old_ext

    old_path = config.INPUT_DIR / old_name
    new_path = config.INPUT_DIR / new_name

    if not old_path.exists():
        return jsonify({"success": False, "error": "File not found"}), 404
    if new_path.exists():
        return jsonify({"success": False, "error": "A file with that name already exists"}), 400

    try:
        old_path.rename(new_path)
        return jsonify({
            "success": True,
            "message": f"Renamed to {new_name}",
            "filename": new_name,
            "path": f"/download/input/{new_name}",
        })
    except Exception as exc:
        return jsonify({"success": False, "error": f"Rename failed: {exc}"}), 500


@download_bp.route("/open-folder")
def open_folder():
    """Open the input folder in the system file explorer."""
    try:
        folder = str(config.INPUT_DIR)
        if os.name == "nt":  # Windows
            os.startfile(folder)  # type: ignore
        elif os.name == "posix":  # macOS/Linux
            if sys.platform == "darwin":
                subprocess.Popen(["open", folder])
            else:
                subprocess.Popen(["xdg-open", folder])
        return jsonify({"success": True, "message": "Folder opened in file explorer"})
    except Exception as exc:
        return jsonify({"success": False, "error": f"Could not open folder: {exc}"}), 500
