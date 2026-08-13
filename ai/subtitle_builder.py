"""
==========================================
Subtitle Builder
Version : 1.0
Author  : AI Shorts Generator
==========================================

Features

✓ JSON Transcript → SRT
✓ JSON Transcript → VTT
✓ Save Subtitle Files
✓ Auto Directory Creation
✓ UTF-8 Support
✓ Production Ready
"""

from pathlib import Path


class SubtitleBuilder:

    def __init__(self):

        pass

    # -------------------------------------
    # Seconds -> SRT Time
    # -------------------------------------

    def format_srt_time(self, seconds):

        hours = int(seconds // 3600)

        minutes = int((seconds % 3600) // 60)

        secs = int(seconds % 60)

        milliseconds = int((seconds - int(seconds)) * 1000)

        return (
            f"{hours:02d}:"
            f"{minutes:02d}:"
            f"{secs:02d},"
            f"{milliseconds:03d}"
        )

    # -------------------------------------
    # Seconds -> VTT Time
    # -------------------------------------

    def format_vtt_time(self, seconds):

        hours = int(seconds // 3600)

        minutes = int((seconds % 3600) // 60)

        secs = int(seconds % 60)

        milliseconds = int((seconds - int(seconds)) * 1000)

        return (
            f"{hours:02d}:"
            f"{minutes:02d}:"
            f"{secs:02d}."
            f"{milliseconds:03d}"
        )

    # -------------------------------------
    # Create SRT
    # -------------------------------------

    def create_srt(self, transcript):

        lines = []

        for index, item in enumerate(transcript, start=1):

            start = self.format_srt_time(item["start"])

            end = self.format_srt_time(item["end"])

            text = item["text"]

            lines.append(str(index))

            lines.append(f"{start} --> {end}")

            lines.append(text)

            lines.append("")

        return "\n".join(lines)

    # -------------------------------------
    # Create VTT
    # -------------------------------------

    def create_vtt(self, transcript):

        lines = ["WEBVTT", ""]

        for item in transcript:

            start = self.format_vtt_time(item["start"])

            end = self.format_vtt_time(item["end"])

            text = item["text"]

            lines.append(f"{start} --> {end}")

            lines.append(text)

            lines.append("")

        return "\n".join(lines)

    # -------------------------------------
    # Save SRT
    # -------------------------------------

    def save_srt(self, transcript, output_file):

        output_file = Path(output_file)

        output_file.parent.mkdir(
            parents=True,
            exist_ok=True
        )

        srt = self.create_srt(transcript)

        with open(
            output_file,
            "w",
            encoding="utf-8"
        ) as file:

            file.write(srt)

        print(f"✅ SRT Saved : {output_file}")

    # -------------------------------------
    # Save VTT
    # -------------------------------------

    def save_vtt(self, transcript, output_file):

        output_file = Path(output_file)

        output_file.parent.mkdir(
            parents=True,
            exist_ok=True
        )

        vtt = self.create_vtt(transcript)

        with open(
            output_file,
            "w",
            encoding="utf-8"
        ) as file:

            file.write(vtt)

        print(f"✅ VTT Saved : {output_file}")

    # -------------------------------------
    # Save Both
    # -------------------------------------

    def save_all(
        self,
        transcript,
        srt_file,
        vtt_file
    ):

        self.save_srt(
            transcript,
            srt_file
        )

        self.save_vtt(
            transcript,
            vtt_file
        )

        print("✅ Subtitle Generation Completed")