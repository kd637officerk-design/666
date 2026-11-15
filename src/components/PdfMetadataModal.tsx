import React, { useEffect, useState } from 'react';
import { BookOpen, FileText, Link2, Plus, Save, Tag, User, X } from 'lucide-react';
import { DeviceFileEntry, PdfDocState, SavedLinkItem } from '../types';
import { formatBytes } from '../lib/fileSystem';

interface PdfMetadataModalProps {
  open: boolean;
  entry: DeviceFileEntry | null;
  docState: PdfDocState | null;
  suggestedTags: string[];
  linkedUrls: SavedLinkItem[];
  onClose: () => void;
  onSaveMetadata: (
    entryId: string,
    updates: { author: string; tags: string[]; summaryNotes: string }
  ) => void;
  onOpenLinksTab?: () => void;
}

export const PdfMetadataModal: React.FC<PdfMetadataModalProps> = ({
  open,
  entry,
  docState,
  suggestedTags,
  linkedUrls,
  onClose,
  onSaveMetadata,
  onOpenLinksTab,
}) => {
  const [author, setAuthor] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [summaryNotes, setSummaryNotes] = useState('');

  useEffect(() => {
    if (!open || !entry) return;
    setAuthor(docState?.author || '');
    setTags(docState?.tags || []);
    setSummaryNotes(docState?.summaryNotes || '');
    setTagInput('');
  }, [open, entry?.id, docState]);

  if (!open || !entry) return null;

  const commitTagsFromString = (raw: string) => {
    const pieces = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (pieces.length === 0) return;
    setTags((prev) => {
      const existingLower = new Set(prev.map((t) => t.toLowerCase()));
      const next = [...prev];
      for (const p of pieces) {
        if (!existingLower.has(p.toLowerCase())) {
          existingLower.add(p.toLowerCase());
          next.push(p);
        }
      }
      return next;
    });
    setTagInput('');
  };

  const removeTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    let finalTags = [...tags];
    if (tagInput.trim()) {
      const extra = tagInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const existingLower = new Set(finalTags.map((t) => t.toLowerCase()));
      for (const p of extra) {
        if (!existingLower.has(p.toLowerCase())) {
          existingLower.add(p.toLowerCase());
          finalTags.push(p);
        }
      }
    }
    onSaveMetadata(entry.id, {
      author: author.trim(),
      tags: finalTags,
      summaryNotes: summaryNotes.trim(),
    });
    onClose();
  };

  const unusedSuggestions = suggestedTags.filter(
    (st) => !tags.some((t) => t.toLowerCase() === st.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Edit PDF metadata"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSave}
        className="steady-scroll max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-zinc-800 bg-[#121216] p-5 text-zinc-100 shadow-2xl sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
              {docState?.thumbnailUrl ? (
                <img
                  src={docState.thumbnailUrl}
                  alt={entry.name}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <FileText className="h-5 w-5 text-[#ef4444]" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-display text-base font-semibold text-white">
                Edit PDF Metadata
              </h2>
              <p className="truncate font-mono text-xs text-zinc-400">
                {entry.name.replace(/\.pdf$/i, '')} · {formatBytes(entry.size)}
                {docState?.totalPages ? ` · ${docState.totalPages} pages` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close metadata editor"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Author */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <User className="h-3.5 w-3.5 text-[#5ea3ff]" />
              <span>Author / Creator</span>
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="e.g. Andrzej Sapkowski, Makoto Yukimura..."
              className="min-h-[44px] w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-white placeholder:text-zinc-500 focus:border-[#5ea3ff] focus:outline-none"
            />
          </div>

          {/* Custom Tags */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <Tag className="h-3.5 w-3.5 text-[#5ea3ff]" />
              <span>Custom Tags</span>
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    commitTagsFromString(tagInput);
                  }
                }}
                placeholder="Type tag & press Enter (or comma-separate)"
                className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-white placeholder:text-zinc-500 focus:border-[#5ea3ff] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => commitTagsFromString(tagInput)}
                className="flex min-h-[44px] shrink-0 items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-800"
              >
                <Plus className="h-4 w-4" />
                <span>Add</span>
              </button>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border border-[#5ea3ff]/40 bg-[#5ea3ff]/15 px-2.5 text-xs font-medium text-[#93c5fd]"
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      aria-label={`Remove tag ${tag}`}
                      className="rounded-full p-0.5 text-[#93c5fd] hover:bg-[#5ea3ff]/25 hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {unusedSuggestions.length > 0 && (
              <div className="space-y-1 pt-1">
                <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  Existing Library Tags (Tap to add)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {unusedSuggestions.slice(0, 12).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => commitTagsFromString(st)}
                      className="min-h-[30px] rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-zinc-300 hover:border-zinc-700 hover:text-white"
                    >
                      + {st}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Summary Notes */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <BookOpen className="h-3.5 w-3.5 text-[#5ea3ff]" />
              <span>Summary Notes</span>
            </label>
            <textarea
              value={summaryNotes}
              onChange={(e) => setSummaryNotes(e.target.value)}
              rows={4}
              placeholder="Write synopsis, reading highlights, chapter notes, or study reminders..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm leading-relaxed text-white placeholder:text-zinc-500 focus:border-[#5ea3ff] focus:outline-none"
            />
          </div>

          {/* Attached Links Preview */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
                <Link2 className="h-3.5 w-3.5 text-[#5ea3ff]" />
                <span>Saved Links for this PDF ({linkedUrls.length})</span>
              </span>
              {onOpenLinksTab && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenLinksTab();
                  }}
                  className="text-xs font-medium text-[#5ea3ff] hover:underline"
                >
                  Manage Links
                </button>
              )}
            </div>
            {linkedUrls.length > 0 && (
              <div className="mt-2 space-y-1">
                {linkedUrls.slice(0, 3).map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate font-mono text-[11px] text-cyan-300 hover:underline"
                  >
                    {link.title} → {link.url}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-5 flex items-center justify-end gap-2 border-t border-zinc-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-xl px-4 text-sm font-medium text-zinc-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#5ea3ff] px-5 text-sm font-semibold text-zinc-950 hover:bg-[#7cb5ff]"
          >
            <Save className="h-4 w-4" />
            <span>Save Metadata</span>
          </button>
        </div>
      </form>
    </div>
  );
};
