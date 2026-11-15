import React, { useMemo, useRef, useState } from 'react';
import {
  Edit3,
  FileText,
  FolderOpen,
  Headphones,
  Link2,
  Lock,
  MoreVertical,
  Palette,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import {
  AiVoiceReaderProfile,
  DeviceFileEntry,
  DiyPdfThemeConfig,
  PdfDocState,
  PdfThemeId,
  SavedDiyTheme,
  SavedLinkItem,
  WallpaperItem,
} from '../types';
import { formatBytes } from '../lib/fileSystem';
import { PDF_THEME_PRESETS, UNIVERSE_THEME_ORDER } from '../lib/pdfEngine';
import { formatExactLeaveStamp, formatReadingMinSec } from '../lib/pdfTime';
import { UniverseThemeStudio } from './UniverseThemeStudio';
import { PdfMetadataModal } from './PdfMetadataModal';
import { PdfLinksPanel } from './PdfLinksPanel';
import { AiVoiceReadersPanel } from './AiVoiceReadersPanel';

interface PdfWorkspaceProps {
  pdfEntries: DeviceFileEntry[];
  pdfStates: Record<string, PdfDocState>;
  activeTheme: PdfThemeId;
  diyConfig: DiyPdfThemeConfig;
  savedDiyThemes: SavedDiyTheme[];
  universeImages: Record<string, string>;
  activeWallpaper: WallpaperItem | null;
  generatingThemeId: string | null;
  aiError: string | null;
  savedLinks: SavedLinkItem[];
  voiceReaders: AiVoiceReaderProfile[];
  activeVoiceReaderId: string;
  ttsServerUrl: string;
  onSaveTtsServerUrl: (url: string) => void;
  onChangeTheme: (theme: PdfThemeId) => void;
  onUpdateDiyConfig: (cfg: DiyPdfThemeConfig) => void;
  onSaveNewDiyTheme: (name: string, cfg: DiyPdfThemeConfig) => void;
  onDeleteSavedDiyTheme: (id: string) => void;
  onExportDiyJson: () => void;
  onImportDiyJson: (file: File) => void;
  onGenerateAiImage: (themeId: Exclude<PdfThemeId, 'diy'>, customPrompt?: string) => Promise<void>;
  onClearAiImage: (themeId: string) => void;
  onOpenPdf: (entry: DeviceFileEntry) => void;
  onToggleStar: (id: string) => void;
  onSavePdfMetadata: (
    id: string,
    updates: { author: string; tags: string[]; summaryNotes: string }
  ) => void;
  onSaveLink: (item: SavedLinkItem) => void;
  onDeleteLink: (id: string) => void;
  onSelectVoiceReader: (id: string) => void;
  onSaveCustomVoiceReader: (reader: AiVoiceReaderProfile) => void;
  onDeleteCustomVoiceReader: (id: string) => void;
  onImportPdfFiles: (files: FileList) => Promise<void>;
  onOpenPermissions: () => void;
  onDeleteFile: (entry: DeviceFileEntry) => Promise<void>;
  wallpaperActive: boolean;
  gestureLockEnabled: boolean;
  lockPdfReader: boolean;
  isSecurityUnlocked: boolean;
  onOpenSecuritySettings: () => void;
  onLockNow: () => void;
}

export const PdfWorkspace: React.FC<PdfWorkspaceProps> = ({
  pdfEntries,
  pdfStates,
  activeTheme,
  diyConfig,
  savedDiyThemes,
  universeImages,
  activeWallpaper,
  generatingThemeId,
  aiError,
  savedLinks,
  voiceReaders,
  activeVoiceReaderId,
  ttsServerUrl,
  onSaveTtsServerUrl,
  onChangeTheme,
  onUpdateDiyConfig,
  onSaveNewDiyTheme,
  onDeleteSavedDiyTheme,
  onExportDiyJson,
  onImportDiyJson,
  onGenerateAiImage,
  onClearAiImage,
  onOpenPdf,
  onToggleStar,
  onSavePdfMetadata,
  onSaveLink,
  onDeleteLink,
  onSelectVoiceReader,
  onSaveCustomVoiceReader,
  onDeleteCustomVoiceReader,
  onImportPdfFiles,
  onOpenPermissions,
  onDeleteFile,
  wallpaperActive,
  gestureLockEnabled,
  lockPdfReader,
  isSecurityUnlocked,
  onOpenSecuritySettings,
  onLockNow,
}) => {
  const [tab, setTab] = useState<'recent' | 'starred' | 'device' | 'links' | 'voices'>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [menuEntry, setMenuEntry] = useState<DeviceFileEntry | null>(null);
  const [metadataEntry, setMetadataEntry] = useState<DeviceFileEntry | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allCustomTags = useMemo(() => {
    const tagSet = new Map<string, string>();
    for (const st of Object.values(pdfStates)) {
      for (const raw of st.tags || []) {
        const clean = raw.trim();
        if (clean && !tagSet.has(clean.toLowerCase())) {
          tagSet.set(clean.toLowerCase(), clean);
        }
      }
    }
    return Array.from(tagSet.values()).sort((a, b) => a.localeCompare(b));
  }, [pdfStates]);

  const visiblePdfs = useMemo(() => {
    let list = [...pdfEntries];
    if (tab === 'starred') {
      list = list.filter((e) => pdfStates[e.id]?.starred);
    } else if (tab === 'recent') {
      list.sort((a, b) => {
        const aOpened = Math.max(
          pdfStates[a.id]?.lastLeftAt || 0,
          pdfStates[a.id]?.lastOpenedAt || 0,
          a.lastModified
        );
        const bOpened = Math.max(
          pdfStates[b.id]?.lastLeftAt || 0,
          pdfStates[b.id]?.lastOpenedAt || 0,
          b.lastModified
        );
        return bOpened - aOpened;
      });
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    if (selectedTag) {
      const targetLower = selectedTag.toLowerCase();
      list = list.filter((e) =>
        (pdfStates[e.id]?.tags || []).some((t) => t.toLowerCase() === targetLower)
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => {
        const st = pdfStates[e.id];
        return (
          e.name.toLowerCase().includes(q) ||
          e.folderPath.toLowerCase().includes(q) ||
          (st?.author || '').toLowerCase().includes(q) ||
          (st?.summaryNotes || '').toLowerCase().includes(q) ||
          (st?.tags || []).some((t) => t.toLowerCase().includes(q))
        );
      });
    }
    return list;
  }, [pdfEntries, pdfStates, tab, selectedTag, searchQuery]);

  const formatShortDate = (ms: number) => {
    try {
      return new Date(ms).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const activePreset = activeTheme === 'diy' ? null : PDF_THEME_PRESETS[activeTheme];
  const activeAccent = activePreset ? activePreset.accentColor : diyConfig.accentColor;

  return (
    <div
      className={`relative flex h-full flex-col text-zinc-100 ${
        wallpaperActive ? 'bg-transparent [text-shadow:0_1px_3px_rgba(0,0,0,0.85)]' : 'bg-black'
      }`}
    >
      {/* Adobe Acrobat-inspired Top Header */}
      <header
        className={`shrink-0 px-4 pt-3 pb-2 ${
          wallpaperActive ? 'bg-black/35 backdrop-blur-md' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dc2626]/40 bg-[#dc2626]/15">
              <FileText className="h-4 w-4 text-[#ef4444]" />
            </div>
            <span className="font-display text-lg font-semibold tracking-tight text-white">
              PDF Reader
            </span>
          </div>

          <div className="flex items-center gap-1">
            {gestureLockEnabled && lockPdfReader && isSecurityUnlocked && (
              <button
                type="button"
                onClick={onLockNow}
                aria-label="Lock PDF Reader now"
                title="Lock PDF Reader now"
                className="flex min-h-[40px] items-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-2.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25"
              >
                <Unlock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Lock</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenSecuritySettings}
              aria-label="Gesture lock security settings"
              title="Gesture Lock Settings"
              className={`flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border transition-colors ${
                gestureLockEnabled && lockPdfReader
                  ? isSecurityUnlocked
                    ? 'border-amber-400/35 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20'
                    : 'border-amber-400/60 bg-amber-400/20 text-amber-200 hover:bg-amber-400/30'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900'
              }`}
            >
              {gestureLockEnabled && lockPdfReader && !isSecurityUnlocked ? (
                <Lock className="h-4 w-4" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setStudioOpen((v) => !v)}
              aria-label="Open Universe Theme Studio"
              className="flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold text-white transition-all"
              style={{
                borderColor: activeAccent,
                backgroundColor: studioOpen ? activeAccent : 'rgba(12, 16, 22, 0.85)',
                color: studioOpen ? '#09090b' : '#f4f4f5',
              }}
            >
              <Palette className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {activePreset ? `${activePreset.emblem} ${activePreset.label}` : '🎨 DIY Studio'}
              </span>
              <span className="sm:hidden">Themes</span>
            </button>
            <button
              type="button"
              onClick={onOpenPermissions}
              aria-label="Internal storage access"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-zinc-200 hover:bg-zinc-900"
            >
              <FolderOpen className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Always-Visible PDF Search Bar */}
        <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/90 px-3 focus-within:border-[#5ea3ff]/70">
          <Search className="h-4 w-4 shrink-0 text-zinc-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search PDFs by name, author, tag, or notes..."
            aria-label="Search PDFs by name, author, tag, or notes"
            className="min-h-[42px] w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
          {searchQuery && (
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-[11px] text-zinc-400">
                {visiblePdfs.length}
              </span>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear PDF search"
                className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Quick-Scroll Universe Strip */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#5ea3ff]" />
              <span>Animated Universe Themes</span>
            </span>
            <button
              type="button"
              onClick={() => setStudioOpen((v) => !v)}
              className="font-mono text-[11px] font-semibold text-cyan-300 hover:text-cyan-200"
            >
              {studioOpen ? 'Hide Studio' : `Browse All (${UNIVERSE_THEME_ORDER.length + 1})`}
            </button>
          </div>

          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => onChangeTheme('diy')}
              className="flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-all whitespace-nowrap"
              style={{
                borderColor: activeTheme === 'diy' ? diyConfig.accentColor : 'rgba(63,63,70,0.8)',
                backgroundColor: activeTheme === 'diy' ? 'rgba(20,26,36,0.95)' : '#09090b',
                color: '#f4f4f5',
                boxShadow:
                  activeTheme === 'diy' ? `0 0 12px ${diyConfig.accentColor}55` : 'none',
              }}
            >
              <span>🎨</span>
              <span>DIY</span>
            </button>

            {UNIVERSE_THEME_ORDER.map((id) => {
              const t = PDF_THEME_PRESETS[id];
              const active = activeTheme === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChangeTheme(id)}
                  className="flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-all whitespace-nowrap"
                  style={{
                    borderColor: active ? t.accentColor : `${t.accentColor}60`,
                    backgroundColor: active ? 'rgba(14,20,28,0.98)' : '#09090b',
                    color: '#f4f4f5',
                    boxShadow: active ? `0 0 14px ${t.glowColor}` : 'none',
                  }}
                >
                  <span>{t.emblem}</span>
                  <span>{t.label}</span>
                  {universeImages[id] && (
                    <Sparkles className="h-3 w-3" style={{ color: t.accentColor }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Expandable Universe & DIY Theme Studio Sheet */}
      {studioOpen && (
        <div className="steady-scroll max-h-[65vh] shrink-0 overflow-y-auto border-b border-zinc-800 px-3 py-3 sm:px-4">
          <div className="mx-auto max-w-4xl">
            <UniverseThemeStudio
              activeTheme={activeTheme}
              diyConfig={diyConfig}
              savedDiyThemes={savedDiyThemes}
              universeImages={universeImages}
              activeWallpaper={activeWallpaper}
              generatingThemeId={generatingThemeId}
              aiError={aiError}
              onSelectTheme={onChangeTheme}
              onUpdateDiyConfig={onUpdateDiyConfig}
              onSaveNewDiyTheme={onSaveNewDiyTheme}
              onDeleteSavedDiyTheme={onDeleteSavedDiyTheme}
              onExportDiyJson={onExportDiyJson}
              onImportDiyJson={onImportDiyJson}
              onGenerateAiImage={onGenerateAiImage}
              onClearAiImage={onClearAiImage}
              onClose={() => setStudioOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Adobe-style Tabs: Recent | Starred | On device | Links | AI Voices */}
      <div className="shrink-0 border-b border-zinc-900 px-4">
        <div className="no-scrollbar flex items-center gap-5 overflow-x-auto">
          {[
            { id: 'recent' as const, label: 'Recent', icon: null },
            { id: 'starred' as const, label: 'Starred', icon: null },
            { id: 'device' as const, label: 'On device', icon: null },
            {
              id: 'links' as const,
              label: `Links${savedLinks.length > 0 ? ` (${savedLinks.length})` : ''}`,
              icon: <Link2 className="h-3.5 w-3.5" />,
            },
            {
              id: 'voices' as const,
              label: `AI Voices (${voiceReaders.length})`,
              icon: <Headphones className="h-3.5 w-3.5" />,
            },
          ].map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`relative flex min-h-[44px] shrink-0 items-center gap-1.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {active && (
                  <span className="absolute inset-x-0 bottom-0 h-[2.5px] rounded-full bg-white" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Tag Filter Strip when browsing PDFs */}
      {tab !== 'links' && tab !== 'voices' && allCustomTags.length > 0 && (
        <div className="no-scrollbar flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-zinc-900/80 px-4 py-2">
          <Tag className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <button
            type="button"
            onClick={() => setSelectedTag(null)}
            className={`min-h-[30px] shrink-0 rounded-lg px-2.5 text-xs font-medium ${
              selectedTag === null
                ? 'bg-zinc-100 text-zinc-950'
                : 'border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
            }`}
          >
            All Tags
          </button>
          {allCustomTags.map((tag) => {
            const active = selectedTag?.toLowerCase() === tag.toLowerCase();
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(active ? null : tag)}
                className={`min-h-[30px] shrink-0 rounded-lg px-2.5 text-xs font-medium whitespace-nowrap ${
                  active
                    ? 'bg-[#5ea3ff] text-zinc-950'
                    : 'border border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                #{tag}
              </button>
            );
          })}
        </div>
      )}

      {/* Workspace Body: Links Vault | AI Voice Readers | PDF Document List */}
      <div className="steady-scroll flex-1 overflow-y-auto pb-28">
        {tab === 'links' ? (
          <PdfLinksPanel
            links={savedLinks}
            pdfEntries={pdfEntries}
            onSaveLink={onSaveLink}
            onDeleteLink={onDeleteLink}
            onOpenPdf={onOpenPdf}
          />
        ) : tab === 'voices' ? (
          <AiVoiceReadersPanel
            readers={voiceReaders}
            activeReaderId={activeVoiceReaderId}
            ttsServerUrl={ttsServerUrl}
            onSaveTtsServerUrl={onSaveTtsServerUrl}
            onSelectActiveReader={onSelectVoiceReader}
            onSaveCustomReader={onSaveCustomVoiceReader}
            onDeleteCustomReader={onDeleteCustomVoiceReader}
          />
        ) : visiblePdfs.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-[#5ea3ff]">
              <FileText className="h-7 w-7" />
            </div>
            <h2 className="mt-4 font-display text-lg font-semibold text-white">
              {tab === 'starred'
                ? 'No starred PDFs'
                : selectedTag || searchQuery.trim()
                  ? 'No matching PDFs'
                  : 'No PDFs loaded yet'}
            </h2>
            <p className="mt-1 max-w-sm text-sm text-zinc-400">
              {tab === 'starred'
                ? 'Star any PDF from your list to pin it here.'
                : selectedTag || searchQuery.trim()
                  ? 'Clear the active search or tag filter to view all PDFs.'
                  : 'Tap the blue + button to open PDFs from your phone, or connect your internal storage folder.'}
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-5 flex min-h-[44px] items-center gap-2 rounded-xl bg-[#5ea3ff] px-5 text-sm font-semibold text-zinc-950 hover:bg-[#7cb5ff]"
            >
              <Plus className="h-4 w-4" />
              <span>Open PDF from Device</span>
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl divide-y divide-zinc-900">
            {visiblePdfs.map((entry) => {
              const state = pdfStates[entry.id];
              const tags = state?.tags || [];
              return (
                <div
                  key={entry.id}
                  className="lightweight-row flex min-h-[76px] items-center gap-3.5 px-4 py-3 transition-colors hover:bg-zinc-950/80"
                >
                  <button
                    type="button"
                    onClick={() => onOpenPdf(entry)}
                    className="flex min-w-0 flex-1 items-center gap-3.5 text-left focus:outline-none"
                  >
                    <div className="flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
                      {state?.thumbnailUrl ? (
                        <img
                          src={state.thumbnailUrl}
                          alt={entry.name}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-[#180b0b]">
                          <FileText className="h-5 w-5 text-[#ef4444]" />
                          <span className="mt-0.5 font-mono text-[8px] font-bold text-[#ef4444]">
                            PDF
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-white">
                        {entry.name.replace(/\.pdf$/i, '')}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-xs text-zinc-400">
                        {state?.author ? `${state.author} · ` : ''}
                        {state?.lastLeftAt
                          ? `Left ${formatExactLeaveStamp(state.lastLeftAt)}`
                          : `PDF · ${formatShortDate(entry.lastModified)}`}
                        {state?.totalPages ? ` · p.${state.currentPage || 1}/${state.totalPages}` : ''}
                        {state?.readingDurationSec && state.readingDurationSec > 0
                          ? ` · ${formatReadingMinSec(state.readingDurationSec)}`
                          : ''}
                        {state?.bookmarks && state.bookmarks.length > 0
                          ? ` · ${state.bookmarks.length} bookmark${state.bookmarks.length === 1 ? '' : 's'}`
                          : ''}
                      </p>
                      {state?.summaryNotes && (
                        <p className="mt-0.5 truncate text-xs text-zinc-400/90">
                          {state.summaryNotes}
                        </p>
                      )}
                      {tags.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {tags.slice(0, 5).map((t) => (
                            <span
                              key={t}
                              className="rounded-md border border-[#5ea3ff]/35 bg-[#5ea3ff]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#93c5fd]"
                            >
                              #{t}
                            </span>
                          ))}
                          {tags.length > 5 && (
                            <span className="font-mono text-[10px] text-zinc-500">
                              +{tags.length - 5}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setMetadataEntry(entry)}
                      aria-label={`Edit metadata for ${entry.name}`}
                      title="Edit author, tags & notes"
                      className="flex min-h-[44px] min-w-[40px] items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-[#5ea3ff]"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMenuEntry(entry)}
                      aria-label={`Options for ${entry.name}`}
                      className="flex min-h-[44px] min-w-[40px] items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-white"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Adobe-style Blue Circular + Floating Action Button */}
      {tab !== 'links' && tab !== 'voices' && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Open or add PDF"
          className="fixed bottom-20 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#5ea3ff] text-zinc-950 shadow-xl transition-transform hover:bg-[#7cb5ff] active:scale-95 sm:bottom-6 sm:right-6"
        >
          <Plus className="h-7 w-7 stroke-[2.4]" />
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            void onImportPdfFiles(e.target.files);
          }
          e.target.value = '';
        }}
      />

      {/* Document Overflow Menu */}
      {menuEntry && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center sm:p-4"
          onClick={() => setMenuEntry(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl border border-zinc-800 bg-[#141418] p-4 sm:rounded-2xl"
          >
            <div className="mb-3 border-b border-zinc-800 pb-3">
              <p className="truncate text-sm font-semibold text-white">{menuEntry.name}</p>
              <p className="font-mono text-xs text-zinc-400">
                PDF · {formatBytes(menuEntry.size)}
              </p>
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  const target = menuEntry;
                  setMenuEntry(null);
                  onOpenPdf(target);
                }}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-sm text-zinc-100 hover:bg-zinc-800"
              >
                <FileText className="h-4 w-4 text-[#5ea3ff]" />
                <span>Open PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = menuEntry;
                  setMenuEntry(null);
                  setMetadataEntry(target);
                }}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-sm text-zinc-100 hover:bg-zinc-800"
              >
                <Edit3 className="h-4 w-4 text-[#5ea3ff]" />
                <span>Edit Metadata, Tags & Notes</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onToggleStar(menuEntry.id);
                  setMenuEntry(null);
                }}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-sm text-zinc-100 hover:bg-zinc-800"
              >
                <Star
                  className={`h-4 w-4 ${
                    pdfStates[menuEntry.id]?.starred ? 'fill-amber-400 text-amber-400' : 'text-zinc-400'
                  }`}
                />
                <span>
                  {pdfStates[menuEntry.id]?.starred ? 'Remove Star' : 'Star Document'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = menuEntry;
                  setMenuEntry(null);
                  void onDeleteFile(target);
                }}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-sm text-red-400 hover:bg-red-950/40"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Metadata Editor Modal */}
      <PdfMetadataModal
        open={Boolean(metadataEntry)}
        entry={metadataEntry}
        docState={metadataEntry ? pdfStates[metadataEntry.id] || null : null}
        suggestedTags={allCustomTags}
        linkedUrls={
          metadataEntry ? savedLinks.filter((l) => l.linkedPdfId === metadataEntry.id) : []
        }
        onClose={() => setMetadataEntry(null)}
        onSaveMetadata={onSavePdfMetadata}
        onOpenLinksTab={() => setTab('links')}
      />
    </div>
  );
};
