from ai.whisper_engine import WhisperEngine

def run_pipeline(video_path):
    print("\nLoading Video...")
    print(video_path)

    print("\nDetecting Scenes...")

    print("\nGenerating Clips...")

    whisper = WhisperEngine("base")
    whisper.transcribe(video_path)

    print("\nGenerating Subtitles...")

    print("\nRendering Final Shorts...")