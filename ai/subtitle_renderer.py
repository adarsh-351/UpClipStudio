"""
==========================================
Subtitle Renderer
Version : 1.1
==========================================

Features

✓ Burn SRT into Video
✓ Burn VTT into Video
✓ Custom Font
✓ Font Size
✓ Font Color
✓ Border
✓ Shadow
✓ Fast Encoding (veryfast preset)
"""

from pathlib import Path
from ai.subtitle_styles import get_style
import subprocess
import config


class SubtitleRenderer:

    def __init__(self):

        self.ffmpeg = config.FFMPEG_PATH

    # -----------------------------------------
    # Burn Subtitle
    # -----------------------------------------

    def burn_subtitle(
        self,
        input_video,
        subtitle_file,
        output_video,
        style_options=None,
    ):

        input_video = Path(input_video)
        subtitle_file = Path(subtitle_file)
        output_video = Path(output_video)

        output_video.parent.mkdir(
            parents=True,
            exist_ok=True
        )

        if not input_video.exists():
            raise FileNotFoundError(input_video)

        if not subtitle_file.exists():
            raise FileNotFoundError(subtitle_file)

        # Windows path fix
        subtitle_path = subtitle_file.resolve().as_posix()
        # Escape colons and backslashes for the ffmpeg subtitles filter
        subtitle_path = subtitle_path.replace("\\", "\\\\").replace(":", "\\:")

        # Merge base style with custom style_options
        style_data = get_style(config.SUBTITLE_STYLE)
        if style_options:
            style_data = dict(style_data)
            style_data.update(style_options)

        style = (
            f"FontName={style_data['font']},"
            f"FontSize={style_data['font_size']},"
            f"PrimaryColour={style_data['primary_color']},"
            f"OutlineColour={style_data['outline_color']},"
            f"BorderStyle=1,"
            f"Outline={style_data['outline']},"
            f"Shadow={style_data['shadow']},"
            f"Alignment={style_data['alignment']},"
            f"MarginV={style_data['margin_v']}"
        )

        command = [
            self.ffmpeg,
            "-y",
            # Fast input seeking
            "-ss", "0",
            "-i", str(input_video),
            "-vf",
            f"subtitles='{subtitle_path}':force_style='{style}'",
            # Fast encoding
            "-preset", "veryfast",
            "-crf", "23",
            "-c:a", "copy",
            str(output_video)
        ]

        print("=" * 60)
        print("Burning Subtitles...")
        print("=" * 60)

        try:

            subprocess.run(
                command,
                check=True
            )

            print()
            print("✅ Subtitle Burned Successfully")
            print(output_video)

        except subprocess.CalledProcessError:

            print("❌ Subtitle Rendering Failed")
