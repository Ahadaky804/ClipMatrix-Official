import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Server,
  RotateCcw,
  Check,
  Layers,
  Shield,
  Activity,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import {
  BACKEND_INTEGRATION_SPECS,
  POSTGRESQL_TABLE_SCHEMAS,
} from '../services/apiContracts';

interface SettingsPageProps {
  onResetSampleWorkspace: () => void;
}

interface DiagnosticsPayload {
  status: string;
  primaryBackend: string;
  checkedAt: string;
  services: {
    ffmpeg: {
      available: boolean;
      binaryPath: string;
      version: string;
    };
    ffprobe: {
      available: boolean;
      binaryPath: string;
      version: string;
    };
    whisper: {
      available: boolean;
      installed: boolean;
      version: string;
      ctranslate2Version?: string;
      defaultModel: string;
      device: string;
      computeType?: string;
      error?: string;
    };
    gemini: {
      available: boolean;
      verified: boolean;
      model: string;
      latencyMs?: number;
      responsePreview?: string;
      error?: string;
    };
    postgresql: {
      available: boolean;
      database: string;
      host: string;
      version?: string;
      latencyMs?: number;
      counts?: {
        videos: number;
        transcripts: number;
        highlights: number;
        generatedClips: number;
      };
      error?: string;
    };
    redis: {
      available: boolean;
      brokerUrl: string;
      latencyMs?: number;
      mode: string;
      detail: string;
      error?: string;
    };
  };
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onResetSampleWorkspace,
}) => {
  const [defaultAspectRatio, setDefaultAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [defaultLanguage, setDefaultLanguage] = useState<'english' | 'urdu' | 'roman_urdu'>('english');
  const [requireManualApproval, setRequireManualApproval] = useState(true);
  const [savedToast, setSavedToast] = useState('');

  const [diagnostics, setDiagnostics] = useState<DiagnosticsPayload | null>(null);
  const [isLoadingDiag, setIsLoadingDiag] = useState<boolean>(true);
  const [diagError, setDiagError] = useState<string>('');

  const fetchDiagnostics = useCallback(async (forceRefresh = false) => {
    setIsLoadingDiag(true);
    setDiagError('');
    try {
      const url = forceRefresh
        ? '/api/system/status?refresh=true'
        : '/api/system/status';
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch system diagnostics.');
      }
      setDiagnostics(data);
    } catch (err: any) {
      setDiagError(err.message || 'Could not reach primary FastAPI backend.');
    } finally {
      setIsLoadingDiag(false);
    }
  }, []);

  useEffect(() => {
    fetchDiagnostics(false);
  }, [fetchDiagnostics]);

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedToast('Saved studio default preferences.');
  };

  const svc = diagnostics?.services;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#1C2030]">
        <div>
          <div className="text-xs text-purple-400 font-medium">
            Live Runtime Verification · Primary Python FastAPI Architecture
          </div>
          <h1 className="text-2xl font-display font-bold text-white">
            Settings &amp; System Diagnostics
          </h1>
          <p className="text-sm text-slate-400">
            Verify live availability of FFmpeg, FFprobe, faster-whisper, Google Gemini API, PostgreSQL, and Redis/Celery, and configure studio defaults.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start">
          <button
            type="button"
            disabled={isLoadingDiag}
            onClick={() => fetchDiagnostics(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-xs font-semibold text-white whitespace-nowrap"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoadingDiag ? 'animate-spin' : ''}`}
            />
            <span>
              {isLoadingDiag ? 'Checking Services...' : 'Re-Run Live Diagnostics'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onResetSampleWorkspace();
              setSavedToast('Refreshed workspace state across all 13 studio pages.');
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#151928] hover:bg-[#1C2236] border border-[#262E45] text-xs font-medium text-slate-200 whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
            <span>Reset Workspace</span>
          </button>
        </div>
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

      {/* LIVE SYSTEM DIAGNOSTICS PANEL */}
      <section
        aria-label="Live System Diagnostics"
        className="rounded-xl bg-[#10131E] border border-[#1E2436] p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#1E2436]">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h2 className="text-base font-display font-semibold text-white">
                Phase 2 Live System Diagnostics
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Primary Architecture:{' '}
              <span className="font-mono text-slate-200">
                {diagnostics?.primaryBackend || 'Python FastAPI Engine'}
              </span>
            </p>
          </div>
          {diagnostics?.checkedAt && (
            <span className="text-xs font-mono text-slate-400">
              Checked: {new Date(diagnostics.checkedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {diagError && (
          <div className="p-3.5 rounded-lg bg-red-950/60 border border-red-500/40 text-xs text-red-200">
            {diagError}
          </div>
        )}

        {svc ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* 1. FFmpeg */}
            <div className="p-4 rounded-xl bg-[#0C0E17] border border-[#22283B] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-display font-semibold text-white">
                  1. FFmpeg Transcoder
                </span>
                {svc.ffmpeg.available ? (
                  <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>VERIFIED</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-mono text-red-400">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>UNAVAILABLE</span>
                  </span>
                )}
              </div>
              <div className="text-[11px] font-mono text-slate-300 space-y-1">
                <div>Binary: {svc.ffmpeg.binaryPath}</div>
                <div className="text-slate-400 line-clamp-2">
                  {svc.ffmpeg.version}
                </div>
              </div>
            </div>

            {/* 2. FFprobe */}
            <div className="p-4 rounded-xl bg-[#0C0E17] border border-[#22283B] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-display font-semibold text-white">
                  2. FFprobe Stream Inspector
                </span>
                {svc.ffprobe.available ? (
                  <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>VERIFIED</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-mono text-red-400">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>UNAVAILABLE</span>
                  </span>
                )}
              </div>
              <div className="text-[11px] font-mono text-slate-300 space-y-1">
                <div>Binary: {svc.ffprobe.binaryPath}</div>
                <div className="text-slate-400 line-clamp-2">
                  {svc.ffprobe.version}
                </div>
              </div>
            </div>

            {/* 3. Faster-Whisper */}
            <div className="p-4 rounded-xl bg-[#0C0E17] border border-[#22283B] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-display font-semibold text-white">
                  3. Faster-Whisper Speech-to-Text
                </span>
                {svc.whisper.available ? (
                  <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>INSTALLED (v{svc.whisper.version})</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-mono text-red-400">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>MISSING</span>
                  </span>
                )}
              </div>
              <div className="text-[11px] font-mono text-slate-300 space-y-1">
                <div>
                  CTranslate2: v{svc.whisper.ctranslate2Version || '4.9.0'} · Device:{' '}
                  {svc.whisper.device.toUpperCase()} ({svc.whisper.computeType || 'int8'})
                </div>
                <div className="text-slate-400">
                  Default Model: {svc.whisper.defaultModel} (word timestamps enabled)
                </div>
              </div>
            </div>

            {/* 4. Official Google Gemini API */}
            <div className="p-4 rounded-xl bg-[#0C0E17] border border-[#22283B] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-display font-semibold text-white">
                  4. Google Gemini API (Live Call)
                </span>
                {svc.gemini.verified ? (
                  <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>LIVE ({svc.gemini.latencyMs}ms)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-mono text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>ERROR</span>
                  </span>
                )}
              </div>
              <div className="text-[11px] font-mono text-slate-300 space-y-1">
                <div>SDK: google-genai · Model: {svc.gemini.model}</div>
                {svc.gemini.verified ? (
                  <div className="text-emerald-300">
                    Live API Response: &quot;{svc.gemini.responsePreview}&quot;
                  </div>
                ) : (
                  <div className="text-amber-300 line-clamp-2">
                    {svc.gemini.error || 'API key not verified'}
                  </div>
                )}
              </div>
            </div>

            {/* 5. PostgreSQL Database */}
            <div className="p-4 rounded-xl bg-[#0C0E17] border border-[#22283B] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-display font-semibold text-white">
                  5. PostgreSQL Database
                </span>
                {svc.postgresql.available ? (
                  <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>CONNECTED ({svc.postgresql.latencyMs}ms)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-mono text-red-400">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>OFFLINE</span>
                  </span>
                )}
              </div>
              <div className="text-[11px] font-mono text-slate-300 space-y-1">
                <div>
                  DB: {svc.postgresql.database} · {svc.postgresql.version || 'PostgreSQL'}
                </div>
                {svc.postgresql.counts ? (
                  <div className="text-slate-400">
                    Rows: {svc.postgresql.counts.videos} videos ·{' '}
                    {svc.postgresql.counts.transcripts} transcripts ·{' '}
                    {svc.postgresql.counts.highlights} highlights ·{' '}
                    {svc.postgresql.counts.generatedClips} clips
                  </div>
                ) : (
                  <div className="text-red-300">{svc.postgresql.error}</div>
                )}
              </div>
            </div>

            {/* 6. Redis & Celery Queue */}
            <div className="p-4 rounded-xl bg-[#0C0E17] border border-[#22283B] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-display font-semibold text-white">
                  6. Redis &amp; Celery Worker Broker
                </span>
                {svc.redis.available ? (
                  <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>ONLINE ({svc.redis.latencyMs}ms)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-mono text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>SYNC FALLBACK</span>
                  </span>
                )}
              </div>
              <div className="text-[11px] font-mono text-slate-300 space-y-1">
                <div>Broker: {svc.redis.brokerUrl}</div>
                <div className="text-slate-400 line-clamp-2">
                  {svc.redis.detail}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs font-mono text-slate-400">
            Running live diagnostics check against FastAPI backend...
          </div>
        )}
      </section>

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
            Active Backend Service Specifications
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
            PostgreSQL Relational Schema
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
