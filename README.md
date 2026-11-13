# ClipMatrix — AI-Powered Video Clipping & Publishing Studio (Long Video to Automatic Shorts)

ClipMatrix is a production-grade AI video clipping, livestream monitoring, multi-language captioning, and social publishing studio. It uses a single unified **Python FastAPI** primary backend (`backend/app/main.py`) connected to **PostgreSQL** (`SQLAlchemy`), **FFmpeg / FFprobe**, local **faster-whisper** speech-to-text transcription, and the official **Google Gemini API** (`google-genai`, model `gemini-4-hydrogen`).

---

## 1. Architecture Overview

- **Port 3000 Gateway (`server.ts`)**: Supervises the Python FastAPI process (`uvicorn backend.app.main:app` on port `8001` with `.python_packages` on `PYTHONPATH`), serves static media (`/storage/videos`, `/storage/audio`, `/storage/clips`, `/storage/thumbnails`, `/storage/subtitles`), and proxies all `/api/*` requests directly to FastAPI.
- **Primary Backend (`backend/app/*`)**:
  - `backend/app/config.py`: Reads `GEMINI_API_KEY`, `GEMINI_MODEL` (`gemini-4-hydrogen`), `SQL_HOST`, `SQL_PORT`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`, `REDIS_URL`, and `WHISPER_MODEL_SIZE`.
  - `backend/app/models.py`: SQLAlchemy models for `users`, `videos`, `transcripts`, `highlights`, `generated_clips`, and `processing_jobs`.
  - `backend/app/services/video_processor.py`:
    - Official YouTube oEmbed API & Google Drive URL accessibility validation (`validate_video_url_accessibility`).
    - FFprobe stream inspection (`probe_video_metadata`).
    - `.srt` subtitle generator (`generate_clip_srt_file`) splitting Whisper segments into punchy 5-word vertical captions.
    - FFmpeg clip extraction, `9:16` / `1:1` / `16:9` smart reframing, `libass` subtitle burn-in (`bold_hormozi`, `neon_viral`, `clean_studio`, `editorial_top`), and `.jpg` thumbnail extraction (`render_clip_and_thumbnail`).
  - `backend/app/services/audio_extractor.py`: FFmpeg 16kHz mono PCM WAV extraction.
  - `backend/app/services/whisper_service.py`: Local `faster-whisper` (`CTranslate2`) speech-to-text transcription with word-level timestamps.
  - `backend/app/services/gemini_service.py`: Official `google-genai` SDK integration strictly using `gemini-4-hydrogen` to detect viral hooks, conversations, funny/surprising/emotional moments, accurate timestamps, social captions, and hashtags.
  - `backend/app/routes/api.py`: REST API routes including `/api/shorts/generate`, `/api/jobs/{job_id}`, `/api/videos/validate-url`, `/api/videos/upload`, `/api/videos/create-test-video`, `/api/videos/{id}/transcribe`, `/api/videos/{id}/highlights`, `/api/videos/{id}/generate-clips`, `/api/clips/{id}/regenerate`, `DELETE /api/clips/{id}`, and `GET /api/clips/{id}/download`.

---

## 2. Environment Variables (`.env` / `backend/.env`)

```env
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
GEMINI_MODEL="gemini-4-hydrogen"

SQL_HOST="localhost"
SQL_PORT="5432"
SQL_DB_NAME="clipmatrix"
SQL_USER="postgres"
SQL_PASSWORD="your_postgres_password"

REDIS_URL="redis://localhost:6379/0"
WHISPER_MODEL_SIZE="tiny"
WHISPER_DEVICE="cpu"
WHISPER_COMPUTE_TYPE="int8"
```

---

## 3. Running & Testing

1. **Install Node & Python dependencies**:
   ```bash
   npm install
   python3 -m pip install --target .python_packages -r backend/requirements.txt
   ```
2. **Push PostgreSQL schema**:
   ```bash
   npx drizzle-kit push --config=src/db/drizzle.config.ts
   ```
3. **Start the Full-Stack Studio (Port 3000 Gateway + FastAPI Backend)**:
   ```bash
   npm run dev
   ```
4. **Run Unit Tests**:
   ```bash
   npx tsx --test src/utils/clipLogic.test.ts
   ```
