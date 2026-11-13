import subprocess
from pathlib import Path
from ..config import settings
from ..errors import VideoProcessingError


def extract_wav_audio(video_path: Path, output_wav_name: str) -> Path:
    settings.AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    output_path = settings.AUDIO_DIR / output_wav_name

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(video_path),
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        str(output_path),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise VideoProcessingError(
            f"FFmpeg audio extraction failed: {res.stderr.strip()}"
        )
    return output_path
