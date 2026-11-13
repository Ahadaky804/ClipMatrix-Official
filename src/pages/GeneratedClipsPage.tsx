import React, { useState, useRef } from 'react';
import {
  Wand2,
  CheckCircle2,
  Search,
  Filter,
  Download,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  ApprovalStatus,
  AspectRatioPreset,
  GeneratedClip,
  NavigationPageId,
} from '../types/clipmatrix';
import { filterClips } from '../utils/clipLogic';
import { VideoPreviewFrame } from '../components/common/VideoPreviewFrame';

interface GeneratedClipsPageProps {
  clips: GeneratedClip[];
  onSelectClipForStudio: (clipId: string) => void;
  onRefreshWorkspace?: () => Promise<void>;
  onDeleteClip?: (clip: GeneratedClip) => Promise<void>;
  onNavigate: (page: NavigationPageId) => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const GeneratedClipsPage: React.FC<GeneratedClipsPageProps> = ({
  clips,
  onSelectClipForStudio,
  onRefreshWorkspace,
  onDeleteClip,
  onNavigate,
}) => {
  const [aspectFilter, setAspectFilter] = useState<AspectRatioPreset | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'all'>('all');
  const [localSearch, setLocalSearch] = useState('');
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState<string>('');
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  const filtered = filterClips(clips, {
    searchQuery: localSearch,
    aspectRatio: aspectFilter,
    approvalStatus: statusFilter,
  });

  const handlePlayPreview = (clipId: string) => {
    const v = videoRefs.current[clipId];
    if (v) {
      v.scrollIntoView({ behavior: 'smooth', block: 'center' });
      v.currentTime = 0;
      v.play().catch(() => {});
    }
  };

  const handleRegenerate = async (clip: GeneratedClip) => {
    if (!clip.dbId) return;
    setRegeneratingId(clip.id);
    setBannerMsg('');
    try {
      const res = await fetch(`/api/clips/${clip.dbId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aspectRatio: clip.aspectRatio,
          subtitlesEnabled: clip.subtitlesEnabled ?? true,
          subtitleStyle: clip.subtitleStyle || 'bold_hormozi',
          smartReframing: clip.smartReframing ?? true,
          faceTracking: clip.faceTracking ?? true,
        }),
      });
      if (res.ok && onRefreshWorkspace) {
        await onRefreshWorkspace();
        setBannerMsg(`Regenerated "${clip.title}" (${clip.aspectRatio}) via FFmpeg.`);
      }
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleDelete = async (clip: GeneratedClip) => {
    if (!onDeleteClip) return;
    setDeletingId(clip.id);
    setBannerMsg('');
    try {
      await onDeleteClip(clip);
      setBannerMsg(`Deleted clip "${clip.title}".`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#1C2030]">
        <div>
          <div className="text-xs text-purple-400 font-medium">
            Rendered FFmpeg MP4 Assets &amp; Short-Form Clip Library
          </div>
          <h1 className="text-2xl font-display font-bold text-white">
            Generated Clips ({filtered.length})
          </h1>
          <p className="text-sm text-slate-400">
            Play real FFmpeg-rendered MP4 Shorts, inspect AI captions and hashtags, download files to your device, regenerate clips, or send to Upload Approval.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('long-video')}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-xs font-medium text-white self-start whitespace-nowrap"
        >
          Generate More Shorts
        </button>
      </div>

      {bannerMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-200 flex items-center justify-between">
          <span>{bannerMsg}</span>
          <button
            type="button"
            onClick={() => setBannerMsg('')}
            className="underline text-emerald-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-[#10131E] border border-[#1E2436] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="search"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Filter clips by title, original video, or caption text..."
            aria-label="Filter clips by title, original video, or caption text"
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs text-white placeholder:text-slate-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0C0E17] border border-[#22283B]">
            {(['all', '9:16', '16:9', '1:1'] as const).map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => setAspectFilter(ratio)}
                className={`px-2.5 py-1 rounded text-xs font-mono ${
                  aspectFilter === ratio
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {ratio === 'all' ? 'All Ratios' : ratio}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0C0E17] border border-[#22283B]">
            {(
              [
                { id: 'all', label: 'All Statuses' },
                { id: 'pending_approval', label: 'Pending' },
                { id: 'approved', label: 'Approved' },
                { id: 'published', label: 'Published' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`px-2.5 py-1 rounded text-xs ${
                  statusFilter === st.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Clips Grid */}
      {filtered.length === 0 ? (
        <div className="p-12 rounded-xl bg-[#10131E] border border-[#1E2436] text-center space-y-3">
          <Filter className="w-8 h-8 text-slate-500 mx-auto" />
          <h2 className="text-base font-display font-semibold text-white">
            No Generated Clips Match Your Filters
          </h2>
          <p className="text-xs text-slate-400">
            Reset the aspect ratio or status filters to inspect all generated clips.
          </p>
          <button
            type="button"
            onClick={() => {
              setAspectFilter('all');
              setStatusFilter('all');
              setLocalSearch('');
            }}
            className="px-4 py-2 rounded-lg bg-purple-600 text-xs font-medium text-white"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((clip) => {
            const tags =
              clip.hashtagsList && clip.hashtagsList.length > 0
                ? clip.hashtagsList
                : (clip.hashtags || '#Shorts #ClipMatrix #Reels #Viral').split(' ');
            const isRegenerating = regeneratingId === clip.id;
            const isDeleting = deletingId === clip.id;

            return (
              <div
                key={clip.id}
                data-testid={`generated-clip-card-${clip.id}`}
                className="rounded-xl bg-[#10131E] border border-[#1E2436] p-4 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-400 font-mono tabular-nums">
                    <span className="text-purple-400 font-semibold">
                      Hook {clip.viralityScore}%
                    </span>
                    <span>
                      {clip.aspectRatio} · {clip.durationSeconds}s · {clip.startTimecode}–{clip.endTimecode}
                    </span>
                  </div>

                  {clip.clipUrl ? (
                    <div className="space-y-2">
                      <div className="rounded-lg overflow-hidden bg-black border border-[#22283B]">
                        <video
                          ref={(el) => {
                            videoRefs.current[clip.id] = el;
                          }}
                          controls
                          preload="metadata"
                          poster={clip.thumbnailUrl}
                          src={clip.clipUrl}
                          className="w-full h-56 object-contain bg-black"
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400">
                        <div className="flex items-center gap-2">
                          {clip.thumbnailUrl && (
                            <img
                              src={clip.thumbnailUrl}
                              alt={`${clip.title} thumbnail`}
                              className="w-6 h-6 rounded object-cover border border-[#262F47]"
                            />
                          )}
                          <span>Rendered MP4 · {clip.aspectRatio}</span>
                        </div>
                        <span>{formatBytes(clip.fileSizeBytes)}</span>
                      </div>
                    </div>
                  ) : (
                    <VideoPreviewFrame
                      title={clip.title}
                      aspectRatio="16:9"
                      timecode={`${clip.startTimecode} – ${clip.endTimecode}`}
                      speakerLabel={`${clip.aspectRatio} Frame · ${clip.speakerLabel || 'Clip'}`}
                      subtitleText={clip.editConfig.thumbnailHeadline}
                      compact={true}
                    />
                  )}

                  <div className="space-y-1">
                    <h3 className="text-sm font-display font-semibold text-white line-clamp-2">
                      {clip.title}
                    </h3>
                    <p className="text-xs text-slate-400 truncate">
                      Original Video: <span className="text-slate-200">{clip.projectTitle}</span>
                    </p>
                    <p className="text-xs text-slate-300 line-clamp-2 pt-1">
                      {clip.captionText}
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {tags.map((t, idx) => (
                        <span
                          key={`${clip.id}-tag-${idx}`}
                          className="text-[11px] font-mono text-blue-400"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#1D2336] space-y-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {clip.clipUrl && (
                      <button
                        type="button"
                        onClick={() => handlePlayPreview(clip.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/40 text-xs text-purple-200"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Play Preview</span>
                      </button>
                    )}

                    {clip.clipUrl && (
                      <a
                        href={
                          clip.dbId
                            ? `/api/clips/${clip.dbId}/download`
                            : clip.clipUrl
                        }
                        download
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/40 text-xs text-emerald-200"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        onSelectClipForStudio(clip.id);
                        onNavigate('ai-editing');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161B2C] hover:bg-[#1F263E] text-xs text-slate-200"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-purple-400" />
                      <span>Edit</span>
                    </button>

                    {clip.dbId && (
                      <button
                        type="button"
                        disabled={isRegenerating}
                        onClick={() => handleRegenerate(clip)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161B2C] hover:bg-[#1F263E] text-xs text-blue-300 disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`}
                        />
                        <span>{isRegenerating ? '...' : 'Regenerate'}</span>
                      </button>
                    )}

                    {onDeleteClip && (
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => handleDelete(clip)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-500/30 text-xs text-red-300 ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{isDeleting ? '...' : 'Delete'}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>Status: {clip.approvalStatus.replace('_', ' ')}</span>
                    <button
                      type="button"
                      onClick={() => onNavigate('upload-approval')}
                      className="inline-flex items-center gap-1 text-purple-300 hover:underline"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Review in Approval Queue</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
