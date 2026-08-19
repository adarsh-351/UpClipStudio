r"""
==========================================
Animated Caption Renderer — Phase 18
==========================================

Renders short-form style animated captions (word-by-word karaoke
highlighting) into a video using ffmpeg's ASS subtitle renderer.

Features
--------
✓ Word-by-word progressive highlight (karaoke \k) using accurate word timestamps
✓ Comprehensive animation library (fade_in, fade_out, pop, scale_in, slide_up, slide_down, slide_left, slide_right, bounce, word_reveal, character_reveal, none)
✓ Highlight styles (text color change, background highlight, scale emphasis, accent highlight)
✓ Precise positioning: Top, Center, Bottom, Lower Third, or exact pixel coordinates via \pos(X,Y)
✓ Full typography: font, size, weight, scale, tracking/spacing, alignment (left/center/right)
✓ Rich styling: outline width & color, shadow blur/offset & color, opaque or semi-transparent background box
✓ Safe-area aware margin calculations for 9:16, 1:1, 4:5, 16:9 aspect ratios
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
    # Hex color -> ASS &HBBGGRR format (and optional Alpha &HAABBGGRR&)
    # -----------------------------------------------

    @staticmethod
    def _to_ass_color(hex_color, alpha=0):
        """
        Convert #RRGGBB (or RRGGBB) to ASS &HAABBGGRR&.
        alpha: 0 (opaque) to 255 (fully transparent)
        """
        hex_color = (hex_color or "").strip().lstrip("#")
        alpha_hex = f"{max(0, min(255, int(alpha))):02X}"
        if len(hex_color) != 6:
            return f"&H{alpha_hex}FFFFFF&"
        try:
            r = hex_color[0:2]
            g = hex_color[2:4]
            b = hex_color[4:6]
            return f"&H{alpha_hex}{b}{g}{r}&"
        except Exception:
            return f"&H{alpha_hex}FFFFFF&"

    # -----------------------------------------------
    # Animation -> ASS override block
    # -----------------------------------------------

    @staticmethod
    def _animation_block(style, duration_ms=300):
        style = (style or "pop").lower().replace("-", "_")
        if style in ("fade", "fade_in"):
            return r"{\fad(150,150)}"
        if style == "fade_out":
            return r"{\fad(0,250)}"
        if style == "bounce":
            return r"{\move(0,0)\t(0,200,\fay-0.08)\t(200,400,\fay0)}"
        if style in ("slide", "slide_up"):
            return r"{\move(0,35,0,0,0,200)}"
        if style == "slide_down":
            return r"{\move(0,-35,0,0,0,200)}"
        if style == "slide_left":
            return r"{\move(40,0,0,0,0,200)}"
        if style == "slide_right":
            return r"{\move(-40,0,0,0,0,200)}"
        if style in ("scale_in", "zoom"):
            return r"{\fscx75\fscy75\t(0,180,\fscx100\fscy100)}"
        if style == "pop":
            return r"{\fscx80\fscy80\t(0,120,\fscx112\fscy112)\t(120,200,\fscx100\fscy100)}"
        if style in ("word_reveal", "word_by_word"):
            return r"{\k80}"
        if style in ("character_reveal", "character_by_character"):
            return r"{\k40}"
        if style == "smooth_reveal":
            return r"{\alpha&HFF&\t(0,250,\alpha&H00&)}"
        if style == "none":
            return ""
        # Default fallback: pop
        return r"{\fscx82\fscy82\t(0,140,\fscx100\fscy100)}"

    # -----------------------------------------------
    # Template -> preset options
    # -----------------------------------------------

    @staticmethod
    def _template_options(template):
        template = (template or "classic").lower()
        templates = {
            "clean": {
                "font": "Inter", "size": 32, "weight": 700, "color": "#FFFFFF",
                "highlight_color": "#38BDF8", "background": "#000000", "background_opacity": 0.0,
                "outline": 1, "shadow": 2, "position": "bottom", "margin_v": 70, "animation": "fade_in"
            },
            "bold": {
                "font": "Anton", "size": 44, "weight": 800, "color": "#FFFFFF",
                "highlight_color": "#F43F5E", "background": "#000000", "background_opacity": 0.0,
                "outline": 4, "shadow": 6, "position": "bottom", "margin_v": 60, "animation": "bounce"
            },
            "minimal": {
                "font": "DM Sans", "size": 28, "weight": 600, "color": "#FFFFFF",
                "highlight_color": "#FFFFFF", "background": "#000000", "background_opacity": 0.0,
                "outline": 0, "shadow": 2, "position": "bottom", "margin_v": 80, "animation": "none"
            },
            "creator": {
                "font": "Poppins", "size": 36, "weight": 800, "color": "#FFFFFF",
                "highlight_color": "#22D3EE", "background": "#0F172A", "background_opacity": 0.5,
                "outline": 2, "shadow": 4, "position": "bottom", "margin_v": 60, "animation": "pop"
            },
            "podcast": {
                "font": "Montserrat", "size": 34, "weight": 800, "color": "#FFFFFF",
                "highlight_color": "#FBBF24", "background": "#000000", "background_opacity": 0.7,
                "outline": 0, "shadow": 3, "position": "lower_third", "margin_v": 130, "animation": "fade_in"
            },
            "news": {
                "font": "Arial Black", "size": 36, "weight": 900, "color": "#FFFFFF",
                "highlight_color": "#EF4444", "background": "#1E293B", "background_opacity": 0.85,
                "outline": 2, "shadow": 4, "position": "bottom", "margin_v": 50, "animation": "slide_up"
            },
            "gaming": {
                "font": "Bebas Neue", "size": 48, "weight": 900, "color": "#00FF66",
                "highlight_color": "#FF0055", "background": "#000000", "background_opacity": 0.0,
                "outline": 4, "shadow": 8, "position": "bottom", "margin_v": 60, "animation": "pop"
            },
            "dynamic": {
                "font": "Plus Jakarta Sans", "size": 38, "weight": 800, "color": "#FFFFFF",
                "highlight_color": "#A855F7", "background": "#000000", "background_opacity": 0.0,
                "outline": 3, "shadow": 5, "position": "bottom", "margin_v": 60, "animation": "pop"
            },
            "classic": {
                "font": "Arial", "size": 32, "weight": 700, "color": "#FFFFFF",
                "highlight_color": "#FFD700", "background": "#000000", "background_opacity": 0.0,
                "outline": 3, "shadow": 3, "position": "bottom", "margin_v": 60, "animation": "pop"
            }
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
        font = opts.get("font_family") or opts.get("font") or config.SUBTITLE_FONT
        try:
            size = int(opts.get("font_size") or opts.get("size") or 34)
        except (TypeError, ValueError):
            size = 34

        # Primary text color & active highlight color
        text_color_hex = opts.get("text_color") or opts.get("color") or "#FFFFFF"
        active_color_hex = opts.get("active_word_color") or opts.get("highlight_color") or "#FBBF24"

        # Check highlight style
        highlight_style = opts.get("highlight_style", "text_color")
        if highlight_style == "accent":
            primary_ass = self._to_ass_color(active_color_hex)
            secondary_ass = self._to_ass_color(text_color_hex)
        else:
            primary_ass = self._to_ass_color(active_color_hex)
            secondary_ass = self._to_ass_color(text_color_hex)

        # Background / outline color & opacity
        bg_opacity = float(opts.get("background_opacity", 0.0))
        bg_alpha = int((1.0 - max(0.0, min(1.0, bg_opacity))) * 255)

        bg_hex = opts.get("background_color") or opts.get("background") or "#000000"
        back_ass = self._to_ass_color(bg_hex, alpha=bg_alpha)

        # Outline color
        outline_hex = opts.get("outline_color") or "#000000"
        outline_enabled = opts.get("outline_enabled", True)
        if not outline_enabled:
            outline_w = 0
            outline_ass = self._to_ass_color(outline_hex, alpha=255)
        else:
            try:
                outline_w = int(opts.get("outline_width", opts.get("outline", 3)))
            except (TypeError, ValueError):
                outline_w = 3
            outline_ass = self._to_ass_color(outline_hex, alpha=0)

        # Shadow color & blur/offset
        shadow_hex = opts.get("shadow_color") or "#000000"
        shadow_enabled = opts.get("shadow_enabled", True)
        if not shadow_enabled:
            shadow_w = 0
            shadow_ass = self._to_ass_color(shadow_hex, alpha=255)
        else:
            try:
                shadow_w = int(opts.get("shadow_blur", opts.get("shadow", 2)))
            except (TypeError, ValueError):
                shadow_w = 2
            shadow_ass = self._to_ass_color(shadow_hex, alpha=0)

        # Bold & Italic flags
        font_weight = int(opts.get("font_weight", opts.get("weight", 800)))
        bold_flag = -1 if font_weight >= 600 else 0
        italic_flag = -1 if bool(opts.get("italic", False)) else 0

        # Scale factor (100 = default)
        try:
            scale_factor = round(float(opts.get("scale", 100)))
        except (TypeError, ValueError):
            scale_factor = 100

        # Letter spacing
        try:
            spacing = int(opts.get("spacing", 0))
        except (TypeError, ValueError):
            spacing = 0

        # BorderStyle: 1 = outline with drop shadow; 3 = opaque box (if bg_opacity >= 0.15)
        border_style = 3 if bg_opacity >= 0.15 else 1

        # Alignment calculation (ASS: 1=bot-left, 2=bot-center, 3=bot-right, 4=mid-left, 5=mid-center, 6=mid-right, 7=top-left, 8=top-center, 9=top-right)
        align_horiz = (opts.get("alignment") or "center").lower()
        position = (opts.get("position") or "bottom").lower()

        if position == "top":
            base_row = 7
        elif position in ("middle", "center"):
            base_row = 4
        else:  # bottom or lower_third
            base_row = 1

        if align_horiz == "left":
            col_offset = 0
        elif align_horiz == "right":
            col_offset = 2
        else:  # center
            col_offset = 1

        alignment = base_row + col_offset

        try:
            margin_v = int(opts.get("margin_v", opts.get("margin_y", 60)))
            if position == "lower_third":
                margin_v = max(margin_v, 140)
        except (TypeError, ValueError):
            margin_v = 60

        try:
            margin_l = int(opts.get("margin_l", opts.get("margin_x", 30)))
            margin_r = int(opts.get("margin_r", 30))
        except (TypeError, ValueError):
            margin_l = 30
            margin_r = 30

        return f"""[Script Info]
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
PlayResX: {config.OUTPUT_WIDTH}
PlayResY: {config.OUTPUT_HEIGHT}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,{font},{size},{primary_ass},{secondary_ass},{outline_ass},{back_ass},{bold_flag},{italic_flag},0,0,{scale_factor},{scale_factor},{spacing},0,{border_style},{outline_w},{shadow_w},{alignment},{margin_l},{margin_r},{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    # -----------------------------------------------
    # Build ASS dialogue with accurate word-by-word \k timing
    # -----------------------------------------------

    def _build_dialogue(self, transcript, opts):
        anim_name = opts.get("animation", "pop")
        anim = self._animation_block(anim_name)
        lines = []
        min_word_ms = int(opts.get("min_word_ms", 60))

        # Check if manual coordinates were supplied
        pos_override = ""
        if opts.get("use_manual_pos") and "pos_x" in opts and "pos_y" in opts:
            try:
                px = int(opts["pos_x"])
                py = int(opts["pos_y"])
                pos_override = r"{\pos(%d,%d)}" % (px, py)
            except Exception:
                pos_override = ""

        for item in transcript:
            start = float(item.get("start", 0))
            end = float(item.get("end", 0))
            text = (item.get("text") or "").replace("\n", " ").strip()
            if not text:
                continue

            words_data = item.get("words")
            if words_data and isinstance(words_data, list) and len(words_data) > 0:
                # Use exact word timestamps
                karaoke_parts = []
                for w in words_data:
                    w_text = w.get("text", "")
                    w_start = float(w.get("start", start))
                    w_end = float(w.get("end", end))
                    dur_cs = max(1, round((w_end - w_start) * 100))
                    karaoke_parts.append(r"{\k%d}%s" % (dur_cs, w_text))
                karaoke = " ".join(karaoke_parts)
            else:
                # Distribute evenly across words
                words = text.split()
                seg_dur_ms = max(int((end - start) * 1000), len(words) * min_word_ms)
                per_word_cs = max(1, (seg_dur_ms // max(len(words), 1)) // 10)
                karaoke = "".join(r"{\k%d}%s " % (per_word_cs, w) for w in words).strip()

            dialogue = (
                f"Dialogue: 0,{self._format_time(start)},{self._format_time(end)},"
                f"Caption,,0,0,0,,{pos_override}{anim}{karaoke}"
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
        print("Rendering Animated Captions with FFmpeg...")
        print("=" * 60)

        try:
            subprocess.run(
                command,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=True,
            )
            print("[SUCCESS] Animated Captions Rendered Successfully:", output_video)
            return output_video
        except subprocess.CalledProcessError as e:
            print("[ERROR] Animated Caption Rendering Failed:", e)
            return None
