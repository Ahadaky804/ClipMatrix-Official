import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


class Settings:
    PROJECT_NAME: str = "ClipMatrix Phase 2 API"
    VERSION: str = "2.0.0"

    # PostgreSQL discrete connection parameters
    SQL_HOST: str = os.getenv("SQL_HOST", "localhost")
    SQL_PORT: str = os.getenv("SQL_PORT", "5432")
    SQL_DB_NAME: str = os.getenv("SQL_DB_NAME", "clipmatrix")
    SQL_USER: str = os.getenv("SQL_USER", "postgres")
    SQL_PASSWORD: str = os.getenv("SQL_PASSWORD", "")

    # Redis & Celery
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", REDIS_URL)
    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")

    # Whisper Local Configuration
    WHISPER_MODEL_SIZE: str = os.getenv("WHISPER_MODEL_SIZE", "base")
    WHISPER_DEVICE: str = os.getenv("WHISPER_DEVICE", "cpu")
    WHISPER_COMPUTE_TYPE: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

    # Gemini API Configuration
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-4-hydrogen")

    # Storage
    STORAGE_ROOT: Path = Path(os.getenv("STORAGE_DIR", "./storage")).resolve()
    VIDEOS_DIR: Path = STORAGE_ROOT / "videos"
    AUDIO_DIR: Path = STORAGE_ROOT / "audio"
    CLIPS_DIR: Path = STORAGE_ROOT / "clips"
    THUMBNAILS_DIR: Path = STORAGE_ROOT / "thumbnails"
    MAX_UPLOAD_SIZE_BYTES: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "500")) * 1024 * 1024


settings = Settings()
