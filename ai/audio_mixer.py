"""
Professional Multi-Track Audio Mixer for UpClip Studio.
Handles non-destructive audio editing, mixing Video Audio, Music, Voiceover, and SFX
with timing offsets, clip/track volumes, fades, panning, ducking, and master mixdown using FFmpeg.
"""

import subprocess
from pathlib import Path

import config


class AudioMixer:
    def __init__(self):
        self.ffmpeg = config.FFMPEG_PATH

    def mix_and_export(
        self,
        input_video,
        audio_tracks,
        audio_clips,
        output_video,
        video_audio_volume=100.0,
        video_audio_muted=False
    ):
        """
        Mix video audio and multi-track audio clips into the output video.

        input_video        : Path or str to source video
        audio_tracks       : list of track dicts [{ id, type, name, volume, muted, solo, ducking }]
        audio_clips        : list of clip dicts [{ id, trackId, name, filename, url, start, end, fadeIn, fadeOut, volume, speed, muted }]
        output_video       : Path or str to target output video
        video_audio_volume : volume percentage for original video audio (0-200)
        video_audio_muted  : bool to silence original video audio
        """
        input_video = Path(input_video)
        output_video = Path(output_video)
        output_video.parent.mkdir(parents=True, exist_ok=True)

        if not input_video.exists():
            raise FileNotFoundError(f"Input video not found: {input_video}")

        # Check for solo tracks
        solo_track_ids = {t["id"] for t in audio_tracks if t.get("solo") is True}
        
        # Build track lookup
        tracks_map = {t["id"]: t for t in audio_tracks}

        # Filter active clips
        active_clips = []
        for clip in audio_clips:
            if clip.get("muted") is True:
                continue
            track = tracks_map.get(clip.get("trackId"))
            if track:
                if track.get("muted") is True:
                    continue
                if solo_track_ids and track["id"] not in solo_track_ids:
                    continue
            active_clips.append(clip)

        # If no custom audio clips and video audio is unchanged, simple copy or volume adjust
        if not active_clips and (video_audio_muted or video_audio_volume != 100.0):
            if video_audio_muted:
                # Remove audio stream entirely
                cmd = [self.ffmpeg, "-y", "-i", str(input_video), "-c:v", "copy", "-an", str(output_video)]
            else:
                vol_factor = video_audio_volume / 100.0
                cmd = [
                    self.ffmpeg, "-y", "-i", str(input_video),
                    "-c:v", "copy", "-filter:a", f"volume={vol_factor:.2f}",
                    "-c:a", "aac", str(output_video)
                ]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            return output_video
        elif not active_clips and not video_audio_muted and video_audio_volume == 100.0:
            cmd = [self.ffmpeg, "-y", "-i", str(input_video), "-c", "copy", str(output_video)]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            return output_video

        # Multi-track mixing with FFmpeg filter_complex
        input_args = ["-i", str(input_video)]
        filter_chains = []
        mix_streams = []

        # 1. Process Video Original Audio (Input 0)
        has_video_audio = not video_audio_muted and (not solo_track_ids or "track_video_audio" in solo_track_ids)
        if has_video_audio:
            vol_factor = max(0.0, video_audio_volume / 100.0)
            filter_chains.append(f"[0:a]volume={vol_factor:.2f},aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a_vid]")
            mix_streams.append("[a_vid]")

        # 2. Process Custom Audio Clips
        voice_streams = []
        music_streams = []
        other_streams = []

        for idx, clip in enumerate(active_clips):
            file_path = self._resolve_audio_file(clip)
            if not file_path or not file_path.exists():
                print(f"[WARN] Audio file not found for clip: {clip.get('name')}")
                continue

            input_idx = len(input_args) // 2
            input_args.extend(["-i", str(file_path)])

            start_sec = float(clip.get("start", 0))
            end_sec = float(clip.get("end", start_sec + float(clip.get("duration", 5))))
            dur = max(0.1, end_sec - start_sec)
            start_ms = int(round(start_sec * 1000))

            track = tracks_map.get(clip.get("trackId"), {})
            track_vol = float(track.get("volume", 100)) / 100.0
            clip_vol = float(clip.get("volume", 100)) / 100.0
            effective_vol = max(0.0, track_vol * clip_vol)

            fade_in = float(clip.get("fadeIn", 0))
            fade_out = float(clip.get("fadeOut", 0))
            speed = float(clip.get("speed", 1.0))

            # Build clip filter chain
            filters = []
            
            # Trim source range if specified
            src_start = float(clip.get("sourceStart", 0))
            src_end = float(clip.get("sourceEnd", src_start + dur))
            filters.append(f"atrim=start={src_start:.2f}:end={src_end:.2f}")
            filters.append("asetpts=PTS-STARTPTS")

            # Speed adjustment
            if abs(speed - 1.0) > 0.01 and 0.5 <= speed <= 2.0:
                filters.append(f"atempo={speed:.2f}")

            # Volume scaling
            filters.append(f"volume={effective_vol:.2f}")

            # Voice cleanup, noise reduction, normalization
            if clip.get("noiseReduction") is True or track.get("noiseReduction") is True:
                filters.append("afftdn")
            if clip.get("voiceEnhance") is True or track.get("voiceEnhance") is True:
                filters.append("highpass=f=80,lowpass=f=8000")
            if clip.get("normalize") is True or track.get("normalize") is True:
                filters.append("loudnorm")

            # Fade In
            if fade_in > 0.05:
                filters.append(f"afade=t=in:st=0:d={fade_in:.2f}")

            # Fade Out
            if fade_out > 0.05:
                fade_start = max(0.0, dur - fade_out)
                filters.append(f"afade=t=out:st={fade_start:.2f}:d={fade_out:.2f}")

            # Channel format & Delay to timeline start
            filters.append("aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo")
            filters.append(f"adelay={start_ms}|{start_ms}")

            out_label = f"[a_clip_{idx}]"
            filter_chains.append(f"[{input_idx}:a]" + ",".join(filters) + out_label)

            track_type = track.get("type", "sfx")
            if track_type == "voice":
                voice_streams.append(out_label)
            elif track_type == "music":
                music_streams.append(out_label)
            else:
                other_streams.append(out_label)

        # 3. Check for Audio Ducking (Music ducks when Voice speaks)
        ducking_enabled = any(
            t.get("type") == "music" and t.get("ducking", {}).get("enabled") is True
            for t in audio_tracks
        )

        if ducking_enabled and voice_streams and music_streams:
            # Merge music streams
            if len(music_streams) > 1:
                filter_chains.append(f"{''.join(music_streams)}amix=inputs={len(music_streams)}:duration=longest:dropout_transition=0[m_merged]")
                m_stream = "[m_merged]"
            else:
                m_stream = music_streams[0]

            # Merge voice streams
            if len(voice_streams) > 1:
                filter_chains.append(f"{''.join(voice_streams)}amix=inputs={len(voice_streams)}:duration=longest:dropout_transition=0[v_merged]")
                v_stream = "[v_merged]"
            else:
                v_stream = voice_streams[0]

            # Sidechain compression for clean automatic ducking
            filter_chains.append(f"{m_stream}{v_stream}sidechaincompress=threshold=0.06:ratio=5:attack=40:release=350[m_ducked]")
            mix_streams.append("[m_ducked]")
            mix_streams.append(v_stream)
        else:
            mix_streams.extend(music_streams)
            mix_streams.extend(voice_streams)

        mix_streams.extend(other_streams)

        # 4. Master Mixdown
        if not mix_streams:
            # All muted
            cmd = [self.ffmpeg, "-y", "-i", str(input_video), "-c:v", "copy", "-an", str(output_video)]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            return output_video

        if len(mix_streams) > 1:
            filter_chains.append(f"{''.join(mix_streams)}amix=inputs={len(mix_streams)}:duration=first:dropout_transition=0[a_master]")
            master_label = "[a_master]"
        else:
            master_label = mix_streams[0]

        filter_str = ";".join(filter_chains)

        command = [
            self.ffmpeg, "-y",
            *input_args,
            "-filter_complex", filter_str,
            "-map", "0:v",
            "-map", master_label,
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            str(output_video)
        ]

        print("[AUDIO] Mixing and rendering multi-track audio with FFmpeg...")
        subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        print("[SUCCESS] Master audio mix rendered to:", output_video)

        return output_video

    def _resolve_audio_file(self, clip):
        filename = clip.get("filename") or Path(clip.get("url", "")).name
        if not filename:
            return None

        candidates = [
            config.ROOT_DIR / "static" / "audio" / filename,
            config.INPUT_DIR / "audio" / filename,
            config.INPUT_DIR / filename,
            config.ROOT_DIR / "static" / filename,
            Path("static/audio") / filename,
            Path("assets/audio") / filename
        ]

        for p in candidates:
            if p.exists():
                return p.resolve()

        return None
