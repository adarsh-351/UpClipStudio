"""
Core Template, Preset & Brand Kit Manager for UpClip Studio — Phase 18.
Provides centralized storage, CRUD operations, system templates for reusable creative workflows:
Captions, Titles, Lower Thirds, Callouts, Social, Podcast, Transitions, and Graphics.
"""

import json
import time
from pathlib import Path
import config

DATA_DIR = config.ROOT_DIR / "data"
TEMPLATES_FILE = DATA_DIR / "templates.json"
BRAND_KIT_FILE = DATA_DIR / "brand_kit.json"
CUSTOM_PRESETS_FILE = DATA_DIR / "custom_presets.json"


SYSTEM_TEMPLATES = [
    {
        "id": "tpl_viral_short",
        "name": "Viral Short Hook",
        "category": "Captions",
        "aspectRatio": "9:16",
        "description": "High-energy short-form video with bold pop captions, top badge, and background music ducking.",
        "isSystem": True,
        "favorite": True,
        "thumbnailIcon": "🔥",
        "data": {
            "aspectRatio": "9:16",
            "captionStyle": {
                "fontFamily": "Anton",
                "fontSize": 40,
                "fontWeight": 800,
                "textColor": "#FFFFFF",
                "activeWordColor": "#FBBF24",
                "backgroundColor": "#000000",
                "backgroundOpacity": 0.0,
                "outlineColor": "#000000",
                "outlineWidth": 4,
                "shadowColor": "#000000",
                "shadowBlur": 6,
                "position": "bottom",
                "animation": "pop"
            },
            "graphics": [
                {
                    "id": "tpl_badge_hot",
                    "type": "shape",
                    "name": "HOT Hook Badge",
                    "start": 0.0,
                    "end": 4.0,
                    "transform": { "x": 0, "y": -220, "width": 140, "height": 36, "scale": 100, "rotation": 0, "opacity": 100 },
                    "appearance": { "fill": "#EF4444", "stroke": "#FFFFFF", "strokeWidth": 1, "cornerRadius": 6, "shadowBlur": 4, "shadowColor": "#000000" },
                    "content": { "shapeType": "badge" },
                    "typography": { "text": "HOT 🔥", "fontFamily": "Inter", "fontSize": 13, "fontWeight": 800, "color": "#FFFFFF" },
                    "animation": { "entrance": "pop", "exit": "none" }
                }
            ],
            "audioTracks": [
                { "id": "track_video_audio", "type": "video_audio", "name": "Video Audio", "volume": 100, "muted": False, "solo": False },
                { "id": "track_music", "type": "music", "name": "Music", "volume": 70, "muted": False, "solo": False, "ducking": { "enabled": True, "amount": 60 } },
                { "id": "track_voice", "type": "voice", "name": "Voice / Voiceover", "volume": 100, "muted": False, "solo": False },
                { "id": "track_sfx", "type": "sfx", "name": "SFX", "volume": 90, "muted": False, "solo": False }
            ]
        }
    },
    {
        "id": "tpl_podcast_highlights",
        "name": "Podcast Highlights",
        "category": "Podcast",
        "aspectRatio": "9:16",
        "description": "Clean speaker setup with lower-third title card and balanced audio ducking.",
        "isSystem": True,
        "favorite": True,
        "thumbnailIcon": "🎙",
        "data": {
            "aspectRatio": "9:16",
            "captionStyle": {
                "fontFamily": "Inter",
                "fontSize": 32,
                "fontWeight": 700,
                "textColor": "#FFFFFF",
                "activeWordColor": "#38BDF8",
                "backgroundColor": "#000000",
                "backgroundOpacity": 0.6,
                "outlineWidth": 0,
                "shadowBlur": 3,
                "position": "bottom",
                "animation": "fade_in"
            },
            "graphics": [
                {
                    "id": "tpl_podcast_lt",
                    "type": "lower_third",
                    "name": "Speaker Lower Third",
                    "start": 0.5,
                    "end": 6.0,
                    "transform": { "x": 0, "y": 140, "width": 280, "height": 48, "scale": 100, "rotation": 0, "opacity": 100 },
                    "appearance": { "fill": "#1E293B", "stroke": "#38BDF8", "strokeWidth": 1, "cornerRadius": 6, "shadowBlur": 4, "shadowColor": "#000000" },
                    "typography": { "text": "Episode Key Moment", "fontFamily": "Inter", "fontSize": 15, "fontWeight": 700, "color": "#FFFFFF" },
                    "animation": { "entrance": "slide_up", "exit": "fade_out" }
                }
            ],
            "audioTracks": [
                { "id": "track_video_audio", "type": "video_audio", "name": "Video Audio", "volume": 100, "muted": False },
                { "id": "track_music", "type": "music", "name": "Music", "volume": 50, "muted": False, "ducking": { "enabled": True, "amount": 75 } },
                { "id": "track_voice", "type": "voice", "name": "Voice / Voiceover", "volume": 100, "muted": False },
                { "id": "track_sfx", "type": "sfx", "name": "SFX", "volume": 80, "muted": False }
            ]
        }
    },
    {
        "id": "tpl_talking_head",
        "name": "Talking Head Pro",
        "category": "Titles",
        "aspectRatio": "9:16",
        "description": "Focused talking head framing with modern neon titles and safe-zone alignment.",
        "isSystem": True,
        "favorite": False,
        "thumbnailIcon": "👤",
        "data": {
            "aspectRatio": "9:16",
            "captionStyle": {
                "fontFamily": "Montserrat",
                "fontSize": 34,
                "fontWeight": 800,
                "textColor": "#FFFFFF",
                "activeWordColor": "#EC4899",
                "backgroundColor": "#000000",
                "backgroundOpacity": 0.0,
                "outlineWidth": 3,
                "shadowBlur": 5,
                "position": "bottom",
                "animation": "pop"
            },
            "graphics": [
                {
                    "id": "tpl_title_tag",
                    "type": "text",
                    "name": "Header Title",
                    "start": 0.0,
                    "end": 4.0,
                    "transform": { "x": 0, "y": -220, "width": 240, "height": 40, "scale": 100, "rotation": 0, "opacity": 100 },
                    "appearance": { "fill": "#0F172A", "stroke": "#EC4899", "strokeWidth": 1.5, "cornerRadius": 8 },
                    "typography": { "text": "MUST WATCH ✨", "fontFamily": "Montserrat", "fontSize": 14, "fontWeight": 800, "color": "#EC4899" },
                    "animation": { "entrance": "pop", "exit": "fade_out" }
                }
            ],
            "audioTracks": [
                { "id": "track_video_audio", "type": "video_audio", "name": "Video Audio", "volume": 100, "muted": False },
                { "id": "track_music", "type": "music", "name": "Music", "volume": 60, "muted": False, "ducking": { "enabled": True, "amount": 65 } },
                { "id": "track_voice", "type": "voice", "name": "Voice / Voiceover", "volume": 100, "muted": False },
                { "id": "track_sfx", "type": "sfx", "name": "SFX", "volume": 85, "muted": False }
            ]
        }
    },
    {
        "id": "tpl_educational_explainer",
        "name": "Educational Explainer",
        "category": "Callouts",
        "aspectRatio": "9:16",
        "description": "Key concept callout tags, bullet highlights, and clean typography.",
        "isSystem": True,
        "favorite": False,
        "thumbnailIcon": "💡",
        "data": {
            "aspectRatio": "9:16",
            "captionStyle": {
                "fontFamily": "Inter",
                "fontSize": 30,
                "fontWeight": 700,
                "textColor": "#FFFFFF",
                "activeWordColor": "#10B981",
                "backgroundColor": "#0F172A",
                "backgroundOpacity": 0.7,
                "outlineWidth": 0,
                "shadowBlur": 2,
                "position": "bottom",
                "animation": "slide_up"
            },
            "graphics": [
                {
                    "id": "tpl_edu_tag",
                    "type": "text",
                    "name": "Key Insight Callout",
                    "start": 0.0,
                    "end": 5.0,
                    "transform": { "x": 0, "y": -190, "width": 240, "height": 38, "scale": 100, "rotation": 0, "opacity": 100 },
                    "appearance": { "fill": "#10B981", "stroke": "#FFFFFF", "strokeWidth": 0, "cornerRadius": 6, "shadowBlur": 4, "shadowColor": "#000000" },
                    "typography": { "text": "PRO TIP 💡", "fontFamily": "Inter", "fontSize": 13, "fontWeight": 800, "color": "#000000" },
                    "animation": { "entrance": "slide_up", "exit": "fade_out" }
                }
            ],
            "audioTracks": [
                { "id": "track_video_audio", "type": "video_audio", "name": "Video Audio", "volume": 100, "muted": False },
                { "id": "track_music", "type": "music", "name": "Music", "volume": 55, "muted": False, "ducking": { "enabled": True, "amount": 70 } },
                { "id": "track_voice", "type": "voice", "name": "Voice / Voiceover", "volume": 100, "muted": False },
                { "id": "track_sfx", "type": "sfx", "name": "SFX", "volume": 85, "muted": False }
            ]
        }
    },
    {
        "id": "tpl_minimalist_reel",
        "name": "Minimalist Reel",
        "category": "Transitions",
        "aspectRatio": "9:16",
        "description": "Monochrome elegance with clean typography and subtle audio fades.",
        "isSystem": True,
        "favorite": False,
        "thumbnailIcon": "✦",
        "data": {
            "aspectRatio": "9:16",
            "captionStyle": {
                "fontFamily": "Inter",
                "fontSize": 28,
                "fontWeight": 600,
                "textColor": "#FFFFFF",
                "activeWordColor": "#FFFFFF",
                "backgroundColor": "#000000",
                "backgroundOpacity": 0.0,
                "outlineWidth": 1,
                "shadowBlur": 2,
                "position": "bottom",
                "animation": "none"
            },
            "graphics": [
                {
                    "id": "tpl_accent_line",
                    "type": "shape",
                    "name": "Minimal Line",
                    "start": 0.0,
                    "end": 6.0,
                    "transform": { "x": 0, "y": 140, "width": 200, "height": 6, "scale": 100, "rotation": 0, "opacity": 80 },
                    "appearance": { "fill": "#FFFFFF", "stroke": "#FFFFFF", "strokeWidth": 1 },
                    "content": { "shapeType": "line" },
                    "animation": { "entrance": "fade_in", "exit": "fade_out" }
                }
            ],
            "audioTracks": [
                { "id": "track_video_audio", "type": "video_audio", "name": "Video Audio", "volume": 90, "muted": False },
                { "id": "track_music", "type": "music", "name": "Music", "volume": 65, "muted": False, "ducking": { "enabled": False } },
                { "id": "track_voice", "type": "voice", "name": "Voice / Voiceover", "volume": 100, "muted": False },
                { "id": "track_sfx", "type": "sfx", "name": "SFX", "volume": 80, "muted": False }
            ]
        }
    },
    {
        "id": "tpl_social_story",
        "name": "Social Story",
        "category": "Social",
        "aspectRatio": "9:16",
        "description": "Engaging dynamic story with vibrant color accents and call-to-action arrow.",
        "isSystem": True,
        "favorite": True,
        "thumbnailIcon": "📱",
        "data": {
            "aspectRatio": "9:16",
            "captionStyle": {
                "fontFamily": "Poppins",
                "fontSize": 36,
                "fontWeight": 800,
                "textColor": "#FFFFFF",
                "activeWordColor": "#FFD700",
                "backgroundColor": "#6366F1",
                "backgroundOpacity": 0.5,
                "outlineWidth": 2,
                "position": "bottom",
                "animation": "pop"
            },
            "graphics": [
                {
                    "id": "tpl_story_arrow",
                    "type": "shape",
                    "name": "CTA Arrow",
                    "start": 1.0,
                    "end": 5.0,
                    "transform": { "x": 60, "y": 60, "width": 90, "height": 40, "scale": 100, "rotation": -45, "opacity": 100 },
                    "appearance": { "fill": "#EF4444", "stroke": "#FFFFFF", "strokeWidth": 1 },
                    "content": { "shapeType": "arrow" },
                    "animation": { "entrance": "bounce", "exit": "fade_out" }
                }
            ],
            "audioTracks": [
                { "id": "track_video_audio", "type": "video_audio", "name": "Video Audio", "volume": 100, "muted": False },
                { "id": "track_music", "type": "music", "name": "Music", "volume": 60, "muted": False, "ducking": { "enabled": True, "amount": 60 } },
                { "id": "track_voice", "type": "voice", "name": "Voice / Voiceover", "volume": 100, "muted": False },
                { "id": "track_sfx", "type": "sfx", "name": "SFX", "volume": 85, "muted": False }
            ]
        }
    },
    {
        "id": "tpl_interview_split",
        "name": "Interview Widescreen",
        "category": "Lower Thirds",
        "aspectRatio": "16:9",
        "description": "Dual lower-third guest names and widescreen title cards.",
        "isSystem": True,
        "favorite": False,
        "thumbnailIcon": "🎬",
        "data": {
            "aspectRatio": "16:9",
            "captionStyle": {
                "fontFamily": "Inter",
                "fontSize": 26,
                "fontWeight": 700,
                "textColor": "#FFFFFF",
                "activeWordColor": "#F59E0B",
                "backgroundColor": "#000000",
                "backgroundOpacity": 0.4,
                "outlineWidth": 0,
                "position": "bottom",
                "animation": "pop"
            },
            "graphics": [
                {
                    "id": "tpl_interview_lt",
                    "type": "lower_third",
                    "name": "Guest Title Card",
                    "start": 1.0,
                    "end": 6.0,
                    "transform": { "x": -80, "y": 80, "width": 240, "height": 42, "scale": 100, "rotation": 0, "opacity": 100 },
                    "appearance": { "fill": "#8B5CF6", "stroke": "#FFFFFF", "strokeWidth": 0, "cornerRadius": 4, "shadowBlur": 4, "shadowColor": "#000000" },
                    "typography": { "text": "Featured Guest", "fontFamily": "Inter", "fontSize": 14, "fontWeight": 700, "color": "#FFFFFF" },
                    "animation": { "entrance": "slide_up", "exit": "fade_out" }
                }
            ],
            "audioTracks": [
                { "id": "track_video_audio", "type": "video_audio", "name": "Video Audio", "volume": 100, "muted": False },
                { "id": "track_music", "type": "music", "name": "Music", "volume": 40, "muted": False, "ducking": { "enabled": True, "amount": 80 } },
                { "id": "track_voice", "type": "voice", "name": "Voice / Voiceover", "volume": 100, "muted": False },
                { "id": "track_sfx", "type": "sfx", "name": "SFX", "volume": 75, "muted": False }
            ]
        }
    },
    {
        "id": "tpl_vector_badge_graphic",
        "name": "Vector Accent & Badge",
        "category": "Graphics",
        "aspectRatio": "9:16",
        "description": "Graphic badge and decorative geometric elements.",
        "isSystem": True,
        "favorite": False,
        "thumbnailIcon": "✦",
        "data": {
            "aspectRatio": "9:16",
            "captionStyle": {
                "fontFamily": "Plus Jakarta Sans",
                "fontSize": 34,
                "fontWeight": 800,
                "textColor": "#FFFFFF",
                "activeWordColor": "#A855F7",
                "position": "bottom",
                "animation": "pop"
            },
            "graphics": [
                {
                    "id": "tpl_vector_badge",
                    "type": "shape",
                    "name": "Graphic Star Badge",
                    "start": 0.0,
                    "end": 5.0,
                    "transform": { "x": 0, "y": -200, "width": 150, "height": 38, "scale": 100, "rotation": 0, "opacity": 100 },
                    "appearance": { "fill": "#8B5CF6", "stroke": "#FFFFFF", "strokeWidth": 1.5, "cornerRadius": 8 },
                    "content": { "shapeType": "badge" },
                    "typography": { "text": "NEW RELEASE ★", "fontFamily": "Inter", "fontSize": 12, "fontWeight": 800, "color": "#FFFFFF" },
                    "animation": { "entrance": "pop", "exit": "fade_out" }
                }
            ],
            "audioTracks": [
                { "id": "track_video_audio", "type": "video_audio", "name": "Video Audio", "volume": 100, "muted": False }
            ]
        }
    }
]

DEFAULT_BRAND_KIT = {
    "primaryColor": "#8B5CF6",
    "secondaryColor": "#3B82F6",
    "accentColor": "#10B981",
    "textColor": "#FFFFFF",
    "backgroundColor": "#080808",
    "primaryFont": "Inter",
    "secondaryFont": "Anton",
    "logoUrl": "",
    "watermark": {
        "enabled": False,
        "text": "UpClip Studio",
        "opacity": 50,
        "position": "top_right"
    }
}

DEFAULT_PRESETS = {
    "captions": [
        { "id": "cap_clean", "name": "Clean", "category": "Clean", "fontFamily": "Inter", "fontSize": 32, "fontWeight": 700, "textColor": "#FFFFFF", "activeWordColor": "#38BDF8", "outlineWidth": 1, "outlineColor": "#000000", "shadowBlur": 2, "shadowColor": "#000000", "animation": "fade_in" },
        { "id": "cap_bold", "name": "Bold", "category": "Bold", "fontFamily": "Anton", "fontSize": 44, "fontWeight": 800, "textColor": "#FFFFFF", "activeWordColor": "#F43F5E", "outlineWidth": 4, "outlineColor": "#000000", "shadowBlur": 6, "shadowColor": "#000000", "animation": "bounce" },
        { "id": "cap_minimal", "name": "Minimal", "category": "Clean", "fontFamily": "DM Sans", "fontSize": 28, "fontWeight": 600, "textColor": "#FFFFFF", "activeWordColor": "#FFFFFF", "backgroundColor": "#000000", "backgroundOpacity": 0.0, "outlineWidth": 0, "animation": "none" },
        { "id": "cap_creator", "name": "Creator", "category": "Short-Form", "fontFamily": "Poppins", "fontSize": 36, "fontWeight": 800, "textColor": "#FFFFFF", "activeWordColor": "#22D3EE", "backgroundColor": "#0F172A", "backgroundOpacity": 0.5, "outlineWidth": 2, "animation": "pop" },
        { "id": "cap_podcast", "name": "Podcast", "category": "Speech", "fontFamily": "Montserrat", "fontSize": 34, "fontWeight": 800, "textColor": "#FFFFFF", "activeWordColor": "#FBBF24", "backgroundColor": "#000000", "backgroundOpacity": 0.7, "outlineWidth": 0, "animation": "fade_in" },
        { "id": "cap_news", "name": "News", "category": "Editorial", "fontFamily": "Arial Black", "fontSize": 36, "fontWeight": 900, "textColor": "#FFFFFF", "activeWordColor": "#EF4444", "backgroundColor": "#1E293B", "backgroundOpacity": 0.85, "outlineWidth": 2, "animation": "slide_up" },
        { "id": "cap_gaming", "name": "Gaming", "category": "High Energy", "fontFamily": "Bebas Neue", "fontSize": 48, "fontWeight": 900, "textColor": "#00FF66", "activeWordColor": "#FF0055", "outlineWidth": 4, "outlineColor": "#000000", "shadowBlur": 8, "shadowColor": "#000000", "animation": "pop" },
        { "id": "cap_dynamic", "name": "Dynamic", "category": "Modern", "fontFamily": "Plus Jakarta Sans", "fontSize": 38, "fontWeight": 800, "textColor": "#FFFFFF", "activeWordColor": "#A855F7", "outlineWidth": 3, "outlineColor": "#000000", "shadowBlur": 5, "shadowColor": "#000000", "animation": "pop" }
    ],
    "graphics": [
        { "id": "g_rect", "name": "Rectangle Box", "category": "Shapes", "type": "shape", "shapeType": "rect", "fill": "#6366F1", "width": 140, "height": 90 },
        { "id": "g_rounded", "name": "Rounded Card", "category": "Shapes", "type": "shape", "shapeType": "rounded_rect", "fill": "#6366F1", "width": 140, "height": 90 },
        { "id": "g_circle", "name": "Circle Accent", "category": "Shapes", "type": "shape", "shapeType": "circle", "fill": "#10B981", "width": 100, "height": 100 },
        { "id": "g_line", "name": "Accent Line", "category": "Graphics", "type": "shape", "shapeType": "line", "fill": "#38BDF8", "width": 160, "height": 8 },
        { "id": "g_arrow", "name": "Focus Arrow", "category": "Callouts", "type": "shape", "shapeType": "arrow", "fill": "#EF4444", "width": 120, "height": 50 },
        { "id": "g_lower_third_pro", "name": "Lower Third Pro", "category": "Lower Thirds", "type": "lower_third", "text": "Name | Title Role", "fill": "#8B5CF6", "width": 280, "height": 48 },
        { "id": "g_hot_tag", "name": "HOT Badge", "category": "Badges", "type": "shape", "shapeType": "badge", "text": "HOT 🔥", "fill": "#EF4444", "width": 140, "height": 34 },
        { "id": "g_pro_tag", "name": "PRO Badge", "category": "Badges", "type": "shape", "shapeType": "badge", "text": "PRO ✓", "fill": "#8B5CF6", "width": 140, "height": 34 }
    ],
    "audio": [
        { "id": "aud_voice_clarity", "name": "Voice Clarity & Ducking", "category": "Speech", "voiceVolume": 100, "musicVolume": 60, "duckingEnabled": True, "duckingAmount": 70 },
        { "id": "aud_upbeat_social", "name": "Upbeat Social Mix", "category": "Music", "voiceVolume": 95, "musicVolume": 75, "duckingEnabled": True, "duckingAmount": 55 },
        { "id": "aud_lofi_chill", "name": "Lo-Fi Background", "category": "Ambient", "voiceVolume": 100, "musicVolume": 50, "duckingEnabled": False, "duckingAmount": 0 }
    ],
    "export": [
        { "id": "exp_original", "name": "Source Original Resolution", "category": "Original", "width": 0, "height": 0, "fps": 30, "bitrate": "16M", "codec": "h264" },
        { "id": "exp_shorts_1080p", "name": "9:16 Vertical Shorts (1080p)", "category": "Social", "width": 1080, "height": 1920, "fps": 30, "bitrate": "12M", "codec": "h264" },
        { "id": "exp_youtube_1080p", "name": "16:9 Landscape YouTube (1080p)", "category": "Widescreen", "width": 1920, "height": 1080, "fps": 30, "bitrate": "14M", "codec": "h264" },
        { "id": "exp_square_1080p", "name": "1:1 Square Feed (1080p)", "category": "Social", "width": 1080, "height": 1080, "fps": 30, "bitrate": "10M", "codec": "h264" },
        { "id": "exp_portrait_4_5", "name": "4:5 Portrait Feed (1080p)", "category": "Social", "width": 1080, "height": 1350, "fps": 30, "bitrate": "11M", "codec": "h264" },
        { "id": "exp_draft_720p", "name": "Fast Draft Preview (720p)", "category": "Draft", "width": 720, "height": 1280, "fps": 30, "bitrate": "6M", "codec": "h264" }
    ]
}


class PresetManager:
    def __init__(self):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self._init_storage()

    def _init_storage(self):
        if not TEMPLATES_FILE.exists():
            with open(TEMPLATES_FILE, "w", encoding="utf-8") as f:
                json.dump([], f, indent=2)

        if not BRAND_KIT_FILE.exists():
            with open(BRAND_KIT_FILE, "w", encoding="utf-8") as f:
                json.dump(DEFAULT_BRAND_KIT, f, indent=2)

        if not CUSTOM_PRESETS_FILE.exists():
            with open(CUSTOM_PRESETS_FILE, "w", encoding="utf-8") as f:
                json.dump({ "captions": [], "graphics": [], "audio": [], "export": [] }, f, indent=2)

    def get_templates(self, category=None):
        """Return combined system templates and user templates."""
        user_templates = []
        try:
            if TEMPLATES_FILE.exists():
                with open(TEMPLATES_FILE, "r", encoding="utf-8") as f:
                    user_templates = json.load(f)
        except Exception as e:
            print("[PRESETS] Failed to read user templates:", e)

        all_templates = SYSTEM_TEMPLATES + user_templates
        if category and category != "All":
            all_templates = [t for t in all_templates if t.get("category", "").lower() == category.lower()]

        return all_templates

    def get_template_by_id(self, template_id):
        all_t = self.get_templates()
        return next((t for t in all_t if t.get("id") == template_id), None)

    def save_user_template(self, template_data):
        """Save a new user template."""
        user_templates = []
        try:
            if TEMPLATES_FILE.exists():
                with open(TEMPLATES_FILE, "r", encoding="utf-8") as f:
                    user_templates = json.load(f)
        except Exception:
            user_templates = []

        new_id = template_data.get("id") or f"tpl_user_{len(user_templates) + 1}_{int(time.time())}"
        template_data["id"] = new_id
        template_data["isSystem"] = False
        template_data["favorite"] = template_data.get("favorite", False)
        template_data["thumbnailIcon"] = template_data.get("thumbnailIcon", "🎨")

        existing_idx = next((i for i, t in enumerate(user_templates) if t.get("id") == new_id), -1)
        if existing_idx >= 0:
            user_templates[existing_idx] = template_data
        else:
            user_templates.append(template_data)

        with open(TEMPLATES_FILE, "w", encoding="utf-8") as f:
            json.dump(user_templates, f, indent=2)

        return template_data

    def delete_user_template(self, template_id):
        """Delete a user template. System templates cannot be deleted."""
        try:
            if TEMPLATES_FILE.exists():
                with open(TEMPLATES_FILE, "r", encoding="utf-8") as f:
                    user_templates = json.load(f)
                user_templates = [t for t in user_templates if t.get("id") != template_id or t.get("isSystem") is True]
                with open(TEMPLATES_FILE, "w", encoding="utf-8") as f:
                    json.dump(user_templates, f, indent=2)
                return True
        except Exception as e:
            print("[PRESETS] Delete template failed:", e)
        return False

    def get_brand_kit(self):
        try:
            if BRAND_KIT_FILE.exists():
                with open(BRAND_KIT_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception:
            pass
        return DEFAULT_BRAND_KIT

    def save_brand_kit(self, brand_data):
        with open(BRAND_KIT_FILE, "w", encoding="utf-8") as f:
            json.dump(brand_data, f, indent=2)
        return brand_data

    def get_presets(self):
        """Return default presets + custom user presets."""
        custom = { "captions": [], "graphics": [], "audio": [], "export": [] }
        try:
            if CUSTOM_PRESETS_FILE.exists():
                with open(CUSTOM_PRESETS_FILE, "r", encoding="utf-8") as f:
                    custom = json.load(f)
        except Exception:
            pass

        return {
            "captions": DEFAULT_PRESETS["captions"] + custom.get("captions", []),
            "graphics": DEFAULT_PRESETS["graphics"] + custom.get("graphics", []),
            "audio": DEFAULT_PRESETS["audio"] + custom.get("audio", []),
            "export": DEFAULT_PRESETS["export"] + custom.get("export", []),
            "brandKit": self.get_brand_kit()
        }

    def save_custom_preset(self, preset_type, preset_data):
        custom = { "captions": [], "graphics": [], "audio": [], "export": [] }
        try:
            if CUSTOM_PRESETS_FILE.exists():
                with open(CUSTOM_PRESETS_FILE, "r", encoding="utf-8") as f:
                    custom = json.load(f)
        except Exception:
            pass

        if preset_type not in custom:
            custom[preset_type] = []

        new_id = preset_data.get("id") or f"pre_{preset_type}_{len(custom[preset_type]) + 1}"
        preset_data["id"] = new_id

        custom[preset_type].append(preset_data)

        with open(CUSTOM_PRESETS_FILE, "w", encoding="utf-8") as f:
            json.dump(custom, f, indent=2)

        return preset_data


preset_manager = PresetManager()
