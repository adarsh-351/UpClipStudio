from pathlib import Path

from scenedetect import open_video, SceneManager
from scenedetect.detectors import ContentDetector


class SceneDetector:

    def __init__(self, video_path):
        self.video_path = Path(video_path)

    def detect_scenes(self, threshold=27.0):

        video = open_video(str(self.video_path))

        scene_manager = SceneManager()

        scene_manager.add_detector(
            ContentDetector(threshold=threshold)
        )

        scene_manager.detect_scenes(video)

        scene_list = scene_manager.get_scene_list()

        scenes = []

        for scene in scene_list:

            start = scene[0].get_seconds()

            end = scene[1].get_seconds()

            scenes.append(
                {
                    "start": start,
                    "end": end,
                    "duration": end - start
                }
            )

        return scenes