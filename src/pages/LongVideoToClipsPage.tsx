import React, { useState } from 'react';
import {
  Upload,
  Link2,
  HardDrive,
  Radio,
  Sparkles,
  Clock,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  AspectRatioPreset,
  ClipDetectionMode,
  ClipDurationPreset,
  GeneratedClip,
  NavigationPageId,
  VideoProject,
  VideoSourceType,
} from '../types/clipmatrix';
import { validateClipJobInput } from '../utils/clipLogic';
import { VideoPreviewFrame } from '../components/common/VideoPreviewFrame';

interface LongVideoToClipsPageProps {
  projects: VideoProject[];
  onCreateProjectAndClips: (params: {
    project: VideoProject;
    generatedClips: GeneratedClip[];
  }) => void;
  onNavigate: (page: NavigationPageId) => void;
}

export const LongVideoToClipsPage: React.FC<LongVideoToClipsPageProps> = ({
  projects,
  onCreateProjectAndClips,
  onNavigate,
}) => {
  const [title, setTitle] = useState('AI Engineering Deep Dive — Episode 14');
  const [sourceType, setSourceType] = useState<VideoSourceType>('youtube_url');
  const [sourceValue, setSourceValue] = useState(
    'https://www.youtube.com/watch?v=clipmatrix_ai_ep14'
  );
  const [detectionMode, setDetectionMode] =
    useState<ClipDetectionMode>('auto_highlight');
  const [durationPreset, setDurationPreset] = useState<ClipDurationPreset>(45);
  const [customDuration, setCustomDuration] = useState<number>(50);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioPreset>('9:16');
  const [manualStartTime, setManualStartTime] = useState('08:15');
  const [manualEndTime, setManualEndTime] = useState('09:00');
  const [errorMessage, setErrorMessage] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  const sourceOptions: { id: VideoSourceType; label: string; placeholder: string; icon: React.ComponentType<{ className?: string }> }[] = [
    {
      id: 'youtube_url',
      label: 'YouTube Link',
      placeholder: 'https://www.youtube.com/watch?v=...',
      icon: Link2,
    },
    {
      id: 'local_upload',
      label: 'Local Video Upload',
      placeholder: 'keynote_master_4k_60fps.mp4',
      icon: Upload,
    },
    {
      id: 'google_drive',
      label: 'Google Drive Link',
      placeholder: 'https://drive.google.com/file/d/.../view',
      icon: HardDrive,
    },
    {
      id: 'livestream_recording',
      label: 'Livestream Recording',
      placeholder: 'twitch_vod_2026_11_13_stream.ts',
      icon: Radio,
    },
  ];

  const handleSourceSwitch = (newSource: VideoSourceType) => {
    setSourceType(newSource);
    setErrorMessage('');
    if (newSource === 'youtube_url') {
      setSourceValue('https://www.youtube.com/watch?v=clipmatrix_ai_ep14');
    } else if (newSource === 'google_drive') {
      setSourceValue('https://drive.google.com/file/d/1ClipMatrixRawMaster/view');
    } else if (newSource === 'local_upload') {
      setSourceValue('studio_session_4k_prores.mp4');
    } else if (newSource === 'livestream_recording') {
      setSourceValue('aidenvance_live_buffer_recording.ts');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateClipJobInput({
      title,
      sourceType,
      sourceValue,
      durationPreset,
      customDurationSeconds: customDuration,
      detectionMode,
      manualStartTime,
      manualEndTime,
    });

    if (!validation.valid) {
      setErrorMessage(validation.error || 'Please check your input parameters.');
      setSuccessBanner('');
      return;
    }

    setErrorMessage('');
    const finalSeconds =
      durationPreset === 'custom' ? Number(customDuration) : durationPreset;
    const newProjectId = `proj-${Date.now()}`;

    const newProject: VideoProject = {
      id: newProjectId,
      title: title.trim(),
      sourceType,
      sourceUrlOrFile: sourceValue.trim(),
      durationFormatted: '54:20',
      createdAt: 'Just now',
      status: 'ready',
      clipsCount: 2,
      aspectRatio,
      detectionMode,
    };

    const newClips: GeneratedClip[] = [
      {
        id: `clip-${Date.now()}-1`,
        projectId: newProjectId,
        projectTitle: title.trim(),
        title: `${title.trim()} — Primary Viral Hook`,
        sourceType,
        durationSeconds: finalSeconds,
        aspectRatio,
        startTimecode:
          detectionMode === 'manual_timestamp' ? manualStartTime : '11:20',
        endTimecode:
          detectionMode === 'manual_timestamp' ? manualEndTime : '12:05',
        viralityScore: 95,
        approvalStatus: 'pending_approval',
        targetPlatforms: ['youtube', 'tiktok', 'instagram'],
        captionText: `🔥⚡ Key highlight extracted from "${title.trim()}" (${aspectRatio}, ${finalSeconds}s). #ClipMatrix #Shorts`,
        captionLanguage: 'english',
        createdAt: 'Just now',
        speakerLabel: 'Main Speaker',
        editConfig: {
          subtitlesEnabled: true,
          subtitleFont: 'Plus Jakarta Sans',
          subtitlePosition: 'bottom',
          smartReframing: true,
          faceTracking: true,
          autoZoomKeyframes: true,
          zoomIntensity: 'dynamic',
          backgroundMusicTrack: 'Midnight Synth Pulse',
          musicVolume: 15,
          sfxEnabled: true,
          selectedThumbnailTimecode: '11:34',
          thumbnailHeadline: 'KEY INSIGHT REVEALED',
        },
      },
      {
        id: `clip-${Date.now()}-2`,
        projectId: newProjectId,
        projectTitle: title.trim(),
        title: `${title.trim()} — Counter-Intuitive Takeaway`,
        sourceType,
        durationSeconds: finalSeconds,
        aspectRatio,
        startTimecode: '28:10',
        endTimecode: '28:55',
        viralityScore: 91,
        approvalStatus: 'pending_approval',
        targetPlatforms: ['youtube', 'instagram'],
        captionText: `📈🎯 Three actionable lessons from "${title.trim()}". #ClipMatrix #Reels`,
        captionLanguage: 'english',
        createdAt: 'Just now',
        speakerLabel: 'Main Speaker',
        editConfig: {
          subtitlesEnabled: true,
          subtitleFont: 'Plus Jakarta Sans',
          subtitlePosition: 'bottom',
          smartReframing: true,
          faceTracking: true,
          autoZoomKeyframes: false,
          zoomIntensity: 'balanced',
          backgroundMusicTrack: 'Subtle Ambient Pad',
          musicVolume: 12,
          sfxEnabled: false,
          selectedThumbnailTimecode: '28:25',
          thumbnailHeadline: 'SYSTEM ARCHITECTURE',
        },
      },
    ];

    onCreateProjectAndClips({ project: newProject, generatedClips: newClips });
    setSuccessBanner(
      `Created project "${newProject.title}" and extracted 2 clips (${finalSeconds}s, ${aspectRatio}).`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#1C2030]">
        <div>
          <div className="text-xs text-purple-400 font-medium">
            Multi-Source Video Ingestion &amp; Highlight Slicing
          </div>
          <h1 className="text-2xl font-display font-bold text-white">
            Long Video to Clips
          </h1>
          <p className="text-sm text-slate-400">
            Import from local storage, YouTube, Google Drive, or livestream VODs and configure AI highlight detection or manual timecodes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('generated-clips')}
          className="px-3.5 py-2 rounded-lg bg-[#151928] hover:bg-[#1C2236] border border-[#262E45] text-xs font-medium text-white self-start whitespace-nowrap"
        >
          Browse Generated Clips
        </button>
      </div>

      {successBanner && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-200"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successBanner}</span>
          </span>
          <div className="flex items-center gap-3">
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
        {/* Left 7 Cols: Configuration Form */}
        <form
          onSubmit={handleSubmit}
          className="xl:col-span-7 rounded-xl bg-[#10131E] border border-[#1E2436] p-6 space-y-6"
        >
          {errorMessage && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Source Type Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              1. Select Video Input Source
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {sourceOptions.map((opt) => {
                const Icon = opt.icon;
                const active = sourceType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSourceSwitch(opt.id)}
                    className={`p-3 rounded-lg border text-left transition-colors flex flex-col gap-1.5 ${
                      active
                        ? 'bg-purple-600/20 border-purple-500/50 text-white'
                        : 'bg-[#0C0E17] border-[#22283B] text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-purple-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-medium">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Project Title & Source Path/URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="clip-job-title" className="block text-xs font-medium text-slate-300">
                Project Title
              </label>
              <input
                id="clip-job-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="clip-job-source" className="block text-xs font-medium text-slate-300">
                Source URL or Filename
              </label>
              <input
                id="clip-job-source"
                type="text"
                value={sourceValue}
                onChange={(e) => setSourceValue(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-sm font-mono text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* 3. Clipping Detection Mode */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              2. AI Clipping Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDetectionMode('auto_highlight')}
                className={`p-3.5 rounded-lg border text-left transition-colors ${
                  detectionMode === 'auto_highlight'
                    ? 'bg-purple-600/20 border-purple-500/50 text-white'
                    : 'bg-[#0C0E17] border-[#22283B] text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Automatic Highlight Detection</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Scores transcript hooks, vocal energy, and topic transitions automatically.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDetectionMode('manual_timestamp')}
                className={`p-3.5 rounded-lg border text-left transition-colors ${
                  detectionMode === 'manual_timestamp'
                    ? 'bg-purple-600/20 border-purple-500/50 text-white'
                    : 'bg-[#0C0E17] border-[#22283B] text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span>Manual Timestamp Selection</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Specify exact start and end timecodes (MM:SS) for frame-accurate slicing.
                </p>
              </button>
            </div>

            {detectionMode === 'manual_timestamp' && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label htmlFor="manual-start" className="block text-xs text-slate-400 mb-1">
                    Start Timestamp (MM:SS)
                  </label>
                  <input
                    id="manual-start"
                    type="text"
                    value={manualStartTime}
                    onChange={(e) => setManualStartTime(e.target.value)}
                    placeholder="08:15"
                    className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-sm font-mono tabular-nums text-white"
                  />
                </div>
                <div>
                  <label htmlFor="manual-end" className="block text-xs text-slate-400 mb-1">
                    End Timestamp (MM:SS)
                  </label>
                  <input
                    id="manual-end"
                    type="text"
                    value={manualEndTime}
                    onChange={(e) => setManualEndTime(e.target.value)}
                    placeholder="09:00"
                    className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-sm font-mono tabular-nums text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 4. Clip Duration & Aspect Ratio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                3. Target Clip Duration
              </label>
              <div className="flex flex-wrap gap-1.5">
                {([15, 30, 45, 60, 'custom'] as ClipDurationPreset[]).map((preset) => (
                  <button
                    key={String(preset)}
                    type="button"
                    onClick={() => setDurationPreset(preset)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono tabular-nums border transition-colors ${
                      durationPreset === preset
                        ? 'bg-purple-600 text-white border-purple-500'
                        : 'bg-[#0C0E17] text-slate-300 border-[#22283B] hover:text-white'
                    }`}
                  >
                    {preset === 'custom' ? 'Custom' : `${preset}s`}
                  </button>
                ))}
              </div>
              {durationPreset === 'custom' && (
                <div className="pt-1">
                  <label htmlFor="custom-duration-sec" className="sr-only">
                    Custom duration in seconds
                  </label>
                  <input
                    id="custom-duration-sec"
                    type="number"
                    min={5}
                    max={180}
                    value={customDuration}
                    onChange={(e) => setCustomDuration(Number(e.target.value))}
                    className="w-36 px-3 py-1.5 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs font-mono tabular-nums text-white"
                  />
                  <span className="ml-2 text-xs text-slate-400">seconds (5–180s)</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                4. Output Aspect Ratio
              </label>
              <div className="flex items-center gap-2">
                {(['9:16', '16:9', '1:1'] as AspectRatioPreset[]).map((ratio) => (
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
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-xs font-semibold text-white transition-colors"
          >
            Extract High-Retention Clips (Sample Pipeline)
          </button>
        </form>

        {/* Right 5 Cols: Live Aspect Framing Preview & Recent Projects */}
        <div className="xl:col-span-5 space-y-6">
          <div className="rounded-xl bg-[#10131E] border border-[#1E2436] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-display font-semibold text-white">
                Framing &amp; Reframe Preview ({aspectRatio})
              </h2>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {durationPreset === 'custom' ? `${customDuration}s` : `${durationPreset}s`} target
              </span>
            </div>

            <VideoPreviewFrame
              title={title}
              aspectRatio={aspectRatio}
              timecode={
                detectionMode === 'manual_timestamp'
                  ? `${manualStartTime} - ${manualEndTime}`
                  : '11:20 / 54:20'
              }
              speakerLabel={sourceType.replace('_', ' ').toUpperCase()}
              showFaceTracking={true}
            />
          </div>

          <div className="rounded-xl bg-[#10131E] border border-[#1E2436] p-5 space-y-3">
            <h3 className="text-xs font-display font-semibold text-slate-300">
              Ingested Video Queue ({projects.length})
            </h3>
            <div className="divide-y divide-[#1A1F30]">
              {projects.slice(0, 4).map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div className="truncate">
                    <div className="font-medium text-white truncate">{p.title}</div>
                    <div className="text-slate-500 font-mono">
                      {p.aspectRatio} · {p.clipsCount} clips
                    </div>
                  </div>
                  <span className="font-mono text-emerald-400 shrink-0">{p.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
