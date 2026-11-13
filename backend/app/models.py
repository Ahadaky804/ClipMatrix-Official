import json
from datetime import datetime
from typing import Dict, Any
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"

    uid = Column(Text, primary_key=True, index=True)
    email = Column(Text, nullable=False)
    display_name = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    user_uid = Column(Text, nullable=False, default="clipmatrix-personal-owner")
    title = Column(Text, nullable=False)
    original_filename = Column(Text, nullable=False)
    stored_filename = Column(Text, nullable=False)
    video_url = Column(Text, nullable=False)
    audio_url = Column(Text, nullable=True)
    file_size_bytes = Column(Integer, nullable=False)
    mime_type = Column(Text, nullable=False)
    duration_seconds = Column(Float, nullable=False)
    width = Column(Integer, nullable=False)
    height = Column(Integer, nullable=False)
    fps = Column(Float, nullable=False)
    video_codec = Column(Text, nullable=False)
    audio_codec = Column(Text, nullable=False)
    status = Column(Text, nullable=False, default="uploaded")
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    transcripts = relationship("Transcript", back_populates="video", cascade="all, delete-orphan")
    highlights = relationship("Highlight", back_populates="video", cascade="all, delete-orphan")
    generated_clips = relationship("GeneratedClip", back_populates="video", cascade="all, delete-orphan")
    processing_jobs = relationship("ProcessingJob", back_populates="video", cascade="all, delete-orphan")

    def to_camel_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "userUid": self.user_uid,
            "title": self.title,
            "originalFilename": self.original_filename,
            "storedFilename": self.stored_filename,
            "videoUrl": self.video_url,
            "audioUrl": self.audio_url,
            "fileSizeBytes": self.file_size_bytes,
            "mimeType": self.mime_type,
            "durationSeconds": round(float(self.duration_seconds), 2),
            "width": self.width,
            "height": self.height,
            "fps": round(float(self.fps), 2),
            "videoCodec": self.video_codec,
            "audioCodec": self.audio_codec,
            "status": self.status,
            "errorMessage": self.error_message,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else "",
        }


class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    engine_used = Column(Text, nullable=False)
    model_size = Column(Text, nullable=False)
    language = Column(Text, nullable=False)
    full_text = Column(Text, nullable=False)
    segments_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    video = relationship("Video", back_populates="transcripts")

    def to_camel_dict(self) -> Dict[str, Any]:
        try:
            segments = json.loads(self.segments_json or "[]")
        except Exception:
            segments = []
        return {
            "id": self.id,
            "videoId": self.video_id,
            "engineUsed": self.engine_used,
            "modelSize": self.model_size,
            "language": self.language,
            "fullText": self.full_text,
            "segmentsJson": self.segments_json,
            "segments": segments,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else "",
        }


class Highlight(Base):
    __tablename__ = "highlights"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    transcript_id = Column(Integer, ForeignKey("transcripts.id", ondelete="SET NULL"), nullable=True)
    title = Column(Text, nullable=False)
    reason = Column(Text, nullable=False)
    category = Column(Text, nullable=False, default="engaging")
    start_seconds = Column(Float, nullable=False)
    end_seconds = Column(Float, nullable=False)
    start_timecode = Column(Text, nullable=False)
    end_timecode = Column(Text, nullable=False)
    score = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    video = relationship("Video", back_populates="highlights")

    def to_camel_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "videoId": self.video_id,
            "transcriptId": self.transcript_id,
            "title": self.title,
            "reason": self.reason,
            "category": self.category,
            "startSeconds": round(float(self.start_seconds), 2),
            "endSeconds": round(float(self.end_seconds), 2),
            "startTimecode": self.start_timecode,
            "endTimecode": self.end_timecode,
            "score": self.score,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else "",
        }


class GeneratedClip(Base):
    __tablename__ = "generated_clips"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    highlight_id = Column(Integer, ForeignKey("highlights.id", ondelete="SET NULL"), nullable=True)
    title = Column(Text, nullable=False)
    aspect_ratio = Column(Text, nullable=False)
    duration_seconds = Column(Float, nullable=False)
    start_seconds = Column(Float, nullable=False)
    end_seconds = Column(Float, nullable=False)
    start_timecode = Column(Text, nullable=False)
    end_timecode = Column(Text, nullable=False)
    clip_url = Column(Text, nullable=False)
    thumbnail_url = Column(Text, nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    virality_score = Column(Integer, nullable=False, default=85)
    approval_status = Column(Text, nullable=False, default="pending_approval")
    caption_text = Column(Text, nullable=False)
    caption_language = Column(Text, nullable=False, default="english")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    video = relationship("Video", back_populates="generated_clips")

    def to_camel_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "videoId": self.video_id,
            "highlightId": self.highlight_id,
            "title": self.title,
            "aspectRatio": self.aspect_ratio,
            "durationSeconds": round(float(self.duration_seconds), 2),
            "startSeconds": round(float(self.start_seconds), 2),
            "endSeconds": round(float(self.end_seconds), 2),
            "startTimecode": self.start_timecode,
            "endTimecode": self.end_timecode,
            "clipUrl": self.clip_url,
            "thumbnailUrl": self.thumbnail_url,
            "fileSizeBytes": self.file_size_bytes,
            "viralityScore": self.virality_score,
            "approvalStatus": self.approval_status,
            "captionText": self.caption_text,
            "captionLanguage": self.caption_language,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else "",
        }


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    job_type = Column(Text, nullable=False)
    status = Column(Text, nullable=False)
    progress_percent = Column(Integer, nullable=False, default=0)
    current_step = Column(Text, nullable=False)
    error_message = Column(Text, nullable=True)
    result_meta_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    video = relationship("Video", back_populates="processing_jobs")

    def to_camel_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "videoId": self.video_id,
            "jobType": self.job_type,
            "status": self.status,
            "progressPercent": self.progress_percent,
            "currentStep": self.current_step,
            "errorMessage": self.error_message,
            "resultMetaJson": self.result_meta_json,
            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else "",
            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else "",
        }
