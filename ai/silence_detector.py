"""
Silence and Dead-Air Detector for UpClip Studio.
Analyzes audio streams using FFmpeg silencedetect to find silent intervals,
pauses, and non-destructive speech-preserving cut segments.
"""

import re
import subprocess
from pathlib import Path

import config


class SilenceDetector:
    def __init__(self, noise_threshold_db=-30, min_duration_sec=0.5):
        self.noise_threshold_db = noise_threshold_db
        self.min_duration_sec = min_duration_sec
        self.ffmpeg = config.FFMPEG_PATH

    def detect_silence(self, media_path, noise_db=None, min_duration=None):
        """
        Analyze audio in media_path and return list of silent intervals and keep intervals.

        Returns:
            dict: {
                "silences": [{ "start": float, "end": float, "duration": float }],
                "keep_segments": [{ "start": float, "end": float, "duration": float }],
                "total_silence": float,
                "total_duration": float
            }
        """
        media_path = Path(media_path)
        if not media_path.exists():
            return {"silences": [], "keep_segments": [], "total_silence": 0, "total_duration": 0}

        noise = noise_db if noise_db is not None else self.noise_threshold_db
        duration = min_duration if min_duration is not None else self.min_duration_sec

        # Get total media duration
        total_duration = self._get_duration(media_path)

        cmd = [
            self.ffmpeg,
            "-i", str(media_path),
            "-af", f"silencedetect=noise={noise}dB:d={duration}",
            "-f", "null",
            "-"
        ]

        try:
            res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, check=False)
            stderr_output = res.stderr or ""
        except Exception as e:
            print("[SILENCE] Detection execution failed:", e)
            return {"silences": [], "keep_segments": [], "total_silence": 0, "total_duration": total_duration}

        silences = []
        start_matches = re.findall(r"silence_start: ([\d\.]+)", stderr_output)
        end_matches = re.findall(r"silence_end: ([\d\.]+) \| silence_duration: ([\d\.]+)", stderr_output)

        for idx in range(min(len(start_matches), len(end_matches))):
            s_start = float(start_matches[idx])
            s_end = float(end_matches[idx][0])
            s_dur = float(end_matches[idx][1])
            if s_dur >= duration:
                silences.append({
                    "id": f"silence_{idx}",
                    "start": round(s_start, 2),
                    "end": round(s_end, 2),
                    "duration": round(s_dur, 2)
                })

        # Calculate keep segments (speech regions between silences)
        keep_segments = []
        current_t = 0.0

        for s in silences:
            if s["start"] > current_t + 0.1:
                keep_segments.append({
                    "start": round(current_t, 2),
                    "end": round(s["start"], 2),
                    "duration": round(s["start"] - current_t, 2)
                })
            current_t = max(current_t, s["end"])

        if total_duration > current_t + 0.1:
            keep_segments.append({
                "start": round(current_t, 2),
                "end": round(total_duration, 2),
                "duration": round(total_duration - current_t, 2)
            })

        total_silence = sum(s["duration"] for s in silences)

        return {
            "silences": silences,
            "keep_segments": keep_segments,
            "total_silence": round(total_silence, 2),
            "total_duration": round(total_duration, 2)
        }

    def _get_duration(self, media_path):
        try:
            from utils.video_utils import VideoLoader
            loader = VideoLoader(media_path)
            dur = loader.metadata().get("duration", 0)
            loader.close()
            return float(dur)
        except Exception:
            return 30.0
