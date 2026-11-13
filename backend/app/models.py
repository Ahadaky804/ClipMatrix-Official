from datetime import datetime
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship
from .database import Base


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
    created_at = Column(DateTime, default=datetime.utcnow)

    transcripts = relationship("Transcript", back_populates="video", cascade="all, delete-orphan")
    highlights = relationship("Highlight", back_populates="video", cascade="all, delete-orphan")
    generated_clips = relationship("GeneratedClip", back_populates="video", cascade="all, delete-orphan")
    processing_jobs = relationship("ProcessingJob", back_populates="video", cascade="all, delete-orphan")


class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False)
    engine_used = Column(Text, nullable=False)
    model_size = Column(Text, nullable=False)
    language = Column(Text, nullable=False)
    full_text = Column(Text, nullable=False)
    segments_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    video = relationship("Video", back_populates="transcripts")


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
    created_at = Column(DateTime, default=datetime.utcnow)

    video = relationship("Video", back_populates="highlights")


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
    created_at = Column(DateTime, default=datetime.utcnow)

    video = relationship("Video", back_populates="generated_clips")


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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    video = relationship("Video", back_populates="processing_jobs")
