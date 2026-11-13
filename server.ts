import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import * as dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import {
  createProcessingJobRecord,
  getAllGeneratedClips,
  getAllHighlights,
  getAllVideos,
  getHighlightsByVideoId,
  getJobsByVideoId,
  getOrCreateUser,
  getTranscriptByVideoId,
  getVideoById,
  insertGeneratedClipRecord,
  insertTranscriptRecord,
  insertVideoRecord,
  replaceVideoHighlights,
  updateGeneratedClipApproval,
  updateProcessingJobRecord,
  updateVideoRecord,
} from './src/db/repository.ts';
import {
  checkFfmpegCapabilities,
  CLIPS_DIR,
  ensureStorageDirectories,
  extractAudioToWav,
  extractVideoMetadata,
  formatSecondsToTimecode,
  generateVideoClipWithFfmpeg,
  parseTimecodeToSeconds,
  STORAGE_ROOT,
  synthesizeRealTestVideo,
  VIDEOS_DIR,
} from './src/server/ffmpegService.ts';
import {
  isFasterWhisperAvailable,
  isGeminiApiKeyConfigured,
  transcribeAudioFile,
  TranscriptSegmentItem,
} from './src/server/transcriptionService.ts';
import { analyzeTranscriptWithGemini } from './src/server/geminiHighlightService.ts';

dotenv.config();

const PORT = 3000;

ensureStorageDirectories().catch((err) => {
  console.error('Failed to initialize storage directories:', err);
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(VIDEOS_DIR, { recursive: true });
    cb(null, VIDEOS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
    cb(null, `${Date.now()}_${safeBase}${ext}`);
  },
});

const ALLOWED_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.webm',
  '.mkv',
  '.avi',
  '.m4v',
]);

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB max upload size
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (
      ALLOWED_EXTENSIONS.has(ext) ||
      file.mimetype.startsWith('video/')
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file format "${ext}". Please upload MP4, MOV, WebM, MKV, or AVI.`
        )
      );
    }
  },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Serve generated clips, uploaded videos, extracted audio, and thumbnails
  app.use('/storage', express.static(STORAGE_ROOT));

  // 1. System & Engine Diagnostics
  app.get('/api/system/status', async (_req, res) => {
    try {
      const ffmpegInfo = await checkFfmpegCapabilities();
      const whisperInstalled = await isFasterWhisperAvailable();
      const geminiConfigured = isGeminiApiKeyConfigured();
      res.json({
        status: 'ok',
        ffmpegAvailable: ffmpegInfo.ffmpegAvailable,
        ffprobeAvailable: ffmpegInfo.ffprobeAvailable,
        ffmpegVersion: ffmpegInfo.ffmpegVersion,
        fasterWhisperInstalled: whisperInstalled,
        geminiApiKeyConfigured: geminiConfigured,
        postgresConfigured: Boolean(process.env.SQL_HOST && process.env.SQL_DB_NAME),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Status check failed' });
    }
  });

  // 2. Fetch Complete Workspace State from PostgreSQL
  app.get('/api/workspace', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid || 'clipmatrix-personal-owner';
      const email = req.user?.email || 'owner@clipmatrix.studio';
      await getOrCreateUser(uid, email);

      const allVideos = await getAllVideos();
      const allClips = await getAllGeneratedClips();
      const allHighlights = await getAllHighlights();

      const enrichedVideos = await Promise.all(
        allVideos.map(async (v) => {
          const transcript = await getTranscriptByVideoId(v.id);
          const jobs = await getJobsByVideoId(v.id);
          const videoHighlights = allHighlights.filter((h) => h.videoId === v.id);
          const videoClips = allClips.filter((c) => c.videoId === v.id);
          return {
            ...v,
            transcript: transcript
              ? {
                  ...transcript,
                  segments: JSON.parse(transcript.segmentsJson || '[]'),
                }
              : null,
            highlights: videoHighlights,
            clips: videoClips,
            jobs,
          };
        })
      );

      res.json({
        videos: enrichedVideos,
        clips: allClips,
        highlights: allHighlights,
      });
    } catch (error: any) {
      console.error('Failed to load workspace state:', error);
      res.status(500).json({
        error: error.message || 'Failed to load workspace data from PostgreSQL.',
      });
    }
  });

  // 3. Real Video File Upload Route (PC & Mobile)
  app.post(
    '/api/videos/upload',
    requireAuth,
    (req, res, next) => {
      upload.single('video')(req, res, (err: any) => {
        if (err) {
          return res.status(400).json({
            error: err.message || 'Video upload validation failed.',
          });
        }
        next();
      });
    },
    async (req: AuthRequest, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            error: 'No video file received. Please select a valid video file.',
          });
        }

        const uid = req.user?.uid || 'clipmatrix-personal-owner';
        const email = req.user?.email || 'owner@clipmatrix.studio';
        await getOrCreateUser(uid, email);

        const uploadedPath = req.file.path;
        const metadata = await extractVideoMetadata(uploadedPath);
        const customTitle = String(req.body?.title || '').trim();
        const videoTitle =
          customTitle ||
          path.basename(req.file.originalname, path.extname(req.file.originalname));

        const savedVideo = await insertVideoRecord({
          userUid: uid,
          title: videoTitle,
          originalFilename: req.file.originalname,
          storedFilename: req.file.filename,
          videoUrl: `/storage/videos/${req.file.filename}`,
          audioUrl: null,
          fileSizeBytes: metadata.fileSizeBytes,
          mimeType: req.file.mimetype || 'video/mp4',
          durationSeconds: metadata.durationSeconds,
          width: metadata.width,
          height: metadata.height,
          fps: metadata.fps,
          videoCodec: metadata.videoCodec,
          audioCodec: metadata.audioCodec,
          status: 'uploaded',
          errorMessage: null,
        });

        await createProcessingJobRecord({
          videoId: savedVideo.id,
          jobType: 'upload_probe',
          status: 'completed',
          progressPercent: 100,
          currentStep: `Uploaded & verified via FFprobe (${metadata.width}x${metadata.height}, ${metadata.durationSeconds}s)`,
          errorMessage: null,
          resultMetaJson: JSON.stringify(metadata),
        });

        res.status(201).json({ video: savedVideo, metadata });
      } catch (error: any) {
        console.error('Upload error:', error);
        res.status(500).json({
          error: error.message || 'Failed to process uploaded video with FFprobe.',
        });
      }
    }
  );

  // 3b. Synthesize a Real Playable Test Video via FFmpeg (for instant testing without local file)
  app.post(
    '/api/videos/create-test-video',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const uid = req.user?.uid || 'clipmatrix-personal-owner';
        const email = req.user?.email || 'owner@clipmatrix.studio';
        await getOrCreateUser(uid, email);

        const durationSec = Math.min(
          120,
          Math.max(15, Number(req.body?.durationSeconds) || 60)
        );
        const title =
          String(req.body?.title || '').trim() ||
          `Studio Broadcast Test Reel (${durationSec}s)`;
        const filename = `${Date.now()}_studio_test_${durationSec}s.mp4`;

        const filePath = await synthesizeRealTestVideo(filename, durationSec);
        const metadata = await extractVideoMetadata(filePath);

        const savedVideo = await insertVideoRecord({
          userUid: uid,
          title,
          originalFilename: filename,
          storedFilename: filename,
          videoUrl: `/storage/videos/${filename}`,
          audioUrl: null,
          fileSizeBytes: metadata.fileSizeBytes,
          mimeType: 'video/mp4',
          durationSeconds: metadata.durationSeconds,
          width: metadata.width,
          height: metadata.height,
          fps: metadata.fps,
          videoCodec: metadata.videoCodec,
          audioCodec: metadata.audioCodec,
          status: 'uploaded',
          errorMessage: null,
        });

        await createProcessingJobRecord({
          videoId: savedVideo.id,
          jobType: 'upload_probe',
          status: 'completed',
          progressPercent: 100,
          currentStep: `Generated real MP4 test stream via FFmpeg (${metadata.width}x${metadata.height}, ${metadata.durationSeconds}s)`,
          errorMessage: null,
          resultMetaJson: JSON.stringify(metadata),
        });

        res.status(201).json({ video: savedVideo, metadata });
      } catch (error: any) {
        console.error('Failed to synthesize test video:', error);
        res.status(500).json({
          error: error.message || 'Failed to synthesize test video with FFmpeg.',
        });
      }
    }
  );

  // 4. Audio Extraction (FFmpeg) + Transcription (faster-whisper / Gemini Audio / Acoustic Fallback)
  app.post(
    '/api/videos/:id/transcribe',
    requireAuth,
    async (req: AuthRequest, res) => {
      const videoId = Number(req.params.id);
      if (!videoId) {
        return res.status(400).json({ error: 'Invalid video ID.' });
      }

      try {
        const video = await getVideoById(videoId);
        if (!video) {
          return res.status(404).json({ error: 'Video not found in PostgreSQL.' });
        }

        const modelSize = (req.body?.modelSize || 'base') as
          | 'tiny'
          | 'base'
          | 'small'
          | 'medium'
          | 'large-v3';
        const language = String(req.body?.language || 'en');

        const job = await createProcessingJobRecord({
          videoId: video.id,
          jobType: 'transcription',
          status: 'running',
          progressPercent: 20,
          currentStep: 'Extracting 16kHz mono WAV audio via FFmpeg...',
          errorMessage: null,
          resultMetaJson: null,
        });

        await updateVideoRecord(video.id, { status: 'transcribing' });

        const sourceVideoPath = path.join(VIDEOS_DIR, video.storedFilename);
        const wavFilename = `audio_${video.id}_${Date.now()}.wav`;
        const wavPath = await extractAudioToWav(sourceVideoPath, wavFilename);

        await updateProcessingJobRecord(job.id, {
          progressPercent: 55,
          currentStep: `Transcribing extracted WAV audio (requested model: ${modelSize})...`,
        });

        const transcription = await transcribeAudioFile({
          audioWavPath: wavPath,
          videoTitle: video.title,
          durationSeconds: video.durationSeconds,
          modelSize,
          language,
        });

        const savedTranscript = await insertTranscriptRecord({
          videoId: video.id,
          engineUsed: transcription.engineUsed,
          modelSize: transcription.modelSize,
          language: transcription.language,
          fullText: transcription.fullText,
          segmentsJson: JSON.stringify(transcription.segments),
        });

        await updateVideoRecord(video.id, {
          audioUrl: `/storage/audio/${wavFilename}`,
          status: 'transcribed',
          errorMessage: null,
        });

        await updateProcessingJobRecord(job.id, {
          status: 'completed',
          progressPercent: 100,
          currentStep: `Transcription complete via ${transcription.engineUsed} (${transcription.segments.length} timestamped segments)`,
          resultMetaJson: JSON.stringify({
            engineUsed: transcription.engineUsed,
            fasterWhisperInstalled: transcription.fasterWhisperInstalled,
            segmentsCount: transcription.segments.length,
            notice: transcription.notice,
          }),
        });

        res.json({
          transcript: {
            ...savedTranscript,
            segments: transcription.segments,
          },
          fasterWhisperInstalled: transcription.fasterWhisperInstalled,
          notice: transcription.notice,
        });
      } catch (error: any) {
        console.error('Transcription error:', error);
        await updateVideoRecord(videoId, {
          status: 'error',
          errorMessage: error.message || 'Transcription failed',
        });
        res.status(500).json({
          error: error.message || 'Audio extraction or transcription failed.',
        });
      }
    }
  );

  // 5. Gemini AI Highlight Detection Route
  app.post(
    '/api/videos/:id/highlights',
    requireAuth,
    async (req: AuthRequest, res) => {
      const videoId = Number(req.params.id);
      if (!videoId) {
        return res.status(400).json({ error: 'Invalid video ID.' });
      }

      try {
        const video = await getVideoById(videoId);
        if (!video) {
          return res.status(404).json({ error: 'Video not found.' });
        }

        const transcript = await getTranscriptByVideoId(video.id);
        if (!transcript) {
          return res.status(400).json({
            error:
              'Transcript not found for this video. Please run Step 2 (Audio Extraction & Transcription) first.',
          });
        }

        const segments: TranscriptSegmentItem[] = JSON.parse(
          transcript.segmentsJson || '[]'
        );

        const job = await createProcessingJobRecord({
          videoId: video.id,
          jobType: 'gemini_highlights',
          status: 'running',
          progressPercent: 40,
          currentStep: 'Analyzing timestamped transcript with Gemini AI...',
          errorMessage: null,
          resultMetaJson: null,
        });

        const detectedHighlights = await analyzeTranscriptWithGemini({
          videoTitle: video.title,
          durationSeconds: video.durationSeconds,
          segments,
        });

        const savedHighlights = await replaceVideoHighlights(
          video.id,
          detectedHighlights.map((h) => ({
            videoId: video.id,
            transcriptId: transcript.id,
            title: h.title,
            reason: h.reason,
            category: h.category,
            startSeconds: h.startSeconds,
            endSeconds: h.endSeconds,
            startTimecode: h.startTimecode,
            endTimecode: h.endTimecode,
            score: h.score,
          }))
        );

        await updateVideoRecord(video.id, { status: 'highlights_ready' });
        await updateProcessingJobRecord(job.id, {
          status: 'completed',
          progressPercent: 100,
          currentStep: `Gemini AI identified ${savedHighlights.length} high-engagement highlights.`,
          resultMetaJson: JSON.stringify({ count: savedHighlights.length }),
        });

        res.json({ highlights: savedHighlights });
      } catch (error: any) {
        console.error('Gemini highlight analysis error:', error);
        res.status(400).json({
          error:
            error.message ||
            'Gemini AI highlight detection failed. Verify GEMINI_API_KEY or use Manual Clip Selection.',
        });
      }
    }
  );

  // 6. Real FFmpeg Clip & Thumbnail Generation (from AI Highlights or Manual Timestamps)
  app.post(
    '/api/videos/:id/generate-clips',
    requireAuth,
    async (req: AuthRequest, res) => {
      const videoId = Number(req.params.id);
      if (!videoId) {
        return res.status(400).json({ error: 'Invalid video ID.' });
      }

      try {
        const video = await getVideoById(videoId);
        if (!video) {
          return res.status(404).json({ error: 'Video not found.' });
        }

        const sourceVideoPath = path.join(VIDEOS_DIR, video.storedFilename);
        if (!fs.existsSync(sourceVideoPath)) {
          return res.status(404).json({
            error: 'Source video file is missing on disk. Please re-upload.',
          });
        }

        const aspectRatio: '9:16' | '16:9' | '1:1' =
          req.body?.aspectRatio === '16:9' || req.body?.aspectRatio === '1:1'
            ? req.body.aspectRatio
            : '9:16';

        const targetDurationSeconds = Number(req.body?.targetDurationSeconds) || 0;
        const selectedHighlightIds: number[] = Array.isArray(
          req.body?.highlightIds
        )
          ? req.body.highlightIds.map(Number)
          : [];

        const manualSegments: Array<{
          title?: string;
          startTime: string | number;
          endTime?: string | number;
          score?: number;
        }> = Array.isArray(req.body?.manualSegments)
          ? req.body.manualSegments
          : [];

        const segmentsToRender: Array<{
          highlightId: number | null;
          title: string;
          startSeconds: number;
          endSeconds: number;
          score: number;
        }> = [];

        if (selectedHighlightIds.length > 0) {
          const dbHighlights = await getHighlightsByVideoId(video.id);
          for (const h of dbHighlights) {
            if (selectedHighlightIds.includes(h.id)) {
              const start = Math.max(0, h.startSeconds);
              const end =
                targetDurationSeconds > 0
                  ? Math.min(video.durationSeconds, start + targetDurationSeconds)
                  : Math.min(video.durationSeconds, h.endSeconds);
              segmentsToRender.push({
                highlightId: h.id,
                title: h.title,
                startSeconds: start,
                endSeconds: Math.max(start + 1, end),
                score: h.score,
              });
            }
          }
        }

        for (const manual of manualSegments) {
          const start = parseTimecodeToSeconds(manual.startTime);
          let end =
            manual.endTime !== undefined && String(manual.endTime).trim() !== ''
              ? parseTimecodeToSeconds(manual.endTime)
              : start + (targetDurationSeconds || 30);

          if (targetDurationSeconds > 0 && !manual.endTime) {
            end = start + targetDurationSeconds;
          }

          const clampedStart = Math.max(
            0,
            Math.min(start, Math.max(0, video.durationSeconds - 1))
          );
          const clampedEnd = Math.min(
            video.durationSeconds,
            Math.max(clampedStart + 1, end)
          );

          segmentsToRender.push({
            highlightId: null,
            title:
              manual.title?.trim() ||
              `${video.title} (${formatSecondsToTimecode(clampedStart)}–${formatSecondsToTimecode(clampedEnd)})`,
            startSeconds: clampedStart,
            endSeconds: clampedEnd,
            score: manual.score || 88,
          });
        }

        if (segmentsToRender.length === 0) {
          return res.status(400).json({
            error:
              'Please select at least one AI highlight or provide valid manual start/end timestamps.',
          });
        }

        const job = await createProcessingJobRecord({
          videoId: video.id,
          jobType: 'ffmpeg_clip_render',
          status: 'running',
          progressPercent: 25,
          currentStep: `Rendering ${segmentsToRender.length} clip(s) in ${aspectRatio} via FFmpeg...`,
          errorMessage: null,
          resultMetaJson: null,
        });

        const createdClips = [];

        for (let i = 0; i < segmentsToRender.length; i++) {
          const seg = segmentsToRender[i];
          const ts = Date.now() + i;
          const clipFilename = `clip_v${video.id}_${ts}_${aspectRatio.replace(':', 'x')}.mp4`;
          const thumbFilename = `thumb_v${video.id}_${ts}.jpg`;

          const renderResult = await generateVideoClipWithFfmpeg({
            sourceVideoPath,
            outputClipFilename: clipFilename,
            outputThumbnailFilename: thumbFilename,
            startSeconds: seg.startSeconds,
            endSeconds: seg.endSeconds,
            aspectRatio,
          });

          const startTc = formatSecondsToTimecode(seg.startSeconds);
          const endTc = formatSecondsToTimecode(seg.endSeconds);

          const savedClip = await insertGeneratedClipRecord({
            videoId: video.id,
            highlightId: seg.highlightId,
            title: seg.title,
            aspectRatio,
            durationSeconds: renderResult.durationSeconds,
            startSeconds: seg.startSeconds,
            endSeconds: seg.endSeconds,
            startTimecode: startTc,
            endTimecode: endTc,
            clipUrl: `/storage/clips/${clipFilename}`,
            thumbnailUrl: `/storage/thumbnails/${thumbFilename}`,
            fileSizeBytes: renderResult.fileSizeBytes,
            viralityScore: seg.score,
            approvalStatus: 'pending_approval',
            captionText: `${seg.title} (${startTc}–${endTc}) #ClipMatrix #Shorts`,
            captionLanguage: 'english',
          });

          createdClips.push(savedClip);
        }

        await updateVideoRecord(video.id, { status: 'completed' });
        await updateProcessingJobRecord(job.id, {
          status: 'completed',
          progressPercent: 100,
          currentStep: `Generated ${createdClips.length} MP4 clip(s) and thumbnails with FFmpeg.`,
          resultMetaJson: JSON.stringify({
            clipsGenerated: createdClips.length,
            aspectRatio,
          }),
        });

        res.status(201).json({ clips: createdClips });
      } catch (error: any) {
        console.error('FFmpeg clip generation error:', error);
        res.status(500).json({
          error: error.message || 'FFmpeg clip generation failed.',
        });
      }
    }
  );

  // 7. Update Generated Clip Approval / Caption in PostgreSQL
  app.patch('/api/clips/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const clipId = Number(req.params.id);
      if (!clipId) {
        return res.status(400).json({ error: 'Invalid clip ID.' });
      }

      const updates: Record<string, any> = {};
      if (req.body?.approvalStatus) {
        updates.approvalStatus = String(req.body.approvalStatus);
      }
      if (req.body?.captionText !== undefined) {
        updates.captionText = String(req.body.captionText);
      }
      if (req.body?.captionLanguage) {
        updates.captionLanguage = String(req.body.captionLanguage);
      }

      const updated = await updateGeneratedClipApproval(clipId, updates);
      if (!updated) {
        return res.status(404).json({ error: 'Clip not found.' });
      }
      res.json({ clip: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update clip.' });
    }
  });

  // 8. Download Generated MP4 Clip File
  app.get('/api/clips/:id/download', async (req, res) => {
    try {
      const clipId = Number(req.params.id);
      const allClips = await getAllGeneratedClips();
      const found = allClips.find((c) => c.id === clipId);
      if (!found) {
        return res.status(404).json({ error: 'Clip not found in database.' });
      }

      const filename = path.basename(found.clipUrl);
      const fullPath = path.join(CLIPS_DIR, filename);
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'Clip MP4 file not found on disk.' });
      }

      res.download(fullPath, filename);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to download clip.' });
    }
  });

  // Mount Vite middleware in development or static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ClipMatrix Phase 2 Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
