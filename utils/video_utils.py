import cv2
from pathlib import Path


class VideoLoader:

    def __init__(self, video_path):

        self.video_path = Path(video_path)

        if not self.video_path.exists():
            raise FileNotFoundError(f"{video_path} not found")

        self.cap = cv2.VideoCapture(str(self.video_path))

        if not self.cap.isOpened():
            raise Exception("Cannot open video")

    def metadata(self):

        fps = self.cap.get(cv2.CAP_PROP_FPS)

        frame_count = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))

        width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))

        height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        duration = frame_count / fps if fps else 0

        size_bytes = self.video_path.stat().st_size if self.video_path.exists() else 0

        return {
            "filename": self.video_path.name,
            "width": width,
            "height": height,
            "fps": round(fps, 2),
            "frames": frame_count,
            "duration": round(duration, 2),
            "size_bytes": size_bytes,
            "size": self._format_size(size_bytes),
        }

    @staticmethod
    def _format_size(size_bytes):
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f} KB"
        elif size_bytes < 1024 * 1024 * 1024:
            return f"{size_bytes / (1024 * 1024):.1f} MB"
        return f"{size_bytes / (1024 * 1024):.2f} GB"

    def thumbnail(self, save_path):

        self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

        success, frame = self.cap.read()

        if success:
            cv2.imwrite(str(save_path), frame)

    def extract_frames(self, output_folder, interval=30):

        Path(output_folder).mkdir(exist_ok=True)

        count = 0
        saved = 0

        while True:

            success, frame = self.cap.read()

            if not success:
                break

            if count % interval == 0:

                filename = Path(output_folder) / f"frame_{saved:05d}.jpg"

                cv2.imwrite(str(filename), frame)

                saved += 1

            count += 1

        return saved

    def close(self):

        self.cap.release()