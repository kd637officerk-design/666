import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Fingerprint, Lock, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { GestureLockSettings } from '../types';
import { verifyGesturePattern } from '../lib/gestureSecurity';
import { GesturePadStatus, GesturePatternPad } from './GesturePatternPad';

export type GestureLockModalMode = 'unlock' | 'setup' | 'change' | 'verify';

interface GestureLockModalProps {
  open: boolean;
  mode: GestureLockModalMode;
  targetTitle?: string;
  targetSubtitle?: string;
  settings: GestureLockSettings;
  onBack: () => void;
  onUnlockSuccess: () => void;
  onPatternSaved: (pattern: number[]) => void;
}

export const GestureLockModal: React.FC<GestureLockModalProps> = ({
  open,
  mode,
  targetTitle,
  targetSubtitle,
  settings,
  onBack,
  onUnlockSuccess,
  onPatternSaved,
}) => {
  const [padStatus, setPadStatus] = useState<GesturePadStatus>('idle');
  const [step, setStep] = useState<'draw' | 'confirm'>('draw');
  const [draftPattern, setDraftPattern] = useState<number[]>([]);
  const [liveCount, setLiveCount] = useState(0);
  const [feedback, setFeedback] = useState<string>('');
  const [attempts, setAttempts] = useState(0);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setPadStatus('idle');
    setStep('draw');
    setDraftPattern([]);
    setLiveCount(0);
    setAttempts(0);
    setFeedback(
      mode === 'setup' || mode === 'change'
        ? 'Draw a pattern connecting at least 4 dots'
        : 'Draw your finger gesture to continue'
    );
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [open, mode]);

  if (!open) return null;

  const scheduleReset = (nextFeedback: string, delay = 650) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setPadStatus('idle');
      setLiveCount(0);
      setFeedback(nextFeedback);
    }, delay);
  };

  const handleBackAction = () => {
    if ((mode === 'setup' || mode === 'change') && step === 'confirm') {
      setStep('draw');
      setDraftPattern([]);
      setPadStatus('idle');
      setLiveCount(0);
      setFeedback('Draw a pattern connecting at least 4 dots');
      return;
    }
    onBack();
  };

  const handlePatternComplete = async (pattern: number[]) => {
    if (pattern.length < 4) {
      setPadStatus('error');
      setFeedback('Connect at least 4 dots with your finger');
      scheduleReset(
        step === 'confirm'
          ? 'Redraw the same gesture to confirm'
          : mode === 'setup' || mode === 'change'
            ? 'Draw a pattern connecting at least 4 dots'
            : 'Draw your finger gesture to continue',
        650
      );
      return;
    }

    if (mode === 'setup' || mode === 'change') {
      if (step === 'draw') {
        setDraftPattern(pattern);
        setStep('confirm');
        setPadStatus('success');
        setFeedback('Great! Draw the same gesture again to confirm');
        scheduleReset('Draw your gesture again to confirm', 480);
        return;
      }

      const matches =
        pattern.length === draftPattern.length &&
        pattern.every((n, i) => n === draftPattern[i]);

      if (matches) {
        setPadStatus('success');
        setFeedback('Gesture saved');
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          onPatternSaved(pattern);
        }, 280);
      } else {
        setPadStatus('error');
        setFeedback('Gestures did not match — try confirming again');
        scheduleReset('Redraw the same gesture to confirm', 750);
      }
      return;
    }

    // Unlock / Verify mode
    const valid = await verifyGesturePattern(pattern, settings);
    if (valid) {
      setPadStatus('success');
      setFeedback('Unlocked');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onUnlockSuccess();
      }, 220);
    } else {
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      setPadStatus('error');
      setFeedback(`Incorrect gesture (attempt ${nextAttempts}) — draw again`);
      scheduleReset('Draw your finger gesture to unlock', 700);
    }
  };

  const headerTitle =
    mode === 'setup'
      ? 'Set Finger Gesture'
      : mode === 'change'
        ? 'Change Finger Gesture'
        : mode === 'verify'
          ? 'Verify Gesture'
          : targetTitle || 'Locked Area';

  const subtitle =
    targetSubtitle ||
    (mode === 'setup' || mode === 'change'
      ? step === 'draw'
        ? 'Step 1 of 2 · Swipe smoothly across 4+ dots'
        : 'Step 2 of 2 · Confirm your gesture'
      : 'Draw your saved finger gesture');

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-[#07070a]/96 text-zinc-100 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label={headerTitle}
      onTouchStart={(e) => {
        if (e.touches.length === 1) {
          swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
      }}
      onTouchEnd={(e) => {
        const s = swipeStartRef.current;
        swipeStartRef.current = null;
        if (!s || e.changedTouches.length === 0) return;
        // Swipe right along top header area (>90px right drag with small vertical movement) acts as Back
        if (s.y < 110) {
          const dx = e.changedTouches[0].clientX - s.x;
          const dy = Math.abs(e.changedTouches[0].clientY - s.y);
          if (dx > 85 && dy < 48) {
            handleBackAction();
          }
        }
      }}
    >
      {/* Top Bar with Prominent Back Arrow ("flecha to go back") */}
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800/80 px-3 py-3 sm:px-5">
        <button
          type="button"
          onClick={handleBackAction}
          aria-label="Go back"
          className="flex min-h-[44px] items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/90 px-3.5 text-sm font-medium text-zinc-100 hover:bg-zinc-800 active:scale-95"
        >
          <ArrowLeft className="h-5 w-5 text-amber-300" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-400">
          {mode === 'setup' || mode === 'change' ? (
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          ) : (
            <Lock className="h-4 w-4 text-amber-400" />
          )}
          <span>Gesture Vault</span>
        </div>

        <button
          type="button"
          onClick={onBack}
          aria-label="Close"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {/* Center Finger Gesture Prompt */}
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-5 py-6">
        <div className="flex flex-col items-center text-center">
          <div
            className={`mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border ${
              padStatus === 'error'
                ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                : padStatus === 'success'
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-amber-400/35 bg-amber-400/10 text-amber-300'
            }`}
          >
            <Fingerprint className="h-7 w-7" />
          </div>
          <h2 className="font-display text-xl font-bold text-white">{headerTitle}</h2>
          <p className="mt-1 max-w-xs text-xs text-zinc-400">{subtitle}</p>
        </div>

        <GesturePatternPad
          status={padStatus}
          minNodes={4}
          onPatternChange={(p) => {
            setLiveCount(p.length);
            if (p.length > 0) setPadStatus('drawing');
          }}
          onPatternComplete={(p) => void handlePatternComplete(p)}
        />

        <div className="flex min-h-[44px] flex-col items-center justify-center gap-2 text-center">
          <p
            className={`text-xs font-medium ${
              padStatus === 'error'
                ? 'text-rose-400'
                : padStatus === 'success'
                  ? 'text-emerald-400'
                  : 'text-zinc-300'
            }`}
          >
            {padStatus === 'drawing'
              ? `Connecting ${liveCount} dot${liveCount === 1 ? '' : 's'}… release finger to confirm`
              : feedback}
          </p>

          {(mode === 'setup' || mode === 'change') && step === 'confirm' && (
            <button
              type="button"
              onClick={() => {
                setStep('draw');
                setDraftPattern([]);
                setPadStatus('idle');
                setLiveCount(0);
                setFeedback('Draw a pattern connecting at least 4 dots');
              }}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Redraw first gesture</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
