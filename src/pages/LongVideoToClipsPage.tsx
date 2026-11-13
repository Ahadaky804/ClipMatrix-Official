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
  Link2,
  Wand2,
  Check,
  Loader2,
  Subtitles,
  ScanFace,
  Maximize2,
} from 'lucide-react';
import {
  AspectRatioPreset,
  BackendClipRecord,
  BackendHighlightRecord,
  BackendTranscriptRecord,
  BackendVideoRecord,
  CaptionLanguage,
  ClipDurationPreset,
  GeneratedClip,
  NavigationPageId,
  NumberOfShortsOption,
  SubtitleStylePreset,
  VideoProject,
  VideoSourceType,
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
  geminiModel?: string;
}

interface UrlValidationResult {
  valid: boolean;
  accessible: boolean;
  sourceType: string;
  title: string;
  authorName?: string;
  thumbnailUrl?: string;
  directStreamPermitted: boolean;
  requiresOriginalUpload: boolean;
  message: string;
}

const SHORTS_PIPELINE_STAGES = [
  'Importing Video',
  'Analyzing Video',
  'Extracting Audio',
  'Transcribing Audio',
  'Detecting Highlights',
  'Generating Shorts',
  'Creating Subtitles',
  'Creating Thumbnails',
  'Saving Clips',
  'Completed',
] as const;

interface LongVideoToClipsPageProps {
  projects: VideoProject[];
  backendVideos: BackendVideoRecord[];
  onRefreshWorkspace: () => Promise<void>;
  onCreateProjectAndClips: (params: {
    project: VideoProject;
    generatedClips: GeneratedClip[];
  }) => void;
  onSelectClipForStudio?: (clipId: string) => void;
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
  backendVideos,
  onRefreshWorkspace,
  onSelectClipForStudio,
  onNavigate,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const clipVideoRefs = useRef<Record<number, HTMLVideoElement | null>>({});

  const [systemStatus, setSystemStatus] = useState<SystemQuickStatus | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(
    backendVideos[0]?.id ?? null
  );

  // Automatic Shorts Input Options
  const [inputSourceType, setInputSourceType] =
    useState<VideoSourceType>('youtube_url');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [isValidatingUrl, setIsValidatingUrl] = useState(false);
  const [urlValidation, setUrlValidation] =
    useState<UrlValidationResult | null>(null);

  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSynthesizingTest, setIsSynthesizingTest] = useState(false);

  // Automatic Shorts User Settings
  const [numShorts, setNumShorts] = useState<NumberOfShortsOption>(3);
  const [shortsDurationPreset, setShortsDurationPreset] =
    useState<ClipDurationPreset>(15);
  const [customDuration, setCustomDuration] = useState<number>(25);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioPreset>('9:16');
  const [subtitlesEnabled, setSubtitlesEnabled] = useState<boolean>(true);
  const [smartReframing, setSmartReframing] = useState<boolean>(true);
  const [faceTracking, setFaceTracking] = useState<boolean>(true);
  const [subtitleLanguage, setSubtitleLanguage] =
    useState<CaptionLanguage>('english');
  const [subtitleStyle, setSubtitleStyle] =
    useState<SubtitleStylePreset>('bold_hormozi');

  // Real-Time 10-Stage Automatic Shorts Progress State
  const [isGeneratingShorts, setIsGeneratingShorts] = useState(false);
  const [activePipelineStage, setActivePipelineStage] = useState<string | null>(
    null
  );
  const [pipelineProgressPct, setPipelineProgressPct] = useState<number>(0);
  const [regeneratingClipId, setRegeneratingClipId] = useState<number | null>(
    null
  );
  const [deletingClipId, setDeletingClipId] = useState<number | null>(null);

  // Step 2: Granular Transcription state
  const [whisperModelSize, setWhisperModelSize] = useState<
    'tiny' | 'base' | 'small' | 'medium' | 'large-v3'
  >('tiny');
  const [transcribeLanguage, setTranscribeLanguage] = useState('en');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionNotice, setTranscriptionNotice] = useState('');

  // Step 3: Granular Gemini Highlight state
  const [isDetectingHighlights, setIsDetectingHighlights] = useState(false);
  const [selectedHighlightIds, setSelectedHighlightIds] = useState<number[]>([]);

  // Step 4: Manual Clip generation state
  const [manualStartTime, setManualStartTime] = useState('00:02');
  const [manualEndTime, setManualEndTime] = useState('00:14');
  const [manualClipTitle, setManualClipTitle] = useState('');
  const [manualQueue, setManualQueue] = useState<ManualClipDraft[]>([]);
  const [isRenderingClips, setIsRenderingClips] = useState(false);

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
  const activeClips: BackendClipRecord[] = activeVideo?.clips || [];

  useEffect(() => {
    if (activeHighlights.length > 0 && selectedHighlightIds.length === 0) {
      setSelectedHighlightIds(activeHighlights.slice(0, 3).map((h) => h.id));
    }
  }, [activeVideo?.id, activeHighlights.length]);

  const seekVideoTo = (seconds: number) => {
    if (videoPreviewRef.current) {
      videoPreviewRef.current.currentTime = Math.max(0, seconds);
      videoPreviewRef.current.play().catch(() => {});
    }
  };

  // Validate YouTube or Google Drive URL via official backend endpoint
  const handleValidateVideoUrl = async () => {
    if (!videoUrlInput.trim()) {
      setErrorMessage('Please paste a YouTube or Google Drive video URL first.');
      return;
    }
    setErrorMessage('');
    setSuccessBanner('');
    setIsValidatingUrl(true);
    setUrlValidation(null);
    try {
      const res = await fetch('/api/videos/validate-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: inputSourceType,
          url: videoUrlInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Video URL validation failed.');
      }
      setUrlValidation(data);
      if (data.title && !uploadTitle.trim()) {
        setUploadTitle(data.title);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not validate video URL.');
    } finally {
      setIsValidatingUrl(false);
    }
  };

  // Upload real video file from PC or mobile with XMLHttpRequest progress
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
    formData.append('sourceType', inputSourceType);
    if (videoUrlInput.trim()) {
      formData.append('sourceUrl', videoUrlInput.trim());
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

  // Synthesize a real playable 45s MP4 video with spoken English voiceover via FFmpeg
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
            urlValidation?.title ||
            'Creator Retention & AI Video Engineering Masterclass',
          durationSeconds: 45,
          sourceType: inputSourceType,
          sourceUrl: videoUrlInput.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to synthesize spoken test video.');
      }
      await onRefreshWorkspace();
      setSelectedVideoId(data.video.id);
      setSuccessBanner(
        `Generated real spoken-English MP4 video "${data.video.title}" via FFmpeg (${data.video.width}x${data.video.height}, ${data.video.durationSeconds}s, ${formatBytes(data.video.fileSizeBytes)}).`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create spoken test video.');
    } finally {
      setIsSynthesizingTest(false);
    }
  };

  // Master Action: Generate Shorts (10-Stage Real AI Video Processing Pipeline)
  const handleGenerateAutomaticShorts = async () => {
    setErrorMessage('');
    setSuccessBanner('');

    if (
      (inputSourceType === 'youtube_url' || inputSourceType === 'google_drive') &&
      videoUrlInput.trim() &&
      !activeVideo
    ) {
      // Let backend validate URL first; if it requires local upload, backend will tell user clearly
    } else if (!activeVideo && !videoUrlInput.trim()) {
      setErrorMessage(
        'Please paste a YouTube/Google Drive URL, upload a video file from your device, or click "Generate Spoken Test MP4" first.'
      );
      return;
    }

    const targetDurationSeconds =
      shortsDurationPreset === 'custom'
        ? Number(customDuration)
        : Number(shortsDurationPreset);

    setIsGeneratingShorts(true);
    setActivePipelineStage('Importing Video');
    setPipelineProgressPct(8);

    try {
      const res = await fetch('/api/shorts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: inputSourceType,
          sourceUrl: videoUrlInput.trim() || undefined,
          videoId: activeVideo?.id,
          title: uploadTitle.trim() || urlValidation?.title || undefined,
          numShorts,
          targetDurationSeconds,
          aspectRatio,
          subtitlesEnabled,
          subtitleLanguage,
          subtitleStyle,
          smartReframing,
          faceTracking,
          whisperModelSize,
          asyncMode: true,
        }),
      });
      const startData = await res.json();
      if (!res.ok) {
        throw new Error(
          startData.error || 'Failed to start Automatic Shorts generation.'
        );
      }

      const jobId = startData.job?.id;
      if (!jobId) {
        throw new Error('No processing job ID returned from backend.');
      }

      // Poll /api/jobs/{jobId} for live stage progression
      let finished = false;
      while (!finished) {
        await new Promise((resolve) => setTimeout(resolve, 550));
        const pollRes = await fetch(`/api/jobs/${jobId}`);
        if (!pollRes.ok) break;
        const pollData = await pollRes.json();
        const job = pollData.job;
        if (!job) break;

        setActivePipelineStage(job.currentStep || 'Generating Shorts');
        setPipelineProgressPct(Number(job.progressPercent || 50));

        if (job.status === 'completed') {
          finished = true;
          setActivePipelineStage('Completed');
          setPipelineProgressPct(100);
          await onRefreshWorkspace();
          const generatedCount = (pollData.clips || []).length;
          setSuccessBanner(
            `Completed all 10 pipeline stages! Generated ${generatedCount} vertical ${aspectRatio} Short(s) with faster-whisper transcription, gemini-4-hydrogen highlight timestamps, ${subtitlesEnabled ? 'burned-in subtitles, ' : ''}and JPEG thumbnails.`
          );
        } else if (job.status === 'failed') {
          finished = true;
          throw new Error(
            job.errorMessage || 'Automatic Shorts pipeline failed.'
          );
        }
      }
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Automatic Shorts generation encountered an error.'
      );
    } finally {
      setIsGeneratingShorts(false);
    }
  };

  // Clip Dashboard Actions: Play Preview, Regenerate, Delete
  const handlePlayClipPreview = (clipId: number) => {
    const el = clipVideoRefs.current[clipId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.currentTime = 0;
      el.play().catch(() => {});
    }
  };

  const handleRegenerateClip = async (clip: BackendClipRecord) => {
    setErrorMessage('');
    setSuccessBanner('');
    setRegeneratingClipId(clip.id);
    try {
      const res = await fetch(`/api/clips/${clip.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aspectRatio,
          subtitlesEnabled,
          subtitleStyle,
          smartReframing,
          faceTracking,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to regenerate clip.');
      }
      await onRefreshWorkspace();
      setSuccessBanner(
        `Regenerated "${clip.title}" in ${aspectRatio} (${data.clip?.durationSeconds}s) via FFmpeg.`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to regenerate clip.');
    } finally {
      setRegeneratingClipId(null);
    }
  };

  const handleDeleteClip = async (clip: BackendClipRecord) => {
    setErrorMessage('');
    setSuccessBanner('');
    setDeletingClipId(clip.id);
    try {
      const res = await fetch(`/api/clips/${clip.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete clip.');
      }
      await onRefreshWorkspace();
      setSuccessBanner(`Deleted clip "${clip.title}" from PostgreSQL and storage.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete clip.');
    } finally {
      setDeletingClipId(null);
    }
  };

  // Step 2: Granular Extract Audio & Transcribe
  const handleRunTranscription = async () => {
    if (!activeVideo) {
      setErrorMessage('Please upload or select a video first.');
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

  // Step 3: Granular Gemini Highlight Detection
  const handleDetectHighlights = async () => {
    if (!activeVideo) {
      setErrorMessage('Please upload or select a video first.');
      return;
    }
    if (!activeTranscript) {
      setErrorMessage(
        'Please complete faster-whisper Speech Transcription before running Gemini AI highlight analysis.'
      );
      return;
    }
    setErrorMessage('');
    setSuccessBanner('');
    setIsDetectingHighlights(true);
    try {
      const targetDurationSeconds =
        shortsDurationPreset === 'custom'
          ? Number(customDuration)
          : Number(shortsDurationPreset);

      const response = await fetch(
        `/api/videos/${activeVideo.id}/highlights`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            numShorts,
            targetDurationSeconds,
            subtitleLanguage,
          }),
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
        `Gemini (gemini-4-hydrogen) analyzed the Whisper transcript and detected ${ids.length} viral highlights.`
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
      shortsDurationPreset === 'custom'
        ? Number(customDuration)
        : Number(shortsDurationPreset);

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
            targetDurationSeconds: mode === 'manual_direct' ? 0 : targetDurationSeconds,
            subtitlesEnabled,
            subtitleStyle,
            subtitleLanguage,
            smartReframing,
            faceTracking,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'FFmpeg clip generation failed.');
      }

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

  const currentStageIndex = activePipelineStage
    ? SHORTS_PIPELINE_STAGES.indexOf(activePipelineStage as any)
    : -1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#1C2030]">
        <div>
          <div className="text-xs text-purple-400 font-medium">
            Long Video to Automatic Shorts · FFprobe · Faster-Whisper · Gemini (gemini-4-hydrogen) · FFmpeg
          </div>
          <h1 className="text-2xl font-display font-bold text-white">
            Long Video to Clips &amp; Automatic Shorts
          </h1>
          <p className="text-sm text-slate-400">
            Paste a YouTube or Google Drive link, or upload a long video from PC or mobile to automatically generate vertical 9:16 Shorts with burned-in subtitles, AI captions, and thumbnails.
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
            Browse Generated Clips ({activeClips.length})
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
              Gemini ({systemStatus.geminiModel || 'gemini-4-hydrogen'}): {systemStatus.geminiApiKeyConfigured ? 'VERIFIED' : 'CHECK KEY'}
            </span>
            <span className={systemStatus.postgresConfigured ? 'text-emerald-400' : 'text-red-400'}>
              PostgreSQL: {systemStatus.postgresConfigured ? 'ONLINE' : 'OFFLINE'}
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
              Open Generated Clips Page
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

      {/* AUTOMATIC SHORTS STUDIO: Video Input Options + User Settings + Generate Shorts Button */}
      <section className="rounded-2xl bg-gradient-to-b from-[#131726] to-[#0E111C] border border-[#242B42] p-6 space-y-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1E2538] pb-4">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-purple-400">
              Automatic Long Video to Shorts Pipeline · Model: gemini-4-hydrogen
            </span>
            <h2 className="text-lg font-display font-bold text-white">
              1. Choose Video Input Source &amp; Configure Shorts Settings
            </h2>
          </div>

          {/* 3 Input Option Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'youtube_url', label: 'YouTube Video URL' },
                { id: 'google_drive', label: 'Google Drive Video URL' },
                { id: 'local_upload', label: 'Upload from PC or Mobile' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setInputSourceType(tab.id);
                  setUrlValidation(null);
                  setErrorMessage('');
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors border ${
                  inputSourceType === tab.id
                    ? 'bg-purple-600/25 border-purple-500 text-white'
                    : 'bg-[#0C0E17] border-[#22283B] text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Prominent URL / Upload Input Bar + Generate Shorts CTA */}
        <div className="space-y-4">
          {(inputSourceType === 'youtube_url' ||
            inputSourceType === 'google_drive') && (
            <div className="space-y-3">
              <label
                htmlFor="long-video-url-input"
                className="block text-xs font-medium text-slate-300"
              >
                {inputSourceType === 'youtube_url'
                  ? 'Paste YouTube Long Video URL (Validated via Official YouTube oEmbed API)'
                  : 'Paste Google Drive Shared Video URL'}
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="relative flex-1">
                  <Link2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    id="long-video-url-input"
                    type="url"
                    value={videoUrlInput}
                    onChange={(e) => setVideoUrlInput(e.target.value)}
                    placeholder={
                      inputSourceType === 'youtube_url'
                        ? 'https://www.youtube.com/watch?v=... or https://youtu.be/...'
                        : 'https://drive.google.com/file/d/.../view?usp=sharing'
                    }
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0A0C14] border border-[#262F47] text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
                <button
                  type="button"
                  disabled={isValidatingUrl}
                  onClick={handleValidateVideoUrl}
                  className="px-4 py-2.5 rounded-xl bg-[#171C2E] hover:bg-[#1F263D] border border-[#2B3554] text-xs font-semibold text-slate-200 whitespace-nowrap"
                >
                  {isValidatingUrl ? 'Checking Accessibility...' : 'Validate Link'}
                </button>
              </div>

              {urlValidation && (
                <div className="p-3.5 rounded-xl bg-[#0B0E17] border border-purple-500/40 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-white">
                      Verified: {urlValidation.title}
                      {urlValidation.authorName
                        ? ` · ${urlValidation.authorName}`
                        : ''}
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400">
                      URL ACCESSIBLE
                    </span>
                  </div>
                  <p className="text-slate-300">{urlValidation.message}</p>
                  {urlValidation.requiresOriginalUpload && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs"
                      >
                        Upload Original Video File from PC / Mobile
                      </button>
                      <button
                        type="button"
                        disabled={isSynthesizingTest}
                        onClick={handleSynthesizeRealTestVideo}
                        className="px-3 py-1.5 rounded-lg bg-[#161B2B] hover:bg-[#1F263E] border border-[#2B3450] text-slate-200 font-medium text-xs"
                      >
                        {isSynthesizingTest
                          ? 'Synthesizing Studio Video...'
                          : 'Attach Spoken Studio Masterclass Video'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* File Upload & Active Studio Video Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
            <div className="lg:col-span-4">
              <label
                htmlFor="video-upload-title"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Video / Project Title
              </label>
              <input
                id="video-upload-title"
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="e.g. Creator Retention & AI Engineering Podcast"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0C14] border border-[#262F47] text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="lg:col-span-4">
              <label
                htmlFor="select-ingested-video"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Active Source Video in Studio ({backendVideos.length} stored)
              </label>
              <select
                id="select-ingested-video"
                value={activeVideo?.id || ''}
                onChange={(e) => {
                  setSelectedVideoId(Number(e.target.value));
                  setSelectedHighlightIds([]);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0C14] border border-[#262F47] text-xs text-white font-mono"
              >
                {backendVideos.length === 0 ? (
                  <option value="">No video uploaded yet</option>
                ) : (
                  backendVideos.map((v) => (
                    <option key={v.id} value={v.id}>
                      #{v.id} · {v.title.slice(0, 34)} ({v.durationSeconds}s · {v.width}×{v.height})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="lg:col-span-4 flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                id="real-video-file-input"
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/x-msvideo,video/*"
                onChange={handleFileSelected}
                className="hidden"
              />
              <button
                type="button"
                disabled={uploadProgress !== null}
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl bg-[#171C2E] hover:bg-[#1F263D] border border-[#2B3554] text-xs font-semibold text-white transition-colors whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5 text-purple-400" />
                <span>
                  {uploadProgress !== null
                    ? `Uploading ${uploadProgress}%...`
                    : 'Upload PC / Mobile Video'}
                </span>
              </button>

              <button
                type="button"
                disabled={isSynthesizingTest || uploadProgress !== null}
                onClick={handleSynthesizeRealTestVideo}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl bg-[#171C2E] hover:bg-[#1F263D] border border-[#2B3554] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
                title="Synthesize a 45-second spoken-English MP4 video using FFmpeg libflite"
              >
                <Film className="w-3.5 h-3.5 text-blue-400" />
                <span>
                  {isSynthesizingTest
                    ? 'Encoding 45s MP4...'
                    : 'Generate Spoken Test MP4'}
                </span>
              </button>
            </div>
          </div>

          {uploadProgress !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono text-slate-300">
                <span>Uploading video stream to FastAPI backend...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#0A0C14] overflow-hidden border border-[#262F47]">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* User Settings Grid: Number of Shorts, Clip Duration, Aspect Ratio, Additional Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 pt-2 border-t border-[#1E2538]">
          {/* Setting 1: Number of Shorts */}
          <div className="p-3.5 rounded-xl bg-[#0A0C14] border border-[#1E2436] space-y-2">
            <label className="block text-xs font-semibold text-slate-200">
              Number of Shorts
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {([3, 5, 10, 'auto'] as const).map((opt) => (
                <button
                  key={String(opt)}
                  type="button"
                  onClick={() => setNumShorts(opt)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-mono font-semibold border transition-colors ${
                    numShorts === opt
                      ? 'bg-purple-600 border-purple-400 text-white'
                      : 'bg-[#121624] border-[#232A40] text-slate-400 hover:text-white'
                  }`}
                >
                  {opt === 'auto' ? 'Auto' : opt}
                </button>
              ))}
            </div>
          </div>

          {/* Setting 2: Clip Duration */}
          <div className="p-3.5 rounded-xl bg-[#0A0C14] border border-[#1E2436] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200">
                Clip Duration
              </label>
              {shortsDurationPreset === 'custom' && (
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={customDuration}
                  onChange={(e) => setCustomDuration(Number(e.target.value))}
                  aria-label="Custom clip duration in seconds"
                  className="w-16 px-2 py-0.5 rounded bg-[#121624] border border-purple-500 text-xs font-mono text-white text-right"
                />
              )}
            </div>
            <div className="grid grid-cols-5 gap-1">
              {([15, 30, 45, 60, 'custom'] as const).map((dur) => (
                <button
                  key={String(dur)}
                  type="button"
                  onClick={() => setShortsDurationPreset(dur)}
                  className={`py-1.5 px-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors ${
                    shortsDurationPreset === dur
                      ? 'bg-blue-600 border-blue-400 text-white'
                      : 'bg-[#121624] border-[#232A40] text-slate-400 hover:text-white'
                  }`}
                >
                  {dur === 'custom' ? 'Custom' : `${dur}s`}
                </button>
              ))}
            </div>
          </div>

          {/* Setting 3: Aspect Ratio */}
          <div className="p-3.5 rounded-xl bg-[#0A0C14] border border-[#1E2436] space-y-2">
            <label className="block text-xs font-semibold text-slate-200">
              Aspect Ratio
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: '9:16', label: '9:16 Vertical' },
                  { id: '1:1', label: '1:1 Square' },
                  { id: '16:9', label: '16:9 Wide' },
                ] as const
              ).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setAspectRatio(r.id)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-mono font-semibold border transition-colors ${
                    aspectRatio === r.id
                      ? 'bg-purple-600 border-purple-400 text-white'
                      : 'bg-[#121624] border-[#232A40] text-slate-400 hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Setting 4: Subtitle Language & Style */}
          <div className="p-3.5 rounded-xl bg-[#0A0C14] border border-[#1E2436] space-y-2">
            <label className="block text-xs font-semibold text-slate-200">
              Subtitle Language &amp; Style
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <select
                aria-label="Subtitle Language"
                value={subtitleLanguage}
                onChange={(e) =>
                  setSubtitleLanguage(e.target.value as CaptionLanguage)
                }
                className="px-2 py-1.5 rounded-lg bg-[#121624] border border-[#232A40] text-xs text-white"
              >
                <option value="english">English</option>
                <option value="urdu">Urdu</option>
                <option value="roman_urdu">Roman Urdu</option>
                <option value="spanish">Spanish</option>
                <option value="arabic">Arabic</option>
              </select>

              <select
                aria-label="Subtitle Style"
                value={subtitleStyle}
                onChange={(e) =>
                  setSubtitleStyle(e.target.value as SubtitleStylePreset)
                }
                className="px-2 py-1.5 rounded-lg bg-[#121624] border border-[#232A40] text-xs text-white"
              >
                <option value="bold_hormozi">Bold Hormozi</option>
                <option value="neon_viral">Neon Viral</option>
                <option value="clean_studio">Clean Studio</option>
                <option value="editorial_top">Editorial Top</option>
              </select>
            </div>
          </div>
        </div>

        {/* Additional AI Framing & Subtitle Toggles + Prominent GENERATE SHORTS Button */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setSubtitlesEnabled((v) => !v)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
                subtitlesEnabled
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                  : 'bg-[#0A0C14] border-[#22283B] text-slate-400'
              }`}
            >
              <Subtitles className="w-3.5 h-3.5" />
              <span>Automatic Subtitles: {subtitlesEnabled ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSmartReframing((v) => !v)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
                smartReframing
                  ? 'bg-purple-950/40 border-purple-500/50 text-purple-200'
                  : 'bg-[#0A0C14] border-[#22283B] text-slate-400'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Smart Reframing: {smartReframing ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => setFaceTracking((v) => !v)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
                faceTracking
                  ? 'bg-blue-950/40 border-blue-500/50 text-blue-200'
                  : 'bg-[#0A0C14] border-[#22283B] text-slate-400'
              }`}
            >
              <ScanFace className="w-3.5 h-3.5" />
              <span>Face Tracking: {faceTracking ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <button
            type="button"
            id="generate-shorts-button"
            disabled={isGeneratingShorts}
            onClick={handleGenerateAutomaticShorts}
            className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-60 text-sm font-display font-bold text-white shadow-lg shadow-purple-950/50 transition-all cursor-pointer"
          >
            {isGeneratingShorts ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {activePipelineStage || 'Processing'} ({pipelineProgressPct}%)
                </span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Shorts</span>
              </>
            )}
          </button>
        </div>

        {/* 10-Stage Real-Time Processing Progress Tracker */}
        {(isGeneratingShorts || activePipelineStage) && (
          <div
            data-testid="shorts-progress-tracker"
            className="p-4 rounded-xl bg-[#0A0C14] border border-[#252D44] space-y-3"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white flex items-center gap-2">
                {isGeneratingShorts ? (
                  <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>
                  Pipeline Stage: <strong className="text-purple-300">{activePipelineStage}</strong>
                </span>
              </span>
              <span className="font-mono text-emerald-400">
                {pipelineProgressPct}%
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-[#121624] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 via-blue-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${pipelineProgressPct}%` }}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-1.5 pt-1">
              {SHORTS_PIPELINE_STAGES.map((stage, idx) => {
                const isDone =
                  activePipelineStage === 'Completed' ||
                  (currentStageIndex > idx && currentStageIndex !== -1);
                const isCurrent =
                  activePipelineStage === stage &&
                  activePipelineStage !== 'Completed';
                return (
                  <div
                    key={stage}
                    className={`px-2 py-1.5 rounded-lg border text-[10px] font-mono flex items-center gap-1.5 ${
                      isDone
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                        : isCurrent
                        ? 'bg-purple-950/50 border-purple-400 text-white font-semibold'
                        : 'bg-[#0E111B] border-[#1D2336] text-slate-500'
                    }`}
                  >
                    {isDone ? (
                      <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                    ) : isCurrent ? (
                      <Loader2 className="w-3 h-3 text-purple-400 animate-spin shrink-0" />
                    ) : (
                      <span className="w-3 text-center">{idx + 1}</span>
                    )}
                    <span className="truncate">{stage}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* GENERATED SHORTS DASHBOARD */}
      {activeClips.length > 0 && (
        <section
          data-testid="generated-shorts-dashboard"
          className="rounded-2xl bg-[#10131E] border border-[#1E2436] p-6 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1C2235] pb-4">
            <div>
              <span className="text-[11px] font-mono uppercase text-emerald-400">
                Generated Shorts Dashboard · PostgreSQL Persisted &amp; FFmpeg Rendered
              </span>
              <h2 className="text-lg font-display font-bold text-white">
                Generated Shorts for &ldquo;{activeVideo?.title}&rdquo; ({activeClips.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('generated-clips')}
              className="px-3.5 py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-xs font-semibold text-purple-200 self-start"
            >
              View All in Generated Clips Library
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {activeClips.map((clip) => {
              const tags =
                clip.hashtagsList && clip.hashtagsList.length > 0
                  ? clip.hashtagsList
                  : (clip.hashtags || '#Shorts #ClipMatrix #Reels #Viral').split(' ');
              const isRegenerating = regeneratingClipId === clip.id;
              const isDeleting = deletingClipId === clip.id;

              return (
                <div
                  key={clip.id}
                  data-testid={`short-card-${clip.id}`}
                  className="rounded-xl bg-[#0B0E17] border border-[#22283B] p-4 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    {/* Top Metadata Bar */}
                    <div className="flex items-center justify-between gap-2 text-xs font-mono">
                      <span className="text-purple-400 font-semibold">
                        Score {clip.viralityScore}/100
                      </span>
                      <span className="text-slate-300">
                        {clip.aspectRatio} · {clip.durationSeconds}s · {clip.startTimecode}–{clip.endTimecode}
                      </span>
                    </div>

                    {/* Video Preview with Poster Thumbnail */}
                    <div className="rounded-lg overflow-hidden bg-black border border-[#1E2538] relative">
                      <video
                        ref={(el) => {
                          clipVideoRefs.current[clip.id] = el;
                        }}
                        controls
                        preload="metadata"
                        poster={clip.thumbnailUrl}
                        src={clip.clipUrl}
                        className="w-full h-64 object-contain bg-black"
                      />
                    </div>

                    {/* Thumbnail & Subtitle Status Strip */}
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
                      <div className="flex items-center gap-2">
                        <img
                          src={clip.thumbnailUrl}
                          alt={`${clip.title} thumbnail`}
                          className="w-8 h-8 rounded object-cover border border-[#262F47]"
                        />
                        <span>
                          {clip.subtitlesEnabled !== false
                            ? `Subtitles: ON (${clip.subtitleStyle || 'bold_hormozi'})`
                            : 'Subtitles: OFF'}
                        </span>
                      </div>
                      <span className="text-emerald-400">
                        {formatBytes(clip.fileSizeBytes)}
                      </span>
                    </div>

                    {/* Titles, Original Video Title, AI Caption & Hashtags */}
                    <div className="space-y-1.5">
                      <h3 className="text-sm font-display font-bold text-white">
                        {clip.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 truncate">
                        Original Video: <span className="text-slate-200">{activeVideo?.title}</span>
                      </p>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {clip.captionText}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {tags.map((tag, i) => (
                          <span
                            key={`${clip.id}-tag-${i}`}
                            className="text-[11px] font-mono text-blue-400"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 5 Required Action Buttons: Play Preview, Download, Edit, Regenerate, Delete */}
                  <div className="pt-3 border-t border-[#1A2032] flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handlePlayClipPreview(clip.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/40 text-xs font-medium text-purple-200"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Play Preview</span>
                    </button>

                    <a
                      href={`/api/clips/${clip.id}/download`}
                      download
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/40 text-xs font-medium text-emerald-200"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectClipForStudio) {
                          onSelectClipForStudio(`db-clip-${clip.id}`);
                        }
                        onNavigate('ai-editing');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161B2C] hover:bg-[#1F263E] border border-[#262F47] text-xs font-medium text-slate-200"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-purple-400" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      disabled={isRegenerating}
                      onClick={() => handleRegenerateClip(clip)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161B2C] hover:bg-[#1F263E] border border-[#262F47] disabled:opacity-50 text-xs font-medium text-blue-300"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`}
                      />
                      <span>{isRegenerating ? 'Re-Rendering...' : 'Regenerate'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => handleDeleteClip(clip)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-500/30 disabled:opacity-50 text-xs font-medium text-red-300 ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isDeleting ? '...' : 'Delete'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Detailed Pipeline Workbench & Source Video Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 7 Columns: Step-by-Step Inspection & Manual Slicing Controls */}
        <div className="xl:col-span-7 space-y-6">
          {/* STEP 2: Audio Extraction (FFmpeg) & Local faster-whisper Speech-to-Text */}
          <section className="rounded-xl bg-[#10131E] border border-[#1E2436] p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1C2235] pb-3">
              <div>
                <span className="text-[11px] font-mono uppercase text-blue-400">
                  Step-by-Step Control · FFmpeg Audio Extraction &amp; Local Faster-Whisper
                </span>
                <h2 className="text-base font-display font-semibold text-white">
                  Inspect Speech Transcript &amp; Word Timestamps
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
                  Gemini Highlight Analysis · Model: gemini-4-hydrogen
                </span>
                <h2 className="text-base font-display font-semibold text-white">
                  Detected Viral Moments, Hooks &amp; Timestamps
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
                    ? 'Analyzing with gemini-4-hydrogen...'
                    : activeHighlights.length > 0
                    ? 'Re-Run Gemini Highlight Detection'
                    : 'Analyze Transcript with Gemini'}
                </span>
              </button>
            </div>

            {activeHighlights.length === 0 ? (
              <div className="p-4 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs text-slate-400">
                Click <strong className="text-white">Generate Shorts</strong> above to run the full pipeline automatically, or run Step 2 + Step 3 individually to inspect highlights.
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
                Custom Timestamp Slicing &amp; Batch FFmpeg Clip Generation
              </span>
              <h2 className="text-base font-display font-semibold text-white">
                Manual Timestamp Selection &amp; Custom Clip Cut
              </h2>
            </div>

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
                    className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg bg-[#161B2B] hover:bg-[#1E253A] border border-[#262F49] text-xs font-medium text-slate-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Queue</span>
                  </button>
                  <button
                    type="button"
                    disabled={!activeVideo || isRenderingClips}
                    onClick={() => handleRenderRealClips('manual_direct')}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Cut Now</span>
                  </button>
                </div>
              </div>

              {manualQueue.length > 0 && (
                <div className="pt-2 space-y-1.5">
                  <div className="text-[11px] text-slate-400">
                    Queued Manual Clips ({manualQueue.length}):
                  </div>
                  {manualQueue.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-3 py-1.5 rounded bg-[#10131E] border border-[#1E2436] text-xs"
                    >
                      <span className="text-slate-200">
                        {item.title}{' '}
                        <span className="font-mono text-purple-400">
                          [{item.startTime} – {item.endTime}]
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveManualDraft(item.id)}
                        className="text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={
                !activeVideo ||
                isRenderingClips ||
                (selectedHighlightIds.length === 0 && manualQueue.length === 0)
              }
              onClick={() => handleRenderRealClips('selected')}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors"
            >
              <Scissors className="w-4 h-4" />
              <span>
                {isRenderingClips
                  ? 'Rendering Real MP4 Clips & Subtitles via FFmpeg...'
                  : `Render Selected Clips (${
                      selectedHighlightIds.length + manualQueue.length
                    }) in ${aspectRatio} via FFmpeg`}
              </span>
            </button>
          </section>
        </div>

        {/* Right 5 Columns: Real HTML5 Source Video Player & FFprobe Metadata */}
        <div className="xl:col-span-5 space-y-6">
          <div className="rounded-xl bg-[#10131E] border border-[#1E2436] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Source Video Player &amp; FFprobe Telemetry
              </span>
              {activeVideo && (
                <span className="text-xs font-mono text-emerald-400">
                  {activeVideo.width}×{activeVideo.height} · {activeVideo.fps}fps
                </span>
              )}
            </div>

            {activeVideo ? (
              <div className="space-y-3">
                <div className="rounded-lg overflow-hidden bg-black border border-[#22283B]">
                  <video
                    ref={videoPreviewRef}
                    key={activeVideo.videoUrl}
                    controls
                    preload="metadata"
                    src={activeVideo.videoUrl}
                    className="w-full max-h-72 object-contain bg-black"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-slate-400">
                  <div className="p-2 rounded bg-[#0C0E17] border border-[#1E2436]">
                    <span className="block text-slate-500">Duration</span>
                    <span className="text-white">{activeVideo.durationSeconds}s</span>
                  </div>
                  <div className="p-2 rounded bg-[#0C0E17] border border-[#1E2436]">
                    <span className="block text-slate-500">Codecs</span>
                    <span className="text-white">
                      {activeVideo.videoCodec}/{activeVideo.audioCodec}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-[#0C0E17] border border-[#1E2436]">
                    <span className="block text-slate-500">Size</span>
                    <span className="text-white">
                      {formatBytes(activeVideo.fileSizeBytes)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-lg bg-[#0C0E17] border border-[#22283B] text-center text-xs text-slate-400">
                Upload a video or click <strong className="text-white">Generate Spoken Test MP4</strong> to preview the source stream here.
              </div>
            )}
          </div>

          {/* Processing Jobs Log from PostgreSQL */}
          {activeVideo && activeVideo.jobs && activeVideo.jobs.length > 0 && (
            <div className="rounded-xl bg-[#10131E] border border-[#1E2436] p-5 space-y-3">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                PostgreSQL Processing Job History ({activeVideo.jobs.length})
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {activeVideo.jobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-2.5 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs flex items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-mono text-purple-400 uppercase">
                        [{job.jobType}]
                      </span>{' '}
                      <span className="text-slate-200">{job.currentStep}</span>
                      {job.errorMessage && (
                        <p className="text-red-400 text-[11px] mt-0.5">
                          {job.errorMessage}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-mono shrink-0 ${
                        job.status === 'completed'
                          ? 'text-emerald-400'
                          : job.status === 'failed'
                          ? 'text-red-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {job.status.toUpperCase()} ({job.progressPercent}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
