import React, { useState } from 'react';
import {
  Eye,
  Heart,
  MessageCircle,
  TrendingUp,
} from 'lucide-react';
import {
  GeneratedClip,
  PlatformAnalytics,
} from '../types/clipmatrix';

interface AnalyticsPageProps {
  platformAnalytics: PlatformAnalytics[];
  clips: GeneratedClip[];
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  platformAnalytics,
  clips,
}) => {
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d');

  const multiplier = timeframe === '7d' ? 0.28 : timeframe === '90d' ? 2.4 : 1;

  const totalViews = Math.round(
    platformAnalytics.reduce((acc, p) => acc + p.totalViews, 0) * multiplier
  );
  const totalLikes = Math.round(
    platformAnalytics.reduce((acc, p) => acc + p.totalLikes, 0) * multiplier
  );
  const totalComments = Math.round(
    platformAnalytics.reduce((acc, p) => acc + p.totalComments, 0) * multiplier
  );
  const avgEngagement = (
    platformAnalytics.reduce((acc, p) => acc + p.engagementRate, 0) /
    (platformAnalytics.length || 1)
  ).toFixed(2);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#1C2030]">
        <div>
          <div className="text-xs text-purple-400 font-medium">
            Cross-Platform Performance Telemetry · Sample Dataset
          </div>
          <h1 className="text-2xl font-display font-bold text-white">
            Analytics &amp; Engagement Insights
          </h1>
          <p className="text-sm text-slate-400">
            Track views, likes, comments, average engagement rates, and platform-by-platform performance across YouTube, TikTok, and Instagram.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#121522] border border-[#22283B] self-start">
          {(
            [
              { id: '7d', label: 'Last 7 Days' },
              { id: '30d', label: 'Last 30 Days' },
              { id: '90d', label: 'Last 90 Days' },
            ] as const
          ).map((tf) => (
            <button
              key={tf.id}
              type="button"
              onClick={() => setTimeframe(tf.id)}
              className={`px-3 py-1.5 rounded text-xs font-medium ${
                timeframe === tf.id
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top 4 Aggregate Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#10131E] border border-[#1E2436] space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Views</span>
            <Eye className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-display font-bold text-white font-mono tabular-nums">
            {totalViews.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-400 font-mono">
            +24.8% vs prior period
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#10131E] border border-[#1E2436] space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Likes</span>
            <Heart className="w-4 h-4 text-pink-400" />
          </div>
          <div className="text-2xl font-display font-bold text-white font-mono tabular-nums">
            {totalLikes.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-400 font-mono">
            +19.2% vs prior period
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#10131E] border border-[#1E2436] space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Comments</span>
            <MessageCircle className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-display font-bold text-white font-mono tabular-nums">
            {totalComments.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-400 font-mono">
            +31.0% bilingual discussion
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#10131E] border border-[#1E2436] space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Avg. Engagement Rate</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-display font-bold text-white font-mono tabular-nums">
            {avgEngagement}%
          </div>
          <div className="text-[11px] text-slate-400">
            Across YouTube, TikTok &amp; IG
          </div>
        </div>
      </div>

      {/* Platform-Wise Performance Breakdown */}
      <div className="rounded-xl bg-[#10131E] border border-[#1E2436] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1E2436]">
          <h2 className="text-base font-display font-semibold text-white">
            Platform-Wise Performance Breakdown
          </h2>
          <p className="text-xs text-slate-400">
            Comparative reach and interaction metrics by connected social destination
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1E2436] text-[11px] font-medium text-slate-400">
                <th className="py-3 px-5">Platform</th>
                <th className="py-3 px-5 text-right">Published Clips</th>
                <th className="py-3 px-5 text-right">Views</th>
                <th className="py-3 px-5 text-right">Likes</th>
                <th className="py-3 px-5 text-right">Comments</th>
                <th className="py-3 px-5 text-right">Engagement</th>
                <th className="py-3 px-5">Top Performing Clip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1F30] text-xs">
              {platformAnalytics.map((item) => (
                <tr key={item.platform} className="hover:bg-[#141826]">
                  <td className="py-3.5 px-5 font-display font-semibold text-white">
                    {item.label}
                  </td>
                  <td className="py-3.5 px-5 text-right font-mono tabular-nums text-slate-300">
                    {item.publishedClipsCount}
                  </td>
                  <td className="py-3.5 px-5 text-right font-mono tabular-nums text-white font-medium">
                    {Math.round(item.totalViews * multiplier).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-5 text-right font-mono tabular-nums text-slate-300">
                    {Math.round(item.totalLikes * multiplier).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-5 text-right font-mono tabular-nums text-slate-300">
                    {Math.round(item.totalComments * multiplier).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-5 text-right font-mono tabular-nums text-emerald-400 font-semibold">
                    {item.engagementRate}%
                  </td>
                  <td className="py-3.5 px-5 text-slate-300 max-w-xs truncate">
                    {item.topClipTitle}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Ranked Clips Table */}
      <div className="rounded-xl bg-[#10131E] border border-[#1E2436] p-5 space-y-4">
        <h3 className="text-sm font-display font-semibold text-white">
          Clip Hook &amp; Retention Leaderboard
        </h3>
        <div className="divide-y divide-[#1A1F30]">
          {clips.slice(0, 5).map((clip, i) => (
            <div
              key={clip.id}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono tabular-nums text-slate-500 w-5">
                  0{i + 1}
                </span>
                <div className="min-w-0">
                  <div className="font-medium text-white truncate">{clip.title}</div>
                  <div className="text-slate-400">
                    {clip.projectTitle} · {clip.aspectRatio} · {clip.durationSeconds}s
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 font-mono tabular-nums shrink-0">
                <span className="text-purple-400">
                  Hook Score {clip.viralityScore}%
                </span>
                <span className="text-slate-300">
                  {clip.targetPlatforms.join(', ').toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
