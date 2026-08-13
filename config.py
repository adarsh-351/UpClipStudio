# ==========================================================
# SECTION 1 : IMPORTS
# ==========================================================

from pathlib import Path

# ==========================================================
# SECTION 2 : PROJECT ROOT
# ==========================================================

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = Path(__file__).parent

# ==========================================================
# INPUT / OUTPUT
# ==========================================================

INPUT_DIR = ROOT_DIR / "input"

OUTPUT_DIR = ROOT_DIR / "output"

CLIPS_DIR = OUTPUT_DIR / "clips"

FINAL_DIR = OUTPUT_DIR / "final"

SUBTITLE_DIR = OUTPUT_DIR / "subtitles"

TRANSCRIPT_DIR = OUTPUT_DIR / "transcript"

AUDIO_DIR = OUTPUT_DIR / "audio"

FRAMES_DIR = OUTPUT_DIR / "frames"

THUMBNAIL_DIR = OUTPUT_DIR / "thumbnails"

LOG_DIR = ROOT_DIR / "logs"

# ==========================================================
# AUTH / DATA
# ==========================================================

DATA_DIR = ROOT_DIR / "data"

USERS_FILE = DATA_DIR / "users.json"

SECRET_KEY = "ai-shorts-studio-secret-key-change-me"

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"

# ==========================================================
# ASSETS
# ==========================================================

ASSETS_DIR = ROOT_DIR / "assets"

FONT_DIR = ASSETS_DIR / "fonts"

OVERLAY_DIR = ASSETS_DIR / "overlays"

# ==========================================================
# VIDEO SETTINGS
# ==========================================================

OUTPUT_WIDTH = 1080
OUTPUT_HEIGHT = 1920

FPS = 30

VIDEO_CODEC = "libx264"
AUDIO_CODEC = "aac"

# ==========================================================
# SHORTS SETTINGS
# ==========================================================

MIN_DURATION = 15
MAX_DURATION = 60

CLIP_DURATION = 30

MIN_CLIP_DURATION = 20
TARGET_CLIP_DURATION = 30
MAX_CLIP_DURATION = 60

# ==========================================================
# SCENE DETECTION
# ==========================================================

SCENE_THRESHOLD = 27.0

MIN_SCENE_DURATION = 3

# ==========================================================
# WHISPER AI
# ==========================================================

WHISPER_MODEL = "base"

LANGUAGE = "en"

USE_GPU = True

# ==========================================================
# LANGUAGES
# ==========================================================
# code -> (deep_translator, whisper, display name)

LANGUAGES = {
    "auto":   ("auto", "auto", "Auto Detect"),
    "en":     ("en", "en", "English"),
    "hi":     ("hi", "hi", "Hindi"),
    "hinglish": ("hi", "hi", "Hinglish (Hindi + English)"),
    "bn":     ("bn", "bn", "Bengali"),
    "ta":     ("ta", "ta", "Tamil"),
    "te":     ("te", "te", "Telugu"),
    "mr":     ("mr", "mr", "Marathi"),
    "es":     ("es", "es", "Spanish"),
    "fr":     ("fr", "fr", "French"),
    "de":     ("de", "de", "German"),
    "ar":     ("ar", "ar", "Arabic"),
    "ur":     ("ur", "ur", "Urdu"),
    "gu":     ("gu", "gu", "Gujarati"),
    "kn":     ("kn", "kn", "Kannada"),
    "ml":     ("ml", "ml", "Malayalam"),
    "pa":     ("pa", "pa", "Punjabi"),
    "it":     ("it", "it", "Italian"),
    "pt":     ("pt", "pt", "Portuguese"),
    "ja":     ("ja", "ja", "Japanese"),
    "ko":     ("ko", "ko", "Korean"),
    "zh":     ("zh-CN", "zh", "Chinese"),
    "ru":     ("ru", "ru", "Russian"),
}

LANGUAGE_NAMES = {k: v[2] for k, v in LANGUAGES.items()}

# ==========================================================
# ASPECT RATIOS
# ==========================================================
# key -> (label, width, height)

ASPECT_OPTIONS = {
    "original": ("Original", None, None),
    "9:16":     ("9:16 - Shorts/Reels", 1080, 1920),
    "16:9":     ("16:9 - YouTube/Landscape", 1920, 1080),
    "1:1":      ("1:1 - Square", 1080, 1080),
}

# ==========================================================
# CLIPPING
# ==========================================================

CLIPPING_AI = "ai"                 # AI decides duration & count
CLIPPING_DURATION = "duration"     # user decides duration
CLIPPING_COUNT = "count"           # user decides number of clips

# ==========================================================
# CLIP NAMING
# ==========================================================

NAME_SEQUENTIAL = "sequential"
NAME_CONTENT = "content"

# ==========================================================
# EXPORT SETTINGS
# ==========================================================

EXPORT_QUALITY = "high"

BITRATE = "8M"

# ==========================================================
# QUALITY PRESETS
# ==========================================================
# key -> (label, max_width, max_height, bitrate)
# Used for clip generation scaling and /download/export re-encode.

QUALITY_PRESETS = {
    "original": ("Original", None, None, None),
    "360p":     ("360p",  640,  360,  "1M"),
    "720p":     ("720p",  1280, 720,  "3M"),
    "1080p":    ("1080p", 1920, 1080, "6M"),
}

DEFAULT_QUALITY = "original"

# ==========================================================
# FFMPEG
# ==========================================================

FFMPEG_PATH = r"C:\Users\LENOVO\Downloads\image\image\.venv\bin\ffmpeg.exe"

# ==========================================================
# SUBTITLE SETTINGS
# ==========================================================

# Available:
# youtube
# tiktok
# instagram
# netflix

SUBTITLE_STYLE = "youtube"

# Default fallback values

SUBTITLE_FONT = "Arial"

SUBTITLE_FONT_SIZE = 22

SUBTITLE_OUTLINE = 2

SUBTITLE_SHADOW = 1

# ==========================================================
# ANIMATED CAPTIONS
# ==========================================================

CAPTION_ENABLED = False

CAPTION_ANIMATION = "pop"        # pop | fade | bounce | slide | zoom | none

CAPTION_POSITION = "bottom"      # bottom | top | middle

CAPTION_FONT = "Arial Black"

CAPTION_FONT_SIZE = 34

CAPTION_COLOR = "#FFFFFF"        # hex, primary text color

CAPTION_BACKGROUND = "#000000"   # hex, outline/background color

CAPTION_OUTLINE = 3

CAPTION_MARGIN_V = 60

CAPTION_MIN_WORD_MS = 60

# ==========================================================
# ANIMATED CAPTION STYLE OPTIONS
# ==========================================================

CAPTION_ANIMATION_OPTIONS = ["pop", "fade", "bounce", "slide", "zoom", "none"]

CAPTION_POSITION_OPTIONS = ["bottom", "top", "middle"]

CAPTION_POSITION_PRESETS = ["top", "upper", "center", "lower", "bottom"]

# ==========================================================
# UNIFIED STUDIO SETTINGS
# ==========================================================

CAPTION_STYLES_DIR = OUTPUT_DIR / "caption_styles"

CAPTION_PRESETS = {
    "tiktok_pop": {
        "id": "tiktok_pop",
        "name": "TikTok Pop",
        "font_family": "Arial Black",
        "font_size": 42,
        "font_weight": 800,
        "text_color": "#FFFFFF",
        "active_word_color": "#fbbf24",
        "background_color": "#000000",
        "background_opacity": 0.0,
        "outline_color": "#000000",
        "outline_width": 3,
        "shadow_color": "#000000",
        "shadow_blur": 4,
        "shadow_offset_y": 2,
        "position": "bottom",
        "animation": "pop",
        "letter_spacing": 0,
        "line_height": 1.2,
        "max_lines": 2,
    },
    "youtube": {
        "id": "youtube",
        "name": "YouTube",
        "font_family": "Arial",
        "font_size": 22,
        "font_weight": 700,
        "text_color": "#FFFFFF",
        "active_word_color": "#FFFFFF",
        "background_color": "#000000",
        "background_opacity": 0.0,
        "outline_color": "#000000",
        "outline_width": 2,
        "shadow_color": "#000000",
        "shadow_blur": 1,
        "shadow_offset_y": 0,
        "position": "bottom",
        "animation": "none",
        "letter_spacing": 0,
        "line_height": 1.4,
        "max_lines": 2,
    },
    "minimal": {
        "id": "minimal",
        "name": "Minimal",
        "font_family": "Inter",
        "font_size": 32,
        "font_weight": 400,
        "text_color": "#FFFFFF",
        "active_word_color": "#FFFFFF",
        "background_color": "#000000",
        "background_opacity": 0.0,
        "outline_color": "#000000",
        "outline_width": 0,
        "shadow_color": "#000000",
        "shadow_blur": 0,
        "shadow_offset_y": 0,
        "position": "bottom",
        "animation": "none",
        "letter_spacing": 1,
        "line_height": 1.4,
        "max_lines": 2,
    },
    "bold": {
        "id": "bold",
        "name": "Bold",
        "font_family": "Arial Black",
        "font_size": 48,
        "font_weight": 900,
        "text_color": "#FFFFFF",
        "active_word_color": "#fbbf24",
        "background_color": "#000000",
        "background_opacity": 0.6,
        "outline_color": "#000000",
        "outline_width": 4,
        "shadow_color": "#000000",
        "shadow_blur": 8,
        "shadow_offset_y": 2,
        "position": "bottom",
        "animation": "pop",
        "letter_spacing": 0,
        "line_height": 1.1,
        "max_lines": 1,
    },
}

# ==========================================================
# CREATE DIRECTORIES
# ==========================================================

DIRECTORIES = [

    INPUT_DIR,

    OUTPUT_DIR,

    CLIPS_DIR,

    FINAL_DIR,

    SUBTITLE_DIR,

    TRANSCRIPT_DIR,

    AUDIO_DIR,

    FRAMES_DIR,

    THUMBNAIL_DIR,

    LOG_DIR,

    ASSETS_DIR,

    FONT_DIR,

    OVERLAY_DIR,

    CAPTION_STYLES_DIR,

]

for folder in DIRECTORIES:
    folder.mkdir(
        parents=True,
        exist_ok=True
    )