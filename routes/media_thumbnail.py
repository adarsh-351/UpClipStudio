import os
from flask import Blueprint, jsonify, current_app
from utils.video_utils import VideoLoader

media_thumbnail_bp = Blueprint('media_thumbnail', __name__)

@media_thumbnail_bp.route('/api/thumbnail/<path:media_path>')
def get_thumbnail(media_path):
    """Generate (or retrieve cached) thumbnail for a media file.
    `media_path` is relative to the project's media directory.
    Returns JSON with URL to the thumbnail image.
    """
    # Resolve absolute media path
    media_root = current_app.config.get('MEDIA_ROOT', '')
    media_abs_path = os.path.abspath(os.path.join(media_root, media_path))
    if not os.path.isfile(media_abs_path):
        return jsonify({"error": "Media not found"}), 404

    # Ensure thumbnail cache directory exists inside static folder
    static_folder = current_app.static_folder or "static"
    thumb_dir = os.path.join(static_folder, 'cache', 'thumbnails')
    os.makedirs(thumb_dir, exist_ok=True)

    # Thumbnail filename based on media filename
    base_name = os.path.splitext(os.path.basename(media_abs_path))[0]
    thumb_path = os.path.join(thumb_dir, f"{base_name}_thumb.png")

    # Generate thumbnail if not cached
    if not os.path.isfile(thumb_path):
        loader = VideoLoader(media_abs_path)
        loader.thumbnail(thumb_path)  # uses existing thumbnail helper (captures first frame)
        loader.close()

    thumb_url = f"/static/cache/thumbnails/{base_name}_thumb.png"
    return jsonify({"thumbUrl": thumb_url})
