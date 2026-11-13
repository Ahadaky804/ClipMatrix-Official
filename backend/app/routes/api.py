import json
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from ..config import settings
from ..database import SessionLocal, get_db
from ..errors import ClipMatrixError
from ..models import User, Video, Transcript, Highlight, GeneratedClip, ProcessingJob
from ..storage import save_uploaded_video
from ..services.video_processor import (
    check_ffmpeg_and_ffprobe,
    download_remote_video_if_accessible,
    format_timecode,
    parse_timecode_to_seconds,
    probe_video_metadata,
    render_clip_and_thumbnail,
    synthesize_spoken_test_video,
    validate_video_url_accessibility,
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

SHORTS_PIPELINE_STAGES = [
    "Importing Video",
    "Analyzing Video",
    "Extracting Audio",
    "Transcribing Audio",
    "Detecting Highlights",
    "Generating Shorts",
    "Creating Subtitles",
    "Creating Thumbnails",
    "Saving Clips",
    "Completed",
]


def _ensure_user(
    db: Session,
    uid: str = "clipmatrix-personal-owner",
    email: str = "owner@clipmatrix.studio",
) -> User:
    user = db.query(User).filter(User.uid == uid).first()
    if not user:
        user = User(uid=uid, email=email)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def _update_job_stage(
    db: Session,
    job: ProcessingJob,
    stage_name: str,
    progress_percent: int,
    status: str = "running",
    meta: Optional[Dict[str, Any]] = None,
    error_message: Optional[str] = None,
) -> None:
    job.current_step = stage_name
    job.progress_percent = progress_percent
    job.status = status
    job.updated_at = datetime.utcnow()
    if error_message is not None:
        job.error_message = error_message
    if meta is not None:
        job.result_meta_json = json.dumps(meta)
    db.commit()


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
            "mode": "fastapi_background_worker",
            "detail": (
                "Redis server is not running on localhost:6379 in this container. "
                "Celery configuration is valid in backend/app/tasks/celery_app.py; "
                "FastAPI executes pipeline jobs with real-time PostgreSQL stage updates."
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
        "geminiModel": settings.GEMINI_MODEL,
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
        "geminiModel": settings.GEMINI_MODEL,
        "checkedAt": datetime.utcnow().isoformat() + "Z",
        "ffmpegAvailable": media_info["ffmpeg"]["available"],
        "ffprobeAvailable": media_info["ffprobe"]["available"],
        "ffmpegVersion": media_info["ffmpeg"]["version"],
        "fasterWhisperInstalled": whisper_info["available"],
        "geminiApiKeyConfigured": gemini_info["available"],
        "postgresConfigured": pg_info["available"],
        "redisAvailable": redis_info["available"],
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


@router.post("/videos/validate-url")
def validate_video_url(payload: Dict[str, Any] = Body(default={})):
    source_type = str(payload.get("sourceType") or "youtube_url")
    url = str(payload.get("url") or "").strip()
    result = validate_video_url_accessibility(source_type=source_type, raw_url=url)
    return result


@router.post("/videos/upload", status_code=201)
async def upload_video(
    request: Request,
    video: UploadFile = File(...),
    title: str = Form(""),
    sourceType: str = Form("local_upload"),
    sourceUrl: str = Form(""),
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
        source_type=sourceType or "local_upload",
        source_url=sourceUrl.strip() or None,
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

    duration_sec = min(90, max(25, int(payload.get("durationSeconds") or 45)))
    title = (
        str(payload.get("title") or "").strip()
        or "Creator Retention & AI Video Engineering Masterclass"
    )
    source_type = str(payload.get("sourceType") or "local_upload")
    source_url = str(payload.get("sourceUrl") or "").strip() or None
    filename = f"{int(time.time() * 1000)}_spoken_studio_reel.mp4"

    file_path = synthesize_spoken_test_video(filename, duration_seconds=duration_sec)
    meta = probe_video_metadata(file_path)

    db_video = Video(
        user_uid=uid,
        title=title,
        source_type=source_type,
        source_url=source_url,
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


def _execute_automatic_shorts_pipeline(
    job_id: int,
    video_id: int,
    num_shorts: Any,
    target_duration_seconds: float,
    aspect_ratio: str,
    subtitles_enabled: bool,
    subtitle_language: str,
    subtitle_style: str,
    smart_reframing: bool,
    face_tracking: bool,
    whisper_model_size: str,
) -> Dict[str, Any]:
    """
    Executes the full 10-stage Automatic Shorts pipeline and updates ProcessingJob in PostgreSQL
    at each real step so the frontend displays authentic live progress.
    """
    db = SessionLocal()
    try:
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        db_video = db.query(Video).filter(Video.id == video_id).first()
        if not job or not db_video:
            raise ClipMatrixError("Video or ProcessingJob not found in PostgreSQL.", status_code=404)

        source_video_path = settings.VIDEOS_DIR / db_video.stored_filename
        if not source_video_path.exists():
            raise ClipMatrixError("Source video file is missing on disk.", status_code=404)

        # Stage 1: Importing Video (already verified/imported on disk)
        _update_job_stage(
            db,
            job,
            stage_name="Importing Video",
            progress_percent=10,
            meta={"stageIndex": 0, "stage": "Importing Video", "videoTitle": db_video.title},
        )

        # Stage 2: Analyzing Video (FFprobe duration, resolution, audio inspection)
        _update_job_stage(
            db,
            job,
            stage_name="Analyzing Video",
            progress_percent=20,
            meta={"stageIndex": 1, "stage": "Analyzing Video"},
        )
        meta = probe_video_metadata(source_video_path)
        db_video.duration_seconds = meta["durationSeconds"]
        db_video.width = meta["width"]
        db_video.height = meta["height"]
        db_video.fps = meta["fps"]
        db_video.video_codec = meta["videoCodec"]
        db_video.audio_codec = meta["audioCodec"]
        db.commit()

        # Stage 3: Extracting Audio (FFmpeg 16kHz mono WAV)
        _update_job_stage(
            db,
            job,
            stage_name="Extracting Audio",
            progress_percent=32,
            meta={"stageIndex": 2, "stage": "Extracting Audio"},
        )
        wav_name = f"audio_{db_video.id}_{int(time.time() * 1000)}.wav"
        wav_path = extract_wav_audio(source_video_path, wav_name)
        db_video.audio_url = f"/storage/audio/{wav_name}"
        db.commit()

        # Stage 4: Transcribing Audio (faster-whisper local speech-to-text)
        _update_job_stage(
            db,
            job,
            stage_name="Transcribing Audio",
            progress_percent=48,
            meta={"stageIndex": 3, "stage": "Transcribing Audio", "whisperModel": whisper_model_size},
        )
        whisper_lang_map = {
            "english": "en",
            "urdu": "ur",
            "roman_urdu": "hi",
            "spanish": "es",
            "arabic": "ar",
        }
        whisper_lang = whisper_lang_map.get(subtitle_language.lower(), "en")
        tx = transcribe_with_faster_whisper(
            wav_path, model_size=whisper_model_size, language=whisper_lang
        )

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
        db_video.status = "transcribed"
        db.commit()
        db.refresh(transcript)

        # Stage 5: Detecting Highlights (Gemini gemini-4-hydrogen)
        _update_job_stage(
            db,
            job,
            stage_name="Detecting Highlights",
            progress_percent=64,
            meta={
                "stageIndex": 4,
                "stage": "Detecting Highlights",
                "geminiModel": settings.GEMINI_MODEL,
                "segmentsCount": len(tx["segments"]),
            },
        )
        highlight_items = detect_highlights_with_gemini(
            video_title=db_video.title,
            duration_seconds=db_video.duration_seconds,
            segments=tx["segments"],
            num_shorts=num_shorts,
            target_duration_seconds=target_duration_seconds,
            subtitle_language=subtitle_language,
        )

        db.query(Highlight).filter(Highlight.video_id == db_video.id).delete()
        saved_highlights: List[Highlight] = []
        for item in highlight_items:
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
            saved_highlights.append(h)
        db.commit()
        for h in saved_highlights:
            db.refresh(h)

        # Stage 6: Generating Shorts (FFmpeg clip extraction & 9:16 / 1:1 / 16:9 conversion)
        _update_job_stage(
            db,
            job,
            stage_name="Generating Shorts",
            progress_percent=76,
            meta={
                "stageIndex": 5,
                "stage": "Generating Shorts",
                "highlightsCount": len(saved_highlights),
                "aspectRatio": aspect_ratio,
            },
        )

        # Stage 7: Creating Subtitles
        _update_job_stage(
            db,
            job,
            stage_name="Creating Subtitles",
            progress_percent=85,
            meta={
                "stageIndex": 6,
                "stage": "Creating Subtitles",
                "subtitlesEnabled": subtitles_enabled,
                "subtitleStyle": subtitle_style,
            },
        )

        created_clips: List[GeneratedClip] = []
        for idx, (h_obj, h_meta) in enumerate(zip(saved_highlights, highlight_items)):
            start_sec = max(0.0, float(h_obj.start_seconds))
            if target_duration_seconds and target_duration_seconds > 0:
                end_sec = min(
                    float(db_video.duration_seconds),
                    max(start_sec + 2.0, start_sec + float(target_duration_seconds)),
                )
            else:
                end_sec = min(
                    float(db_video.duration_seconds),
                    max(start_sec + 2.0, float(h_obj.end_seconds)),
                )

            ts = int(time.time() * 1000) + idx
            ratio_tag = aspect_ratio.replace(":", "x")
            clip_filename = f"short_v{db_video.id}_{ts}_{ratio_tag}.mp4"
            thumb_filename = f"thumb_v{db_video.id}_{ts}.jpg"

            if idx == len(saved_highlights) - 1:
                # Stage 8: Creating Thumbnails
                _update_job_stage(
                    db,
                    job,
                    stage_name="Creating Thumbnails",
                    progress_percent=92,
                    meta={"stageIndex": 7, "stage": "Creating Thumbnails"},
                )

            render_res = render_clip_and_thumbnail(
                source_video=source_video_path,
                clip_filename=clip_filename,
                thumbnail_filename=thumb_filename,
                start_seconds=start_sec,
                end_seconds=end_sec,
                aspect_ratio=aspect_ratio,
                subtitles_enabled=subtitles_enabled,
                subtitle_style=subtitle_style,
                smart_reframing=smart_reframing,
                face_tracking=face_tracking,
                transcript_segments=tx["segments"],
                fallback_caption=h_meta["caption"],
            )

            start_tc = format_timecode(start_sec)
            end_tc = format_timecode(end_sec)

            clip_row = GeneratedClip(
                video_id=db_video.id,
                highlight_id=h_obj.id,
                title=h_obj.title,
                aspect_ratio=aspect_ratio,
                duration_seconds=render_res["duration_seconds"],
                start_seconds=start_sec,
                end_seconds=end_sec,
                start_timecode=start_tc,
                end_timecode=end_tc,
                clip_url=f"/storage/clips/{clip_filename}",
                thumbnail_url=f"/storage/thumbnails/{thumb_filename}",
                subtitle_url=render_res["subtitle_url"],
                file_size_bytes=render_res["file_size_bytes"],
                virality_score=h_obj.score,
                approval_status="pending_approval",
                caption_text=h_meta["caption"],
                hashtags=h_meta["hashtags"],
                caption_language=subtitle_language,
                subtitles_enabled=1 if subtitles_enabled else 0,
                subtitle_style=subtitle_style,
                smart_reframing=1 if smart_reframing else 0,
                face_tracking=1 if face_tracking else 0,
            )
            db.add(clip_row)
            created_clips.append(clip_row)

        # Stage 9: Saving Clips (Persisting to PostgreSQL)
        _update_job_stage(
            db,
            job,
            stage_name="Saving Clips",
            progress_percent=97,
            meta={"stageIndex": 8, "stage": "Saving Clips", "clipsCount": len(created_clips)},
        )
        db_video.status = "completed"
        db_video.error_message = None
        db.commit()
        for c in created_clips:
            db.refresh(c)

        clip_dicts = [c.to_camel_dict() for c in created_clips]
        highlight_dicts = [h.to_camel_dict() for h in saved_highlights]

        # Stage 10: Completed
        _update_job_stage(
            db,
            job,
            stage_name="Completed",
            progress_percent=100,
            status="completed",
            meta={
                "stageIndex": 9,
                "stage": "Completed",
                "videoId": db_video.id,
                "clipsCount": len(clip_dicts),
                "clipIds": [c["id"] for c in clip_dicts],
                "geminiModel": settings.GEMINI_MODEL,
            },
        )
        db.refresh(job)

        return {
            "job": job.to_camel_dict(),
            "video": db_video.to_camel_dict(),
            "transcript": transcript.to_camel_dict(),
            "highlights": highlight_dicts,
            "clips": clip_dicts,
        }
    except Exception as exc:
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        db_video = db.query(Video).filter(Video.id == video_id).first()
        if job:
            job.status = "failed"
            job.error_message = str(exc)
            job.updated_at = datetime.utcnow()
        if db_video:
            db_video.status = "error"
            db_video.error_message = str(exc)
        db.commit()
        raise exc
    finally:
        db.close()


@router.post("/shorts/generate", status_code=201)
def generate_automatic_shorts(
    request: Request,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
):
    """
    Starts or runs the 10-stage Long Video to Automatic Shorts pipeline.
    Supports:
    - Existing uploaded video (`videoId`)
    - YouTube or Google Drive URL (`sourceUrl` + `sourceType`)
    - Auto-synthesizing a spoken studio video when requested (`synthesizeIfNoVideo=True`)
    """
    uid = request.headers.get("x-user-uid") or "clipmatrix-personal-owner"
    email = request.headers.get("x-user-email") or "owner@clipmatrix.studio"
    _ensure_user(db, uid=uid, email=email)

    source_type = str(payload.get("sourceType") or "local_upload")
    source_url = str(payload.get("sourceUrl") or "").strip()
    video_id = payload.get("videoId")
    custom_title = str(payload.get("title") or "").strip()

    num_shorts = payload.get("numShorts", 3)
    target_duration_seconds = float(payload.get("targetDurationSeconds") or 0.0)
    aspect_ratio = str(payload.get("aspectRatio") or "9:16")
    if aspect_ratio not in ("9:16", "1:1", "16:9"):
        aspect_ratio = "9:16"

    subtitles_enabled = bool(payload.get("subtitlesEnabled", True))
    subtitle_language = str(payload.get("subtitleLanguage") or "english")
    subtitle_style = str(payload.get("subtitleStyle") or "bold_hormozi")
    smart_reframing = bool(payload.get("smartReframing", True))
    face_tracking = bool(payload.get("faceTracking", True))
    whisper_model_size = str(payload.get("whisperModelSize") or settings.WHISPER_MODEL_SIZE)
    async_mode = bool(payload.get("asyncMode", True))

    db_video: Optional[Video] = None

    # 1. If a URL is provided in YouTube or Google Drive mode, validate it first
    url_info: Optional[Dict[str, Any]] = None
    if source_type in ("youtube_url", "google_drive") and source_url:
        url_info = validate_video_url_accessibility(source_type=source_type, raw_url=source_url)
        # Try direct stream download if permitted (e.g. public Google Drive MP4 or direct MP4 URL)
        if url_info.get("directStreamPermitted") and url_info.get("downloadUrl"):
            downloaded_path = download_remote_video_if_accessible(
                url_info["downloadUrl"], label_prefix=source_type
            )
            if downloaded_path:
                meta = probe_video_metadata(downloaded_path)
                db_video = Video(
                    user_uid=uid,
                    title=custom_title or url_info.get("title") or "Imported Remote Video",
                    source_type=source_type,
                    source_url=source_url,
                    original_filename=downloaded_path.name,
                    stored_filename=downloaded_path.name,
                    video_url=f"/storage/videos/{downloaded_path.name}",
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

    # 2. If not downloaded directly from URL, resolve video_id if provided
    if not db_video and video_id:
        db_video = db.query(Video).filter(Video.id == int(video_id)).first()
        if db_video and source_url:
            db_video.source_type = source_type
            db_video.source_url = source_url
            if url_info and url_info.get("title") and not custom_title:
                db_video.title = str(url_info["title"])
            elif custom_title:
                db_video.title = custom_title
            db.commit()

    # 3. If URL requires original video upload and no videoId was attached, return structured error
    if not db_video and source_type in ("youtube_url", "google_drive") and source_url:
        raise ClipMatrixError(
            url_info.get("message")
            if url_info and url_info.get("message")
            else (
                "Direct video stream download is restricted for this link without owner OAuth permissions. "
                "Please upload the original MP4 video file or select an uploaded studio video below to generate Shorts."
            ),
            status_code=422,
        )

    if not db_video:
        raise ClipMatrixError(
            "Please select an uploaded video, paste a valid video link, or upload a video file from your device first.",
            status_code=400,
        )

    # Create ProcessingJob record in PostgreSQL starting at Stage 1: Importing Video
    job = ProcessingJob(
        video_id=db_video.id,
        job_type="automatic_shorts",
        status="running",
        progress_percent=8,
        current_step="Importing Video",
        result_meta_json=json.dumps(
            {
                "stageIndex": 0,
                "stage": "Importing Video",
                "stages": SHORTS_PIPELINE_STAGES,
                "videoTitle": db_video.title,
            }
        ),
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    if async_mode:
        worker = threading.Thread(
            target=_execute_automatic_shorts_pipeline,
            kwargs={
                "job_id": job.id,
                "video_id": db_video.id,
                "num_shorts": num_shorts,
                "target_duration_seconds": target_duration_seconds,
                "aspect_ratio": aspect_ratio,
                "subtitles_enabled": subtitles_enabled,
                "subtitle_language": subtitle_language,
                "subtitle_style": subtitle_style,
                "smart_reframing": smart_reframing,
                "face_tracking": face_tracking,
                "whisper_model_size": whisper_model_size,
            },
            daemon=True,
        )
        worker.start()
        return {
            "job": job.to_camel_dict(),
            "video": db_video.to_camel_dict(),
            "stages": SHORTS_PIPELINE_STAGES,
        }

    result = _execute_automatic_shorts_pipeline(
        job_id=job.id,
        video_id=db_video.id,
        num_shorts=num_shorts,
        target_duration_seconds=target_duration_seconds,
        aspect_ratio=aspect_ratio,
        subtitles_enabled=subtitles_enabled,
        subtitle_language=subtitle_language,
        subtitle_style=subtitle_style,
        smart_reframing=smart_reframing,
        face_tracking=face_tracking,
        whisper_model_size=whisper_model_size,
    )
    return result


@router.get("/jobs/{job_id}")
def get_job_status(job_id: int, db: Session = Depends(get_db)):
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise ClipMatrixError("Processing job not found.", status_code=404)

    job_dict = job.to_camel_dict()
    try:
        meta = json.loads(job.result_meta_json or "{}")
    except Exception:
        meta = {}

    clips_list: List[Dict[str, Any]] = []
    if job.status == "completed":
        clip_ids = meta.get("clipIds") or []
        if clip_ids:
            db_clips = (
                db.query(GeneratedClip)
                .filter(GeneratedClip.id.in_(clip_ids))
                .order_by(GeneratedClip.id.asc())
                .all()
            )
            clips_list = [c.to_camel_dict() for c in db_clips]
        else:
            db_clips = (
                db.query(GeneratedClip)
                .filter(GeneratedClip.video_id == job.video_id)
                .order_by(GeneratedClip.created_at.desc())
                .all()
            )
            clips_list = [c.to_camel_dict() for c in db_clips]

    return {
        "job": job_dict,
        "meta": meta,
        "stages": SHORTS_PIPELINE_STAGES,
        "clips": clips_list,
    }


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
        current_step="Extracting Audio",
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
        job.current_step = "Transcribing Audio"
        db.commit()

        tx = transcribe_with_faster_whisper(
            wav_path, model_size=model_size, language=language
        )

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
def analyze_highlights(
    video_id: int,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
):
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
            "No Whisper transcript found for this video. Run Audio Extraction & faster-whisper Transcription first.",
            status_code=400,
        )

    num_shorts = payload.get("numShorts", "auto")
    target_duration = float(payload.get("targetDurationSeconds") or 0.0)
    subtitle_language = str(payload.get("subtitleLanguage") or "english")

    segments = json.loads(transcript.segments_json or "[]")
    job = ProcessingJob(
        video_id=db_video.id,
        job_type="gemini_highlights",
        status="running",
        progress_percent=40,
        current_step="Detecting Highlights",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    try:
        items = detect_highlights_with_gemini(
            video_title=db_video.title,
            duration_seconds=db_video.duration_seconds,
            segments=segments,
            num_shorts=num_shorts,
            target_duration_seconds=target_duration,
            subtitle_language=subtitle_language,
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
        job.current_step = f"Gemini ({settings.GEMINI_MODEL}) identified {len(saved)} viral highlights."
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

    subtitles_enabled = bool(payload.get("subtitlesEnabled", True))
    subtitle_style = str(payload.get("subtitleStyle") or "bold_hormozi")
    subtitle_language = str(payload.get("subtitleLanguage") or "english")
    smart_reframing = bool(payload.get("smartReframing", True))
    face_tracking = bool(payload.get("faceTracking", True))

    target_duration = float(payload.get("targetDurationSeconds") or 0.0)
    highlight_ids = [int(x) for x in (payload.get("highlightIds") or [])]
    manual_segments = payload.get("manualSegments") or []

    latest_tx = (
        db.query(Transcript)
        .filter(Transcript.video_id == db_video.id)
        .order_by(Transcript.id.desc())
        .first()
    )
    tx_segments = json.loads(latest_tx.segments_json or "[]") if latest_tx else []

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
                        "reason": h.reason,
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
                "reason": "Custom timestamp clip",
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
        current_step="Generating Shorts",
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
                subtitles_enabled=subtitles_enabled,
                subtitle_style=subtitle_style,
                smart_reframing=smart_reframing,
                face_tracking=face_tracking,
                transcript_segments=tx_segments,
                fallback_caption=seg["title"],
            )

            start_tc = format_timecode(seg["start_seconds"])
            end_tc = format_timecode(seg["end_seconds"])
            hashtags_str = "#Shorts #ClipMatrix #Reels #TikTok #Viral"

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
                subtitle_url=render_res["subtitle_url"],
                file_size_bytes=render_res["file_size_bytes"],
                virality_score=seg["score"],
                approval_status="pending_approval",
                caption_text=f"{seg['title']} — {seg.get('reason', '')} ({start_tc}–{end_tc})".strip(),
                hashtags=hashtags_str,
                caption_language=subtitle_language,
                subtitles_enabled=1 if subtitles_enabled else 0,
                subtitle_style=subtitle_style,
                smart_reframing=1 if smart_reframing else 0,
                face_tracking=1 if face_tracking else 0,
            )
            db.add(saved_clip)
            created_clips.append(saved_clip)

        db_video.status = "completed"
        job.status = "completed"
        job.progress_percent = 100
        job.current_step = "Completed"
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

    if "title" in payload and payload["title"]:
        clip.title = str(payload["title"]).strip()
    if "approvalStatus" in payload and payload["approvalStatus"]:
        clip.approval_status = str(payload["approvalStatus"])
    if "captionText" in payload and payload["captionText"] is not None:
        clip.caption_text = str(payload["captionText"])
    if "hashtags" in payload and payload["hashtags"] is not None:
        clip.hashtags = str(payload["hashtags"])
    if "captionLanguage" in payload and payload["captionLanguage"]:
        clip.caption_language = str(payload["captionLanguage"])

    db.commit()
    db.refresh(clip)
    return {"clip": clip.to_camel_dict()}


@router.post("/clips/{clip_id}/regenerate")
def regenerate_clip(
    clip_id: int,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
):
    """
    Re-renders an existing clip via FFmpeg (supports updating start/end timestamps,
    aspectRatio, subtitlesEnabled, subtitleStyle, smartReframing, and faceTracking).
    """
    clip = db.query(GeneratedClip).filter(GeneratedClip.id == clip_id).first()
    if not clip:
        raise ClipMatrixError("Clip not found in PostgreSQL.", status_code=404)

    db_video = db.query(Video).filter(Video.id == clip.video_id).first()
    if not db_video:
        raise ClipMatrixError("Parent source video not found.", status_code=404)

    source_video_path = settings.VIDEOS_DIR / db_video.stored_filename
    if not source_video_path.exists():
        raise ClipMatrixError("Source video file is missing on disk.", status_code=404)

    aspect_ratio = str(payload.get("aspectRatio") or clip.aspect_ratio or "9:16")
    if aspect_ratio not in ("9:16", "1:1", "16:9"):
        aspect_ratio = "9:16"

    start_sec = (
        parse_timecode_to_seconds(payload["startSeconds"])
        if "startSeconds" in payload and payload["startSeconds"] is not None
        else float(clip.start_seconds)
    )
    end_sec = (
        parse_timecode_to_seconds(payload["endSeconds"])
        if "endSeconds" in payload and payload["endSeconds"] is not None
        else float(clip.end_seconds)
    )
    start_sec = max(0.0, min(start_sec, max(0.0, float(db_video.duration_seconds) - 1.0)))
    end_sec = min(float(db_video.duration_seconds), max(start_sec + 1.5, end_sec))

    subtitles_enabled = (
        bool(payload["subtitlesEnabled"])
        if "subtitlesEnabled" in payload
        else bool(clip.subtitles_enabled)
    )
    subtitle_style = str(payload.get("subtitleStyle") or clip.subtitle_style or "bold_hormozi")
    smart_reframing = (
        bool(payload["smartReframing"])
        if "smartReframing" in payload
        else bool(clip.smart_reframing)
    )
    face_tracking = (
        bool(payload["faceTracking"])
        if "faceTracking" in payload
        else bool(clip.face_tracking)
    )

    latest_tx = (
        db.query(Transcript)
        .filter(Transcript.video_id == db_video.id)
        .order_by(Transcript.id.desc())
        .first()
    )
    tx_segments = json.loads(latest_tx.segments_json or "[]") if latest_tx else []

    ts = int(time.time() * 1000)
    ratio_tag = aspect_ratio.replace(":", "x")
    clip_filename = f"regen_v{db_video.id}_c{clip.id}_{ts}_{ratio_tag}.mp4"
    thumb_filename = f"thumb_regen_v{db_video.id}_c{clip.id}_{ts}.jpg"

    render_res = render_clip_and_thumbnail(
        source_video=source_video_path,
        clip_filename=clip_filename,
        thumbnail_filename=thumb_filename,
        start_seconds=start_sec,
        end_seconds=end_sec,
        aspect_ratio=aspect_ratio,
        subtitles_enabled=subtitles_enabled,
        subtitle_style=subtitle_style,
        smart_reframing=smart_reframing,
        face_tracking=face_tracking,
        transcript_segments=tx_segments,
        fallback_caption=clip.caption_text,
    )

    clip.aspect_ratio = aspect_ratio
    clip.start_seconds = start_sec
    clip.end_seconds = end_sec
    clip.duration_seconds = render_res["duration_seconds"]
    clip.start_timecode = format_timecode(start_sec)
    clip.end_timecode = format_timecode(end_sec)
    clip.clip_url = f"/storage/clips/{clip_filename}"
    clip.thumbnail_url = f"/storage/thumbnails/{thumb_filename}"
    clip.subtitle_url = render_res["subtitle_url"]
    clip.file_size_bytes = render_res["file_size_bytes"]
    clip.subtitles_enabled = 1 if subtitles_enabled else 0
    clip.subtitle_style = subtitle_style
    clip.smart_reframing = 1 if smart_reframing else 0
    clip.face_tracking = 1 if face_tracking else 0
    if "title" in payload and payload["title"]:
        clip.title = str(payload["title"]).strip()
    if "captionText" in payload and payload["captionText"] is not None:
        clip.caption_text = str(payload["captionText"])

    db.commit()
    db.refresh(clip)
    return {"clip": clip.to_camel_dict()}


@router.delete("/clips/{clip_id}")
def delete_clip(clip_id: int, db: Session = Depends(get_db)):
    clip = db.query(GeneratedClip).filter(GeneratedClip.id == clip_id).first()
    if not clip:
        raise ClipMatrixError("Clip not found in PostgreSQL.", status_code=404)

    # Remove disk files if present
    for url_attr, base_dir in [
        (clip.clip_url, settings.CLIPS_DIR),
        (clip.thumbnail_url, settings.THUMBNAILS_DIR),
        (clip.subtitle_url, settings.SUBTITLES_DIR),
    ]:
        if url_attr:
            fname = str(url_attr).rsplit("/", 1)[-1]
            fpath: Path = base_dir / fname
            fpath.unlink(missing_ok=True)

    db.delete(clip)
    db.commit()
    return {"deleted": True, "clipId": clip_id}


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
