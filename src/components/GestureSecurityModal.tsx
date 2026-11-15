import React, { useState } from 'react';
import {
  ArrowLeft,
  Clock,
  Download,
  FileCode2,
  FileText,
  FolderLock,
  FolderOpen,
  KeyRound,
  Lock,
  Plus,
  ShieldCheck,
  Unlock,
  X,
} from 'lucide-react';
import { GestureLockSettings } from '../types';
import { isFolderOrAncestorLocked, normalizeFolderPath } from '../lib/gestureSecurity';

interface GestureSecurityModalProps {
  open: boolean;
  settings: GestureLockSettings;
  folders: string[];
  isUnlocked: boolean;
  onClose: () => void;
  onToggleEnableLock: () => void;
  onRequestChangePattern: () => void;
  onUpdateSettings: (next: GestureLockSettings) => void;
  onToggleFolderLock: (folderPath: string) => void;
  onLockNow: () => void;
  onUnlockSession: () => void;
  onExportStandaloneHtml: () => void;
}

const AUTO_LOCK_OPTIONS = [
  { minutes: 0, label: 'Every open' },
  { minutes: 1, label: '1 min' },
  { minutes: 5, label: '5 min' },
  { minutes: 15, label: '15 min' },
];

export const GestureSecurityModal: React.FC<GestureSecurityModalProps> = ({
  open,
  settings,
  folders,
  isUnlocked,
  onClose,
  onToggleEnableLock,
  onRequestChangePattern,
  onUpdateSettings,
  onToggleFolderLock,
  onLockNow,
  onUnlockSession,
  onExportStandaloneHtml,
}) => {
  const [customFolderInput, setCustomFolderInput] = useState('');

  if (!open) return null;

  const allListedFolders = Array.from(
    new Set([
      ...folders.map(normalizeFolderPath).filter(Boolean),
      ...settings.lockedFolderPaths.map(normalizeFolderPath).filter(Boolean),
    ])
  ).sort((a, b) => a.localeCompare(b));

  const handleAddCustomFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeFolderPath(customFolderInput);
    if (!clean) return;
    if (!settings.lockedFolderPaths.some((p) => p.toLowerCase() === clean.toLowerCase())) {
      onToggleFolderLock(clean);
    }
    setCustomFolderInput('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Gesture Lock & Folder Security Settings"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="steady-scroll max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-zinc-800 bg-[#121217] text-zinc-100 sm:rounded-2xl"
      >
        {/* Top Header with Back Arrow ("flecha to go back") */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800/80 bg-[#121217]/95 px-4 py-3 backdrop-blur-md">
          <button
            type="button"
            onClick={onClose}
            aria-label="Go back"
            className="flex min-h-[44px] items-center gap-1.5 rounded-full px-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
          >
            <ArrowLeft className="h-5 w-5 text-amber-300" />
            <span>Back</span>
          </button>

          <span className="font-display text-sm font-semibold tracking-wide text-white">
            Gesture Security
          </span>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close security settings"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {/* Master Gesture Lock Enable Card */}
          <div
            className={`rounded-2xl border p-4 space-y-3 ${
              settings.enabled
                ? 'border-amber-400/45 bg-gradient-to-br from-amber-500/12 via-zinc-900/90 to-zinc-950'
                : 'border-zinc-800 bg-zinc-900/70'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                    settings.enabled
                      ? 'border-amber-400/40 bg-amber-400/15 text-amber-300'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-400'
                  }`}
                >
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Finger Gesture Lock</p>
                  <p className="text-xs text-zinc-400">
                    {settings.enabled && settings.patternHash
                      ? isUnlocked
                        ? `Active (${settings.patternLength}-dot gesture) · Unlocked`
                        : `Active (${settings.patternLength}-dot gesture) · Locked`
                      : 'Require a finger swipe pattern to open PDFs or sensitive folders'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onToggleEnableLock}
                aria-pressed={settings.enabled}
                aria-label={settings.enabled ? 'Disable gesture lock' : 'Enable gesture lock'}
                className={`h-7 w-12 shrink-0 rounded-full p-0.5 transition-colors ${
                  settings.enabled ? 'bg-amber-400' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`block h-6 w-6 rounded-full bg-zinc-950 transition-transform ${
                    settings.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onRequestChangePattern}
                className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs font-medium text-zinc-100 hover:bg-zinc-800"
              >
                <KeyRound className="h-3.5 w-3.5 text-amber-300" />
                <span>{settings.patternHash ? 'Change Gesture' : 'Draw New Gesture'}</span>
              </button>

              {settings.enabled && settings.patternHash && (
                isUnlocked ? (
                  <button
                    type="button"
                    onClick={onLockNow}
                    className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-amber-400 px-3 text-xs font-semibold text-zinc-950 hover:bg-amber-300"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>Lock Now</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onUnlockSession}
                    className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    <span>Unlock Session</span>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Protected Scopes */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Protected Targets
            </p>

            {/* Protect PDF Reader */}
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({
                  ...settings,
                  lockPdfReader: !settings.lockPdfReader,
                })
              }
              className="flex min-h-[54px] w-full items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-left hover:bg-zinc-900"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-4.5 w-4.5 shrink-0 text-red-400" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">Lock PDF Reader</p>
                  <p className="text-xs text-zinc-400">
                    Require finger gesture before opening any PDF document
                  </p>
                </div>
              </div>
              <span
                className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
                  settings.lockPdfReader ? 'bg-amber-400' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-zinc-950 transition-transform ${
                    settings.lockPdfReader ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>

            {/* Protect Sensitive Folders */}
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({
                  ...settings,
                  lockSensitiveFolders: !settings.lockSensitiveFolders,
                })
              }
              className="flex min-h-[54px] w-full items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-left hover:bg-zinc-900"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FolderLock className="h-4.5 w-4.5 shrink-0 text-amber-300" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">Lock Sensitive Folders</p>
                  <p className="text-xs text-zinc-400">
                    Shield marked folders &amp; hide their contents until unlocked
                  </p>
                </div>
              </div>
              <span
                className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
                  settings.lockSensitiveFolders ? 'bg-amber-400' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-zinc-950 transition-transform ${
                    settings.lockSensitiveFolders ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>
          </div>

          {/* Sensitive Folders Checklist */}
          <div className="space-y-2.5 rounded-2xl border border-zinc-800 bg-zinc-950/90 p-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
                <FolderOpen className="h-3.5 w-3.5 text-amber-300" />
                <span>Sensitive Folders ({settings.lockedFolderPaths.length})</span>
              </span>
            </div>

            <form onSubmit={handleAddCustomFolder} className="flex items-center gap-2">
              <input
                type="text"
                value={customFolderInput}
                onChange={(e) => setCustomFolderInput(e.target.value)}
                placeholder="Add folder path (e.g. Private/Docs)"
                className="min-h-[38px] flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-amber-300 focus:outline-none"
              />
              <button
                type="submit"
                className="flex min-h-[38px] items-center gap-1 rounded-xl bg-zinc-800 px-3 text-xs font-medium text-zinc-100 hover:bg-zinc-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Lock</span>
              </button>
            </form>

            {allListedFolders.length === 0 ? (
              <p className="py-2 text-xs text-zinc-500">
                No folders indexed yet. Connect storage or add a folder path above, or tap the lock icon on any folder in Files.
              </p>
            ) : (
              <div className="steady-scroll max-h-44 space-y-1 overflow-y-auto pr-1">
                {allListedFolders.map((folderPath) => {
                  const isDirectlyLocked = settings.lockedFolderPaths.some(
                    (p) => normalizeFolderPath(p).toLowerCase() === folderPath.toLowerCase()
                  );
                  const isProtected =
                    isDirectlyLocked ||
                    isFolderOrAncestorLocked(folderPath, settings.lockedFolderPaths);

                  return (
                    <button
                      key={folderPath}
                      type="button"
                      onClick={() => onToggleFolderLock(folderPath)}
                      className={`flex min-h-[42px] w-full items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-left text-xs transition-colors ${
                        isProtected
                          ? 'border-amber-400/40 bg-amber-400/10 text-amber-100'
                          : 'border-zinc-800/80 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-900'
                      }`}
                    >
                      <span className="truncate font-mono">{folderPath}</span>
                      <span className="flex shrink-0 items-center gap-1 font-medium">
                        {isProtected ? (
                          <>
                            <Lock className="h-3.5 w-3.5 text-amber-300" />
                            <span className="text-amber-300">Locked</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="h-3.5 w-3.5 text-zinc-500" />
                            <span className="text-zinc-500">Open</span>
                          </>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Auto-Lock Timeout */}
          <div className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-950/90 p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
              <Clock className="h-3.5 w-3.5 text-amber-300" />
              <span>Re-Lock After</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {AUTO_LOCK_OPTIONS.map((opt) => {
                const active = settings.autoLockMinutes === opt.minutes;
                return (
                  <button
                    key={opt.minutes}
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ ...settings, autoLockMinutes: opt.minutes })
                    }
                    className={`min-h-[38px] rounded-xl border px-2 text-xs font-medium transition-colors ${
                      active
                        ? 'border-amber-400 bg-amber-400 text-zinc-950'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Standalone Self-Contained HTML Export */}
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-2.5">
            <div className="flex items-start gap-3">
              <FileCode2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">Standalone Single-File HTML</p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Save Symphony No. 9 as one portable offline `.html` file (`symphony-no-9.html`) with audio playback, PDF reader, themes, and gesture security built in.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onExportStandaloneHtml}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 text-xs font-bold text-zinc-950 hover:bg-cyan-300 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Download symphony-no-9.html</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
