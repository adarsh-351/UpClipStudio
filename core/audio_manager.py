"""
Professional Audio Manager for UpClip Studio.
Extracts and caches zoom-aware audio waveform peaks, performs multi-track audio diagnostics,
and defines standard professional audio presets.
"""

import os
import json
import wave
import struct
import subprocess
from pathlib import Path

import config

DATA_DIR = config.ROOT_DIR / "data"
WAVEFORMS_DIR = DATA_DIR / "waveforms"


class AudioManager:
    def __init__(self):
        WAVEFORMS_DIR.mkdir(parents=True, exist_ok=True)

    def get_waveform_peaks(self, media_path, num_peaks=100):
        """
        Generate or load cached audio waveform peaks.
        Returns a list of floats [0.0 - 1.0].
        """
        media_path = Path(media_path)
        if not media_path.exists():
            # In case it is a filename, try input/audio or input directories
            found = False
            for parent in (config.INPUT_DIR / "audio", config.INPUT_DIR, config.CLIPS_DIR):
                test_p = parent / media_path.name
                if test_p.exists():
                    media_path = test_p
                    found = True
                    break
            if not found:
                # Return dummy flat peaks
                return [0.1] * num_peaks

        cache_path = WAVEFORMS_DIR / f"{media_path.stem}_peaks_{num_peaks}.json"
        if cache_path.exists():
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass

        peaks = self._extract_peaks(media_path, num_peaks)
        try:
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(peaks, f)
        except Exception as e:
            print("[AUDIO] Waveform cache failed:", e)

        return peaks

    def _extract_peaks(self, media_path, num_peaks):
        """Extract peak levels using wave module or fallback FFmpeg extraction."""
        temp_wav = None
        is_wav = media_path.suffix.lower() == ".wav"

        # If not a native WAV, extract a mono WAV segment using FFmpeg
        if not is_wav:
            temp_wav = WAVEFORMS_DIR / f"temp_{media_path.stem}.wav"
            cmd = [
                config.FFMPEG_PATH, "-y",
                "-i", str(media_path),
                "-vn",
                "-ac", "1",
                "-ar", "8000",
                "-t", "30",  # analyze first 30 seconds max for waveform speed
                str(temp_wav)
            ]
            try:
                subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
                wav_path = temp_wav
            except Exception:
                # Fallback to dummy peaks if ffmpeg conversion fails
                return [0.15 + (i % 3) * 0.05 for i in range(num_peaks)]
        else:
            wav_path = media_path

        peaks = []
        try:
            with wave.open(str(wav_path), "rb") as w:
                nchannels = w.getnchannels()
                sampwidth = w.getsampwidth()
                nframes = w.getnframes()
                
                if nframes == 0:
                    return [0.1] * num_peaks

                frames_per_peak = max(1, nframes // num_peaks)
                for _ in range(num_peaks):
                    frame_data = w.readframes(frames_per_peak)
                    if not frame_data:
                        peaks.append(0.0)
                        continue

                    # Unpack 16-bit PCM mono frames
                    if sampwidth == 2:
                        count = len(frame_data) // 2
                        fmt = f"<{count}h"
                        try:
                            shorts = struct.unpack(fmt, frame_data)
                            max_val = max(abs(val) for val in shorts) if shorts else 0
                            peak = min(1.0, max_val / 32767.0)
                        except Exception:
                            peak = 0.1
                    else:
                        peak = 0.1
                    peaks.append(round(peak, 3))
        except Exception as e:
            print("[AUDIO] Waveform parsing error:", e)
            peaks = [0.2 + (i % 4) * 0.04 for i in range(num_peaks)]
        finally:
            if temp_wav and temp_wav.exists():
                try:
                    temp_wav.unlink()
                except Exception:
                    pass

        # Normalize peaks
        max_peak = max(peaks) if peaks else 0
        if max_peak > 0.01:
            peaks = [round(p / max_peak, 3) for p in peaks]

        return peaks

    def analyze_audio_health(self, audio_tracks, audio_clips):
        """Run professional health and diagnostics audit of the current audio timeline."""
        issues = []
        
        # 1. Check for active clips on muted tracks
        for t in audio_tracks:
            if t.get("muted") is True:
                track_clips = [c for c in audio_clips if c.get("trackId") == t["id"]]
                if track_clips:
                    issues.append({
                        "level": "warning",
                        "category": "Muted Track",
                        "message": f"Track '{t['name']}' is muted but contains {len(track_clips)} active clips.",
                        "trackId": t["id"]
                    })

        # 2. Check for clipping risks
        for c in audio_clips:
            vol = float(c.get("volume", 100))
            if vol > 120:
                issues.append({
                    "level": "warning",
                    "category": "Clipping Risk",
                    "message": f"Clip '{c.get('name')}' volume is set very high ({vol}%), which may cause clipping distortion.",
                    "clipId": c.get("id")
                })

        # 3. Check for missing media assets
        for c in audio_clips:
            fn = c.get("filename")
            if fn:
                found = False
                for p in (config.INPUT_DIR / "audio", config.INPUT_DIR, config.CLIPS_DIR):
                    if (p / fn).exists():
                        found = True
                        break
                if not found:
                    issues.append({
                        "level": "error",
                        "category": "Missing Asset",
                        "message": f"Audio file '{fn}' is missing. Click to relink or replace.",
                        "clipId": c.get("id")
                    })

        # Default clean response if no issues
        if not issues:
            issues.append({
                "level": "info",
                "category": "Clean Mix",
                "message": "✓ Audio levels are balanced and all media files are online."
            })

        return {
            "success": True,
            "issues": issues
        }


audio_manager = AudioManager()
