import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Sparkles,
  Clock,
  AlertCircle,
  CheckCircle2,
  Film,
  FileAudio,
  Scissors,
  Play,
  Download,
  RefreshCw,
  Plus,
  Trash2,
  Activity,
} from 'lucide-react';
import {
  AspectRatioPreset,
  BackendClipRecord,
  BackendHighlightRecord,
  BackendTranscriptRecord,
  BackendVideoRecord,
  ClipDurationPreset,
  GeneratedClip,
  NavigationPageId,
  VideoProject,
} from '../types/clipmatrix';

interface ManualClipDraft {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
}

interface SystemQuickStatus {
  ffmpegAvailable: boolean;
  ffprobeAvailable: boolean;
  fasterWhisperInstalled: boolean;
  geminiApiKeyConfigured: boolean;
  postgresConfigured: boolean;
  redisAvailable: boolean;
}

interface LongVideoToClipsPageProps {
  projects: VideoProject[];
  backendVideos: BackendVideoRecord[];
  onRefreshWorkspace: () => Promise<void>;
  onCreateProjectAndClips: (params: {
    project: VideoProject;
    generatedClips: GeneratedClip[];
  }) => void;
  onNavigate: (page: NavigationPageId) => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatSeconds(sec: number): string {
  const safe = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const LongVideoToClipsPage: React.FC<LongVideoToClipsPageProps> = ({
  projects,
  backendVideos,
  onRefreshWorkspace,
  onNavigate,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  const [systemStatus, setSystemStatus] = useState<SystemQuickStatus | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(
    backendVideos[0]?.id ?? null
  );
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSynthesizingTest, setIsSynthesizingTest] = useState(false);

  // Step 2: Transcription state
  const [whisperModelSize, setWhisperModelSize] = useState<
    'tiny' | 'base' | 'small' | 'medium' | 'large-v3'
  >('tiny');
  const [transcribeLanguage, setTranscribeLanguage] = useState('en');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionNotice, setTranscriptionNotice] = useState('');

  // Step 3: Gemini Highlight state
  const [isDetectingHighlights, setIsDetectingHighlights] = useState(false);
  const [selectedHighlightIds, setSelectedHighlightIds] = useState<number[]>([]);

  // Step 4: Clip generation state
  const [durationPreset, setDurationPreset] = useState<
    ClipDurationPreset | 'exact'
  >('exact');
  const [customDuration, setCustomDuration] = useState<number>(30);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioPreset>('9:16');
  const [manualStartTime, setManualStartTime] = useState('00:02');
  const [manualEndTime, setManualEndTime] = useState('00:14');
  const [manualClipTitle, setManualClipTitle] = useState('');
  const [manualQueue, setManualQueue] = useState<ManualClipDraft[]>([]);
  const [isRenderingClips, setIsRenderingClips] = useState(false);
  const [latestRenderedClips, setLatestRenderedClips] = useState<
    BackendClipRecord[]
  >([]);

  const [errorMessage, setErrorMessage] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  useEffect(() => {
    fetch('/api/system/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSystemStatus(data);
      })
      .catch(() => {});
  }, []);

  // Sync selected video ID when backendVideos load
  useEffect(() => {
    if (selectedVideoId === null && backendVideos.length > 0) {
      setSelectedVideoId(backendVideos[0].id);
    }
  }, [backendVideos, selectedVideoId]);

  const activeVideo: BackendVideoRecord | null =
    backendVideos.find((v) => v.id === selectedVideoId) ||
    backendVideos[0] ||
    null;

  const activeTranscript: BackendTranscriptRecord | null =
    activeVideo?.transcript || null;
  const activeHighlights: BackendHighlightRecord[] =
    activeVideo?.highlights || [];

  // Automatically select newly detected highlights if none selected yet
  useEffect(() => {
    if (activeHighlights.length > 0 && selectedHighlightIds.length === 0) {
      setSelectedHighlightIds(activeHighlights.slice(0, 2).map((h) => h.id));
    }
  }, [activeVideo?.id, activeHighlights.length]);

  const seekVideoTo = (seconds: number) => {
    if (videoPreviewRef.current) {
      videoPreviewRef.current.currentTime = Math.max(0, seconds);
      videoPreviewRef.current.play().catch(() => {});
    }
  };

  // Step 1A: Upload real video file from PC or mobile with XMLHttpRequest progress
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage('');
    setSuccessBanner('');
    setUploadProgress(1);

    const formData = new FormData();
    formData.append('video', file);
    if (uploadTitle.trim()) {
      formData.append('title', uploadTitle.trim());
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/videos/upload', true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const pct = Math.min(99, Math.round((event.loaded / event.total) * 100));
        setUploadProgress(pct);
      }
    };

    xhr.onload = async () => {
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      try {
        const data = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300 && data.video) {
          await onRefreshWorkspace();
          setSelectedVideoId(data.video.id);
          setUploadTitle('');
          setSuccessBanner(
            `Uploaded "${data.video.title}" (${data.video.width}x${data.video.height}, ${data.video.durationSeconds}s, ${formatBytes(data.video.fileSizeBytes)}) and verified via FFprobe.`
          );
        } else {
          setErrorMessage(
            data.error || `Upload failed with status ${xhr.status}.`
          );
        }
      } catch {
        setErrorMessage('Failed to parse server response after video upload.');
      }
    };

    xhr.onerror = () => {
      setUploadProgress(null);
      setErrorMessage('Network error while uploading video file.');
    };

    xhr.send(formData);
  };

  // Step 1B: Generate a real playable MP4 video with spoken English voiceover via FFmpeg
  const handleSynthesizeRealTestVideo = async () => {
    setErrorMessage('');
    setSuccessBanner('');
    setIsSynthesizingTest(true);
    try {
      const response = await fetch('/api/videos/create-test-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:
            uploadTitle.trim() ||
            'Creator Retention & AI Video Engineering Masterclass',
          durationSeconds: 36,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to synthesize spoken test video.');
      }
      await onRefreshWorkspace();
      setSelectedVideoId(data.video.id);
      setUploadTitle('');
      setSuccessBanner(
        `Generated real spoken-English MP4 video "${data.video.title}" via FFmpeg (${data.video.width}x${data.video.height}, ${data.video.durationSeconds}s, ${formatBytes(data.video.fileSizeBytes)}).`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create spoken test video.');
    } finally {
      setIsSynthesizingTest(false);
    }
  };

  // Step 2: Extract Audio with FFmpeg & Transcribe with faster-whisper
  const handleRunTranscription = async () => {
    if (!activeVideo) {
      setErrorMessage('Please upload or select a video in Step 1 first.');
      return;
    }
    setErrorMessage('');
    setSuccessBanner('');
    setIsTranscribing(true);
    try {
      const response = await fetch(
        `/api/videos/${activeVideo.id}/transcribe`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelSize: whisperModelSize,
            language: transcribeLanguage,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Whisper transcription failed.');
      }
      if (data.notice) {
        setTranscriptionNotice(data.notice);
      }
      await onRefreshWorkspace();
      setSuccessBanner(
        `Audio extracted via FFmpeg and transcribed locally with faster-whisper (${data.transcript?.segments?.length || 0} timestamped speech segments).`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Audio extraction & Whisper transcription failed.');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Step 3: Run Gemini AI Highlight Detection on the Whisper transcript
  const handleDetectHighlights = async () => {
    if (!activeVideo) {
      setErrorMessage('Please upload or select a video first.');
      return;
    }
    if (!activeTranscript) {
      setErrorMessage(
        'Please complete Step 2 (faster-whisper Speech Transcription) before running Gemini AI highlight analysis.'
      );
      return;
    }
    setErrorMessage('');
    setSuccessBanner('');
    setIsDetectingHighlights(true);
    try {
      const response = await fetch(
        `/api/videos/${activeVideo.id}/highlights`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gemini highlight detection failed.');
      }
      await onRefreshWorkspace();
      const ids = (data.highlights || []).map((h: any) => h.id);
      setSelectedHighlightIds(ids);
      setSuccessBanner(
        `Gemini AI analyzed the Whisper transcript and detected ${ids.length} viral highlights.`
      );
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Gemini AI highlight analysis encountered an error.'
      );
    } finally {
      setIsDetectingHighlights(false);
    }
  };

  const toggleHighlightSelection = (id: number) => {
    setSelectedHighlightIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAddManualSegmentToQueue = () => {
    if (!manualStartTime.trim() || !manualEndTime.trim()) {
      setErrorMessage('Please enter both Start and End timestamps (MM:SS).');
      return;
    }
    setErrorMessage('');
    const newDraft: ManualClipDraft = {
      id: `man-${Date.now()}`,
      title:
        manualClipTitle.trim() ||
        `${activeVideo?.title || 'Clip'} (${manualStartTime}–${manualEndTime})`,
      startTime: manualStartTime.trim(),
      endTime: manualEndTime.trim(),
    };
    setManualQueue((prev) => [...prev, newDraft]);
    setManualClipTitle('');
  };

  const handleRemoveManualDraft = (id: string) => {
    setManualQueue((prev) => prev.filter((item) => item.id !== id));
  };

  // Step 4: Render real MP4 clips & thumbnails with FFmpeg
  const handleRenderRealClips = async (mode: 'selected' | 'manual_direct') => {
    if (!activeVideo) {
      setErrorMessage('Please upload or select a video first.');
      return;
    }
    setErrorMessage('');
    setSuccessBanner('');

    const targetDurationSeconds =
      durationPreset === 'exact'
        ? 0
        : durationPreset === 'custom'
        ? Number(customDuration)
        : Number(durationPreset);

    const manualSegmentsToSubmit =
      mode === 'manual_direct'
        ? [
            {
              title:
                manualClipTitle.trim() ||
                `${activeVideo.title} (${manualStartTime}–${manualEndTime})`,
              startTime: manualStartTime.trim(),
              endTime: manualEndTime.trim(),
              score: 90,
            },
          ]
        : manualQueue.map((m) => ({
            title: m.title,
            startTime: m.startTime,
            endTime: m.endTime,
            score: 89,
          }));

    const highlightIdsToSubmit =
      mode === 'manual_direct' ? [] : selectedHighlightIds;

    if (
      highlightIdsToSubmit.length === 0 &&
      manualSegmentsToSubmit.length === 0
    ) {
      setErrorMessage(
        'Select at least one AI highlight or add a manual timestamp range to generate clips.'
      );
      return;
    }

    setIsRenderingClips(true);
    try {
      const response = await fetch(
        `/api/videos/${activeVideo.id}/generate-clips`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            highlightIds: highlightIdsToSubmit,
            manualSegments: manualSegmentsToSubmit,
            aspectRatio,
            targetDurationSeconds,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'FFmpeg clip generation failed.');
      }

      setLatestRenderedClips(data.clips || []);
      if (mode !== 'manual_direct') {
        setManualQueue([]);
      }
      await onRefreshWorkspace();
      setSuccessBanner(
        `Rendered ${(data.clips || []).length} real MP4 video clip(s) and JPEG thumbnail(s) in ${aspectRatio} using FFmpeg.`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'FFmpeg clip rendering failed.');
    } finally {
      setIsRenderingClips(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#1C2030]">
        <div>
          <div className="text-xs text-purple-400 font-medium">
            Primary FastAPI Engine · FFprobe · Faster-Whisper · Gemini AI · FFmpeg
          </div>
          <h1 className="text-2xl font-display font-bold text-white">
            Long Video to Clips
          </h1>
          <p className="text-sm text-slate-400">
            Upload real video files from PC or mobile, transcribe spoken audio locally with faster-whisper, detect viral hooks with Gemini AI, and slice frame-accurate MP4 clips with FFmpeg.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start">
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#151928] hover:bg-[#1C2236] border border-[#262E45] text-xs font-medium text-slate-200 whitespace-nowrap"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>System Diagnostics</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('generated-clips')}
            className="px-3.5 py-2 rounded-lg bg-[#151928] hover:bg-[#1C2236] border border-[#262E45] text-xs font-medium text-white whitespace-nowrap"
          >
            Browse Generated Clips
          </button>
        </div>
      </div>

      {/* Compact Live Engine Verification Strip */}
      {systemStatus && (
        <div className="px-4 py-2.5 rounded-xl bg-[#10131E] border border-[#1E2436] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-slate-400">Runtime Status:</span>
            <span className={systemStatus.ffmpegAvailable ? 'text-emerald-400' : 'text-red-400'}>
              FFmpeg: {systemStatus.ffmpegAvailable ? 'READY' : 'OFFLINE'}
            </span>
            <span className={systemStatus.ffprobeAvailable ? 'text-emerald-400' : 'text-red-400'}>
              FFprobe: {systemStatus.ffprobeAvailable ? 'READY' : 'OFFLINE'}
            </span>
            <span className={systemStatus.fasterWhisperInstalled ? 'text-emerald-400' : 'text-red-400'}>
              faster-whisper: {systemStatus.fasterWhisperInstalled ? 'READY' : 'MISSING'}
            </span>
            <span className={systemStatus.geminiApiKeyConfigured ? 'text-emerald-400' : 'text-amber-400'}>
              Gemini API: {systemStatus.geminiApiKeyConfigured ? 'VERIFIED' : 'CHECK KEY'}
            </span>
            <span className={systemStatus.postgresConfigured ? 'text-emerald-400' : 'text-red-400'}>
              PostgreSQL: {systemStatus.postgresConfigured ? 'ONLINE' : 'OFFLINE'}
            </span>
            <span className={systemStatus.redisAvailable ? 'text-emerald-400' : 'text-slate-400'}>
              Queue: {systemStatus.redisAvailable ? 'REDIS' : 'SYNC FASTAPI'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="text-purple-400 hover:underline font-sans"
          >
            Inspect Full Diagnostics
          </button>
        </div>
      )}

      {/* Status & Error Banners */}
      {errorMessage && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </span>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="text-red-300 underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {successBanner && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-200"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successBanner}</span>
          </span>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('generated-clips')}
              className="underline font-medium text-white"
            >
              Open Generated Clips
            </button>
            <button
              type="button"
              onClick={() => onNavigate('upload-approval')}
              className="underline font-medium text-purple-300"
            >
              Go to Approval Queue
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 7 Columns: 4-Step Real Processing Pipeline */}
        <div className="xl:col-span-7 space-y-6">
          {/* STEP 1: Real Video Upload & FFprobe Verification */}
          <section className="rounded-xl bg-[#10131E] border border-[#1E2436] p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1C2235] pb-3">
              <div>
                <span className="text-[11px] font-mono uppercase text-purple-400">
                  Step 1 · Video Ingestion &amp; FFprobe Validation
                </span>
                <h2 className="text-base font-display font-semibold text-white">
                  Upload Video File (PC or Mobile)
                </h2>
              </div>
              {backendVideos.length > 0 && (
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="select-ingested-video"
                    className="text-xs text-slate-400"
                  >
                    Active Video:
                  </label>
                  <select
                    id="select-ingested-video"
                    value={activeVideo?.id || ''}
                    onChange={(e) => {
                      setSelectedVideoId(Number(e.target.value));
                      setSelectedHighlightIds([]);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs text-white font-mono"
                  >
                    {backendVideos.map((v) => (
                      <option key={v.id} value={v.id}>
                        #{v.id} · {v.title.slice(0, 32)} ({v.durationSeconds}s)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="video-upload-title"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Optional Project Title
                </label>
                <input
                  id="video-upload-title"
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Founder Podcast Episode 42"
                  className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex flex-col justify-end">
                <input
                  ref={fileInputRef}
                  id="real-video-file-input"
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/x-msvideo,video/*"
                  onChange={handleFileSelected}
                  className="hidden"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={uploadProgress !== null}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {uploadProgress !== null
                        ? `Uploading ${uploadProgress}%...`
                        : 'Select Video File'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={isSynthesizingTest || uploadProgress !== null}
                    onClick={handleSynthesizeRealTestVideo}
                    className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#161B2B] hover:bg-[#1E253A] border border-[#262F49] disabled:opacity-50 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
                    title="Synthesize a real MP4 video with spoken English voiceover using FFmpeg"
                  >
                    <Film className="w-3.5 h-3.5 text-purple-400" />
                    <span>
                      {isSynthesizingTest
                        ? 'Encoding Speech MP4...'
                        : 'Generate Spoken Test MP4'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {uploadProgress !== null && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono text-slate-300">
                  <span>Uploading video stream to FastAPI backend...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#0C0E17] overflow-hidden border border-[#22283B]">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* FFprobe Verified Metadata Strip */}
            {activeVideo ? (
              <div className="p-3.5 rounded-lg bg-[#0C0E17] border border-[#22283B] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white truncate">
                    {activeVideo.title}
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400 shrink-0">
                    Status: {activeVideo.status.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] font-mono text-slate-400">
                  <div>
                    <span className="text-slate-500 block">Resolution</span>
                    <span className="text-slate-200">
                      {activeVideo.width}×{activeVideo.height}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Duration</span>
                    <span className="text-slate-200">
                      {activeVideo.durationSeconds}s (
                      {formatSeconds(activeVideo.durationSeconds)})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Codecs</span>
                    <span className="text-slate-200">
                      {activeVideo.videoCodec} / {activeVideo.audioCodec}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Frame Rate</span>
                    <span className="text-slate-200">{activeVideo.fps} fps</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">File Size</span>
                    <span className="text-slate-200">
                      {formatBytes(activeVideo.fileSizeBytes)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs text-slate-400">
                No video uploaded yet. Upload an MP4/MOV/WebM file from your device or click{' '}
                <strong className="text-white">Generate Spoken Test MP4</strong> to synthesize a real playable video with spoken English narration.
              </div>
            )}
          </section>

          {/* STEP 2: Audio Extraction (FFmpeg) & Local faster-whisper Speech-to-Text */}
          <section className="rounded-xl bg-[#10131E] border border-[#1E2436] p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1C2235] pb-3">
              <div>
                <span className="text-[11px] font-mono uppercase text-blue-400">
                  Step 2 · FFmpeg Audio Extraction &amp; Local Faster-Whisper Speech-to-Text
                </span>
                <h2 className="text-base font-display font-semibold text-white">
                  Extract 16kHz WAV &amp; Transcribe Speech with faster-whisper
                </h2>
              </div>
              {activeTranscript && (
                <span className="text-[11px] font-mono text-emerald-400 shrink-0">
                  {activeTranscript.engineUsed} · {activeTranscript.segments.length} segments
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label
                  htmlFor="whisper-model-size"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Faster-Whisper Model Size
                </label>
                <select
                  id="whisper-model-size"
                  value={whisperModelSize}
                  onChange={(e) =>
                    setWhisperModelSize(e.target.value as any)
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs text-white font-mono"
                >
                  <option value="tiny">tiny (Fastest CPU)</option>
                  <option value="base">base (Balanced CPU/GPU)</option>
                  <option value="small">small (High Accuracy)</option>
                  <option value="medium">medium (Studio Grade)</option>
                  <option value="large-v3">large-v3 (Max Precision)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="whisper-language"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Spoken Language
                </label>
                <select
                  id="whisper-language"
                  value={transcribeLanguage}
                  onChange={(e) => setTranscribeLanguage(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs text-white"
                >
                  <option value="en">English (en)</option>
                  <option value="ur">Urdu (ur)</option>
                  <option value="hi">Hindi / Roman Urdu (hi)</option>
                  <option value="es">Spanish (es)</option>
                  <option value="ar">Arabic (ar)</option>
                </select>
              </div>

              <button
                type="button"
                disabled={!activeVideo || isTranscribing}
                onClick={handleRunTranscription}
                className="inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors"
              >
                <FileAudio className="w-3.5 h-3.5" />
                <span>
                  {isTranscribing
                    ? 'Running faster-whisper...'
                    : activeTranscript
                    ? 'Re-Transcribe with Whisper'
                    : 'Extract Audio & Transcribe'}
                </span>
              </button>
            </div>

            {transcriptionNotice && (
              <div className="p-3 rounded-lg bg-[#0C0E17] border border-[#22283B] text-[11px] text-emerald-300 font-mono">
                {transcriptionNotice}
              </div>
            )}

            {activeVideo?.audioUrl && (
              <div className="p-3 rounded-lg bg-[#0C0E17] border border-[#22283B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-300">
                  <span className="font-semibold text-white">
                    Extracted 16kHz Mono WAV Audio:
                  </span>{' '}
                  <span className="font-mono text-slate-400">
                    {activeVideo.audioUrl}
                  </span>
                </div>
                <audio
                  controls
                  src={activeVideo.audioUrl}
                  className="h-8 max-w-xs"
                />
              </div>
            )}

            {activeTranscript && activeTranscript.segments.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Faster-Whisper Speech Segments (click any segment to set manual clip timestamps &amp; seek video):
                  </span>
                  <span className="font-mono">
                    {activeTranscript.segments.length} segments
                  </span>
                </div>
                <div className="max-h-52 overflow-y-auto rounded-lg bg-[#0C0E17] border border-[#22283B] divide-y divide-[#1A1F30]">
                  {activeTranscript.segments.map((seg) => (
                    <button
                      key={seg.id}
                      type="button"
                      onClick={() => {
                        setManualStartTime(seg.startTimecode);
                        setManualEndTime(seg.endTimecode);
                        seekVideoTo(seg.startSeconds);
                      }}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-[#151A2A] transition-colors flex items-start gap-3 text-xs"
                    >
                      <span className="font-mono tabular-nums text-purple-400 shrink-0">
                        [{seg.startTimecode} – {seg.endTimecode}]
                      </span>
                      <span className="text-slate-200">{seg.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* STEP 3: Gemini AI Highlight Detection */}
          <section className="rounded-xl bg-[#10131E] border border-[#1E2436] p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1C2235] pb-3">
              <div>
                <span className="text-[11px] font-mono uppercase text-purple-400">
                  Step 3 · Official Google Gemini API Highlight Analysis
                </span>
                <h2 className="text-base font-display font-semibold text-white">
                  Detect Viral Moments, Hooks &amp; Scores (0–100)
                </h2>
              </div>

              <button
                type="button"
                disabled={!activeVideo || !activeTranscript || isDetectingHighlights}
                onClick={handleDetectHighlights}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors self-start"
              >
                {isDetectingHighlights ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>
                  {isDetectingHighlights
                    ? 'Analyzing with Gemini AI...'
                    : activeHighlights.length > 0
                    ? 'Re-Run Gemini Highlight Detection'
                    : 'Analyze Transcript with Gemini AI'}
                </span>
              </button>
            </div>

            {activeHighlights.length === 0 ? (
              <div className="p-4 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs text-slate-400">
                {activeTranscript
                  ? 'Click "Analyze Transcript with Gemini AI" to score hooks, emotional peaks, and educational insights from the faster-whisper transcript.'
                  : 'Complete Step 2 (faster-whisper Speech Transcription) first so Gemini AI can analyze the timestamped speech segments.'}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Select AI-detected highlights to slice with FFmpeg ({selectedHighlightIds.length} of {activeHighlights.length} selected):
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedHighlightIds(activeHighlights.map((h) => h.id))
                      }
                      className="text-purple-400 hover:underline"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedHighlightIds([])}
                      className="text-slate-400 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {activeHighlights.map((hl) => {
                    const checked = selectedHighlightIds.includes(hl.id);
                    return (
                      <div
                        key={hl.id}
                        className={`p-3.5 rounded-lg border transition-colors ${
                          checked
                            ? 'bg-purple-950/25 border-purple-500/50'
                            : 'bg-[#0C0E17] border-[#22283B]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleHighlightSelection(hl.id)}
                              className="mt-1 rounded border-slate-600 text-purple-600 focus:ring-purple-500"
                            />
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-semibold text-white">
                                  {hl.title}
                                </span>
                                <span className="text-[11px] font-mono text-purple-400 font-semibold">
                                  Score {hl.score}/100
                                </span>
                                <span className="text-[11px] font-mono text-blue-400 uppercase">
                                  · {hl.category}
                                </span>
                                <span className="text-[11px] font-mono text-slate-300">
                                  · {hl.startTimecode} – {hl.endTimecode}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400">
                                {hl.reason}
                              </p>
                            </div>
                          </label>

                          <button
                            type="button"
                            onClick={() => seekVideoTo(hl.startSeconds)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#161B2B] hover:bg-[#1E253A] border border-[#262F49] text-[11px] font-mono text-slate-200 shrink-0"
                          >
                            <Play className="w-3 h-3 text-purple-400" />
                            <span>Preview</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* STEP 4: Manual Clip Selection & Real FFmpeg Clip Generation */}
          <section className="rounded-xl bg-[#10131E] border border-[#1E2436] p-6 space-y-5">
            <div className="border-b border-[#1C2235] pb-3">
              <span className="text-[11px] font-mono uppercase text-emerald-400">
                Step 4 · Manual Timestamp Slicing &amp; Real FFmpeg Clip Generation
              </span>
              <h2 className="text-base font-display font-semibold text-white">
                Configure Aspect Ratio, Duration &amp; Render Real MP4 Clips
              </h2>
            </div>

            {/* Manual Timestamp Builder */}
            <div className="p-4 rounded-lg bg-[#0C0E17] border border-[#22283B] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span>Manual Timestamp Selection (Frame-Accurate FFmpeg Cut)</span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  Format: MM:SS or seconds
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                <div className="sm:col-span-5">
                  <label
                    htmlFor="manual-clip-title"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    Clip Title (Optional)
                  </label>
                  <input
                    id="manual-clip-title"
                    type="text"
                    value={manualClipTitle}
                    onChange={(e) => setManualClipTitle(e.target.value)}
                    placeholder="e.g. Key Architecture Breakdown"
                    className="w-full px-3 py-1.5 rounded-lg bg-[#10131E] border border-[#22283B] text-xs text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="manual-start"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    Start (MM:SS)
                  </label>
                  <input
                    id="manual-start"
                    type="text"
                    value={manualStartTime}
                    onChange={(e) => setManualStartTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#10131E] border border-[#22283B] text-xs font-mono tabular-nums text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="manual-end"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    End (MM:SS)
                  </label>
                  <input
                    id="manual-end"
                    type="text"
                    value={manualEndTime}
                    onChange={(e) => setManualEndTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#10131E] border border-[#22283B] text-xs font-mono tabular-nums text-white"
                  />
                </div>
                <div className="sm:col-span-3 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleAddManualSegmentToQueue}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg bg-[#161B2B] hover:bg-[#1E253A] border border-[#262F49] text-xs text-slate-200"
                  >
                    <Plus className="w-3.5 h-3.5 text-purple-400" />
                    <span>Queue Range</span>
                  </button>
                </div>
              </div>

              {manualQueue.length > 0 && (
                <div className="pt-2 space-y-1.5">
                  <div className="text-[11px] font-mono text-slate-400">
                    Queued Manual Clips ({manualQueue.length}):
                  </div>
                  {manualQueue.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-3 py-1.5 rounded bg-[#10131E] border border-[#1E2436] text-xs"
                    >
                      <span className="text-white truncate">
                        {item.title}{' '}
                        <span className="font-mono text-purple-400">
                          [{item.startTime} – {item.endTime}]
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveManualDraft(item.id)}
                        className="text-slate-400 hover:text-red-400"
                        aria-label="Remove queued manual range"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Duration & Aspect Ratio Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  Target Clip Duration Override
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'exact', label: 'Exact Timestamps' },
                      { id: 15, label: '15s' },
                      { id: 30, label: '30s' },
                      { id: 45, label: '45s' },
                      { id: 60, label: '60s' },
                      { id: 'custom', label: 'Custom' },
                    ] as const
                  ).map((preset) => (
                    <button
                      key={String(preset.id)}
                      type="button"
                      onClick={() => setDurationPreset(preset.id as any)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono tabular-nums border transition-colors ${
                        durationPreset === preset.id
                          ? 'bg-purple-600 text-white border-purple-500'
                          : 'bg-[#0C0E17] text-slate-300 border-[#22283B] hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {durationPreset === 'custom' && (
                  <div className="pt-1 flex items-center gap-2">
                    <input
                      id="custom-duration-sec"
                      type="number"
                      min={5}
                      max={180}
                      value={customDuration}
                      onChange={(e) =>
                        setCustomDuration(Number(e.target.value))
                      }
                      className="w-28 px-3 py-1.5 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs font-mono tabular-nums text-white"
                    />
                    <span className="text-xs text-slate-400">
                      seconds (5–180s)
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  Output Aspect Ratio (FFmpeg Scale &amp; Crop)
                </label>
                <div className="flex items-center gap-2">
                  {(['9:16', '16:9', '1:1'] as AspectRatioPreset[]).map(
                    (ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setAspectRatio(ratio)}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono tabular-nums border transition-colors ${
                          aspectRatio === ratio
                            ? 'bg-blue-600/25 border-blue-500 text-white font-semibold'
                            : 'bg-[#0C0E17] border-[#22283B] text-slate-400 hover:text-white'
                        }`}
                      >
                        {ratio}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Render Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={!activeVideo || isRenderingClips}
                onClick={() => handleRenderRealClips('selected')}
                className="py-3 px-4 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors flex items-center justify-center gap-2"
              >
                <Scissors className="w-4 h-4" />
                <span>
                  {isRenderingClips
                    ? 'Rendering MP4 Clips with FFmpeg...'
                    : `Render Selected Highlights & Queue (${
                        selectedHighlightIds.length + manualQueue.length
                      })`}
                </span>
              </button>

              <button
                type="button"
                disabled={!activeVideo || isRenderingClips}
                onClick={() => handleRenderRealClips('manual_direct')}
                className="py-3 px-4 rounded-lg bg-[#161B2B] hover:bg-[#1E253A] border border-[#262F49] disabled:opacity-50 text-xs font-semibold text-white transition-colors flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4 text-blue-400" />
                <span>
                  Slice Manual Timestamp ({manualStartTime}–{manualEndTime}) Now
                </span>
              </button>
            </div>
          </section>
        </div>

        {/* Right 5 Columns: Real HTML5 Video Player, Recently Rendered MP4s & Video Queue */}
        <div className="xl:col-span-5 space-y-6">
          {/* Live Source Video Player */}
          <div className="rounded-xl bg-[#10131E] border border-[#1E2436] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-display font-semibold text-white">
                Source Video Monitor &amp; Timestamp Seeker
              </h2>
              <span className="text-xs font-mono tabular-nums text-purple-400">
                Target: {aspectRatio}
              </span>
            </div>

            {activeVideo ? (
              <div className="space-y-2">
                <div className="rounded-lg overflow-hidden bg-black border border-[#22283B]">
                  <video
                    ref={videoPreviewRef}
                    key={activeVideo.videoUrl}
                    controls
                    preload="metadata"
                    src={activeVideo.videoUrl}
                    className="w-full max-h-[280px] object-contain bg-black"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>{activeVideo.originalFilename}</span>
                  <span>
                    {activeVideo.width}×{activeVideo.height} ·{' '}
                    {activeVideo.durationSeconds}s
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-lg bg-[#0C0E17] border border-[#22283B] text-center text-xs text-slate-400">
                Upload or synthesize a video in Step 1 to preview and scrub timestamps here.
              </div>
            )}
          </div>

          {/* Newly Rendered FFmpeg Clips Preview */}
          {(latestRenderedClips.length > 0 ||
            (activeVideo && activeVideo.clips && activeVideo.clips.length > 0)) && (
            <div className="rounded-xl bg-[#10131E] border border-[#1E2436] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-display font-semibold text-white">
                  Rendered FFmpeg MP4 Clips (
                  {
                    (latestRenderedClips.length > 0
                      ? latestRenderedClips
                      : activeVideo?.clips || []
                    ).length
                  }
                  )
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigate('generated-clips')}
                  className="text-xs text-purple-400 hover:underline"
                >
                  Open Library
                </button>
              </div>

              <div className="space-y-4">
                {(latestRenderedClips.length > 0
                  ? latestRenderedClips
                  : activeVideo?.clips || []
                )
                  .slice(0, 3)
                  .map((clip) => (
                    <div
                      key={clip.id}
                      className="p-3.5 rounded-lg bg-[#0C0E17] border border-[#22283B] space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-white truncate">
                          {clip.title}
                        </span>
                        <span className="font-mono text-purple-400 shrink-0">
                          {clip.aspectRatio} · {clip.durationSeconds}s
                        </span>
                      </div>

                      <video
                        controls
                        preload="metadata"
                        poster={clip.thumbnailUrl}
                        src={clip.clipUrl}
                        className="w-full max-h-56 rounded bg-black border border-[#1E2436]"
                      />

                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>
                          {clip.startTimecode}–{clip.endTimecode} ·{' '}
                          {formatBytes(clip.fileSizeBytes)}
                        </span>
                        <a
                          href={`/api/clips/${clip.id}/download`}
                          download
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-sans font-medium"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download MP4</span>
                        </a>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Video Queue */}
          <div className="rounded-xl bg-[#10131E] border border-[#1E2436] p-5 space-y-3">
            <h3 className="text-xs font-display font-semibold text-slate-300">
              Ingested Video Queue ({projects.length})
            </h3>
            <div className="divide-y divide-[#1A1F30]">
              {projects.slice(0, 6).map((p) => (
                <div
                  key={p.id}
                  className="py-2.5 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="truncate">
                    <div className="font-medium text-white truncate">
                      {p.title}
                    </div>
                    <div className="text-slate-500 font-mono">
                      {p.aspectRatio} · {p.durationFormatted} · {p.clipsCount}{' '}
                      clips
                    </div>
                  </div>
                  <span className="font-mono text-emerald-400 shrink-0">
                    {p.isRealVideo ? 'verified' : p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
