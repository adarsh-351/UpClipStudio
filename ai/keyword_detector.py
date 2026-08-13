"""
=========================================
AI Keyword Highlight Detector
Version : 1.0
=========================================
"""

import json
from pathlib import Path


class KeywordDetector:

    def __init__(self):

        self.keywords = {

            # AI
            "ai": 10,
            "chatgpt": 10,
            "openai": 10,
            "gemini": 8,

            # Attention
            "secret": 9,
            "breaking": 9,
            "exclusive": 8,
            "warning": 8,
            "important": 8,

            # Money
            "money": 9,
            "earn": 9,
            "income": 8,
            "profit": 8,
            "business": 8,

            # Viral
            "free": 8,
            "top": 6,
            "best": 7,
            "viral": 9,
            "amazing": 8,

            # Education
            "learn": 6,
            "course": 5,
            "python": 6,
            "coding": 6,
            "project": 7,

            # Shorts
            "youtube": 6,
            "shorts": 7,
            "instagram": 6,
            "reels": 6
        }

    # -----------------------------------------

    def score_text(self, text):

        score = 0

        matched = []

        words = text.lower().split()

        for word in words:

            word = word.strip(".,!?()[]{}\"'")

            if word in self.keywords:

                score += self.keywords[word]

                matched.append(word)

        return score, matched

    # -----------------------------------------

    def detect(self, transcript):

        highlights = []

        for segment in transcript:

            score, matched = self.score_text(
                segment["text"]
            )

            item = {

                "start": segment["start"],

                "end": segment["end"],

                "text": segment["text"],

                "score": score,

                "keywords": matched

            }

            highlights.append(item)

        return highlights

    # -----------------------------------------

    def top_segments(self,
                     highlights,
                     min_score=8):

        return [

            h

            for h in highlights

            if h["score"] >= min_score

        ]

    # -----------------------------------------

    def save_json(
            self,
            highlights,
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
        ) as f:

            json.dump(
                highlights,
                f,
                indent=4,
                ensure_ascii=False
            )

        print(f"Keyword JSON Saved : {output_file}")