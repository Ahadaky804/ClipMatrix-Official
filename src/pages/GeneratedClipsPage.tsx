import React, { useState } from 'react';
import {
  Wand2,
  MessageSquareQuote,
  CheckCircle2,
  Search,
  Filter,
  Download,
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
  onNavigate,
}) => {
  const [aspectFilter, setAspectFilter] = useState<AspectRatioPreset | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'all'>('all');
  const [localSearch, setLocalSearch] = useState('');

  const filtered = filterClips(clips, {
    searchQuery: localSearch,
    aspectRatio: aspectFilter,
    approvalStatus: statusFilter,
  });

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
            Play real FFmpeg-rendered MP4 clips, download files to your device, filter by aspect ratio or approval status, or send clips to Caption Studio and Upload Approval.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('long-video')}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-xs font-medium text-white self-start whitespace-nowrap"
        >
          Generate More Clips
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-[#10131E] border border-[#1E2436] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="search"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Filter clips by title, project, or caption text..."
            aria-label="Filter clips by title, project, or caption text"
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
          {filtered.map((clip) => (
            <div
              key={clip.id}
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
                  <div className="space-y-1.5">
                    <div className="rounded-lg overflow-hidden bg-black border border-[#22283B]">
                      <video
                        controls
                        preload="metadata"
                        poster={clip.thumbnailUrl}
                        src={clip.clipUrl}
                        className="w-full h-52 object-contain bg-black"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400">
                      <span>Rendered MP4 · {clip.aspectRatio}</span>
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
                    Source: {clip.projectTitle}
                  </p>
                  <p className="text-xs text-slate-300 line-clamp-2 pt-1">
                    {clip.captionText}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-[#1D2336] flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-slate-400">
                  Status: {clip.approvalStatus.replace('_', ' ')}
                </span>

                <div className="flex flex-wrap items-center gap-1.5">
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
                  <button
                    type="button"
                    onClick={() => {
                      onSelectClipForStudio(clip.id);
                      onNavigate('caption-studio');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161B2C] hover:bg-[#1F263E] text-xs text-slate-200"
                  >
                    <MessageSquareQuote className="w-3.5 h-3.5 text-blue-400" />
                    <span>Captions</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('upload-approval')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/30 text-xs text-purple-200"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
