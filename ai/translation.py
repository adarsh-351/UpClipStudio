"""
==========================================
Translation Service
Version : 1.0
==========================================

Features

✓ Translate transcript/subtitles to many languages
✓ Google Translate backend (deep_translator)
✓ Safe offline fallback (returns original text)
✓ Language code mapping
"""

import config


class TranslationService:
    """Translate text between languages with safe fallback."""

    def __init__(self):
        self._google = None
        self._available = False
        self._init_engine()

    def _init_engine(self):
        """Lazily initialize the Google Translate engine."""
        try:
            from deep_translator import GoogleTranslator
            self._google = GoogleTranslator
            self._available = True
        except Exception:
            self._available = False

    @property
    def available(self):
        return self._available

    def translate(self, text, target):
        """
        Translate text to the target language code.

        text   : str - the text to translate
        target : str - config language code (e.g. 'hi', 'en', 'es')

        Returns translated text, or original text if translation fails.
        """
        if not text or not text.strip():
            return text

        # No translation needed for auto
        if target == "auto":
            return text

        # Resolve deep_translator code
        code = target
        if target in config.LANGUAGES:
            code = config.LANGUAGES[target][0]

        if not self._available:
            # Offline fallback: return original
            return text

        try:
            result = self._google(source="auto", target=code).translate(text)
            return result or text
        except Exception:
            return text

    def translate_transcript(self, transcript, target):
        """
        Translate a transcript list (list of {start, end, text}).

        Returns a new transcript list with translated text.
        """
        if target == "auto" or not target:
            return transcript

        translated = []
        for item in transcript:
            new_item = dict(item)
            new_item["text"] = self.translate(item.get("text", ""), target)
            translated.append(new_item)
        return translated

    def translate_text(self, text, target):
        """Translate a single block of text (used for test/debug)."""
        return self.translate(text, target)


# Module-level singleton
_service = None


def get_translator():
    """Return a shared TranslationService instance."""
    global _service
    if _service is None:
        _service = TranslationService()
    return _service


def translate_transcript(transcript, target):
    """Helper to translate a transcript."""
    return get_translator().translate_transcript(transcript, target)
