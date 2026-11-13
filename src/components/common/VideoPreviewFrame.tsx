import React, { useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Focus } from 'lucide-react';
import { AspectRatioPreset } from '../../types/clipmatrix';

interface VideoPreviewFrameProps {
  title: string;
  aspectRatio: AspectRatioPreset;
  timecode?: string;
  durationSeconds?: number;
  subtitleText?: string;
  showSubtitles?: boolean;
  showFaceTracking?: boolean;
  speakerLabel?: string;
  variant?: 'keynote' | 'podcast_split' | 'livestream' | 'studio';
  compact?: boolean;
}

export const VideoPreviewFrame: React.FC<VideoPreviewFrameProps> = ({
  title,
  aspectRatio,
  timecode = '00:14 / 00:45',
  subtitleText = 'Every high-retention clip starts with an unmistakable visual hook.',
  showSubtitles = true,
  showFaceTracking = false,
  speakerLabel = 'Active Speaker',
  variant = 'keynote',
  compact = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const aspectContainerClass =
    aspectRatio === '9:16'
      ? compact
        ? 'w-36 aspect-[9/16]'
        : 'w-56 sm:w-64 aspect-[9/16]'
      : aspectRatio === '1:1'
      ? compact
        ? 'w-44 aspect-square'
        : 'w-64 sm:w-72 aspect-square'
      : 'w-full max-w-md aspect-video';

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div
        className={`${aspectContainerClass} relative rounded-xl bg-[#0D1017] border border-[#232838] overflow-hidden flex flex-col justify-between select-none group`}
      >
        {/* Simulated Studio Scene Canvas (SVG) */}
        <svg
          viewBox="0 0 400 400"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="studio-glow" cx="50%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#4C1D95" stopOpacity="0.45" />
              <stop offset="55%" stopColor="#1E3A8A" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#090A0F" stopOpacity="0.95" />
            </radialGradient>
            <linearGradient id="speaker-sil" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.3" />
            </linearGradient>
          </defs>

          <rect width="400" height="400" fill="url(#studio-glow)" />

          {/* Subtle Acoustic Panel Grid Lines */}
          <g stroke="#ffffff" strokeOpacity="0.04" strokeWidth="1">
            <line x1="0" y1="80" x2="400" y2="80" />
            <line x1="0" y1="160" x2="400" y2="160" />
            <line x1="0" y1="240" x2="400" y2="240" />
            <line x1="0" y1="320" x2="400" y2="320" />
            <line x1="100" y1="0" x2="100" y2="400" />
            <line x1="200" y1="0" x2="200" y2="400" />
            <line x1="300" y1="0" x2="300" y2="400" />
          </g>

          {variant === 'podcast_split' ? (
            <>
              {/* Split Screen Top & Bottom Speakers */}
              <line
                x1="0"
                y1="200"
                x2="400"
                y2="200"
                stroke="#8B5CF6"
                strokeOpacity="0.4"
                strokeWidth="2"
              />
              {/* Top Speaker Silhouette */}
              <circle cx="200" cy="85" r="34" fill="url(#speaker-sil)" />
              <path
                d="M140 185 C140 140 260 140 260 185"
                fill="url(#speaker-sil)"
              />
              {/* Bottom Speaker Silhouette */}
              <circle cx="200" cy="275" r="34" fill="url(#speaker-sil)" />
              <path
                d="M140 375 C140 330 260 330 260 375"
                fill="url(#speaker-sil)"
              />
            </>
          ) : (
            <>
              {/* Single Subject Silhouette + Studio Mic */}
              <circle cx="200" cy="145" r="46" fill="url(#speaker-sil)" />
              <path
                d="M115 310 C115 225 285 225 285 310"
                fill="url(#speaker-sil)"
              />
              {/* Broadcast Mic Boom */}
              <rect
                x="235"
                y="195"
                width="18"
                height="38"
                rx="9"
                fill="#1E293B"
                stroke="#60A5FA"
                strokeWidth="1.5"
              />
              <line
                x1="253"
                y1="215"
                x2="340"
                y2="255"
                stroke="#475569"
                strokeWidth="4"
              />
            </>
          )}
        </svg>

        {/* Top Frame Metadata Bar */}
        <div className="relative z-10 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/80 via-black/40 to-transparent text-[11px] font-mono text-slate-300">
          <span className="truncate max-w-[65%]">{speakerLabel}</span>
          <span className="tabular-nums text-purple-300">{aspectRatio}</span>
        </div>

        {/* Optional AI Face-Tracking Bounding Box */}
        {showFaceTracking && (
          <div
            className="relative z-10 mx-auto my-auto w-24 h-24 border border-blue-400/75 rounded-lg flex flex-col justify-between p-1.5 pointer-events-none"
            aria-label="Face tracking region active"
          >
            <div className="flex items-center justify-between text-[9px] font-mono text-blue-300">
              <span className="inline-flex items-center gap-0.5">
                <Focus className="w-2.5 h-2.5" /> TRACK
              </span>
              <span className="tabular-nums">99.2%</span>
            </div>
            <div className="text-[8px] font-mono text-blue-200/80 text-center">
              AUTO-CROP LOCK
            </div>
          </div>
        )}

        {/* Bottom Scrim + Burned-in Subtitle Preview + Transport Controls */}
        <div className="relative z-10 mt-auto px-3 pb-2.5 pt-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent space-y-2">
          {showSubtitles && subtitleText && (
            <div className="px-2 py-1 rounded bg-black/75 border border-white/10 text-center">
              <p className="text-xs font-display font-bold text-white leading-snug line-clamp-2">
                {subtitleText}
              </p>
            </div>
          )}

          {!compact && (
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsPlaying((prev) => !prev)}
                  aria-label={isPlaying ? `Pause preview ${title}` : `Play preview ${title}`}
                  className="p-1 rounded hover:bg-white/10 text-white transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="w-3.5 h-3.5 text-purple-400" />
                  ) : (
                    <Play className="w-3.5 h-3.5 text-white" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsMuted((prev) => !prev)}
                  aria-label={isMuted ? 'Unmute preview audio' : 'Mute preview audio'}
                  className="p-1 rounded hover:bg-white/10 text-slate-300 transition-colors"
                >
                  {isMuted ? (
                    <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-slate-300" />
                  )}
                </button>
                <span className="text-[10px] font-mono tabular-nums text-slate-300">
                  {isPlaying ? 'PLAYING' : timecode}
                </span>
              </div>
              <Maximize2 className="w-3 h-3 text-slate-400" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
