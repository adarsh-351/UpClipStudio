"""
Smart Shorts Factory for UpClip Studio.
Automates the creation of independent, fully editable Child Short Projects
from Content Intelligence highlight candidates and handles bulk Render Queue dispatching.
"""

import os
import json
import time
from pathlib import Path

import config
from models.project import Project
from app import db
from core.render_queue import render_queue_manager
from flask import current_app


class ShortsFactory:
    def __init__(self):
        pass

    def _get_app_context(self):
        if current_app:
            from contextlib import nullcontext
            return nullcontext()
        from app import create_app
        return create_app().app_context()

    def create_short_project(self, parent_project_id, candidate, preset_name="9:16 Shorts Default"):
        """
        Create an independent, fully editable Child Short Project linked to parent project.
        """
        with self._get_app_context():
            parent = Project.query.get(parent_project_id)
            if not parent:
                parent_name = f"Project {parent_project_id}"
                source_fn = config.INPUT_DIR / "AI_Spark_Clip_001_1080p (1).mp4"
                source_name = source_fn.name
            else:
                parent_name = parent.name
                source_name = parent.source_path

            cand_id = candidate.get("id", f"c_{int(time.time())}")
            cand_title = candidate.get("title", "Highlight")
            start_t = float(candidate.get("start", 0.0))
            end_t = float(candidate.get("end", 8.0))
            duration = round(end_t - start_t, 2)

            short_name = f"{parent_name} - {cand_title}"

            # Build initial short-form timeline structure
            timeline_data = {
                "clips": [
                    {
                        "id": f"clip_short_{int(time.time())}",
                        "filename": source_name,
                        "start": start_t,
                        "end": end_t,
                        "duration": duration,
                        "timelineStart": 0.0,
                        "transform": { "x": 0, "y": 0, "scale": 100 }
                    }
                ],
                "graphics": [
                    {
                        "id": f"g_badge_{int(time.time())}",
                        "type": "shape",
                        "name": "Short Hook Badge",
                        "start": 0.0,
                        "end": min(duration, 4.0),
                        "transform": { "x": 0, "y": -220, "width": 180, "height": 38, "scale": 100, "rotation": 0, "opacity": 100 },
                        "appearance": { "fill": "#6366F1", "stroke": "#FFFFFF", "strokeWidth": 1, "cornerRadius": 6, "shadowBlur": 4, "shadowColor": "#000000" },
                        "content": { "shapeType": "badge" },
                        "typography": { "text": candidate.get("ranking", "SHORT").upper() + " CLIP", "fontFamily": "Inter", "fontSize": 12, "fontWeight": 800, "color": "#FFFFFF" }
                    }
                ],
                "audioTracks": [
                    { "id": "track_video_audio", "type": "video_audio", "name": "Video Audio", "volume": 100, "muted": False }
                ],
                "audioClips": [],
                "canvasWidth": 360,
                "canvasHeight": 640,
                "aspectRatio": "9:16",
                "parentProjectId": parent_project_id,
                "parentTimeRange": { "start": start_t, "end": end_t }
            }

            child = Project(
                name=short_name,
                source_path=source_name,
                status="ready",
                duration=int(duration),
                editor_state=json.dumps(timeline_data)
            )
            db.session.add(child)
            db.session.commit()

            return {
                "success": True,
                "childProjectId": child.id,
                "name": child.name,
                "duration": duration,
                "start": start_t,
                "end": end_t
            }

    def bulk_create_shorts(self, parent_project_id, candidates, preset_name="9:16 Shorts Default"):
        """Generate multiple child short projects in bulk from candidate list."""
        created_shorts = []
        for cand in candidates:
            try:
                res = self.create_short_project(parent_project_id, cand, preset_name)
                created_shorts.append(res)
            except Exception as e:
                print(f"[SHORTS FACTORY] Failed to create short for candidate {cand.get('id')}: {e}")

        return {
            "success": True,
            "totalCreated": len(created_shorts),
            "shorts": created_shorts
        }

    def bulk_enqueue_shorts(self, project_ids, export_preset="9:16 Vertical Shorts (1080p)"):
        """Add multiple child short projects to the authoritative Render Queue."""
        enqueued_jobs = []
        with self._get_app_context():
            for pid in project_ids:
                proj = Project.query.get(pid)
                if not proj:
                    continue

                state = {}
                if proj.editor_state:
                    try:
                        state = json.loads(proj.editor_state)
                    except Exception:
                        pass

                out_filename = f"short_{proj.id}_{int(time.time())}.mp4"

                job = render_queue_manager.add_job(
                    project_id=proj.id,
                    project_name=proj.name,
                    timeline_data=state,
                    export_settings={
                        "presetName": export_preset,
                        "outputFilename": out_filename
                    }
                )
                enqueued_jobs.append(job)

        return {
            "success": True,
            "totalEnqueued": len(enqueued_jobs),
            "jobs": enqueued_jobs
        }


shorts_factory = ShortsFactory()

