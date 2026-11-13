import {
  AspectRatioPreset,
  CaptionLanguage,
  CaptionLength,
  CaptionOption,
  CaptionStyle,
  ClipDetectionMode,
  GeneratedClip,
  SocialPlatform,
  VideoSourceType,
} from '../types/clipmatrix';

/**
 * PHASE 1 BACKEND SERVICE PREPARATION CONTRACTS
 *
 * These typed service interfaces define the exact contracts for Phase 2+
 * integration with Python FastAPI, PostgreSQL, Redis + Celery, FFmpeg,
 * local Whisper transcription, and the Gemini API.
 *
 * Note: In Phase 1, no fake live backend processing or API keys are exposed.
 * Sample state and deterministic client-side simulation are strictly separated.
 */

export interface BackendIntegrationSpec {
  id: string;
  serviceName: string;
  category: 'AI & LLM' | 'Speech & Audio' | 'Video Engine' | 'API & Queue' | 'Database & Storage';
  technology: string;
  phaseStatus: 'Contract Ready (Phase 2 Target)' | 'Schema Defined (Phase 2 Target)';
  endpointPattern: string;
  description: string;
  envVariablesRequired: string[];
}

export const BACKEND_INTEGRATION_SPECS: BackendIntegrationSpec[] = [
  {
    id: 'gemini-api',
    serviceName: 'Gemini Highlight & Caption Engine',
    category: 'AI & LLM',
    technology: 'Google Gemini API (@google/genai)',
    phaseStatus: 'Contract Ready (Phase 2 Target)',
    endpointPattern: 'POST /api/v1/ai/captions & POST /api/v1/ai/highlights',
    description:
      'Analyzes transcript segments for viral hook scoring and generates multi-language captions (English, Urdu, Roman Urdu) across 6 tonal styles.',
    envVariablesRequired: ['GEMINI_API_KEY'],
  },
  {
    id: 'whisper-local',
    serviceName: 'Whisper Local Transcription & Diarization',
    category: 'Speech & Audio',
    technology: 'faster-whisper / whisper.cpp + pyannote.audio',
    phaseStatus: 'Contract Ready (Phase 2 Target)',
    endpointPattern: 'POST /api/v1/transcription/whisper-job',
    description:
      'Generates word-level timecodes, multi-speaker podcast diarization labels, and bilingual subtitle tracks.',
    envVariablesRequired: ['WHISPER_MODEL_PATH', 'WHISPER_COMPUTE_TYPE'],
  },
  {
    id: 'ffmpeg-pipeline',
    serviceName: 'FFmpeg Video & Reframing Pipeline',
    category: 'Video Engine',
    technology: 'FFmpeg + OpenCV / MediaPipe Face Tracking',
    phaseStatus: 'Contract Ready (Phase 2 Target)',
    endpointPattern: 'POST /api/v1/render/ffmpeg-crop',
    description:
      'Executes lossless segment slicing, active-speaker 9:16/1:1/16:9 smart crop, dynamic zoom keyframes, and ASS subtitle burn-in.',
    envVariablesRequired: ['FFMPEG_BINARY_PATH', 'RENDER_TEMP_DIR'],
  },
  {
    id: 'fastapi-core',
    serviceName: 'Python FastAPI Core REST & WebSocket Gateway',
    category: 'API & Queue',
    technology: 'Python 3.12 + FastAPI + Pydantic v2',
    phaseStatus: 'Contract Ready (Phase 2 Target)',
    endpointPattern: 'https://api.clipmatrix.local/api/v1/*',
    description:
      'Orchestrates video ingestion, streamer live polling, approval workflows, and OAuth token exchanges.',
    envVariablesRequired: ['FASTAPI_HOST', 'FASTAPI_SECRET_KEY'],
  },
  {
    id: 'postgresql-db',
    serviceName: 'PostgreSQL Relational Store',
    category: 'Database & Storage',
    technology: 'PostgreSQL 16 + SQLAlchemy 2.0 / Alembic',
    phaseStatus: 'Schema Defined (Phase 2 Target)',
    endpointPattern: 'postgresql+asyncpg://localhost:5432/clipmatrix',
    description:
      'Persists projects, generated_clips, streamer_profiles, caption_variants, approval_audit_logs, and social_tokens.',
    envVariablesRequired: ['DATABASE_URL'],
  },
  {
    id: 'redis-celery',
    serviceName: 'Redis Broker & Celery Task Workers',
    category: 'API & Queue',
    technology: 'Redis 7 + Celery 5 Distributed Queue',
    phaseStatus: 'Contract Ready (Phase 2 Target)',
    endpointPattern: 'redis://localhost:6379/0',
    description:
      'Handles long-running livestream recording buffers, asynchronous FFmpeg renders, and scheduled social publishing jobs.',
    envVariablesRequired: ['REDIS_URL', 'CELERY_BROKER_URL'],
  },
  {
    id: 'media-storage',
    serviceName: 'Hybrid Cloud / Local Video Object Storage',
    category: 'Database & Storage',
    technology: 'S3-Compatible (MinIO / AWS S3 / GCS) + Local NVMe Cache',
    phaseStatus: 'Contract Ready (Phase 2 Target)',
    endpointPattern: 's3://clipmatrix-media-bucket/projects/{project_id}/*',
    description:
      'Stores raw long-form uploads, livestream HLS segments, rendered MP4 clips, and generated thumbnail frames.',
    envVariablesRequired: ['STORAGE_PROVIDER', 'S3_BUCKET_NAME', 'LOCAL_MEDIA_ROOT'],
  },
];

export interface ClipJobRequestContract {
  sourceType: VideoSourceType;
  sourceUri: string;
  detectionMode: ClipDetectionMode;
  targetDurationSeconds: number;
  aspectRatio: AspectRatioPreset;
  manualStartTimecode?: string;
  manualEndTimecode?: string;
}

export interface CaptionGenerationRequestContract {
  clipId: string;
  style: CaptionStyle;
  language: CaptionLanguage;
  length: CaptionLength;
  includeEmojis: boolean;
  includeHashtags: boolean;
  count: number; // 5 to 10
}

export interface SocialPublishRequestContract {
  clipId: string;
  platforms: SocialPlatform[];
  captionText: string;
  scheduledIsoTimestamp?: string;
  approvedByUser: boolean;
}

export interface ClipMatrixServiceGateway {
  queueClipExtractionJob(payload: ClipJobRequestContract): Promise<{ jobId: string; mode: 'sample_simulation' }>;
  generateCaptions(payload: CaptionGenerationRequestContract): Promise<CaptionOption[]>;
  submitApprovalDecision(
    clipId: string,
    decision: 'approved' | 'rejected' | 'scheduled',
    notes?: string
  ): Promise<GeneratedClip>;
}

export const POSTGRESQL_TABLE_SCHEMAS: { tableName: string; columns: string[]; indexes: string[] }[] = [
  {
    tableName: 'video_projects',
    columns: [
      'id UUID PRIMARY KEY',
      'title VARCHAR(255) NOT NULL',
      'source_type VARCHAR(32) NOT NULL',
      'source_uri TEXT NOT NULL',
      'duration_seconds INTEGER NOT NULL',
      'status VARCHAR(32) DEFAULT \'queued\'',
      'created_at TIMESTAMPTZ DEFAULT NOW()',
    ],
    indexes: ['idx_video_projects_status', 'idx_video_projects_created_at'],
  },
  {
    tableName: 'generated_clips',
    columns: [
      'id UUID PRIMARY KEY',
      'project_id UUID REFERENCES video_projects(id) ON DELETE CASCADE',
      'title VARCHAR(255) NOT NULL',
      'start_ms INTEGER NOT NULL',
      'end_ms INTEGER NOT NULL',
      'aspect_ratio VARCHAR(8) NOT NULL',
      'virality_score SMALLINT CHECK (virality_score BETWEEN 0 AND 100)',
      'approval_status VARCHAR(32) DEFAULT \'pending_approval\'',
      'edit_config JSONB NOT NULL',
      'storage_key TEXT',
    ],
    indexes: ['idx_clips_project_id', 'idx_clips_approval_status'],
  },
  {
    tableName: 'streamer_monitors',
    columns: [
      'id UUID PRIMARY KEY',
      'handle VARCHAR(120) UNIQUE NOT NULL',
      'platform VARCHAR(32) NOT NULL',
      'is_live BOOLEAN DEFAULT FALSE',
      'monitoring_enabled BOOLEAN DEFAULT TRUE',
      'auto_clip_threshold SMALLINT DEFAULT 80',
      'last_live_at TIMESTAMPTZ',
    ],
    indexes: ['idx_streamers_is_live', 'idx_streamers_platform'],
  },
  {
    tableName: 'caption_variants',
    columns: [
      'id UUID PRIMARY KEY',
      'clip_id UUID REFERENCES generated_clips(id) ON DELETE CASCADE',
      'style VARCHAR(32) NOT NULL',
      'language VARCHAR(24) NOT NULL',
      'length_preset VARCHAR(16) NOT NULL',
      'body_text TEXT NOT NULL',
      'hashtags TEXT[]',
      'is_saved BOOLEAN DEFAULT FALSE',
    ],
    indexes: ['idx_captions_clip_id', 'idx_captions_language_style'],
  },
];
