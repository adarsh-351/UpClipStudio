"""
==========================================
AI Caption Builder
Version : 1.0
==========================================

Creates short caption blocks from
Whisper transcript.

Author : YouTube AI Shorts Generator
"""

import json
from pathlib import Path


class CaptionBuilder:

    def __init__(
        self,
        max_words=3,
        max_chars=24
    ):

        self.max_words = max_words
        self.max_chars = max_chars

    # -----------------------------------------

    def build(self, transcript):

        captions = []

        for segment in transcript:

            words = segment["text"].split()

            if not words:
                continue

            start = segment["start"]
            end = segment["end"]

            total_duration = end - start

            if total_duration <= 0:
                continue

            duration_per_word = total_duration / len(words)

            index = 0

            while index < len(words):

                group = []

                while (
                    index < len(words)
                    and len(group) < self.max_words
                ):

                    candidate = " ".join(
                        group + [words[index]]
                    )

                    if len(candidate) > self.max_chars:
                        break

                    group.append(words[index])

                    index += 1

                caption_text = " ".join(group)

                caption_start = (
                    start +
                    (index - len(group))
                    * duration_per_word
                )

                caption_end = (
                    caption_start +
                    len(group)
                    * duration_per_word
                )

                captions.append({

                    "start": round(caption_start, 2),

                    "end": round(caption_end, 2),

                    "text": caption_text

                })

        return captions

    # -----------------------------------------

    def save_json(
        self,
        captions,
        output_file
    ):

        output_file = Path(output_file)

        output_file.parent.mkdir(
            parents=True,
            exist_ok=True
        )

        with open(
            output_file,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                captions,
                file,
                indent=4,
                ensure_ascii=False
            )

        print(f"✅ Caption JSON Saved : {output_file}")