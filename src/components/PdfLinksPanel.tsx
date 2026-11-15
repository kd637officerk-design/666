import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  Link2,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { DeviceFileEntry, SavedLinkCategory, SavedLinkItem } from '../types';

interface PdfLinksPanelProps {
  links: SavedLinkItem[];
  pdfEntries: DeviceFileEntry[];
  onSaveLink: (item: SavedLinkItem) => void;
  onDeleteLink: (id: string) => void;
  onOpenPdf?: (entry: DeviceFileEntry) => void;
}

const LINK_CATEGORIES: { id: SavedLinkCategory; label: string }[] = [
  { id: 'reference', label: 'Reference' },
  { id: 'pdf-source', label: 'PDF / Book Source' },
  { id: 'study', label: 'Study Notes' },
  { id: 'voice-ai', label: 'AI / Voice' },
  { id: 'other', label: 'Other' },
];

function normalizeSafeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export const PdfLinksPanel: React.FC<PdfLinksPanelProps> = ({
  links,
  pdfEntries,
  onSaveLink,
  onDeleteLink,
  onOpenPdf,
}) => {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [category, setCategory] = useState<SavedLinkCategory>('reference');
  const [linkedPdfId, setLinkedPdfId] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<'all' | SavedLinkCategory>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const pdfMap = useMemo(() => {
    const m: Record<string, DeviceFileEntry> = {};
    for (const p of pdfEntries) m[p.id] = p;
    return m;
  }, [pdfEntries]);

  const filteredLinks = useMemo(() => {
    let list = [...links].sort((a, b) => b.createdAt - a.createdAt);
    if (catFilter !== 'all') {
      list = list.filter((l) => l.category === catFilter);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.url.toLowerCase().includes(q) ||
          (l.notes || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [links, catFilter, query]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setUrlInput('');
    setCategory('reference');
    setLinkedPdfId('');
    setNotes('');
    setFormError(null);
  };

  const startEdit = (item: SavedLinkItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setUrlInput(item.url);
    setCategory(item.category);
    setLinkedPdfId(item.linkedPdfId || '');
    setNotes(item.notes || '');
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const safeUrl = normalizeSafeUrl(urlInput);
    if (!safeUrl) {
      setFormError('Enter a valid web link (e.g. https://example.com).');
      return;
    }
    let fallbackTitle = safeUrl;
    try {
      fallbackTitle = new URL(safeUrl).hostname.replace(/^www\./, '');
    } catch {
      // ignore
    }

    const nextItem: SavedLinkItem = {
      id: editingId || `link:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim() || fallbackTitle,
      url: safeUrl,
      category,
      linkedPdfId: linkedPdfId || undefined,
      notes: notes.trim() || undefined,
      createdAt: editingId
        ? links.find((l) => l.id === editingId)?.createdAt || Date.now()
        : Date.now(),
    };
    onSaveLink(nextItem);
    resetForm();
    setFormOpen(false);
  };

  const handleCopy = async (item: SavedLinkItem) => {
    try {
      await navigator.clipboard.writeText(item.url);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((c) => (c === item.id ? null : c)), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-4">
      {/* Header + Add Link Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-white">Saved Links</h2>
          <p className="text-xs text-zinc-400">
            Save book sources, web articles, research URLs, and reading references locally.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (formOpen) {
              setFormOpen(false);
              resetForm();
            } else {
              resetForm();
              setFormOpen(true);
            }
          }}
          className="flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#5ea3ff] px-3.5 text-xs font-semibold text-zinc-950 hover:bg-[#7cb5ff]"
        >
          {formOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          <span>{formOpen ? 'Cancel' : 'Save New Link'}</span>
        </button>
      </div>

      {/* Add / Edit Link Form */}
      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/95 p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                URL *
              </label>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://..."
                autoFocus
                className="min-h-[42px] w-full rounded-xl border border-zinc-800 bg-black/70 px-3 text-sm text-white placeholder:text-zinc-500 focus:border-[#5ea3ff] focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Link Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Dune Reading Guide, Archive..."
                className="min-h-[42px] w-full rounded-xl border border-zinc-800 bg-black/70 px-3 text-sm text-white placeholder:text-zinc-500 focus:border-[#5ea3ff] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SavedLinkCategory)}
                className="min-h-[42px] w-full rounded-xl border border-zinc-800 bg-black/70 px-3 text-sm text-white focus:border-[#5ea3ff] focus:outline-none"
              >
                {LINK_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Attach to PDF (Optional)
              </label>
              <select
                value={linkedPdfId}
                onChange={(e) => setLinkedPdfId(e.target.value)}
                className="min-h-[42px] w-full rounded-xl border border-zinc-800 bg-black/70 px-3 text-sm text-white focus:border-[#5ea3ff] focus:outline-none"
              >
                <option value="">None (General Link)</option>
                {pdfEntries.map((pdf) => (
                  <option key={pdf.id} value={pdf.id}>
                    {pdf.name.replace(/\.pdf$/i, '')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Short note about this link..."
              className="min-h-[42px] w-full rounded-xl border border-zinc-800 bg-black/70 px-3 text-sm text-white placeholder:text-zinc-500 focus:border-[#5ea3ff] focus:outline-none"
            />
          </div>

          {formError && <p className="text-xs text-rose-400">{formError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="submit"
              className="min-h-[42px] rounded-xl bg-[#5ea3ff] px-5 text-xs font-semibold text-zinc-950 hover:bg-[#7cb5ff]"
            >
              {editingId ? 'Update Link' : 'Save Link'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Category Filter */}
      {links.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search saved links..."
              className="min-h-[40px] w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear link search"
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setCatFilter('all')}
              className={`min-h-[34px] shrink-0 rounded-lg px-3 text-xs font-medium ${
                catFilter === 'all'
                  ? 'bg-zinc-100 text-zinc-950'
                  : 'border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
              }`}
            >
              All ({links.length})
            </button>
            {LINK_CATEGORIES.map((c) => {
              const count = links.filter((l) => l.category === c.id).length;
              if (count === 0) return null;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCatFilter(c.id)}
                  className={`min-h-[34px] shrink-0 rounded-lg px-3 text-xs font-medium whitespace-nowrap ${
                    catFilter === c.id
                      ? 'bg-zinc-100 text-zinc-950'
                      : 'border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                  }`}
                >
                  {c.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Links List */}
      {filteredLinks.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 px-6 py-12 text-center">
          <Link2 className="mx-auto h-9 w-9 text-zinc-600" />
          <p className="mt-3 text-sm font-medium text-zinc-200">
            {links.length === 0 ? 'No saved links yet' : 'No links match your search'}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Tap "Save New Link" to store book URLs, references, or study websites.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredLinks.map((item) => {
            const attachedPdf = item.linkedPdfId ? pdfMap[item.linkedPdfId] : undefined;
            const catLabel =
              LINK_CATEGORIES.find((c) => c.id === item.category)?.label || 'Link';

            return (
              <div
                key={item.id}
                className="flex flex-col gap-2.5 rounded-2xl border border-zinc-800/80 bg-zinc-950/85 p-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate font-display text-sm font-semibold text-white hover:text-[#5ea3ff]"
                    >
                      {item.title}
                    </a>
                    <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-300">
                      {catLabel}
                    </span>
                  </div>

                  <p className="truncate font-mono text-xs text-cyan-300/90">{item.url}</p>

                  {item.notes && <p className="text-xs text-zinc-400">{item.notes}</p>}

                  {attachedPdf && (
                    <button
                      type="button"
                      onClick={() => onOpenPdf?.(attachedPdf)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/90 px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:border-[#5ea3ff]/50 hover:text-white"
                    >
                      <FileText className="h-3 w-3 text-[#ef4444]" />
                      <span className="truncate max-w-[220px]">
                        {attachedPdf.name.replace(/\.pdf$/i, '')}
                      </span>
                    </button>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${item.title}`}
                    className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs font-medium text-zinc-100 hover:bg-zinc-800"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Open</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleCopy(item)}
                    aria-label={`Copy ${item.title} URL`}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-900 hover:text-white"
                  >
                    {copiedId === item.id ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    aria-label={`Edit ${item.title}`}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-900 hover:text-white"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteLink(item.id)}
                    aria-label={`Delete ${item.title}`}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 hover:bg-red-950/50 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
