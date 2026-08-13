from pathlib import Path
import subprocess
import re

import config
from utils.video_utils import VideoLoader


class ClipGenerator:

    def __init__(self, video_path):
        self.video_path = Path(video_path)

    # ======================================================
    # Build FFmpeg filter for aspect-ratio smart crop
    # ======================================================

    def _build_crop_filter(self, target_width, target_height):
        """
        Build an ffmpeg scale + crop filter that does intelligent
        crop/reframe (center) instead of stretching.

        Returns None if no aspect change needed (original).
        """
        if target_width is None or target_height is None:
            return None

        return (
            f"scale={target_width}:{target_height}:force_original_aspect_ratio=increase,"
            f"crop={target_width}:{target_height}"
        )

    # ======================================================
    # Build FFmpeg scale filter for quality presets
    # ======================================================

    def _build_quality_filter(self, quality_key, target_w, target_h):
        """
        Build a scale filter enforcing a max resolution for the selected
        quality preset. Combined with the aspect crop filter when needed.

        Returns None if original quality (no scaling).
        """
        preset = config.QUALITY_PRESETS.get(
            quality_key,
            config.QUALITY_PRESETS[config.DEFAULT_QUALITY]
        )
        max_w, max_h = preset[1], preset[2]
        if max_w is None or max_h is None:
            return None

        # If aspect crop already determines exact dimensions, just cap them.
        if target_w and target_h:
            out_w = min(target_w, max_w)
            out_h = min(target_h, max_h)
            return f"scale={out_w}:{out_h}"

        # Otherwise scale down to fit within (max_w, max_h), preserving ratio.
        return (
            f"scale={max_w}:{max_h}:force_original_aspect_ratio=decrease"
        )

    # ======================================================
    # Create Single Clip
    # ======================================================

    def create_clip(
        self,
        start_time,
        duration,
        output_file,
        aspect_key="original",
        fps=None,
        quality=config.DEFAULT_QUALITY,
    ):
        """
        Create one MP4 clip using FFmpeg.

        start_time  : float start (seconds)
        duration    : float duration (seconds)
        output_file : Path output file
        aspect_key  : config.ASPECT_OPTIONS key (e.g. 'original', '9:16')
        quality     : config.QUALITY_PRESETS key (e.g. 'original', '1080p')
        """

        output_file = Path(output_file)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        # Resolve aspect ratio
        aspect = config.ASPECT_OPTIONS.get(
            aspect_key,
            config.ASPECT_OPTIONS["original"]
        )
        target_w, target_h = aspect[1], aspect[2]

        command = [
            config.FFMPEG_PATH,
            "-y",
            # Fast input seeking (before -i) for much faster start
            "-ss", str(start_time),
            "-i", str(self.video_path),
            "-t", str(duration),
        ]

        # Build combined video filter: aspect crop + quality scaling
        filters = []
        crop_filter = self._build_crop_filter(target_w, target_h)
        if crop_filter:
            filters.append(crop_filter)

        quality_filter = self._build_quality_filter(quality, target_w, target_h)
        if quality_filter:
            filters.append(quality_filter)

        if filters:
            command += ["-vf", ",".join(filters)]

        # Optional FPS (only when explicitly requested to avoid re-encode)
        if fps:
            command += ["-r", str(fps)]

        command += [
            "-c:v", config.VIDEO_CODEC,
            # Fast encoding preset + quality CRF
            "-preset", "veryfast",
            "-crf", "23",
            "-c:a", config.AUDIO_CODEC,
            str(output_file)
        ]

        try:
            subprocess.run(
                command,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=True
            )
            return output_file
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed : {output_file.name}")
            print(e)
            return None

    # ======================================================
    # Content-based clip naming
    # ======================================================

    def _slugify(self, text, max_len=40):
        """Convert arbitrary text to a safe filename slug."""
        text = (text or "").strip().lower()
        text = re.sub(r"[^\w\s-]", "", text)
        text = re.sub(r"[\s_]+", "_", text).strip("_")
        if not text:
            return None
        return text[:max_len]

    def _build_clip_name(
        self,
        index,
        naming,
        transcript=None,
        start_time=0,
        duration=0,
        existing_names=None,
    ):
        """
        Build a clip filename based on naming mode.

        naming      : config.NAME_SEQUENTIAL or config.NAME_CONTENT
        transcript  : optional list of {start,end,text} used for content names
        existing_names : optional set of already-used filenames to avoid duplicates
        """
        existing_names = existing_names or set()
        base_name = None

        if naming == config.NAME_CONTENT and transcript:
            base_name = self._get_content_name(transcript, start_time, index)
        elif naming == config.NAME_SEQUENTIAL:
            base_name = f"AI_Spark_Clip_{index:03d}"

        if not base_name:
            base_name = f"AI_Spark_Clip_{index:03d}"

        # Ensure filesystem-safe filename
        safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", base_name).strip("._")
        if not safe_name:
            safe_name = f"AI_Spark_Clip_{index:03d}"

        # Handle duplicate names
        final_name = f"{safe_name}.mp4"
        counter = 1
        while final_name in existing_names:
            final_name = f"{safe_name}_{counter:02d}.mp4"
            counter += 1

        existing_names.add(final_name)
        return final_name

    def _get_content_name(self, transcript, start_time, index):
        """Extract a meaningful content-based name from transcript."""
        if not transcript:
            return f"AI_Spark_Clip_{index:03d}"

        # Find the transcript segment that overlaps the clip start
        best_seg = None
        best_score = -1
        for seg in transcript:
            seg_start = float(seg.get("start", 0))
            seg_end = float(seg.get("end", 0))
            if seg_start <= start_time <= seg_end + 0.5:
                text = (seg.get("text") or "").strip()
                score = len(text)
                if score > best_score:
                    best_score = score
                    best_seg = text

        if not best_seg or best_score < 3:
            return f"AI_Spark_Clip_{index:03d}"

        # Extract key words from the transcript text
        words = re.findall(r"[A-Za-z]{3,}", best_seg)
        if not words:
            return f"AI_Spark_Clip_{index:03d}"

        # Use first few meaningful words
        key_words = words[:4]
        slug = "_".join(key_words).lower()
        return slug[:50] if slug else f"AI_Spark_Clip_{index:03d}"

    # ======================================================
    # Phase 3 - Split by Fixed Duration
    # ======================================================

    def split_video(
        self,
        clip_duration=None,
        aspect_key="original",
        naming=config.NAME_SEQUENTIAL,
        transcript=None,
        fps=None,
        quality=config.DEFAULT_QUALITY,
    ):

        if clip_duration is None:
            clip_duration = config.CLIP_DURATION

        loader = VideoLoader(self.video_path)
        info = loader.metadata()
        total_duration = int(info["duration"])
        loader.close()

        clips = []
        start = 0
        index = 1
        used_names = set()

        print("\nGenerating Fixed Clips...")
        print("-" * 50)

        while start < total_duration:

            duration = min(
                clip_duration,
                total_duration - start
            )

            filename = self._build_clip_name(
                index, naming, transcript, start, duration, used_names
            )
            output_file = config.CLIPS_DIR / filename

            clip = self.create_clip(
                start,
                duration,
                output_file,
                aspect_key=aspect_key,
                fps=fps,
                quality=quality,
            )

            if clip:
                clips.append(clip)
                print(
                    f"✅ Clip {index:03d} | "
                    f"{start:.1f}s → {start+duration:.1f}s"
                )

            start += clip_duration
            index += 1

        print("-" * 50)
        print(f"Total Fixed Clips : {len(clips)}")

        return clips

    # ======================================================
    # Build clips from scene segments with modes
    # ======================================================

    def generate_clips(
        self,
        scenes,
        mode=config.CLIPPING_AI,
        clip_duration=None,
        clip_count=None,
        aspect_key="original",
        naming=config.NAME_SEQUENTIAL,
        transcript=None,
        fps=None,
        quality=config.DEFAULT_QUALITY,
    ):
        """
        Generate clips from detected scenes according to user clipping mode.

        mode : config.CLIPPING_AI | CLIPPING_DURATION | CLIPPING_COUNT

        - AI mode: uses merged scenes as-is (AI decides count & duration)
        - DURATION mode: splits into fixed-duration clips, up to all possible
        - COUNT mode: picks N best scenes (evenly spaced) and adjusts duration
        """
        if mode == config.CLIPPING_DURATION:
            return self.split_video(
                clip_duration=clip_duration or config.CLIP_DURATION,
                aspect_key=aspect_key,
                naming=naming,
                transcript=transcript,
                fps=fps,
                quality=quality,
            )

        if mode == config.CLIPPING_COUNT:
            return self._generate_by_count(
                scenes,
                clip_count=clip_count or 1,
                aspect_key=aspect_key,
                naming=naming,
                transcript=transcript,
                fps=fps,
                quality=quality,
            )

        # Default: AI mode generates one unique edited clip per scene.
        # This keeps the output aligned with the final workflow: each detected
        # scene becomes a complete, stand-alone clip with no duplicate versions.
        return self.split_by_scenes(
            scenes,
            aspect_key=aspect_key,
            naming=naming,
            transcript=transcript,
            fps=fps,
            quality=quality,
        )

    # ======================================================
    # COUNT mode - pick N best scenes
    # ======================================================

    def _generate_by_count(
        self,
        scenes,
        clip_count,
        aspect_key="original",
        naming=config.NAME_SEQUENTIAL,
        transcript=None,
        fps=None,
        quality=config.DEFAULT_QUALITY,
    ):
        """Pick `clip_count` best scenes evenly spaced through the video."""
        clips = []
        if not scenes:
            return clips

        # We use merged-like scenes; pick evenly spaced indices
        n = len(scenes)
        if clip_count >= n:
            selected_indices = list(range(n))
        else:
            step = n / clip_count
            selected_indices = [int(i * step) for i in range(clip_count)]

        print("\nGenerating Clips by Count...")
        print("-" * 50)
        used_names = set()

        for pos, idx in enumerate(selected_indices, start=1):
            scene = scenes[idx]
            start = scene["start"]
            end = scene["end"]
            duration = end - start
            if duration < config.MIN_SCENE_DURATION:
                continue

            filename = self._build_clip_name(
                pos, naming, transcript, start, duration, used_names
            )
            output_file = config.CLIPS_DIR / filename

            clip = self.create_clip(
                start,
                duration,
                output_file,
                aspect_key=aspect_key,
                fps=fps,
                quality=quality,
            )

            if clip:
                clips.append(clip)
                print(
                    f"🎬 Clip {pos:03d} | "
                    f"{start:.2f}s → {end:.2f}s"
                )

        print("-" * 50)
        print(f"Total Count Clips : {len(clips)}")
        return clips

    # ======================================================
    # Split by Scene Detection (AI mode)
    # ======================================================

    def split_by_scenes(
        self,
        scenes,
        aspect_key="original",
        naming=config.NAME_SEQUENTIAL,
        transcript=None,
        fps=None,
        quality=config.DEFAULT_QUALITY,
    ):

        clips = []

        print("\nGenerating Scene Clips...")
        print("-" * 50)

        index = 1
        used_names = set()

        for scene in scenes:

            start = scene["start"]
            end = scene["end"]

            duration = end - start

            # Skip very small scenes
            if duration < config.MIN_SCENE_DURATION:
                continue

            # Cap very long scenes to max clip duration
            if duration > config.MAX_CLIP_DURATION:
                duration = config.MAX_CLIP_DURATION

            filename = self._build_clip_name(
                index, naming, transcript, start, duration, used_names
            )
            output_file = config.CLIPS_DIR / filename

            clip = self.create_clip(
                start,
                duration,
                output_file,
                aspect_key=aspect_key,
                fps=fps,
                quality=quality,
            )

            if clip:
                clips.append(clip)
                print(
                    f"🎬 Scene {index:03d} | "
                    f"{start:.2f}s → {end:.2f}s"
                )

            index += 1

        print("-" * 50)
        print(f"Total Scene Clips : {len(clips)}")

        return clips
