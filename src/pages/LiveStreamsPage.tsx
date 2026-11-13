import React, { useState } from 'react';
import {
  Radio,
  Scissors,
  Sliders,
  Check,
  Users,
  Activity,
  Sparkles,
} from 'lucide-react';
import {
  LiveStreamSession,
  NavigationPageId,
} from '../types/clipmatrix';
import { VideoPreviewFrame } from '../components/common/VideoPreviewFrame';

interface LiveStreamsPageProps {
  liveSessions: LiveStreamSession[];
  onToggleAutoCapture: (sessionId: string) => void;
  onTriggerInstantClip: (sessionId: string, spikeLabel: string) => void;
  onNavigate: (page: NavigationPageId) => void;
}

export const LiveStreamsPage: React.FC<LiveStreamsPageProps> = ({
  liveSessions,
  onToggleAutoCapture,
  onTriggerInstantClip,
  onNavigate,
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    liveSessions[0]?.id || ''
  );
  const [bufferDurationSec, setBufferDurationSec] = useState<number>(45);
  const [recentActionMessage, setRecentActionMessage] = useState<string>('');

  const selectedSession =
    liveSessions.find((s) => s.id === selectedSessionId) || liveSessions[0];

  const handleManualSlice = (session: LiveStreamSession, label: string) => {
    onTriggerInstantClip(session.id, label);
    setRecentActionMessage(
      `Sliced ${bufferDurationSec}s clip "${label}" from ${session.streamerName} and sent to Generated Clips.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#1C2030]">
        <div>
          <div className="text-xs text-emerald-400 font-medium">
            Live Ingestion Monitor · Sample Stream Buffer
          </div>
          <h1 className="text-2xl font-display font-bold text-white">
            Live Streams &amp; Highlight Buffer
          </h1>
          <p className="text-sm text-slate-400">
            Inspect active creator broadcasts, monitor audio/chat excitement spikes, and trigger instant rolling-buffer clips.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#121522] border border-[#22283B]">
            {[15, 30, 45, 60].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setBufferDurationSec(sec)}
                className={`px-2.5 py-1 rounded text-xs font-mono tabular-nums transition-colors ${
                  bufferDurationSec === sec
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {sec}s Buffer
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('my-streamers')}
            className="px-3.5 py-2 rounded-lg bg-[#151928] hover:bg-[#1C2236] border border-[#262E45] text-xs font-medium text-white whitespace-nowrap"
          >
            Configure Streamers
          </button>
        </div>
      </div>

      {recentActionMessage && (
        <div
          role="status"
          className="px-4 py-3 rounded-xl bg-emerald-950/50 border border-emerald-500/35 flex items-center justify-between gap-3 text-xs text-emerald-200"
        >
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{recentActionMessage}</span>
          </span>
          <button
            type="button"
            onClick={() => onNavigate('generated-clips')}
            className="underline font-medium text-emerald-300 hover:text-white whitespace-nowrap"
          >
            View in Generated Clips
          </button>
        </div>
      )}

      {liveSessions.length === 0 ? (
        <div className="p-12 rounded-xl bg-[#10131E] border border-[#1E2436] text-center space-y-3">
          <Radio className="w-8 h-8 text-slate-500 mx-auto" />
          <h2 className="text-base font-display font-semibold text-white">
            No Streamers Are Live Right Now
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Add creators to your monitoring roster or enable auto-wake triggers in My Streamers.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('my-streamers')}
            className="px-4 py-2 rounded-lg bg-purple-600 text-xs font-medium text-white"
          >
            Manage Streamer Roster
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 5 Cols: Active Broadcast List */}
          <div className="lg:col-span-5 space-y-3">
            <h2 className="text-sm font-display font-semibold text-slate-300">
              Active Monitored Broadcasts ({liveSessions.length})
            </h2>
            {liveSessions.map((session) => {
              const isSelected = selectedSession?.id === session.id;
              return (
                <div
                  key={session.id}
                  onClick={() => setSelectedSessionId(session.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedSessionId(session.id);
                    }
                  }}
                  className={`p-4 rounded-xl border transition-colors cursor-pointer space-y-3 ${
                    isSelected
                      ? 'bg-[#141828] border-purple-500/50'
                      : 'bg-[#10131E] border-[#1E2436] hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-white">
                        {session.streamerName}
                      </span>
                      <span className="text-slate-400">· {session.platform}</span>
                      <span className="font-mono text-emerald-400 font-semibold">
                        · LIVE
                      </span>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-slate-300">
                      {session.duration}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-slate-200 line-clamp-2">
                    {session.streamTitle}
                  </p>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#1D2336] text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      {session.viewerCount.toLocaleString()} watching
                    </span>
                    <span className="font-mono tabular-nums text-purple-300">
                      {session.detectedMomentsCount} highlight spikes
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right 7 Cols: Selected Live Stream Inspector & Spike Timeline */}
          {selectedSession && (
            <div className="lg:col-span-7 rounded-xl bg-[#10131E] border border-[#1E2436] p-5 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1E2436]">
                <div>
                  <div className="text-xs text-slate-400">
                    {selectedSession.streamerName} ({selectedSession.streamerHandle}) · Started {selectedSession.startedAt}
                  </div>
                  <h3 className="text-base font-display font-semibold text-white mt-0.5">
                    {selectedSession.streamTitle}
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleAutoCapture(selectedSession.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                      selectedSession.autoCaptureActive
                        ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-200'
                        : 'bg-[#171B2A] border-[#262E45] text-slate-300'
                    }`}
                  >
                    {selectedSession.autoCaptureActive
                      ? 'Auto-Highlight: ON'
                      : 'Auto-Highlight: PAUSED'}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleManualSlice(
                        selectedSession,
                        `Live Buffer Slice (${selectedSession.duration})`
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-xs font-medium text-white whitespace-nowrap"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Clip Last {bufferDurationSec}s</span>
                  </button>
                </div>
              </div>

              {/* Stream Preview Frame */}
              <VideoPreviewFrame
                title={selectedSession.streamTitle}
                aspectRatio="16:9"
                timecode={`LIVE · ${selectedSession.duration}`}
                speakerLabel={`${selectedSession.streamerName} · ${selectedSession.platform}`}
                subtitleText="Real-time Whisper transcript buffer active — detecting vocal inflection spikes..."
                showFaceTracking={true}
                variant="livestream"
              />

              {/* Detected AI Highlight Spikes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-display font-semibold text-slate-300 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-purple-400" />
                    <span>Detected Highlight Moments (Rolling HLS Buffer)</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Click any spike to extract {bufferDurationSec}s vertical cut
                  </span>
                </div>

                <div className="divide-y divide-[#1A1F30] border border-[#1E2436] rounded-lg overflow-hidden">
                  {selectedSession.recentSpikes.map((spike) => (
                    <div
                      key={spike.timestamp}
                      className="px-4 py-3 bg-[#0D101A] flex items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-medium text-white">
                          {spike.label}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-400">
                          Stream Timecode: {spike.timestamp} · AI Hook Score: {spike.confidence}%
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleManualSlice(selectedSession, spike.label)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181D2E] hover:bg-purple-600/30 border border-[#283048] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span>Extract {bufferDurationSec}s Clip</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
