import React, { useEffect, useState } from 'react';
import { MainWorkspace, WallpaperConfig, WallpaperItem } from '../types';

interface WallpaperLayerProps {
  wallpaper: WallpaperItem | null;
  config: WallpaperConfig;
  activeWorkspace: MainWorkspace;
}

export const WallpaperLayer: React.FC<WallpaperLayerProps> = ({
  wallpaper,
  config,
  activeWorkspace,
}) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!wallpaper?.blob) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(wallpaper.blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [wallpaper]);

  const shouldShow =
    Boolean(objectUrl) &&
    config.scope !== 'off' &&
    (config.scope === 'global' ||
      (config.scope === 'audio' && activeWorkspace === 'audio') ||
      (config.scope === 'pdf' && activeWorkspace === 'pdf'));

  if (!shouldShow || !objectUrl || !wallpaper) return null;

  const fitClass = config.fit === 'contain' ? 'object-contain' : 'object-cover';

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#09090b]"
    >
      {wallpaper.isVideo ? (
        <video
          src={objectUrl}
          autoPlay
          loop
          muted
          playsInline
          className={`h-full w-full ${fitClass}`}
          style={{
            filter: config.blurPx > 0 ? `blur(${config.blurPx}px)` : undefined,
            transform: config.blurPx > 0 ? 'scale(1.04)' : undefined,
          }}
        />
      ) : (
        <img
          src={objectUrl}
          alt=""
          referrerPolicy="no-referrer"
          className={`h-full w-full ${fitClass}`}
          style={{
            filter: config.blurPx > 0 ? `blur(${config.blurPx}px)` : undefined,
            transform: config.blurPx > 0 ? 'scale(1.04)' : undefined,
          }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: `rgba(9, 9, 11, ${Math.min(0.92, Math.max(0, config.dimOpacity / 100))})`,
        }}
      />
    </div>
  );
};
