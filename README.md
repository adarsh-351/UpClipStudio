<div align="center">

# 🎬 UpClip Studio

**AI-Powered Shorts Generator + YouTube Downloader**

Turn any video into viral shorts automatically — scene detection, smart clipping, AI subtitles, animated captions, translation, and professional rendering — all in one place. Includes a built-in YouTube downloader.

![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB?style=flat&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.1-blue?style=flat&logo=flask&logoColor=white)
![OpenAI Whisper](https://img.shields.io/badge/Whisper-AI-4B32C3?style=flat)
![OpenCV](https://img.shields.io/badge/OpenCV-5.0-green?style=flat&logo=opencv&logoColor=white)
![FFmpeg](https://img.shields.io/badge/FFmpeg-Required-007808?style=flat&logo=ffmpeg&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat)

</div>

---

## ✨ Features

### 🎯 Smart Scene Detection
- AI automatically finds the most engaging moments in your video
- Detects scene changes using content-aware thresholds
- Merges small scenes into meaningful clips
- Highlights the best moments using emotion, motion, keyword, and viral scoring engines

### ✂️ Intelligent Clipping
- **AI mode** — AI decides clip count & duration automatically
- **Duration mode** — you set the exact clip length
- **Count mode** — you choose how many clips to generate
- Smart aspect-ratio cropping (no stretching) for 9:16, 16:9, 1:1, or original
- Clip review with rename/delete/download

### 💬 AI Subtitles & Captions
- **OpenAI Whisper** speech-to-text transcription with caching
- Generates **SRT** and **VTT** subtitle files
- Burn subtitles directly into the video with custom fonts, colors, outlines & shadows
- Multiple style presets: `youtube`, `tiktok`, `instagram`, `netflix`

### 🎞️ Animated Captions
- Word-by-word progressive highlight (karaoke-style)
- Multiple animation styles: `pop`, `fade`, `bounce`, `slide`, `zoom`, `scale`, `none`
- Position controls: `bottom`, `top`, `middle`
- Custom font, size, color, background, outline, and margin controls
- Rendered directly into each generated clip using ASS overlays

### 🌐 Multi-Language Translation
- Transcribe in 20+ languages with auto-detection
- Translate subtitles into Hindi, English, Tamil, Telugu, Spanish, French, German, Arabic, Japanese, Chinese, and more

### 📺 YouTube Downloader
- Built-in YouTube video downloader
- Download videos and turn them directly into shorts

### 📱 Professional User Guide
- Step-by-step interactive guide for first-time users
- Covers upload, analysis, scene selection, captioning, customization, preview, and download

### ⚡ Optimized Performance
- **Fast FFmpeg encoding** (`veryfast` preset + CRF) for clip generation & subtitle rendering
- **GPU-accelerated Whisper** (fp16) when available
- **Transcript caching** — skips re-transcription if already processed
- Singleton model loading for faster repeated runs

### 🔐 User Accounts
- Secure registration & login (PBKDF2 password hashing)
- Session-based authentication
- Protected dashboard and studio routes

### 📱 Responsive UI
- Fully responsive across **mobile, tablet, laptop, and PC**
- Dark/light theme toggle
- Live pipeline progress bar with step-by-step tracking
- Export final video, subtitles, and transcripts

---

## 🧱 Tech Stack

| Layer       | Technology                                  |
|-------------|---------------------------------------------|
| Backend     | Python, Flask, Flask-Session                |
| AI / ML     | OpenAI Whisper, OpenCV, Torch, scikit-learn |
| Video       | FFmpeg, MoviePy, imageio-ffmpeg             |
| Frontend    | HTML, CSS, Vanilla JavaScript               |
| Translation | deep-translator (Google Translate backend)  |
| YouTube     | yt-dlp                                      |

---

## 📁 Project Structure

```
UpClipStudio/
├── app.py                  # Flask app entry point
├── config.py               # All configuration & paths
├── requirements.txt        # Python dependencies
├── ai/
│   ├── whisper_engine.py   # Whisper transcription (GPU + cache)
│   ├── subtitle_builder.py # SRT/VTT subtitle generation
│   ├── subtitle_renderer.py# Burn subtitles into video (FFmpeg)
│   ├── subtitle_styles.py  # Subtitle style presets
│   ├── animated_caption_renderer.py # Animated captions (ASS)
│   ├── ass_builder.py      # Advanced subtitle styling
│   ├── ass_animation.py    # Animation effects for captions
│   ├── translation.py      # Multi-language translation service
│   ├── scene_detector.py   # AI scene detection
│   ├── clip_ranker.py      # Clip scoring/ranking
│   ├── emotion_detector.py # Emotion-based scoring
│   ├── motion_detector.py  # Motion-based scoring
│   ├── highlight_engine.py # Highlight detection
│   ├── highlight_ranker.py # Highlight ranking
│   ├── keyword_detector.py # Keyword extraction
│   ├── keyword_extractor.py# Keyword extraction
│   ├── face_detector.py    # Face detection for framing
│   ├── silence_detector.py # Silence detection
│   ├── viral_score.py      # Viral potential scoring
│   └── ...                 # Additional AI engines
├── utils/
│   ├── clip_generator.py   # FFmpeg clip generation
│   ├── video_utils.py      # Video metadata, thumbnails, frames
│   ├── scene_detector.py   # Scene detection wrapper
│   ├── scene_merger.py     # Scene merging logic
│   ├── ffmpeg_utils.py     # FFmpeg availability check
│   ├── audio_utils.py      # Audio processing utilities
│   ├── silence_detector.py # Silence detection utilities
│   ├── logger.py           # Logging utilities
│   └── ...
├── routes/
│   ├── home.py             # Marketing home + dashboard + guide
│   ├── auth.py             # Login/register/logout
│   ├── upload.py           # Video upload endpoint
│   ├── process.py          # Full AI pipeline (async jobs)
│   ├── download.py         # Download clips/subtitles/transcripts
│   └── __init__.py         # Blueprint initialization
├── templates/              # Jinja2 HTML templates
│   ├── home.html           # Marketing home page
│   ├── index.html          # Dashboard/studio
│   ├── guide.html          # Professional user guide
│   ├── yt_downloader.html  # YouTube downloader
│   ├── login.html          # Sign in page
│   └── register.html       # Sign up page
├── static/
│   ├── css/style.css       # Responsive styling + themes
│   └── js/main.js          # Wizard UI + pipeline polling
├── input/                  # Uploaded videos (gitignored)
├── output/                 # Generated clips/final/subtitles (gitignored)
├── assets/                 # Fonts and overlays (gitignored)
├── models/                 # AI model weights (gitignored)
├── data/                   # User data (gitignored)
└── tests/                  # Test suite
```

---

## 🚀 Installation

### Prerequisites
- **Python 3.9+**
- **FFmpeg** (bundled path configured in `config.py`)
- **Git** (optional, for cloning)

### 1. Clone the repository

```bash
git clone https://github.com/adarsh-351/UpClipStudio.git
cd UpClipStudio
```

### 2. Create a virtual environment

```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

> **Note:** The first Whisper run downloads the model weights automatically. If you have a GPU, install a CUDA-enabled PyTorch build for faster transcription.

### 4. Configure FFmpeg

Edit `config.py` and set `FFMPEG_PATH` to your FFmpeg executable, for example:

```python
FFMPEG_PATH = r"C:\path\to\ffmpeg.exe"
```

The app also expects FFmpeg to be on `PATH` for Whisper.

### 5. Run the app

```bash
python app.py
```

Open your browser and visit 👉 **http://127.0.0.1:5000**

---

## 🎮 How to Use

1. **Sign up / Log in** — create a free account
2. **Upload a video** — drag & drop an MP4, MOV, or AVI, or use the built-in YouTube Downloader
3. **Configure** — choose:
   - Transcript & subtitle language
   - Aspect ratio (9:16, 16:9, 1:1, original)
   - Clipping mode (AI / duration / count)
   - Animated captions (enable/disable, style, position, font, color)
   - Clip naming (content-based or sequential)
4. **Generate** — watch the live pipeline progress (FFmpeg → scenes → clips → Whisper → subtitles → render)
5. **Review clips** — preview, rename, or delete before exporting
6. **Export** — download the final clips, SRT/VTT subtitles, and transcript JSON

---

## 🔧 Configuration (`config.py`)

| Setting              | Description                                  | Default      |
|----------------------|----------------------------------------------|--------------|
| `WHISPER_MODEL`      | Whisper model size (`tiny`/`base`/`small`/`medium`/`large`) | `base` |
| `USE_GPU`            | Enable GPU acceleration for Whisper          | `True`       |
| `SUBTITLE_STYLE`     | Subtitle preset (`youtube`/`tiktok`/`instagram`/`netflix`) | `youtube` |
| `CLIP_DURATION`      | Default clip length (seconds)                | `30`         |
| `MAX_CLIP_DURATION`  | Max clip length (seconds)                    | `60`         |
| `SCENE_THRESHOLD`    | Scene-change detection sensitivity           | `27.0`       |
| `FPS`                | Output frame rate                            | `30`         |
| `VIDEO_CODEC`        | Video codec                                  | `libx264`    |
| `AUDIO_CODEC`        | Audio codec                                  | `aac`         |
| `CAPTION_ENABLED`    | Enable animated captions                     | `False`      |
| `CAPTION_ANIMATION`  | Caption animation (`pop`/`fade`/`bounce`/`slide`/`zoom`/`none`) | `pop` |
| `CAPTION_POSITION`   | Caption position (`bottom`/`top`/`middle`)   | `bottom`     |
| `CAPTION_FONT`       | Caption font                                 | `Arial Black`|
| `CAPTION_FONT_SIZE`  | Caption font size                            | `34`         |
| `CAPTION_COLOR`      | Caption text color (hex)                     | `#FFFFFF`    |
| `CAPTION_BACKGROUND` | Caption background/outline color (hex)       | `#000000`    |
| `CAPTION_OUTLINE`    | Caption outline thickness                    | `3`          |

---

## 🧠 How the AI Pipeline Works

```
Upload Video
    │
    ▼
┌─────────────────┐
│ 1. FFmpeg Check │
└────────┬────────┘
         ▼
┌─────────────────┐
│ 2. Extract      │  Metadata (resolution, fps, duration)
│    Metadata     │  + thumbnail
└────────┬────────┘
         ▼
┌─────────────────┐
│ 3. Extract      │  Sample frames every N frames
│    Frames       │
└────────┬────────┘
         ▼
┌─────────────────┐
│ 4. Scene Detect │  Content-aware scene boundaries
│    + Score      │  (emotion, motion, keywords, highlights)
└────────┬────────┘
         ▼
┌─────────────────┐
│ 5. Merge Scenes │  Merge tiny scenes into meaningful clips
└────────┬────────┘
         ▼
┌─────────────────┐
│ 6. Clip         │  FFmpeg fast-seek + veryfast encode
│    Generation   │
└────────┬────────┘
         ▼
┌─────────────────┐
│ 7. Whisper      │  GPU-accelerated transcription
│    Transcribe   │  (cached to disk)
└────────┬────────┘
         ▼
┌─────────────────┐
│ 8. Subtitles    │  SRT + VTT + optional translation
└────────┬────────┘
         ▼
┌─────────────────┐
│ 9. Animated     │  Optional word-by-word karaoke captions
│    Captions     │  rendered into each clip
└────────┬────────┘
         ▼
┌─────────────────┐
│ 10. Review &    │  Preview, rename, delete clips
│     Export      │  Download final outputs
└─────────────────┘
```

---

## ⚡ Performance Tips

- **Use a GPU** — Whisper runs 2-3x faster with CUDA.
- **Smaller Whisper model** — set `WHISPER_MODEL = "tiny"` or `"base"` for faster transcription (slightly lower accuracy).
- **Transcript caching** — already-transcribed videos are skipped automatically.
- **Fast encoding** — clips and final render use `veryfast` preset + CRF 23 for speed without much quality loss.

---

## 🧪 Testing

Run the test suite:

```bash
python -m pytest tests/ -v
```

---

## 📚 Documentation

- [Architecture](docs/architecture.md)
- [API Reference](docs/api.md)
- [Roadmap](docs/roadmap.md)

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<div align="center">
  <sub>Built with ❤️ for content creators</sub>
</div>
