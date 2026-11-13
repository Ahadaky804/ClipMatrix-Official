import React, { useState } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  Bookmark,
  RefreshCw,
  Edit3,
} from 'lucide-react';
import {
  CaptionLanguage,
  CaptionLength,
  CaptionOption,
  CaptionStyle,
  GeneratedClip,
} from '../types/clipmatrix';
import { generateCaptionBatch } from '../utils/clipLogic';

interface CaptionStudioPageProps {
  clips: GeneratedClip[];
  selectedClipId: string;
  onSelectClip: (clipId: string) => void;
  captions: CaptionOption[];
  onSetCaptions: (newCaptions: CaptionOption[]) => void;
  onApplyCaptionToClip: (
    clipId: string,
    captionText: string,
    language: CaptionLanguage
  ) => void;
}

export const CaptionStudioPage: React.FC<CaptionStudioPageProps> = ({
  clips,
  selectedClipId,
  onSelectClip,
  captions,
  onSetCaptions,
  onApplyCaptionToClip,
}) => {
  const activeClip =
    clips.find((c) => c.id === selectedClipId) || clips[0];

  const [style, setStyle] = useState<CaptionStyle>('viral');
  const [language, setLanguage] = useState<CaptionLanguage>('english');
  const [length, setLength] = useState<CaptionLength>('medium');
  const [optionCount, setOptionCount] = useState<number>(6);
  const [includeEmojis, setIncludeEmojis] = useState<boolean>(true);
  const [includeHashtags, setIncludeHashtags] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string>('');
  const [editingId, setEditingId] = useState<string>('');
  const [editingText, setEditingText] = useState<string>('');
  const [appliedBanner, setAppliedBanner] = useState<string>('');

  const styles: { id: CaptionStyle; label: string }[] = [
    { id: 'viral', label: 'Viral' },
    { id: 'funny', label: 'Funny' },
    { id: 'professional', label: 'Professional' },
    { id: 'emotional', label: 'Emotional' },
    { id: 'motivational', label: 'Motivational' },
    { id: 'storytelling', label: 'Storytelling' },
  ];

  const languages: { id: CaptionLanguage; label: string }[] = [
    { id: 'english', label: 'English' },
    { id: 'urdu', label: 'Urdu (اردو)' },
    { id: 'roman_urdu', label: 'Roman Urdu' },
  ];

  const lengths: { id: CaptionLength; label: string }[] = [
    { id: 'short', label: 'Short' },
    { id: 'medium', label: 'Medium' },
    { id: 'long', label: 'Long' },
  ];

  const handleGenerateBatch = () => {
    if (!activeClip) return;
    const generated = generateCaptionBatch({
      clipId: activeClip.id,
      clipTitle: activeClip.title,
      timecode: activeClip.startTimecode,
      style,
      language,
      length,
      includeEmojis,
      includeHashtags,
      count: optionCount,
    });
    onSetCaptions(generated);
    setAppliedBanner(
      `Generated ${generated.length} ${style} captions in ${
        language === 'roman_urdu' ? 'Roman Urdu' : language.toUpperCase()
      }.`
    );
  };

  const handleCopy = (cap: CaptionOption) => {
    const fullText =
      cap.hashtags.length > 0
        ? `${cap.text}\n${cap.hashtags.join(' ')}`
        : cap.text;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullText).catch(() => {});
    }
    setCopiedId(cap.id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  const handleToggleSave = (id: string) => {
    onSetCaptions(
      captions.map((c) => (c.id === id ? { ...c, isSaved: !c.isSaved } : c))
    );
  };

  const handleSaveInlineEdit = (id: string) => {
    onSetCaptions(
      captions.map((c) => (c.id === id ? { ...c, text: editingText } : c))
    );
    setEditingId('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#1C2030]">
        <div>
          <div className="text-xs text-purple-400 font-medium">
            Multi-Language Social Copywriter · English, Urdu &amp; Roman Urdu
          </div>
          <h1 className="text-2xl font-display font-bold text-white">
            Caption Studio
          </h1>
          <p className="text-sm text-slate-400">
            Generate 5–10 tailored caption variations across 6 tonal styles, 3 languages, and customizable emoji/hashtag rules.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerateBatch}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-xs font-semibold text-white self-start whitespace-nowrap"
        >
          <Sparkles className="w-4 h-4" />
          <span>Generate {optionCount} Captions</span>
        </button>
      </div>

      {appliedBanner && (
        <div
          role="status"
          className="px-4 py-3 rounded-xl bg-purple-950/50 border border-purple-500/40 text-xs text-purple-200 flex items-center gap-2"
        >
          <Check className="w-4 h-4 text-purple-400 shrink-0" />
          <span>{appliedBanner}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 4 Cols: Generator Controls */}
        <div className="xl:col-span-4 rounded-xl bg-[#10131E] border border-[#1E2436] p-5 space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="caption-clip-select" className="block text-xs font-medium text-slate-300">
              Target Clip
            </label>
            <select
              id="caption-clip-select"
              value={activeClip?.id || ''}
              onChange={(e) => onSelectClip(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-xs text-white"
            >
              {clips.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Language Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              Caption Language
            </label>
            <div className="grid grid-cols-3 gap-2">
              {languages.map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setLanguage(lang.id)}
                  className={`py-2 px-2.5 rounded-lg text-xs font-medium border transition-colors ${
                    language === lang.id
                      ? 'bg-purple-600 text-white border-purple-500'
                      : 'bg-[#0C0E17] text-slate-300 border-[#22283B] hover:text-white'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tonal Style Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              Caption Tone &amp; Style
            </label>
            <div className="grid grid-cols-2 gap-2">
              {styles.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStyle(st.id)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border text-left transition-colors ${
                    style === st.id
                      ? 'bg-blue-600/25 border-blue-500 text-white'
                      : 'bg-[#0C0E17] border-[#22283B] text-slate-400 hover:text-white'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Length & Option Count (5-10) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Caption Length
              </label>
              <div className="flex flex-col gap-1.5">
                {lengths.map((len) => (
                  <button
                    key={len.id}
                    type="button"
                    onClick={() => setLength(len.id)}
                    className={`py-1.5 px-3 rounded-lg text-xs border text-left ${
                      length === len.id
                        ? 'bg-purple-600/25 border-purple-500 text-white'
                        : 'bg-[#0C0E17] border-[#22283B] text-slate-400'
                    }`}
                  >
                    {len.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="caption-batch-count" className="block text-xs font-medium text-slate-300">
                Batch Size (5–10)
              </label>
              <input
                id="caption-batch-count"
                type="number"
                min={5}
                max={10}
                value={optionCount}
                onChange={(e) =>
                  setOptionCount(Math.min(10, Math.max(5, Number(e.target.value))))
                }
                className="w-full px-3 py-2 rounded-lg bg-[#0C0E17] border border-[#22283B] text-sm font-mono tabular-nums text-white"
              />

              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeEmojis}
                    onChange={(e) => setIncludeEmojis(e.target.checked)}
                    className="rounded accent-purple-500"
                  />
                  <span>Include Emojis</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeHashtags}
                    onChange={(e) => setIncludeHashtags(e.target.checked)}
                    className="rounded accent-purple-500"
                  />
                  <span>Generate Hashtags</span>
                </label>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateBatch}
            className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-xs font-semibold text-white transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Regenerate {optionCount} Options</span>
          </button>
        </div>

        {/* Right 8 Cols: Generated Caption Options List */}
        <div className="xl:col-span-8 space-y-3">
          {captions.map((cap, idx) => {
            const isEditing = editingId === cap.id;
            return (
              <div
                key={cap.id}
                className="p-4 rounded-xl bg-[#10131E] border border-[#1E2436] space-y-3"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="font-mono tabular-nums text-purple-400 font-semibold">
                      Option #{idx + 1}
                    </span>
                    <span>·</span>
                    <span className="capitalize">{cap.style}</span>
                    <span>·</span>
                    <span className="uppercase font-mono">
                      {cap.language.replace('_', ' ')}
                    </span>
                    <span>·</span>
                    <span className="capitalize">{cap.length}</span>
                  </div>
                  {cap.isSaved && (
                    <span className="text-emerald-400 font-mono text-[11px]">
                      Saved
                    </span>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="w-full p-3 rounded-lg bg-[#0C0E17] border border-purple-500 text-xs text-white"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveInlineEdit(cap.id)}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 text-xs font-medium text-white"
                      >
                        Save Caption Text
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId('')}
                        className="px-3 py-1.5 rounded-lg bg-[#181D2E] text-xs text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p
                    dir={cap.language === 'urdu' ? 'rtl' : 'ltr'}
                    className="text-sm text-slate-100 whitespace-pre-line leading-relaxed"
                  >
                    {cap.text}
                  </p>
                )}

                {cap.hashtags.length > 0 && (
                  <div className="text-xs font-mono text-blue-400">
                    {cap.hashtags.join('  ')}
                  </div>
                )}

                <div className="pt-2 border-t border-[#1A2032] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(cap.id);
                        setEditingText(cap.text);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161B2B] hover:bg-[#1E253A] text-xs text-slate-200"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopy(cap)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161B2B] hover:bg-[#1E253A] text-xs text-slate-200"
                    >
                      {copiedId === cap.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleSave(cap.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161B2B] hover:bg-[#1E253A] text-xs text-slate-200"
                    >
                      <Bookmark
                        className={`w-3.5 h-3.5 ${
                          cap.isSaved ? 'text-purple-400' : 'text-slate-400'
                        }`}
                      />
                      <span>{cap.isSaved ? 'Saved' : 'Save'}</span>
                    </button>
                  </div>

                  {activeClip && (
                    <button
                      type="button"
                      onClick={() => {
                        const combined =
                          cap.hashtags.length > 0
                            ? `${cap.text} ${cap.hashtags.join(' ')}`
                            : cap.text;
                        onApplyCaptionToClip(activeClip.id, combined, cap.language);
                        setAppliedBanner(
                          `Applied Option #${idx + 1} to "${activeClip.title}".`
                        );
                      }}
                      className="px-3 py-1.5 rounded-lg bg-purple-600/25 hover:bg-purple-600/40 border border-purple-500/35 text-xs font-medium text-purple-200"
                    >
                      Attach to Active Clip
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
