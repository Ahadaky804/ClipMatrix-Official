import React, { useState } from 'react';
import {
  UserPlus,
  Bell,
  BellOff,
  Pause,
  Play,
  Trash2,
  Radio,
  AlertCircle,
} from 'lucide-react';
import { StreamerProfile } from '../types/clipmatrix';
import { validateStreamerInput } from '../utils/clipLogic';

interface MyStreamersPageProps {
  streamers: StreamerProfile[];
  onAddStreamer: (streamer: Omit<StreamerProfile, 'id'>) => void;
  onTogglePauseStreamer: (id: string) => void;
  onToggleNotifications: (id: string) => void;
  onRemoveStreamer: (id: string) => void;
}

export const MyStreamersPage: React.FC<MyStreamersPageProps> = ({
  streamers,
  onAddStreamer,
  onTogglePauseStreamer,
  onToggleNotifications,
  onRemoveStreamer,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LIVE' | 'OFFLINE'>('ALL');
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [platform, setPlatform] = useState<'YouTube' | 'Twitch' | 'Kick'>('YouTube');
  const [autoClipThreshold, setAutoClipThreshold] = useState<number>(85);
  const [formError, setFormError] = useState<string>('');

  const filteredStreamers = streamers.filter((s) =>
    statusFilter === 'ALL' ? true : s.status === statusFilter
  );

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateStreamerInput({
      name,
      handle,
      platform,
      autoClipThreshold,
    });
    if (!validation.valid) {
      setFormError(validation.error || 'Invalid streamer details.');
      return;
    }

    setFormError('');
    const formattedHandle = handle.trim().startsWith('@')
      ? handle.trim()
      : `@${handle.trim()}`;
    const initials = name
      .trim()
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    onAddStreamer({
      name: name.trim(),
      handle: formattedHandle,
      platform,
      avatarInitials: initials || 'ST',
      accentColor: '#8B5CF6',
      status: 'LIVE',
      currentStreamTitle: `${name.trim()} Live Broadcast — Auto-Monitoring Enabled`,
      currentDuration: '00:12:30',
      lastLiveTime: 'Live now',
      isMonitoring: true,
      isPaused: false,
      notificationsEnabled: true,
      clipsGeneratedCount: 0,
      autoClipThreshold,
    });

    setName('');
    setHandle('');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#1C2030]">
        <div>
          <div className="text-xs text-purple-400 font-medium">
            Automated Creator Roster · Multi-Channel Polling
          </div>
          <h1 className="text-2xl font-display font-bold text-white">
            My Streamers
          </h1>
          <p className="text-sm text-slate-400">
            Track multiple creators across YouTube, Twitch, and Kick with LIVE/OFFLINE status, pause controls, and notification triggers.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#121522] border border-[#22283B] self-start">
          {(['ALL', 'LIVE', 'OFFLINE'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === tab
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab === 'ALL'
                ? `All (${streamers.length})`
                : tab === 'LIVE'
                ? `LIVE (${streamers.filter((s) => s.status === 'LIVE').length})`
                : `OFFLINE (${streamers.filter((s) => s.status === 'OFFLINE').length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 4 Cols: Add Streamer Form */}
        <form
          onSubmit={handleCreateSubmit}
          className="xl:col-span-4 rounded-xl bg-[#10131E] border border-[#1E2436] p-5 space-y-4"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-[#1E2436]">
            <UserPlus className="w-4 h-4 text-purple-400" />
            <h2 className="text-base font-display font-semibold text-white">
              Add Streamer to Monitor
            </h2>
          </div>

          {formError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-950/50 border border-red-500/40 text-xs text-red-200 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="streamer-name" className="block text-xs font-medium text-slate-300">
              Creator Display Name
            </label>
            <input
              id="streamer-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tariq Mahmood"
              className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="streamer-handle" className="block text-xs font-medium text-slate-300">
              Channel Handle
            </label>
            <input
              id="streamer-handle"
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="e.g. @tariq_tech"
              className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="streamer-platform" className="block text-xs font-medium text-slate-300">
                Platform
              </label>
              <select
                id="streamer-platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as 'YouTube' | 'Twitch' | 'Kick')}
                className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-sm text-white focus:outline-none focus:border-purple-500"
              >
                <option value="YouTube">YouTube</option>
                <option value="Twitch">Twitch</option>
                <option value="Kick">Kick</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="streamer-threshold" className="block text-xs font-medium text-slate-300">
                Min Virality Score (%)
              </label>
              <input
                id="streamer-threshold"
                type="number"
                min={50}
                max={99}
                value={autoClipThreshold}
                onChange={(e) => setAutoClipThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-sm font-mono tabular-nums text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-xs font-medium text-white transition-colors"
          >
            Start Monitoring Streamer
          </button>
        </form>

        {/* Right 8 Cols: Streamer Roster Table/Cards */}
        <div className="xl:col-span-8 space-y-3">
          {filteredStreamers.length === 0 ? (
            <div className="p-10 rounded-xl bg-[#10131E] border border-[#1E2436] text-center space-y-2">
              <Radio className="w-7 h-7 text-slate-500 mx-auto" />
              <div className="text-sm font-semibold text-white">
                No Streamers Match Filter "{statusFilter}"
              </div>
              <p className="text-xs text-slate-400">
                Switch filter tabs or add a new creator on the left.
              </p>
            </div>
          ) : (
            filteredStreamers.map((streamer) => (
              <div
                key={streamer.id}
                className="p-4 rounded-xl bg-[#10131E] border border-[#1E2436] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center font-display font-bold text-xs text-white shrink-0 border border-white/10"
                    style={{ backgroundColor: `${streamer.accentColor}30` }}
                  >
                    {streamer.avatarInitials}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-sm font-display font-semibold text-white">
                        {streamer.name}
                      </span>
                      <span className="text-slate-400 font-mono">{streamer.handle}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-slate-300">{streamer.platform}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span
                        className={`font-mono font-semibold ${
                          streamer.status === 'LIVE' ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {streamer.status}
                      </span>
                      {streamer.isPaused && (
                        <span className="text-amber-400 font-mono">· PAUSED</span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 truncate">
                      {streamer.currentStreamTitle}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono tabular-nums text-slate-400">
                      <span>
                        Duration: {streamer.status === 'LIVE' ? streamer.currentDuration : '00:00:00'}
                      </span>
                      <span>·</span>
                      <span>Last live: {streamer.lastLiveTime}</span>
                      <span>·</span>
                      <span>{streamer.clipsGeneratedCount} clips</span>
                      <span>·</span>
                      <span>Threshold: {streamer.autoClipThreshold}%</span>
                    </div>
                  </div>
                </div>

                {/* Controls: Pause/Resume, Notifications, Remove */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => onTogglePauseStreamer(streamer.id)}
                    aria-label={
                      streamer.isPaused
                        ? `Resume monitoring ${streamer.name}`
                        : `Pause monitoring ${streamer.name}`
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161B2B] hover:bg-[#1E253A] border border-[#252D44] text-xs font-medium text-slate-200 transition-colors"
                  >
                    {streamer.isPaused ? (
                      <>
                        <Play className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Resume</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-3.5 h-3.5 text-amber-400" />
                        <span>Pause</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleNotifications(streamer.id)}
                    aria-label={
                      streamer.notificationsEnabled
                        ? `Mute notifications for ${streamer.name}`
                        : `Enable notifications for ${streamer.name}`
                    }
                    className="p-2 rounded-lg bg-[#161B2B] hover:bg-[#1E253A] border border-[#252D44] text-slate-300 hover:text-white transition-colors"
                  >
                    {streamer.notificationsEnabled ? (
                      <Bell className="w-4 h-4 text-purple-400" />
                    ) : (
                      <BellOff className="w-4 h-4 text-slate-500" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onRemoveStreamer(streamer.id)}
                    aria-label={`Remove ${streamer.name}`}
                    className="p-2 rounded-lg bg-[#161B2B] hover:bg-red-950/60 border border-[#252D44] hover:border-red-500/40 text-slate-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
