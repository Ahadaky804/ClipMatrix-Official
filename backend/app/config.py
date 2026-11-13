import os
from pathlib import Path
from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = Path(__file__).resolve().parents[2]

# Load workspace root .env first, then backend/.env without overriding runtime env vars
load_dotenv(WORKSPACE_ROOT / ".env", override=False)
load_dotenv(BACKEND_ROOT / ".env", override=False)


class Settings:
    PROJECT_NAME: str = "ClipMatrix Phase 2 FastAPI Engine"
    VERSION: str = "2.2.0"

    # PostgreSQL discrete connection parameters (supports Cloud SQL & local Postgres)
    SQL_HOST: str = os.getenv("SQL_HOST", "localhost")
    SQL_PORT: str = os.getenv("SQL_PORT", "5432")
    SQL_DB_NAME: str = os.getenv("SQL_DB_NAME", "clipmatrix")
    SQL_USER: str = os.getenv("SQL_USER") or os.getenv("SQL_ADMIN_USER") or "postgres"
    SQL_PASSWORD: str = os.getenv("SQL_PASSWORD") or os.getenv("SQL_ADMIN_PASSWORD") or ""

    # Redis & Celery
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", REDIS_URL)
    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")

    # Whisper Local Configuration
    WHISPER_MODEL_SIZE: str = os.getenv("WHISPER_MODEL_SIZE", "tiny")
    WHISPER_DEVICE: str = os.getenv("WHISPER_DEVICE", "cpu")
    WHISPER_COMPUTE_TYPE: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

    # Gemini API Configuration (Strictly uses GEMINI_MODEL from environment, defaulting to gemini-4-hydrogen)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-4-hydrogen")

    # Unified Storage Directory at Workspace Root
    STORAGE_ROOT: Path = Path(
        os.getenv("STORAGE_DIR", str(WORKSPACE_ROOT / "storage"))
    ).resolve()
    VIDEOS_DIR: Path = STORAGE_ROOT / "videos"
    AUDIO_DIR: Path = STORAGE_ROOT / "audio"
    CLIPS_DIR: Path = STORAGE_ROOT / "clips"
    THUMBNAILS_DIR: Path = STORAGE_ROOT / "thumbnails"
    SUBTITLES_DIR: Path = STORAGE_ROOT / "subtitles"
    MAX_UPLOAD_SIZE_BYTES: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "500")) * 1024 * 1024


settings = Settings()
