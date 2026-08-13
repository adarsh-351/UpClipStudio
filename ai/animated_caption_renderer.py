r"""
==========================================
Animated Caption Renderer
Version : 1.0
==========================================

Renders short-form style animated captions (word-by-word karaoke
highlighting) into a video using ffmpeg's ASS subtitle renderer.

Features
--------
✓ Word-by-word progressive highlight (karaoke \k)
✓ Multiple animation styles (pop / fade / bounce / slide / zoom / none)
✓ Position controls (bottom / top / middle)
✓ Font, size, color, background / outline controls
✓ Synchronized to transcript timing
✓ Enable / disable toggle
✓ Separate render step from normal subtitles
"""

from pathlib import Path
import subprocess

import config


class AnimatedCaptionRenderer:

    def __init__(self):
        self.ffmpeg = config.FFMPEG_PATH

    # -----------------------------------------------
    # ASS time formatting  (H:MM:SS.cc)
    # -----------------------------------------------

    @staticmethod
    def _format_time(seconds):
        seconds = max(0.0, float(seconds))
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        sec = seconds % 60
        return f"{hours}:{minutes:02d}:{sec:05.2f}"

    # -----------------------------------------------
    # Hex color -> ASS &HBBGGRR format
    # -----------------------------------------------

    @staticmethod
    def _to_ass_color(hex_color):
        """Convert #RRGGBB (or RRGGBB) to ASS &HBBGGRR&."""
        hex_color = (hex_color or "").strip().lstrip("#")
        if len(hex_color) != 6:
            return "&H00FFFFFF&"  # white default
        try:
            r = hex_color[0:2]
            g = hex_color[2:4]
            b = hex_color[4:6]
            return f"&H00{b}{g}{r}&"
        except Exception:
            return "&H00FFFFFF&"

    # -----------------------------------------------
    # Animation -> ASS override block
    # -----------------------------------------------

    @staticmethod
    def _animation_block(style):
        style = (style or "pop").lower()
        if style == "fade":
            return r"{\fad(120,120)}"
        if style == "bounce":
            return r"{\move(0,0)\t(0,250,\fay-0.08)\t(250,500,\fay0)}"
        if style == "slide":
            return r"{\move(0,40,0,0,0,250)}"
        if style == "zoom":
            return r"{\fscx110\fscy110\t(0,250,\fscx100\fscy100)}"
        if style == "none":
            return ""
        if style == "scale":
            return r"{\fscx80\fscy80\t(0,200,\fscx110\fscy110)}"
        if style == "typewriter":
            return r"{\alpha&HFF&\t(0,200,\alpha&H00&)}"
        if style == "highlight":
            return r"{\c&H00FFFF&\t(0,200,\c&HFFFFFF&)}"
        if style == "karaoke":
            return r"{\k150}"
        if style == "punch":
            return r"{\fscx70\fscy70\t(0,100,\fscx110\fscy110\t(100,200,\fscx95\fscy95))}"
        if style == "smooth_reveal":
            return r"{\alpha&HFF&\t(0,300,\alpha&H00&\frx0\fry0\frz0)}"
        if style == "word_by_word":
            return r"{\k100}"
        if style == "character_by_character":
            return r"{\k50}"
        # default: pop
        return r"{\fscx82\fscy82\t(0,150,\fscx100\fscy100)}"

    # -----------------------------------------------
    # Template -> preset options
    # -----------------------------------------------

    @staticmethod
    def _template_options(template):
        template = (template or "classic").lower()
        templates = {
            "classic": {
                "font": "Arial", "size": 32, "color": "#FFFFFF",
                "background": "#000000", "outline": 3, "position": "bottom",
                "margin_v": 60, "animation": "pop",
            },
            "bold": {
                "font": "Arial Black", "size": 40, "color": "#FFFFFF",
                "background": "#000000", "outline": 4, "position": "bottom",
                "margin_v": 60, "animation": "pop",
            },
            "minimal": {
                "font": "Inter", "size": 26, "color": "#FFFFFF",
                "background": "#000000", "outline": 1, "position": "bottom",
                "margin_v": 80, "animation": "fade",
            },
            "social": {
                "font": "Poppins", "size": 34, "color": "#FFFFFF",
                "background": "#6366f1", "outline": 2, "position": "bottom",
                "margin_v": 60, "animation": "slide",
            },
            "viral": {
                "font": "Bebas Neue", "size": 44, "color": "#FFD700",
                "background": "#FF314F", "outline": 3, "position": "bottom",
                "margin_v": 48, "animation": "bounce",
            },
            "creator": {
                "font": "Space Grotesk", "size": 30, "color": "#FFFFFF",
                "background": "#22d3ee", "outline": 2, "position": "bottom",
                "margin_v": 60, "animation": "slide",
            },
            "highlight": {
                "font": "Montserrat", "size": 36, "color": "#000000",
                "background": "#FFD700", "outline": 0, "position": "bottom",
                "margin_v": 60, "animation": "highlight",
            },
            "karaoke": {
                "font": "Arial Black", "size": 38, "color": "#00FF00",
                "background": "#000000", "outline": 3, "position": "bottom",
                "margin_v": 60, "animation": "karaoke",
            },
            "dynamic": {
                "font": "Oswald", "size": 36, "color": "#FFFFFF",
                "background": "#7C3AED", "outline": 3, "position": "bottom",
                "margin_v": 60, "animation": "scale",
            },
            "word_by_word": {
                "font": "Roboto", "size": 32, "color": "#FFFFFF",
                "background": "#000000", "outline": 2, "position": "bottom",
                "margin_v": 60, "animation": "word_by_word",
            },
            "pop": {
                "font": "Arial Black", "size": 34, "color": "#FFFFFF",
                "background": "#000000", "outline": 3, "position": "bottom",
                "margin_v": 60, "animation": "pop",
            },
            "bounce": {
                "font": "Arial Black", "size": 34, "color": "#FFFFFF",
                "background": "#000000", "outline": 3, "position": "bottom",
                "margin_v": 60, "animation": "bounce",
            },
            "typewriter": {
                "font": "Courier New", "size": 30, "color": "#FFFFFF",
                "background": "#000000", "outline": 2, "position": "bottom",
                "margin_v": 60, "animation": "typewriter",
            },
            "emphasis": {
                "font": "Anton", "size": 40, "color": "#FF4444",
                "background": "#000000", "outline": 3, "position": "bottom",
                "margin_v": 60, "animation": "punch",
            },
            "modern": {
                "font": "DM Sans", "size": 30, "color": "#FFFFFF",
                "background": "#1a2233", "outline": 1, "position": "bottom",
                "margin_v": 80, "animation": "fade",
            },
            "clean": {
                "font": "Manrope", "size": 28, "color": "#FFFFFF",
                "background": "#000000", "outline": 1, "position": "bottom",
                "margin_v": 80, "animation": "smooth_reveal",
            },
        }
        return templates.get(template, templates["classic"])

    # -----------------------------------------------
    # Merge template + user overrides
    # -----------------------------------------------

    @staticmethod
    def resolve_opts(opts=None, template=None):
        opts = dict(opts or {})
        if template:
            template_opts = AnimatedCaptionRenderer._template_options(template)
            template_opts.update(opts)
            return template_opts
        return opts

    # -----------------------------------------------
    # Build ASS header with configurable style
    # -----------------------------------------------

    def _build_header(self, opts):
        font = opts.get("font", config.SUBTITLE_FONT)
        try:
            size = int(opts.get("size", 30))
        except (TypeError, ValueError):
            size = 30

        primary = self._to_ass_color(opts.get("color", "#FFFFFF"))
        # Background / outline color
        bg_hex = opts.get("background", "#000000")
        outline = self._to_ass_color(bg_hex)

        # Outline width
        try:
            outline_w = int(opts.get("outline", 3))
        except (TypeError, ValueError):
            outline_w = 3

        # Position -> ASS alignment
        position = opts.get("position", "bottom")
        alignment_map = {
            "bottom": 2,
            "top": 8,
            "middle": 5,
            "safe_bottom": 2,
        }
        alignment = alignment_map.get(position, 2)

        # Vertical margin (increase for safe_bottom)
        try:
            margin_v = int(opts.get("margin_v", 60))
            if position == "safe_bottom":
                margin_v = max(margin_v, 120)
        except (TypeError, ValueError):
            margin_v = 60

        return f"""[Script Info]
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
PlayResX: {config.OUTPUT_WIDTH}
PlayResY: {config.OUTPUT_HEIGHT}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,{font},{size},{primary},&H0000FFFF&,{outline},&H64000000&,-1,0,0,0,100,100,0,0,1,{outline_w},1,{alignment},30,30,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    # -----------------------------------------------
    # Build ASS dialogue with word-by-word \k timing
    # -----------------------------------------------

    def _build_dialogue(self, transcript, opts):
        anim = self._animation_block(opts.get("animation", "pop"))
        lines = []
        min_word_ms = int(opts.get("min_word_ms", 60))

        for item in transcript:
            start = float(item.get("start", 0))
            end = float(item.get("end", 0))
            text = (item.get("text") or "").replace("\n", " ").strip()
            if not text:
                continue

            words = text.split()
            seg_dur_ms = max(int((end - start) * 1000), len(words) * min_word_ms)
            per_word = max(min_word_ms, seg_dur_ms // max(len(words), 1))

            # Karaoke: {\k<centiseconds>}word  -> progressively highlights
            karaoke = "".join(r"{\k%d}%s" % (per_word, w) for w in words)

            dialogue = (
                f"Dialogue: 0,{self._format_time(start)},{self._format_time(end)},"
                f"Caption,,0,0,0,,{anim}{karaoke}"
            )
            lines.append(dialogue)

        return "\n".join(lines)

    # -----------------------------------------------
    # Build full ASS subtitle string
    # -----------------------------------------------

    def build_ass(self, transcript, opts=None, template=None):
        opts = self.resolve_opts(opts, template)
        header = self._build_header(opts)
        dialogue = self._build_dialogue(transcript, opts)
        return header + "\n" + dialogue + "\n"

    # -----------------------------------------------
    # Save ASS to file
    # -----------------------------------------------

    def save_ass(self, transcript, output_file, opts=None, template=None):
        output_file = Path(output_file)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        ass = self.build_ass(transcript, opts, template)
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(ass)
        return output_file

    # -----------------------------------------------
    # Render animated captions into the video
    # -----------------------------------------------

    def render(
        self,
        input_video,
        transcript,
        output_video,
        opts=None,
        template=None,
    ):
        """
        Burn animated captions into a video using ffmpeg ASS filter.

        input_video  : Path or str source video
        transcript   : list of {start, end, text}
        output_video : Path or str destination MP4
        opts         : dict of caption style options
        template     : optional template name (classic, bold, minimal, etc.)
        """
        input_video = Path(input_video)
        output_video = Path(output_video)
        output_video.parent.mkdir(parents=True, exist_ok=True)

        if not input_video.exists():
            raise FileNotFoundError(input_video)

        # Merge template + user overrides
        merged_opts = self.resolve_opts(opts, template)

        # Build & save the ASS file
        ass_dir = config.SUBTITLE_DIR
        ass_file = ass_dir / f"{output_video.stem}_captions.ass"
        self.save_ass(transcript, ass_file, merged_opts)

        # Windows path escaping for the ASS filter
        ass_path = ass_file.resolve().as_posix().replace("\\", "\\\\").replace(":", "\\:")

        command = [
            self.ffmpeg,
            "-y",
            "-i", str(input_video),
            "-vf", f"ass='{ass_path}'",
            "-c:v", config.VIDEO_CODEC,
            "-preset", "veryfast",
            "-crf", "23",
            "-c:a", config.AUDIO_CODEC,
            str(output_video),
        ]

        print("=" * 60)
        print("Rendering Animated Captions...")
        print("=" * 60)

        try:
            subprocess.run(
                command,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=True,
            )
            print()
            print("✅ Animated Captions Rendered Successfully")
            print(output_video)
            return output_video
        except subprocess.CalledProcessError as e:
            print("❌ Animated Caption Rendering Failed")
            print(e)
            return None
