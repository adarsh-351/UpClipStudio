"""YouTube Automation routes - OAuth, channel management, upload, metadata, queue."""

import os
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
import json
import config
import time
import sqlite3
import base64
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, List

from flask import Blueprint, request, jsonify, session, current_app, url_for
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from flask import current_app as _app

# ---------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "youtube.db"

# YouTube API scopes
YOUTUBE_SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube",
]

# OAuth configuration
OAUTH_CLIENT_SECRETS = BASE_DIR / "oauth_client_secrets.json"

# YouTube API constants
YOUTUBE_API_SERVICE_NAME = "youtube"
YOUTUBE_API_VERSION = "v3"

# ---------------------------------------------------------------
# Flask Blueprint
# ---------------------------------------------------------------

youtube_bp = Blueprint("youtube", __name__, url_prefix="/youtube")

# ---------------------------------------------------------------
# Database helper
# ---------------------------------------------------------------


def get_db():
    """Get a database connection, initializing if needed."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    # Create tables if not exist
    conn.execute("""
        CREATE TABLE IF NOT EXISTS tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL DEFAULT 'default',
            channel_id TEXT,
            channel_name TEXT,
            channel_avatar TEXT,
            access_token TEXT NOT NULL,
            refresh_token TEXT,
            expires_at INTEGER,
            created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
            updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            youtube_video_id TEXT,
            title TEXT,
            description TEXT,
            tags TEXT,
            category_id TEXT,
            visibility TEXT,
            status TEXT DEFAULT "queued",
            progress INTEGER DEFAULT 0,
            scheduled_at INTEGER,
            published_at INTEGER,
            file_size INTEGER,
            duration REAL,
            resolution TEXT,
            fps INTEGER,
            aspect_ratio TEXT,
            created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
            updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id INTEGER,
            youtube_video_id TEXT,
            title TEXT,
            description TEXT,
            scheduled_at INTEGER NOT NULL,
            timezone TEXT DEFAULT "UTC",
            status DEFAULT "scheduled",
            created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
            FOREIGN KEY (video_id) REFERENCES videos (id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id INTEGER,
            youtube_video_id TEXT,
            title TEXT,
            description TEXT,
            visibility TEXT,
            published_at INTEGER,
            view_count INTEGER DEFAULT 0,
            like_count INTEGER DEFAULT 0,
            comment_count INTEGER DEFAULT 0,
            watch_time_seconds INTEGER DEFAULT 0,
            status TEXT DEFAULT "published",
            created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
            FOREIGN KEY (video_id) REFERENCES videos (id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            thumbnail TEXT,
            channel_id TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            title_pattern TEXT,
            description TEXT,
            tags TEXT,
            category_id TEXT,
            language TEXT,
            visibility TEXT,
            playlist_id INTEGER,
            schedule_rule TEXT,
            created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
            updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS automation_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            when_condition TEXT,
            if_condition TEXT,
            then_action TEXT,
            created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS upload_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id INTEGER,
            title TEXT,
            description TEXT,
            tags TEXT,
            category_id TEXT,
            visibility TEXT,
            scheduled_at INTEGER,
            status DEFAULT "queued",
            progress INTEGER DEFAULT 0,
            error_message TEXT,
            retry_count INTEGER DEFAULT 0,
            max_retries INTEGER DEFAULT 3,
            created_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
            updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER)),
            FOREIGN KEY (video_id) REFERENCES videos (id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS watch_folder (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            folder_path TEXT,
            connected INTEGER DEFAULT 0,
            last_checked INTEGER
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS naming_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            pattern TEXT,
            description TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at INTEGER DEFAULT (CAST(strftime('%s', 'now') AS INTEGER))
        )
    """)
    conn.commit()
    return conn


def init_db():
    """Initialize the database."""
    conn = get_db()
    conn.close()


# ---------------------------------------------------------------
# OAuth helpers
# ---------------------------------------------------------------


def get_flow() -> Flow:
    """Create an OAuth flow instance."""
    if not OAUTH_CLIENT_SECRETS.exists():
        raise FileNotFoundError(
            f"OAuth client secrets not found at {OAUTH_CLIENT_SECRETS}"
        )

    flow = Flow.from_client_secrets_file(
        str(OAUTH_CLIENT_SECRETS),
        scopes=YOUTUBE_SCOPES,
    )

    flow.redirect_uri = _app.config.get(
        "YOUTUBE_OAUTH_REDIRECT_URI",
        "http://127.0.0.1:5000/youtube/callback"
    )

    return flow


def credentials_to_dict(credentials: Credentials) -> Dict[str, Any]:
    """Convert Credentials object to a dictionary for storage."""
    return {
        "token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "scopes": credentials.scopes,
    }


def dict_to_credentials(d: Dict[str, Any]) -> Credentials:
    """Convert stored database credentials to Google Credentials."""
    client_config = json.loads(OAUTH_CLIENT_SECRETS.read_text(encoding="utf-8"))
    installed = client_config.get("installed") or client_config.get("web")

    if not installed:
        raise RuntimeError(
            "Invalid OAuth client secrets file: missing 'installed' or 'web' configuration."
        )

    return Credentials(
        token=d["access_token"],
        refresh_token=d.get("refresh_token"),
        token_uri=installed["token_uri"],
        client_id=installed["client_id"],
        client_secret=installed.get("client_secret"),
        scopes=YOUTUBE_SCOPES,
    )


# ---------------------------------------------------------------
# Token management (single channel, default user)
# ---------------------------------------------------------------


def get_credentials() -> Optional[Credentials]:
    """Get stored credentials from the database."""
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM tokens WHERE user_id = 'default' ORDER BY id DESC LIMIT 1"
    ).fetchone()
    conn.close()
    if row and row["access_token"]:
        return dict_to_credentials(dict(row))
    return None


def save_credentials(credentials: Credentials):
    """Save credentials to the database."""
    conn = get_db()
    access_expires = (
        int(credentials.expiry.timestamp())
        if credentials.expiry
        else int(time.time()) + 3600
    )
    conn.execute(
        """
        INSERT OR REPLACE INTO tokens (user_id, channel_id, channel_name, channel_avatar,
                                       access_token, refresh_token, expires_at)
        VALUES ('default', ?, ?, ?, ?, ?, ?)
    """,
        (
            credentials.id_token.get("sub") if credentials.id_token else None,
            credentials.id_token.get("name") if credentials.id_token else None,
            credentials.id_token.get("picture") if credentials.id_token else None,
            credentials.token,
            credentials.refresh_token,
            access_expires,
        ),
    )
    conn.commit()
    conn.close()


# ---------------------------------------------------------------
# YouTube API helper
# ---------------------------------------------------------------


def get_youtube_service():
    """Build and return a YouTube API service object."""
    credentials = get_credentials()
    if not credentials:
        raise RuntimeError("No YouTube credentials found. Connect your channel first.")

    # Refresh if needed
    if credentials.expired and credentials.refresh_token:
        from google.auth.transport.requests import Request
        credentials.refresh(Request())
        save_credentials(credentials)

    return build(
        YOUTUBE_API_SERVICE_NAME,
        YOUTUBE_API_VERSION,
        credentials=credentials,
        static_discovery=False,
    )


# ---------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------


@youtube_bp.route("/connect", methods=["GET"])
def connect():
    """Initiate OAuth 2.0 flow."""
    try:
        flow = get_flow()

        authorization_url, state = flow.authorization_url(
            access_type="offline",
            prompt="consent",
            code_challenge_method="S256",
        )

        session["oauth_state"] = state
        session["oauth_code_verifier"] = flow.code_verifier

        return jsonify({
            "success": True,
            "authorization_url": authorization_url,
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@youtube_bp.route("/callback", methods=["GET"])
def callback():
    """Handle OAuth 2.0 callback."""
    try:
        state = session.get("oauth_state")
        code_verifier = session.get("oauth_code_verifier")

        if not state:
            return jsonify({
                "success": False,
                "error": "OAuth state missing or expired. Please reconnect YouTube."
            }), 400

        if not code_verifier:
            return jsonify({
                "success": False,
                "error": "OAuth code verifier missing. Please restart YouTube connection."
            }), 400

        flow = get_flow()

        flow.fetch_token(
            authorization_response=request.url,
            code_verifier=code_verifier,
        )

        session.pop("oauth_state", None)
        session.pop("oauth_code_verifier", None)

        credentials = flow.credentials
        save_credentials(credentials)

        # बाकी तुम्हारा existing code...

        # Get channel info
        youtube = get_youtube_service()
        channels_response = youtube.channels().list(
            part="snippet,contentDetails,statistics",
            mine=True,
        ).execute()

        if not channels_response.get("items"):
            return jsonify({"success": False, "error": "No channel found"}), 404

        channel = channels_response["items"][0]
        channel_id = channel["id"]
        channel_title = channel["snippet"]["title"]
        channel_avatar = channel["snippet"]["thumbnails"]["high"]["url"]

        # Update tokens with channel info
        conn = get_db()
        conn.execute(
            """
            UPDATE tokens SET channel_id = ?, channel_name = ?, channel_avatar = ?,
                               updated_at = CAST(strftime('%s', 'now') AS INTEGER)
            WHERE user_id = 'default'
        """,
            (channel_id, channel_title, channel_avatar),
        )
        conn.commit()
        conn.close()

        return jsonify({
            "success": True,
            "connected": True,
            "channel_id": channel_id,
            "channel_name": channel_title,
            "channel_avatar": channel_avatar,
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@youtube_bp.route("/status", methods=["GET"])
def status():
    """Check YouTube connection status."""
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM tokens WHERE user_id = 'default' ORDER BY id DESC LIMIT 1"
    ).fetchone()
    conn.close()

    if not row or not row["access_token"]:
        return jsonify({"connected": False})

    return jsonify({
        "connected": True,
        "channel_id": row["channel_id"],
        "channel_name": row["channel_name"],
        "channel_avatar": row["channel_avatar"],
    })


@youtube_bp.route("/disconnect", methods=["POST"])
def disconnect():
    """Disconnect YouTube channel."""
    conn = get_db()
    conn.execute("DELETE FROM tokens WHERE user_id = 'default'")
    conn.commit()
    conn.close()

    return jsonify({"success": True, "connected": False})


# ---------------------------------------------------------------
# Video metadata and import
# ---------------------------------------------------------------


@youtube_bp.route("/metadata", methods=["GET"])
def get_metadata():
    """Get video metadata from the database by id or filename."""
    video_id = request.args.get("id")
    filename = request.args.get("filename")
    conn = get_db()

    if video_id:
        row = conn.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()
    elif filename:
        row = conn.execute(
            "SELECT * FROM videos WHERE filename = ? ORDER BY created_at DESC LIMIT 1",
            (Path(filename).name,),
        ).fetchone()
    else:
        conn.close()
        return jsonify({"success": False, "error": "Video ID or filename required"}), 400

    conn.close()

    if not row:
        return jsonify({"success": False, "error": "Video not found"}), 404

    result = dict(row)
    # If tags is a JSON string, parse it
    if result.get("tags"):
        try:
            result["tags"] = json.loads(result["tags"])
        except (json.JSONDecodeError, TypeError):
            result["tags"] = []
    else:
        result["tags"] = []

    # Resolve the actual on-disk path
    video_path = config.INPUT_DIR / result["filename"]
    if video_path.exists():
        result["path"] = str(video_path)
        result["video_url"] = f"/download/input/{result['filename']}"
        # Generate thumbnail if missing
        thumb_name = f"{Path(result['filename']).stem}_thumb.jpg"
        thumb_path = config.THUMBNAIL_DIR / thumb_name
        if not thumb_path.exists():
            try:
                from utils.video_utils import VideoLoader
                loader = VideoLoader(video_path)
                loader.thumbnail(thumb_path)
                loader.close()
            except Exception:
                pass
        if thumb_path.exists():
            result["thumbnail"] = f"/download/thumbnail/{thumb_name}"
    else:
        result["path"] = None

    return jsonify({"success": True, "metadata": result})


@youtube_bp.route("/import", methods=["POST"])
def import_video():
    """Import a video file that already exists locally (e.g. from a download, clip, or upload).

    Accepts either a multipart/form-data file upload or a JSON body with a filename
    referencing an existing file in the input directory. Creates a DB record and returns
    its numeric id so subsequent upload/schedule operations can reference it.
    Does NOT copy the file if it already lives in the input directory — it reuses the
    existing path to avoid unnecessary duplicates.
    """
    config.INPUT_DIR.mkdir(parents=True, exist_ok=True)
    config.THUMBNAIL_DIR.mkdir(parents=True, exist_ok=True)

    # --- Case 1: multipart file upload (drag & drop or file picker) ---
    if "video" in request.files:
        file = request.files["video"]
        if not file or file.filename == "":
            return jsonify({
                "success": False,
                "error": "Please drop a video file or choose one from your device."
            }), 400

        filename = Path(file.filename).name

        # Validate video extension
        ext = Path(filename).suffix.lower()
        if ext not in {".mp4", ".mov", ".webm", ".mkv", ".avi"}:
            return jsonify({
                "success": False,
                "error": "This video format isn't supported. Please choose MP4, MOV, WebM, MKV, or AVI."
            }), 400

        save_path = config.INPUT_DIR / filename

        # Avoid duplicate: if a file with the same name already exists, reuse it
        # instead of overwriting (preserves the original source file).
        if not save_path.exists():
            file.save(str(save_path))

        # Extract metadata & thumbnail
        metadata = _extract_video_metadata(save_path)
        thumb_url = _ensure_thumbnail(save_path, metadata)

        video_id = _insert_video_record(filename, metadata)
        return jsonify({
            "success": True,
            "video_id": video_id,
            "filename": filename,
            "metadata": metadata,
            "thumbnail": thumb_url,
            "video_url": f"/download/input/{filename}",
        })

    # --- Case 2: JSON body referencing an existing local file ---
    data = request.get_json(silent=True) or {}
    filename = data.get("filename", "").strip()

    if not filename:
        return jsonify({
            "success": False,
            "error": "No video file provided. Please drop a video file or choose one from your device."
        }), 400

    filename = Path(filename).name
    video_path = config.INPUT_DIR / filename

    if not video_path.exists():
        # Also check clips and final output dirs
        for check_dir in [config.CLIPS_DIR, config.FINAL_DIR]:
            candidate = check_dir / filename
            if candidate.exists():
                video_path = candidate
                break

    if not video_path.exists():
        return jsonify({
            "success": False,
            "error": "The selected video file could not be found on disk."
        }), 404

    metadata = _extract_video_metadata(video_path)
    thumb_url = _ensure_thumbnail(video_path, metadata)

    video_id = _insert_video_record(filename, metadata)
    return jsonify({
        "success": True,
        "video_id": video_id,
        "filename": filename,
        "metadata": metadata,
        "thumbnail": thumb_url,
        "video_url": f"/download/input/{filename}",
        "path": str(video_path),
    })


def _extract_video_metadata(video_path):
    """Extract metadata from a video file. Returns a dict, never raises."""
    metadata = {}
    try:
        from utils.video_utils import VideoLoader
        loader = VideoLoader(video_path)
        metadata = loader.metadata()
        loader.close()
    except Exception:
        metadata = {
            "filename": video_path.name,
            "width": None,
            "height": None,
            "fps": None,
            "duration": None,
            "size_bytes": video_path.stat().st_size if video_path.exists() else 0,
        }
    return metadata


def _ensure_thumbnail(video_path, metadata):
    """Return a thumbnail URL, regenerating the thumbnail if it doesn't exist yet."""
    stem = Path(video_path.name).stem
    thumb_name = f"{stem}_thumb.jpg"
    thumb_path = config.THUMBNAIL_DIR / thumb_name
    if not thumb_path.exists():
        try:
            from utils.video_utils import VideoLoader
            loader = VideoLoader(video_path)
            loader.thumbnail(thumb_path)
            loader.close()
        except Exception:
            pass
    if thumb_path.exists():
        return f"/download/thumbnail/{thumb_name}"
    # Fallback: use the metadata thumbnail if the upload returned one
    if metadata and metadata.get("thumbnail"):
        return metadata["thumbnail"]
    return None


def _insert_video_record(filename, metadata):
    """Insert (or update) a videos table row. Reuse existing record if filename matches."""
    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM videos WHERE filename = ? ORDER BY created_at DESC LIMIT 1",
        (filename,),
    ).fetchone()

    if existing:
        video_id = existing["id"]
    else:
        row = conn.execute(
            """
            INSERT INTO videos (filename, title, description, tags, category_id,
                               visibility, duration, resolution, fps, aspect_ratio, file_size)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                filename,
                metadata.get("filename", filename),
                "",
                json.dumps([]),
                None,
                "public",
                metadata.get("duration"),
                metadata.get("resolution"),
                metadata.get("fps"),
                metadata.get("aspect_ratio"),
                metadata.get("size_bytes"),
            ),
        )
        video_id = row.lastrowid

    conn.commit()
    conn.close()
    return video_id


@youtube_bp.route("/videos", methods=["POST"])
def create_video():
    """Create a new video entry in the queue (from JSON metadata only)."""
    data = request.get_json() or {}
    filename = data.get("filename", "")

    conn = get_db()
    # Check if a record already exists for this filename (avoid duplicates)
    existing = conn.execute(
        "SELECT id FROM videos WHERE filename = ? ORDER BY created_at DESC LIMIT 1",
        (filename,),
    ).fetchone()

    if existing:
        video_id = existing["id"]
        conn.close()
        return jsonify({"success": True, "video_id": video_id, "metadata": {}})

    # Check if file exists locally
    video_path = BASE_DIR / "input" / filename
    metadata = {}

    if video_path.exists():
        metadata = _extract_video_metadata(video_path)

    video_id = _insert_video_record(filename, metadata)
    conn.close()

    return jsonify({"success": True, "video_id": video_id, "metadata": metadata})


@youtube_bp.route("/videos", methods=["GET"])
def list_videos():
    """List all videos in the queue."""
    conn = get_db()
    rows = conn.execute("SELECT * FROM videos ORDER BY created_at DESC").fetchall()
    conn.close()
    videos = []
    for row in rows:
        d = dict(row)
        if d.get("tags"):
            try:
                d["tags"] = json.loads(d["tags"])
            except (json.JSONDecodeError, TypeError):
                d["tags"] = []
        else:
            d["tags"] = []
        # Resolve on-disk path and generate thumbnail if needed
        filename = d.get("filename", "")
        video_path = config.INPUT_DIR / filename
        if not video_path.exists():
            video_path = config.CLIPS_DIR / filename
        if not video_path.exists():
            video_path = config.FINAL_DIR / filename
        if video_path.exists():
            d["path"] = str(video_path)
            d["video_url"] = f"/download/input/{filename}"
            thumb_name = f"{Path(filename).stem}_thumb.jpg"
            thumb_path = config.THUMBNAIL_DIR / thumb_name
            if thumb_path.exists():
                d["thumbnail"] = f"/download/thumbnail/{thumb_name}"
            else:
                # Try to generate thumbnail
                try:
                    from utils.video_utils import VideoLoader
                    loader = VideoLoader(video_path)
                    loader.thumbnail(thumb_path)
                    loader.close()
                    if thumb_path.exists():
                        d["thumbnail"] = f"/download/thumbnail/{thumb_name}"
                except Exception:
                    pass
        videos.append(d)
    return jsonify({"success": True, "videos": videos})


@youtube_bp.route("/scan", methods=["GET"])
def scan_videos():
    """Scan all video source directories and return a unified list of available videos."""
    video_exts = {".mp4", ".webm", ".mkv", ".avi", ".mov"}
    sources = {
        "local_upload": config.INPUT_DIR,
        "yt_downloader": config.INPUT_DIR,
        "clip_cutter": config.CLIPS_DIR,
        "caption_studio": config.FINAL_DIR,
        "processed": config.FINAL_DIR,
    }
    seen = set()
    items = []
    for source, directory in sources.items():
        if not directory.exists():
            continue
        for p in sorted(directory.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
            if p.is_file() and p.suffix.lower() in video_exts:
                if p.name in seen:
                    continue
                seen.add(p.name)
                stat = p.stat()
                ext = p.suffix.lower().lstrip(".")
                # Determine the download/stream URL based on which directory the file is in
                if directory == config.INPUT_DIR:
                    video_url = f"/download/input/{p.name}"
                    stream_url = f"/download/input/stream/{p.name}"
                elif directory == config.CLIPS_DIR:
                    video_url = f"/download/clip/{p.name}"
                    stream_url = f"/download/clip/stream/{p.name}"
                else:
                    video_url = f"/download/final/{p.name}"
                    stream_url = f"/download/final/{p.name}"
                thumb_name = f"{p.stem}_thumb.jpg"
                thumb_path = config.THUMBNAIL_DIR / thumb_name
                thumbnail = f"/download/thumbnail/{thumb_name}" if thumb_path.exists() else None
                items.append({
                    "filename": p.name,
                    "source": source,
                    "video_url": video_url,
                    "stream_url": stream_url,
                    "size": stat.st_size,
                    "size_formatted": _format_file_size(stat.st_size),
                    "modified": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M"),
                    "extension": ext,
                    "thumbnail": thumbnail,
                })
    return jsonify({"success": True, "videos": items})


def _format_file_size(size_bytes):
    """Format file size in human-readable form."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"


@youtube_bp.route("/videos/<int:video_id>", methods=["PUT"])
def update_video(video_id: int):
    """Update video metadata."""
    data = request.get_json() or {}
    conn = get_db()

    update_fields = []
    params = []

    for field in ["title", "description", "tags", "category_id", "visibility"]:
        if field in data:
            update_fields.append(f"{field} = ?")
            params.append(data[field])

    if not update_fields:
        return jsonify({"success": False, "error": "No fields to update"}), 400

    update_fields.append("updated_at = CAST(strftime('%s', 'now') AS INTEGER)")
    params.append(video_id)

    conn.execute(
        f"UPDATE videos SET {', '.join(update_fields)} WHERE id = ?",
        params,
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True})


# ---------------------------------------------------------------
# Upload endpoints
# ---------------------------------------------------------------


@youtube_bp.route("/upload/start", methods=["POST"])
def upload_start():
    """Start a resumable upload to YouTube."""
    data = request.get_json() or {}
    video_id = data.get("video_id")

    conn = get_db()
    video_row = conn.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()

    if not video_row:
        conn.close()
        return jsonify({"success": False, "error": "Video not found"}), 404

    try:
        youtube = get_youtube_service()

        # Get video file path — check input, clips, and final directories
        filename = video_row["filename"]
        video_path = config.INPUT_DIR / filename
        if not video_path.exists():
            video_path = config.CLIPS_DIR / filename
        if not video_path.exists():
            video_path = config.FINAL_DIR / filename
        if not video_path.exists():
            conn.close()
            return jsonify({"success": False, "error": "Video file not found"}), 404

        # Get metadata
        title = video_row["title"] or video_row["filename"]
        description = video_row["description"] or ""
        tags = json.loads(video_row["tags"]) if video_row["tags"] else []
        category_id = video_row["category_id"] or "22"  # People & Blogs default
        visibility = video_row["visibility"] or "public"

        # Build body
        body = {
            "snippet": {
                "title": title,
                "description": description,
                "tags": tags[:5] if tags else [],  # YouTube allows max 5 tags in snippet
                "categoryId": category_id,
            },
            "status": {
                "privacyStatus": visibility,
            },
        }

        # Resumable upload
        media = MediaFileUpload(
            str(video_path),
            resumable=True,
            chunksize=1024 * 1024 * 5,  # 5MB chunks
        )

        insert_request = youtube.videos().insert(
            part="snippet,status",
            body=body,
            media_body=media,
        )

        # Return upload URL info
        return jsonify({
            "success": True,
            "upload_url": insert_request.resumable_url,
            "video_id": video_id,
            "title": title,
            "visibility": visibility,
            "filename": filename,
            "video_path": str(video_path),
        })

    except Exception as e:
        conn.close()
        return jsonify({"success": False, "error": str(e)}), 500


@youtube_bp.route("/upload/execute", methods=["POST"])
def upload_execute():
    """Execute the actual YouTube upload to completion in a background thread.

    Accepts a DB video_id (from the videos table) and uses the stored metadata
    (title, description, tags, category, visibility).  Progress is tracked
    via the upload_queue table so the frontend can poll it.
    """
    data = request.get_json() or {}
    video_id = data.get("video_id")

    if not video_id:
        return jsonify({"success": False, "error": "video_id required"}), 400

    conn = get_db()
    video_row = conn.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()
    if not video_row:
        conn.close()
        return jsonify({"success": False, "error": "Video not found"}), 404

    # Insert a queue row so progress can be polled
    title = video_row["title"] or video_row["filename"]
    description = video_row["description"] or ""
    tags = video_row["tags"] or json.dumps([])
    category_id = video_row["category_id"] or "22"
    visibility = video_row["visibility"] or "public"
    scheduled_at = data.get("scheduled_at")

    cursor = conn.execute(
        """
        INSERT INTO upload_queue (video_id, title, description, tags, category_id,
                                  visibility, scheduled_at, status, retry_count, max_retries)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'uploading', 0, 3)
        """,
        (video_id, title, description, tags, category_id, visibility, scheduled_at),
    )
    queue_id = cursor.lastrowid
    conn.commit()
    conn.close()

    # Resolve file path (check input, clips, final dirs)
    filename = video_row["filename"]
    video_path = config.INPUT_DIR / filename
    if not video_path.exists():
        video_path = config.CLIPS_DIR / filename
    if not video_path.exists():
        video_path = config.FINAL_DIR / filename
    if not video_path.exists():
        conn = get_db()
        conn.execute("UPDATE upload_queue SET status = 'failed', error_message = 'Video file not found' WHERE id = ?", (queue_id,))
        conn.commit()
        conn.close()
        return jsonify({"success": False, "error": "Video file not found"}), 404

    def _do_upload():
        try:
            youtube = get_youtube_service()

            media = MediaFileUpload(
                str(video_path),
                resumable=True,
                chunksize=1024 * 1024 * 5,
            )
            body = {
                "snippet": {
                    "title": title,
                    "description": description,
                    "tags": json.loads(tags)[:5] if tags else [],
                    "categoryId": category_id,
                },
                "status": {
                    "privacyStatus": visibility,
                },
            }

            # Add thumbnail if the video has one stored
            thumb_name = f"{Path(filename).stem}_thumb.jpg"
            thumb_path = config.THUMBNAIL_DIR / thumb_name
            if thumb_path.exists():
                body["thumbnails"] = {}  # placeholder; thumbnails set separately

            insert_request = youtube.videos().insert(
                part="snippet,status",
                body=body,
                media_body=media,
            )

            response = None
            file_size = video_path.stat().st_size
            uploaded = 0

            def _on_progress(chunk_size):
                nonlocal uploaded
                uploaded += chunk_size
                pct = round(min(100, (uploaded / file_size) * 100)) if file_size else 0
                c = get_db()
                c.execute(
                    "UPDATE upload_queue SET progress = ?, updated_at = CAST(strftime('%s', 'now') AS INTEGER) WHERE id = ?",
                    (pct, queue_id),
                )
                c.commit()
                c.close()

            # Execute the resumable upload with progress callback
            while response is None:
                status, response = insert_request.next_chunk()
                if status:
                    uploaded = int(status.resumable_progress or 0)
                    pct = round(min(100, (uploaded / file_size) * 100)) if file_size else 0
                    c = get_db()
                    c.execute(
                        "UPDATE upload_queue SET progress = ?, updated_at = CAST(strftime('%s', 'now') AS INTEGER) WHERE id = ?",
                        (pct, queue_id),
                    )
                    c.commit()
                    c.close()

            youtube_video_id = response.get("id")

            # Upload thumbnail separately if available
            if thumb_path.exists() and youtube_video_id:
                try:
                    youtube.thumbnails().set(
                        videoId=youtube_video_id,
                        media_body=MediaFileUpload(str(thumb_path), resumable=True),
                    ).execute()
                except Exception:
                    pass

            conn = get_db()
            conn.execute(
                """UPDATE videos SET youtube_video_id = ?, status = 'uploaded',
                   updated_at = CAST(strftime('%s', 'now') AS INTEGER) WHERE id = ?""",
                (youtube_video_id, video_id),
            )
            conn.execute(
                """UPDATE upload_queue SET status = 'done', progress = 100,
                   youtube_video_id = ?, updated_at = CAST(strftime('%s', 'now') AS INTEGER)
                   WHERE id = ?""",
                (youtube_video_id, queue_id),
            )
            conn.commit()
            conn.close()

        except Exception as e:
            conn = get_db()
            conn.execute(
                """UPDATE upload_queue SET status = 'failed', error_message = ?,
                   updated_at = CAST(strftime('%s', 'now') AS INTEGER) WHERE id = ?""",
                (str(e), queue_id),
            )
            conn.execute(
                """UPDATE videos SET status = 'failed',
                   updated_at = CAST(strftime('%s', 'now') AS INTEGER) WHERE id = ?""",
                (video_id,),
            )
            conn.commit()
            conn.close()

    thread = threading.Thread(target=_do_upload, daemon=True)
    thread.start()

    return jsonify({
        "success": True,
        "queue_id": queue_id,
        "video_id": video_id,
        "status": "uploading",
    })


@youtube_bp.route("/upload/chunk", methods=["POST"])
def upload_chunk():
    """Handle a chunk of resumable upload."""
    data = request.get_json() or {}
    video_id = data.get("video_id")
    position = data.get("position", 0)

    conn = get_db()
    video_row = conn.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()

    if not video_row:
        conn.close()
        return jsonify({"success": False, "error": "Video not found"}), 404

    try:
        youtube = get_youtube_service()

        # Return status
        file_size = video_row["file_size"] or 1
        if file_size <= 0:
            file_size = 1
        return jsonify({
            "success": True,
            "status": "uploading",
            "progress": min(100, int((position / file_size) * 100)),
        })

    except Exception as e:
        conn.close()
        return jsonify({"success": False, "error": str(e)}), 500


@youtube_bp.route("/upload/progress/<int:video_id>", methods=["GET"])
def upload_progress(video_id: int):
    """Get upload progress for a video — checks the upload_queue first, then the videos table."""
    conn = get_db()
    queue_row = conn.execute(
        "SELECT * FROM upload_queue WHERE video_id = ? ORDER BY id DESC LIMIT 1",
        (video_id,),
    ).fetchone()
    if queue_row:
        result = {
            "success": True,
            "progress": queue_row["progress"] or 0,
            "status": queue_row["status"] or "queued",
            "queue_id": queue_row["id"],
            "error_message": queue_row["error_message"],
            "retry_count": queue_row["retry_count"] or 0,
        }
        conn.close()
        return jsonify(result)

    row = conn.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()
    conn.close()

    if not row:
        return jsonify({"success": False, "error": "Video not found"}), 404

    return jsonify({
        "success": True,
        "progress": row["progress"] or 0,
        "status": row["status"] or "queued",
    })


# ---------------------------------------------------------------
# Scheduler endpoints
# ---------------------------------------------------------------


@youtube_bp.route("/schedules", methods=["POST"])
def create_schedule():
    """Create a scheduled upload."""
    data = request.get_json() or {}
    video_id = data.get("video_id")
    scheduled_at = data.get("scheduled_at")  # Unix timestamp
    timezone = data.get("timezone", "UTC")

    if not video_id or not scheduled_at:
        return jsonify({"success": False, "error": "video_id and scheduled_at required"}), 400

    conn = get_db()
    # Check video exists
    video_row = conn.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()
    if not video_row:
        conn.close()
        return jsonify({"success": False, "error": "Video not found"}), 404

    # Convert to unix timestamp if needed
    if isinstance(scheduled_at, str):
        try:
            dt = datetime.fromisoformat(scheduled_at)
            scheduled_at = int(dt.timestamp())
        except ValueError:
            scheduled_at = int(scheduled_at)

    conn.execute(
        """
        INSERT INTO schedules (video_id, youtube_video_id, title, description,
                               scheduled_at, timezone, status)
        VALUES (?, ?, ?, ?, ?, ?, 'scheduled')
    """,
        (
            video_id,
            video_row["filename"],
            video_row["title"],
            video_row["description"],
            scheduled_at,
            timezone,
        ),
    )

    # Update video status
    conn.execute(
        "UPDATE videos SET status = 'scheduled', updated_at = CAST(strftime('%s', 'now') AS INTEGER) WHERE id = ?",
        (video_id,),
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True, "scheduled_at": scheduled_at})


@youtube_bp.route("/schedules", methods=["GET"])
def list_schedules():
    """List all schedules."""
    conn = get_db()
    rows = conn.execute(
        "SELECT s.*, v.title as video_title FROM schedules s JOIN videos v ON s.video_id = v.id ORDER BY s.scheduled_at ASC"
    ).fetchall()
    conn.close()
    return jsonify({"success": True, "schedules": [dict(r) for r in rows]})


@youtube_bp.route("/schedules/<int:schedule_id>", methods=["PUT"])
def update_schedule(schedule_id: int):
    """Update a schedule."""
    data = request.get_json() or {}
    conn = get_db()

    update_fields = []
    params = []

    for field in ["title", "description", "timezone", "status"]:
        if field in data:
            update_fields.append(f"{field} = ?")
            params.append(data[field])

    if not update_fields:
        return jsonify({"success": False, "error": "No fields to update"}), 400

    update_fields.append("updated_at = CAST(strftime('%s', 'now') AS INTEGER)")
    params.append(schedule_id)

    conn.execute(
        f"UPDATE schedules SET {', '.join(update_fields)} WHERE id = ?",
        params,
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True})


@youtube_bp.route("/schedules/<int:schedule_id>", methods=["DELETE"])
def delete_schedule(schedule_id: int):
    """Delete a schedule."""
    conn = get_db()
    conn.execute("DELETE FROM schedules WHERE id = ?", (schedule_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


# ---------------------------------------------------------------
# Playlist endpoints
# ---------------------------------------------------------------


@youtube_bp.route("/playlists", methods=["GET"])
def list_playlists():
    """Fetch user's YouTube playlists."""
    try:
        youtube = get_youtube_service()
        response = youtube.playlists().list(
            part="snippet,contentDetails",
            mine=True,
        ).execute()

        playlists = response.get("items", [])
        result = []
        for p in playlists:
            result.append({
                "id": p["id"],
                "title": p["snippet"]["title"],
                "thumbnail": p["snippet"]["thumbnails"]["high"]["url"],
                "channel_id": p["snippet"]["channelId"],
            })

        conn = get_db()
        # Store in DB
        for pl in result:
            conn.execute(
                """INSERT OR REPLACE INTO playlists (title, thumbnail, channel_id)
                   VALUES (?, ?, ?)""",
                (pl["title"], pl["thumbnail"], pl["channel_id"]),
            )
        conn.commit()
        conn.close()

        return jsonify({"success": True, "playlists": result})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@youtube_bp.route("/playlists", methods=["POST"])
def create_playlist():
    """Create a new playlist."""
    data = request.get_json() or {}
    title = data.get("title", "New Playlist")

    try:
        youtube = get_youtube_service()

        body = {
            "snippet": {
                "title": title,
                "description": "",
            },
            "status": {
                "privacyStatus": "private",
            },
        }

        response = youtube.playlists().insert(
            part="snippet,status",
            body=body,
        ).execute()

        playlist_id = response["id"]
        thumbnail = response["snippet"]["thumbnails"]["high"]["url"]

        conn = get_db()
        conn.execute(
            """INSERT OR REPLACE INTO playlists (title, thumbnail, channel_id)
               VALUES (?, ?, ?)""",
            (title, thumbnail, None),
        )
        conn.commit()
        conn.close()

        return jsonify({"success": True, "playlist_id": playlist_id})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@youtube_bp.route("/videos/<int:video_id>/add-to-playlist", methods=["POST"])
def add_to_playlist(video_id: int):
    """Add a video to a playlist."""
    data = request.get_json() or {}
    playlist_id = data.get("playlist_id")

    if not playlist_id:
        return jsonify({"success": False, "error": "playlist_id required"}), 400

    conn = get_db()
    video_row = conn.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()
    if not video_row:
        conn.close()
        return jsonify({"success": False, "error": "Video not found"}), 404

    try:
        youtube = get_youtube_service()

        body = {
            "snippet": {
                "playlistId": playlist_id,
                "resourceId": {
                    "kind": "youtube#video",
                    "videoId": video_row.get("youtube_video_id", ""),
                },
            },
        }

        youtube.playlists().insert(
            part="snippet",
            body=body,
        ).execute()

        conn.close()
        return jsonify({"success": True})

    except Exception as e:
        conn.close()
        return jsonify({"success": False, "error": str(e)}), 500


# ---------------------------------------------------------------
# Templates endpoints
# ---------------------------------------------------------------


@youtube_bp.route("/templates", methods=["GET"])
def list_templates():
    """List metadata templates."""
    conn = get_db()
    rows = conn.execute("SELECT * FROM templates ORDER BY created_at DESC").fetchall()
    conn.close()
    return jsonify({"success": True, "templates": [dict(r) for r in rows]})


@youtube_bp.route("/templates", methods=["POST"])
def create_template():
    """Create a new metadata template."""
    data = request.get_json() or {}
    name = data.get("name", "New Template")

    conn = get_db()
    conn.execute(
        """INSERT INTO templates (name, title_pattern, description, tags, category_id,
                                  language, visibility, playlist_id, schedule_rule)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            name,
            data.get("title_pattern", ""),
            data.get("description", ""),
            json.dumps(data.get("tags", [])),
            data.get("category_id"),
            data.get("language"),
            data.get("visibility", "public"),
            data.get("playlist_id"),
            data.get("schedule_rule"),
        ),
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True})


@youtube_bp.route("/templates/<int:template_id>", methods=["PUT"])
def update_template(template_id: int):
    """Update a metadata template."""
    data = request.get_json() or {}
    conn = get_db()

    update_fields = []
    params = []

    for field in ["name", "title_pattern", "description", "tags", "category_id",
                  "language", "visibility", "playlist_id", "schedule_rule"]:
        if field in data:
            update_fields.append(f"{field} = ?")
            if field == "tags":
                params.append(json.dumps(data[field]))
            else:
                params.append(data[field])

    if not update_fields:
        return jsonify({"success": False, "error": "No fields to update"}), 400

    update_fields.append("updated_at = CAST(strftime('%s', 'now') AS INTEGER)")
    params.append(template_id)

    conn.execute(
        f"UPDATE templates SET {', '.join(update_fields)} WHERE id = ?",
        params,
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True})


@youtube_bp.route("/templates/<int:template_id>", methods=["DELETE"])
def delete_template(template_id: int):
    """Delete a metadata template."""
    conn = get_db()
    conn.execute("DELETE FROM templates WHERE id = ?", (template_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@youtube_bp.route("/templates/apply/<int:template_id>", methods=["POST"])
def apply_template(template_id: int):
    """Apply a template to a video."""
    data = request.get_json() or {}
    video_id = data.get("video_id")

    if not video_id:
        return jsonify({"success": False, "error": "video_id required"}), 400

    conn = get_db()
    template_row = conn.execute("SELECT * FROM templates WHERE id = ?", (template_id,)).fetchone()
    video_row = conn.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()

    if not template_row or not video_row:
        conn.close()
        return jsonify({"success": False, "error": "Template or video not found"}), 404

    # Apply template fields
    updates = {}

    if template_row["title_pattern"]:
        updates["title"] = template_row["title_pattern"]

    if template_row["description"]:
        updates["description"] = template_row["description"]

    if template_row["tags"]:
        updates["tags"] = template_row["tags"]

    if template_row["category_id"]:
        updates["category_id"] = template_row["category_id"]

    if template_row["language"]:
        updates["language"] = template_row["language"]

    if template_row["visibility"]:
        updates["visibility"] = template_row["visibility"]

    if template_row["playlist_id"]:
        updates["playlist_id"] = template_row["playlist_id"]

    for field, value in updates.items():
        conn.execute(
            f"UPDATE videos SET {field} = ? WHERE id = ?",
            (value, video_id),
        )

    conn.commit()
    conn.close()

    return jsonify({"success": True, "updated": updates})


# ---------------------------------------------------------------
# Automation rules endpoints
# ---------------------------------------------------------------


@youtube_bp.route("/rules", methods=["GET"])
def list_rules():
    """List automation rules."""
    conn = get_db()
    rows = conn.execute("SELECT * FROM automation_rules ORDER BY created_at DESC").fetchall()
    conn.close()
    return jsonify({"success": True, "rules": [dict(r) for r in rows]})


@youtube_bp.route("/rules", methods=["POST"])
def create_rule():
    """Create an automation rule."""
    data = request.get_json() or {}
    name = data.get("name", "New Rule")
    when_condition = data.get("when")
    if_condition = data.get("if")
    then_action = data.get("then")

    conn = get_db()
    conn.execute(
        """INSERT INTO automation_rules (name, when_condition, if_condition, then_action)
           VALUES (?, ?, ?, ?)""",
        (name, when_condition, if_condition, then_action),
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True})


@youtube_bp.route("/rules/<int:rule_id>", methods=["PUT"])
def update_rule(rule_id: int):
    """Update an automation rule."""
    data = request.get_json() or {}
    conn = get_db()

    update_fields = []
    params = []

    for field in ["name", "when_condition", "if_condition", "then_action"]:
        if field in data:
            update_fields.append(f"{field} = ?")
            params.append(data[field])

    if not update_fields:
        return jsonify({"success": False, "error": "No fields to update"}), 400

    update_fields.append("updated_at = CAST(strftime('%s', 'now') AS INTEGER)")
    params.append(rule_id)

    conn.execute(
        f"UPDATE automation_rules SET {', '.join(update_fields)} WHERE id = ?",
        params,
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True})


@youtube_bp.route("/rules/<int:rule_id>", methods=["DELETE"])
def delete_rule(rule_id: int):
    """Delete an automation rule."""
    conn = get_db()
    conn.execute("DELETE FROM automation_rules WHERE id = ?", (rule_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


# ---------------------------------------------------------------
# Upload history endpoints
# ---------------------------------------------------------------


@youtube_bp.route("/history", methods=["GET"])
def list_history():
    """List upload history."""
    conn = get_db()
    rows = conn.execute(
        """SELECT h.*, v.title as video_title FROM history h
           JOIN videos v ON h.video_id = v.id ORDER BY h.published_at DESC"""
    ).fetchall()
    conn.close()
    return jsonify({"success": True, "history": [dict(r) for r in rows]})


@youtube_bp.route("/history/search", methods=["GET"])
def search_history():
    """Search history by title."""
    query = request.args.get("q", "")
    conn = get_db()

    if query:
        rows = conn.execute(
            """SELECT h.*, v.title as video_title FROM history h
               JOIN videos v ON h.video_id = v.id
               WHERE h.title LIKE ? OR v.title LIKE ?
               ORDER BY h.published_at DESC""",
            (f"%{query}%", f"%{query}%"),
        ).fetchall()
    else:
        rows = conn.execute(
            """SELECT h.*, v.title as video_title FROM history h
               JOIN videos v ON h.video_id = v.id ORDER BY h.published_at DESC"""
        ).fetchall()

    conn.close()
    return jsonify({"success": True, "history": [dict(r) for r in rows]})


# ---------------------------------------------------------------
# Error center
# ---------------------------------------------------------------


@youtube_bp.route("/errors", methods=["GET"])
def list_errors():
    """List upload errors."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM upload_queue WHERE status = 'failed' ORDER BY created_at DESC LIMIT 20"
    ).fetchall()
    conn.close()
    return jsonify({"success": True, "errors": [dict(r) for r in rows]})


@youtube_bp.route("/errors/<int:queue_id>/retry", methods=["POST"])
def retry_error(queue_id: int):
    """Retry a failed upload."""
    conn = get_db()
    row = conn.execute("SELECT * FROM upload_queue WHERE id = ?", (queue_id,)).fetchone()

    if not row:
        conn.close()
        return jsonify({"success": False, "error": "Queue item not found"}), 404

    if row["retry_count"] >= (row["max_retries"] or 3):
        conn.close()
        return jsonify({"success": False, "error": "Max retries exceeded"}), 400

    # Increment retry count and update status
    conn.execute(
        "UPDATE upload_queue SET retry_count = retry_count + 1, status = 'retrying', updated_at = CAST(strftime('%s', 'now') AS INTEGER) WHERE id = ?",
        (queue_id,),
    )
    conn.commit()
    conn.close()

    # Trigger retry logic (would typically call upload_start)
    return jsonify({"success": True, "retry_count": row["retry_count"] + 1})


# ---------------------------------------------------------------
# Watch folder
# ---------------------------------------------------------------


@youtube_bp.route("/watch-folder", methods=["POST"])
def set_watch_folder():
    """Set a watch folder for automation."""
    data = request.get_json() or {}
    folder_path = data.get("folder_path")

    conn = get_db()
    conn.execute(
        """INSERT OR REPLACE INTO watch_folder (folder_path, connected, last_checked)
           VALUES (?, 1, CAST(strftime('%s', 'now') AS INTEGER))""",
        (folder_path,),
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True})


@youtube_bp.route("/watch-folder", methods=["GET"])
def get_watch_folder():
    """Get watch folder status."""
    conn = get_db()
    row = conn.execute("SELECT * FROM watch_folder ORDER BY id DESC LIMIT 1").fetchone()
    conn.close()
    if row:
        return jsonify({"success": True, "folder": dict(row)})
    return jsonify({"success": True, "folder": None})


# ---------------------------------------------------------------
# File naming templates
# ---------------------------------------------------------------


@youtube_bp.route("/naming-templates", methods=["GET"])
def list_naming_templates():
    """List file naming templates."""
    conn = get_db()
    rows = conn.execute("SELECT * FROM naming_templates ORDER BY created_at DESC").fetchall()
    conn.close()
    return jsonify({"success": True, "templates": [dict(r) for r in rows]})


@youtube_bp.route("/naming-templates", methods=["POST"])
def create_naming_template():
    """Create a file naming template."""
    data = request.get_json() or {}
    name = data.get("name", "New Template")

    conn = get_db()
    conn.execute(
        """INSERT INTO naming_templates (name, pattern, description)
           VALUES (?, ?, ?)""",
        (name, data.get("pattern", ""), data.get("description", "")),
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True})


# ---------------------------------------------------------------
# Multi-channel support
# ---------------------------------------------------------------


@youtube_bp.route("/channels", methods=["GET"])
def list_channels():
    """List authorized channels (multi-channel support)."""
    conn = get_db()
    rows = conn.execute("SELECT * FROM tokens WHERE channel_id IS NOT NULL ORDER BY updated_at DESC").fetchall()
    conn.close()
    channels = [dict(r) for r in rows]
    return jsonify({"success": True, "channels": channels})


@youtube_bp.route("/channel/selector", methods=["POST"])
def set_selected_channel():
    """Set the selected channel for uploads."""
    data = request.get_json() or {}
    channel_id = data.get("channel_id")

    conn = get_db()
    # Update the default token entry to mark which channel is selected
    conn.execute(
        "UPDATE tokens SET updated_at = CAST(strftime('%s', 'now') AS INTEGER) WHERE user_id = 'default'",
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True, "channel_id": channel_id})


# ---------------------------------------------------------------
# Upload Queue endpoint
# ---------------------------------------------------------------


@youtube_bp.route("/upload-queue", methods=["GET"])
def list_upload_queue():
    """List upload queue items."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM upload_queue ORDER BY created_at DESC LIMIT 50"
    ).fetchall()
    conn.close()
    return jsonify({"success": True, "items": [dict(r) for r in rows]})


@youtube_bp.route("/upload-queue/<int:queue_id>/retry", methods=["POST"])
def retry_queue_item(queue_id: int):
    """Retry a failed upload queue item."""
    conn = get_db()
    row = conn.execute("SELECT * FROM upload_queue WHERE id = ?", (queue_id,)).fetchone()

    if not row:
        conn.close()
        return jsonify({"success": False, "error": "Queue item not found"}), 404

    if row["retry_count"] >= (row["max_retries"] or 3):
        conn.close()
        return jsonify({"success": False, "error": "Max retries exceeded"}), 400

    # Increment retry count and update status
    conn.execute(
        "UPDATE upload_queue SET retry_count = retry_count + 1, status = 'retrying', updated_at = CAST(strftime('%s', 'now') AS INTEGER) WHERE id = ?",
        (queue_id,),
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True, "retry_count": row["retry_count"] + 1})


@youtube_bp.route("/upload-queue/<int:queue_id>", methods=["DELETE"])
def delete_queue_item(queue_id: int):
    """Remove an item from the upload queue."""
    conn = get_db()
    row = conn.execute("SELECT * FROM upload_queue WHERE id = ?", (queue_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"success": False, "error": "Queue item not found"}), 404

    conn.execute("DELETE FROM upload_queue WHERE id = ?", (queue_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@youtube_bp.route("/upload-queue", methods=["POST"])
def add_to_upload_queue():
    """Add a video to the upload queue (creates queue entry from a videos table row)."""
    data = request.get_json() or {}
    video_id = data.get("video_id")

    if not video_id:
        return jsonify({"success": False, "error": "video_id required"}), 400

    conn = get_db()
    video_row = conn.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()
    if not video_row:
        conn.close()
        return jsonify({"success": False, "error": "Video not found"}), 404

    title = video_row["title"] or video_row["filename"]
    description = video_row["description"] or ""
    tags = video_row["tags"] or json.dumps([])
    category_id = video_row["category_id"] or "22"
    visibility = video_row["visibility"] or "public"
    scheduled_at = data.get("scheduled_at")

    conn.execute(
        """
        INSERT INTO upload_queue (video_id, title, description, tags, category_id,
                                  visibility, scheduled_at, status, retry_count, max_retries)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', 0, 3)
        """,
        (video_id, title, description, tags, category_id, visibility, scheduled_at),
    )
    conn.commit()
    queue_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()

    return jsonify({"success": True, "queue_id": queue_id, "video_id": video_id})


# ---------------------------------------------------------------
# Thumbnail endpoints
# ---------------------------------------------------------------


@youtube_bp.route("/thumbnail/upload", methods=["POST"])
def upload_thumbnail():
    """Upload a thumbnail image for a video."""
    if "thumbnail" not in request.files:
        return jsonify({"success": False, "error": "No thumbnail file provided"}), 400
    file = request.files["thumbnail"]
    if file.filename == "":
        return jsonify({"success": False, "error": "Empty filename"}), 400

    from pathlib import Path
    thumb_dir = config.THUMBNAIL_DIR
    thumb_dir.mkdir(parents=True, exist_ok=True)
    filename = Path(file.filename).name
    save_path = thumb_dir / filename
    file.save(str(save_path))

    return jsonify({
        "success": True,
        "url": f"/download/thumbnail/{filename}",
        "filename": filename,
    })


@youtube_bp.route("/thumbnail/capture", methods=["POST"])
def capture_thumbnail():
    """Capture a frame from a video as thumbnail."""
    data = request.get_json() or {}
    filename = data.get("filename", "")
    if not filename:
        return jsonify({"success": False, "error": "Filename required"}), 400

    video_path = config.INPUT_DIR / filename
    if not video_path.exists():
        return jsonify({"success": False, "error": "Video not found"}), 404

    try:
        from utils.video_utils import VideoLoader
        loader = VideoLoader(video_path)
        thumb_dir = config.THUMBNAIL_DIR
        thumb_dir.mkdir(parents=True, exist_ok=True)
        thumb_path = thumb_dir / f"{Path(filename).stem}_frame.jpg"
        loader.thumbnail(thumb_path)
        loader.close()
        return jsonify({
            "success": True,
            "url": f"/download/thumbnail/{thumb_path.name}",
            "filename": thumb_path.name,
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ---------------------------------------------------------------
# Settings endpoints
# ---------------------------------------------------------------


@youtube_bp.route("/settings", methods=["GET"])
def get_settings():
    """Get YouTube automation settings."""
    conn = get_db()
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    conn.close()
    settings = {r["key"]: r["value"] for r in rows}
    return jsonify({"success": True, "settings": settings})


@youtube_bp.route("/settings", methods=["POST"])
def save_settings():
    """Save YouTube automation settings."""
    data = request.get_json() or {}
    conn = get_db()
    for key, value in data.items():
        conn.execute(
            """
            INSERT OR REPLACE INTO settings (key, value, updated_at)
            VALUES (?, ?, CAST(strftime('%s', 'now') AS INTEGER))
            """,
            (key, str(value)),
        )
    conn.commit()
    conn.close()
    return jsonify({"success": True})


# ---------------------------------------------------------------
# Data management endpoints
# ---------------------------------------------------------------


@youtube_bp.route("/data/clear", methods=["POST"])
def clear_data():
    """Clear all local YouTube automation data."""
    conn = get_db()
    tables = [
        "tokens", "videos", "schedules", "history", "playlists",
        "templates", "automation_rules", "upload_queue", "watch_folder",
        "naming_templates", "settings",
    ]
    for table in tables:
        conn.execute(f"DELETE FROM {table}")
    conn.commit()
    conn.close()
    return jsonify({"success": True})


@youtube_bp.route("/data/export", methods=["GET"])
def export_data():
    """Export all local YouTube automation data as JSON."""
    conn = get_db()
    data = {}
    tables = [
        "tokens", "videos", "schedules", "history", "playlists",
        "templates", "automation_rules", "upload_queue", "watch_folder",
        "naming_templates", "settings",
    ]
    for table in tables:
        rows = conn.execute(f"SELECT * FROM {table}").fetchall()
        data[table] = [dict(r) for r in rows]
    conn.close()
    return jsonify(data)