import React, { useEffect, useRef, useState } from 'react';
import { Check, Film, ImagePlus, Layers, Trash2, Upload } from 'lucide-react';
import { DeviceFileEntry, WallpaperConfig, WallpaperItem, WallpaperScope } from '../types';
import { formatBytes, resolveEntryFile } from '../lib/fileSystem';
import { SteadyScrubber } from './SteadyScrubber';

interface WallpaperStudioProps {
  wallpapers: WallpaperItem[];
  config: WallpaperConfig;
  deviceMediaFiles: DeviceFileEntry[];
  onAddWallpaperFile: (file: File) => Promise<void>;
  onUpdateConfig: (next: WallpaperConfig) => void;
  onDeleteWallpaper: (id: string) => Promise<void>;
}

export const WallpaperStudio: React.FC<WallpaperStudioProps> = ({
  wallpapers,
  config,
  deviceMediaFiles,
  onAddWallpaperFile,
  onUpdateConfig,
  onDeleteWallpaper,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draggingOver, setDraggingOver] = useState(false);

  const imageOrGifEntries = deviceMediaFiles.filter(
    (f) => f.category === 'image' || f.extension === 'mp4' || f.extension === 'webm'
  );

  const handleFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (
        file.type.startsWith('image/') ||
        file.type.startsWith('video/') ||
        /\.(gif|webp|png|jpe?g|avif|mp4|webm)$/i.test(file.name)
      ) {
        await onAddWallpaperFile(file);
      }
    }
  };

  const scopes: { id: WallpaperScope; label: string }[] = [
    { id: 'global', label: 'Everywhere' },
    { id: 'audio', label: 'Symphony No. 9' },
    { id: 'pdf', label: 'PDF Hub' },
    { id: 'off', label: 'Off' },
  ];

  return (
    <div className="steady-scroll h-full overflow-y-auto px-4 pb-28 pt-4 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
              4K Wallpapers & Animated GIFs
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Add high-resolution 4K photos, animated 4K GIFs, or looping video wallpapers directly from your phone.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition-colors shrink-0"
          >
            <ImagePlus className="h-4 w-4" />
            <span>Add 4K Wallpaper / GIF</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/gif,image/png,image/jpeg,image/webp,image/avif,video/mp4,video/webm"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {/* Upload Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDraggingOver(true);
          }}
          onDragLeave={() => setDraggingOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDraggingOver(false);
            if (e.dataTransfer.files) void handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
          }}
          className={`flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center backdrop-blur-sm transition-colors ${
            draggingOver
              ? 'border-violet-400 bg-violet-500/15'
              : 'border-zinc-700/80 bg-black/45 hover:border-zinc-600 hover:bg-black/55'
          }`}
        >
          <Upload className="h-6 w-6 text-violet-400" />
          <p className="mt-2 text-sm font-medium text-zinc-100">
            Tap or drop 4K GIF, PNG, JPG, WebP, or MP4 wallpaper
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Stored locally on your device · Zero compression on animated GIFs
          </p>
        </div>

        {/* Display Controls */}
        <div className="grid grid-cols-1 gap-6 rounded-2xl border border-zinc-800/80 bg-black/50 p-5 backdrop-blur-md lg:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
              <Layers className="h-4 w-4 text-violet-400" />
              <span>Display Scope</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {scopes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onUpdateConfig({ ...config, scope: s.id })}
                  className={`min-h-[44px] rounded-xl px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                    config.scope === s.id
                      ? 'bg-violet-600 text-white'
                      : 'border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-zinc-300">Scaling Mode</span>
              <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
                {(['cover', 'contain'] as const).map((fit) => (
                  <button
                    key={fit}
                    type="button"
                    onClick={() => onUpdateConfig({ ...config, fit })}
                    className={`min-h-[36px] rounded-lg px-3 text-xs font-medium capitalize transition-colors ${
                      config.fit === fit
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {fit}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span>Background Dimming (Legibility Scrim)</span>
                <span className="font-mono text-zinc-400">{config.dimOpacity}%</span>
              </div>
              <SteadyScrubber
                value={config.dimOpacity}
                min={0}
                max={85}
                step={1}
                ariaLabel="Wallpaper dimming opacity"
                onChange={(val) => onUpdateConfig({ ...config, dimOpacity: Math.round(val) })}
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span>Backdrop Blur</span>
                <span className="font-mono text-zinc-400">{config.blurPx} px</span>
              </div>
              <SteadyScrubber
                value={config.blurPx}
                min={0}
                max={24}
                step={1}
                ariaLabel="Wallpaper blur amount"
                onChange={(val) => onUpdateConfig({ ...config, blurPx: Math.round(val) })}
              />
            </div>
          </div>
        </div>

        {/* Saved Wallpapers Grid */}
        <div className="space-y-3">
          <h2 className="font-display text-base font-semibold text-zinc-100">
            Your Saved Wallpapers ({wallpapers.length})
          </h2>

          {wallpapers.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-8 text-center">
              <p className="text-sm text-zinc-400">
                No wallpapers saved yet. Add a 4K GIF or photo above, or tap any image in your device storage below.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {wallpapers.map((wp) => (
                <WallpaperCard
                  key={wp.id}
                  item={wp}
                  isActive={config.activeWallpaperId === wp.id}
                  onActivate={() =>
                    onUpdateConfig({
                      ...config,
                      activeWallpaperId: wp.id,
                      scope: config.scope === 'off' ? 'global' : config.scope,
                    })
                  }
                  onDelete={() => void onDeleteWallpaper(wp.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Device Images & GIFs Quick-Import */}
        {imageOrGifEntries.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-display text-base font-semibold text-zinc-100">
              From Connected Device Storage ({imageOrGifEntries.length})
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {imageOrGifEntries.slice(0, 25).map((entry) => (
                <DeviceWallpaperQuickCard
                  key={entry.id}
                  entry={entry}
                  onUse={async () => {
                    const file = await resolveEntryFile(entry);
                    if (file) await onAddWallpaperFile(file);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const WallpaperCard: React.FC<{
  item: WallpaperItem;
  isActive: boolean;
  onActivate: () => void;
  onDelete: () => void;
}> = ({ item, isActive, onActivate, onDelete }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objUrl = URL.createObjectURL(item.blob);
    setUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [item.blob]);

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border transition-colors ${
        isActive ? 'border-violet-500 ring-1 ring-violet-500/40' : 'border-zinc-800 bg-zinc-950'
      }`}
    >
      <button
        type="button"
        onClick={onActivate}
        className="block aspect-[9/14] w-full overflow-hidden bg-zinc-900 text-left focus:outline-none"
      >
        {url &&
          (item.isVideo ? (
            <video src={url} autoPlay loop muted playsInline className="h-full w-full object-cover" />
          ) : (
            <img
              src={url}
              alt={item.name}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ))}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-3 pt-10">
          <p className="truncate text-xs font-medium text-white">{item.name}</p>
          <p className="mt-0.5 font-mono text-[11px] text-zinc-300">
            {item.isGif ? 'GIF' : item.isVideo ? 'VIDEO' : 'IMG'} · {formatBytes(item.size)}
            {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
          </p>
        </div>
      </button>

      {isActive && (
        <span className="pointer-events-none absolute left-2.5 top-2.5 flex items-center gap-1 rounded-md bg-violet-600 px-2 py-1 text-[11px] font-semibold text-white shadow">
          <Check className="h-3 w-3" />
          <span>Active</span>
        </span>
      )}

      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${item.name}`}
        className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-zinc-300 hover:bg-red-600 hover:text-white transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
};

const DeviceWallpaperQuickCard: React.FC<{
  entry: DeviceFileEntry;
  onUse: () => void;
}> = ({ entry, onUse }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objUrl: string | null = null;
    void resolveEntryFile(entry).then((file) => {
      if (!active || !file) return;
      objUrl = URL.createObjectURL(file);
      setUrl(objUrl);
    });
    return () => {
      active = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [entry]);

  return (
    <button
      type="button"
      onClick={onUse}
      className="group relative aspect-square overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 text-left hover:border-violet-500"
    >
      {url ? (
        entry.category === 'video' ? (
          <div className="flex h-full w-full items-center justify-center bg-zinc-900">
            <Film className="h-6 w-6 text-zinc-500" />
          </div>
        ) : (
          <img
            src={url}
            alt={entry.name}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        )
      ) : null}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2">
        <p className="truncate text-[11px] font-medium text-white">{entry.name}</p>
        <p className="font-mono text-[10px] text-zinc-300">
          {entry.extension.toUpperCase()} · {formatBytes(entry.size)}
        </p>
      </div>
    </button>
  );
};
