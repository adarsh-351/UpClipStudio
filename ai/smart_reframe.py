"""
Smart Reframe & Subject-Aware Framing Engine for UpClip Studio.
Converts 16:9 landscape footage into vertical 9:16 framing with face and subject tracking.
"""

from pathlib import Path
import config


class SmartReframer:
    def __init__(self):
        pass

    def compute_reframe(self, video_path, mode="smart", target_aspect="9:16"):
        """
        Compute optimal horizontal framing offset X (and keyframes if applicable)
        to crop 16:9 video to 9:16 while centering the subject.

        Returns:
            dict: {
                "mode": str,
                "targetAspect": "9:16",
                "recommendedX": float,
                "scale": float,
                "keyframes": list of { "time": float, "x": float }
            }
        """
        video_path = Path(video_path)
        if not video_path.exists():
            return {
                "mode": mode,
                "targetAspect": target_aspect,
                "recommendedX": 0.0,
                "scale": 177.78, # 16/9 * 100 for vertical fill
                "keyframes": []
            }

        # In 9:16 frame inside 16:9 source, scale is ~177.78% to fill vertically
        scale = 177.78

        if mode == "center":
            return {
                "mode": "center",
                "targetAspect": target_aspect,
                "recommendedX": 0.0,
                "scale": scale,
                "keyframes": []
            }

        # Smart mode: detect subject center
        # Attempt lightweight face detection / optical center of mass
        recommended_x = 0.0
        keyframes = []

        try:
            import cv2
            cap = cv2.VideoCapture(str(video_path))
            fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            width = cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1920
            height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 1080

            # Sample 5 frames across the video
            sample_indices = [int(total_frames * r) for r in [0.1, 0.3, 0.5, 0.7, 0.9] if int(total_frames * r) < total_frames]
            detected_x_positions = []

            # Try Haar Cascade face detector if available in cv2
            face_cascade = None
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            if Path(cascade_path).exists():
                face_cascade = cv2.CascadeClassifier(cascade_path)

            for idx in sample_indices:
                cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
                ret, frame = cap.read()
                if not ret or frame is None:
                    continue

                t_sec = round(idx / fps, 2)
                if face_cascade:
                    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                    faces = face_cascade.detectMultiScale(gray, 1.3, 4)
                    if len(faces) > 0:
                        # Pick largest face
                        largest = max(faces, key=lambda f: f[2] * f[3])
                        fx, fy, fw, fh = largest
                        face_center_x = fx + fw / 2.0
                        # Calculate shift relative to image center in canvas space (-180 to +180)
                        shift_ratio = (face_center_x - (width / 2.0)) / (width / 2.0)
                        target_canvas_x = round(-shift_ratio * 120.0, 1) # Shift canvas opposite to center face
                        detected_x_positions.append(target_canvas_x)
                        keyframes.append({"time": t_sec, "x": target_canvas_x})

            cap.release()

            if detected_x_positions:
                recommended_x = round(sum(detected_x_positions) / len(detected_x_positions), 1)

        except Exception as e:
            print("[REFRAME] Computer vision detection note (fallback to safe center):", e)
            recommended_x = 0.0

        return {
            "mode": mode,
            "targetAspect": target_aspect,
            "recommendedX": recommended_x,
            "scale": scale,
            "keyframes": keyframes
        }
