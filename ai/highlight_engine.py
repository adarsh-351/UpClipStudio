"""
AI Highlight & Short-Form Clip Suggestion Engine for UpClip Studio.
Identifies engaging moments, core topic explanations, and standalone segments.
"""

from pathlib import Path
import config


class HighlightEngine:
    def __init__(self):
        pass

    def detect_highlights(self, video_path, transcript=None, scenes=None, min_duration=8.0, max_duration=60.0):
        """
        Generate candidate short-form clips and highlight suggestions.

        Returns:
            list of dicts: [{ id, title, start, end, duration, score, reason, category }]
        """
        video_path = Path(video_path)
        if not video_path.exists():
            return []

        # Get video duration
        from utils.video_utils import VideoLoader
        loader = VideoLoader(video_path)
        total_duration = float(loader.metadata().get("duration", 30.0))
        loader.close()

        highlights = []

        # If transcript segments are available
        segments = (transcript or {}).get("segments", [])

        if segments and len(segments) > 0:
            current_chunk_words = []
            chunk_start = float(segments[0].get("start", 0))
            chunk_text = ""

            for seg in segments:
                s_start = float(seg.get("start", 0))
                s_end = float(seg.get("end", s_start + 2.0))
                text = seg.get("text", "").strip()

                chunk_text += " " + text
                current_chunk_words.extend(text.split())

                dur = s_end - chunk_start
                if dur >= min_duration or seg == segments[-1]:
                    if dur <= max_duration:
                        score = self._compute_relevance_score(chunk_text, dur)
                        title = self._generate_clip_title(chunk_text, len(highlights) + 1)
                        reason = self._generate_reason(chunk_text, score)
                        category = self._categorize_segment(chunk_text, len(highlights))

                        highlights.append({
                            "id": f"hl_{len(highlights) + 1}",
                            "title": title,
                            "start": round(chunk_start, 2),
                            "end": round(min(total_duration, s_end), 2),
                            "duration": round(min(total_duration, s_end) - chunk_start, 2),
                            "score": score,
                            "reason": reason,
                            "category": category
                        })

                    # Reset for next chunk
                    chunk_start = s_end
                    chunk_text = ""
                    current_chunk_words = []
        else:
            # Pacing & scene-based segment proposal
            step = min(15.0, total_duration)
            t = 0.0
            idx = 1
            while t < total_duration:
                end_t = min(total_duration, t + step)
                if end_t - t >= 4.0:
                    highlights.append({
                        "id": f"hl_{idx}",
                        "title": f"Key Moment {idx}",
                        "start": round(t, 2),
                        "end": round(end_t, 2),
                        "duration": round(end_t - t, 2),
                        "score": 85 if idx == 1 else 78,
                        "reason": "Strong visual pacing and continuous action",
                        "category": "Highlight" if idx == 1 else "Action"
                    })
                    idx += 1
                t = end_t

        # Sort highlights by relevance score descending
        highlights.sort(key=lambda x: x["score"], reverse=True)
        return highlights

    def _compute_relevance_score(self, text, duration):
        """Calculate a transparent, deterministic AI relevance score between 60 and 96."""
        score = 70
        word_count = len(text.split())
        words_per_sec = word_count / max(1.0, duration)

        # High engagement speech density (2.0 - 3.5 words/sec)
        if 2.0 <= words_per_sec <= 3.5:
            score += 12
        elif words_per_sec > 1.2:
            score += 6

        # Key engagement keywords
        keywords = ["secret", "how to", "best", "important", "never", "tip", "always", "because", "finally", "step", "first", "watch"]
        lower = text.lower()
        matched = sum(1 for kw in keywords if kw in lower)
        score += min(14, matched * 4)

        return min(96, max(60, score))

    def _generate_clip_title(self, text, idx):
        words = [w for w in text.split() if len(w) > 2][:4]
        if words:
            return " ".join(words).title()
        return f"Clip Highlight {idx}"

    def _generate_reason(self, text, score):
        if score > 88:
            return "High speech density with strong topic emphasis"
        elif score > 78:
            return "Clear explanation with active pacing"
        else:
            return "Standalone content moment"

    def _categorize_segment(self, text, idx):
        if idx == 0:
            return "Hook / Intro"
        elif idx == 1:
            return "Main Point"
        elif "tip" in text.lower() or "how" in text.lower():
            return "Insight"
        else:
            return "Takeaway"
