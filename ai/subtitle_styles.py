"""
=========================================
Subtitle Style Engine
Version : 1.0
=========================================

Subtitle Style Presets
"""

YOUTUBE = {
    "font": "Arial",
    "font_size": 22,
    "primary_color": "&HFFFFFF&",
    "outline_color": "&H000000&",
    "outline": 2,
    "shadow": 1,
    "alignment": 2,
    "margin_v": 30
}

TIKTOK = {
    "font": "Arial Black",
    "font_size": 26,
    "primary_color": "&H00FFFF&",
    "outline_color": "&H000000&",
    "outline": 3,
    "shadow": 2,
    "alignment": 2,
    "margin_v": 40
}

INSTAGRAM = {
    "font": "Montserrat",
    "font_size": 24,
    "primary_color": "&HFFFFFF&",
    "outline_color": "&H202020&",
    "outline": 2,
    "shadow": 2,
    "alignment": 2,
    "margin_v": 35
}

NETFLIX = {
    "font": "Arial",
    "font_size": 20,
    "primary_color": "&HFFFFFF&",
    "outline_color": "&H000000&",
    "outline": 1,
    "shadow": 0,
    "alignment": 2,
    "margin_v": 25
}

STYLES = {
    "youtube": YOUTUBE,
    "tiktok": TIKTOK,
    "instagram": INSTAGRAM,
    "netflix": NETFLIX
}


def get_style(name="youtube"):
    return STYLES.get(name.lower(), YOUTUBE)