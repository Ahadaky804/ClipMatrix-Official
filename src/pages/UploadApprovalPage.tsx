import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  CalendarClock,
  Edit3,
  Send,
  ShieldAlert,
} from 'lucide-react';
import {
  ApprovalStatus,
  GeneratedClip,
  NavigationPageId,
} from '../types/clipmatrix';
import { VideoPreviewFrame } from '../components/common/VideoPreviewFrame';

interface UploadApprovalPageProps {
  clips: GeneratedClip[];
  onApprovalDecision: (
    clipId: string,
    status: ApprovalStatus,
    options?: {
      reviewerNotes?: string;
      scheduledFor?: string;
      captionText?: string;
    }
  ) => void;
  onSelectClipForStudio: (clipId: string) => void;
  onNavigate: (page: NavigationPageId) => void;
}

export const UploadApprovalPage: React.FC<UploadApprovalPageProps> = ({
  clips,
  onApprovalDecision,
  onSelectClipForStudio,
  onNavigate,
}) => {
  const [filterTab, setFilterTab] = useState<'pending_approval' | 'all'>('pending_approval');
  const [selectedId, setSelectedId] = useState<string>(
    clips.find((c) => c.approvalStatus === 'pending_approval')?.id ||
      clips[0]?.id ||
      ''
  );
  const [notesInput, setNotesInput] = useState<string>('');
  const [scheduleInput, setScheduleInput] = useState<string>('2026-11-15 18:00');
  const [captionDraft, setCaptionDraft] = useState<string>('');
  const [feedbackBanner, setFeedbackBanner] = useState<string>('');

  const visibleClips =
    filterTab === 'pending_approval'
      ? clips.filter((c) => c.approvalStatus === 'pending_approval')
      : clips;

  const activeClip =
    clips.find((c) => c.id === selectedId) || visibleClips[0] || clips[0];

  const handleSelectClip = (clip: GeneratedClip) => {
    setSelectedId(clip.id);
    setCaptionDraft(clip.captionText);
    setNotesInput(clip.reviewerNotes || '');
  };

  const triggerAction = (status: ApprovalStatus, label: string) => {
    if (!activeClip) return;
    onApprovalDecision(activeClip.id, status, {
      reviewerNotes: notesInput || undefined,
      scheduledFor: status === 'scheduled' ? scheduleInput : undefined,
      captionText: captionDraft || activeClip.captionText,
    });
    setFeedbackBanner(
      `${label}: "${activeClip.title}" updated to ${status.replace('_', ' ').toUpperCase()}.`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#1C2030]">
        <div>
          <div className="text-xs text-purple-400 font-medium">
            Human-in-the-Loop Quality Control · Pre-Publish Gate
          </div>
          <h1 className="text-2xl font-display font-bold text-white">
            Upload Approval Queue
          </h1>
          <p className="text-sm text-slate-400">
            Inspect rendered clips, verify captions and aspect ratios, and explicitly approve, reject, edit, or schedule before publishing.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#121522] border border-[#22283B] self-start">
          <button
            type="button"
            onClick={() => setFilterTab('pending_approval')}
            className={`px-3 py-1.5 rounded text-xs font-medium ${
              filterTab === 'pending_approval'
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Pending Review ({clips.filter((c) => c.approvalStatus === 'pending_approval').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded text-xs font-medium ${
              filterTab === 'all'
                ? 'bg-purple-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Clips ({clips.length})
          </button>
        </div>
      </div>

      {feedbackBanner && (
        <div
          role="status"
          className="px-4 py-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-200 flex items-center justify-between gap-2"
        >
          <span>{feedbackBanner}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner('')}
            className="text-emerald-300 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {visibleClips.length === 0 ? (
        <div className="p-12 rounded-xl bg-[#10131E] border border-[#1E2436] text-center space-y-3">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <h2 className="text-base font-display font-semibold text-white">
            All Pending Clips Have Been Reviewed
          </h2>
          <p className="text-xs text-slate-400">
            Switch to "All Clips" to inspect past decisions or generate new clips.
          </p>
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className="px-4 py-2 rounded-lg bg-purple-600 text-xs font-medium text-white"
          >
            View All Reviewed Clips
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 5 Cols: Queue List */}
          <div className="lg:col-span-5 space-y-2.5">
            {visibleClips.map((clip) => {
              const isSelected = activeClip?.id === clip.id;
              return (
                <button
                  key={clip.id}
                  type="button"
                  onClick={() => handleSelectClip(clip)}
                  className={`w-full text-left p-4 rounded-xl border transition-colors space-y-1.5 ${
                    isSelected
                      ? 'bg-[#151A2C] border-purple-500/50'
                      : 'bg-[#10131E] border-[#1E2436] hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-400">
                    <span className="text-purple-400 font-semibold">
                      Virality {clip.viralityScore}%
                    </span>
                    <span>
                      {clip.aspectRatio} · {clip.durationSeconds}s
                    </span>
                  </div>
                  <div className="text-sm font-display font-semibold text-white truncate">
                    {clip.title}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Targets: {clip.targetPlatforms.join(', ').toUpperCase()}</span>
                    <span className="font-mono uppercase text-slate-300">
                      {clip.approvalStatus.replace('_', ' ')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right 7 Cols: Inspector & Approval Controls */}
          {activeClip && (
            <div className="lg:col-span-7 rounded-xl bg-[#10131E] border border-[#1E2436] p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1E2436]">
                <div>
                  <div className="text-xs text-slate-400">
                    Source: {activeClip.projectTitle} ({activeClip.startTimecode}–{activeClip.endTimecode})
                  </div>
                  <h2 className="text-base font-display font-semibold text-white">
                    {activeClip.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSelectClipForStudio(activeClip.id);
                    onNavigate('ai-editing');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161B2B] hover:bg-[#1E253A] border border-[#262F49] text-xs text-slate-200 whitespace-nowrap self-start"
                >
                  <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Re-open in AI Editing Studio</span>
                </button>
              </div>

              <VideoPreviewFrame
                title={activeClip.title}
                aspectRatio={activeClip.aspectRatio}
                timecode={`${activeClip.startTimecode} – ${activeClip.endTimecode}`}
                speakerLabel={activeClip.speakerLabel || 'Speaker'}
                subtitleText={activeClip.editConfig.thumbnailHeadline}
              />

              {/* Editable Final Caption & Reviewer Notes */}
              <div className="space-y-3">
                <div>
                  <label htmlFor="approval-caption" className="block text-xs font-medium text-slate-300 mb-1">
                    Final Publish Caption ({activeClip.captionLanguage.replace('_', ' ')})
                  </label>
                  <textarea
                    id="approval-caption"
                    rows={2}
                    value={captionDraft || activeClip.captionText}
                    onChange={(e) => setCaptionDraft(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="approval-notes" className="block text-xs font-medium text-slate-300 mb-1">
                      Approval / Revision Notes
                    </label>
                    <input
                      id="approval-notes"
                      type="text"
                      value={notesInput}
                      onChange={(e) => setNotesInput(e.target.value)}
                      placeholder="e.g. Verified audio levels and hook"
                      className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="approval-schedule" className="block text-xs font-medium text-slate-300 mb-1">
                      Schedule Slot (if scheduling)
                    </label>
                    <input
                      id="approval-schedule"
                      type="text"
                      value={scheduleInput}
                      onChange={(e) => setScheduleInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs font-mono text-white"
                    />
                  </div>
                </div>
              </div>

              {/* 4 Required Decision Buttons: Approve, Schedule, Publish, Reject */}
              <div className="pt-3 border-t border-[#1E2436] flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => triggerAction('approved', 'Approved Clip')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve Clip</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerAction('scheduled', 'Scheduled Clip')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors"
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                    <span>Approve &amp; Schedule</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerAction('published', 'Published Clip (Sample)')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-xs font-semibold text-white transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Publish Now</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => triggerAction('rejected', 'Rejected Clip')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-950/60 hover:bg-red-900/70 border border-red-500/40 text-xs font-medium text-red-200 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
