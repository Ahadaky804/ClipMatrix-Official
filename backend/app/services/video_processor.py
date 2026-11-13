import json
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Any, Union
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


def parse_timecode_to_seconds(value: Union[str, int, float]) -> float:
    if isinstance(value, (int, float)):
        return max(0.0, float(value))
    clean = str(value).strip()
    if not clean:
        return 0.0
    try:
        return max(0.0, float(clean))
    except ValueError:
        pass
    parts = clean.split(":")
    try:
        nums = [float(p) for p in parts]
    except ValueError as exc:
        raise VideoProcessingError(f"Invalid timestamp '{value}'. Use MM:SS or HH:MM:SS.") from exc
    if len(nums) == 2:
        return max(0.0, nums[0] * 60.0 + nums[1])
    if len(nums) == 3:
        return max(0.0, nums[0] * 3600.0 + nums[1] * 60.0 + nums[2])
    raise VideoProcessingError(f"Invalid timestamp '{value}'.")


def check_ffmpeg_and_ffprobe() -> Dict[str, Any]:
    ffmpeg_bin = shutil.which("ffmpeg")
    ffprobe_bin = shutil.which("ffprobe")
    ffmpeg_ok = False
    ffprobe_ok = False
    ffmpeg_version = "Unavailable"
    ffprobe_version = "Unavailable"

    if ffmpeg_bin:
        res = subprocess.run([ffmpeg_bin, "-version"], capture_output=True, text=True)
        if res.returncode == 0 and res.stdout:
            ffmpeg_ok = True
            ffmpeg_version = res.stdout.splitlines()[0].strip()

    if ffprobe_bin:
        res = subprocess.run([ffprobe_bin, "-version"], capture_output=True, text=True)
        if res.returncode == 0 and res.stdout:
            ffprobe_ok = True
            ffprobe_version = res.stdout.splitlines()[0].strip()

    return {
        "ffmpeg": {
            "available": ffmpeg_ok,
            "binaryPath": ffmpeg_bin or "not found",
            "version": ffmpeg_version,
        },
        "ffprobe": {
            "available": ffprobe_ok,
            "binaryPath": ffprobe_bin or "not found",
            "version": ffprobe_version,
        },
    }


def probe_video_metadata(video_path: Path) -> Dict[str, Any]:
    if not video_path.exists():
        raise VideoProcessingError(f"Video file not found on disk: {video_path.name}")

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
        raise VideoProcessingError(f"FFprobe execution failed: {res.stderr.strip()}")

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

    file_size = video_path.stat().st_size

    return {
        "durationSeconds": round(duration, 2),
        "duration_seconds": round(duration, 2),
        "width": int(video_stream.get("width", 1280)),
        "height": int(video_stream.get("height", 720)),
        "fps": fps,
        "videoCodec": str(video_stream.get("codec_name", "h264")),
        "video_codec": str(video_stream.get("codec_name", "h264")),
        "audioCodec": str(audio_stream.get("codec_name", "none")) if audio_stream else "none",
        "audio_codec": str(audio_stream.get("codec_name", "none")) if audio_stream else "none",
        "fileSizeBytes": file_size,
        "file_size_bytes": file_size,
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

    midpoint = max(0.0, min(duration - 0.2, duration / 2.0))
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
    thumb_res = subprocess.run(thumb_cmd, capture_output=True, text=True)
    if thumb_res.returncode != 0 or not thumb_path.exists():
        raise VideoProcessingError(f"FFmpeg thumbnail extraction failed: {thumb_res.stderr.strip()}")

    return {
        "clip_path": str(clip_path),
        "thumbnail_path": str(thumb_path),
        "duration_seconds": duration,
        "file_size_bytes": clip_path.stat().st_size,
    }


def synthesize_spoken_test_video(filename: str, duration_seconds: int = 36) -> Path:
    """
    Synthesizes a real 1280x720 H.264/AAC MP4 video with spoken English narration
    generated via FFmpeg's libflite speech synthesizer so local faster-whisper
    transcribes genuine spoken words and sentences with real timestamps.
    """
    settings.VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
    target_path = settings.VIDEOS_DIR / filename

    narration_script = (
        "Welcome to ClipMatrix Studio. "
        "Here is our first viral hook: ninety percent of short form videos fail in the first three seconds because creators start with slow introductions instead of immediate visual tension. "
        "Second, let us look at podcast retention: when you reframe a two speaker interview into vertical nine by sixteen split screen with dynamic captions, watch time increases by over sixty percent. "
        "Third, here is a surprising engineering takeaway: running local Whisper speech transcription combined with Gemini AI highlight scoring lets you extract the best sixty second clips automatically before human approval."
    )

    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "lavfi",
        "-i",
        f"testsrc2=size=1280x720:rate=24:duration={duration_seconds}",
        "-f",
        "lavfi",
        "-i",
        f"flite=text='{narration_script}':voice=slt",
        "-shortest",
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
        str(target_path),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise VideoProcessingError(
            f"FFmpeg failed to synthesize spoken test video: {res.stderr.strip()}"
        )
    return target_path
