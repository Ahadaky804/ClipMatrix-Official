import re
import time
from pathlib import Path
from fastapi import UploadFile
from .config import settings
from .errors import ClipMatrixError

ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"}


def init_storage_dirs() -> None:
    settings.VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
    settings.AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    settings.CLIPS_DIR.mkdir(parents=True, exist_ok=True)
    settings.THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)


async def save_uploaded_video(upload_file: UploadFile) -> tuple[str, Path, int]:
    init_storage_dirs()
    original_name = upload_file.filename or "video.mp4"
    ext = Path(original_name).suffix.lower() or ".mp4"
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise ClipMatrixError(
            f"Unsupported video format '{ext}'. Allowed formats: MP4, MOV, WebM, MKV, AVI."
        )

    safe_stem = re.sub(r"[^a-zA-Z0-9_-]", "_", Path(original_name).stem)[:60]
    stored_filename = f"{int(time.time() * 1000)}_{safe_stem}{ext}"
    destination = settings.VIDEOS_DIR / stored_filename

    total_bytes = 0
    with destination.open("wb") as buffer:
        while chunk := await upload_file.read(1024 * 1024):
            total_bytes += len(chunk)
            if total_bytes > settings.MAX_UPLOAD_SIZE_BYTES:
                destination.unlink(missing_ok=True)
                raise ClipMatrixError("Uploaded file exceeds maximum allowed size (500 MB).")
            buffer.write(chunk)

    return stored_filename, destination, total_bytes
