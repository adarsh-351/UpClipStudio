"""UpClip Studio - Flask Web Application."""

import os
import sys
import subprocess
from pathlib import Path

# ---------------------------------------------------------------
# Environment guard: re-launch using the project .venv interpreter
# if the currently-running interpreter is missing required packages
# (e.g. cv2). This makes `python app.py` work from any shell.
# ---------------------------------------------------------------
def _ensure_environment():
    try:
        import cv2  # noqa: F401
        import flask  # noqa: F401
        return  # all deps available in current interpreter
    except Exception:
        pass

    venv_python = Path(__file__).resolve().parent / ".venv" / "Scripts" / "python.exe"
    if venv_python.exists():
        print(f"Re-launching with project interpreter: {venv_python}")
        os.execv(str(venv_python), [str(venv_python)] + sys.argv)


_ensure_environment()

import config

from utils.video_utils import VideoLoader
from utils.ffmpeg_utils import check_ffmpeg
from utils.clip_generator import ClipGenerator
from utils.scene_detector import SceneDetector
from utils.scene_merger import SceneMerger

from ai.whisper_engine import WhisperEngine
from ai.subtitle_builder import SubtitleBuilder
from ai.subtitle_renderer import SubtitleRenderer
from ai.ass_builder import ASSBuilder

from flask import Flask



# ===================================================
# Main AI Pipeline
# ===================================================

def main():

    print("=" * 60)
    print("YouTube AI Shorts Generator")
    print("=" * 60)
    print()

    # ---------------------------------
    # FFmpeg Check
    # ---------------------------------

    print("Checking FFmpeg...")

    status, version = check_ffmpeg()

    if not status:
        print("❌ FFmpeg Not Installed")
        print(version)
        return

    print("✅ FFmpeg Installed")
    print(version)
    print()

    # ---------------------------------
    # Load Video
    # ---------------------------------

    video = config.INPUT_DIR / "sample.mp4"

    if not video.exists():
        print(f"❌ Video not found : {video}")
        return

    loader = VideoLoader(video)

    info = loader.metadata()

    print("=" * 60)
    print("Video Metadata")
    print("=" * 60)

    for key, value in info.items():
        print(f"{key:15}: {value}")

    print()

    # ---------------------------------
    # Thumbnail
    # ---------------------------------

    print("=" * 60)
    print("Generating Thumbnail")
    print("=" * 60)

    thumb = config.THUMBNAIL_DIR / "thumbnail.jpg"

    loader.thumbnail(thumb)

    print("✅ Thumbnail Saved")

    print()

    # ---------------------------------
    # Frame Extraction
    # ---------------------------------

    print("=" * 60)
    print("Extracting Frames")
    print("=" * 60)

    total_frames = loader.extract_frames(
        config.FRAMES_DIR
    )

    print(f"✅ Frames Extracted : {total_frames}")

    loader.close()

    print()

    # ---------------------------------
    # Scene Detection
    # ---------------------------------

    print("=" * 60)
    print("Scene Detection")
    print("=" * 60)

    detector = SceneDetector(video)

    scenes = detector.detect_scenes(
        threshold=config.SCENE_THRESHOLD
    )

    print(f"Original Scenes : {len(scenes)}")

    print()

    # ---------------------------------
    # Merge Scenes
    # ---------------------------------

    print("=" * 60)
    print("Scene Merge")
    print("=" * 60)

    merger = SceneMerger()

    merged_scenes = merger.merge(scenes)

    print(f"Merged Clips : {len(merged_scenes)}")

    print()

    # ---------------------------------
    # Clip Generation
    # ---------------------------------

    print("=" * 60)
    print("Generating Clips")
    print("=" * 60)

    generator = ClipGenerator(video)

    clips = generator.split_by_scenes(
        merged_scenes
    )

    print(f"Total Clips Generated : {len(clips)}")

    print()

    # ---------------------------------
    # Whisper AI
    # ---------------------------------

    print("=" * 60)
    print("Speech Detection (Whisper)")
    print("=" * 60)

    whisper = WhisperEngine(config.WHISPER_MODEL)

    transcript = whisper.transcribe(video)

    transcript_file = (
        config.TRANSCRIPT_DIR /
        "sample.json"
    )

    whisper.save_json(
        transcript,
        transcript_file
    )

    print(f"✅ Transcript Saved : {transcript_file}")

    print()

    # ---------------------------------
    # Subtitle Generation
    # ---------------------------------

    print("=" * 60)
    print("Subtitle Generation")
    print("=" * 60)

    subtitle = SubtitleBuilder()

    srt_file = config.SUBTITLE_DIR / "sample.srt"
    vtt_file = config.SUBTITLE_DIR / "sample.vtt"

    subtitle.save_all(
        transcript,
        srt_file,
        vtt_file
    )

    print("✅ Subtitle Files Created")

    print()


    

    # ---------------------------------
    # Subtitle Rendering
    # ---------------------------------

    print("=" * 60)
    print("Rendering Subtitle")
    print("=" * 60)

    renderer = SubtitleRenderer()

    output_video = (
        config.FINAL_DIR /
        "sample_subtitle.mp4"
    )

    renderer.burn_subtitle(
        input_video=video,
        subtitle_file=srt_file,
        output_video=output_video
    )

    print()

    # ---------------------------------
    # Completed
    # ---------------------------------

    print("=" * 60)
    print("PIPELINE COMPLETED SUCCESSFULLY")
    print("=" * 60)

    print()

    print(f"Video       : {video}")
    print(f"Transcript  : {transcript_file}")
    print(f"SRT         : {srt_file}")
    print(f"VTT         : {vtt_file}")
    print(f"Final Video : {output_video}")

    print()


# ===================================================
# Flask Web Application
# ===================================================

def create_app():

    app = Flask(
        __name__,
        template_folder="templates",
        static_folder="static"
    )

    app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024 * 1024  # 1 GB
    app.config["SECRET_KEY"] = config.SECRET_KEY
    app.config["SESSION_COOKIE_HTTPONLY"] = config.SESSION_COOKIE_HTTPONLY
    app.config["SESSION_COOKIE_SAMESITE"] = config.SESSION_COOKIE_SAMESITE

    from routes.home import home_bp
    from routes.auth import auth_bp
    from routes.upload import upload_bp
    from routes.process import process_bp
    from routes.download import download_bp
    from routes.caption_studio import caption_studio_bp
    from routes.youtube import youtube_bp
    from routes.studio_navigation import studio_nav_bp

    app.register_blueprint(home_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(upload_bp)
    app.register_blueprint(process_bp)
    app.register_blueprint(download_bp)
    app.register_blueprint(caption_studio_bp)
    app.register_blueprint(youtube_bp)
    app.register_blueprint(studio_nav_bp)

    return app


# ===================================================
# Entry Point
# ===================================================

if __name__ == "__main__":

    import os

    # Ensure Windows console renders emoji correctly
    os.environ["PYTHONIOENCODING"] = "utf-8"

    # Ensure bundled FFmpeg is on PATH for Whisper
    if config.FFMPEG_PATH and os.path.exists(config.FFMPEG_PATH):
        os.environ["PATH"] = (
            str(os.path.dirname(config.FFMPEG_PATH))
            + os.pathsep
            + os.environ["PATH"]
        )

    app = create_app()

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )

