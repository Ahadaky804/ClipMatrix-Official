import React from 'react';
import {
  Share2,
  ShieldCheck,
  RefreshCw,
  Power,
} from 'lucide-react';
import { SocialAccount } from '../types/clipmatrix';

interface SocialAccountsPageProps {
  accounts: SocialAccount[];
  onToggleAccountConnection: (id: string) => void;
  onToggleApprovalRequirement: (id: string) => void;
}

export const SocialAccountsPage: React.FC<SocialAccountsPageProps> = ({
  accounts,
  onToggleAccountConnection,
  onToggleApprovalRequirement,
}) => {
  return (
    <div className="space-y-6">
      <div className="pb-5 border-b border-[#1C2030] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-purple-400 font-medium">
            Multi-Platform OAuth Bridge Preparation · Phase 1 Sample Profiles
          </div>
          <h1 className="text-2xl font-display font-bold text-white">
            Social Accounts
          </h1>
          <p className="text-sm text-slate-400">
            Configure YouTube Data API v3, Instagram Graph API, and TikTok Content Posting API destinations and mandatory approval gates.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="rounded-xl bg-[#10131E] border border-[#1E2436] p-5 flex flex-col justify-between gap-5"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600/30 to-blue-600/30 border border-purple-500/40 flex items-center justify-center">
                    <Share2 className="w-4 h-4 text-purple-300" />
                  </div>
                  <div>
                    <div className="text-xs uppercase font-mono text-slate-400">
                      {acc.platform}
                    </div>
                    <h2 className="text-sm font-display font-semibold text-white">
                      {acc.accountName}
                    </h2>
                  </div>
                </div>

                <span
                  className={`text-xs font-mono font-semibold ${
                    acc.connected ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {acc.connected ? 'CONNECTED (STUB)' : 'DISCONNECTED'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-300 border-t border-b border-[#1B2133] py-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Handle</span>
                  <span className="font-mono text-white">{acc.handle}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Audience Reach</span>
                  <span className="font-mono tabular-nums text-white">
                    {acc.subscribersOrFollowers}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Default Aspect Ratio</span>
                  <span className="font-mono tabular-nums text-purple-300">
                    {acc.defaultAspectRatio}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">OAuth Token State</span>
                  <span className="font-mono text-slate-300">
                    {acc.tokenHealth.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Mandatory Approval Gate Toggle */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Require Human Approval Before Upload</span>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleApprovalRequirement(acc.id)}
                  className={`px-2.5 py-1 rounded text-xs font-mono ${
                    acc.requireApprovalBeforePublish
                      ? 'bg-emerald-600/25 text-emerald-200 border border-emerald-500/40'
                      : 'bg-[#181D2C] text-slate-400'
                  }`}
                >
                  {acc.requireApprovalBeforePublish ? 'REQUIRED' : 'AUTO'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => onToggleAccountConnection(acc.id)}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                  acc.connected
                    ? 'bg-[#171C2B] hover:bg-red-950/50 border-[#262F47] text-slate-200'
                    : 'bg-purple-600 hover:bg-purple-500 border-purple-500 text-white'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{acc.connected ? 'Disconnect Stub' : 'Connect Account Stub'}</span>
              </button>
              <button
                type="button"
                onClick={() => {}}
                aria-label={`Refresh ${acc.platform} sample sync`}
                className="p-2 rounded-lg bg-[#161B2B] border border-[#252D44] text-slate-300 hover:text-white"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
