import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileCode2,
  FileText,
  FolderOpen,
  HardDrive,
  Lock,
  Music,
  Pause,
  Play,
  ShieldCheck,
  SkipForward,
  Wallpaper,
} from 'lucide-react';
import {
  AiVoiceReaderProfile,
  DeviceFileEntry,
  DiyPdfThemeConfig,
  GestureLockSettings,
  MainWorkspace,
  PdfDocState,
  PdfThemeId,
  PermissionState,
  SavedDiyTheme,
  SavedLinkItem,
  TrackMetadata,
  UserPlaylist,
  WallpaperConfig,
  WallpaperItem,
} from './types';
import {
  DEFAULT_DIY_THEME,
  DEFAULT_PERMISSIONS,
  DEFAULT_WALLPAPER_CONFIG,
  StoredTrackRecord,
  deleteFallbackFile,
  deletePdfState,
  deletePlaylist as dbDeletePlaylist,
  deleteTrackRecord,
  deleteUniverseImage,
  deleteWallpaper as dbDeleteWallpaper,
  loadActivePdfTheme,
  loadActiveVoiceReaderId,
  loadAllTrackRecords,
  loadCustomVoiceReaders,
  loadDiyThemeConfig,
  loadFallbackFiles,
  loadGestureLockSettings,
  loadPdfStates,
  loadPermissions,
  loadPlaylists,
  loadRootDirectoryHandle,
  loadSavedDiyThemes,
  loadSavedLinks,
  loadTtsServerUrl,
  loadUniverseImages,
  loadWallpaperConfig,
  loadWallpapers,
  saveActivePdfTheme,
  saveActiveVoiceReaderId,
  saveCustomVoiceReaders,
  saveTtsServerUrl,
  saveDiyThemeConfig,
  saveFallbackFile,
  saveGestureLockSettings,
  savePdfState,
  savePermissions,
  savePlaylist,
  saveRootDirectoryHandle,
  saveSavedDiyThemes,
  saveSavedLinks,
  saveTrackRecord,
  saveUniverseImage,
  saveWallpaper,
  saveWallpaperConfig,
  trackMetadataFromRecord,
} from './lib/storage';
import {
  DEFAULT_GESTURE_LOCK_SETTINGS,
  hashGesturePattern,
  isEntryInLockedFolder,
  normalizeFolderPath,
} from './lib/gestureSecurity';
import { DEFAULT_AI_VOICE_READERS } from './lib/voiceReaders';
import {
  createSubfolderInHandle,
  deleteEntryFromHandle,
  fallbackRecordsToEntries,
  fileListToEntries,
  observeDirectoryHandle,
  queryDirectoryPermissionState,
  renameEntryInHandle,
  resolveEntryFile,
  scanDirectoryHandle,
  verifyDirectoryPermission,
  writeUploadedFilesToDirectory,
} from './lib/fileSystem';
import { parseAudioFileTags } from './lib/id3';
import { PDF_THEME_PRESETS, generatePdfThumbnail } from './lib/pdfEngine';
import { WallpaperLayer } from './components/WallpaperLayer';
import { PermissionsSheet } from './components/PermissionsSheet';
import { AudioWorkspace } from './components/AudioWorkspace';
import { PdfWorkspace } from './components/PdfWorkspace';
import { PdfReaderModal } from './components/PdfReaderModal';
import { FilesWorkspace } from './components/FilesWorkspace';
import { WallpaperStudio } from './components/WallpaperStudio';
import { ArtworkEditorModal } from './components/ArtworkEditorModal';
import { GestureLockModal, GestureLockModalMode } from './components/GestureLockModal';
import { GestureSecurityModal } from './components/GestureSecurityModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import {
  blobToLockScreenDataUrl,
  clearAndroidMediaNotification,
  subscribeNativeMediaActions,
  syncAndroidMediaNotification,
  updateAndroidMediaPosition,
} from './lib/mediaNotification';

export default function App() {
  const [workspace, setWorkspace] = useState<MainWorkspace>('audio');
  const [entries, setEntries] = useState<DeviceFileEntry[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [permissions, setPermissions] = useState<PermissionState>(DEFAULT_PERMISSIONS);
  const [permissionsOpen, setPermissionsOpen] = useState(false);

  // Audio metadata, playlists, and cover URL cache
  const [trackRecords, setTrackRecords] = useState<Record<string, StoredTrackRecord>>({});
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);

  // Audio player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentObjectUrlRef = useRef<string | null>(null);
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [volume, setVolume] = useState(0.95);

  // Artwork Editor state
  const [artworkEntry, setArtworkEntry] = useState<DeviceFileEntry | null>(null);
  const [assignImageEntry, setAssignImageEntry] = useState<DeviceFileEntry | null>(null);

  // Wallpapers state
  const [wallpapers, setWallpapers] = useState<WallpaperItem[]>([]);
  const [wallpaperConfig, setWallpaperConfig] = useState<WallpaperConfig>(DEFAULT_WALLPAPER_CONFIG);

  // PDF & Universe Theme state
  const [pdfStates, setPdfStates] = useState<Record<string, PdfDocState>>({});
  const [activePdfTheme, setActivePdfTheme] = useState<PdfThemeId>('diy');
  const [diyThemeConfig, setDiyThemeConfig] = useState<DiyPdfThemeConfig>(DEFAULT_DIY_THEME);
  const [savedDiyThemes, setSavedDiyThemes] = useState<SavedDiyTheme[]>([]);
  const [universeImages, setUniverseImages] = useState<Record<string, string>>({});
  const [generatingThemeId, setGeneratingThemeId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [openPdfEntry, setOpenPdfEntry] = useState<DeviceFileEntry | null>(null);
  const [savedLinks, setSavedLinks] = useState<SavedLinkItem[]>([]);
  const [customVoiceReaders, setCustomVoiceReaders] = useState<AiVoiceReaderProfile[]>([]);
  const [activeVoiceReaderId, setActiveVoiceReaderId] = useState<string>('builtin:kore-audiobook');
  const [ttsServerUrl, setTtsServerUrl] = useState<string>('');
  const [pdfSoundEnabled, setPdfSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('kurodeck_pdf_sound') !== '0';
    } catch {
      return true;
    }
  });

  const allVoiceReaders = useMemo(
    () => [...customVoiceReaders, ...DEFAULT_AI_VOICE_READERS],
    [customVoiceReaders]
  );

  // Sleep Timer state (runs across workspaces so audio pauses even if browsing PDFs/Files)
  const [sleepTimerEndsAt, setSleepTimerEndsAt] = useState<number | null>(null);
  const [sleepTimerRemainingSec, setSleepTimerRemainingSec] = useState<number | null>(null);

  // Gesture Lock & Sensitive Folders Security state
  const [gestureLockSettings, setGestureLockSettings] = useState<GestureLockSettings>(
    DEFAULT_GESTURE_LOCK_SETTINGS
  );
  const [gestureSecurityOpen, setGestureSecurityOpen] = useState(false);
  const [securityUnlockedUntil, setSecurityUnlockedUntil] = useState<number | null>(null);
  const [securityNowMs, setSecurityNowMs] = useState<number>(() => Date.now());
  const [gesturePrompt, setGesturePrompt] = useState<{
    open: boolean;
    mode: GestureLockModalMode;
    title?: string;
    subtitle?: string;
    onVerified?: () => void;
    onPatternDone?: (pattern: number[]) => void;
  }>({ open: false, mode: 'unlock' });

  const isGestureLockActive = Boolean(
    gestureLockSettings.enabled && gestureLockSettings.patternHash
  );
  const isSecurityUnlocked =
    !isGestureLockActive ||
    (securityUnlockedUntil !== null && securityUnlockedUntil > securityNowMs);

  // THE RECONING OF ALL THINGS — real-time storage reconciliation telemetry & live refs
  const [reconciledDeletionsCount, setReconciledDeletionsCount] = useState(0);
  const [nativeObserverActive, setNativeObserverActive] = useState(false);
  const entriesRef = useRef<DeviceFileEntry[]>([]);
  entriesRef.current = entries;
  const currentTrackIdRef = useRef<string | null>(null);
  currentTrackIdRef.current = currentTrackId;
  const openPdfEntryRef = useRef<DeviceFileEntry | null>(null);
  openPdfEntryRef.current = openPdfEntry;
  const artworkEntryRef = useRef<DeviceFileEntry | null>(null);
  artworkEntryRef.current = artworkEntry;
  const assignImageEntryRef = useRef<DeviceFileEntry | null>(null);
  assignImageEntryRef.current = assignImageEntry;
  const lastScannedHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const syncInFlightRef = useRef(false);

  // Toast feedback (non-blocking)
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((curr) => (curr === msg ? null : curr)), 2800);
  }, []);

  useEffect(() => {
    if (!sleepTimerEndsAt) {
      setSleepTimerRemainingSec(null);
      return;
    }
    const tick = () => {
      const diffSec = Math.ceil((sleepTimerEndsAt - Date.now()) / 1000);
      if (diffSec <= 0) {
        setSleepTimerEndsAt(null);
        setSleepTimerRemainingSec(null);
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
        }
        setIsPlaying(false);
        showToast('Sleep timer ended — playback paused');
        return;
      }
      setSleepTimerRemainingSec(diffSec);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerEndsAt, showToast]);

  const handleStartSleepTimer = useCallback(
    (minutes: number) => {
      const safeMins = Math.max(1, Math.min(480, Math.round(minutes)));
      setSleepTimerEndsAt(Date.now() + safeMins * 60 * 1000);
      setSleepTimerRemainingSec(safeMins * 60);
      showToast(`Sleep timer set for ${safeMins} min`);
    },
    [showToast]
  );

  const handleExtendSleepTimer = useCallback(
    (extraMinutes: number) => {
      setSleepTimerEndsAt((prev) => {
        const base = prev && prev > Date.now() ? prev : Date.now();
        return base + extraMinutes * 60 * 1000;
      });
      showToast(`Added +${extraMinutes} min to sleep timer`);
    },
    [showToast]
  );

  const handleCancelSleepTimer = useCallback(() => {
    setSleepTimerEndsAt(null);
    setSleepTimerRemainingSec(null);
    showToast('Sleep timer cancelled');
  }, [showToast]);

  // Auto-lock countdown & tab-hide re-lock for Gesture Security
  useEffect(() => {
    if (!isGestureLockActive || securityUnlockedUntil === null) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setSecurityNowMs(now);
      if (now >= securityUnlockedUntil) {
        setSecurityUnlockedUntil(null);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isGestureLockActive, securityUnlockedUntil]);

  useEffect(() => {
    if (!isGestureLockActive) return;
    const onVisChange = () => {
      if (document.visibilityState === 'hidden' && gestureLockSettings.autoLockMinutes === 0) {
        setSecurityUnlockedUntil(null);
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => document.removeEventListener('visibilitychange', onVisChange);
  }, [isGestureLockActive, gestureLockSettings.autoLockMinutes]);

  const markSecurityUnlocked = useCallback(
    (minsOverride?: number) => {
      const mins =
        minsOverride !== undefined ? minsOverride : gestureLockSettings.autoLockMinutes;
      const durationMs = mins > 0 ? mins * 60 * 1000 : 2 * 60 * 1000;
      const now = Date.now();
      setSecurityNowMs(now);
      setSecurityUnlockedUntil(now + durationMs);
    },
    [gestureLockSettings.autoLockMinutes]
  );

  const lockSecurityNow = useCallback(() => {
    const activePdf = openPdfEntryRef.current;
    if (activePdf) {
      const now = Date.now();
      setPdfStates((prev) => {
        const curr = prev[activePdf.id];
        if (!curr) return prev;
        const merged = { ...curr, lastLeftAt: now };
        void savePdfState(merged);
        return { ...prev, [activePdf.id]: merged };
      });
    }
    setSecurityUnlockedUntil(null);
    setOpenPdfEntry(null);
    showToast('Gesture vault locked');
  }, [showToast]);

  const updateGestureSettings = useCallback((next: GestureLockSettings) => {
    setGestureLockSettings(next);
    void saveGestureLockSettings(next);
  }, []);

  const requestSecurityUnlock = useCallback(
    (
      title: string,
      subtitle: string,
      onVerified: () => void,
      mode: GestureLockModalMode = 'unlock'
    ) => {
      setGesturePrompt({
        open: true,
        mode,
        title,
        subtitle,
        onVerified,
      });
    },
    []
  );

  const openPatternSetupModal = useCallback(
    (mode: 'setup' | 'change', afterSaved?: () => void) => {
      setGesturePrompt({
        open: true,
        mode,
        title: mode === 'setup' ? 'Create Finger Gesture' : 'Change Finger Gesture',
        subtitle: 'Draw a pattern connecting at least 4 dots',
        onPatternDone: async (pattern) => {
          const { hash, salt } = await hashGesturePattern(pattern);
          setGestureLockSettings((prev) => {
            const next: GestureLockSettings = {
              ...prev,
              enabled: true,
              patternHash: hash,
              patternSalt: salt,
              patternLength: pattern.length,
            };
            void saveGestureLockSettings(next);
            return next;
          });
          markSecurityUnlocked(Math.max(1, gestureLockSettings.autoLockMinutes));
          setGesturePrompt({ open: false, mode: 'unlock' });
          showToast('Finger gesture lock saved');
          afterSaved?.();
        },
      });
    },
    [gestureLockSettings.autoLockMinutes, markSecurityUnlocked, showToast]
  );

  const handleOpenGestureSecurity = useCallback(() => {
    if (isGestureLockActive && !isSecurityUnlocked) {
      requestSecurityUnlock(
        'Gesture Security Settings',
        'Draw your finger gesture to access security settings',
        () => setGestureSecurityOpen(true),
        'verify'
      );
      return;
    }
    setGestureSecurityOpen(true);
  }, [isGestureLockActive, isSecurityUnlocked, requestSecurityUnlock]);

  const handleToggleEnableGestureLock = useCallback(() => {
    if (gestureLockSettings.enabled) {
      if (gestureLockSettings.patternHash) {
        setGestureSecurityOpen(false);
        requestSecurityUnlock(
          'Disable Gesture Lock',
          'Draw your current finger gesture to turn off lock',
          () => {
            updateGestureSettings({ ...gestureLockSettings, enabled: false });
            setSecurityUnlockedUntil(null);
            setGestureSecurityOpen(true);
            showToast('Gesture lock disabled');
          },
          'verify'
        );
      } else {
        updateGestureSettings({ ...gestureLockSettings, enabled: false });
      }
      return;
    }

    if (!gestureLockSettings.patternHash) {
      setGestureSecurityOpen(false);
      openPatternSetupModal('setup', () => setGestureSecurityOpen(true));
      return;
    }

    updateGestureSettings({ ...gestureLockSettings, enabled: true });
    markSecurityUnlocked();
    showToast('Gesture lock enabled');
  }, [
    gestureLockSettings,
    markSecurityUnlocked,
    openPatternSetupModal,
    requestSecurityUnlock,
    showToast,
    updateGestureSettings,
  ]);

  const handleRequestChangePattern = useCallback(() => {
    if (gestureLockSettings.enabled && gestureLockSettings.patternHash && !isSecurityUnlocked) {
      setGestureSecurityOpen(false);
      requestSecurityUnlock(
        'Verify Current Gesture',
        'Draw your current finger gesture first',
        () => openPatternSetupModal('change', () => setGestureSecurityOpen(true)),
        'verify'
      );
      return;
    }
    setGestureSecurityOpen(false);
    openPatternSetupModal('change', () => setGestureSecurityOpen(true));
  }, [
    gestureLockSettings.enabled,
    gestureLockSettings.patternHash,
    isSecurityUnlocked,
    openPatternSetupModal,
    requestSecurityUnlock,
  ]);

  const handleToggleFolderLock = useCallback(
    (rawFolderPath: string) => {
      const clean = normalizeFolderPath(rawFolderPath);
      if (!clean) return;
      const exists = gestureLockSettings.lockedFolderPaths.some(
        (p) => normalizeFolderPath(p).toLowerCase() === clean.toLowerCase()
      );

      if (exists && isGestureLockActive && !isSecurityUnlocked) {
        requestSecurityUnlock(
          'Unlock Folder Protection',
          `Draw your finger gesture to unprotect "${clean}"`,
          () => {
            const nextPaths = gestureLockSettings.lockedFolderPaths.filter(
              (p) => normalizeFolderPath(p).toLowerCase() !== clean.toLowerCase()
            );
            updateGestureSettings({
              ...gestureLockSettings,
              lockedFolderPaths: nextPaths,
            });
            showToast(`Removed lock from "${clean}"`);
          },
          'verify'
        );
        return;
      }

      if (exists) {
        const nextPaths = gestureLockSettings.lockedFolderPaths.filter(
          (p) => normalizeFolderPath(p).toLowerCase() !== clean.toLowerCase()
        );
        updateGestureSettings({ ...gestureLockSettings, lockedFolderPaths: nextPaths });
        showToast(`Unprotected "${clean}"`);
      } else {
        const nextPaths = [...gestureLockSettings.lockedFolderPaths, clean];
        updateGestureSettings({
          ...gestureLockSettings,
          lockSensitiveFolders: true,
          lockedFolderPaths: nextPaths,
        });
        if (!gestureLockSettings.patternHash) {
          openPatternSetupModal('setup');
        } else {
          showToast(`Marked "${clean}" as sensitive`);
        }
      }
    },
    [
      gestureLockSettings,
      isGestureLockActive,
      isSecurityUnlocked,
      openPatternSetupModal,
      requestSecurityUnlock,
      showToast,
      updateGestureSettings,
    ]
  );

  const openPdfImmediate = useCallback((entry: DeviceFileEntry) => {
    setPdfStates((prev) => {
      const curr = prev[entry.id] || {
        id: entry.id,
        starred: false,
        lastOpenedAt: Date.now(),
        currentPage: 1,
        totalPages: 0,
        zoom: 1,
      };
      const next = { ...curr, lastOpenedAt: Date.now() };
      void savePdfState(next);
      return { ...prev, [entry.id]: next };
    });
    setOpenPdfEntry(entry);
  }, []);

  const handleRequestOpenPdf = useCallback(
    (entry: DeviceFileEntry) => {
      const needsLock =
        isGestureLockActive &&
        !isSecurityUnlocked &&
        (gestureLockSettings.lockPdfReader ||
          (gestureLockSettings.lockSensitiveFolders &&
            isEntryInLockedFolder(entry, gestureLockSettings.lockedFolderPaths)));

      if (needsLock) {
        requestSecurityUnlock(
          'PDF Reader Protected',
          `Draw your finger gesture to open "${entry.name.replace(/\.pdf$/i, '')}"`,
          () => openPdfImmediate(entry)
        );
        return;
      }
      openPdfImmediate(entry);
    },
    [
      gestureLockSettings.lockPdfReader,
      gestureLockSettings.lockSensitiveFolders,
      gestureLockSettings.lockedFolderPaths,
      isGestureLockActive,
      isSecurityUnlocked,
      openPdfImmediate,
      requestSecurityUnlock,
    ]
  );

  const handleExportStandaloneHtml = useCallback(async () => {
    const urlsToTry = ['/api/download-html', '/symphony-no-9.html'];
    for (const endpoint of urlsToTry) {
      try {
        const res = await fetch(endpoint);
        if (res.ok) {
          const htmlText = await res.text();
          if (htmlText.includes('<div id="root">')) {
            const blob = new Blob([htmlText], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'symphony-no-9.html';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
            showToast('Downloading symphony-no-9.html');
            return;
          }
        }
      } catch {
        // try next endpoint
      }
    }
    showToast('Run "npm run build:html" to refresh standalone HTML bundle');
  }, [showToast]);

  // Derive categorized lists
  const audioEntries = useMemo(
    () => entries.filter((e) => e.category === 'audio'),
    [entries]
  );
  const pdfEntries = useMemo(
    () => entries.filter((e) => e.category === 'pdf'),
    [entries]
  );
  const imageEntries = useMemo(
    () => entries.filter((e) => e.category === 'image'),
    [entries]
  );
  const videoEntries = useMemo(
    () => entries.filter((e) => e.category === 'video'),
    [entries]
  );

  // Build TrackMetadata map combining records + object URLs
  const trackMetaMap = useMemo(() => {
    const map: Record<string, TrackMetadata> = {};
    for (const entry of audioEntries) {
      const rec = trackRecords[entry.id];
      const baseTitle = entry.name.replace(/\.[^.]+$/, '');
      const meta = trackMetadataFromRecord(entry.id, baseTitle, rec);
      if (coverUrls[entry.id]) meta.coverUrl = coverUrls[entry.id];
      map[entry.id] = meta;
    }
    return map;
  }, [audioEntries, trackRecords, coverUrls]);

  const activeWallpaper = useMemo(
    () => wallpapers.find((w) => w.id === wallpaperConfig.activeWallpaperId) || null,
    [wallpapers, wallpaperConfig.activeWallpaperId]
  );

  // Manage cover Blob -> Object URL lifecycle
  const coverUrlsRef = useRef<Record<string, string>>({});
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const [id, rec] of Object.entries(trackRecords)) {
      if (rec.coverBlob) {
        if (coverUrlsRef.current[id]) {
          next[id] = coverUrlsRef.current[id];
        } else {
          next[id] = URL.createObjectURL(rec.coverBlob);
        }
      }
    }
    // Revoke removed URLs
    for (const [id, url] of Object.entries(coverUrlsRef.current)) {
      if (!next[id]) URL.revokeObjectURL(url);
    }
    coverUrlsRef.current = next;
    setCoverUrls(next);
  }, [trackRecords]);

  // Initial Hydrate from IndexedDB
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [
        perms,
        records,
        pls,
        wps,
        wpCfg,
        pdfs,
        pdfTheme,
        diyCfg,
        diyList,
        uniImgs,
        links,
        customReaders,
        activeReaderId,
        savedHandle,
        fallbackFiles,
        gestureCfg,
        savedTtsUrl,
      ] = await Promise.all([
        loadPermissions(),
        loadAllTrackRecords(),
        loadPlaylists(),
        loadWallpapers(),
        loadWallpaperConfig(),
        loadPdfStates(),
        loadActivePdfTheme(),
        loadDiyThemeConfig(),
        loadSavedDiyThemes(),
        loadUniverseImages(),
        loadSavedLinks(),
        loadCustomVoiceReaders(),
        loadActiveVoiceReaderId(),
        loadRootDirectoryHandle(),
        loadFallbackFiles(),
        loadGestureLockSettings(),
        loadTtsServerUrl(),
      ]);

      if (cancelled) return;
      setPermissions(perms);
      setTrackRecords(records);
      setPlaylists(pls);
      setWallpapers(wps);
      setWallpaperConfig(wpCfg);
      setPdfStates(pdfs);
      setActivePdfTheme(pdfTheme);
      setDiyThemeConfig(diyCfg);
      setSavedDiyThemes(diyList);
      setUniverseImages(uniImgs);
      setSavedLinks(links);
      setCustomVoiceReaders(customReaders);
      setActiveVoiceReaderId(activeReaderId);
      setGestureLockSettings(gestureCfg);
      setTtsServerUrl(savedTtsUrl);

      if (savedHandle) {
        setRootHandle(savedHandle);
        try {
          const perm = await queryDirectoryPermissionState(savedHandle, 'readwrite');
          const readPerm =
            perm === 'granted'
              ? 'granted'
              : await queryDirectoryPermissionState(savedHandle, 'read');
          if (readPerm === 'granted') {
            const scanned = await scanDirectoryHandle(savedHandle);
            if (!cancelled) {
              setEntries(scanned.entries);
              setFolders(scanned.folders);
              setNeedsReconnect(false);
            }
          } else {
            setNeedsReconnect(true);
          }
        } catch {
          setNeedsReconnect(true);
        }
      } else if (fallbackFiles.length > 0) {
        const converted = fallbackRecordsToEntries(fallbackFiles);
        if (!cancelled) {
          setEntries(converted.entries);
          setFolders(converted.folders);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Background lazy metadata/cover art extraction for audio + thumbnails for PDFs
  const scannedMetaIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    const unparsedAudio = audioEntries.filter(
      (e) =>
        !scannedMetaIdsRef.current.has(e.id) &&
        (!trackRecords[e.id]?.hasCustomCover || trackRecords[e.id]?.genre === undefined)
    );
    const unparsedPdfs = pdfEntries.filter(
      (e) => !scannedMetaIdsRef.current.has(e.id) && !pdfStates[e.id]?.thumbnailUrl
    );

    if (unparsedAudio.length === 0 && unparsedPdfs.length === 0) return;

    void (async () => {
      for (const entry of unparsedAudio.slice(0, 20)) {
        if (cancelled) return;
        scannedMetaIdsRef.current.add(entry.id);
        const file = await resolveEntryFile(entry);
        if (!file) continue;
        const parsed = await parseAudioFileTags(file);
        if (cancelled) return;

        // Read duration safely via temporary audio element metadata
        const dur = await new Promise<number>((resolve) => {
          const a = new Audio();
          const u = URL.createObjectURL(file);
          const done = (val: number) => {
            URL.revokeObjectURL(u);
            resolve(val);
          };
          a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? a.duration : 0);
          a.onerror = () => done(0);
          a.src = u;
        });

        const existing = trackRecords[entry.id];
        if (parsed.title || parsed.artist || parsed.album || parsed.genre || parsed.coverBlob || dur > 0) {
          const updated: StoredTrackRecord = {
            id: entry.id,
            title: existing?.title || parsed.title || entry.name.replace(/\.[^.]+$/, ''),
            artist: existing?.artist || parsed.artist || '<unknown>',
            album: existing?.album || parsed.album || entry.folderPath.split('/').pop() || '',
            genre: existing?.genre !== undefined ? existing.genre : parsed.genre || '',
            duration: dur || existing?.duration || 0,
            coverBlob: existing?.hasCustomCover
              ? existing.coverBlob
              : parsed.coverBlob || existing?.coverBlob,
            hasCustomCover: existing?.hasCustomCover || false,
            playCount: existing?.playCount || 0,
            lastPlayedAt: existing?.lastPlayedAt || 0,
            addedAt: existing?.addedAt || entry.lastModified,
            isFavorite: existing?.isFavorite || false,
          };
          await saveTrackRecord(updated);
          if (!cancelled) {
            setTrackRecords((prev) => ({ ...prev, [entry.id]: updated }));
          }
        }
      }

      for (const pdfEntry of unparsedPdfs.slice(0, 10)) {
        if (cancelled) return;
        scannedMetaIdsRef.current.add(pdfEntry.id);
        const file = await resolveEntryFile(pdfEntry);
        if (!file) continue;
        const { thumbnailUrl, totalPages } = await generatePdfThumbnail(file);
        if (cancelled) return;
        if (thumbnailUrl || totalPages > 0) {
          const prev = pdfStates[pdfEntry.id];
          const nextState: PdfDocState = {
            ...prev,
            id: pdfEntry.id,
            starred: prev?.starred || false,
            lastOpenedAt: prev?.lastOpenedAt || 0,
            currentPage: prev?.currentPage || 1,
            totalPages: totalPages || prev?.totalPages || 0,
            zoom: prev?.zoom || 1,
            thumbnailUrl: thumbnailUrl || prev?.thumbnailUrl,
          };
          await savePdfState(nextState);
          if (!cancelled) {
            setPdfStates((p) => ({ ...p, [pdfEntry.id]: nextState }));
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [audioEntries, pdfEntries, trackRecords, pdfStates]);

  // Purge deleted files simultaneously across player, queues, playlists, PDFs, and IndexedDB
  const purgeDeletedIds = useCallback((deletedIds: string[]) => {
    if (deletedIds.length === 0) return;
    const deletedSet = new Set(deletedIds);

    for (const id of deletedIds) {
      scannedMetaIdsRef.current.delete(id);
      void deleteFallbackFile(id);
      void deleteTrackRecord(id);
      void deletePdfState(id);
    }

    setQueueIds((prev) => prev.filter((id) => !deletedSet.has(id)));

    if (currentTrackIdRef.current && deletedSet.has(currentTrackIdRef.current)) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      }
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
        currentObjectUrlRef.current = null;
      }
      setCurrentTrackId(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }

    if (openPdfEntryRef.current && deletedSet.has(openPdfEntryRef.current.id)) {
      setOpenPdfEntry(null);
    }
    if (artworkEntryRef.current && deletedSet.has(artworkEntryRef.current.id)) {
      setArtworkEntry(null);
    }
    if (assignImageEntryRef.current && deletedSet.has(assignImageEntryRef.current.id)) {
      setAssignImageEntry(null);
    }

    setTrackRecords((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of deletedIds) {
        if (id in next) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    setPdfStates((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of deletedIds) {
        if (id in next) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    setPlaylists((prev) => {
      let anyChanged = false;
      const next = prev.map((pl) => {
        if (pl.isSmart) return pl;
        const filtered = pl.trackIds.filter((id) => !deletedSet.has(id));
        if (filtered.length !== pl.trackIds.length) {
          anyChanged = true;
          const updated = { ...pl, trackIds: filtered };
          void savePlaylist(updated);
          return updated;
        }
        return pl;
      });
      return anyChanged ? next : prev;
    });
  }, []);

  // THE RECONING OF ALL THINGS — Real-Time Directory Sync & Simultaneous Deletion Engine
  const syncLiveDirectory = useCallback(
    async (handleOverride?: FileSystemDirectoryHandle) => {
      const target = handleOverride || rootHandle;
      if (!target || syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      setSyncing(true);
      try {
        const scanned = await scanDirectoryHandle(target);
        const isSameRoot = lastScannedHandleRef.current === target;
        lastScannedHandleRef.current = target;

        const prevEntries = entriesRef.current;
        const prevFsEntries = prevEntries.filter((e) => e.id.startsWith('fs:'));
        const localEntries = prevEntries.filter((e) => !e.id.startsWith('fs:'));
        const nextIds = new Set(scanned.entries.map((e) => e.id));

        const removedFsEntries = isSameRoot
          ? prevFsEntries.filter((e) => !nextIds.has(e.id))
          : [];

        const mergedEntries =
          localEntries.length > 0 ? [...scanned.entries, ...localEntries] : scanned.entries;

        setEntries((prev) => {
          const prevSig = prev.map((e) => `${e.id}:${e.size}:${e.lastModified}`).join('|');
          const nextSig = mergedEntries
            .map((e) => `${e.id}:${e.size}:${e.lastModified}`)
            .join('|');
          return prevSig === nextSig ? prev : mergedEntries;
        });
        setFolders(scanned.folders);
        setNeedsReconnect(false);

        if (removedFsEntries.length > 0) {
          purgeDeletedIds(removedFsEntries.map((e) => e.id));
          setReconciledDeletionsCount((c) => c + removedFsEntries.length);
          showToast(
            removedFsEntries.length === 1
              ? `THE RECONING OF ALL THINGS: removed "${removedFsEntries[0].name}"`
              : `THE RECONING OF ALL THINGS: removed ${removedFsEntries.length} deleted files`
          );
        }
      } catch (err) {
        const name = (err as DOMException)?.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setNeedsReconnect(true);
        }
      } finally {
        syncInFlightRef.current = false;
        setSyncing(false);
      }
    },
    [rootHandle, purgeDeletedIds, showToast]
  );

  // Automatic real-time FileSystemObserver + 1.5s polling + focus/visibility sync
  useEffect(() => {
    if (!rootHandle || needsReconnect || !permissions.realTimeSyncEnabled) {
      setNativeObserverActive(false);
      return;
    }

    const observer = observeDirectoryHandle(rootHandle, () => {
      void syncLiveDirectory();
    });
    setNativeObserverActive(observer.active);

    const interval = setInterval(() => {
      void syncLiveDirectory();
    }, 1500);

    const onFocus = () => void syncLiveDirectory();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void syncLiveDirectory();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      observer.disconnect();
      setNativeObserverActive(false);
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [rootHandle, needsReconnect, permissions.realTimeSyncEnabled, syncLiveDirectory]);

  // Connect live directory via showDirectoryPicker
  const handleConnectLiveFolder = async () => {
    if (!('showDirectoryPicker' in window)) {
      showToast('Use "Select Phone Folder" on this browser.');
      return;
    }
    try {
      // @ts-expect-error showDirectoryPicker is standard File System Access API
      const dirHandle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
        id: 'reckoning-all-things-root',
        mode: 'readwrite',
      });
      setRootHandle(dirHandle);
      await saveRootDirectoryHandle(dirHandle);
      const nextPerms: PermissionState = {
        musicAndAudio: true,
        photosAndVideos: true,
        allFilesAccess: true,
        realTimeSyncEnabled: true,
      };
      setPermissions(nextPerms);
      await savePermissions(nextPerms);
      await syncLiveDirectory(dirHandle);
      setPermissionsOpen(false);
      showToast(`THE RECONING OF ALL THINGS active on "${dirHandle.name}"`);
    } catch (err) {
      if ((err as Error)?.name === 'SecurityError') {
        showToast('Use "Select Phone Folder" to grant storage access.');
      }
    }
  };

  const handleReconnectSavedFolder = async () => {
    if (!rootHandle) return;
    const ok = await verifyDirectoryPermission(rootHandle, true);
    if (ok) {
      await syncLiveDirectory(rootHandle);
      showToast('Reconnected internal storage');
    }
  };

  // Mobile fallback folder picker
  const handlePickFallbackDirectory = async (files: FileList) => {
    const { entries: nextEntries, folders: nextFolders, fallbackRecords } =
      fileListToEntries(files);
    for (const rec of fallbackRecords) {
      await saveFallbackFile(rec);
    }
    setEntries((prev) => {
      const map = new Map(prev.map((p) => [p.id, p]));
      for (const e of nextEntries) map.set(e.id, e);
      return Array.from(map.values());
    });
    setFolders((prev) => Array.from(new Set([...prev, ...nextFolders])).sort());
    const nextPerms: PermissionState = {
      musicAndAudio: true,
      photosAndVideos: true,
      allFilesAccess: true,
      realTimeSyncEnabled: true,
    };
    setPermissions(nextPerms);
    await savePermissions(nextPerms);
    setPermissionsOpen(false);
    showToast(`Loaded ${nextEntries.length} files from device`);
  };

  const handlePickMultipleFiles = async (files: FileList) => {
    const { entries: nextEntries, folders: nextFolders, fallbackRecords } =
      fileListToEntries(files);
    for (const rec of fallbackRecords) {
      await saveFallbackFile(rec);
    }
    setEntries((prev) => {
      const map = new Map(prev.map((p) => [p.id, p]));
      for (const e of nextEntries) map.set(e.id, e);
      return Array.from(map.values());
    });
    setFolders((prev) => Array.from(new Set([...prev, ...nextFolders])).sort());
    const nextPerms: PermissionState = {
      ...permissions,
      musicAndAudio: true,
      allFilesAccess: true,
    };
    setPermissions(nextPerms);
    await savePermissions(nextPerms);
    setPermissionsOpen(false);
    showToast(`Imported ${nextEntries.length} file(s)`);
  };

  const handleTogglePermission = (key: keyof PermissionState) => {
    const next = { ...permissions, [key]: !permissions[key] };
    setPermissions(next);
    void savePermissions(next);
  };

  // Audio playback controls
  const playTrackById = useCallback(
    async (trackId: string, queueListIds?: string[]) => {
      const target = audioEntries.find((e) => e.id === trackId);
      if (!target) return;
      const file = await resolveEntryFile(target);
      if (!file) {
        showToast('Unable to read audio file.');
        return;
      }

      if (queueListIds && queueListIds.length > 0) {
        setQueueIds(queueListIds);
      } else if (!queueIds.includes(trackId)) {
        setQueueIds((prev) => [...prev, trackId]);
      }

      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      const audio = audioRef.current;
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
      }
      const url = URL.createObjectURL(file);
      currentObjectUrlRef.current = url;
      audio.src = url;
      audio.volume = volume;
      setCurrentTrackId(trackId);

      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }

      // Update play stats
      const prev = trackRecords[trackId];
      const updated: StoredTrackRecord = {
        id: trackId,
        title: prev?.title || target.name.replace(/\.[^.]+$/, ''),
        artist: prev?.artist || '<unknown>',
        album: prev?.album || target.folderPath.split('/').pop() || '',
        genre: prev?.genre || '',
        duration: prev?.duration || 0,
        coverBlob: prev?.coverBlob,
        hasCustomCover: prev?.hasCustomCover,
        playCount: (prev?.playCount || 0) + 1,
        lastPlayedAt: Date.now(),
        addedAt: prev?.addedAt || target.lastModified,
        isFavorite: prev?.isFavorite || false,
      };
      await saveTrackRecord(updated);
      setTrackRecords((r) => ({ ...r, [trackId]: updated }));
    },
    [audioEntries, queueIds, volume, showToast, trackRecords]
  );

  const handleNextTrack = useCallback(() => {
    if (queueIds.length === 0) return;
    if (repeatMode === 'one' && currentTrackId) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        void audioRef.current.play();
      }
      return;
    }
    if (shuffle && queueIds.length > 1) {
      const others = queueIds.filter((id) => id !== currentTrackId);
      const nextId = others[Math.floor(Math.random() * others.length)];
      void playTrackById(nextId);
      return;
    }
    const idx = currentTrackId ? queueIds.indexOf(currentTrackId) : -1;
    const nextIdx = idx + 1;
    if (nextIdx < queueIds.length) {
      void playTrackById(queueIds[nextIdx]);
    } else if (repeatMode === 'all' && queueIds.length > 0) {
      void playTrackById(queueIds[0]);
    } else {
      setIsPlaying(false);
    }
  }, [queueIds, currentTrackId, shuffle, repeatMode, playTrackById]);

  const handlePrevTrack = useCallback(() => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    if (queueIds.length === 0) return;
    const idx = currentTrackId ? queueIds.indexOf(currentTrackId) : 0;
    const prevIdx = idx > 0 ? idx - 1 : queueIds.length - 1;
    void playTrackById(queueIds[prevIdx]);
  }, [queueIds, currentTrackId, playTrackById]);

  // Attach HTMLAudioElement listeners
  const lastMediaPosSyncRef = useRef(0);
  useEffect(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;

    const onTime = () => {
      const pos = audio.currentTime || 0;
      setCurrentTime(pos);
      const now = Date.now();
      if (now - lastMediaPosSyncRef.current >= 950) {
        lastMediaPosSyncRef.current = now;
        updateAndroidMediaPosition(
          Number.isFinite(audio.duration) ? audio.duration : 0,
          pos,
          !audio.paused
        );
      }
    };
    const onDur = () => {
      const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
      setDuration(dur);
      updateAndroidMediaPosition(dur, audio.currentTime || 0, !audio.paused);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => handleNextTrack();

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onDur);
    audio.addEventListener('durationchange', onDur);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onDur);
      audio.removeEventListener('durationchange', onDur);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [handleNextTrack]);

  // Wire full Android Media Notification + Lock Screen controls (Web MediaSession + Capacitor Native)
  useEffect(() => {
    const onSeekTo = (sec: number) => {
      if (!audioRef.current) return;
      const dur = Number.isFinite(audioRef.current.duration) ? audioRef.current.duration : duration;
      const clamped = Math.max(0, dur > 0 ? Math.min(dur, sec) : sec);
      audioRef.current.currentTime = clamped;
      setCurrentTime(clamped);
      updateAndroidMediaPosition(dur, clamped, !audioRef.current.paused);
    };

    const onStop = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
      setCurrentTime(0);
    };

    if ('mediaSession' in navigator) {
      const safeSetHandler = (
        action: MediaSessionAction,
        handler: MediaSessionActionHandler | null
      ) => {
        try {
          navigator.mediaSession.setActionHandler(action, handler);
        } catch {
          // unsupported action on older browser
        }
      };

      safeSetHandler('play', () => void audioRef.current?.play());
      safeSetHandler('pause', () => audioRef.current?.pause());
      safeSetHandler('previoustrack', handlePrevTrack);
      safeSetHandler('nexttrack', handleNextTrack);
      safeSetHandler('stop', onStop);
      safeSetHandler('seekbackward', (details) => {
        const offset = details.seekOffset || 10;
        onSeekTo((audioRef.current?.currentTime || 0) - offset);
      });
      safeSetHandler('seekforward', (details) => {
        const offset = details.seekOffset || 10;
        onSeekTo((audioRef.current?.currentTime || 0) + offset);
      });
      safeSetHandler('seekto', (details) => {
        if (typeof details.seekTime === 'number') {
          onSeekTo(details.seekTime);
        }
      });
    }

    const unsubscribeNative = subscribeNativeMediaActions({
      onPlay: () => void audioRef.current?.play(),
      onPause: () => audioRef.current?.pause(),
      onPrev: handlePrevTrack,
      onNext: handleNextTrack,
      onSeekTo,
      onStop,
    });

    return () => {
      unsubscribeNative();
    };
  }, [handlePrevTrack, handleNextTrack, duration]);

  // Reactive Android Media Notification & Lock Screen Full-Art Sync
  const activeCoverBlob = currentTrackId ? trackRecords[currentTrackId]?.coverBlob : undefined;
  const activeTrackTitle = currentTrackId
    ? trackRecords[currentTrackId]?.title ||
      audioEntries.find((e) => e.id === currentTrackId)?.name.replace(/\.[^.]+$/, '') ||
      'Symphony No. 9'
    : '';
  const activeTrackArtist = currentTrackId
    ? trackRecords[currentTrackId]?.artist || '<unknown>'
    : '';
  const activeTrackAlbum = currentTrackId ? trackRecords[currentTrackId]?.album || '' : '';

  useEffect(() => {
    if (!currentTrackId) {
      void clearAndroidMediaNotification();
      return;
    }

    let cancelled = false;
    const sync = async () => {
      const dataUrl = activeCoverBlob ? await blobToLockScreenDataUrl(activeCoverBlob) : null;
      if (cancelled) return;
      await syncAndroidMediaNotification({
        title: activeTrackTitle,
        artist: activeTrackArtist,
        album: activeTrackAlbum,
        isPlaying,
        durationSec: duration || audioRef.current?.duration || 0,
        positionSec: audioRef.current?.currentTime || 0,
        artworkDataUrl: dataUrl,
      });
    };

    void sync();
    return () => {
      cancelled = true;
    };
  }, [
    currentTrackId,
    activeTrackTitle,
    activeTrackArtist,
    activeTrackAlbum,
    activeCoverBlob,
    isPlaying,
    duration,
  ]);

  const handleTogglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || !currentTrackId) {
      if (audioEntries.length > 0) {
        void playTrackById(
          audioEntries[0].id,
          audioEntries.map((e) => e.id)
        );
      }
      return;
    }
    if (audio.paused) void audio.play();
    else audio.pause();
  };

  const handleSeek = (sec: number) => {
    setCurrentTime(sec);
    if (audioRef.current) audioRef.current.currentTime = sec;
  };

  const handleVolumeChange = (vol: number) => {
    setVolume(vol);
    if (audioRef.current) audioRef.current.volume = vol;
  };

  const handleToggleFavorite = async (trackId: string) => {
    const entry = audioEntries.find((e) => e.id === trackId);
    const prev = trackRecords[trackId];
    const updated: StoredTrackRecord = {
      id: trackId,
      title: prev?.title || entry?.name.replace(/\.[^.]+$/, '') || 'Track',
      artist: prev?.artist || '<unknown>',
      album: prev?.album || '',
      genre: prev?.genre || '',
      duration: prev?.duration || 0,
      coverBlob: prev?.coverBlob,
      hasCustomCover: prev?.hasCustomCover,
      playCount: prev?.playCount || 0,
      lastPlayedAt: prev?.lastPlayedAt || 0,
      addedAt: prev?.addedAt || entry?.lastModified || Date.now(),
      isFavorite: !(prev?.isFavorite || false),
    };
    await saveTrackRecord(updated);
    setTrackRecords((r) => ({ ...r, [trackId]: updated }));
  };

  const handleSaveTrackMetadata = async (
    entryId: string,
    updates: {
      title: string;
      artist: string;
      album: string;
      genre?: string;
      coverBlob?: Blob | null;
    }
  ) => {
    const entry = audioEntries.find((e) => e.id === entryId);
    const prev = trackRecords[entryId];
    const nextCover =
      updates.coverBlob === null
        ? undefined
        : updates.coverBlob !== undefined
          ? updates.coverBlob
          : prev?.coverBlob;

    const updated: StoredTrackRecord = {
      id: entryId,
      title: updates.title,
      artist: updates.artist,
      album: updates.album,
      genre: updates.genre !== undefined ? updates.genre : prev?.genre || '',
      duration: prev?.duration || 0,
      coverBlob: nextCover,
      hasCustomCover: updates.coverBlob === null ? false : Boolean(nextCover),
      playCount: prev?.playCount || 0,
      lastPlayedAt: prev?.lastPlayedAt || 0,
      addedAt: prev?.addedAt || entry?.lastModified || Date.now(),
      isFavorite: prev?.isFavorite || false,
    };
    await saveTrackRecord(updated);
    setTrackRecords((r) => ({ ...r, [entryId]: updated }));
    showToast('Updated audio artwork & tags');
  };

  // Wallpaper handlers
  const handleAddWallpaperFile = async (file: File) => {
    const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm)$/i.test(file.name);

    let width: number | undefined;
    let height: number | undefined;
    if (!isVideo) {
      try {
        const url = URL.createObjectURL(file);
        const dims = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => resolve({ w: 0, h: 0 });
          img.src = url;
        });
        URL.revokeObjectURL(url);
        if (dims.w > 0) {
          width = dims.w;
          height = dims.h;
        }
      } catch {
        // ignore
      }
    }

    const item: WallpaperItem = {
      id: `wp:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      mimeType: file.type || (isGif ? 'image/gif' : 'image/jpeg'),
      isGif,
      isVideo,
      size: file.size,
      width,
      height,
      createdAt: Date.now(),
      blob: file,
    };
    await saveWallpaper(item);
    setWallpapers((prev) => [item, ...prev]);
    const nextCfg: WallpaperConfig = {
      ...wallpaperConfig,
      activeWallpaperId: item.id,
      scope: wallpaperConfig.scope === 'off' ? 'global' : wallpaperConfig.scope,
    };
    setWallpaperConfig(nextCfg);
    await saveWallpaperConfig(nextCfg);
    showToast(`Applied "${file.name}" wallpaper`);
  };

  const handleUpdateWallpaperConfig = (next: WallpaperConfig) => {
    setWallpaperConfig(next);
    void saveWallpaperConfig(next);
  };

  const handleDeleteWallpaper = async (id: string) => {
    await dbDeleteWallpaper(id);
    setWallpapers((prev) => prev.filter((w) => w.id !== id));
    if (wallpaperConfig.activeWallpaperId === id) {
      const next = { ...wallpaperConfig, activeWallpaperId: null };
      setWallpaperConfig(next);
      await saveWallpaperConfig(next);
    }
  };

  // File operations (create folder, upload, rename, delete)
  const handleCreateFolder = async (parentPath: string, name: string) => {
    const clean = name.replace(/[\\/]/g, '').trim();
    if (!clean) return;
    const fullPath = parentPath ? `${parentPath}/${clean}` : clean;
    if (rootHandle) {
      const ok = await createSubfolderInHandle(rootHandle, parentPath, clean);
      if (ok) {
        await syncLiveDirectory();
        showToast(`Created folder "${clean}"`);
        return;
      }
    }
    setFolders((prev) => Array.from(new Set([...prev, fullPath])).sort());
    showToast(`Created folder "${clean}"`);
  };

  const handleUploadToFolder = async (folderPath: string, files: FileList) => {
    if (rootHandle) {
      const count = await writeUploadedFilesToDirectory(rootHandle, folderPath, files);
      if (count > 0) {
        await syncLiveDirectory();
        showToast(`Saved ${count} file(s) to internal storage`);
        return;
      }
    }
    // Fallback local store
    const { entries: added, fallbackRecords } = fileListToEntries(files);
    const patchedEntries = added.map((e) => ({
      ...e,
      folderPath,
      relativePath: folderPath ? `${folderPath}/${e.name}` : e.name,
    }));
    for (const rec of fallbackRecords) {
      await saveFallbackFile({
        ...rec,
        folderPath,
        relativePath: folderPath ? `${folderPath}/${rec.name}` : rec.name,
      });
    }
    setEntries((prev) => [...prev, ...patchedEntries]);
    showToast(`Added ${added.length} file(s)`);
  };

  const handleRenameFile = async (entry: DeviceFileEntry, newName: string) => {
    const clean = newName.replace(/[\\/]/g, '').trim();
    if (!clean || clean === entry.name) return;
    if (entry.handle && entry.parentHandle) {
      const ok = await renameEntryInHandle(entry, clean);
      if (ok) {
        await syncLiveDirectory();
        showToast(`Renamed to "${clean}"`);
        return;
      }
    }
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entry.id
          ? {
              ...e,
              name: clean,
              relativePath: e.folderPath ? `${e.folderPath}/${clean}` : clean,
            }
          : e
      )
    );
    showToast(`Renamed to "${clean}"`);
  };

  const handleDeleteFile = async (entry: DeviceFileEntry) => {
    let deletedFromPhone = false;
    if (entry.handle && entry.parentHandle) {
      deletedFromPhone = await deleteEntryFromHandle(entry);
    }
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    purgeDeletedIds([entry.id]);
    setReconciledDeletionsCount((c) => c + 1);
    if (deletedFromPhone) {
      await syncLiveDirectory();
      showToast(`THE RECONING OF ALL THINGS: deleted "${entry.name}" from phone & player`);
    } else {
      showToast(`Deleted "${entry.name}" from player`);
    }
  };

  // Universe AI Image & DIY Theme Handlers
  const handleSaveNewDiyTheme = (name: string, cfg: DiyPdfThemeConfig) => {
    const cleanName = name.trim() || 'Custom DIY Theme';
    const nextItem: SavedDiyTheme = {
      id: `diy:${Date.now()}`,
      name: cleanName,
      config: { ...cfg, name: cleanName },
      createdAt: Date.now(),
    };
    setSavedDiyThemes((prev) => {
      const updated = [nextItem, ...prev];
      void saveSavedDiyThemes(updated);
      return updated;
    });
    showToast(`Saved DIY theme "${cleanName}"`);
  };

  const handleDeleteSavedDiyTheme = (id: string) => {
    setSavedDiyThemes((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      void saveSavedDiyThemes(updated);
      return updated;
    });
  };

  const handleExportDiyJson = () => {
    const payload = {
      version: 1,
      activeDiyConfig: diyThemeConfig,
      savedThemes: savedDiyThemes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kurodeck-diy-themes.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported DIY themes JSON');
  };

  const handleImportDiyJson = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        activeDiyConfig?: DiyPdfThemeConfig;
        savedThemes?: SavedDiyTheme[];
      };
      let importedCount = 0;
      if (parsed.activeDiyConfig) {
        setDiyThemeConfig(parsed.activeDiyConfig);
        void saveDiyThemeConfig(parsed.activeDiyConfig);
      }
      if (Array.isArray(parsed.savedThemes)) {
        const valid = parsed.savedThemes.filter(
          (item) => item && typeof item.name === 'string' && item.config
        );
        importedCount = valid.length;
        setSavedDiyThemes((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const merged = [...valid.filter((v) => !existingIds.has(v.id)), ...prev];
          void saveSavedDiyThemes(merged);
          return merged;
        });
      }
      showToast(`Imported ${importedCount} DIY theme(s)`);
    } catch {
      showToast('Invalid DIY JSON file');
    }
  };

  const handleGenerateUniverseAiImage = async (
    themeId: Exclude<PdfThemeId, 'diy'>,
    customPrompt?: string
  ) => {
    const preset = PDF_THEME_PRESETS[themeId];
    setGeneratingThemeId(themeId);
    setAiError(null);
    try {
      const res = await fetch('/api/universe-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          themeId,
          label: preset.label,
          prompt: customPrompt || preset.aiPrompt,
          aspectRatio: '16:9',
        }),
      });
      const data = (await res.json()) as { imageDataUrl?: string; error?: string };
      if (!res.ok || !data.imageDataUrl) {
        throw new Error(data.error || `Server error (${res.status})`);
      }
      const next = await saveUniverseImage(themeId, data.imageDataUrl);
      setUniverseImages(next);
      showToast(`Generated ${preset.label} AI backdrop`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to generate AI universe image.';
      setAiError(msg);
      showToast(msg);
    } finally {
      setGeneratingThemeId(null);
    }
  };

  const handleClearUniverseAiImage = (themeId: string) => {
    void deleteUniverseImage(themeId).then((next) => {
      setUniverseImages(next);
      showToast('Restored procedural universe backdrop');
    });
  };

  const currentAudioMeta = currentTrackId ? trackMetaMap[currentTrackId] : null;

  const navItems: { id: MainWorkspace; label: string; icon: React.ReactNode }[] = [
    { id: 'audio', label: 'Audio', icon: <Music className="h-5 w-5" /> },
    { id: 'pdf', label: 'PDFs', icon: <FileText className="h-5 w-5" /> },
    { id: 'files', label: 'Files', icon: <HardDrive className="h-5 w-5" /> },
    { id: 'wallpapers', label: 'Wallpapers', icon: <Wallpaper className="h-5 w-5" /> },
  ];

  const isWallpaperVisible =
    Boolean(activeWallpaper) &&
    wallpaperConfig.scope !== 'off' &&
    (wallpaperConfig.scope === 'global' ||
      (wallpaperConfig.scope === 'audio' && workspace === 'audio') ||
      (wallpaperConfig.scope === 'pdf' && workspace === 'pdf'));

  return (
    <div className="relative flex h-dvh w-full overflow-hidden bg-[#09090b] text-zinc-100">
      {/* 4K GIF / Photo Wallpaper Layer */}
      <WallpaperLayer
        wallpaper={activeWallpaper}
        config={wallpaperConfig}
        activeWorkspace={workspace}
      />

      {/* Desktop Side Navigation Rail */}
      <aside
        className={`relative z-20 hidden w-60 shrink-0 flex-col justify-between border-r border-zinc-800/70 p-4 backdrop-blur-md lg:flex ${
          isWallpaperVisible ? 'bg-black/40' : 'bg-[#09090b]/95'
        }`}
      >
        <div className="space-y-6">
          <div className="px-2 pt-1">
            <span className="font-display text-xl font-bold tracking-tight text-white">
              Symphony No. 9
            </span>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = workspace === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setWorkspace(item.id)}
                  className={`flex min-h-[46px] w-full items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-violet-600/20 text-white'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                  }`}
                >
                  <span className={active ? 'text-violet-400' : ''}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-2 border-t border-zinc-800/80 pt-4">
          {needsReconnect && rootHandle && (
            <button
              type="button"
              onClick={() => void handleReconnectSavedFolder()}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-3 text-xs font-semibold text-zinc-950 hover:bg-amber-200"
            >
              <FolderOpen className="h-4 w-4" />
              <span>Reconnect "{rootHandle.name}"</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenGestureSecurity}
            className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs font-medium text-zinc-200 hover:bg-zinc-900"
          >
            <span className="flex items-center gap-2">
              {isGestureLockActive && !isSecurityUnlocked ? (
                <Lock className="h-4 w-4 text-amber-300" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              )}
              <span>Gesture Security</span>
            </span>
            <span className="font-mono text-[11px] text-amber-300">
              {isGestureLockActive ? (isSecurityUnlocked ? 'Unlocked' : 'Locked') : 'Off'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => void handleExportStandaloneHtml()}
            className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-cyan-500/30 bg-cyan-950/20 px-3 text-xs font-medium text-cyan-200 hover:bg-cyan-950/35"
          >
            <span className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-cyan-300" />
              <span>Export Standalone HTML</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPermissionsOpen(true)}
            className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs font-medium text-zinc-200 hover:bg-zinc-900"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-300" />
              <span>Storage & Permissions</span>
            </span>
            <span className="font-mono text-[11px] text-zinc-400">{entries.length}</span>
          </button>
          <PWAInstallButton variant="compact" />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Reconnect Banner after Page Reload if FileSystemHandle needs user gesture */}
        {needsReconnect && rootHandle && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-950/50 px-4 py-2 backdrop-blur-md lg:hidden">
            <p className="truncate text-xs text-amber-200">
              Tap to resume real-time access to "{rootHandle.name}"
            </p>
            <button
              type="button"
              onClick={() => void handleReconnectSavedFolder()}
              className="min-h-[36px] shrink-0 rounded-lg bg-amber-300 px-3 text-xs font-semibold text-zinc-950"
            >
              Reconnect
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-hidden">
          {workspace === 'audio' && (
            <AudioWorkspace
              audioEntries={audioEntries}
              folders={folders}
              trackMetaMap={trackMetaMap}
              playlists={playlists}
              queueIds={queueIds}
              currentTrackId={currentTrackId}
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              shuffle={shuffle}
              repeatMode={repeatMode}
              volume={volume}
              hasLiveFolder={Boolean(rootHandle)}
              wallpaperActive={isWallpaperVisible}
              onOpenPermissions={() => setPermissionsOpen(true)}
              onPlayTrack={(id, listIds) => void playTrackById(id, listIds)}
              onTogglePlayPause={handleTogglePlayPause}
              onPrevTrack={handlePrevTrack}
              onNextTrack={handleNextTrack}
              onSeek={handleSeek}
              onToggleShuffle={() => setShuffle((s) => !s)}
              onCycleRepeat={() =>
                setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'))
              }
              onChangeVolume={handleVolumeChange}
              onToggleFavorite={(id) => void handleToggleFavorite(id)}
              onAddToQueue={(id, playNext) => {
                setQueueIds((prev) => {
                  const filtered = prev.filter((x) => x !== id);
                  if (playNext && currentTrackId) {
                    const idx = filtered.indexOf(currentTrackId);
                    if (idx >= 0) {
                      const copy = [...filtered];
                      copy.splice(idx + 1, 0, id);
                      return copy;
                    }
                  }
                  return [...filtered, id];
                });
                showToast(playNext ? 'Queued to play next' : 'Added to queue');
              }}
              onRemoveFromQueue={(idx) =>
                setQueueIds((prev) => prev.filter((_, i) => i !== idx))
              }
              onMoveQueueItem={(from, to) =>
                setQueueIds((prev) => {
                  const copy = [...prev];
                  const [item] = copy.splice(from, 1);
                  copy.splice(to, 0, item);
                  return copy;
                })
              }
              onClearQueue={() => setQueueIds([])}
              onOpenArtworkEditor={(entry) => setArtworkEntry(entry)}
              onCreatePlaylist={(name) => {
                const pl: UserPlaylist = {
                  id: `pl:${Date.now()}`,
                  name,
                  trackIds: [],
                  createdAt: Date.now(),
                };
                void savePlaylist(pl);
                setPlaylists((prev) => [...prev, pl]);
              }}
              onAddTrackToPlaylist={(playlistId, trackId) => {
                setPlaylists((prev) =>
                  prev.map((pl) => {
                    if (pl.id !== playlistId || pl.trackIds.includes(trackId)) return pl;
                    const updated = { ...pl, trackIds: [...pl.trackIds, trackId] };
                    void savePlaylist(updated);
                    return updated;
                  })
                );
                showToast('Added to playlist');
              }}
              onRemoveTrackFromPlaylist={(playlistId, trackId) => {
                setPlaylists((prev) =>
                  prev.map((pl) => {
                    if (pl.id !== playlistId) return pl;
                    const updated = {
                      ...pl,
                      trackIds: pl.trackIds.filter((id) => id !== trackId),
                    };
                    void savePlaylist(updated);
                    return updated;
                  })
                );
              }}
              onDeletePlaylist={(id) => {
                void dbDeletePlaylist(id);
                setPlaylists((prev) => prev.filter((p) => p.id !== id));
              }}
              onSaveSmartPlaylists={(items) => {
                if (items.length === 0) return;
                setPlaylists((prev) => {
                  const next = [...prev];
                  for (const item of items) {
                    const existingIdx = next.findIndex(
                      (p) =>
                        p.isSmart &&
                        p.smartRule?.groupBy === item.smartRule.groupBy &&
                        p.smartRule?.value.toLowerCase() === item.smartRule.value.toLowerCase()
                    );
                    if (existingIdx >= 0) {
                      const updated: UserPlaylist = {
                        ...next[existingIdx],
                        name: item.name,
                        trackIds: item.trackIds,
                        smartRule: item.smartRule,
                      };
                      next[existingIdx] = updated;
                      void savePlaylist(updated);
                    } else {
                      const created: UserPlaylist = {
                        id: `smart:${item.smartRule.groupBy}:${Date.now()}:${Math.random()
                          .toString(36)
                          .slice(2, 6)}`,
                        name: item.name,
                        trackIds: item.trackIds,
                        createdAt: Date.now(),
                        isSmart: true,
                        smartRule: item.smartRule,
                      };
                      next.push(created);
                      void savePlaylist(created);
                    }
                  }
                  return next;
                });
                showToast(
                  items.length === 1
                    ? `Saved Smart Playlist "${items[0].name}"`
                    : `Generated ${items.length} Smart Playlists`
                );
              }}
              videoEntries={videoEntries}
              pdfEntries={pdfEntries}
              savedLinks={savedLinks}
              onOpenWorkspace={(ws) => setWorkspace(ws)}
              onSaveLink={(item) => {
                setSavedLinks((prev) => {
                  const exists = prev.some((l) => l.id === item.id);
                  const next = exists
                    ? prev.map((l) => (l.id === item.id ? item : l))
                    : [item, ...prev];
                  void saveSavedLinks(next);
                  return next;
                });
                showToast(`Saved link "${item.title}"`);
              }}
              onDeleteLink={(id) => {
                setSavedLinks((prev) => {
                  const next = prev.filter((l) => l.id !== id);
                  void saveSavedLinks(next);
                  return next;
                });
                showToast('Removed link');
              }}
              onOpenPdf={handleRequestOpenPdf}
              onPauseAudio={() => {
                if (audioRef.current && !audioRef.current.paused) {
                  audioRef.current.pause();
                }
              }}
              sleepTimerRemainingSec={sleepTimerRemainingSec}
              onStartSleepTimer={handleStartSleepTimer}
              onExtendSleepTimer={handleExtendSleepTimer}
              onCancelSleepTimer={handleCancelSleepTimer}
              onClearRecentlyPlayed={() => {
                const updatedEntries: StoredTrackRecord[] = [];
                setTrackRecords((prev) => {
                  const next = { ...prev };
                  for (const [id, rec] of Object.entries(prev)) {
                    if (rec.lastPlayedAt > 0) {
                      const cleared = { ...rec, lastPlayedAt: 0 };
                      next[id] = cleared;
                      updatedEntries.push(cleared);
                    }
                  }
                  return next;
                });
                for (const rec of updatedEntries) {
                  void saveTrackRecord(rec);
                }
                showToast('Cleared recently played history');
              }}
              onDeleteFile={handleDeleteFile}
              gestureLockEnabled={isGestureLockActive}
              onOpenGestureSecurity={handleOpenGestureSecurity}
              onExportStandaloneHtml={() => void handleExportStandaloneHtml()}
            />
          )}

          {workspace === 'pdf' && (
            <PdfWorkspace
              pdfEntries={pdfEntries}
              pdfStates={pdfStates}
              activeTheme={activePdfTheme}
              diyConfig={diyThemeConfig}
              savedDiyThemes={savedDiyThemes}
              universeImages={universeImages}
              activeWallpaper={activeWallpaper}
              generatingThemeId={generatingThemeId}
              aiError={aiError}
              savedLinks={savedLinks}
              voiceReaders={allVoiceReaders}
              activeVoiceReaderId={activeVoiceReaderId}
              ttsServerUrl={ttsServerUrl}
              onSaveTtsServerUrl={(url) => {
                setTtsServerUrl(url);
                void saveTtsServerUrl(url);
                showToast(url ? 'Saved Cloud TTS Server URL' : 'Restored default Cloud TTS Server');
              }}
              onChangeTheme={(theme) => {
                setActivePdfTheme(theme);
                setAiError(null);
                void saveActivePdfTheme(theme);
              }}
              onUpdateDiyConfig={(cfg) => {
                setDiyThemeConfig(cfg);
                void saveDiyThemeConfig(cfg);
              }}
              onSaveNewDiyTheme={handleSaveNewDiyTheme}
              onDeleteSavedDiyTheme={handleDeleteSavedDiyTheme}
              onExportDiyJson={handleExportDiyJson}
              onImportDiyJson={(f) => void handleImportDiyJson(f)}
              onGenerateAiImage={handleGenerateUniverseAiImage}
              onClearAiImage={handleClearUniverseAiImage}
              onOpenPdf={handleRequestOpenPdf}
              onToggleStar={(id) => {
                setPdfStates((prev) => {
                  const curr = prev[id];
                  const next: PdfDocState = {
                    ...curr,
                    id,
                    starred: !(curr?.starred || false),
                    lastOpenedAt: curr?.lastOpenedAt || 0,
                    currentPage: curr?.currentPage || 1,
                    totalPages: curr?.totalPages || 0,
                    zoom: curr?.zoom || 1,
                  };
                  void savePdfState(next);
                  return { ...prev, [id]: next };
                });
              }}
              onSavePdfMetadata={(id, updates) => {
                setPdfStates((prev) => {
                  const curr = prev[id] || {
                    id,
                    starred: false,
                    lastOpenedAt: 0,
                    currentPage: 1,
                    totalPages: 0,
                    zoom: 1,
                  };
                  const next: PdfDocState = {
                    ...curr,
                    author: updates.author,
                    tags: updates.tags,
                    summaryNotes: updates.summaryNotes,
                  };
                  void savePdfState(next);
                  return { ...prev, [id]: next };
                });
                showToast('Saved PDF metadata & tags');
              }}
              onSaveLink={(item) => {
                setSavedLinks((prev) => {
                  const exists = prev.some((l) => l.id === item.id);
                  const next = exists
                    ? prev.map((l) => (l.id === item.id ? item : l))
                    : [item, ...prev];
                  void saveSavedLinks(next);
                  return next;
                });
                showToast(`Saved link "${item.title}"`);
              }}
              onDeleteLink={(id) => {
                setSavedLinks((prev) => {
                  const next = prev.filter((l) => l.id !== id);
                  void saveSavedLinks(next);
                  return next;
                });
                showToast('Removed link');
              }}
              onSelectVoiceReader={(id) => {
                setActiveVoiceReaderId(id);
                void saveActiveVoiceReaderId(id);
              }}
              onSaveCustomVoiceReader={(reader) => {
                setCustomVoiceReaders((prev) => {
                  const next = [reader, ...prev.filter((r) => r.id !== reader.id)];
                  void saveCustomVoiceReaders(next);
                  return next;
                });
                showToast(`Saved AI voice reader "${reader.name}"`);
              }}
              onDeleteCustomVoiceReader={(id) => {
                setCustomVoiceReaders((prev) => {
                  const next = prev.filter((r) => r.id !== id);
                  void saveCustomVoiceReaders(next);
                  return next;
                });
                if (activeVoiceReaderId === id) {
                  setActiveVoiceReaderId('builtin:kore-audiobook');
                  void saveActiveVoiceReaderId('builtin:kore-audiobook');
                }
              }}
              onImportPdfFiles={handlePickMultipleFiles}
              onOpenPermissions={() => setPermissionsOpen(true)}
              onDeleteFile={handleDeleteFile}
              wallpaperActive={isWallpaperVisible}
              gestureLockEnabled={isGestureLockActive}
              lockPdfReader={gestureLockSettings.lockPdfReader}
              isSecurityUnlocked={isSecurityUnlocked}
              onOpenSecuritySettings={handleOpenGestureSecurity}
              onLockNow={lockSecurityNow}
            />
          )}

          {workspace === 'files' && (
            <FilesWorkspace
              allEntries={entries}
              folders={folders}
              trackMetaMap={trackMetaMap}
              pdfStates={pdfStates}
              hasLiveFolder={Boolean(rootHandle)}
              linkedFolderName={rootHandle?.name || null}
              realTimeSyncEnabled={permissions.realTimeSyncEnabled}
              syncing={syncing}
              onOpenPermissions={() => setPermissionsOpen(true)}
              onManualSync={() => syncLiveDirectory()}
              onCreateFolder={handleCreateFolder}
              onUploadToFolder={handleUploadToFolder}
              onRenameFile={handleRenameFile}
              onDeleteFile={handleDeleteFile}
              onOpenAudio={(entry) => {
                setWorkspace('audio');
                void playTrackById(
                  entry.id,
                  audioEntries.map((e) => e.id)
                );
              }}
              onOpenPdf={handleRequestOpenPdf}
              onSetAsWallpaper={async (entry) => {
                const file = await resolveEntryFile(entry);
                if (file) {
                  await handleAddWallpaperFile(file);
                  setWorkspace('wallpapers');
                }
              }}
              onAssignImageToTrack={(imgEntry) => setAssignImageEntry(imgEntry)}
              wallpaperActive={isWallpaperVisible}
              gestureLockEnabled={isGestureLockActive}
              lockSensitiveFolders={gestureLockSettings.lockSensitiveFolders}
              lockedFolderPaths={gestureLockSettings.lockedFolderPaths}
              isSecurityUnlocked={isSecurityUnlocked}
              onRequestUnlockFolder={(folderPath, onUnlocked) =>
                requestSecurityUnlock(
                  'Sensitive Folder Locked',
                  `Draw your finger gesture to access "${folderPath}"`,
                  onUnlocked
                )
              }
              onToggleFolderSensitive={handleToggleFolderLock}
              onOpenSecuritySettings={handleOpenGestureSecurity}
              onLockNow={lockSecurityNow}
            />
          )}

          {workspace === 'wallpapers' && (
            <WallpaperStudio
              wallpapers={wallpapers}
              config={wallpaperConfig}
              deviceMediaFiles={entries}
              onAddWallpaperFile={handleAddWallpaperFile}
              onUpdateConfig={handleUpdateWallpaperConfig}
              onDeleteWallpaper={handleDeleteWallpaper}
            />
          )}
        </div>

        {/* Compact Mini-Player when outside Audio workspace or browsing */}
        {currentAudioMeta && workspace !== 'audio' && (
          <div
            className={`relative z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-t border-zinc-800/80 px-4 backdrop-blur-md ${
              isWallpaperVisible ? 'bg-black/45' : 'bg-[#121216]/95'
            }`}
          >
            <button
              type="button"
              onClick={() => setWorkspace('audio')}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-zinc-900 flex items-center justify-center">
                {currentAudioMeta.coverUrl ? (
                  <img
                    src={currentAudioMeta.coverUrl}
                    alt={currentAudioMeta.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Music className="h-4 w-4 text-zinc-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">
                  {currentAudioMeta.title}
                </p>
                <p className="truncate text-[11px] text-zinc-400">
                  {currentAudioMeta.artist}
                </p>
              </div>
            </button>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleTogglePlayPause}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-white"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={handleNextTrack}
                aria-label="Next track"
                className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-300 hover:bg-zinc-800"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Mobile Bottom Tab Bar (56px compact <= 15% sticky cap) */}
        <nav
          aria-label="Primary workspaces"
          className={`relative z-30 grid h-14 shrink-0 grid-cols-4 border-t border-zinc-800/80 backdrop-blur-md lg:hidden ${
            isWallpaperVisible ? 'bg-black/45' : 'bg-[#09090b]/95'
          }`}
        >
          {navItems.map((item) => {
            const active = workspace === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setWorkspace(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active ? 'text-[#5ea3ff]' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {item.icon}
                <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </main>

      {/* Modals & Sheets */}
      <PermissionsSheet
        open={permissionsOpen}
        onClose={() => setPermissionsOpen(false)}
        permissions={permissions}
        hasLiveFolder={Boolean(rootHandle)}
        linkedFolderName={rootHandle?.name || null}
        totalFilesCount={entries.length}
        reconciledDeletionsCount={reconciledDeletionsCount}
        nativeObserverActive={nativeObserverActive}
        onTogglePermission={handleTogglePermission}
        onConnectLiveFolder={handleConnectLiveFolder}
        onPickFallbackDirectory={handlePickFallbackDirectory}
        onPickMultipleFiles={handlePickMultipleFiles}
        onManualSync={() => syncLiveDirectory()}
        syncing={syncing}
        gestureLockSettings={gestureLockSettings}
        isSecurityUnlocked={isSecurityUnlocked}
        onOpenGestureSecurity={handleOpenGestureSecurity}
        onExportStandaloneHtml={() => void handleExportStandaloneHtml()}
      />

      <GestureSecurityModal
        open={gestureSecurityOpen}
        settings={gestureLockSettings}
        folders={folders}
        isUnlocked={isSecurityUnlocked}
        onClose={() => setGestureSecurityOpen(false)}
        onToggleEnableLock={handleToggleEnableGestureLock}
        onRequestChangePattern={handleRequestChangePattern}
        onUpdateSettings={updateGestureSettings}
        onToggleFolderLock={handleToggleFolderLock}
        onLockNow={lockSecurityNow}
        onUnlockSession={() => {
          setGestureSecurityOpen(false);
          requestSecurityUnlock(
            'Unlock Session',
            'Draw your finger gesture to unlock protected areas',
            () => setGestureSecurityOpen(true)
          );
        }}
        onExportStandaloneHtml={() => void handleExportStandaloneHtml()}
      />

      <GestureLockModal
        open={gesturePrompt.open}
        mode={gesturePrompt.mode}
        targetTitle={gesturePrompt.title}
        targetSubtitle={gesturePrompt.subtitle}
        settings={gestureLockSettings}
        onBack={() => setGesturePrompt({ open: false, mode: 'unlock' })}
        onUnlockSuccess={() => {
          const cb = gesturePrompt.onVerified;
          markSecurityUnlocked();
          setGesturePrompt({ open: false, mode: 'unlock' });
          cb?.();
        }}
        onPatternSaved={(pattern) => {
          gesturePrompt.onPatternDone?.(pattern);
        }}
      />

      <ArtworkEditorModal
        open={Boolean(artworkEntry)}
        entry={artworkEntry}
        trackMeta={artworkEntry ? trackMetaMap[artworkEntry.id] || null : null}
        deviceImages={imageEntries}
        onClose={() => setArtworkEntry(null)}
        onSaveMetadata={handleSaveTrackMetadata}
      />

      <PdfReaderModal
        open={Boolean(openPdfEntry)}
        entry={openPdfEntry}
        docState={openPdfEntry ? pdfStates[openPdfEntry.id] || null : null}
        activeTheme={activePdfTheme}
        diyConfig={diyThemeConfig}
        savedDiyThemes={savedDiyThemes}
        universeImages={universeImages}
        activeWallpaper={activeWallpaper}
        generatingThemeId={generatingThemeId}
        aiError={aiError}
        soundEnabled={pdfSoundEnabled}
        voiceReaders={allVoiceReaders}
        activeVoiceReaderId={activeVoiceReaderId}
        ttsServerUrl={ttsServerUrl}
        onSelectVoiceReader={(id) => {
          setActiveVoiceReaderId(id);
          void saveActiveVoiceReaderId(id);
        }}
        onToggleSound={() => {
          setPdfSoundEnabled((prev) => {
            const next = !prev;
            try {
              localStorage.setItem('kurodeck_pdf_sound', next ? '1' : '0');
            } catch {
              // ignore
            }
            return next;
          });
        }}
        onClose={() => {
          setOpenPdfEntry(null);
          if (isGestureLockActive && gestureLockSettings.autoLockMinutes === 0) {
            setSecurityUnlockedUntil(null);
          }
        }}
        onChangeTheme={(theme) => {
          setActivePdfTheme(theme);
          setAiError(null);
          void saveActivePdfTheme(theme);
        }}
        onUpdateDiyConfig={(cfg) => {
          setDiyThemeConfig(cfg);
          void saveDiyThemeConfig(cfg);
        }}
        onSaveNewDiyTheme={handleSaveNewDiyTheme}
        onDeleteSavedDiyTheme={handleDeleteSavedDiyTheme}
        onExportDiyJson={handleExportDiyJson}
        onImportDiyJson={(f) => void handleImportDiyJson(f)}
        onGenerateAiImage={handleGenerateUniverseAiImage}
        onClearAiImage={handleClearUniverseAiImage}
        onUpdateDocState={(id, patch) => {
          setPdfStates((prev) => {
            const curr = prev[id] || {
              id,
              starred: false,
              lastOpenedAt: Date.now(),
              currentPage: 1,
              totalPages: 0,
              zoom: 1,
            };
            const merged = { ...curr, ...patch };
            void savePdfState(merged);
            return { ...prev, [id]: merged };
          });
        }}
      />

      {/* Track Picker Modal when assigning an Image from Files as Song Cover Art */}
      {assignImageEntry && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center sm:p-4"
          onClick={() => setAssignImageEntry(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl border border-zinc-800 bg-[#141418] p-5 sm:rounded-2xl"
          >
            <h3 className="font-display text-base font-semibold text-white">
              Choose Song for "{assignImageEntry.name}"
            </h3>
            {audioEntries.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-400">
                No audio tracks loaded yet.
              </p>
            ) : (
              <div className="steady-scroll mt-3 max-h-72 divide-y divide-zinc-800/80 overflow-y-auto">
                {audioEntries.map((track) => {
                  const meta = trackMetaMap[track.id];
                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={async () => {
                        const imgFile = await resolveEntryFile(assignImageEntry);
                        if (!imgFile) return;
                        await handleSaveTrackMetadata(track.id, {
                          title: meta?.title || track.name.replace(/\.[^.]+$/, ''),
                          artist: meta?.artist || '<unknown>',
                          album: meta?.album || '',
                          coverBlob: imgFile,
                        });
                        setAssignImageEntry(null);
                      }}
                      className="flex min-h-[48px] w-full items-center justify-between gap-2 px-2 py-2 text-left hover:bg-zinc-800 rounded-lg"
                    >
                      <span className="truncate text-sm text-zinc-100">
                        {meta?.title || track.name}
                      </span>
                      <span className="shrink-0 text-xs text-zinc-400">
                        {meta?.artist || ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              onClick={() => setAssignImageEntry(null)}
              className="mt-3 min-h-[44px] w-full rounded-xl border border-zinc-800 text-sm text-zinc-300 hover:bg-zinc-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Quiet Toast Feedback */}
      {toast && (
        <div className="pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-zinc-700/80 bg-zinc-900/95 px-4 py-2 text-xs font-medium text-zinc-100 shadow-lg backdrop-blur-md lg:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
