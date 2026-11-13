import React, { useState } from 'react';
import {
  CalendarDays,
  Plus,
  Clock,
  Trash2,
  Check,
} from 'lucide-react';
import {
  GeneratedClip,
  ScheduledPost,
  SocialPlatform,
} from '../types/clipmatrix';

interface ContentCalendarPageProps {
  scheduledPosts: ScheduledPost[];
  clips: GeneratedClip[];
  onAddScheduledPost: (post: Omit<ScheduledPost, 'id'>) => void;
  onRemoveScheduledPost: (id: string) => void;
}

export const ContentCalendarPage: React.FC<ContentCalendarPageProps> = ({
  scheduledPosts,
  clips,
  onAddScheduledPost,
  onRemoveScheduledPost,
}) => {
  const [selectedClipId, setSelectedClipId] = useState<string>(
    clips[0]?.id || ''
  );
  const [platform, setPlatform] = useState<SocialPlatform>('youtube');
  const [scheduledDate, setScheduledDate] = useState<string>('2026-11-17');
  const [scheduledTime, setScheduledTime] = useState<string>('18:30');
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | 'all'>('all');
  const [confirmationMsg, setConfirmationMsg] = useState<string>('');

  const visiblePosts = scheduledPosts.filter((p) =>
    platformFilter === 'all' ? true : p.platform === platformFilter
  );

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetClip = clips.find((c) => c.id === selectedClipId) || clips[0];
    if (!targetClip) return;

    onAddScheduledPost({
      clipId: targetClip.id,
      clipTitle: targetClip.title,
      platform,
      scheduledDate,
      scheduledTime,
      aspectRatio: targetClip.aspectRatio,
      status: 'scheduled',
      captionPreview: targetClip.captionText.slice(0, 90),
    });

    setConfirmationMsg(
      `Scheduled "${targetClip.title}" for ${platform.toUpperCase()} on ${scheduledDate} at ${scheduledTime}.`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#1C2030]">
        <div>
          <div className="text-xs text-purple-400 font-medium">
            Cross-Platform Distribution Queue · Celery Beat Ready
          </div>
          <h1 className="text-2xl font-display font-bold text-white">
            Content Calendar
          </h1>
          <p className="text-sm text-slate-400">
            Coordinate scheduled short-form releases across YouTube Shorts, Instagram Reels, and TikTok.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#121522] border border-[#22283B] self-start">
          {(['all', 'youtube', 'instagram', 'tiktok'] as const).map((pf) => (
            <button
              key={pf}
              type="button"
              onClick={() => setPlatformFilter(pf)}
              className={`px-3 py-1.5 rounded text-xs font-medium uppercase transition-colors ${
                platformFilter === pf
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {pf}
            </button>
          ))}
        </div>
      </div>

      {confirmationMsg && (
        <div
          role="status"
          className="px-4 py-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2"
        >
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{confirmationMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 4 Cols: Schedule New Post Form */}
        <form
          onSubmit={handleScheduleSubmit}
          className="xl:col-span-4 rounded-xl bg-[#10131E] border border-[#1E2436] p-5 space-y-4"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-[#1E2436]">
            <Plus className="w-4 h-4 text-purple-400" />
            <h2 className="text-base font-display font-semibold text-white">
              Schedule Clip Release
            </h2>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cal-clip-select" className="block text-xs font-medium text-slate-300">
              Select Clip
            </label>
            <select
              id="cal-clip-select"
              value={selectedClipId}
              onChange={(e) => setSelectedClipId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs text-white"
            >
              {clips.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.aspectRatio})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Destination Platform
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['youtube', 'instagram', 'tiktok'] as SocialPlatform[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={`py-2 rounded-lg text-xs font-medium uppercase border ${
                    platform === p
                      ? 'bg-purple-600/25 border-purple-500 text-white'
                      : 'bg-[#0C0E17] border-[#22283B] text-slate-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="cal-date" className="block text-xs font-medium text-slate-300">
                Release Date
              </label>
              <input
                id="cal-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs font-mono text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="cal-time" className="block text-xs font-medium text-slate-300">
                Release Time (UTC)
              </label>
              <input
                id="cal-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs font-mono text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-xs font-semibold text-white transition-colors"
          >
            Add to Publishing Calendar
          </button>
        </form>

        {/* Right 8 Cols: Upcoming Scheduled Slots */}
        <div className="xl:col-span-8 space-y-3">
          {visiblePosts.length === 0 ? (
            <div className="p-10 rounded-xl bg-[#10131E] border border-[#1E2436] text-center space-y-2">
              <CalendarDays className="w-7 h-7 text-slate-500 mx-auto" />
              <div className="text-sm font-semibold text-white">
                No Scheduled Releases in This View
              </div>
              <p className="text-xs text-slate-400">
                Use the form on the left to queue your next short-form video drop.
              </p>
            </div>
          ) : (
            visiblePosts.map((post) => (
              <div
                key={post.id}
                className="p-4 rounded-xl bg-[#10131E] border border-[#1E2436] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-white font-semibold">
                      {post.scheduledDate} at {post.scheduledTime}
                    </span>
                    <span>·</span>
                    <span className="uppercase text-blue-400">{post.platform}</span>
                    <span>·</span>
                    <span>{post.aspectRatio}</span>
                    <span>·</span>
                    <span
                      className={
                        post.status === 'published'
                          ? 'text-emerald-400'
                          : 'text-amber-300'
                      }
                    >
                      {post.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="text-sm font-display font-semibold text-white truncate">
                    {post.clipTitle}
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {post.captionPreview}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveScheduledPost(post.id)}
                  aria-label={`Remove scheduled post ${post.clipTitle}`}
                  className="p-2 rounded-lg bg-[#161B2B] hover:bg-red-950/60 border border-[#252D44] text-slate-400 hover:text-red-300 shrink-0 self-end sm:self-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
