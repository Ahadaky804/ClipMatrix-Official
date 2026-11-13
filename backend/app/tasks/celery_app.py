import json
from pathlib import Path
from celery import Celery
from ..config import settings
from ..database import SessionLocal
from ..models import Video, Transcript, Highlight
from ..services.audio_extractor import extract_wav_audio
from ..services.whisper_service import transcribe_with_faster_whisper
from ..services.gemini_service import detect_highlights_with_gemini

celery_app = Celery(
    "clipmatrix_tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)


@celery_app.task(name="clipmatrix.process_video_pipeline")
def process_video_pipeline_task(video_id: int, model_size: str = "base") -> dict:
    db = SessionLocal()
    try:
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            return {"error": f"Video {video_id} not found"}

        video_path = settings.VIDEOS_DIR / video.stored_filename
        wav_path = extract_wav_audio(video_path, f"audio_{video.id}.wav")

        tx_res = transcribe_with_faster_whisper(wav_path, model_size=model_size)
        transcript = Transcript(
            video_id=video.id,
            engine_used=tx_res["engine_used"],
            model_size=tx_res["model_size"],
            language=tx_res["language"],
            full_text=tx_res["full_text"],
            segments_json=json.dumps(tx_res["segments"]),
        )
        db.add(transcript)
        db.commit()
        db.refresh(transcript)

        highlights = detect_highlights_with_gemini(
            video_title=video.title,
            duration_seconds=video.duration_seconds,
            segments=tx_res["segments"],
        )
        for h in highlights:
            db.add(
                Highlight(
                    video_id=video.id,
                    transcript_id=transcript.id,
                    title=h["title"],
                    reason=h["reason"],
                    category=h["category"],
                    start_seconds=h["startSeconds"],
                    end_seconds=h["endSeconds"],
                    start_timecode=h["startTimecode"],
                    end_timecode=h["endTimecode"],
                    score=h["score"],
                )
            )
        video.status = "highlights_ready"
        db.commit()
        return {"video_id": video.id, "highlights_count": len(highlights)}
    finally:
        db.close()
