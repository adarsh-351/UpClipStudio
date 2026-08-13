"""Upload route - handles video upload and metadata extraction."""

import config
from pathlib import Path

from flask import Blueprint, request, jsonify

from utils.video_utils import VideoLoader

upload_bp = Blueprint("upload", __name__, url_prefix="/upload")


@upload_bp.route("/video", methods=["POST"])
def upload_video():
    """Accept an uploaded video, save it, extract metadata and thumbnail."""

    if "video" not in request.files:
        return jsonify({"success": False, "error": "No video file provided"}), 400

    file = request.files["video"]

    if file.filename == "":
        return jsonify({"success": False, "error": "Empty filename"}), 400

    # Sanitize filename
    filename = Path(file.filename).name

    # Save to input directory
    config.INPUT_DIR.mkdir(parents=True, exist_ok=True)
    save_path = config.INPUT_DIR / filename

    file.save(str(save_path))

    # Extract metadata
    try:
        loader = VideoLoader(save_path)
        info = loader.metadata()

        # Generate thumbnail
        config.THUMBNAIL_DIR.mkdir(parents=True, exist_ok=True)
        thumb_path = config.THUMBNAIL_DIR / f"{Path(filename).stem}_thumb.jpg"
        loader.thumbnail(thumb_path)
        loader.close()

        return jsonify({
            "success": True,
            "filename": filename,
            "metadata": info,
            "thumbnail": f"/download/thumbnail/{Path(filename).stem}_thumb.jpg",
            "video_url": f"/download/input/{filename}"
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500
