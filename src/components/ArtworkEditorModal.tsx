import React, { useEffect, useRef, useState } from 'react';
import { Check, Download, ImagePlus, Music, Trash2, X } from 'lucide-react';
import { DeviceFileEntry, TrackMetadata } from '../types';
import { buildUpdatedMp3Buffer } from '../lib/id3';
import { resolveEntryFile, writeBytesToFileHandle } from '../lib/fileSystem';

interface ArtworkEditorModalProps {
  open: boolean;
  entry: DeviceFileEntry | null;
  trackMeta: TrackMetadata | null;
  deviceImages: DeviceFileEntry[];
  onClose: () => void;
  onSaveMetadata: (
    entryId: string,
    updates: {
      title: string;
      artist: string;
      album: string;
      genre?: string;
      coverBlob?: Blob | null;
    }
  ) => Promise<void>;
}

async function normalizeCoverToSquareJpeg(
  blob: Blob,
  maxSize = 800
): Promise<{ blob: Blob; bytes: Uint8Array; mime: string }> {
  // Preserve GIF or small PNG/JPEG if <= 1.2MB and already standard, otherwise square-fit JPEG
  if (blob.type === 'image/gif' && blob.size <= 3 * 1024 * 1024) {
    return {
      blob,
      bytes: new Uint8Array(await blob.arrayBuffer()),
      mime: 'image/gif',
    };
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const size = Math.min(maxSize, Math.max(img.width, img.height, 400));
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const buf = new Uint8Array(await blob.arrayBuffer());
      return { blob, bytes: buf, mime: blob.type || 'image/jpeg' };
    }
    // Center crop to square
    const minSide = Math.min(img.width, img.height);
    const sx = (img.width - minSide) / 2;
    const sy = (img.height - minSide) / 2;
    ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
    const outBlob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b || blob), 'image/jpeg', 0.9)
    );
    const bytes = new Uint8Array(await outBlob.arrayBuffer());
    return { blob: outBlob, bytes, mime: 'image/jpeg' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const ArtworkEditorModal: React.FC<ArtworkEditorModalProps> = ({
  open,
  entry,
  trackMeta,
  deviceImages,
  onClose,
  onSaveMetadata,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [genre, setGenre] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [pendingBlob, setPendingBlob] = useState<Blob | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showDeviceGallery, setShowDeviceGallery] = useState(false);

  useEffect(() => {
    if (open && entry && trackMeta) {
      setTitle(trackMeta.title || entry.name.replace(/\.[^.]+$/, ''));
      setArtist(trackMeta.artist === '<unknown>' ? '' : trackMeta.artist || '');
      setAlbum(trackMeta.album || entry.folderPath.split('/').pop() || '');
      setGenre(trackMeta.genre || '');
      setPreviewUrl(trackMeta.coverUrl);
      setPendingBlob(undefined);
      setStatusMessage(null);
      setShowDeviceGallery(false);
    }
  }, [open, entry, trackMeta]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:') && previewUrl !== trackMeta?.coverUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, trackMeta?.coverUrl]);

  if (!open || !entry || !trackMeta) return null;

  const isMp3 = entry.extension === 'mp3';

  const handleSelectLocalImage = (file: File) => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setPendingBlob(file);
    setShowDeviceGallery(false);
    setStatusMessage(null);
  };

  const handlePickFromDeviceEntry = async (imgEntry: DeviceFileEntry) => {
    const f = await resolveEntryFile(imgEntry);
    if (f) handleSelectLocalImage(f);
  };

  const handleSave = async (alsoExportFile = false) => {
    setSaving(true);
    setStatusMessage(null);
    try {
      let finalBlob: Blob | null | undefined = pendingBlob;
      let coverBytes: Uint8Array | undefined;
      let coverMime: string | undefined;

      if (pendingBlob instanceof Blob) {
        const normalized = await normalizeCoverToSquareJpeg(pendingBlob);
        finalBlob = normalized.blob;
        coverBytes = normalized.bytes;
        coverMime = normalized.mime;
      }

      await onSaveMetadata(entry.id, {
        title: title.trim() || entry.name.replace(/\.[^.]+$/, ''),
        artist: artist.trim() || '<unknown>',
        album: album.trim(),
        genre: genre.trim(),
        coverBlob: finalBlob,
      });

      let wroteToDisk = false;
      if (isMp3 && (coverBytes || title || artist || album || genre)) {
        const sourceFile = await resolveEntryFile(entry);
        if (sourceFile) {
          const origBuf = await sourceFile.arrayBuffer();
          const updatedBytes = buildUpdatedMp3Buffer(origBuf, {
            title: title.trim() || undefined,
            artist: artist.trim() || undefined,
            album: album.trim() || undefined,
            genre: genre.trim() || undefined,
            coverBytes,
            coverMime,
          });

          if (entry.handle) {
            wroteToDisk = await writeBytesToFileHandle(entry.handle, updatedBytes);
          }

          if (alsoExportFile || (!wroteToDisk && alsoExportFile)) {
            const copy = new Uint8Array(updatedBytes.byteLength);
            copy.set(updatedBytes);
            const outBlob = new Blob([copy.buffer], { type: 'audio/mpeg' });
            const dlUrl = URL.createObjectURL(outBlob);
            const a = document.createElement('a');
            a.href = dlUrl;
            a.download = entry.name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(dlUrl), 1500);
          }
        }
      }

      if (wroteToDisk) {
        setStatusMessage('Saved artwork & tags directly into the MP3 file on your device.');
      } else if (alsoExportFile && isMp3) {
        setStatusMessage('Saved in app library and exported modified MP3 with embedded art.');
      } else {
        setStatusMessage('Artwork & tags updated in your local library.');
      }

      setTimeout(() => {
        onClose();
      }, 650);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Modify audio artwork and tags"
    >
      <div className="steady-scroll max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-zinc-800 bg-[#121215] text-zinc-100 sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-[#121215]/95 px-5 py-3.5 backdrop-blur-md">
          <h2 className="font-display text-base font-semibold text-white">
            Modify Audio Artwork & Tags
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Cover Art Preview & Pickers */}
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 flex items-center justify-center">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={title}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Music className="h-10 w-10 text-zinc-600" />
              )}
            </div>

            <div className="flex w-full flex-col gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 transition-colors"
              >
                <ImagePlus className="h-4 w-4" />
                <span>Pick Photo / Art from Phone</span>
              </button>

              {deviceImages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDeviceGallery((v) => !v)}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                  <span>
                    {showDeviceGallery
                      ? 'Hide Internal Photos'
                      : `Choose from Internal Photos (${deviceImages.length})`}
                  </span>
                </button>
              )}

              {previewUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setPreviewUrl(undefined);
                    setPendingBlob(null);
                  }}
                  className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-transparent px-3 py-1.5 text-xs font-medium text-zinc-400 hover:border-red-500/40 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Remove Artwork</span>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSelectLocalImage(file);
                e.target.value = '';
              }}
            />
          </div>

          {showDeviceGallery && deviceImages.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <p className="mb-2 text-xs text-zinc-400">
                Select any image from your connected internal storage:
              </p>
              <div className="grid max-h-40 grid-cols-4 gap-2 overflow-y-auto steady-scroll">
                {deviceImages.slice(0, 40).map((img) => (
                  <DeviceThumb
                    key={img.id}
                    entry={img}
                    onSelect={() => handlePickFromDeviceEntry(img)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Metadata Fields */}
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
                placeholder="Track title"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Artist</label>
                <input
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
                  placeholder="Artist name"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Album</label>
                <input
                  type="text"
                  value={album}
                  onChange={(e) => setAlbum(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
                  placeholder="Album name"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Genre</label>
              <input
                type="text"
                list="kurodeck-genre-suggestions"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
                placeholder="e.g. Rock, Anime, Soundtrack, Classical, Hip-Hop"
              />
              <datalist id="kurodeck-genre-suggestions">
                <option value="Classical" />
                <option value="Soundtrack" />
                <option value="Anime" />
                <option value="Rock" />
                <option value="Metal" />
                <option value="Hip-Hop" />
                <option value="Pop" />
                <option value="Electronic" />
                <option value="Jazz" />
                <option value="Lo-Fi" />
                <option value="Ambient" />
                <option value="Indie" />
              </datalist>
            </div>
          </div>

          {statusMessage && (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              {statusMessage}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave(false)}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              <span>{saving ? 'Saving...' : entry.handle && isMp3 ? 'Save Directly to Phone File' : 'Save Artwork & Tags'}</span>
            </button>

            {isMp3 && !entry.handle && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave(true)}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                title="Download MP3 with updated embedded cover art"
              >
                <Download className="h-4 w-4" />
                <span>Export .MP3</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const DeviceThumb: React.FC<{ entry: DeviceFileEntry; onSelect: () => void }> = ({
  entry,
  onSelect,
}) => {
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
      onClick={onSelect}
      className="aspect-square w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 hover:border-violet-500 focus:outline-none"
      title={entry.name}
    >
      {url ? (
        <img
          src={url}
          alt={entry.name}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full bg-zinc-900" />
      )}
    </button>
  );
};
