import json
import subprocess
from pathlib import Path
from typing import Dict, Any
from ..config import settings
from ..errors import VideoProcessingError


def format_timecode(seconds: float) -> str:
    sec = max(0, int(seconds))
    hrs = sec // 3600
    mins = (sec % 3600) // 60
    rem = sec % 60
    if hrs > 0:
        return f"{hrs:02d}:{mins:02d}:{rem:02d}"
    return f"{mins:02d}:{rem:02d}"


def probe_video_metadata(video_path: Path) -> Dict[str, Any]:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=index,codec_name,codec_type,width,height,r_frame_rate",
        "-of",
        "json",
        str(video_path),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise VideoProcessingError(f"FFprobe failed: {res.stderr.strip()}")

    data = json.loads(res.stdout)
    streams = data.get("streams", [])
    video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)
    if not video_stream:
        raise VideoProcessingError("Uploaded file contains no valid video stream.")

    duration = float(data.get("format", {}).get("duration", 0.0) or 10.0)
    fps = 30.0
    rate_str = video_stream.get("r_frame_rate", "30/1")
    if "/" in rate_str:
        num, den = rate_str.split("/", 1)
        if float(den) > 0:
            fps = round(float(num) / float(den), 2)

    return {
        "duration_seconds": round(duration, 2),
        "width": int(video_stream.get("width", 1280)),
        "height": int(video_stream.get("height", 720)),
        "fps": fps,
        "video_codec": str(video_stream.get("codec_name", "h264")),
        "audio_codec": str(audio_stream.get("codec_name", "none")) if audio_stream else "none",
    }


def render_clip_and_thumbnail(
    source_video: Path,
    clip_filename: str,
    thumbnail_filename: str,
    start_seconds: float,
    end_seconds: float,
    aspect_ratio: str = "9:16",
) -> Dict[str, Any]:
    settings.CLIPS_DIR.mkdir(parents=True, exist_ok=True)
    settings.THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)

    duration = max(1.0, round(end_seconds - start_seconds, 2))
    clip_path = settings.CLIPS_DIR / clip_filename
    thumb_path = settings.THUMBNAILS_DIR / thumbnail_filename

    if aspect_ratio == "9:16":
        vf = "crop=min(iw\\,ih*9/16):min(ih\\,iw*16/9),scale=720:1280,setsar=1"
    elif aspect_ratio == "1:1":
        vf = "crop=min(iw\\,ih):min(iw\\,ih),scale=720:720,setsar=1"
    else:
        vf = "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1"

    clip_cmd = [
        "ffmpeg",
        "-y",
        "-ss",
        str(start_seconds),
        "-i",
        str(source_video),
        "-t",
        str(duration),
        "-vf",
        vf,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        str(clip_path),
    ]
    clip_res = subprocess.run(clip_cmd, capture_output=True, text=True)
    if clip_res.returncode != 0:
        raise VideoProcessingError(f"FFmpeg clip rendering failed: {clip_res.stderr.strip()}")

    midpoint = max(0.0, duration / 2.0)
    thumb_cmd = [
        "ffmpeg",
        "-y",
        "-ss",
        str(midpoint),
        "-i",
        str(clip_path),
        "-frames:v",
        "1",
        "-q:v",
        "3",
        str(thumb_path),
    ]
    subprocess.run(thumb_cmd, capture_output=True, text=True)

    return {
        "clip_path": str(clip_path),
        "thumbnail_path": str(thumb_path),
        "duration_seconds": duration,
        "file_size_bytes": clip_path.stat().st_size,
    }
