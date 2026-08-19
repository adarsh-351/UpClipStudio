"""
Core Render Queue & Background Worker for UpClip Studio.
Manages asynchronous sequential video rendering jobs, progress reporting, process logging,
and post-render validation.
"""

import os
import time
import json
import uuid
import queue
import threading
import subprocess
from pathlib import Path

import config
from utils.video_utils import VideoLoader
from ai.graphics_renderer import GraphicsRenderer
from ai.audio_mixer import AudioMixer
from ai.animated_caption_renderer import AnimatedCaptionRenderer

DATA_DIR = config.ROOT_DIR / "data"
LOGS_DIR = DATA_DIR / "render_logs"
HISTORY_FILE = DATA_DIR / "render_history.json"


class RenderQueueManager:
    def __init__(self):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        LOGS_DIR.mkdir(parents=True, exist_ok=True)
        
        self.jobs_queue = queue.Queue()
        self.jobs_map = {}  # job_id -> job dict
        self.active_job = None
        self.lock = threading.Lock()
        self.cancel_events = {}  # job_id -> Event
        
        self._load_history()
        
        # Start persistent worker thread
        self.worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.worker_thread.start()

    def _load_history(self):
        if HISTORY_FILE.exists():
            try:
                with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                    history = json.load(f)
                    for job in history:
                        self.jobs_map[job["id"]] = job
            except Exception as e:
                print("[RENDER QUEUE] Failed to load render history:", e)

    def _save_history(self):
        try:
            with open(HISTORY_FILE, "w", encoding="utf-8") as f:
                history_list = list(self.jobs_map.values())
                json.dump(history_list[-50:], f, indent=2)  # Keep last 50 jobs
        except Exception as e:
            print("[RENDER QUEUE] Failed to save render history:", e)

    def add_job(self, project_id, project_name, timeline_data, export_settings=None):
        """Enqueue a new render job."""
        job_id = f"job_{int(time.time())}_{uuid.uuid4().hex[:6]}"
        export_settings = export_settings or {}
        
        preset_name = export_settings.get("presetName", "9:16 Shorts (1080p)")
        out_filename = export_settings.get("outputFilename") or f"project_{project_id}_export_{int(time.time())}.mp4"
        out_path = config.FINAL_DIR / out_filename
        log_path = LOGS_DIR / f"{job_id}.log"

        job = {
            "id": job_id,
            "projectId": project_id,
            "projectName": project_name or f"Project #{project_id}",
            "presetName": preset_name,
            "status": "queued",
            "progress": 0,
            "stage": "Queued in Render Manager",
            "outputFilename": out_filename,
            "outputPath": str(out_path),
            "outputUrl": f"/download/final/{out_filename}",
            "fileSize": 0,
            "duration": 0,
            "error": None,
            "logPath": str(log_path),
            "createdAt": time.strftime("%Y-%m-%d %H:%M:%S"),
            "startedAt": None,
            "completedAt": None,
            "timelineData": timeline_data,
            "exportSettings": export_settings
        }

        with self.lock:
            self.jobs_map[job_id] = job
            self.cancel_events[job_id] = threading.Event()
            self._save_history()

        self.jobs_queue.put(job_id)
        print(f"[RENDER QUEUE] Enqueued job {job_id} ({job['projectName']})")
        return job

    def cancel_job(self, job_id):
        """Cancel an active or queued render job."""
        with self.lock:
            if job_id in self.cancel_events:
                self.cancel_events[job_id].set()

            job = self.jobs_map.get(job_id)
            if job and job["status"] in ["queued", "rendering", "preparing"]:
                job["status"] = "cancelled"
                job["stage"] = "Cancelled by user"
                job["completedAt"] = time.strftime("%Y-%m-%d %H:%M:%S")
                self._save_history()
                return True
        return False

    def retry_job(self, job_id):
        """Re-enqueue a failed or cancelled render job."""
        with self.lock:
            job = self.jobs_map.get(job_id)
            if not job:
                return None
            
            job["status"] = "queued"
            job["progress"] = 0
            job["stage"] = "Queued for retry"
            job["error"] = None
            job["startedAt"] = None
            job["completedAt"] = None
            self.cancel_events[job_id] = threading.Event()
            self._save_history()

        self.jobs_queue.put(job_id)
        return job

    def remove_job(self, job_id):
        """Remove job from queue/history."""
        with self.lock:
            if job_id in self.jobs_map:
                del self.jobs_map[job_id]
                self._save_history()
                return True
        return False

    def clear_completed(self):
        """Remove completed and cancelled jobs from history."""
        with self.lock:
            self.jobs_map = {jid: j for jid, j in self.jobs_map.items() if j["status"] in ["queued", "rendering"]}
            self._save_history()

    def get_status(self):
        """Return the current queue status, active job, and all jobs."""
        with self.lock:
            jobs_list = sorted(list(self.jobs_map.values()), key=lambda j: j.get("createdAt", ""), reverse=True)
            active = self.active_job
            queued_count = sum(1 for j in jobs_list if j["status"] == "queued")
            return {
                "activeJob": active,
                "queuedCount": queued_count,
                "jobs": jobs_list
            }

    def _worker_loop(self):
        """Background worker executing render jobs sequentially."""
        while True:
            try:
                job_id = self.jobs_queue.get()
                with self.lock:
                    job = self.jobs_map.get(job_id)
                    if not job or job["status"] == "cancelled":
                        self.jobs_queue.task_done()
                        continue
                    
                    self.active_job = job
                    job["status"] = "rendering"
                    job["startedAt"] = time.strftime("%Y-%m-%d %H:%M:%S")
                    job["progress"] = 5
                    job["stage"] = "Preparing workspace and resources..."
                    self._save_history()

                cancel_event = self.cancel_events.get(job_id, threading.Event())
                self._execute_render_job(job, cancel_event)

                with self.lock:
                    self.active_job = None
                    self._save_history()

                self.jobs_queue.task_done()
            except Exception as e:
                print("[RENDER QUEUE WORKER] Unexpected error in worker loop:", e)
                time.sleep(1)

    def _execute_render_job(self, job, cancel_event):
        """Execute the full rendering pipeline with progress reporting and validation."""
        job_id = job["id"]
        proj_id = job["projectId"]
        timeline = job["timelineData"]
        export_settings = job["exportSettings"]
        log_path = Path(job["logPath"])
        
        temp_dir = config.OUTPUT_DIR / "temp"
        temp_dir.mkdir(parents=True, exist_ok=True)
        config.FINAL_DIR.mkdir(parents=True, exist_ok=True)

        log_file = open(log_path, "w", encoding="utf-8")
        log_file.write(f"=== Render Job {job_id} Started at {time.ctime()} ===\n")
        log_file.write(f"Project: {job['projectName']} (ID: {proj_id})\n")
        log_file.write(f"Preset: {job['presetName']}\n\n")
        log_file.flush()

        temp_files = []
        try:
            if cancel_event.is_set():
                raise InterruptedError("Render was cancelled by user")

            # Stage 1: Slicing and Concatenating Video Clips
            job["progress"] = 15
            job["stage"] = "Slicing and concatenating video clips..."
            log_file.write("[STAGE 1] Slicing video timeline clips...\n")

            timeline_clips = timeline.get("clips", [])
            if not timeline_clips:
                raise ValueError("Timeline has no video clips to render")

            for idx, clip in enumerate(timeline_clips):
                if cancel_event.is_set():
                    raise InterruptedError("Render cancelled during clip slicing")

                filename = clip.get("filename", "")
                start = float(clip.get("start", 0))
                end = float(clip.get("end", 0))
                dur = end - start
                if dur <= 0:
                    continue

                input_path = config.CLIPS_DIR / filename
                if not input_path.exists():
                    input_path = config.INPUT_DIR / filename
                if not input_path.exists():
                    raise FileNotFoundError(f"Source media '{filename}' not found")

                temp_seg = temp_dir / f"seg_{job_id}_{idx}_{int(time.time())}.mp4"
                cmd = [
                    config.FFMPEG_PATH, "-y",
                    "-ss", str(start),
                    "-i", str(input_path),
                    "-t", str(dur),
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                    "-c:a", "aac", "-ar", "44100",
                    str(temp_seg)
                ]
                subprocess.run(cmd, stdout=log_file, stderr=log_file, check=True)
                temp_files.append(temp_seg)

            if not temp_files:
                raise ValueError("No valid video segments could be processed")

            concat_manifest = temp_dir / f"concat_{job_id}.txt"
            with open(concat_manifest, "w", encoding="utf-8") as f:
                for tf in temp_files:
                    escaped_p = str(tf.resolve()).replace("\\", "/")
                    f.write(f"file '{escaped_p}'\n")

            base_video = temp_dir / f"base_{job_id}.mp4"
            concat_cmd = [
                config.FFMPEG_PATH, "-y",
                "-f", "concat", "-safe", "0",
                "-i", str(concat_manifest),
                "-c", "copy",
                str(base_video)
            ]
            subprocess.run(concat_cmd, stdout=log_file, stderr=log_file, check=True)

            try:
                concat_manifest.unlink()
                for tf in temp_files:
                    tf.unlink()
            except Exception:
                pass

            current_stage_video = base_video

            # Stage 2: Compositing Motion Graphics & Overlays
            graphics_layers = timeline.get("graphics", [])
            if graphics_layers:
                if cancel_event.is_set():
                    raise InterruptedError("Render cancelled before graphics")

                job["progress"] = 55
                job["stage"] = "Compositing motion graphics & visual badges..."
                log_file.write("[STAGE 2] Compositing motion graphics layers...\n")

                graphics_stage_video = temp_dir / f"graphics_{job_id}.mp4"
                renderer = GraphicsRenderer()
                renderer.composite_graphics(
                    input_video=current_stage_video,
                    graphics_layers=graphics_layers,
                    output_video=graphics_stage_video,
                    canvas_width=timeline.get("canvasWidth", 360),
                    canvas_height=timeline.get("canvasHeight", 640)
                )

                try:
                    current_stage_video.unlink()
                except Exception:
                    pass
                current_stage_video = graphics_stage_video

            # Stage 2.5: Burning Animated Captions & Typography
            captions_data = timeline.get("captions", [])
            if captions_data:
                if cancel_event.is_set():
                    raise InterruptedError("Render cancelled before captions")

                job["progress"] = 70
                job["stage"] = "Burning animated captions and typography..."
                log_file.write("[STAGE 2.5] Rendering animated captions and ASS subtitles...\n")

                caption_stage_video = temp_dir / f"captions_{job_id}.mp4"
                cap_renderer = AnimatedCaptionRenderer()
                cap_style = timeline.get("captionStyle") or timeline.get("caption_style") or {}
                cap_renderer.render(
                    input_video=current_stage_video,
                    transcript=captions_data,
                    output_video=caption_stage_video,
                    opts=cap_style
                )

                try:
                    current_stage_video.unlink()
                except Exception:
                    pass
                current_stage_video = caption_stage_video

            # Stage 3: Mixing Multi-Track Audio
            if cancel_event.is_set():
                raise InterruptedError("Render cancelled before audio mix")

            job["progress"] = 80
            job["stage"] = "Mixing multi-track audio & background music..."
            log_file.write("[STAGE 3] Rendering multi-track audio mixdown...\n")

            final_output_path = Path(job["outputPath"])
            mixer = AudioMixer()
            mixer.mix_and_export(
                input_video=current_stage_video,
                audio_tracks=timeline.get("audioTracks", []),
                audio_clips=timeline.get("audioClips", []),
                output_video=final_output_path,
                video_audio_volume=float(timeline.get("videoAudioVolume", 100)),
                video_audio_muted=bool(timeline.get("videoAudioMuted", False))
            )

            try:
                current_stage_video.unlink()
            except Exception:
                pass

            # Stage 4: Post-Render Technical Validation
            job["progress"] = 95
            job["stage"] = "Validating final output integrity..."
            log_file.write("[STAGE 4] Validating final exported media...\n")

            if not final_output_path.exists() or final_output_path.stat().st_size == 0:
                raise ValueError("Exported file was not created or is empty")

            loader = VideoLoader(final_output_path)
            meta = loader.metadata()
            loader.close()

            job["fileSize"] = final_output_path.stat().st_size
            job["duration"] = meta.get("duration", 0)
            job["progress"] = 100
            job["status"] = "completed"
            job["stage"] = "Export completed successfully"
            job["completedAt"] = time.strftime("%Y-%m-%d %H:%M:%S")

            log_file.write(f"\n[SUCCESS] Render Completed! Size: {job['fileSize']} bytes, Duration: {job['duration']}s\n")
            print(f"[RENDER QUEUE] Job {job_id} Completed successfully ({job['outputFilename']})")

        except InterruptedError as e:
            job["status"] = "cancelled"
            job["stage"] = str(e)
            job["completedAt"] = time.strftime("%Y-%m-%d %H:%M:%S")
            log_file.write(f"\n[CANCELLED] {e}\n")
            print(f"[RENDER QUEUE] Job {job_id} Cancelled")
        except Exception as e:
            job["status"] = "failed"
            job["error"] = str(e)
            job["stage"] = f"Failed: {str(e)}"
            job["completedAt"] = time.strftime("%Y-%m-%d %H:%M:%S")
            log_file.write(f"\n[ERROR] Render Failed: {e}\n")
            print(f"[RENDER QUEUE] Job {job_id} Failed: {e}")
        finally:
            log_file.close()


render_queue_manager = RenderQueueManager()
