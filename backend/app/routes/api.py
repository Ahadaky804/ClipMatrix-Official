import json
import time
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from ..config import settings
from ..database import get_db
from ..errors import ClipMatrixError
from ..models import User, Video, Transcript, Highlight, GeneratedClip, ProcessingJob
from ..storage import save_uploaded_video
from ..services.video_processor import (
    check_ffmpeg_and_ffprobe,
    format_timecode,
    parse_timecode_to_seconds,
    probe_video_metadata,
    render_clip_and_thumbnail,
    synthesize_spoken_test_video,
)
from ..services.audio_extractor import extract_wav_audio
from ..services.whisper_service import (
    check_whisper_status,
    transcribe_with_faster_whisper,
)
from ..services.gemini_service import (
    detect_highlights_with_gemini,
    verify_gemini_live_connection,
)

router = APIRouter(prefix="/api")


def _ensure_user(db: Session, uid: str = "clipmatrix-personal-owner", email: str = "owner@clipmatrix.studio") -> User:
    user = db.query(User).filter(User.uid == uid).first()
    if not user:
        user = User(uid=uid, email=email, display_name="ClipMatrix Creator")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def _check_redis_status() -> Dict[str, Any]:
    try:
        import redis
        client = redis.Redis.from_url(
            settings.REDIS_URL,
            socket_connect_timeout=1.2,
            socket_timeout=1.2,
        )
        t0 = time.perf_counter()
        pong = client.ping()
        latency_ms = round((time.perf_counter() - t0) * 1000.0, 1)
        return {
            "available": bool(pong),
            "brokerUrl": settings.REDIS_URL,
            "latencyMs": latency_ms,
            "mode": "celery_redis_worker_ready",
            "detail": f"Connected to Redis broker ({latency_ms} ms).",
        }
    except Exception as exc:
        return {
            "available": False,
            "brokerUrl": settings.REDIS_URL,
            "mode": "synchronous_fastapi_fallback",
            "detail": (
                "Redis server is not running on localhost:6379 in this container. "
                "Celery configuration is valid in backend/app/tasks/celery_app.py; "
                "FastAPI executes pipeline tasks synchronously until redis-server is started."
            ),
            "error": str(exc),
        }


def _check_postgres_status(db: Session) -> Dict[str, Any]:
    try:
        t0 = time.perf_counter()
        row = db.execute(
            text(
                "SELECT version(), current_database(), "
                "(SELECT COUNT(*) FROM videos) AS v_cnt, "
                "(SELECT COUNT(*) FROM transcripts) AS t_cnt, "
                "(SELECT COUNT(*) FROM highlights) AS h_cnt, "
                "(SELECT COUNT(*) FROM generated_clips) AS c_cnt"
            )
        ).fetchone()
        latency_ms = round((time.perf_counter() - t0) * 1000.0, 1)
        version_short = str(row[0]).split(",")[0] if row else "PostgreSQL"
        return {
            "available": True,
            "database": str(row[1]) if row else settings.SQL_DB_NAME,
            "host": settings.SQL_HOST,
            "version": version_short,
            "latencyMs": latency_ms,
            "counts": {
                "videos": int(row[2]) if row else 0,
                "transcripts": int(row[3]) if row else 0,
                "highlights": int(row[4]) if row else 0,
                "generatedClips": int(row[5]) if row else 0,
            },
        }
    except Exception as exc:
        return {
            "available": False,
            "database": settings.SQL_DB_NAME,
            "host": settings.SQL_HOST,
            "error": str(exc),
        }


@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "backend": "python-fastapi",
        "version": settings.VERSION,
    }


@router.get("/system/status")
def system_status(
    refresh: bool = Query(False),
    db: Session = Depends(get_db),
):
    media_info = check_ffmpeg_and_ffprobe()
    whisper_info = check_whisper_status()
    gemini_info = verify_gemini_live_connection(force_refresh=refresh)
    pg_info = _check_postgres_status(db)
    redis_info = _check_redis_status()

    return {
        "status": "ok",
        "primaryBackend": "Python FastAPI (SQLAlchemy + faster-whisper + google-genai + FFmpeg)",
        "checkedAt": datetime.utcnow().isoformat() + "Z",
        # Legacy top-level flags for quick checks
        "ffmpegAvailable": media_info["ffmpeg"]["available"],
        "ffprobeAvailable": media_info["ffprobe"]["available"],
        "ffmpegVersion": media_info["ffmpeg"]["version"],
        "fasterWhisperInstalled": whisper_info["available"],
        "geminiApiKeyConfigured": gemini_info["available"],
        "postgresConfigured": pg_info["available"],
        "redisAvailable": redis_info["available"],
        # Detailed structured diagnostics for the System Diagnostics panel
        "services": {
            "ffmpeg": media_info["ffmpeg"],
            "ffprobe": media_info["ffprobe"],
            "whisper": whisper_info,
            "gemini": gemini_info,
            "postgresql": pg_info,
            "redis": redis_info,
        },
    }


@router.get("/workspace")
def get_workspace(
    request: Request,
    db: Session = Depends(get_db),
):
    uid = request.headers.get("x-user-uid") or "clipmatrix-personal-owner"
    email = request.headers.get("x-user-email") or "owner@clipmatrix.studio"
    _ensure_user(db, uid=uid, email=email)

    videos = db.query(Video).order_by(Video.created_at.desc()).all()
    all_clips = db.query(GeneratedClip).order_by(GeneratedClip.created_at.desc()).all()
    all_highlights = db.query(Highlight).order_by(Highlight.score.desc()).all()

    enriched_videos = []
    for v in videos:
        v_dict = v.to_camel_dict()
        latest_tx = (
            db.query(Transcript)
            .filter(Transcript.video_id == v.id)
            .order_by(Transcript.created_at.desc())
            .first()
        )
        v_highlights = [
            h.to_camel_dict()
            for h in all_highlights
            if h.video_id == v.id
        ]
        v_clips = [
            c.to_camel_dict()
            for c in all_clips
            if c.video_id == v.id
        ]
        v_jobs = [
            j.to_camel_dict()
            for j in db.query(ProcessingJob)
            .filter(ProcessingJob.video_id == v.id)
            .order_by(ProcessingJob.created_at.desc())
            .all()
        ]
        v_dict["transcript"] = latest_tx.to_camel_dict() if latest_tx else None
        v_dict["highlights"] = v_highlights
        v_dict["clips"] = v_clips
        v_dict["jobs"] = v_jobs
        enriched_videos.append(v_dict)

    return {
        "videos": enriched_videos,
        "clips": [c.to_camel_dict() for c in all_clips],
        "highlights": [h.to_camel_dict() for h in all_highlights],
    }


@router.post("/videos/upload", status_code=201)
async def upload_video(
    request: Request,
    video: UploadFile = File(...),
    title: str = Form(""),
    db: Session = Depends(get_db),
):
    uid = request.headers.get("x-user-uid") or "clipmatrix-personal-owner"
    email = request.headers.get("x-user-email") or "owner@clipmatrix.studio"
    _ensure_user(db, uid=uid, email=email)

    stored_filename, saved_path, size_bytes = await save_uploaded_video(video)
    meta = probe_video_metadata(saved_path)
    raw_name = video.filename or stored_filename
    stem_title = raw_name.rsplit(".", 1)[0] if "." in raw_name else raw_name
    video_title = title.strip() or stem_title

    db_video = Video(
        user_uid=uid,
        title=video_title,
        original_filename=raw_name,
        stored_filename=stored_filename,
        video_url=f"/storage/videos/{stored_filename}",
        audio_url=None,
        file_size_bytes=size_bytes,
        mime_type=video.content_type or "video/mp4",
        duration_seconds=meta["durationSeconds"],
        width=meta["width"],
        height=meta["height"],
        fps=meta["fps"],
        video_codec=meta["videoCodec"],
        audio_codec=meta["audioCodec"],
        status="uploaded",
    )
    db.add(db_video)
    db.commit()
    db.refresh(db_video)

    job = ProcessingJob(
        video_id=db_video.id,
        job_type="upload_probe",
        status="completed",
        progress_percent=100,
        current_step=f"Uploaded & verified via FFprobe ({meta['width']}x{meta['height']}, {meta['durationSeconds']}s)",
        result_meta_json=json.dumps(meta),
    )
    db.add(job)
    db.commit()

    return {"video": db_video.to_camel_dict(), "metadata": meta}


@router.post("/videos/create-test-video", status_code=201)
def create_spoken_test_video(
    request: Request,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
):
    uid = request.headers.get("x-user-uid") or "clipmatrix-personal-owner"
    email = request.headers.get("x-user-email") or "owner@clipmatrix.studio"
    _ensure_user(db, uid=uid, email=email)

    duration_sec = min(90, max(20, int(payload.get("durationSeconds") or 36)))
    title = (
        str(payload.get("title") or "").strip()
        or "Creator Retention & AI Video Engineering Masterclass"
    )
    filename = f"{int(time.time() * 1000)}_spoken_studio_reel.mp4"

    file_path = synthesize_spoken_test_video(filename, duration_seconds=duration_sec)
    meta = probe_video_metadata(file_path)

    db_video = Video(
        user_uid=uid,
        title=title,
        original_filename=filename,
        stored_filename=filename,
        video_url=f"/storage/videos/{filename}",
        audio_url=None,
        file_size_bytes=meta["fileSizeBytes"],
        mime_type="video/mp4",
        duration_seconds=meta["durationSeconds"],
        width=meta["width"],
        height=meta["height"],
        fps=meta["fps"],
        video_codec=meta["videoCodec"],
        audio_codec=meta["audioCodec"],
        status="uploaded",
    )
    db.add(db_video)
    db.commit()
    db.refresh(db_video)

    job = ProcessingJob(
        video_id=db_video.id,
        job_type="upload_probe",
        status="completed",
        progress_percent=100,
        current_step=f"Synthesized spoken English MP4 via FFmpeg ({meta['width']}x{meta['height']}, {meta['durationSeconds']}s)",
        result_meta_json=json.dumps(meta),
    )
    db.add(job)
    db.commit()

    return {"video": db_video.to_camel_dict(), "metadata": meta}


@router.post("/videos/{video_id}/transcribe")
def transcribe_video(
    video_id: int,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
):
    db_video = db.query(Video).filter(Video.id == video_id).first()
    if not db_video:
        raise ClipMatrixError("Video not found in PostgreSQL.", status_code=404)

    model_size = str(payload.get("modelSize") or payload.get("model_size") or settings.WHISPER_MODEL_SIZE)
    language = str(payload.get("language") or "en")

    job = ProcessingJob(
        video_id=db_video.id,
        job_type="transcription",
        status="running",
        progress_percent=25,
        current_step="Extracting 16kHz mono WAV audio via FFmpeg...",
    )
    db_video.status = "transcribing"
    db.add(job)
    db.commit()
    db.refresh(job)

    try:
        video_path = settings.VIDEOS_DIR / db_video.stored_filename
        wav_name = f"audio_{db_video.id}_{int(time.time() * 1000)}.wav"
        wav_path = extract_wav_audio(video_path, wav_name)

        job.progress_percent = 60
        job.current_step = f"Running local faster-whisper ({model_size}) speech-to-text..."
        db.commit()

        tx = transcribe_with_faster_whisper(
            wav_path, model_size=model_size, language=language
        )

        # Replace previous transcripts for this video so latest is clean
        db.query(Transcript).filter(Transcript.video_id == db_video.id).delete()
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
        db_video.error_message = None

        job.status = "completed"
        job.progress_percent = 100
        job.current_step = (
            f"Transcribed {len(tx['segments'])} spoken segments via {tx['model_size']}"
        )
        job.result_meta_json = json.dumps(
            {
                "engineUsed": tx["engine_used"],
                "modelSize": tx["model_size"],
                "segmentsCount": len(tx["segments"]),
            }
        )
        db.commit()
        db.refresh(transcript)

        return {
            "transcript": transcript.to_camel_dict(),
            "fasterWhisperInstalled": True,
            "notice": f"Transcribed locally with faster-whisper ({tx['model_size']}) — {len(tx['segments'])} timestamped speech segments.",
        }
    except Exception as exc:
        db_video.status = "error"
        db_video.error_message = str(exc)
        job.status = "failed"
        job.error_message = str(exc)
        db.commit()
        if isinstance(exc, ClipMatrixError):
            raise exc
        raise ClipMatrixError(f"Whisper transcription failed: {exc}", status_code=500) from exc


@router.post("/videos/{video_id}/highlights")
def analyze_highlights(video_id: int, db: Session = Depends(get_db)):
    db_video = db.query(Video).filter(Video.id == video_id).first()
    if not db_video:
        raise ClipMatrixError("Video not found in PostgreSQL.", status_code=404)

    transcript = (
        db.query(Transcript)
        .filter(Transcript.video_id == video_id)
        .order_by(Transcript.id.desc())
        .first()
    )
    if not transcript:
        raise ClipMatrixError(
            "No Whisper transcript found for this video. Run Step 2 (Audio Extraction & faster-whisper Transcription) first.",
            status_code=400,
        )

    segments = json.loads(transcript.segments_json or "[]")
    job = ProcessingJob(
        video_id=db_video.id,
        job_type="gemini_highlights",
        status="running",
        progress_percent=40,
        current_step=f"Analyzing Whisper transcript with Gemini ({settings.GEMINI_MODEL})...",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    try:
        items = detect_highlights_with_gemini(
            db_video.title, db_video.duration_seconds, segments
        )

        db.query(Highlight).filter(Highlight.video_id == video_id).delete()
        saved: List[Highlight] = []
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
        job.status = "completed"
        job.progress_percent = 100
        job.current_step = f"Gemini identified {len(saved)} viral highlights."
        db.commit()
        for h in saved:
            db.refresh(h)

        return {"highlights": [h.to_camel_dict() for h in saved]}
    except Exception as exc:
        job.status = "failed"
        job.error_message = str(exc)
        db.commit()
        if isinstance(exc, ClipMatrixError):
            raise exc
        raise ClipMatrixError(f"Gemini highlight detection failed: {exc}", status_code=400) from exc


@router.post("/videos/{video_id}/generate-clips", status_code=201)
def generate_clips(
    video_id: int,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
):
    db_video = db.query(Video).filter(Video.id == video_id).first()
    if not db_video:
        raise ClipMatrixError("Video not found in PostgreSQL.", status_code=404)

    source_video_path = settings.VIDEOS_DIR / db_video.stored_filename
    if not source_video_path.exists():
        raise ClipMatrixError("Source video file is missing on disk. Please re-upload.", status_code=404)

    aspect_ratio = str(payload.get("aspectRatio") or "9:16")
    if aspect_ratio not in ("9:16", "16:9", "1:1"):
        aspect_ratio = "9:16"

    target_duration = float(payload.get("targetDurationSeconds") or 0.0)
    highlight_ids = [int(x) for x in (payload.get("highlightIds") or [])]
    manual_segments = payload.get("manualSegments") or []

    segments_to_render: List[Dict[str, Any]] = []

    if highlight_ids:
        db_highlights = (
            db.query(Highlight).filter(Highlight.video_id == db_video.id).all()
        )
        for h in db_highlights:
            if h.id in highlight_ids:
                start = max(0.0, float(h.start_seconds))
                end = (
                    min(float(db_video.duration_seconds), start + target_duration)
                    if target_duration > 0
                    else min(float(db_video.duration_seconds), float(h.end_seconds))
                )
                segments_to_render.append(
                    {
                        "highlight_id": h.id,
                        "title": h.title,
                        "start_seconds": start,
                        "end_seconds": max(start + 1.0, end),
                        "score": h.score,
                    }
                )

    for manual in manual_segments:
        start = parse_timecode_to_seconds(manual.get("startTime", 0))
        end_raw = manual.get("endTime")
        if end_raw is not None and str(end_raw).strip() != "":
            end = parse_timecode_to_seconds(end_raw)
        else:
            end = start + (target_duration if target_duration > 0 else 15.0)

        if target_duration > 0 and not end_raw:
            end = start + target_duration

        clamped_start = max(
            0.0, min(start, max(0.0, float(db_video.duration_seconds) - 1.0))
        )
        clamped_end = min(
            float(db_video.duration_seconds), max(clamped_start + 1.0, end)
        )
        title_str = str(manual.get("title") or "").strip() or (
            f"{db_video.title} ({format_timecode(clamped_start)}–{format_timecode(clamped_end)})"
        )
        segments_to_render.append(
            {
                "highlight_id": None,
                "title": title_str,
                "start_seconds": clamped_start,
                "end_seconds": clamped_end,
                "score": int(manual.get("score") or 90),
            }
        )

    if not segments_to_render:
        raise ClipMatrixError(
            "Please select at least one AI highlight or provide valid manual start/end timestamps.",
            status_code=400,
        )

    job = ProcessingJob(
        video_id=db_video.id,
        job_type="ffmpeg_clip_render",
        status="running",
        progress_percent=25,
        current_step=f"Rendering {len(segments_to_render)} clip(s) in {aspect_ratio} via FFmpeg...",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    created_clips: List[GeneratedClip] = []
    try:
        for idx, seg in enumerate(segments_to_render):
            ts = int(time.time() * 1000) + idx
            ratio_tag = aspect_ratio.replace(":", "x")
            clip_filename = f"clip_v{db_video.id}_{ts}_{ratio_tag}.mp4"
            thumb_filename = f"thumb_v{db_video.id}_{ts}.jpg"

            render_res = render_clip_and_thumbnail(
                source_video=source_video_path,
                clip_filename=clip_filename,
                thumbnail_filename=thumb_filename,
                start_seconds=seg["start_seconds"],
                end_seconds=seg["end_seconds"],
                aspect_ratio=aspect_ratio,
            )

            start_tc = format_timecode(seg["start_seconds"])
            end_tc = format_timecode(seg["end_seconds"])

            saved_clip = GeneratedClip(
                video_id=db_video.id,
                highlight_id=seg["highlight_id"],
                title=seg["title"],
                aspect_ratio=aspect_ratio,
                duration_seconds=render_res["duration_seconds"],
                start_seconds=seg["start_seconds"],
                end_seconds=seg["end_seconds"],
                start_timecode=start_tc,
                end_timecode=end_tc,
                clip_url=f"/storage/clips/{clip_filename}",
                thumbnail_url=f"/storage/thumbnails/{thumb_filename}",
                file_size_bytes=render_res["file_size_bytes"],
                virality_score=seg["score"],
                approval_status="pending_approval",
                caption_text=f"{seg['title']} ({start_tc}–{end_tc}) #ClipMatrix #Shorts",
                caption_language="english",
            )
            db.add(saved_clip)
            created_clips.append(saved_clip)

        db_video.status = "completed"
        job.status = "completed"
        job.progress_percent = 100
        job.current_step = f"Generated {len(created_clips)} MP4 clip(s) and thumbnails via FFmpeg."
        db.commit()
        for c in created_clips:
            db.refresh(c)

        return {"clips": [c.to_camel_dict() for c in created_clips]}
    except Exception as exc:
        job.status = "failed"
        job.error_message = str(exc)
        db.commit()
        if isinstance(exc, ClipMatrixError):
            raise exc
        raise ClipMatrixError(f"FFmpeg clip generation failed: {exc}", status_code=500) from exc


@router.patch("/clips/{clip_id}")
def update_clip(
    clip_id: int,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
):
    clip = db.query(GeneratedClip).filter(GeneratedClip.id == clip_id).first()
    if not clip:
        raise ClipMatrixError("Clip not found in PostgreSQL.", status_code=404)

    if "approvalStatus" in payload and payload["approvalStatus"]:
        clip.approval_status = str(payload["approvalStatus"])
    if "captionText" in payload and payload["captionText"] is not None:
        clip.caption_text = str(payload["captionText"])
    if "captionLanguage" in payload and payload["captionLanguage"]:
        clip.caption_language = str(payload["captionLanguage"])

    db.commit()
    db.refresh(clip)
    return {"clip": clip.to_camel_dict()}


@router.get("/clips/{clip_id}/download")
def download_clip(clip_id: int, db: Session = Depends(get_db)):
    clip = db.query(GeneratedClip).filter(GeneratedClip.id == clip_id).first()
    if not clip:
        raise ClipMatrixError("Clip not found in database.", status_code=404)

    filename = clip.clip_url.rsplit("/", 1)[-1]
    full_path = settings.CLIPS_DIR / filename
    if not full_path.exists():
        raise ClipMatrixError("Clip MP4 file not found on disk.", status_code=404)

    return FileResponse(
        path=str(full_path),
        media_type="video/mp4",
        filename=filename,
    )
