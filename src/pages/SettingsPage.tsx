import React, { useState } from 'react';
import {
  Database,
  Server,
  RotateCcw,
  Check,
  Layers,
  Shield,
} from 'lucide-react';
import {
  BACKEND_INTEGRATION_SPECS,
  POSTGRESQL_TABLE_SCHEMAS,
} from '../services/apiContracts';

interface SettingsPageProps {
  onResetSampleWorkspace: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onResetSampleWorkspace,
}) => {
  const [defaultAspectRatio, setDefaultAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [defaultLanguage, setDefaultLanguage] = useState<'english' | 'urdu' | 'roman_urdu'>('english');
  const [requireManualApproval, setRequireManualApproval] = useState(true);
  const [savedToast, setSavedToast] = useState('');

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedToast('Saved studio default preferences for Phase 1 workspace.');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#1C2030]">
        <div>
          <div className="text-xs text-purple-400 font-medium">
            Studio Configuration &amp; Phase 2 Backend Service Contracts
          </div>
          <h1 className="text-2xl font-display font-bold text-white">
            Settings &amp; Backend Architecture
          </h1>
          <p className="text-sm text-slate-400">
            Configure default clipping presets and inspect the typed service contracts prepared for Python FastAPI, PostgreSQL, Redis/Celery, FFmpeg, Whisper, and Gemini API.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            onResetSampleWorkspace();
            setSavedToast('Restored initial sample data across all 13 studio pages.');
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#151928] hover:bg-[#1C2236] border border-[#262E45] text-xs font-medium text-slate-200 self-start whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
          <span>Reset Sample Data</span>
        </button>
      </div>

      {savedToast && (
        <div
          role="status"
          className="px-4 py-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2"
        >
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{savedToast}</span>
        </div>
      )}

      {/* Studio Preferences Form */}
      <form
        onSubmit={handleSavePreferences}
        className="rounded-xl bg-[#10131E] border border-[#1E2436] p-5 space-y-4"
      >
        <div className="flex items-center gap-2 pb-3 border-b border-[#1E2436]">
          <Shield className="w-4 h-4 text-purple-400" />
          <h2 className="text-base font-display font-semibold text-white">
            Studio Workflow Defaults
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="pref-aspect" className="block text-xs text-slate-400 mb-1">
              Default Export Aspect Ratio
            </label>
            <select
              id="pref-aspect"
              value={defaultAspectRatio}
              onChange={(e) => setDefaultAspectRatio(e.target.value as '9:16' | '16:9' | '1:1')}
              className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs font-mono text-white"
            >
              <option value="9:16">9:16 Vertical (Shorts / Reels / TikTok)</option>
              <option value="16:9">16:9 Landscape (YouTube VOD)</option>
              <option value="1:1">1:1 Square (Feed Post)</option>
            </select>
          </div>

          <div>
            <label htmlFor="pref-lang" className="block text-xs text-slate-400 mb-1">
              Default Caption Language
            </label>
            <select
              id="pref-lang"
              value={defaultLanguage}
              onChange={(e) =>
                setDefaultLanguage(e.target.value as 'english' | 'urdu' | 'roman_urdu')
              }
              className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs text-white"
            >
              <option value="english">English</option>
              <option value="urdu">Urdu (اردو)</option>
              <option value="roman_urdu">Roman Urdu</option>
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer py-2">
              <input
                type="checkbox"
                checked={requireManualApproval}
                onChange={(e) => setRequireManualApproval(e.target.checked)}
                className="rounded accent-purple-500"
              />
              <span>Enforce Upload Approval Gate on all channels</span>
            </label>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-xs font-semibold text-white"
          >
            Save Studio Defaults
          </button>
        </div>
      </form>

      {/* Prepared Backend Service Integration Contracts */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-blue-400" />
          <h2 className="text-base font-display font-semibold text-white">
            Prepared Service Interfaces (Phase 2 Backend Target)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {BACKEND_INTEGRATION_SPECS.map((spec) => (
            <div
              key={spec.id}
              className="rounded-xl bg-[#10131E] border border-[#1E2436] p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono text-purple-400">{spec.category}</span>
                <span className="font-mono text-slate-400">{spec.phaseStatus}</span>
              </div>
              <h3 className="text-sm font-display font-semibold text-white">
                {spec.serviceName}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {spec.description}
              </p>
              <div className="pt-2 border-t border-[#1A2032] space-y-1 text-[11px] font-mono text-slate-300">
                <div>Stack: {spec.technology}</div>
                <div className="text-slate-400 truncate">Route: {spec.endpointPattern}</div>
                <div className="text-slate-500">
                  Env Keys (Server-Only): {spec.envVariablesRequired.join(', ')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PostgreSQL Relational Schema Blueprint */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-400" />
          <h2 className="text-base font-display font-semibold text-white">
            PostgreSQL-Ready Relational Data Architecture
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {POSTGRESQL_TABLE_SCHEMAS.map((tbl) => (
            <div
              key={tbl.tableName}
              className="rounded-xl bg-[#10131E] border border-[#1E2436] p-4 space-y-2"
            >
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-emerald-400 font-semibold">
                  TABLE {tbl.tableName}
                </span>
                <Layers className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <ul className="space-y-1 text-xs font-mono text-slate-300">
                {tbl.columns.map((col) => (
                  <li key={col} className="truncate">
                    · {col}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
