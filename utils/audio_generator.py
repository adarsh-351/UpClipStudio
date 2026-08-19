"""
Audio Asset Generator for UpClip Studio.
Generates clean, synthetic royalty-free sound effects and background music tracks
for the Audio Studio library using pure Python.
"""

import math
import struct
import wave
from pathlib import Path


def generate_starter_audio_assets(target_dir="static/audio"):
    """Generate default starter sound effects and music tracks."""
    out_dir = Path(target_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    assets = [
        # (filename, type, title, generator_fn)
        ("ambient_music.wav", "music", "Chill Ambient Flow", lambda: _synth_ambient_music(duration=15.0)),
        ("upbeat_rhythm.wav", "music", "Upbeat Lo-Fi Beat", lambda: _synth_lofi_beat(duration=12.0)),
        ("whoosh.wav", "sfx", "Whoosh Transition", lambda: _synth_whoosh(duration=0.6)),
        ("pop.wav", "sfx", "Pop Sound", lambda: _synth_pop(duration=0.25)),
        ("click.wav", "sfx", "UI Click", lambda: _synth_click(duration=0.15)),
        ("chime.wav", "sfx", "Success Chime", lambda: _synth_chime(duration=1.2)),
        ("voice_sample.wav", "voice", "Voiceover Demo Note", lambda: _synth_voice_sample(duration=5.0)),
    ]

    generated_info = []
    for filename, cat, title, gen_fn in assets:
        file_path = out_dir / filename
        if not file_path.exists():
            samples, sample_rate = gen_fn()
            _write_wav_file(file_path, samples, sample_rate)
            print(f"[AUDIO] Generated sample asset: {filename}")
        
        generated_info.append({
            "filename": filename,
            "category": cat,
            "title": title,
            "url": f"/static/audio/{filename}"
        })

    return generated_info


def _write_wav_file(path, samples, sample_rate=44100):
    with wave.open(str(path), 'w') as wav:
        wav.setnchannels(1)  # Mono
        wav.setsampwidth(2)  # 16-bit
        wav.setframerate(sample_rate)
        raw_data = struct.pack('<' + ('h' * len(samples)), *samples)
        wav.writeframes(raw_data)


def _synth_ambient_music(duration=15.0, sample_rate=44100):
    total_samples = int(duration * sample_rate)
    samples = []
    # E-major chord arpeggio / ambient drone (E3 164.8, G#3 207.6, B3 246.9, E4 329.6)
    freqs = [164.81, 207.65, 246.94, 329.63]
    for i in range(total_samples):
        t = i / sample_rate
        val = 0.0
        for idx, f in enumerate(freqs):
            sub_phase = (t * 0.5 + idx * 0.25) % 2.0
            amp = 0.2 * (0.5 + 0.5 * math.sin(2 * math.pi * 0.2 * t + idx))
            val += amp * math.sin(2 * math.pi * f * t)
        
        # Soft envelope
        env = 1.0
        if t < 1.0:
            env = t
        elif t > duration - 1.5:
            env = (duration - t) / 1.5
        
        s = int(val * env * 14000)
        samples.append(max(-32767, min(32767, s)))
    return samples, sample_rate


def _synth_lofi_beat(duration=12.0, sample_rate=44100):
    total_samples = int(duration * sample_rate)
    samples = []
    bpm = 100
    beat_dur = 60.0 / bpm
    for i in range(total_samples):
        t = i / sample_rate
        beat_t = t % beat_dur
        
        # Kick on beat
        val = 0.0
        if beat_t < 0.15:
            kick_f = 120.0 * math.exp(-beat_t * 25.0)
            val += 0.6 * math.sin(2 * math.pi * kick_f * beat_t)
        
        # Hi-hat on half beat
        hat_t = (t + beat_dur / 2) % beat_dur
        if hat_t < 0.05:
            val += 0.2 * (math.sin(2 * math.pi * 3500 * hat_t) + math.sin(2 * math.pi * 7000 * hat_t))
            
        # Bassline
        bass_f = 110.0 if int(t / beat_dur) % 4 in (0, 1) else 82.4
        val += 0.3 * math.sin(2 * math.pi * bass_f * t)

        env = 1.0
        if t < 0.5:
            env = t / 0.5
        elif t > duration - 1.0:
            env = (duration - t) / 1.0

        s = int(val * env * 16000)
        samples.append(max(-32767, min(32767, s)))
    return samples, sample_rate


def _synth_whoosh(duration=0.6, sample_rate=44100):
    total_samples = int(duration * sample_rate)
    samples = []
    for i in range(total_samples):
        t = i / sample_rate
        # Frequency sweep from 200Hz to 1200Hz back to 150Hz
        norm_t = t / duration
        f = 200.0 + 1200.0 * math.sin(math.pi * norm_t)
        env = math.sin(math.pi * norm_t) ** 2
        val = env * math.sin(2 * math.pi * f * t)
        samples.append(int(val * 24000))
    return samples, sample_rate


def _synth_pop(duration=0.25, sample_rate=44100):
    total_samples = int(duration * sample_rate)
    samples = []
    for i in range(total_samples):
        t = i / sample_rate
        f = 500.0 * math.exp(-t * 18.0)
        env = math.exp(-t * 22.0)
        val = env * math.sin(2 * math.pi * f * t)
        samples.append(int(val * 26000))
    return samples, sample_rate


def _synth_click(duration=0.15, sample_rate=44100):
    total_samples = int(duration * sample_rate)
    samples = []
    for i in range(total_samples):
        t = i / sample_rate
        f = 1200.0 * math.exp(-t * 40.0)
        env = math.exp(-t * 35.0)
        val = env * math.sin(2 * math.pi * f * t)
        samples.append(int(val * 20000))
    return samples, sample_rate


def _synth_chime(duration=1.2, sample_rate=44100):
    total_samples = int(duration * sample_rate)
    samples = []
    # Major triad bells (523.25 C5, 659.25 E5, 783.99 G5, 1046.5 C6)
    notes = [523.25, 659.25, 783.99, 1046.50]
    for i in range(total_samples):
        t = i / sample_rate
        val = 0.0
        for idx, f in enumerate(notes):
            note_t = t - idx * 0.1
            if note_t > 0:
                env = math.exp(-note_t * 3.5)
                val += 0.3 * env * math.sin(2 * math.pi * f * note_t)
        samples.append(int(val * 24000))
    return samples, sample_rate


def _synth_voice_sample(duration=5.0, sample_rate=44100):
    total_samples = int(duration * sample_rate)
    samples = []
    # Synthetic speech-like formant tones
    for i in range(total_samples):
        t = i / sample_rate
        f_pitch = 140.0 + 20.0 * math.sin(2 * math.pi * 1.2 * t)
        formant1 = math.sin(2 * math.pi * 700 * t) * 0.4
        formant2 = math.sin(2 * math.pi * 1220 * t) * 0.3
        carrier = math.sin(2 * math.pi * f_pitch * t)
        env = 0.5 + 0.5 * math.sin(2 * math.pi * 2.5 * t)
        val = carrier * (1.0 + formant1 + formant2) * env * 0.5
        samples.append(int(val * 22000))
    return samples, sample_rate


if __name__ == "__main__":
    generate_starter_audio_assets("static/audio")
