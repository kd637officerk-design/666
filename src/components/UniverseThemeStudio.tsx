import React, { useRef, useState } from 'react';
import {
  Download,
  Hammer,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  DiyPdfThemeConfig,
  PdfPageFilter,
  PdfThemeId,
  SavedDiyTheme,
  WallpaperItem,
} from '../types';
import { PDF_THEME_PRESETS, UNIVERSE_THEME_ORDER } from '../lib/pdfEngine';

interface UniverseThemeStudioProps {
  activeTheme: PdfThemeId;
  diyConfig: DiyPdfThemeConfig;
  savedDiyThemes: SavedDiyTheme[];
  universeImages: Record<string, string>;
  activeWallpaper: WallpaperItem | null;
  generatingThemeId: string | null;
  aiError: string | null;
  onSelectTheme: (theme: PdfThemeId) => void;
  onUpdateDiyConfig: (cfg: DiyPdfThemeConfig) => void;
  onSaveNewDiyTheme: (name: string, cfg: DiyPdfThemeConfig) => void;
  onDeleteSavedDiyTheme: (id: string) => void;
  onExportDiyJson: () => void;
  onImportDiyJson: (file: File) => void;
  onGenerateAiImage: (themeId: Exclude<PdfThemeId, 'diy'>, customPrompt?: string) => Promise<void>;
  onClearAiImage: (themeId: string) => void;
  onClose?: () => void;
}

export const UniverseThemeStudio: React.FC<UniverseThemeStudioProps> = ({
  activeTheme,
  diyConfig,
  savedDiyThemes,
  universeImages,
  activeWallpaper,
  generatingThemeId,
  aiError,
  onSelectTheme,
  onUpdateDiyConfig,
  onSaveNewDiyTheme,
  onDeleteSavedDiyTheme,
  onExportDiyJson,
  onImportDiyJson,
  onGenerateAiImage,
  onClearAiImage,
  onClose,
}) => {
  const [showDiyCreator, setShowDiyCreator] = useState(activeTheme === 'diy');
  const [diyName, setDiyName] = useState(diyConfig.name || 'My Custom Theme');
  const [customAiPrompt, setCustomAiPrompt] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  const activePreset = activeTheme === 'diy' ? null : PDF_THEME_PRESETS[activeTheme];
  const activeAiUrl = activePreset ? universeImages[activePreset.id] : undefined;
  const isGeneratingCurrent = activePreset ? generatingThemeId === activePreset.id : false;

  const filteredUniverses = UNIVERSE_THEME_ORDER.filter((id) => {
    if (!searchTerm.trim()) return true;
    const p = PDF_THEME_PRESETS[id];
    const q = searchTerm.toLowerCase();
    return p.label.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q);
  });

  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-[#07191d] via-[#091117] to-[#08090d] p-4 shadow-2xl">
      {/* Header matching DIY: THEMES & STYLE */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="h-4 w-1 rounded-full bg-cyan-400" />
          <h3 className="font-mono text-sm font-semibold tracking-[0.14em] text-zinc-100 uppercase">
            DIY: THEMES &amp; STYLE
          </h3>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close theme studio"
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold tracking-[0.16em] text-amber-300/90 uppercase">
          UNIVERSES ({filteredUniverses.length + 1})
        </span>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter universe (e.g. Dune, Arcane...)"
          className="min-h-[36px] w-full rounded-lg border border-white/10 bg-black/45 px-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-400/50 focus:outline-none sm:w-64"
        />
      </div>

      {/* Tactile Glowing Universe Grid (inspired by user screenshots) */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            onSelectTheme('diy');
            setShowDiyCreator(true);
          }}
          className="flex min-h-[44px] items-center gap-2 rounded-lg border px-3.5 text-[13px] font-semibold transition-all whitespace-nowrap"
          style={{
            borderColor: activeTheme === 'diy' ? diyConfig.accentColor : 'rgba(161,161,170,0.4)',
            backgroundColor: activeTheme === 'diy' ? 'rgba(20, 26, 36, 0.96)' : 'rgba(10, 14, 18, 0.85)',
            color: '#f4f4f5',
            boxShadow:
              activeTheme === 'diy'
                ? `0 0 16px ${diyConfig.accentColor}55, inset 0 0 10px ${diyConfig.accentColor}22`
                : 'none',
          }}
        >
          <span aria-hidden="true">🎨</span>
          <span>DIY Studio</span>
        </button>

        {filteredUniverses.map((id) => {
          const preset = PDF_THEME_PRESETS[id];
          const active = activeTheme === id;
          const hasAiArt = Boolean(universeImages[id]);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTheme(id)}
              className="flex min-h-[44px] items-center gap-2 rounded-lg border px-3.5 text-[13px] font-semibold transition-all whitespace-nowrap"
              style={{
                borderColor: active ? preset.accentColor : `${preset.accentColor}75`,
                backgroundColor: active ? 'rgba(14, 21, 30, 0.98)' : 'rgba(10, 14, 19, 0.88)',
                color: '#f8fafc',
                boxShadow: active
                  ? `0 0 18px ${preset.glowColor}, inset 0 0 10px ${preset.accentColor}28`
                  : 'none',
              }}
            >
              <span aria-hidden="true">{preset.emblem}</span>
              <span>{preset.label}</span>
              {hasAiArt && (
                <Sparkles
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: preset.accentColor }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Saved Custom DIY Themes List */}
      {savedDiyThemes.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
          <p className="font-mono text-[11px] tracking-[0.14em] text-zinc-400 uppercase">
            My Saved DIY Themes
          </p>
          <div className="flex flex-wrap gap-2">
            {savedDiyThemes.map((item) => (
              <div
                key={item.id}
                className="flex min-h-[40px] items-center gap-1 rounded-lg border bg-black/50 pl-3 pr-1.5"
                style={{ borderColor: item.config.accentColor }}
              >
                <button
                  type="button"
                  onClick={() => {
                    onUpdateDiyConfig({ ...item.config, name: item.name });
                    onSelectTheme('diy');
                  }}
                  className="text-xs font-semibold text-zinc-100 hover:text-white"
                >
                  {item.name}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteSavedDiyTheme(item.id)}
                  aria-label={`Delete DIY theme ${item.name}`}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-red-950/60 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Universe Image Generator Section */}
      {activePreset && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/45 p-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base">{activePreset.emblem}</span>
                <p className="text-sm font-semibold text-white">
                  {activePreset.label} · AI Universe Art
                </p>
              </div>
              <p className="mt-0.5 text-xs text-zinc-400">{activePreset.subtitle}</p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {activeAiUrl && (
                <button
                  type="button"
                  onClick={() => onClearAiImage(activePreset.id)}
                  aria-label="Remove generated universe art"
                  className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
              )}
              <button
                type="button"
                disabled={Boolean(generatingThemeId)}
                onClick={() =>
                  void onGenerateAiImage(
                    activePreset.id,
                    customAiPrompt.trim() ? customAiPrompt.trim() : undefined
                  )
                }
                className="flex min-h-[40px] items-center gap-2 rounded-lg px-3.5 text-xs font-semibold text-zinc-950 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: activePreset.accentColor }}
              >
                {isGeneratingCurrent ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>{activeAiUrl ? 'Regenerate AI Image' : 'Generate AI Image'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-2.5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <input
              type="text"
              value={customAiPrompt}
              onChange={(e) => setCustomAiPrompt(e.target.value)}
              placeholder={`Optional custom scene prompt for ${activePreset.label}...`}
              className="min-h-[38px] flex-1 rounded-lg border border-white/10 bg-zinc-950/90 px-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-400/50 focus:outline-none"
            />
            {activeAiUrl && (
              <div className="flex items-center gap-2">
                <img
                  src={activeAiUrl}
                  alt={`${activePreset.label} AI preview`}
                  className="h-10 w-18 rounded-md border border-white/15 object-cover"
                />
                <span className="font-mono text-[11px] text-emerald-300">Active Backdrop</span>
              </div>
            )}
          </div>

          {aiError && (
            <p className="mt-2 text-xs text-rose-300">{aiError}</p>
          )}
        </div>
      )}

      {/* DIY Action Rows (matching screenshot: CREATE A DIY THEME, EXPORT, IMPORT) */}
      <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={() => {
            onSelectTheme('diy');
            setShowDiyCreator((v) => !v);
          }}
          className="flex min-h-[52px] w-full items-center gap-3.5 rounded-xl border border-white/10 bg-[#0b1218]/90 px-3.5 text-left hover:border-cyan-400/40 hover:bg-[#101922]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-teal-400/30 bg-teal-950/60 text-teal-300">
            <Hammer className="h-4 w-4" />
          </span>
          <span className="font-mono text-xs font-semibold tracking-[0.14em] text-zinc-100 uppercase">
            CREATE A DIY THEME
          </span>
        </button>

        {showDiyCreator && (
          <div className="space-y-3 rounded-xl border border-cyan-500/25 bg-black/55 p-3.5">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={diyName}
                onChange={(e) => setDiyName(e.target.value)}
                placeholder="Theme name (e.g. Akira Crimson)"
                className="min-h-[40px] flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-xs text-white focus:border-cyan-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  onSaveNewDiyTheme(diyName.trim() || 'Custom DIY Theme', diyConfig);
                }}
                className="min-h-[40px] rounded-lg bg-cyan-400 px-4 text-xs font-semibold text-zinc-950 hover:bg-cyan-300"
              >
                Save DIY Theme
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <label className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                <span className="text-xs text-zinc-300">Backdrop</span>
                <input
                  type="color"
                  value={diyConfig.bgColor}
                  onChange={(e) => onUpdateDiyConfig({ ...diyConfig, bgColor: e.target.value })}
                  className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent"
                />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                <span className="text-xs text-zinc-300">Accent</span>
                <input
                  type="color"
                  value={diyConfig.accentColor}
                  onChange={(e) => onUpdateDiyConfig({ ...diyConfig, accentColor: e.target.value })}
                  className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent"
                />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                <span className="text-xs text-zinc-300">Page Border</span>
                <input
                  type="color"
                  value={diyConfig.frameBorderColor}
                  onChange={(e) =>
                    onUpdateDiyConfig({ ...diyConfig, frameBorderColor: e.target.value })
                  }
                  className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'natural', label: 'Natural' },
                    { id: 'dark-invert', label: 'Dark Invert' },
                    { id: 'sepia', label: 'Warm Sepia' },
                    { id: 'noir-ink', label: 'Noir Ink' },
                    { id: 'vibrant', label: 'Comic Boost' },
                  ] as { id: PdfPageFilter; label: string }[]
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onUpdateDiyConfig({ ...diyConfig, pageFilter: f.id })}
                    className={`min-h-[34px] rounded-lg px-2.5 text-xs font-medium ${
                      diyConfig.pageFilter === f.id
                        ? 'bg-zinc-100 text-zinc-950'
                        : 'border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={!activeWallpaper}
                onClick={() =>
                  onUpdateDiyConfig({
                    ...diyConfig,
                    showWallpaperBehind: !diyConfig.showWallpaperBehind,
                  })
                }
                className={`min-h-[36px] rounded-lg border px-3 text-xs font-medium disabled:opacity-40 ${
                  diyConfig.showWallpaperBehind
                    ? 'border-violet-500 bg-violet-600/20 text-violet-200'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-300'
                }`}
              >
                {activeWallpaper
                  ? diyConfig.showWallpaperBehind
                    ? '4K GIF Behind: ON'
                    : '4K GIF Behind: OFF'
                  : 'No 4K Wallpaper'}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onExportDiyJson}
          className="flex min-h-[52px] w-full items-center gap-3.5 rounded-xl border border-white/10 bg-[#0b1218]/90 px-3.5 text-left hover:border-amber-400/40 hover:bg-[#101922]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-950/50 text-amber-300">
            <Upload className="h-4 w-4" />
          </span>
          <span className="font-mono text-xs font-semibold tracking-[0.14em] text-zinc-100 uppercase">
            EXPORT MY DIY THEMES (JSON)
          </span>
        </button>

        <button
          type="button"
          onClick={() => importInputRef.current?.click()}
          className="flex min-h-[52px] w-full items-center gap-3.5 rounded-xl border border-white/10 bg-[#0b1218]/90 px-3.5 text-left hover:border-emerald-400/40 hover:bg-[#101922]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-950/50 text-emerald-300">
            <Download className="h-4 w-4" />
          </span>
          <span className="font-mono text-xs font-semibold tracking-[0.14em] text-zinc-100 uppercase">
            IMPORT DIY THEMES (JSON)
          </span>
        </button>

        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImportDiyJson(file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
};
