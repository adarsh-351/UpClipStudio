"""
Video Scene Boundary Detector for UpClip Studio.
Analyzes visual frame differences and camera angle cuts to detect meaningful scenes.
"""

import re
import subprocess
from pathlib import Path

import config


class SceneDetector:
    def __init__(self, threshold=0.35):
        self.threshold = threshold
        self.ffmpeg = config.FFMPEG_PATH

    def detect_scenes(self, video_path, threshold=None):
        """
        Analyze video for visual scene changes.

        Returns:
            list of dicts: [{ id, start, end, duration, confidence, sceneNumber }]
        """
        video_path = Path(video_path)
        if not video_path.exists():
            return []

        th = threshold if threshold is not None else self.threshold

        # Get total duration
        from utils.video_utils import VideoLoader
        loader = VideoLoader(video_path)
        total_duration = float(loader.metadata().get("duration", 30.0))
        loader.close()

        # Run FFmpeg scene change filter
        cmd = [
            self.ffmpeg,
            "-i", str(video_path),
            "-filter:v", f"select='gt(scene,{th:.2f})',showinfo",
            "-f", "null",
            "-"
        ]

        timestamps = [0.0]
        confidences = [1.0]

        try:
            res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, check=False)
            stderr_output = res.stderr or ""
            matches = re.findall(r"pts_time:([\d\.]+)", stderr_output)
            for m in matches:
                t = float(m)
                if t > timestamps[-1] + 1.0 and t < total_duration - 0.5:
                    timestamps.append(round(t, 2))
                    confidences.append(0.85)
        except Exception as e:
            print("[SCENE] Detection failed, using fallback segmenting:", e)

        if len(timestamps) == 1:
            # Fallback: create natural pacing segments if no abrupt hard cuts found
            step = min(10.0, max(4.0, total_duration / 3.0))
            t = step
            while t < total_duration - 1.0:
                timestamps.append(round(t, 2))
                confidences.append(0.70)
                t += step

        timestamps.append(round(total_duration, 2))

        scenes = []
        for i in range(len(timestamps) - 1):
            start = timestamps[i]
            end = timestamps[i + 1]
            scenes.append({
                "id": f"scene_{i + 1}",
                "sceneNumber": i + 1,
                "start": start,
                "end": end,
                "duration": round(end - start, 2),
                "confidence": confidences[i] if i < len(confidences) else 0.8
            })

        return scenes
