# ClipMatrix — AI-Powered Video Clipping & Publishing Studio (Phase 2: Real AI Video Processing, Whisper & Gemini Integration)

ClipMatrix is a personal AI video clipping, livestream monitoring, multi-language captioning, and social publishing studio. Phase 2 connects the 13-page dark SaaS studio to a real **PostgreSQL** database, **FFmpeg / FFprobe** media processing, **faster-whisper** local transcription, and the official **Google Gemini API** (`@google/genai` / `google-genai`).

---

## 1. Architecture & Dual-Runtime Support

### A. Live Full-Stack AI Studio Runtime (`server.ts` + Cloud SQL PostgreSQL + FFmpeg + Gemini)
- **Port 3000 Full-Stack Server (`server.ts`)**: Runs Express + Vite middleware, connected directly to the provisioned **Cloud SQL PostgreSQL** instance (`users`, `videos`, `transcripts`, `highlights`, `generated_clips`, `processing_jobs`) via Drizzle ORM (`src/db/schema.ts`, `src/db/index.ts`, `src/db/repository.ts`).
- **Real Media Engine (`src/server/ffmpegService.ts`)**: Executes `/usr/bin/ffprobe` for video stream verification and `/usr/bin/ffmpeg` for 16kHz mono WAV extraction, frame-accurate MP4 slicing, aspect-ratio smart-cropping (`9:16`, `16:9`, `1:1`), and `.jpg` thumbnail extraction.
- **Whisper & Audio Transcription (`src/server/transcriptionService.ts` + `backend/scripts/run_faster_whisper.py`)**: Executes local Python `faster-whisper` when installed on the host, with automatic fallback to Gemini audio transcription (`gemini-3-flash-preview`) on the extracted WAV file.
- **Gemini AI Highlight Detection (`src/server/geminiHighlightService.ts`)**: Analyzes timestamped transcripts via `@google/genai` (`gemini-3-flash-preview`) with strict JSON schema validation to detect viral hooks, emotional peaks, and educational insights with 0–100 virality scores.

### B. Standalone Python FastAPI + Celery + Redis Backend (`/backend/*`)
For self-hosted deployments with GPU/CPU Celery workers:
```text
/backend
├── requirements.txt                  # FastAPI, SQLAlchemy, psycopg2, Celery, Redis, faster-whisper, google-genai
├── .env.example                      # Python backend environment template
├── scripts/
│   └── run_faster_whisper.py         # CLI runner invoked by Node or Python workers
└── app/
    ├── main.py                       # FastAPI application entrypoint
    ├── config.py                     # Environment & storage configuration
    ├── errors.py                     # Structured exception handlers
    ├── database.py                   # SQLAlchemy engine & session factory
    ├── models.py                     # SQLAlchemy ORM models (videos, transcripts, highlights, generated_clips, processing_jobs)
    ├── storage.py                    # Local disk storage manager for videos, audio, clips, thumbnails
    ├── routes/
    │   └── api.py                    # REST endpoints (/upload, /transcribe, /highlights, /generate-clips, /download)
    ├── services/
    │   ├── video_processor.py        # FFprobe metadata & FFmpeg 9:16 / 16:9 / 1:1 clip & thumbnail generator
    │   ├── audio_extractor.py        # FFmpeg 16kHz mono PCM WAV extractor
    │   ├── whisper_service.py        # Local faster-whisper transcription engine (CPU/CUDA)
    │   └── gemini_service.py         # Official google-genai highlight detection service
    └── tasks/
        └── celery_app.py             # Celery + Redis background task pipeline
```

---

## 2. How to Run

### Full-Stack Server (Node.js + Vite + PostgreSQL + FFmpeg)
1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Push PostgreSQL schema**:
   ```bash
   npx drizzle-kit push --config=src/db/drizzle.config.ts
   ```
3. **Start the full-stack server (Port 3000)**:
   ```bash
   npm run dev
   ```
4. **Run unit tests**:
   ```bash
   npx --yes tsx --test src/utils/clipLogic.test.ts
   ```

### Standalone Python FastAPI Backend (`/backend`)
1. **Create a Python virtual environment & install dependencies**:
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Set GEMINI_API_KEY, POSTGRES_*, and REDIS_URL in .env
   ```
3. **Start the FastAPI server**:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
4. **Start the Celery background worker (optional, when Redis is running)**:
   ```bash
   celery -A app.tasks.celery_app.celery_app worker --loglevel=info
   ```
