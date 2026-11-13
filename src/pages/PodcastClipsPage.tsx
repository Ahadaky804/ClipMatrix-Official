import React, { useState } from 'react';
import {
  Mic2,
  Scissors,
  Users,
  Check,
  Columns,
  Maximize,
} from 'lucide-react';
import {
  GeneratedClip,
  NavigationPageId,
  PodcastEpisode,
  PodcastSpeakerSegment,
} from '../types/clipmatrix';
import { VideoPreviewFrame } from '../components/common/VideoPreviewFrame';

interface PodcastClipsPageProps {
  episodes: PodcastEpisode[];
  onExtractPodcastSegment: (clip: GeneratedClip) => void;
  onNavigate: (page: NavigationPageId) => void;
}

export const PodcastClipsPage: React.FC<PodcastClipsPageProps> = ({
  episodes,
  onExtractPodcastSegment,
  onNavigate,
}) => {
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>(
    episodes[0]?.id || ''
  );
  const [layoutMode, setLayoutMode] = useState<
    'split_screen_9_16' | 'active_speaker_crop' | 'cinema_16_9'
  >('split_screen_9_16');
  const [statusMessage, setStatusMessage] = useState<string>('');

  const selectedEpisode =
    episodes.find((ep) => ep.id === selectedEpisodeId) || episodes[0];

  const handleSliceSegment = (segment: PodcastSpeakerSegment) => {
    if (!selectedEpisode) return;
    const aspect = layoutMode === 'cinema_16_9' ? '16:9' : '9:16';

    const newClip: GeneratedClip = {
      id: `clip-pod-${Date.now()}`,
      projectId: selectedEpisode.id,
      projectTitle: `${selectedEpisode.showTitle} Ep. ${selectedEpisode.episodeNumber}`,
      title: `${segment.speakerName}: "${segment.transcriptSnippet.slice(0, 44)}..."`,
      sourceType: 'podcast_video',
      durationSeconds: 45,
      aspectRatio: aspect,
      startTimecode: segment.startTime,
      endTimecode: segment.endTime,
      viralityScore: segment.highlightScore,
      approvalStatus: 'pending_approval',
      targetPlatforms: ['youtube', 'instagram', 'tiktok'],
      captionText: `🎙️ ${segment.speakerName} on ${selectedEpisode.showTitle}: "${segment.transcriptSnippet}" #ClipMatrix #PodcastClips`,
      captionLanguage: 'english',
      createdAt: 'Just now',
      speakerLabel: segment.speakerName,
      editConfig: {
        subtitlesEnabled: true,
        subtitleFont: 'Plus Jakarta Sans',
        subtitlePosition: 'center',
        smartReframing: true,
        faceTracking: true,
        autoZoomKeyframes: true,
        zoomIntensity: 'balanced',
        backgroundMusicTrack: 'Warm Acoustic Lo-Fi',
        musicVolume: 12,
        sfxEnabled: false,
        selectedThumbnailTimecode: segment.startTime,
        thumbnailHeadline: `${segment.speakerName.toUpperCase()} ON PODCAST`,
      },
    };

    onExtractPodcastSegment(newClip);
    setStatusMessage(
      `Extracted podcast segment (${segment.startTime}–${segment.endTime}) with ${layoutMode.replace(/_/g, ' ')} framing.`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#1C2030]">
        <div>
          <div className="text-xs text-purple-400 font-medium">
            Multi-Speaker Diarization &amp; Split-Screen Framing
          </div>
          <h1 className="text-2xl font-display font-bold text-white">
            Podcast Clips Studio
          </h1>
          <p className="text-sm text-slate-400">
            Isolate multi-guest conversations with Whisper speaker diarization and automatic 9:16 dual-camera split-screen layouts.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start">
          <button
            type="button"
            onClick={() => onNavigate('caption-studio')}
            className="px-3.5 py-2 rounded-lg bg-[#151928] hover:bg-[#1C2236] border border-[#262E45] text-xs font-medium text-white whitespace-nowrap"
          >
            Bilingual Podcast Captions
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          role="status"
          className="px-4 py-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 flex items-center justify-between gap-3 text-xs text-emerald-200"
        >
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusMessage}</span>
          </span>
          <button
            type="button"
            onClick={() => onNavigate('generated-clips')}
            className="underline font-medium text-white"
          >
            View in Generated Clips
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 4 Cols: Episode Selector + Layout Mode */}
        <div className="lg:col-span-4 space-y-5">
          <div className="rounded-xl bg-[#10131E] border border-[#1E2436] p-4 space-y-3">
            <h2 className="text-xs font-display font-semibold text-slate-300">
              Select Podcast Episode
            </h2>
            <div className="space-y-2">
              {episodes.map((ep) => {
                const active = selectedEpisode?.id === ep.id;
                return (
                  <button
                    key={ep.id}
                    type="button"
                    onClick={() => setSelectedEpisodeId(ep.id)}
                    className={`w-full text-left p-3.5 rounded-lg border transition-colors space-y-1 ${
                      active
                        ? 'bg-purple-600/20 border-purple-500/50 text-white'
                        : 'bg-[#0C0E17] border-[#22283B] text-slate-300 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                      <span>
                        {ep.showTitle} · Ep. {ep.episodeNumber}
                      </span>
                      <span className="tabular-nums">{ep.durationFormatted}</span>
                    </div>
                    <div className="text-sm font-display font-semibold text-white">
                      {ep.episodeTitle}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1">
                      <Users className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="truncate">{ep.speakers.join(' · ')}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Multi-Camera Reframe Mode */}
          <div className="rounded-xl bg-[#10131E] border border-[#1E2436] p-4 space-y-3">
            <h3 className="text-xs font-display font-semibold text-slate-300">
              Multi-Speaker Camera Framing
            </h3>
            <div className="space-y-2">
              {[
                {
                  id: 'split_screen_9_16' as const,
                  label: '9:16 Vertical Split-Screen (Host + Guest)',
                  desc: 'Top/bottom stacked frame for simultaneous reactions',
                },
                {
                  id: 'active_speaker_crop' as const,
                  label: '9:16 Active Speaker Auto-Switch',
                  desc: 'Dynamic MediaPipe face tracking follows current voice',
                },
                {
                  id: 'cinema_16_9' as const,
                  label: '16:9 Wide Studio Cut',
                  desc: 'Full two-shot broadcast frame for YouTube VOD highlights',
                },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setLayoutMode(m.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    layoutMode === m.id
                      ? 'bg-blue-600/20 border-blue-500/50 text-white'
                      : 'bg-[#0C0E17] border-[#22283B] text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    {m.id === 'split_screen_9_16' ? (
                      <Columns className="w-3.5 h-3.5 text-purple-400" />
                    ) : (
                      <Maximize className="w-3.5 h-3.5 text-blue-400" />
                    )}
                    <span>{m.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right 8 Cols: Split-Screen Preview + Speaker Diarization Segments */}
        {selectedEpisode && (
          <div className="lg:col-span-8 rounded-xl bg-[#10131E] border border-[#1E2436] p-5 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#1E2436]">
              <div>
                <div className="text-xs text-slate-400">
                  {selectedEpisode.showTitle} · Episode {selectedEpisode.episodeNumber}
                </div>
                <h2 className="text-base font-display font-semibold text-white">
                  {selectedEpisode.episodeTitle}
                </h2>
              </div>
              <span className="text-xs font-mono tabular-nums text-purple-300">
                {selectedEpisode.segments.length} Diarized Viral Chapters
              </span>
            </div>

            <VideoPreviewFrame
              title={selectedEpisode.episodeTitle}
              aspectRatio={layoutMode === 'cinema_16_9' ? '16:9' : '9:16'}
              timecode="42:10 / 01:42:15"
              speakerLabel={selectedEpisode.speakers.join(' + ')}
              subtitleText={selectedEpisode.segments[0]?.transcriptSnippet}
              showFaceTracking={true}
              variant={
                layoutMode === 'split_screen_9_16' ? 'podcast_split' : 'keynote'
              }
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-display font-semibold text-slate-300 flex items-center gap-1.5">
                  <Mic2 className="w-4 h-4 text-purple-400" />
                  <span>Speaker Diarization Highlights (Whisper Local Contract)</span>
                </h3>
              </div>

              <div className="divide-y divide-[#1A1F30] border border-[#1E2436] rounded-xl overflow-hidden">
                {selectedEpisode.segments.map((segment) => (
                  <div
                    key={segment.id}
                    className="p-4 bg-[#0C0F19] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-white">
                          {segment.speakerName}
                        </span>
                        <span className="text-slate-400">· {segment.role}</span>
                        <span className="font-mono tabular-nums text-slate-400">
                          · {segment.startTime}–{segment.endTime}
                        </span>
                        <span className="font-mono tabular-nums text-purple-400 font-semibold">
                          · Hook {segment.highlightScore}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        "{segment.transcriptSnippet}"
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSliceSegment(segment)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-xs font-medium text-white shrink-0 self-start sm:self-center whitespace-nowrap"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                      <span>Create Podcast Clip</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
