import json
from pathlib import Path

import config


# Reusable module-level model cache so we don't re-load
# the Whisper model on every job (huge speedup for repeated runs).
_whisper_models = {}


def _get_model(model_name):
    """Load (and cache) a Whisper model once per process."""
    if model_name not in _whisper_models:
        print(f"Loading Whisper Model : {model_name}")
        import whisper
        _whisper_models[model_name] = whisper.load_model(model_name)
        print("Whisper Model Loaded Successfully")
    return _whisper_models[model_name]


class WhisperEngine:

    def __init__(self, model_name="base"):
        self.model_name = model_name
        self.model = _get_model(model_name)

    # -------------------------------------

    def transcribe(self, video_path, language=None):
        video_path = str(video_path)

        # Resolve whisper language code
        whisper_lang = None
        if language and language not in ("auto", None):
            whisper_lang = language
            if language in config.LANGUAGES:
                whisper_lang = config.LANGUAGES[language][1]

        kwargs = {}
        # Use GPU fp16 when available for much faster inference
        if config.USE_GPU:
            try:
                import torch
                if torch.cuda.is_available():
                    kwargs["fp16"] = True
                else:
                    kwargs["fp16"] = False
            except Exception:
                kwargs["fp16"] = False
        else:
            kwargs["fp16"] = False

        if whisper_lang:
            kwargs["language"] = whisper_lang

        # Suppress verbose progress output
        kwargs["verbose"] = False

        result = self.model.transcribe(
            video_path,
            **kwargs
        )

        transcript = []

        for segment in result["segments"]:

            transcript.append({
                "start": float(segment["start"]),
                "end": float(segment["end"]),
                "text": segment["text"].strip()
            })

        return transcript

# -------------------------------------
    # Transcribe with disk cache
    # -------------------------------------

    def transcribe_cached(self, video_path, cache_file, language=None):
        """
        Transcribe video, using a cached JSON transcript if it already exists.

        video_path  : path to the input video
        cache_file  : path to the JSON transcript cache file
        language    : optional whisper language code

        Returns the transcript list.
        """
        cache_file = Path(cache_file)

        if cache_file.exists():
            print(f"Using cached transcript: {cache_file.name}")
            return self.load_json(cache_file)

        transcript = self.transcribe(video_path, language=language)
        self.save_json(transcript, cache_file)
        return transcript

    # -------------------------------------

    def save_json(self, transcript, output_file):

        output_file = Path(output_file)

        output_file.parent.mkdir(
            parents=True,
            exist_ok=True
        )

        with open(
            output_file,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                transcript,
                file,
                indent=4,
                ensure_ascii=False
            )

        print(f"Transcript Saved : {output_file}")

    # -------------------------------------

    def load_json(self, json_file):

        with open(
            json_file,
            "r",
            encoding="utf-8"
        ) as file:

            return json.load(file)
