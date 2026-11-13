import React from 'react';
import {
  Upload,
  Scissors,
  ArrowUpRight,
  Radio,
  CheckCircle2,
  CalendarClock,
  Film,
  Sparkles,
} from 'lucide-react';
import {
  DashboardStatistics,
  GeneratedClip,
  NavigationPageId,
  PublishingActivityItem,
  StreamerProfile,
  VideoProject,
} from '../types/clipmatrix';

interface OverviewPageProps {
  stats: DashboardStatistics;
  projects: VideoProject[];
  clips: GeneratedClip[];
  streamers: StreamerProfile[];
  publishingActivity: PublishingActivityItem[];
  onNavigate: (page: NavigationPageId) => void;
  onSelectClipForStudio: (clipId: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  stats,
  projects,
  clips,
  streamers,
  publishingActivity,
  onNavigate,
  onSelectClipForStudio,
}) => {
  const kpiItems = [
    {
      label: 'Total Videos',
      value: stats.totalVideos,
      meta: 'Ingested sources · Sample Data',
      targetPage: 'long-video' as NavigationPageId,
    },
    {
      label: 'Generated Clips',
      value: stats.generatedClips,
      meta: '9:16, 16:9 & 1:1 cuts',
      targetPage: 'generated-clips' as NavigationPageId,
    },
    {
      label: 'Pending Approval',
      value: stats.pendingApproval,
      meta: 'Awaiting human review',
      targetPage: 'upload-approval' as NavigationPageId,
    },
    {
      label: 'Published Clips',
      value: stats.publishedClips,
      meta: 'YouTube, TikTok & IG',
      targetPage: 'analytics' as NavigationPageId,
    },
    {
      label: 'Active Live Streams',
      value: stats.activeLiveStreams,
      meta: 'Real-time buffer active',
      targetPage: 'live-streams' as NavigationPageId,
    },
    {
      label: 'Scheduled Posts',
      value: stats.scheduledPosts,
      meta: 'Queued in calendar',
      targetPage: 'content-calendar' as NavigationPageId,
    },
  ];

  const activeStreamers = streamers.filter((s) => s.status === 'LIVE');

  return (
    <div className="space-y-8">
      {/* Top Studio Header & Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-[#1C2030]">
        <div className="space-y-1">
          <div className="text-xs text-purple-400 font-medium">
            Phase 1 Foundation · Interactive Sample Data Workspace
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
            AI Video Clipping &amp; Publishing Command Center
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Monitor live creators, slice long-form videos and podcasts into high-retention cuts, generate bilingual captions, and approve every upload before it goes live.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('long-video')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#151928] hover:bg-[#1C2236] border border-[#262E45] text-xs font-medium text-white transition-colors whitespace-nowrap"
          >
            <Upload className="w-4 h-4 text-purple-400" />
            <span>Upload Video</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('long-video')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-xs font-medium text-white transition-colors whitespace-nowrap"
          >
            <Scissors className="w-4 h-4" />
            <span>Create AI Clips</span>
          </button>
        </div>
      </div>

      {/* 6 Core Statistics Grid */}
      <section aria-label="Studio Key Metrics">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {kpiItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onNavigate(item.targetPage)}
              className="text-left p-4 rounded-xl bg-[#10131E] border border-[#1E2436] hover:border-purple-500/40 transition-colors flex flex-col justify-between gap-3 group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors">
                  {item.label}
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 transition-colors shrink-0" />
              </div>
              <div>
                <div className="text-2xl font-display font-bold text-white font-mono tabular-nums">
                  {item.value}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 truncate">
                  {item.meta}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Main Two-Column Split: Recent Projects + Recently Generated Clips */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 7 Columns: Recently Generated Clips */}
        <section className="xl:col-span-7 rounded-xl bg-[#10131E] border border-[#1E2436] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1E2436] flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-display font-semibold text-white">
                Recently Generated Clips
              </h2>
              <p className="text-xs text-slate-400">
                Sample AI-extracted highlights with virality scores and approval status
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('generated-clips')}
              className="text-xs font-medium text-purple-400 hover:text-purple-300 whitespace-nowrap"
            >
              View All Clips
            </button>
          </div>

          <div className="divide-y divide-[#1A1F30]">
            {clips.slice(0, 5).map((clip) => (
              <div
                key={clip.id}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#141826] transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-mono tabular-nums text-purple-400 font-semibold">
                      Score {clip.viralityScore}%
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{clip.aspectRatio}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{clip.durationSeconds}s</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {clip.approvalStatus === 'pending_approval'
                        ? 'Pending Approval'
                        : clip.approvalStatus === 'approved'
                        ? 'Approved'
                        : clip.approvalStatus === 'published'
                        ? 'Published'
                        : clip.approvalStatus}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-white truncate">
                    {clip.title}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {clip.projectTitle} · {clip.startTimecode}–{clip.endTimecode} · {clip.createdAt}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectClipForStudio(clip.id);
                      onNavigate('ai-editing');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#181D2E] hover:bg-[#222940] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
                  >
                    Edit in Studio
                  </button>
                  {clip.approvalStatus === 'pending_approval' && (
                    <button
                      type="button"
                      onClick={() => onNavigate('upload-approval')}
                      className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-xs font-medium text-purple-200 transition-colors whitespace-nowrap"
                    >
                      Review
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right 5 Columns: Recent Video Projects */}
        <section className="xl:col-span-5 rounded-xl bg-[#10131E] border border-[#1E2436] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1E2436] flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-display font-semibold text-white">
                Recent Source Projects
              </h2>
              <p className="text-xs text-slate-400">
                YouTube, Drive, Podcast &amp; Livestream VOD inputs
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('long-video')}
              className="text-xs font-medium text-purple-400 hover:text-purple-300 whitespace-nowrap"
            >
              Add Source
            </button>
          </div>

          <div className="divide-y divide-[#1A1F30]">
            {projects.slice(0, 5).map((project) => (
              <div
                key={project.id}
                className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[#141826] transition-colors"
              >
                <div className="min-w-0 space-y-1">
                  <div className="text-sm font-medium text-white truncate">
                    {project.title}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{project.sourceType.replace('_', ' ')}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{project.durationFormatted}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{project.clipsCount} clips</span>
                  </div>
                </div>
                <span className="text-xs font-mono text-slate-400 shrink-0">
                  {project.createdAt}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Bottom Split: Active Streamers + Recent Publishing Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Active Streamers (6 cols) */}
        <section className="lg:col-span-6 rounded-xl bg-[#10131E] border border-[#1E2436] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1E2436] flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              <h2 className="text-base font-display font-semibold text-white">
                Active Streamers ({activeStreamers.length} LIVE)
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('my-streamers')}
              className="text-xs font-medium text-purple-400 hover:text-purple-300 whitespace-nowrap"
            >
              Manage Streamers
            </button>
          </div>

          <div className="divide-y divide-[#1A1F30]">
            {streamers.slice(0, 4).map((streamer) => (
              <div
                key={streamer.id}
                className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[#141826] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center font-display font-bold text-xs text-white shrink-0 border border-white/10"
                    style={{ backgroundColor: `${streamer.accentColor}30` }}
                  >
                    {streamer.avatarInitials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">
                        {streamer.name}
                      </span>
                      <span className="text-xs text-slate-400">
                        · {streamer.platform}
                      </span>
                      <span
                        className={`text-[11px] font-mono font-semibold ${
                          streamer.status === 'LIVE' ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        · {streamer.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {streamer.currentStreamTitle}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-mono tabular-nums text-slate-200">
                    {streamer.status === 'LIVE' ? streamer.currentDuration : streamer.lastLiveTime}
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-500">
                    {streamer.clipsGeneratedCount} clips extracted
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Publishing Activity (6 cols) */}
        <section className="lg:col-span-6 rounded-xl bg-[#10131E] border border-[#1E2436] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1E2436] flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
              <h2 className="text-base font-display font-semibold text-white">
                Recent Publishing Activity
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('upload-approval')}
              className="text-xs font-medium text-purple-400 hover:text-purple-300 whitespace-nowrap"
            >
              Open Approval Queue
            </button>
          </div>

          <div className="divide-y divide-[#1A1F30]">
            {publishingActivity.map((act) => (
              <div
                key={act.id}
                className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[#141826] transition-colors"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-semibold text-slate-200">{act.action}</span>
                    <span aria-hidden="true">·</span>
                    <span className="uppercase font-mono">{act.platform}</span>
                    <span aria-hidden="true">·</span>
                    <span>{act.actor}</span>
                  </div>
                  <div className="text-sm font-medium text-white truncate">
                    {act.clipTitle}
                  </div>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
                  {act.timestamp}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Quick Studio Workflow Strip */}
      <section className="rounded-xl bg-[#10131E] border border-[#1E2436] p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-display font-semibold text-white">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Need bilingual captions or scheduled cross-posting?</span>
          </div>
          <p className="text-xs text-slate-400">
            Jump directly to Caption Studio for English, Urdu, and Roman Urdu hooks, or inspect your weekly Content Calendar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('caption-studio')}
            className="px-3.5 py-2 rounded-lg bg-[#161B2B] hover:bg-[#1E253A] border border-[#262F49] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
          >
            Open Caption Studio
          </button>
          <button
            type="button"
            onClick={() => onNavigate('content-calendar')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#161B2B] hover:bg-[#1E253A] border border-[#262F49] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
          >
            <CalendarClock className="w-3.5 h-3.5 text-blue-400" />
            <span>View Content Calendar</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('podcast-clips')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#161B2B] hover:bg-[#1E253A] border border-[#262F49] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
          >
            <Film className="w-3.5 h-3.5 text-purple-400" />
            <span>Podcast Split-Screen</span>
          </button>
        </div>
      </section>
    </div>
  );
};
