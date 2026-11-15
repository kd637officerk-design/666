import React, { useRef } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Download,
  FileCode2,
  FolderOpen,
  HardDrive,
  Image as ImageIcon,
  Lock,
  Music,
  RefreshCw,
  ShieldCheck,
  Unlock,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { GestureLockSettings, PermissionState } from '../types';
import { supportsDirectoryPicker } from '../lib/fileSystem';

interface PermissionsSheetProps {
  open: boolean;
  onClose: () => void;
  permissions: PermissionState;
  hasLiveFolder: boolean;
  linkedFolderName: string | null;
  totalFilesCount: number;
  reconciledDeletionsCount: number;
  nativeObserverActive: boolean;
  onTogglePermission: (key: keyof PermissionState) => void;
  onConnectLiveFolder: () => Promise<void>;
  onPickFallbackDirectory: (files: FileList) => Promise<void>;
  onPickMultipleFiles: (files: FileList) => Promise<void>;
  onManualSync: () => Promise<void>;
  syncing: boolean;
  gestureLockSettings: GestureLockSettings;
  isSecurityUnlocked: boolean;
  onOpenGestureSecurity: () => void;
  onExportStandaloneHtml: () => void;
}

export const PermissionsSheet: React.FC<PermissionsSheetProps> = ({
  open,
  onClose,
  permissions,
  hasLiveFolder,
  linkedFolderName,
  totalFilesCount,
  reconciledDeletionsCount,
  nativeObserverActive,
  onTogglePermission,
  onConnectLiveFolder,
  onPickFallbackDirectory,
  onPickMultipleFiles,
  onManualSync,
  syncing,
  gestureLockSettings,
  isSecurityUnlocked,
  onOpenGestureSecurity,
  onExportStandaloneHtml,
}) => {
  const dirInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const canUseFsApi = supportsDirectoryPicker();
  const reckoningActive = hasLiveFolder && permissions.realTimeSyncEnabled;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="THE RECONING OF ALL THINGS — App permissions and internal storage"
    >
      <div className="steady-scroll max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-zinc-800 bg-[#141310] text-zinc-100 sm:rounded-2xl">
        {/* Android Permissions Style Top Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800/80 bg-[#141310]/95 px-4 py-3 backdrop-blur-md">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-zinc-200 hover:bg-zinc-800"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="font-display text-sm font-semibold tracking-wider text-amber-300 uppercase">
            THE RECONING OF ALL THINGS
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-5 py-6">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-400" />
              <h2 className="font-display text-xl font-bold tracking-wide text-white uppercase">
                THE RECONING OF ALL THINGS
              </h2>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
              Full internal storage link with simultaneous real-time deletion. Any song, PDF, video, or folder deleted on your phone is immediately removed from Symphony No. 9, queues, and playlists — and deletions inside the player erase from device storage at once.
            </p>
          </div>

          {/* Primary Internal Storage Connect Card */}
          <div
            className={`rounded-2xl border p-4 space-y-3.5 ${
              reckoningActive
                ? 'border-amber-400/45 bg-gradient-to-br from-amber-500/12 via-zinc-900/90 to-zinc-950'
                : 'border-zinc-800 bg-zinc-900/70'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                      reckoningActive
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        reckoningActive ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                      }`}
                    />
                    <span>{reckoningActive ? 'Live Sync Active' : 'Standby'}</span>
                  </span>
                  {reckoningActive && (
                    <span className="font-mono text-[10px] text-amber-300/90">
                      {nativeObserverActive ? 'OS FileObserver' : '1.5s Watch'}
                    </span>
                  )}
                </div>

                <p className="mt-2 truncate text-sm font-semibold text-zinc-100">
                  {hasLiveFolder
                    ? `Root Linked: ${linkedFolderName || 'Internal Storage'}`
                    : 'Connect Full Internal Storage Root'}
                </p>
                <p className="mt-0.5 font-mono text-xs text-zinc-400">
                  {totalFilesCount} files indexed
                  {reconciledDeletionsCount > 0
                    ? ` · ${reconciledDeletionsCount} deletion${reconciledDeletionsCount === 1 ? '' : 's'} synced`
                    : ''}
                </p>
              </div>
              {hasLiveFolder && (
                <button
                  type="button"
                  onClick={() => void onManualSync()}
                  disabled={syncing}
                  className="flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-amber-400/35 bg-amber-400/15 px-3 text-xs font-semibold text-amber-200 hover:bg-amber-400/25 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  <span>Reconcile</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {canUseFsApi && (
                <button
                  type="button"
                  onClick={() => void onConnectLiveFolder()}
                  className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-300 transition-colors"
                >
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {hasLiveFolder ? 'Switch Root Storage' : 'Grant Full Storage'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => dirInputRef.current?.click()}
                className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-700 transition-colors"
              >
                <HardDrive className="h-4 w-4 shrink-0" />
                <span>Select Phone Folder</span>
              </button>

              <button
                type="button"
                onClick={() => filesInputRef.current?.click()}
                className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800 transition-colors ${
                  canUseFsApi ? 'sm:col-span-2' : ''
                }`}
              >
                <Upload className="h-4 w-4 shrink-0" />
                <span>Import Individual Files (Audio / PDF / GIF)</span>
              </button>
            </div>

            <input
              ref={dirInputRef}
              type="file"
              multiple
              // @ts-expect-error webkitdirectory is supported across Chromium & mobile WebKit
              webkitdirectory=""
              directory=""
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  void onPickFallbackDirectory(e.target.files);
                  e.target.value = '';
                }
              }}
            />
            <input
              ref={filesInputRef}
              type="file"
              multiple
              accept="audio/*,application/pdf,image/*,video/*,*/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  void onPickMultipleFiles(e.target.files);
                  e.target.value = '';
                }
              }}
            />
          </div>

          {/* Allowed Permissions Section matching Android screenshots */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-amber-300/90">Allowed</p>

            <button
              type="button"
              onClick={() => onTogglePermission('musicAndAudio')}
              className="flex w-full min-h-[56px] items-center justify-between gap-4 rounded-xl px-2 py-2 text-left hover:bg-zinc-900/70"
            >
              <div className="flex items-center gap-4">
                <Music className="h-5 w-5 shrink-0 text-zinc-300" />
                <div>
                  <p className="text-base text-zinc-100">Music and audio</p>
                  <p className="text-xs text-zinc-400">
                    {permissions.musicAndAudio
                      ? 'Allowed for local tracks & ID3 artwork'
                      : 'Tap to allow audio access'}
                  </p>
                </div>
              </div>
              <span
                className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
                  permissions.musicAndAudio ? 'bg-amber-300' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-zinc-950 transition-transform ${
                    permissions.musicAndAudio ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onTogglePermission('photosAndVideos')}
              className="flex w-full min-h-[56px] items-center justify-between gap-4 rounded-xl px-2 py-2 text-left hover:bg-zinc-900/70"
            >
              <div className="flex items-center gap-4">
                <ImageIcon className="h-5 w-5 shrink-0 text-zinc-300" />
                <div>
                  <p className="text-base text-zinc-100">Photos and videos</p>
                  <p className="text-xs text-zinc-400">
                    {permissions.photosAndVideos
                      ? 'Allowed for 4K GIF wallpapers & cover art'
                      : 'Tap to allow photos & GIFs'}
                  </p>
                </div>
              </div>
              <span
                className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
                  permissions.photosAndVideos ? 'bg-amber-300' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-zinc-950 transition-transform ${
                    permissions.photosAndVideos ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onTogglePermission('allFilesAccess')}
              className="flex w-full min-h-[56px] items-center justify-between gap-4 rounded-xl px-2 py-2 text-left hover:bg-zinc-900/70"
            >
              <div className="flex items-center gap-4">
                <HardDrive className="h-5 w-5 shrink-0 text-zinc-300" />
                <div>
                  <p className="text-base text-zinc-100">All files & PDFs management</p>
                  <p className="text-xs text-zinc-400">
                    {permissions.allFilesAccess
                      ? 'Allowed to read, rename, move & delete all internal storage files'
                      : 'Tap to allow full file manager'}
                  </p>
                </div>
              </div>
              <span
                className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
                  permissions.allFilesAccess ? 'bg-amber-300' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-zinc-950 transition-transform ${
                    permissions.allFilesAccess ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onTogglePermission('realTimeSyncEnabled')}
              className="flex w-full min-h-[56px] items-center justify-between gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-left hover:bg-amber-500/10"
            >
              <div className="flex items-center gap-4">
                <ShieldCheck className="h-5 w-5 shrink-0 text-amber-300" />
                <div>
                  <p className="text-sm font-semibold tracking-wide text-amber-200 uppercase">
                    THE RECONING OF ALL THINGS
                  </p>
                  <p className="text-xs text-zinc-400">
                    Simultaneously removes files deleted on your phone from the player in real time
                  </p>
                </div>
              </div>
              <span
                className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
                  permissions.realTimeSyncEnabled ? 'bg-amber-300' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-zinc-950 transition-transform ${
                    permissions.realTimeSyncEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>
          </div>

          {/* Gesture Security & Standalone HTML Section */}
          <div className="space-y-2.5 border-t border-zinc-800/80 pt-4">
            <p className="text-xs font-medium text-amber-300/90">Security &amp; Portable HTML</p>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenGestureSecurity();
              }}
              className="flex min-h-[60px] w-full items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3.5 py-2.5 text-left hover:bg-zinc-900"
            >
              <div className="flex min-w-0 items-center gap-3.5">
                {gestureLockSettings.enabled && !isSecurityUnlocked ? (
                  <Lock className="h-5 w-5 shrink-0 text-amber-300" />
                ) : (
                  <Unlock className="h-5 w-5 shrink-0 text-emerald-400" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-100">
                    Gesture Lock &amp; Sensitive Folders
                  </p>
                  <p className="truncate text-xs text-zinc-400">
                    {gestureLockSettings.enabled
                      ? `Enabled · ${gestureLockSettings.lockPdfReader ? 'PDF Reader' : 'PDF Off'} · ${gestureLockSettings.lockedFolderPaths.length} folder(s)`
                      : 'Off · Tap to draw a finger gesture pattern'}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
            </button>

            <button
              type="button"
              onClick={onExportStandaloneHtml}
              className="flex min-h-[54px] w-full items-center justify-between gap-3 rounded-xl border border-cyan-500/30 bg-cyan-950/20 px-3.5 py-2.5 text-left hover:bg-cyan-950/35"
            >
              <div className="flex min-w-0 items-center gap-3.5">
                <FileCode2 className="h-5 w-5 shrink-0 text-cyan-300" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-100">Download Standalone HTML</p>
                  <p className="truncate text-xs text-zinc-400">
                    Save self-contained symphony-no-9.html offline app
                  </p>
                </div>
              </div>
              <Download className="h-4 w-4 shrink-0 text-cyan-300" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
