// Unified Android Media Notification + Lock Screen Artwork Manager
// Bridges standard Web MediaSession API (for Android Chrome / PWA Lock Screen & Notification)
// AND native Capacitor Android MediaNotificationPlugin (for full-screen lock screen art in APK).

interface NativeMediaPlugin {
  updateMedia: (options: {
    title: string;
    artist: string;
    album: string;
    isPlaying: boolean;
    durationMs: number;
    positionMs: number;
    artworkBase64?: string;
  }) => Promise<void>;
  clearMedia: () => Promise<void>;
  addListener?: (
    eventName: 'mediaAction',
    listener: (data: { action: string; positionMs?: number }) => void
  ) => Promise<{ remove: () => Promise<void> }> | { remove: () => Promise<void> };
}

function getNativeMediaPlugin(): NativeMediaPlugin | null {
  if (typeof window === 'undefined') return null;
  const cap = (
    window as unknown as {
      Capacitor?: {
        isNativePlatform?: () => boolean;
        Plugins?: { MediaNotification?: NativeMediaPlugin };
      };
    }
  ).Capacitor;
  if (!cap?.Plugins?.MediaNotification) return null;
  if (typeof cap.isNativePlatform === 'function' && !cap.isNativePlatform()) return null;
  return cap.Plugins.MediaNotification;
}

const cachedArtworkDataUrl = new WeakMap<Blob, string>();

/**
 * Converts a cover Blob into a high-res square JPEG Data URL (`1024x1024`) so
 * Android SystemUI (Lock Screen & Media Notification) can render it across processes
 * without failing on transient `blob:` URLs.
 */
export async function blobToLockScreenDataUrl(blob: Blob): Promise<string | null> {
  const existing = cachedArtworkDataUrl.get(blob);
  if (existing) return existing;

  try {
    const objUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Failed to decode cover art'));
        el.src = objUrl;
      });

      const targetSize = Math.min(1024, Math.max(512, Math.max(img.naturalWidth, img.naturalHeight)));
      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Center-crop square cover so lock-screen wallpaper fills edge-to-edge cleanly
      const scale = Math.max(targetSize / img.naturalWidth, targetSize / img.naturalHeight);
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      const dx = (targetSize - drawW) / 2;
      const dy = (targetSize - drawH) / 2;

      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, targetSize, targetSize);
      ctx.drawImage(img, dx, dy, drawW, drawH);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      cachedArtworkDataUrl.set(blob, dataUrl);
      return dataUrl;
    } finally {
      URL.revokeObjectURL(objUrl);
    }
  } catch {
    return null;
  }
}

export async function syncAndroidMediaNotification(params: {
  title: string;
  artist: string;
  album: string;
  isPlaying: boolean;
  durationSec: number;
  positionSec: number;
  artworkDataUrl?: string | null;
}) {
  const { title, artist, album, isPlaying, durationSec, positionSec, artworkDataUrl } = params;

  if ('mediaSession' in navigator) {
    const artworkList: MediaImage[] = artworkDataUrl
      ? [
          { src: artworkDataUrl, sizes: '512x512', type: 'image/jpeg' },
          { src: artworkDataUrl, sizes: '1024x1024', type: 'image/jpeg' },
        ]
      : [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ];

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: artist === '<unknown>' ? 'Symphony No. 9' : artist,
      album: album || 'Symphony No. 9',
      artwork: artworkList,
    });
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    if (
      typeof navigator.mediaSession.setPositionState === 'function' &&
      Number.isFinite(durationSec) &&
      durationSec > 0
    ) {
      try {
        navigator.mediaSession.setPositionState({
          duration: durationSec,
          playbackRate: isPlaying ? 1 : 0,
          position: Math.max(0, Math.min(durationSec, Number.isFinite(positionSec) ? positionSec : 0)),
        });
      } catch {
        // ignore invalid position edge cases
      }
    }
  }

  const nativePlugin = getNativeMediaPlugin();
  if (nativePlugin) {
    try {
      await nativePlugin.updateMedia({
        title,
        artist: artist === '<unknown>' ? 'Symphony No. 9' : artist,
        album: album || 'Symphony No. 9',
        isPlaying,
        durationMs: Math.max(0, Math.round(durationSec * 1000)),
        positionMs: Math.max(0, Math.round(positionSec * 1000)),
        artworkBase64: artworkDataUrl || undefined,
      });
    } catch {
      // ignore if native service isn't ready
    }
  }
}

export function updateAndroidMediaPosition(durationSec: number, positionSec: number, isPlaying: boolean) {
  if ('mediaSession' in navigator && typeof navigator.mediaSession.setPositionState === 'function') {
    if (Number.isFinite(durationSec) && durationSec > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: durationSec,
          playbackRate: isPlaying ? 1 : 0,
          position: Math.max(0, Math.min(durationSec, Number.isFinite(positionSec) ? positionSec : 0)),
        });
      } catch {
        // ignore
      }
    }
  }
}

export async function clearAndroidMediaNotification() {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  }
  const nativePlugin = getNativeMediaPlugin();
  if (nativePlugin) {
    try {
      await nativePlugin.clearMedia();
    } catch {
      // ignore
    }
  }
}

export function subscribeNativeMediaActions(handlers: {
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeekTo: (positionSec: number) => void;
  onStop: () => void;
}): () => void {
  const nativePlugin = getNativeMediaPlugin();
  if (!nativePlugin?.addListener) return () => {};

  let handle: { remove?: () => Promise<void> | void } | null = null;
  let active = true;

  try {
    const maybePromise = nativePlugin.addListener('mediaAction', (evt) => {
      if (!active) return;
      switch (evt.action) {
        case 'play':
          handlers.onPlay();
          break;
        case 'pause':
          handlers.onPause();
          break;
        case 'previous':
          handlers.onPrev();
          break;
        case 'next':
          handlers.onNext();
          break;
        case 'seekto':
          if (typeof evt.positionMs === 'number') {
            handlers.onSeekTo(evt.positionMs / 1000);
          }
          break;
        case 'stop':
          handlers.onStop();
          break;
      }
    });

    void Promise.resolve(maybePromise)
      .then((h) => {
        if (!active) {
          void h?.remove?.();
        } else {
          handle = h || null;
        }
      })
      .catch(() => {
        // ignore unsupported listener registration
      });
  } catch {
    // ignore if native listener bridge isn't ready
  }

  return () => {
    active = false;
    try {
      void handle?.remove?.();
    } catch {
      // ignore cleanup error
    }
  };
}
