import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, r'C:\Users\LENOVO\Desktop\New folder\UpClipStudio')
import config
from utils.scene_detector import SceneDetector
from utils.scene_merger import SceneMerger
from utils.clip_generator import ClipGenerator
from pathlib import Path

video = list(config.INPUT_DIR.glob('*.mp4'))[0]
print('Video:', video.name)

detector = SceneDetector(video)
scenes = detector.detect_scenes(threshold=config.SCENE_THRESHOLD)
print(f'Scenes detected: {len(scenes)}')
if scenes:
    for i, s in enumerate(scenes[:5]):
        print(f'  Scene {i}: {s["start"]:.1f}s - {s["end"]:.1f}s (dur: {s["duration"]:.1f}s)')
    if len(scenes) > 5:
        print(f'  ... and {len(scenes)-5} more')

merger = SceneMerger()
merged = merger.merge(scenes)
print(f'Merged clips: {len(merged)}')
if merged:
    for i, m in enumerate(merged[:5]):
        print(f'  Merged {i}: {m["start"]:.1f}s - {m["end"]:.1f}s (dur: {m["duration"]:.1f}s)')

gen = ClipGenerator(video)
clips = gen.generate_clips(merged, mode='ai', aspect_key='original', naming='sequential')
print(f'Clips generated: {len(clips)}')
for c in clips:
    print(f'  {Path(c).name}')
