"""=========================================
Professional ASS Subtitle Builder
Version : 2.0
=========================================

Features
--------
✓ ASS Subtitle Generation
✓ Animation Support
✓ Config Based Animation
✓ UTF-8 Support
✓ Production Ready
"""

from pathlib import Path

import config
from ai.ass_animation import ASSAnimation


class ASSBuilder:

    def __init__(self):

        self.header = """
[Script Info]
Title: YouTube AI Shorts
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding

Style: Default,Arial,24,&H00FFFFFF,&H0000FFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,2,1,2,20,20,35,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    # ------------------------------------

    def format_time(self, seconds):

        hours = int(seconds // 3600)

        minutes = int((seconds % 3600) // 60)

        sec = seconds % 60

        return f"{hours}:{minutes:02d}:{sec:05.2f}"

    # ------------------------------------

    def get_animation(self):

        animation = config.ASS_ANIMATION.lower()

        if animation == "pop":
            return ASSAnimation.pop()

        elif animation == "zoom":
            return ASSAnimation.zoom()

        elif animation == "fade":
            return ASSAnimation.fade()

        elif animation == "bounce":
            return ASSAnimation.bounce()

        else:
            return ASSAnimation.none()

    # ------------------------------------

    def create(self, transcript):

        animation = self.get_animation()

        lines = [self.header]

        for item in transcript:

            start = self.format_time(item["start"])

            end = self.format_time(item["end"])

            text = item["text"].replace("\n", " ")

            dialogue = (
                f"Dialogue: 0,"
                f"{start},"
                f"{end},"
                f"Default,,0,0,0,,"
                f"{animation}{text}"
            )

            lines.append(dialogue)

        return "\n".join(lines)

    # ------------------------------------

    def save(self, transcript, output_file):

        output_file = Path(output_file)

        output_file.parent.mkdir(
            parents=True,
            exist_ok=True
        )

        ass_text = self.create(transcript)

        with open(
            output_file,
            "w",
            encoding="utf-8"
        ) as file:

            file.write(ass_text)

        print(f"✅ ASS Subtitle Saved : {output_file}")