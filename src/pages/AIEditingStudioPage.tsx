import React, { useState } from 'react';
import {
  Wand2,
  Type,
  Focus,
  ZoomIn,
  Music,
  Image,
  Check,
  Send,
} from 'lucide-react';
import {
  AIEditConfig,
  AspectRatioPreset,
  GeneratedClip,
  NavigationPageId,
} from '../types/clipmatrix';
import { VideoPreviewFrame } from '../components/common/VideoPreviewFrame';

interface AIEditingStudioPageProps {
  clips: GeneratedClip[];
  selectedClipId: string;
  onSelectClip: (id: string) => void;
  onUpdateClipEditConfig: (
    clipId: string,
    editConfig: AIEditConfig,
    aspectRatio: AspectRatioPreset
  ) => void;
  onNavigate: (page: NavigationPageId) => void;
}

export const AIEditingStudioPage: React.FC<AIEditingStudioPageProps> = ({
  clips,
  selectedClipId,
  onSelectClip,
  onUpdateClipEditConfig,
  onNavigate,
}) => {
  const activeClip =
    clips.find((c) => c.id === selectedClipId) || clips[0];

  const [editState, setEditState] = useState<AIEditConfig>(
    activeClip?.editConfig || {
      subtitlesEnabled: true,
      subtitleFont: 'Plus Jakarta Sans',
      subtitlePosition: 'bottom',
      smartReframing: true,
      faceTracking: true,
      autoZoomKeyframes: true,
      zoomIntensity: 'dynamic',
      backgroundMusicTrack: 'Midnight Synth Pulse',
      musicVolume: 16,
      sfxEnabled: true,
      selectedThumbnailTimecode: '00:14',
      thumbnailHeadline: 'THE 3-SECOND HOOK',
    }
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatioPreset>(
    activeClip?.aspectRatio || '9:16'
  );
  const [savedNotice, setSavedNotice] = useState<string>('');

  const handleSwitchClip = (newId: string) => {
    onSelectClip(newId);
    const found = clips.find((c) => c.id === newId);
    if (found) {
      setEditState(found.editConfig);
      setAspectRatio(found.aspectRatio);
      setSavedNotice('');
    }
  };

  const handleSaveChanges = () => {
    if (!activeClip) return;
    onUpdateClipEditConfig(activeClip.id, editState, aspectRatio);
    setSavedNotice(
      `Saved AI Editing parameters (Subtitles, Face Tracking, Audio Mix & Thumbnail) for "${activeClip.title}".`
    );
  };

  if (!activeClip) {
    return (
      <div className="p-10 rounded-xl bg-[#10131E] border border-[#1E2436] text-center space-y-3">
        <Wand2 className="w-8 h-8 text-purple-400 mx-auto" />
        <h1 className="text-lg font-display font-bold text-white">
          No Clips Loaded in AI Editing Studio
        </h1>
        <button
          type="button"
          onClick={() => onNavigate('long-video')}
          className="px-4 py-2 rounded-lg bg-purple-600 text-xs font-medium text-white"
        >
          Generate a Clip First
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Studio Top Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#1C2030]">
        <div>
          <div className="text-xs text-purple-400 font-medium">
            Non-Linear AI Enhancement Workbench · FFmpeg &amp; MediaPipe Ready
          </div>
          <h1 className="text-2xl font-display font-bold text-white">
            AI Editing Studio
          </h1>
          <p className="text-sm text-slate-400">
            Fine-tune dynamic subtitles, smart reframing, face tracking, auto-zoom keyframes, background music, and custom thumbnails.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor="studio-clip-select" className="sr-only">
            Select clip to edit
          </label>
          <select
            id="studio-clip-select"
            value={activeClip.id}
            onChange={(e) => handleSwitchClip(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#121522] border border-[#252C42] text-xs text-white max-w-xs truncate"
          >
            {clips.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.aspectRatio})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleSaveChanges}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-xs font-medium text-white whitespace-nowrap"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Studio Render Config</span>
          </button>

          <button
            type="button"
            onClick={() => {
              handleSaveChanges();
              onNavigate('upload-approval');
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#161B2B] hover:bg-[#1F263D] border border-[#262F49] text-xs font-medium text-slate-200 whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5 text-purple-400" />
            <span>Send to Approval</span>
          </button>
        </div>
      </div>

      {savedNotice && (
        <div
          role="status"
          className="px-4 py-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2"
        >
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 5 Cols: Interactive Preview Monitor + Keyframe Timeline */}
        <div className="xl:col-span-5 rounded-xl bg-[#10131E] border border-[#1E2436] p-5 space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-display font-semibold text-white truncate">
              Canvas Monitor · {activeClip.title}
            </span>
            <div className="flex items-center gap-1">
              {(['9:16', '16:9', '1:1'] as AspectRatioPreset[]).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setAspectRatio(ratio)}
                  className={`px-2 py-1 rounded text-[11px] font-mono tabular-nums ${
                    aspectRatio === ratio
                      ? 'bg-purple-600 text-white'
                      : 'bg-[#161A29] text-slate-400 hover:text-white'
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          <VideoPreviewFrame
            title={activeClip.title}
            aspectRatio={aspectRatio}
            timecode={`${activeClip.startTimecode} – ${activeClip.endTimecode}`}
            speakerLabel={activeClip.speakerLabel || 'Tracked Subject'}
            showSubtitles={editState.subtitlesEnabled}
            subtitleText={
              editState.thumbnailHeadline
                ? `[${editState.thumbnailHeadline}] ${activeClip.captionText.slice(0, 58)}...`
                : activeClip.captionText
            }
            showFaceTracking={editState.faceTracking}
          />

          {/* Simulated Multi-Track NLE Timeline Scrubber */}
          <div className="space-y-2 pt-2 border-t border-[#1E2436]">
            <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
              <span>In: {activeClip.startTimecode}</span>
              <span>Duration: {activeClip.durationSeconds}s</span>
              <span>Out: {activeClip.endTimecode}</span>
            </div>
            <div className="space-y-1.5">
              <div className="h-5 rounded bg-[#161B2C] px-2 flex items-center justify-between text-[10px] font-mono text-purple-300 border border-purple-500/30">
                <span>V1 · Smart Reframe &amp; Face Track</span>
                <span>{editState.faceTracking ? 'LOCKED' : 'STATIC'}</span>
              </div>
              <div className="h-5 rounded bg-[#141A29] px-2 flex items-center justify-between text-[10px] font-mono text-blue-300 border border-blue-500/30">
                <span>T1 · Dynamic Whisper Subtitles ({editState.subtitleFont})</span>
                <span>{editState.subtitlesEnabled ? 'ACTIVE' : 'MUTED'}</span>
              </div>
              <div className="h-5 rounded bg-[#121824] px-2 flex items-center justify-between text-[10px] font-mono text-emerald-300 border border-emerald-500/30">
                <span>A2 · {editState.backgroundMusicTrack}</span>
                <span>{editState.musicVolume}% Gain</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 7 Cols: 5 Modular AI Editing Control Sections */}
        <div className="xl:col-span-7 space-y-4">
          {/* 1. Subtitles & Typography */}
          <div className="rounded-xl bg-[#10131E] border border-[#1E2436] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-purple-400" />
                <h2 className="text-sm font-display font-semibold text-white">
                  1. Animated Subtitles &amp; Word Highlighting
                </h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditState((s) => ({
                    ...s,
                    subtitlesEnabled: !s.subtitlesEnabled,
                  }))
                }
                className={`px-3 py-1 rounded-lg text-xs font-medium ${
                  editState.subtitlesEnabled
                    ? 'bg-emerald-600/25 text-emerald-200 border border-emerald-500/40'
                    : 'bg-[#171B2A] text-slate-400 border border-[#252C42]'
                }`}
              >
                {editState.subtitlesEnabled ? 'Subtitles Enabled' : 'Subtitles Off'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sub-font" className="block text-xs text-slate-400 mb-1">
                  Subtitle Font Family
                </label>
                <select
                  id="sub-font"
                  value={editState.subtitleFont}
                  onChange={(e) =>
                    setEditState((s) => ({
                      ...s,
                      subtitleFont: e.target.value as AIEditConfig['subtitleFont'],
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs text-white"
                >
                  <option value="Plus Jakarta Sans">Plus Jakarta Sans (Bold Display)</option>
                  <option value="DM Sans">DM Sans (Clean Editorial)</option>
                  <option value="JetBrains Mono">JetBrains Mono (Technical Code)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Vertical Safe-Zone Position
                </label>
                <div className="flex items-center gap-2">
                  {(['bottom', 'center', 'top'] as const).map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() =>
                        setEditState((s) => ({ ...s, subtitlePosition: pos }))
                      }
                      className={`flex-1 py-2 rounded-lg text-xs capitalize border ${
                        editState.subtitlePosition === pos
                          ? 'bg-purple-600/25 border-purple-500 text-white'
                          : 'bg-[#0C0E17] border-[#22283B] text-slate-400'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Smart Reframing & Face Tracking */}
          <div className="rounded-xl bg-[#10131E] border border-[#1E2436] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Focus className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-display font-semibold text-white">
                2. Smart Reframing &amp; Active Speaker Face Tracking
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  setEditState((s) => ({ ...s, smartReframing: !s.smartReframing }))
                }
                className={`p-3 rounded-lg border text-left ${
                  editState.smartReframing
                    ? 'bg-blue-600/20 border-blue-500/50 text-white'
                    : 'bg-[#0C0E17] border-[#22283B] text-slate-400'
                }`}
              >
                <div className="text-xs font-semibold">
                  Smart Reframing: {editState.smartReframing ? 'ON' : 'OFF'}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Automatically keeps subjects centered inside 9:16 and 1:1 bounds.
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  setEditState((s) => ({ ...s, faceTracking: !s.faceTracking }))
                }
                className={`p-3 rounded-lg border text-left ${
                  editState.faceTracking
                    ? 'bg-purple-600/20 border-purple-500/50 text-white'
                    : 'bg-[#0C0E17] border-[#22283B] text-slate-400'
                }`}
              >
                <div className="text-xs font-semibold">
                  Face Tracking Reticle: {editState.faceTracking ? 'ON' : 'OFF'}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Locks camera pan smoothing onto the active speaker’s eye line.
                </p>
              </button>
            </div>
          </div>

          {/* 3. Auto-Zoom Keyframes & Effects */}
          <div className="rounded-xl bg-[#10131E] border border-[#1E2436] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ZoomIn className="w-4 h-4 text-purple-400" />
                <h2 className="text-sm font-display font-semibold text-white">
                  3. Dynamic Zoom Keyframes &amp; Jump-Cut Polish
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Intensity: {editState.zoomIntensity}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {(['subtle', 'balanced', 'dynamic'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() =>
                    setEditState((s) => ({
                      ...s,
                      autoZoomKeyframes: true,
                      zoomIntensity: level,
                    }))
                  }
                  className={`flex-1 py-2 px-3 rounded-lg text-xs capitalize border ${
                    editState.zoomIntensity === level
                      ? 'bg-purple-600/25 border-purple-500 text-white font-medium'
                      : 'bg-[#0C0E17] border-[#22283B] text-slate-400'
                  }`}
                >
                  {level} Punch-In
                </button>
              ))}
            </div>
          </div>

          {/* 4. Background Music & Sound Effects */}
          <div className="rounded-xl bg-[#10131E] border border-[#1E2436] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-display font-semibold text-white">
                  4. Optional Background Music &amp; Sound Effects
                </h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditState((s) => ({ ...s, sfxEnabled: !s.sfxEnabled }))
                }
                className={`px-2.5 py-1 rounded text-xs ${
                  editState.sfxEnabled
                    ? 'bg-emerald-600/25 text-emerald-200 border border-emerald-500/40'
                    : 'bg-[#171B2A] text-slate-400'
                }`}
              >
                Transition Whoosh SFX: {editState.sfxEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label htmlFor="music-track-select" className="block text-xs text-slate-400 mb-1">
                  Royalty-Free Backing Track
                </label>
                <select
                  id="music-track-select"
                  value={editState.backgroundMusicTrack}
                  onChange={(e) =>
                    setEditState((s) => ({
                      ...s,
                      backgroundMusicTrack: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs text-white"
                >
                  <option value="Midnight Synth Pulse">Midnight Synth Pulse</option>
                  <option value="Warm Acoustic Lo-Fi">Warm Acoustic Lo-Fi</option>
                  <option value="Subtle Ambient Pad">Subtle Ambient Pad</option>
                  <option value="Crisp Beat Drop">Crisp Beat Drop</option>
                  <option value="None (Original Stream Audio)">None (Original Stream Audio)</option>
                </select>
              </div>

              <div>
                <label htmlFor="music-vol-slider" className="block text-xs text-slate-400 mb-1 font-mono tabular-nums">
                  Auto-Ducked Music Volume: {editState.musicVolume}%
                </label>
                <input
                  id="music-vol-slider"
                  type="range"
                  min={0}
                  max={50}
                  value={editState.musicVolume}
                  onChange={(e) =>
                    setEditState((s) => ({
                      ...s,
                      musicVolume: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-purple-500"
                />
              </div>
            </div>
          </div>

          {/* 5. Thumbnail Frame Generator */}
          <div className="rounded-xl bg-[#10131E] border border-[#1E2436] p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Image className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-display font-semibold text-white">
                5. Thumbnail Frame &amp; Overlay Hook Generator
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="thumb-headline" className="block text-xs text-slate-400 mb-1">
                  Thumbnail Hook Banner Text
                </label>
                <input
                  id="thumb-headline"
                  type="text"
                  value={editState.thumbnailHeadline}
                  onChange={(e) =>
                    setEditState((s) => ({
                      ...s,
                      thumbnailHeadline: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs font-display font-bold text-white"
                />
              </div>
              <div>
                <label htmlFor="thumb-timecode" className="block text-xs text-slate-400 mb-1">
                  Frame Capture Timecode
                </label>
                <input
                  id="thumb-timecode"
                  type="text"
                  value={editState.selectedThumbnailTimecode}
                  onChange={(e) =>
                    setEditState((s) => ({
                      ...s,
                      selectedThumbnailTimecode: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs font-mono tabular-nums text-white"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
