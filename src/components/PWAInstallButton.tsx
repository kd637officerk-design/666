import React, { useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'row';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'row' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    if (variant === 'compact') {
      return (
        <button
          type="button"
          onClick={() => void install()}
          className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 text-xs font-semibold text-zinc-950 hover:bg-amber-300 transition-colors"
        >
          <Download className="h-4 w-4" />
          <span>Install Symphony No. 9</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => void install()}
        className="flex min-h-[46px] w-full items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3.5 text-left text-sm text-amber-200 hover:bg-amber-500/25 transition-colors"
      >
        <span className="flex items-center gap-3">
          <Download className="h-4 w-4 shrink-0 text-amber-300" />
          <span>
            <span className="block font-medium text-white">Install App on Device</span>
            <span className="block text-[11px] text-amber-200/80">
              Launch standalone with lock-screen media controls
            </span>
          </span>
        </span>
        <span className="rounded-lg bg-amber-400 px-2.5 py-1 font-mono text-[11px] font-bold text-zinc-950">
          Install
        </span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-zinc-200 hover:bg-zinc-900"
        >
          <Smartphone className="h-4 w-4 text-amber-400" />
          <span>Install on iPhone / iPad</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-[#141418] p-5 text-zinc-100 shadow-2xl"
            >
              <h3 className="font-display text-base font-semibold text-white">
                Install Symphony No. 9
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-300">
                1. Tap the <strong>Share</strong> icon in Safari.<br />
                2. Scroll down and select <strong>Add to Home Screen</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 min-h-[42px] w-full rounded-xl bg-amber-400 text-xs font-semibold text-zinc-950 hover:bg-amber-300"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
