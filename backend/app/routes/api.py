import json
import time
from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session
from ..config import settings
from ..database import get_db
from ..errors import ClipMatrixError
from ..models import Video, Transcript, Highlight, GeneratedClip, ProcessingJob
from ..storage import save_uploaded_video
from ..services.video_processor import (
    format_timecode,
    probe_video_metadata,
    render_clip_and_thumbnail,
)
from ..services.audio_extractor import extract_wav_audio
from ..services.whisper_service import transcribe_with_faster_whisper
from ..services.gemini_service import detect_highlights_with_gemini

router = APIRouter(prefix="/api")


@router.post("/videos/upload")
async def upload_video(
    video: UploadFile = File(...),
    title: str = Form(""),
    db: Session = Depends(get_db),
):
    stored_filename, saved_path, size_bytes = await save_uploaded_video(video)
    meta = probe_video_metadata(saved_path)
    video_title = title.strip() or (video.filename or "Uploaded Video")

    db_video = Video(
        title=video_title,
        original_filename=video.filename or stored_filename,
        stored_filename=stored_filename,
        video_url=f"/storage/videos/{stored_filename}",
        file_size_bytes=size_bytes,
        mime_type=video.content_type or "video/mp4",
        duration_seconds=meta["duration_seconds"],
        width=meta["width"],
        height=meta["height"],
        fps=meta["fps"],
        video_codec=meta["video_codec"],
        audio_codec=meta["audio_codec"],
        status="uploaded",
    )
    db.add(db_video)
    db.commit()
    db.refresh(db_video)
    return {"video": db_video, "metadata": meta}


@router.post("/videos/{video_id}/transcribe")
def transcribe_video(
    video_id: int,
    model_size: str = "base",
    language: str = "en",
    db: Session = Depends(get_db),
):
    db_video = db.query(Video).filter(Video.id == video_id).first()
    if not db_video:
        raise ClipMatrixError("Video not found", status_code=404)

    video_path = settings.VIDEOS_DIR / db_video.stored_filename
    wav_name = f"audio_{db_video.id}_{int(time.time())}.wav"
    wav_path = extract_wav_audio(video_path, wav_name)

    tx = transcribe_with_faster_whisper(wav_path, model_size=model_size, language=language)
    transcript = Transcript(
        video_id=db_video.id,
        engine_used=tx["engine_used"],
        model_size=tx["model_size"],
        language=tx["language"],
        full_text=tx["full_text"],
        segments_json=json.dumps(tx["segments"]),
    )
    db.add(transcript)
    db_video.audio_url = f"/storage/audio/{wav_name}"
    db_video.status = "transcribed"
    db.commit()
    db.refresh(transcript)
    return {"transcript": transcript, "segments": tx["segments"]}


@router.post("/videos/{video_id}/highlights")
def analyze_highlights(video_id: int, db: Session = Depends(get_db)):
    db_video = db.query(Video).filter(Video.id == video_id).first()
    if not db_video:
        raise ClipMatrixError("Video not found", status_code=404)

    transcript = (
        db.query(Transcript)
        .filter(Transcript.video_id == video_id)
        .order_by(Transcript.id.desc())
        .first()
    )
    if not transcript:
        raise ClipMatrixError("Transcribe the video before running Gemini highlight analysis.")

    segments = json.loads(transcript.segments_json or "[]")
    items = detect_highlights_with_gemini(db_video.title, db_video.duration_seconds, segments)

    db.query(Highlight).filter(Highlight.video_id == video_id).delete()
    saved = []
    for item in items:
        h = Highlight(
            video_id=db_video.id,
            transcript_id=transcript.id,
            title=item["title"],
            reason=item["reason"],
            category=item["category"],
            start_seconds=item["startSeconds"],
            end_seconds=item["endSeconds"],
            start_timecode=item["startTimecode"],
            end_timecode=item["endTimecode"],
            score=item["score"],
        )
        db.add(h)
        saved.append(h)

    db_video.status = "highlights_ready"
    db.commit()
    return {"highlights": saved}
