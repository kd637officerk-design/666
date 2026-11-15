import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  FileText,
  Headphones,
  Loader2,
  Palette,
  PanelRight,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Scroll,
  ScrollText,
  SlidersHorizontal,
  Square,
  Star,
  Trash2,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  AiVoiceReaderProfile,
  DeviceFileEntry,
  DiyPdfThemeConfig,
  PdfBookmark,
  PdfDocState,
  PdfReadingMode,
  PdfThemeId,
  SavedDiyTheme,
  WallpaperItem,
} from '../types';
import { resolveEntryFile } from '../lib/fileSystem';
import {
  PDF_THEME_PRESETS,
  closePdfDocument,
  getDiyCanvasFilter,
  openPdfDocument,
} from '../lib/pdfEngine';
import { playBookmarkSound, playPageTurnSound } from '../lib/pdfSounds';
import { formatExactLeaveStamp, formatReadingMinSec } from '../lib/pdfTime';
import {
  buildTtsCacheKey,
  isNativeAndroidRuntime,
  resolveTtsApiEndpoint,
  speakWithNativeOrDeviceTts,
  stopNativeOrDeviceTts,
} from '../lib/hybridTts';
import { loadCachedTtsAudio, saveCachedTtsAudio } from '../lib/storage';
import { PdfThemeBackdrop } from './PdfThemeBackdrop';
import { SteadyScrubber } from './SteadyScrubber';
import { UniverseThemeStudio } from './UniverseThemeStudio';

interface PdfReaderModalProps {
  open: boolean;
  entry: DeviceFileEntry | null;
  docState: PdfDocState | null;
  activeTheme: PdfThemeId;
  diyConfig: DiyPdfThemeConfig;
  savedDiyThemes: SavedDiyTheme[];
  universeImages: Record<string, string>;
  activeWallpaper: WallpaperItem | null;
  generatingThemeId: string | null;
  aiError: string | null;
  soundEnabled: boolean;
  voiceReaders: AiVoiceReaderProfile[];
  activeVoiceReaderId: string;
  ttsServerUrl?: string;
  onSelectVoiceReader: (id: string) => void;
  onToggleSound: () => void;
  onClose: () => void;
  onChangeTheme: (theme: PdfThemeId) => void;
  onUpdateDiyConfig: (cfg: DiyPdfThemeConfig) => void;
  onSaveNewDiyTheme: (name: string, cfg: DiyPdfThemeConfig) => void;
  onDeleteSavedDiyTheme: (id: string) => void;
  onExportDiyJson: () => void;
  onImportDiyJson: (file: File) => void;
  onGenerateAiImage: (themeId: Exclude<PdfThemeId, 'diy'>, customPrompt?: string) => Promise<void>;
  onClearAiImage: (themeId: string) => void;
  onUpdateDocState: (id: string, patch: Partial<PdfDocState>) => void;
}

const READING_MODES: { id: PdfReadingMode; label: string; icon: React.ReactNode }[] = [
  { id: 'single', label: '1 Page', icon: <FileText className="h-3.5 w-3.5" /> },
  { id: 'two-page', label: '2 Pages', icon: <BookOpen className="h-3.5 w-3.5" /> },
  { id: 'continuous', label: 'Scroll', icon: <ScrollText className="h-3.5 w-3.5" /> },
  { id: 'parchment', label: 'Pergamino', icon: <Scroll className="h-3.5 w-3.5" /> },
];

interface FlipSession {
  active: boolean;
  direction: 'next' | 'prev';
  progress: number; // 0..1
  touchYRatio: number; // 0..1 vertical finger anchor for tall corner curl
  frontUrl: string;
  backUrl: string | null;
  underlayUrl: string | null;
  staticLeftUrl?: string | null;
  staticRightUrl?: string | null;
}

async function renderPageDataUrl(
  pdfDoc: PDFDocumentProxy,
  pageNum: number,
  targetWidth: number,
  zoom: number
): Promise<string | null> {
  if (pageNum < 1 || pageNum > pdfDoc.numPages) return null;
  try {
    const page = await pdfDoc.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const fitScale = (targetWidth / baseViewport.width) * zoom;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const viewport = page.getViewport({ scale: fitScale * dpr });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch {
    return null;
  }
}

async function extractPageReadableText(pdf: PDFDocumentProxy, pageNum: number): Promise<string> {
  if (pageNum < 1 || pageNum > pdf.numPages) return '';
  try {
    const page = await pdf.getPage(pageNum);
    const tc = await page.getTextContent();
    const parts: string[] = [];
    for (const item of tc.items) {
      if ('str' in item && typeof item.str === 'string') {
        parts.push(item.str);
      }
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

export const PdfReaderModal: React.FC<PdfReaderModalProps> = ({
  open,
  entry,
  docState,
  activeTheme,
  diyConfig,
  savedDiyThemes,
  universeImages,
  activeWallpaper,
  generatingThemeId,
  aiError,
  soundEnabled,
  voiceReaders,
  activeVoiceReaderId,
  ttsServerUrl,
  onSelectVoiceReader,
  onToggleSound,
  onClose,
  onChangeTheme,
  onUpdateDiyConfig,
  onSaveNewDiyTheme,
  onDeleteSavedDiyTheme,
  onExportDiyJson,
  onImportDiyJson,
  onGenerateAiImage,
  onClearAiImage,
  onUpdateDocState,
}) => {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pinchPreviewScale, setPinchPreviewScale] = useState(1);
  const [readingMode, setReadingMode] = useState<PdfReadingMode>('single');
  const [showThemeDrawer, setShowThemeDrawer] = useState(false);
  const [showBookmarksPanel, setShowBookmarksPanel] = useState(false);
  const [newBookmarkLabel, setNewBookmarkLabel] = useState('');
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
  const [editingBookmarkText, setEditingBookmarkText] = useState('');
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);

  // Natural Voice Reader State
  const activeVoiceProfile =
    voiceReaders.find((r) => r.id === activeVoiceReaderId) || voiceReaders[0];
  const [showVoiceBar, setShowVoiceBar] = useState(false);
  const [voiceState, setVoiceState] = useState<'idle' | 'loading' | 'playing' | 'paused'>('idle');
  const [voiceRate, setVoiceRate] = useState<number>(activeVoiceProfile?.rate || 1);
  const [autoAdvanceVoice, setAutoAdvanceVoice] = useState(true);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceSnippet, setVoiceSnippet] = useState<string>('');
  const [voiceSourceLabel, setVoiceSourceLabel] = useState<
    'gemini' | 'cached' | 'device' | 'custom' | null
  >(null);

  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const ttsCacheRef = useRef<Record<string, string>>({});
  const voicePageRef = useRef<number>(1);
  const autoAdvanceRef = useRef<boolean>(true);
  autoAdvanceRef.current = autoAdvanceVoice;

  // Hologram 3D pointer tilt state
  const [holoTilt, setHoloTilt] = useState({ rx: 0, ry: 0 });

  // Physical 3D Page-Flip Session State
  const [flip, setFlip] = useState<FlipSession | null>(null);
  const flipAnimRef = useRef<number>(0);

  // Pre-cached page DataURLs for zero-latency finger-following turns
  const pageCacheRef = useRef<Record<string, string>>({});

  const singleCanvasRef = useRef<HTMLCanvasElement>(null);
  const spreadLeftRef = useRef<HTMLCanvasElement>(null);
  const spreadRightRef = useRef<HTMLCanvasElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });
  const pinchRef = useRef<{ active: boolean; startDist: number; startZoom: number; preview: number }>({
    active: false,
    startDist: 0,
    startZoom: 1,
    preview: 1,
  });

  // Gesture tracking refs (steady axis lock so page never jumps vertically)
  const gestureRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    startTime: number;
    lock: 'none' | 'horizontal' | 'vertical';
    direction: 'next' | 'prev' | null;
    lastDx: number;
    stageWidth: number;
    touchYRatio: number;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    startTime: 0,
    lock: 'none',
    direction: null,
    lastDx: 0,
    stageWidth: 400,
    touchYRatio: 0.65,
  });

  const bookmarks: PdfBookmark[] = docState?.bookmarks || [];
  const currentPageBookmark = bookmarks.find((b) => b.page === currentPage) || null;

  // Previous session leave timestamp & elapsed time shown cleanly while reading
  const [previousLeftAt, setPreviousLeftAt] = useState<number | null>(null);
  const [previousReadingSec, setPreviousReadingSec] = useState<number>(0);

  // Refs for flushing exact leave timestamp (hour:minute:second) & position on any exit
  const sessionStartMsRef = useRef<number | null>(null);
  const baseReadingSecRef = useRef<number>(0);
  const pendingScrollRestoreRef = useRef<number | null>(null);
  const resumeVoiceSecRef = useRef<number | null>(null);
  const liveSnapshotRef = useRef({
    entryId: entry?.id || null as string | null,
    currentPage: 1,
    zoom: 1,
  });
  liveSnapshotRef.current = {
    entryId: entry?.id || null,
    currentPage,
    zoom,
  };
  const onUpdateDocStateRef = useRef(onUpdateDocState);
  onUpdateDocStateRef.current = onUpdateDocState;

  const flushLeaveProgress = useCallback(() => {
    const { entryId, currentPage: pg, zoom: zm } = liveSnapshotRef.current;
    if (!entryId) return;
    const now = Date.now();
    const deltaSec = sessionStartMsRef.current
      ? Math.max(0, Math.round((now - sessionStartMsRef.current) / 1000))
      : 0;
    const totalReadingSec = baseReadingSecRef.current + deltaSec;
    baseReadingSecRef.current = totalReadingSec;
    sessionStartMsRef.current = now;

    const sc = scrollContainerRef.current;
    const maxScroll = sc ? Math.max(0, sc.scrollHeight - sc.clientHeight) : 0;
    const scrollRatio =
      sc && maxScroll > 8 ? Number((sc.scrollTop / maxScroll).toFixed(4)) : 0;

    const audio = ttsAudioRef.current;
    const voiceSec =
      audio && Number.isFinite(audio.currentTime) && audio.currentTime > 0.4
        ? Number(audio.currentTime.toFixed(1))
        : 0;

    onUpdateDocStateRef.current(entryId, {
      lastLeftAt: now,
      readingDurationSec: totalReadingSec,
      scrollRatio,
      voicePositionSec: voiceSec,
      currentPage: pg,
      zoom: zm,
    });
  }, []);

  useEffect(() => {
    if (!activeWallpaper?.blob) {
      setWallpaperUrl(null);
      return;
    }
    const u = URL.createObjectURL(activeWallpaper.blob);
    setWallpaperUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [activeWallpaper]);

  useEffect(() => {
    if (!open || !entry) return;
    let cancelled = false;
    let loadedPdf: PDFDocumentProxy | null = null;

    setLoading(true);
    setError(null);
    setFlip(null);
    pageCacheRef.current = {};
    setCurrentPage(docState?.currentPage || 1);
    setZoom(docState?.zoom || 1);
    setReadingMode(docState?.readingMode || 'single');

    // Capture exact previous leave time (hour, minute, second) & reading progress before overwriting
    setPreviousLeftAt(docState?.lastLeftAt ?? docState?.lastOpenedAt ?? null);
    setPreviousReadingSec(docState?.readingDurationSec ?? 0);
    baseReadingSecRef.current = docState?.readingDurationSec ?? 0;
    sessionStartMsRef.current = Date.now();
    pendingScrollRestoreRef.current =
      docState?.scrollRatio && docState.scrollRatio > 0.01 ? docState.scrollRatio : null;
    resumeVoiceSecRef.current =
      docState?.voicePositionSec && docState.voicePositionSec > 0.5
        ? docState.voicePositionSec
        : null;

    const handleVisibilityOrHide = () => {
      if (document.visibilityState === 'hidden') {
        flushLeaveProgress();
      }
    };
    const handlePageHide = () => flushLeaveProgress();

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityOrHide);
    const checkpointTimer = setInterval(flushLeaveProgress, 5000);

    void (async () => {
      try {
        const file = await resolveEntryFile(entry);
        if (!file) throw new Error('Could not read PDF file from device.');
        loadedPdf = await openPdfDocument(file);
        if (cancelled) {
          await closePdfDocument(loadedPdf);
          return;
        }
        setPdfDoc(loadedPdf);
        setTotalPages(loadedPdf.numPages);
        const startPage = Math.min(
          loadedPdf.numPages,
          Math.max(1, docState?.currentPage || 1)
        );
        setCurrentPage(startPage);
        onUpdateDocState(entry.id, {
          totalPages: loadedPdf.numPages,
          lastOpenedAt: Date.now(),
          currentPage: startPage,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to open PDF.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      flushLeaveProgress();
      clearInterval(checkpointTimer);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityOrHide);
      if (flipAnimRef.current) cancelAnimationFrame(flipAnimRef.current);
      if (ttsAbortRef.current) ttsAbortRef.current.abort();
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current.src = '';
      }
      void stopNativeOrDeviceTts();
      setVoiceState('idle');
      if (loadedPdf) void closePdfDocument(loadedPdf);
      setPdfDoc(null);
    };
  }, [open, entry?.id, flushLeaveProgress]);

  // Restore exact scroll offset once PDF finishes loading
  useEffect(() => {
    if (!open || loading || !pdfDoc || pendingScrollRestoreRef.current === null) return;
    const ratio = pendingScrollRestoreRef.current;
    pendingScrollRestoreRef.current = null;
    const raf = requestAnimationFrame(() => {
      setTimeout(() => {
        const sc = scrollContainerRef.current;
        if (!sc) return;
        const maxScroll = sc.scrollHeight - sc.clientHeight;
        if (maxScroll > 8) {
          sc.scrollTop = Math.round(maxScroll * ratio);
        }
      }, 120);
    });
    return () => cancelAnimationFrame(raf);
  }, [open, loading, pdfDoc]);

  const getTargetPageWidth = useCallback(
    (mode: PdfReadingMode) => {
      const containerWidth = scrollContainerRef.current?.clientWidth || window.innerWidth;
      if (mode === 'two-page') {
        return Math.min(540, Math.max(150, (containerWidth - 64) / 2));
      }
      return Math.min(860, Math.max(280, containerWidth - 40));
    },
    []
  );

  // Render Single Page Mode & pre-cache adjacent pages for instant finger-peel
  useEffect(() => {
    if (!open || !pdfDoc || readingMode !== 'single') return;
    let cancelled = false;
    let renderTask: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | null =
      null;

    void (async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (cancelled) return;
        const canvas = singleCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const targetWidth = getTargetPageWidth('single');
        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = (targetWidth / baseViewport.width) * zoom;
        const dpr = Math.min(2.5, window.devicePixelRatio || 1);
        const viewport = page.getViewport({ scale: fitScale * dpr });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

        renderTask = page.render({ canvasContext: ctx, viewport, canvas });
        await renderTask.promise;
        if (cancelled) return;

        pageCacheRef.current[`1p:${currentPage}:${zoom}`] = canvas.toDataURL('image/jpeg', 0.9);

        // Pre-cache next & prev pages silently
        const adj = [currentPage + 1, currentPage - 1];
        for (const p of adj) {
          const key = `1p:${p}:${zoom}`;
          if (p >= 1 && p <= pdfDoc.numPages && !pageCacheRef.current[key]) {
            const url = await renderPageDataUrl(pdfDoc, p, targetWidth, zoom);
            if (url && !cancelled) pageCacheRef.current[key] = url;
          }
        }
      } catch {
        // Ignore cancelled render
      }
    })();

    return () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [open, pdfDoc, currentPage, zoom, readingMode, getTargetPageWidth]);

  // Render Two-Page Book Spread Mode & pre-cache next/prev spread leaves
  useEffect(() => {
    if (!open || !pdfDoc || readingMode !== 'two-page') return;
    let cancelled = false;
    const tasks: Array<{ cancel: () => void }> = [];

    const targetWidth = getTargetPageWidth('two-page');

    const renderSpreadPage = async (pageNum: number, canvas: HTMLCanvasElement | null) => {
      if (!canvas) return;
      if (pageNum > totalPages || pageNum < 1) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      const page = await pdfDoc.getPage(pageNum);
      if (cancelled) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = (targetWidth / baseViewport.width) * zoom;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const viewport = page.getViewport({ scale: fitScale * dpr });

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

      const task = page.render({ canvasContext: ctx, viewport, canvas });
      tasks.push(task);
      await task.promise;
      if (!cancelled) {
        pageCacheRef.current[`2p:${pageNum}:${zoom}`] = canvas.toDataURL('image/jpeg', 0.9);
      }
    };

    void (async () => {
      try {
        await Promise.all([
          renderSpreadPage(currentPage, spreadLeftRef.current),
          renderSpreadPage(currentPage + 1, spreadRightRef.current),
        ]);
        if (cancelled) return;

        // Pre-cache next spread (currentPage+2, currentPage+3) and prev spread (currentPage-2, currentPage-1)
        const adj = [currentPage + 2, currentPage + 3, currentPage - 2, currentPage - 1];
        for (const p of adj) {
          const key = `2p:${p}:${zoom}`;
          if (p >= 1 && p <= pdfDoc.numPages && !pageCacheRef.current[key]) {
            const url = await renderPageDataUrl(pdfDoc, p, targetWidth, zoom);
            if (url && !cancelled) pageCacheRef.current[key] = url;
          }
        }
      } catch {
        // ignore cancelled
      }
    })();

    return () => {
      cancelled = true;
      for (const t of tasks) {
        try {
          t.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [open, pdfDoc, currentPage, totalPages, zoom, readingMode, getTargetPageWidth]);

  // Zoom helper (50% to 350%)
  const applyZoom = useCallback(
    (nextRaw: number) => {
      if (!entry) return;
      const clamped = Math.min(3.5, Math.max(0.5, Number(nextRaw.toFixed(2))));
      setZoom(clamped);
      onUpdateDocState(entry.id, { zoom: clamped });
    },
    [entry, onUpdateDocState]
  );

  // Natural Voice Reader Controls (Hybrid: Cloud Narrator + Offline Cache + Native Android TTS)
  const stopVoiceReader = useCallback(() => {
    if (ttsAbortRef.current) {
      const ctrl = ttsAbortRef.current;
      ttsAbortRef.current = null;
      ctrl.abort();
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.currentTime = 0;
    }
    void stopNativeOrDeviceTts();
    setVoiceState('idle');
    setVoiceError(null);
  }, []);

  const speakPage = useCallback(
    async (
      pageNum: number,
      profile: AiVoiceReaderProfile | undefined = activeVoiceProfile,
      chosenRate: number = voiceRate
    ) => {
      if (!pdfDoc || !entry) return;
      stopVoiceReader();
      setVoiceState('loading');
      setVoiceError(null);
      voicePageRef.current = pageNum;

      const text = await extractPageReadableText(pdfDoc, pageNum);
      if (!text) {
        setVoiceState('idle');
        setVoiceSnippet('');
        setVoiceError(`Page ${pageNum} has no selectable text to read aloud.`);
        return;
      }

      const readerId = profile?.id || 'builtin:kore-audiobook';
      const readerVoiceName = profile?.voiceName || 'Kore';
      const readerStyle = profile?.stylePrompt || 'Warm, natural audiobook narrator';
      const readerEngine = profile?.engine || 'gemini-tts';

      setVoiceSnippet(text.slice(0, 140) + (text.length > 140 ? '…' : ''));
      const cacheKey = `${entry.id}:${pageNum}:${readerId}`;
      const persistentKey = buildTtsCacheKey(readerVoiceName, readerStyle, profile?.language, text);

      const playAudioUrl = (audioSrcUrl: string) => {
        if (!ttsAudioRef.current) {
          ttsAudioRef.current = new Audio();
        }
        const audio = ttsAudioRef.current;
        audio.src = audioSrcUrl;
        audio.playbackRate = chosenRate;
        const resumeSec = resumeVoiceSecRef.current;
        resumeVoiceSecRef.current = null;
        if (resumeSec && resumeSec > 0.5) {
          audio.onloadedmetadata = () => {
            if (audio.duration && resumeSec < audio.duration - 0.5) {
              audio.currentTime = resumeSec;
            }
          };
        } else {
          audio.onloadedmetadata = null;
        }
        audio.onended = () => {
          if (autoAdvanceRef.current && pageNum < pdfDoc.numPages) {
            const nextP = pageNum + 1;
            setCurrentPage(nextP);
            onUpdateDocState(entry.id, {
              currentPage: nextP,
              lastOpenedAt: Date.now(),
              voicePositionSec: 0,
            });
            void speakPage(nextP, profile, chosenRate);
          } else {
            setVoiceState('idle');
          }
        };
        audio.onerror = () => {
          setVoiceState('idle');
          setVoiceError('Audio playback failed on this device.');
        };
        void audio.play().then(
          () => setVoiceState('playing'),
          () => setVoiceState('paused')
        );
      };

      const speakViaHybridOffline = (preferredVoiceUri?: string) => {
        setVoiceSourceLabel('device');
        void speakWithNativeOrDeviceTts({
          text,
          rate: chosenRate,
          preferredVoiceUri,
          languageHint: profile?.language,
          onStart: () => setVoiceState('playing'),
          onDone: () => {
            if (autoAdvanceRef.current && pageNum < pdfDoc.numPages) {
              const nextP = pageNum + 1;
              setCurrentPage(nextP);
              onUpdateDocState(entry.id, { currentPage: nextP, lastOpenedAt: Date.now() });
              void speakPage(nextP, profile, chosenRate);
            } else {
              setVoiceState('idle');
            }
          },
          onError: (msg) => {
            setVoiceState('idle');
            setVoiceError(msg);
          },
        });
      };

      if (readerEngine === 'device-tts') {
        speakViaHybridOffline(readerVoiceName);
        return;
      }

      const memCached = ttsCacheRef.current[cacheKey];
      if (memCached) {
        setVoiceSourceLabel(readerEngine === 'custom-url' ? 'custom' : 'gemini');
        playAudioUrl(memCached);
        return;
      }

      if (readerEngine === 'gemini-tts') {
        const persistedAudio = await loadCachedTtsAudio(persistentKey);
        if (persistedAudio) {
          ttsCacheRef.current[cacheKey] = persistedAudio;
          setVoiceSourceLabel('cached');
          playAudioUrl(persistedAudio);
          return;
        }
      }

      const controller = new AbortController();
      ttsAbortRef.current = controller;
      let timedOut = false;
      const timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 14000);

      try {
        if (readerEngine === 'custom-url' && profile?.customEndpointUrl) {
          const res = await fetch(profile.customEndpointUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              text: text.slice(0, 2900),
              voice: readerVoiceName,
              style: readerStyle,
              speed: chosenRate,
            }),
          });
          clearTimeout(timeoutId);
          if (!res.ok) throw new Error(`Custom AI reader error (${res.status})`);
          const ct = res.headers.get('content-type') || '';
          let url = '';
          if (ct.includes('application/json')) {
            const json = (await res.json()) as { audioDataUrl?: string; audioUrl?: string };
            url = json.audioDataUrl || json.audioUrl || '';
          } else {
            const blob = await res.blob();
            url = URL.createObjectURL(blob);
          }
          if (!url) throw new Error('Custom AI voice reader returned no audio.');
          ttsCacheRef.current[cacheKey] = url;
          setVoiceSourceLabel('custom');
          playAudioUrl(url);
          return;
        }

        const ttsEndpoint = resolveTtsApiEndpoint(ttsServerUrl);
        const res = await fetch(ttsEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            text: text.slice(0, 2900),
            voiceName: readerVoiceName,
            style: readerStyle,
            language: profile?.language,
          }),
        });
        clearTimeout(timeoutId);
        const data = (await res.json()) as { audioDataUrl?: string; error?: string };
        if (!res.ok || !data.audioDataUrl) {
          throw new Error(data.error || `TTS server error (${res.status})`);
        }
        ttsCacheRef.current[cacheKey] = data.audioDataUrl;
        void saveCachedTtsAudio(persistentKey, data.audioDataUrl);
        setVoiceSourceLabel('gemini');
        playAudioUrl(data.audioDataUrl);
      } catch (err) {
        clearTimeout(timeoutId);
        if ((err as Error)?.name === 'AbortError' && !timedOut) return;
        speakViaHybridOffline();
      }
    },
    [pdfDoc, entry, activeVoiceProfile, voiceRate, ttsServerUrl, stopVoiceReader, onUpdateDocState]
  );

  if (!open || !entry) return null;

  const isDiy = activeTheme === 'diy';
  const preset = isDiy ? null : PDF_THEME_PRESETS[activeTheme];
  const isMedievalVisual = Boolean(preset?.isParchmentStyle) || readingMode === 'parchment';
  const isSpaceHolo = Boolean(preset?.isHologramStyle);
  const activeAiImageUrl = isDiy ? null : universeImages[activeTheme] || null;

  const themeBgStyle = isDiy ? { backgroundColor: diyConfig.bgColor } : undefined;
  const themeAccent = isDiy ? diyConfig.accentColor : preset!.accentColor;
  const canvasFilter = isDiy ? getDiyCanvasFilter(diyConfig) : preset!.canvasFilter;
  const pageBorder = isDiy
    ? `1px solid ${diyConfig.frameBorderColor}`
    : preset!.pageBorder;

  const commitPageChange = (nextPage: number, playAudio = true) => {
    const clamped = Math.min(totalPages, Math.max(1, Math.round(nextPage)));
    if (clamped !== currentPage && playAudio && soundEnabled) {
      playPageTurnSound(activeTheme, readingMode);
    }
    setCurrentPage(clamped);
    onUpdateDocState(entry.id, { currentPage: clamped, lastOpenedAt: Date.now() });
  };

  const buildFlipSession = async (
    direction: 'next' | 'prev',
    initialProgress: number,
    touchYRatio = 0.65
  ): Promise<FlipSession | null> => {
    if (!pdfDoc) return null;
    if (readingMode === 'single') {
      const targetPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
      if (targetPage < 1 || targetPage > totalPages) return null;
      const curKey = `1p:${currentPage}:${zoom}`;
      const dstKey = `1p:${targetPage}:${zoom}`;
      const curUrl =
        pageCacheRef.current[curKey] ||
        singleCanvasRef.current?.toDataURL('image/jpeg', 0.9) ||
        null;
      const dstUrl =
        pageCacheRef.current[dstKey] ||
        (await renderPageDataUrl(pdfDoc, targetPage, getTargetPageWidth('single'), zoom));
      if (!curUrl) return null;

      if (direction === 'next') {
        return {
          active: true,
          direction: 'next',
          progress: initialProgress,
          touchYRatio,
          frontUrl: curUrl,
          backUrl: null,
          underlayUrl: dstUrl,
        };
      } else {
        return {
          active: true,
          direction: 'prev',
          progress: initialProgress,
          touchYRatio,
          frontUrl: dstUrl || curUrl,
          backUrl: null,
          underlayUrl: curUrl,
        };
      }
    }

    if (readingMode === 'two-page') {
      if (direction === 'next') {
        const nextLeft = currentPage + 2;
        if (nextLeft > totalPages) return null;
        const nextRight = currentPage + 3;
        const leftCur =
          pageCacheRef.current[`2p:${currentPage}:${zoom}`] ||
          spreadLeftRef.current?.toDataURL('image/jpeg', 0.9) ||
          null;
        const rightCur =
          pageCacheRef.current[`2p:${currentPage + 1}:${zoom}`] ||
          spreadRightRef.current?.toDataURL('image/jpeg', 0.9) ||
          null;
        if (!rightCur) return null;

        const targetW = getTargetPageWidth('two-page');
        const nextLeftUrl =
          pageCacheRef.current[`2p:${nextLeft}:${zoom}`] ||
          (await renderPageDataUrl(pdfDoc, nextLeft, targetW, zoom));
        const nextRightUrl =
          nextRight <= totalPages
            ? pageCacheRef.current[`2p:${nextRight}:${zoom}`] ||
              (await renderPageDataUrl(pdfDoc, nextRight, targetW, zoom))
            : null;

        return {
          active: true,
          direction: 'next',
          progress: initialProgress,
          touchYRatio,
          frontUrl: rightCur,
          backUrl: nextLeftUrl,
          underlayUrl: nextRightUrl,
          staticLeftUrl: leftCur,
          staticRightUrl: nextRightUrl,
        };
      } else {
        const prevLeft = Math.max(1, currentPage - 2);
        if (currentPage <= 1) return null;
        const prevRight = prevLeft + 1;
        const leftCur =
          pageCacheRef.current[`2p:${currentPage}:${zoom}`] ||
          spreadLeftRef.current?.toDataURL('image/jpeg', 0.9) ||
          null;
        const rightCur =
          pageCacheRef.current[`2p:${currentPage + 1}:${zoom}`] ||
          spreadRightRef.current?.toDataURL('image/jpeg', 0.9) ||
          null;
        if (!leftCur) return null;

        const targetW = getTargetPageWidth('two-page');
        const prevLeftUrl =
          pageCacheRef.current[`2p:${prevLeft}:${zoom}`] ||
          (await renderPageDataUrl(pdfDoc, prevLeft, targetW, zoom));
        const prevRightUrl =
          pageCacheRef.current[`2p:${prevRight}:${zoom}`] ||
          (await renderPageDataUrl(pdfDoc, prevRight, targetW, zoom));

        return {
          active: true,
          direction: 'prev',
          progress: initialProgress,
          touchYRatio,
          frontUrl: leftCur,
          backUrl: prevRightUrl,
          underlayUrl: prevLeftUrl,
          staticLeftUrl: prevLeftUrl,
          staticRightUrl: rightCur,
        };
      }
    }
    return null;
  };

  const animateFlipTo = (
    session: FlipSession,
    targetProgress: 0 | 1,
    durationMs = 260
  ) => {
    if (flipAnimRef.current) cancelAnimationFrame(flipAnimRef.current);
    const startProg = session.progress;
    const startTime = performance.now();

    if (targetProgress === 1 && soundEnabled) {
      playPageTurnSound(activeTheme, readingMode);
    }

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      // Smooth cubic ease-out (zero overshoot/bounce)
      const eased = 1 - Math.pow(1 - t, 3);
      const currProg = startProg + (targetProgress - startProg) * eased;

      if (t < 1) {
        setFlip((prev) => (prev ? { ...prev, progress: currProg } : null));
        flipAnimRef.current = requestAnimationFrame(tick);
      } else {
        setFlip(null);
        if (targetProgress === 1) {
          const step = readingMode === 'two-page' ? 2 : 1;
          const next =
            session.direction === 'next'
              ? Math.min(totalPages, currentPage + step)
              : Math.max(1, currentPage - step);
          setCurrentPage(next);
          onUpdateDocState(entry.id, { currentPage: next, lastOpenedAt: Date.now() });
        }
      }
    };

    flipAnimRef.current = requestAnimationFrame(tick);
  };

  const triggerAnimatedTurn = async (direction: 'next' | 'prev') => {
    if (readingMode !== 'single' && readingMode !== 'two-page') {
      const step = 1;
      commitPageChange(
        direction === 'next' ? currentPage + step : currentPage - step,
        true
      );
      return;
    }
    if (flip) return;
    const session = await buildFlipSession(direction, 0, 0.7);
    if (!session) return;
    setFlip(session);
    animateFlipTo(session, 1, 310);
  };



  const handleToggleVoicePlayPause = () => {
    if (voiceState === 'idle') {
      void speakPage(currentPage, activeVoiceProfile, voiceRate);
      return;
    }
    if (voiceState === 'playing') {
      if (voiceSourceLabel === 'device') {
        if (isNativeAndroidRuntime()) {
          void stopNativeOrDeviceTts();
          setVoiceState('idle');
          return;
        }
        if ('speechSynthesis' in window) window.speechSynthesis.pause();
      } else {
        ttsAudioRef.current?.pause();
      }
      setVoiceState('paused');
    } else if (voiceState === 'paused') {
      if (voiceSourceLabel === 'device' && 'speechSynthesis' in window) {
        window.speechSynthesis.resume();
      } else {
        void ttsAudioRef.current?.play();
      }
      setVoiceState('playing');
    }
  };

  // Finger Gesture Handlers for Single & Two-Page Modes
  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readingMode !== 'single' && readingMode !== 'two-page') return;
    if (flip) return;
    if (zoom > 1.04) return; // When zoomed in, allow natural 2D scroll/panning
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const rect = e.currentTarget.getBoundingClientRect();
    const yRatio = Math.min(0.95, Math.max(0.05, (e.clientY - rect.top) / Math.max(1, rect.height)));
    gestureRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTime: performance.now(),
      lock: 'none',
      direction: null,
      lastDx: 0,
      stageWidth: Math.max(240, rect.width),
      touchYRatio: yRatio,
    };
  };

  const handleStagePointerMove = async (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (g.pointerId !== e.pointerId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const yRatio = Math.min(0.95, Math.max(0.05, (e.clientY - rect.top) / Math.max(1, rect.height)));
    g.touchYRatio = yRatio;

    // Also update Hologram subtle 3D parallax tilt
    if (isSpaceHolo && g.lock === 'none') {
      if (rect.width > 0 && rect.height > 0) {
        const nx = (e.clientX - rect.left) / rect.width - 0.5;
        const ny = (e.clientY - rect.top) / rect.height - 0.5;
        setHoloTilt({
          rx: Number((-ny * 4).toFixed(2)),
          ry: Number((nx * 4).toFixed(2)),
        });
      }
    }

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    g.lastDx = dx;

    if (g.lock === 'none') {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dx) > Math.abs(dy) * 1.15) {
        const dir: 'next' | 'prev' = dx < 0 ? 'next' : 'prev';
        const canGo =
          dir === 'next'
            ? readingMode === 'two-page'
              ? currentPage + 2 <= totalPages
              : currentPage < totalPages
            : currentPage > 1;
        if (!canGo) {
          g.lock = 'vertical';
          return;
        }
        g.lock = 'horizontal';
        g.direction = dir;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        const initialProgress = Math.min(1, Math.max(0, Math.abs(dx) / (g.stageWidth * 0.62)));
        const session = await buildFlipSession(dir, initialProgress, yRatio);
        if (session && gestureRef.current.pointerId === e.pointerId) {
          setFlip(session);
        }
      } else {
        g.lock = 'vertical';
        return;
      }
    }

    if (g.lock === 'horizontal' && g.direction) {
      e.preventDefault();
      const signed = g.direction === 'next' ? -dx : dx;
      const progress = Math.min(1, Math.max(0, signed / (g.stageWidth * 0.62)));
      setFlip((prev) => (prev ? { ...prev, progress, touchYRatio: yRatio } : prev));
    }
  };

  const handleStagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (g.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    const elapsed = Math.max(1, performance.now() - g.startTime);
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    const velocity = Math.abs(dx) / elapsed; // px/ms

    if (g.lock === 'horizontal' && g.direction) {
      const signed = g.direction === 'next' ? -dx : dx;
      const progress = Math.min(1, Math.max(0, signed / (g.stageWidth * 0.62)));
      const shouldCommit = progress >= 0.22 || (velocity > 0.35 && signed > 24);

      setFlip((currentFlip) => {
        if (!currentFlip) return null;
        animateFlipTo(currentFlip, shouldCommit ? 1 : 0, 220);
        return currentFlip;
      });
    } else if (g.lock === 'none' && Math.abs(dx) < 8 && Math.abs(dy) < 8 && elapsed < 280) {
      // Double-tap toggles zoom (100% <-> 185%), single edge tap turns page
      const now = performance.now();
      const prevTap = lastTapRef.current;
      const isDoubleTap =
        now - prevTap.time < 290 &&
        Math.hypot(e.clientX - prevTap.x, e.clientY - prevTap.y) < 34;

      if (isDoubleTap) {
        lastTapRef.current = { time: 0, x: 0, y: 0 };
        applyZoom(zoom > 1.15 ? 1 : 1.85);
      } else {
        lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
        const rect = e.currentTarget.getBoundingClientRect();
        const relX = (e.clientX - rect.left) / Math.max(1, rect.width);
        if (relX > 0.82) {
          void triggerAnimatedTurn('next');
        } else if (relX < 0.18) {
          void triggerAnimatedTurn('prev');
        }
      }
    }

    gestureRef.current.pointerId = null;
    gestureRef.current.lock = 'none';
    gestureRef.current.direction = null;
  };

  // Pinch-to-Zoom Touch Handlers
  const handleStageTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = {
        active: true,
        startDist: Math.max(10, Math.hypot(dx, dy)),
        startZoom: zoom,
        preview: 1,
      };
    }
  };

  const handleStageTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (pinchRef.current.active && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const rawRatio = dist / pinchRef.current.startDist;
      const targetZoom = Math.min(3.5, Math.max(0.5, pinchRef.current.startZoom * rawRatio));
      const preview = targetZoom / pinchRef.current.startZoom;
      pinchRef.current.preview = preview;
      setPinchPreviewScale(preview);
    }
  };

  const handleStageTouchEnd = () => {
    if (pinchRef.current.active) {
      const finalZoom = pinchRef.current.startZoom * pinchRef.current.preview;
      pinchRef.current.active = false;
      setPinchPreviewScale(1);
      applyZoom(finalZoom);
    }
  };

  const handleStageWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      applyZoom(zoom + delta);
    }
  };

  const handleChangeReadingMode = (mode: PdfReadingMode) => {
    setFlip(null);
    setReadingMode(mode);
    onUpdateDocState(entry.id, { readingMode: mode });
    if (soundEnabled) {
      playPageTurnSound(activeTheme, mode);
    }
  };

  const handleAddOrToggleBookmark = (customLabel?: string) => {
    if (currentPageBookmark && !customLabel) {
      const updated = bookmarks.filter((b) => b.page !== currentPage);
      onUpdateDocState(entry.id, { bookmarks: updated });
      return;
    }
    const label = (customLabel || newBookmarkLabel).trim() || `Page ${currentPage}`;
    const newBm: PdfBookmark = {
      id: `bm:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
      page: currentPage,
      label,
      createdAt: Date.now(),
    };
    const filtered = bookmarks.filter((b) => b.page !== currentPage);
    const updated = [...filtered, newBm].sort((a, b) => a.page - b.page);
    onUpdateDocState(entry.id, { bookmarks: updated });
    setNewBookmarkLabel('');
    if (soundEnabled) playBookmarkSound(activeTheme);
  };

  const handleDeleteBookmark = (bmId: string) => {
    onUpdateDocState(entry.id, {
      bookmarks: bookmarks.filter((b) => b.id !== bmId),
    });
  };

  const handleRenameBookmark = (bmId: string, label: string) => {
    const clean = label.trim();
    if (!clean) return;
    onUpdateDocState(entry.id, {
      bookmarks: bookmarks.map((b) => (b.id === bmId ? { ...b, label: clean } : b)),
    });
    setEditingBookmarkId(null);
  };

  const resetHoloTilt = () => {
    if (holoTilt.rx !== 0 || holoTilt.ry !== 0) setHoloTilt({ rx: 0, ry: 0 });
  };

  const renderSpaceHologramOverlay = () => {
    if (!isSpaceHolo) return null;
    return (
      <>
        <div className="hologram-scanlines pointer-events-none absolute inset-0 z-10 opacity-75" />
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
          <div className="hologram-sweep-bar h-20 w-full bg-gradient-to-b from-transparent via-cyan-300/15 to-transparent" />
        </div>
        <span className="pointer-events-none absolute left-1.5 top-1.5 z-20 h-4 w-4 border-l-2 border-t-2 border-cyan-300" />
        <span className="pointer-events-none absolute right-1.5 top-1.5 z-20 h-4 w-4 border-r-2 border-t-2 border-cyan-300" />
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 z-20 h-4 w-4 border-b-2 border-l-2 border-cyan-300" />
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 z-20 h-4 w-4 border-b-2 border-r-2 border-cyan-300" />
      </>
    );
  };

  const renderMedievalCornerPins = () => {
    if (!isMedievalVisual) return null;
    return (
      <>
        <span className="pointer-events-none absolute left-2 top-2 z-20 h-2.5 w-2.5 rounded-full bg-amber-700/80 shadow-inner ring-1 ring-amber-300/40" />
        <span className="pointer-events-none absolute right-2 top-2 z-20 h-2.5 w-2.5 rounded-full bg-amber-700/80 shadow-inner ring-1 ring-amber-300/40" />
        <span className="pointer-events-none absolute bottom-2 left-2 z-20 h-2.5 w-2.5 rounded-full bg-amber-700/80 shadow-inner ring-1 ring-amber-300/40" />
        <span className="pointer-events-none absolute bottom-2 right-2 z-20 h-2.5 w-2.5 rounded-full bg-amber-700/80 shadow-inner ring-1 ring-amber-300/40" />
      </>
    );
  };

  // Helper to render the back face of a turning physical leaf
  const renderReverseLeafFace = (backUrl: string | null) => {
    if (backUrl) {
      return (
        <div className="relative h-full w-full overflow-hidden">
          <img
            src={backUrl}
            alt=""
            referrerPolicy="no-referrer"
            style={{ filter: canvasFilter }}
            className={`h-full w-full object-contain ${isSpaceHolo ? 'opacity-95' : ''}`}
          />
          {isSpaceHolo && (
            <div className="hologram-scanlines pointer-events-none absolute inset-0 opacity-75" />
          )}
        </div>
      );
    }

    if (isSpaceHolo) {
      return (
        <div className="h-full w-full bg-cyan-950/55 backdrop-blur-sm border border-cyan-400/40 relative">
          <div className="hologram-scanlines absolute inset-0" />
        </div>
      );
    }

    if (isMedievalVisual) {
      return (
        <div className="parchment-sheet h-full w-full opacity-95">
          <div className="h-full w-full bg-amber-950/10" />
        </div>
      );
    }

    return (
      <div className="h-full w-full bg-gradient-to-l from-zinc-300 via-zinc-100 to-zinc-200" />
    );
  };

  const isHorizontalFlipActive = Boolean(flip) || gestureRef.current.lock === 'horizontal';

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col ${isDiy ? '' : preset!.bgClass}`}
      style={themeBgStyle}
      role="dialog"
      aria-modal="true"
      aria-label={`PDF Reader: ${entry.name}`}
    >
      <PdfThemeBackdrop theme={activeTheme} aiImageUrl={activeAiImageUrl} />

      {isDiy && diyConfig.showWallpaperBehind && wallpaperUrl && activeWallpaper && (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-80">
          {activeWallpaper.isVideo ? (
            <video src={wallpaperUrl} autoPlay loop muted playsInline className="h-full w-full object-cover" />
          ) : (
            <img
              src={wallpaperUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          )}
        </div>
      )}

      {/* Top Reader Toolbar */}
      <header
        className={`relative z-30 flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2 backdrop-blur-md ${
          isDiy
            ? 'border-zinc-800/80 bg-black/70'
            : `${preset!.surfaceClass} ${preset!.borderClass}`
        }`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              flushLeaveProgress();
              onClose();
            }}
            aria-label="Back to PDFs"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-zinc-200 hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h2 className="truncate font-display text-sm font-semibold text-white">
              {entry.name.replace(/\.pdf$/i, '')}
            </h2>
            <p className="truncate font-mono text-[11px] text-zinc-400">
              {readingMode === 'two-page' && currentPage < totalPages
                ? `Pages ${currentPage}-${currentPage + 1} / ${totalPages}`
                : `Page ${currentPage} / ${totalPages}`}
              {previousLeftAt ? ` · Left ${formatExactLeaveStamp(previousLeftAt)}` : ''}
              {previousReadingSec > 0 ? ` (${formatReadingMinSec(previousReadingSec)})` : ''}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setShowVoiceBar((v) => !v)}
            aria-label="Toggle Natural Voice Reader"
            title="Natural Voice Reader"
            className={`flex min-h-[40px] items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium transition-colors ${
              showVoiceBar || voiceState === 'playing'
                ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
                : 'border-white/10 bg-black/30 text-zinc-200 hover:bg-white/10'
            }`}
          >
            <Headphones className="h-4 w-4" />
            <span className="hidden md:inline">Voice Read</span>
          </button>

          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute page turn sounds' : 'Enable page turn sounds'}
            title={soundEnabled ? 'Page sounds ON' : 'Page sounds OFF'}
            className={`flex min-h-[44px] min-w-[40px] items-center justify-center rounded-full hover:bg-white/10 ${
              soundEnabled ? 'text-zinc-100' : 'text-zinc-500'
            }`}
          >
            {soundEnabled ? <Volume2 className="h-4.5 w-4.5" /> : <VolumeX className="h-4.5 w-4.5" />}
          </button>

          <button
            type="button"
            onClick={() => handleAddOrToggleBookmark()}
            aria-label={currentPageBookmark ? 'Remove page bookmark' : 'Bookmark this page'}
            title={currentPageBookmark ? 'Bookmarked' : 'Bookmark Page'}
            className="flex min-h-[44px] min-w-[40px] items-center justify-center rounded-full text-zinc-200 hover:bg-white/10"
          >
            <Bookmark
              className={`h-5 w-5 transition-colors ${
                currentPageBookmark ? 'fill-amber-400 text-amber-400' : ''
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => setShowBookmarksPanel((v) => !v)}
            aria-label="Open bookmarks panel"
            className={`flex min-h-[40px] items-center gap-1 rounded-xl border px-2.5 text-xs font-medium transition-colors ${
              showBookmarksPanel
                ? 'border-white/30 bg-white/15 text-white'
                : 'border-white/10 bg-black/30 text-zinc-200 hover:bg-white/10'
            }`}
          >
            <PanelRight className="h-4 w-4" />
            <span className="font-mono text-[11px]">{bookmarks.length}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateDocState(entry.id, { starred: !(docState?.starred ?? false) })
            }
            aria-label="Toggle star"
            className="hidden min-h-[44px] min-w-[40px] items-center justify-center rounded-full text-zinc-300 hover:bg-white/10 sm:flex"
          >
            <Star
              className={`h-5 w-5 ${
                docState?.starred ? 'fill-amber-400 text-amber-400' : ''
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => setShowThemeDrawer((v) => !v)}
            className="flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white transition-colors"
            style={{ backgroundColor: themeAccent }}
          >
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Themes & View</span>
          </button>
        </div>
      </header>

      {/* Natural Voice PDF Reader Bar */}
      {showVoiceBar && (
        <div className="relative z-30 border-b border-white/10 bg-[#0b1116]/95 px-3 py-2.5 backdrop-blur-md sm:px-4">
          <div className="mx-auto flex max-w-4xl flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleVoicePlayPause}
                  aria-label={voiceState === 'playing' ? 'Pause voice reader' : 'Read page aloud'}
                  className="flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 text-xs font-semibold text-zinc-950 transition-opacity"
                  style={{ backgroundColor: themeAccent }}
                >
                  {voiceState === 'loading' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Preparing Voice...</span>
                    </>
                  ) : voiceState === 'playing' ? (
                    <>
                      <Pause className="h-4 w-4" />
                      <span>Pause</span>
                    </>
                  ) : voiceState === 'paused' ? (
                    <>
                      <Play className="h-4 w-4" />
                      <span>Resume</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      <span>Read Page {currentPage}</span>
                    </>
                  )}
                </button>

                {voiceState !== 'idle' && (
                  <button
                    type="button"
                    onClick={stopVoiceReader}
                    aria-label="Stop voice reader"
                    className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-white/15 bg-black/40 text-zinc-200 hover:bg-white/10"
                  >
                    <Square className="h-4 w-4" />
                  </button>
                )}

                <select
                  aria-label="Select AI natural voice reader"
                  value={activeVoiceProfile?.id || ''}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    onSelectVoiceReader(nextId);
                    const picked = voiceReaders.find((r) => r.id === nextId);
                    const nextRate = picked?.rate || voiceRate;
                    if (picked) setVoiceRate(nextRate);
                    if (voiceState === 'playing' && picked) {
                      void speakPage(currentPage, picked, nextRate);
                    }
                  }}
                  className="min-h-[40px] max-w-[230px] rounded-xl border border-white/15 bg-zinc-900 px-2.5 text-xs text-zinc-100 focus:outline-none"
                >
                  {voiceReaders.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-xl border border-white/10 bg-black/40 p-0.5">
                  {[0.85, 1, 1.15, 1.3, 1.5].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setVoiceRate(r);
                        if (ttsAudioRef.current) ttsAudioRef.current.playbackRate = r;
                      }}
                      className={`min-h-[32px] rounded-lg px-2 font-mono text-[11px] font-medium transition-colors ${
                        voiceRate === r ? 'bg-white/20 text-white' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {r}x
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setAutoAdvanceVoice((v) => !v)}
                  className={`min-h-[38px] rounded-xl border px-2.5 text-[11px] font-medium ${
                    autoAdvanceVoice
                      ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                      : 'border-white/10 bg-black/30 text-zinc-400'
                  }`}
                >
                  Auto-Next: {autoAdvanceVoice ? 'ON' : 'OFF'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowVoiceBar(false)}
                  aria-label="Close voice reader bar"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {voiceSnippet && (
              <p className="truncate font-sans text-xs text-zinc-400">
                {voiceSourceLabel === 'device'
                  ? isNativeAndroidRuntime()
                    ? 'Android Offline Voice · '
                    : 'Device Offline Voice · '
                  : voiceSourceLabel === 'cached'
                    ? 'Cached Natural Voice · '
                    : voiceSourceLabel === 'custom'
                      ? 'Custom AI Voice · '
                      : 'Cloud Natural Voice · '}
                {voiceSnippet}
              </p>
            )}
            {voiceError && <p className="text-xs text-rose-300">{voiceError}</p>}
          </div>
        </div>
      )}

      {/* Themes, Reading Modes & Universe AI Studio Drawer */}
      {showThemeDrawer && (
        <div className="steady-scroll relative z-30 max-h-[75vh] overflow-y-auto border-b border-zinc-800 bg-zinc-950/95 px-3 py-4 backdrop-blur-md sm:px-4">
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                <SlidersHorizontal className="h-4 w-4" style={{ color: themeAccent }} />
                <span>Reading Layout</span>
              </div>
              <button
                type="button"
                onClick={() => setShowThemeDrawer(false)}
                aria-label="Close theme panel"
                className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {READING_MODES.map((m) => {
                const active = readingMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleChangeReadingMode(m.id)}
                    className={`flex min-h-[42px] items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors ${
                      active
                        ? 'text-zinc-950 shadow'
                        : 'border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                    }`}
                    style={active ? { backgroundColor: themeAccent } : undefined}
                  >
                    {m.icon}
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            <UniverseThemeStudio
              activeTheme={activeTheme}
              diyConfig={diyConfig}
              savedDiyThemes={savedDiyThemes}
              universeImages={universeImages}
              activeWallpaper={activeWallpaper}
              generatingThemeId={generatingThemeId}
              aiError={aiError}
              onSelectTheme={onChangeTheme}
              onUpdateDiyConfig={onUpdateDiyConfig}
              onSaveNewDiyTheme={onSaveNewDiyTheme}
              onDeleteSavedDiyTheme={onDeleteSavedDiyTheme}
              onExportDiyJson={onExportDiyJson}
              onImportDiyJson={onImportDiyJson}
              onGenerateAiImage={onGenerateAiImage}
              onClearAiImage={onClearAiImage}
            />
          </div>
        </div>
      )}

      {/* Main Content Row: Interactive Gesture PDF Canvas + Bookmarks Side Panel */}
      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
        <div
          ref={scrollContainerRef}
          onPointerDown={handleStagePointerDown}
          onPointerMove={(e) => void handleStagePointerMove(e)}
          onPointerUp={handleStagePointerUp}
          onPointerCancel={handleStagePointerUp}
          onPointerLeave={resetHoloTilt}
          onTouchStart={handleStageTouchStart}
          onTouchMove={handleStageTouchMove}
          onTouchEnd={handleStageTouchEnd}
          onWheel={handleStageWheel}
          className={`steady-scroll relative flex-1 px-3 py-5 sm:px-6 overscroll-x-contain ${
            isHorizontalFlipActive
              ? 'overflow-hidden touch-none'
              : zoom > 1.02
                ? 'overflow-auto'
                : 'overflow-y-auto overflow-x-hidden touch-pan-y'
          }`}
        >
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <p className="font-mono text-sm text-zinc-300">Rendering PDF...</p>
            </div>
          ) : error ? (
            <div className="mx-auto mt-12 max-w-md rounded-2xl border border-red-500/30 bg-red-950/30 p-6 text-center">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          ) : readingMode === 'single' ? (
            /* Single Page with Live Finger-Tracking 3D Page Curl */
            <div className={`flex min-h-full flex-col items-center justify-center ${zoom > 1.02 ? 'min-w-max' : ''}`}>
              <div
                ref={stageRef}
                className={`page-flip-stage relative select-none rounded-lg ${
                  isSpaceHolo
                    ? 'hologram-frame bg-cyan-950/20 backdrop-blur-sm'
                    : isMedievalVisual
                      ? 'parchment-sheet p-2 sm:p-3'
                      : 'shadow-2xl'
                }`}
                style={{
                  border: isSpaceHolo || isMedievalVisual ? undefined : pageBorder,
                  transform:
                    pinchPreviewScale !== 1
                      ? `scale(${pinchPreviewScale})`
                      : isSpaceHolo && !flip
                        ? `perspective(1200px) rotateX(${holoTilt.rx}deg) rotateY(${holoTilt.ry}deg)`
                        : undefined,
                  transformOrigin: 'center center',
                }}
              >
                {renderSpaceHologramOverlay()}
                {renderMedievalCornerPins()}

                {/* Base Static Canvas (Hidden visually only while active flip underlay replaces it) */}
                <canvas
                  ref={singleCanvasRef}
                  style={{ filter: canvasFilter }}
                  className={`block ${
                    isSpaceHolo ? 'bg-transparent opacity-95' : 'bg-white'
                  } ${flip ? 'opacity-0' : 'opacity-100'}`}
                />

                {/* Real-Time Interactive Tall 3D Page Curl Overlay */}
                {flip && (() => {
                  const p = flip.progress;
                  const arc = Math.sin(p * Math.PI);
                  const angleY =
                    flip.direction === 'next' ? -p * 176 : -(1 - p) * 176;
                  // Tactile vertical curl torque driven by touchYRatio (top vs bottom corner drag)
                  const yDelta = (flip.touchYRatio - 0.5) * 2; // -1..1
                  const curlRotateX = yDelta * arc * 7.5;
                  const curlSkewY = yDelta * arc * (flip.direction === 'next' ? -4.2 : 4.2);
                  const liftZ = arc * 48;
                  const liftScale = 1 + arc * 0.028;
                  const foldPosPct = Math.max(8, Math.min(92, (1 - p) * 100));

                  return (
                    <div className="pointer-events-none absolute inset-0 overflow-visible">
                      {/* Revealed Destination Page Underneath */}
                      <div className="relative h-full w-full overflow-hidden rounded-sm">
                        {flip.underlayUrl && (
                          <img
                            src={flip.underlayUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            style={{ filter: canvasFilter }}
                            className={`h-full w-full object-contain ${
                              isSpaceHolo ? 'opacity-95' : ''
                            }`}
                          />
                        )}
                        {/* Deep Dynamic Cast Shadow from Tall Lifting Page */}
                        <div
                          className="page-curl-shadow-cast absolute inset-0"
                          style={{
                            background:
                              flip.direction === 'next'
                                ? `radial-gradient(ellipse at 18% ${Math.round(flip.touchYRatio * 100)}%, rgba(0,0,0,${(1 - p) * 0.65}) 0%, rgba(0,0,0,${(1 - p) * 0.25}) 55%, transparent 90%)`
                                : `radial-gradient(ellipse at 25% ${Math.round(flip.touchYRatio * 100)}%, rgba(0,0,0,${p * 0.55}) 0%, transparent 78%)`,
                          }}
                        />
                      </div>

                      {/* Turning Physical Tall Curled Page Leaf */}
                      <div
                        className="page-flip-leaf absolute inset-0"
                        style={{
                          transformOrigin: `left ${Math.round(flip.touchYRatio * 100)}%`,
                          transform: `translateZ(${liftZ}px) scale(${liftScale}) rotateY(${angleY}deg) rotateX(${curlRotateX}deg) skewY(${curlSkewY}deg)`,
                          filter: `drop-shadow(${flip.direction === 'next' ? -14 * arc : 14 * arc}px 18px 26px rgba(0,0,0,${0.48 * arc}))`,
                        }}
                      >
                        {/* Front Face */}
                        <div className="page-flip-face absolute inset-0 overflow-hidden rounded-sm shadow-2xl">
                          <img
                            src={flip.frontUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            style={{ filter: canvasFilter }}
                            className={`h-full w-full object-contain ${
                              isSpaceHolo ? 'opacity-95' : 'bg-white'
                            }`}
                          />
                          {/* Curved Paper Cylinder Specular Highlight & Spine Shadow */}
                          <div
                            className="page-curl-ridge absolute inset-0"
                            style={{
                              background: `linear-gradient(90deg, rgba(0,0,0,${arc * 0.24}) 0%, rgba(255,255,255,${arc * 0.26}) ${foldPosPct}%, rgba(0,0,0,${arc * 0.3}) 100%)`,
                            }}
                          />
                          {/* Luminous Leading Curl Rim */}
                          <div
                            className="absolute inset-y-0 right-0 w-1.5"
                            style={{
                              background: `linear-gradient(90deg, transparent, rgba(255,255,255,${arc * 0.42}))`,
                            }}
                          />
                        </div>

                        {/* Back Face (Visible past 90deg) */}
                        <div className="page-flip-face-back absolute inset-0 overflow-hidden rounded-sm shadow-2xl">
                          {renderReverseLeafFace(flip.backUrl)}
                          <div
                            className="absolute inset-0"
                            style={{
                              background: `linear-gradient(270deg, rgba(0,0,0,${arc * 0.2}) 0%, rgba(255,255,255,${arc * 0.14}) 45%, rgba(0,0,0,${arc * 0.28}) 100%)`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : readingMode === 'two-page' ? (
            /* Two-Page Open Book Spread with Spine-Anchored 3D Page Turning */
            <div className={`flex min-h-full items-center justify-center ${zoom > 1.02 ? 'min-w-max' : ''}`}>
              <div
                ref={stageRef}
                className={`page-flip-stage relative flex select-none items-stretch justify-center rounded-xl ${
                  isSpaceHolo
                    ? 'hologram-frame gap-1 bg-cyan-950/20 p-1.5 backdrop-blur-sm'
                    : isMedievalVisual
                      ? 'parchment-sheet gap-0 p-2 sm:p-3'
                      : 'gap-0 shadow-2xl'
                }`}
                style={{
                  border: isSpaceHolo || isMedievalVisual ? undefined : pageBorder,
                  transform:
                    pinchPreviewScale !== 1
                      ? `scale(${pinchPreviewScale})`
                      : isSpaceHolo && !flip
                        ? `perspective(1200px) rotateX(${holoTilt.rx}deg) rotateY(${holoTilt.ry}deg)`
                        : undefined,
                }}
              >
                {renderSpaceHologramOverlay()}
                {renderMedievalCornerPins()}

                {/* Left Spread Page */}
                <div
                  className={`relative overflow-hidden ${!isSpaceHolo ? 'book-spine-left' : ''}`}
                >
                  <canvas
                    ref={spreadLeftRef}
                    style={{ filter: canvasFilter }}
                    className={`block ${isSpaceHolo ? 'bg-transparent' : 'bg-white'} ${
                      flip ? 'opacity-0' : 'opacity-100'
                    }`}
                  />
                  {flip && (
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                      {(flip.direction === 'next' ? flip.staticLeftUrl : flip.underlayUrl) && (
                        <img
                          src={(flip.direction === 'next' ? flip.staticLeftUrl : flip.underlayUrl)!}
                          alt=""
                          referrerPolicy="no-referrer"
                          style={{ filter: canvasFilter }}
                          className="h-full w-full object-contain"
                        />
                      )}
                      {flip.direction === 'prev' && (
                        <div
                          className="absolute inset-0"
                          style={{
                            background: `linear-gradient(270deg, rgba(0,0,0,${(1 - flip.progress) * 0.5}) 0%, transparent 75%)`,
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Right Spread Page */}
                <div
                  className={`relative overflow-hidden border-l ${
                    isSpaceHolo
                      ? 'border-cyan-400/35'
                      : isMedievalVisual
                        ? 'book-spine-right border-amber-900/35'
                        : 'book-spine-right border-zinc-400/40'
                  }`}
                >
                  <canvas
                    ref={spreadRightRef}
                    style={{ filter: canvasFilter }}
                    className={`block ${isSpaceHolo ? 'bg-transparent' : 'bg-white'} ${
                      flip ? 'opacity-0' : 'opacity-100'
                    }`}
                  />
                  {flip && (
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                      {(flip.direction === 'next' ? flip.underlayUrl : flip.staticRightUrl) && (
                        <img
                          src={(flip.direction === 'next' ? flip.underlayUrl : flip.staticRightUrl)!}
                          alt=""
                          referrerPolicy="no-referrer"
                          style={{ filter: canvasFilter }}
                          className="h-full w-full object-contain"
                        />
                      )}
                      {flip.direction === 'next' && (
                        <div
                          className="absolute inset-0"
                          style={{
                            background: `linear-gradient(90deg, rgba(0,0,0,${(1 - flip.progress) * 0.5}) 0%, transparent 75%)`,
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Turning Book Leaf Anchored to Center Spine with Tall 3D Curl Lift */}
                {flip && (() => {
                  const p = flip.progress;
                  const arc = Math.sin(p * Math.PI);
                  const yDelta = (flip.touchYRatio - 0.5) * 2;
                  const liftZ = arc * 42;
                  const curlRotateX = yDelta * arc * 6;
                  const angleY = flip.direction === 'next' ? -p * 180 : p * 180;

                  return (
                    <div
                      className="page-flip-leaf pointer-events-none absolute bottom-0 top-0 z-30 w-1/2"
                      style={{
                        left: flip.direction === 'next' ? '50%' : '0%',
                        transformOrigin:
                          flip.direction === 'next'
                            ? `left ${Math.round(flip.touchYRatio * 100)}%`
                            : `right ${Math.round(flip.touchYRatio * 100)}%`,
                        transform: `translateZ(${liftZ}px) scale(${1 + arc * 0.02}) rotateY(${angleY}deg) rotateX(${curlRotateX}deg)`,
                        filter: `drop-shadow(0 16px 24px rgba(0,0,0,${0.48 * arc}))`,
                      }}
                    >
                      <div className="page-flip-face absolute inset-0 overflow-hidden shadow-2xl">
                        <img
                          src={flip.frontUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          style={{ filter: canvasFilter }}
                          className={`h-full w-full object-contain ${
                            isSpaceHolo ? 'opacity-95' : 'bg-white'
                          }`}
                        />
                        <div
                          className="page-curl-ridge absolute inset-0"
                          style={{
                            background: `linear-gradient(90deg, rgba(0,0,0,${arc * 0.18}) 0%, rgba(255,255,255,${arc * 0.25}) 50%, rgba(0,0,0,${arc * 0.24}) 100%)`,
                          }}
                        />
                      </div>
                      <div className="page-flip-face-back absolute inset-0 overflow-hidden shadow-2xl">
                        {renderReverseLeafFace(flip.backUrl)}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : readingMode === 'parchment' ? (
            /* Unfurled Medieval Pergamino Scroll */
            <div className={`mx-auto flex flex-col items-center py-2 ${zoom > 1.02 ? 'min-w-max' : 'max-w-4xl'}`}>
              <div className="flex w-full max-w-[920px] items-center">
                <div className="parchment-brass-cap h-6 w-5 shrink-0 rounded-l-full border border-amber-950" />
                <div className="parchment-roller h-8 flex-1 rounded-sm border-y border-amber-950/80" />
                <div className="parchment-brass-cap h-6 w-5 shrink-0 rounded-r-full border border-amber-950" />
              </div>

              <div
                className={`parchment-sheet relative flex flex-col items-center gap-6 border-x border-amber-950/50 px-4 py-8 sm:px-8 ${
                  zoom > 1.02 ? 'min-w-max' : 'w-[94%] max-w-[870px]'
                }`}
              >
                {renderMedievalCornerPins()}
                {pdfDoc &&
                  Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <div key={pageNum} className="relative flex w-full flex-col items-center">
                      <ContinuousPdfPage
                        pdfDoc={pdfDoc}
                        pageNum={pageNum}
                        zoom={zoom}
                        canvasFilter={
                          isDiy
                            ? getDiyCanvasFilter(diyConfig)
                            : 'sepia(0.55) contrast(1.08) brightness(0.92)'
                        }
                        pageBorder="1px solid rgba(120, 53, 15, 0.35)"
                        containerRef={scrollContainerRef}
                        isSpaceHolo={false}
                        onVisible={() => {
                          if (pageNum !== currentPage && soundEnabled) {
                            playPageTurnSound('medieval', 'parchment');
                          }
                          setCurrentPage(pageNum);
                        }}
                      />
                      <span className="mt-2 font-mono text-[11px] font-medium text-amber-950/75">
                        — Folio {pageNum} —
                      </span>
                    </div>
                  ))}
              </div>

              <div className="flex w-full max-w-[920px] items-center">
                <div className="parchment-brass-cap h-6 w-5 shrink-0 rounded-l-full border border-amber-950" />
                <div className="parchment-roller h-8 flex-1 rounded-sm border-y border-amber-950/80" />
                <div className="parchment-brass-cap h-6 w-5 shrink-0 rounded-r-full border border-amber-950" />
              </div>
            </div>
          ) : (
            /* Continuous Vertical Scroll Mode */
            <div className={`mx-auto flex flex-col items-center gap-5 ${zoom > 1.02 ? 'min-w-max' : 'max-w-4xl'}`}>
              {pdfDoc &&
                Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <ContinuousPdfPage
                    key={pageNum}
                    pdfDoc={pdfDoc}
                    pageNum={pageNum}
                    zoom={zoom}
                    canvasFilter={canvasFilter}
                    pageBorder={pageBorder}
                    containerRef={scrollContainerRef}
                    isSpaceHolo={isSpaceHolo}
                    onVisible={() => setCurrentPage(pageNum)}
                  />
                ))}
            </div>
          )}
        </div>

        {/* Bookmarks Side Panel */}
        {showBookmarksPanel && (
          <aside
            aria-label="PDF Bookmarks"
            className={`steady-scroll absolute inset-y-0 right-0 z-30 flex w-80 max-w-[88vw] flex-col border-l backdrop-blur-xl sm:static ${
              isDiy
                ? 'border-zinc-800 bg-[#0d0d11]/95'
                : `${preset!.surfaceClass} ${preset!.borderClass}`
            }`}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <Bookmark className="h-4 w-4" style={{ color: themeAccent }} />
                <h3 className="font-display text-sm font-semibold text-white">
                  Bookmarks ({bookmarks.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBookmarksPanel(false)}
                aria-label="Close bookmarks panel"
                className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddOrToggleBookmark(newBookmarkLabel || `Page ${currentPage}`);
              }}
              className="space-y-2 border-b border-white/10 p-3.5"
            >
              <p className="font-mono text-[11px] text-zinc-400">
                Save current page (p.{currentPage})
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBookmarkLabel}
                  onChange={(e) => setNewBookmarkLabel(e.target.value)}
                  placeholder={`Label (e.g. Page ${currentPage})`}
                  className="min-h-[40px] min-w-0 flex-1 rounded-xl border border-white/15 bg-black/40 px-3 text-xs text-white placeholder:text-zinc-500 focus:border-white/40 focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label="Save bookmark"
                  className="flex min-h-[40px] shrink-0 items-center gap-1 rounded-xl px-3 text-xs font-semibold text-white"
                  style={{ backgroundColor: themeAccent }}
                >
                  <Plus className="h-4 w-4" />
                  <span>Save</span>
                </button>
              </div>
            </form>

            <div className="steady-scroll flex-1 overflow-y-auto divide-y divide-white/5 p-2">
              {bookmarks.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Bookmark className="mx-auto h-8 w-8 text-zinc-600" />
                  <p className="mt-2 text-xs text-zinc-400">
                    No bookmarks saved yet in this PDF. Tap the bookmark icon or Save above to pin any page.
                  </p>
                </div>
              ) : (
                bookmarks.map((bm) => {
                  const isCurrent = bm.page === currentPage;
                  const isEditing = editingBookmarkId === bm.id;
                  return (
                    <div
                      key={bm.id}
                      className={`rounded-xl p-2.5 transition-colors ${
                        isCurrent ? 'bg-white/10' : 'hover:bg-white/5'
                      }`}
                    >
                      {isEditing ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleRenameBookmark(bm.id, editingBookmarkText);
                          }}
                          className="flex gap-1.5"
                        >
                          <input
                            type="text"
                            value={editingBookmarkText}
                            onChange={(e) => setEditingBookmarkText(e.target.value)}
                            autoFocus
                            className="min-h-[36px] min-w-0 flex-1 rounded-lg border border-white/20 bg-black/50 px-2.5 text-xs text-white focus:outline-none"
                          />
                          <button
                            type="submit"
                            className="min-h-[36px] rounded-lg px-2.5 text-xs font-semibold text-white"
                            style={{ backgroundColor: themeAccent }}
                          >
                            OK
                          </button>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => commitPageChange(bm.page, true)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="truncate text-xs font-semibold text-white">
                              {bm.label}
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] text-zinc-400">
                              Page {bm.page}
                            </p>
                          </button>

                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBookmarkId(bm.id);
                                setEditingBookmarkText(bm.label);
                              }}
                              aria-label={`Rename bookmark ${bm.label}`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBookmark(bm.id)}
                              aria-label={`Delete bookmark ${bm.label}`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-950/50 hover:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Bottom Steady Navigation & Zoom Bar */}
      <footer
        className={`relative z-30 shrink-0 border-t px-4 py-2 backdrop-blur-md ${
          isDiy
            ? 'border-zinc-800/80 bg-black/80'
            : `${preset!.surfaceClass} ${preset!.borderClass}`
        }`}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-1">
          {totalPages > 1 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={currentPage <= 1 || Boolean(flip)}
                onClick={() => void triggerAnimatedTurn('prev')}
                aria-label="Previous page"
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-zinc-200 hover:bg-white/10 disabled:opacity-30"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="flex-1">
                <SteadyScrubber
                  value={currentPage}
                  min={1}
                  max={totalPages}
                  step={1}
                  accentColor={themeAccent}
                  ariaLabel="PDF page scrubber"
                  onChange={(val) => setCurrentPage(Math.round(val))}
                  onCommit={(val) => commitPageChange(Math.round(val), true)}
                />
              </div>

              <button
                type="button"
                disabled={
                  (readingMode === 'two-page'
                    ? currentPage + 2 > totalPages
                    : currentPage >= totalPages) || Boolean(flip)
                }
                onClick={() => void triggerAnimatedTurn('next')}
                aria-label="Next page"
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-zinc-200 hover:bg-white/10 disabled:opacity-30"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={zoom <= 0.5}
                onClick={() => applyZoom(zoom - 0.2)}
                aria-label="Zoom out"
                className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg text-zinc-200 hover:bg-white/10 disabled:opacity-35"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => applyZoom(1)}
                title="Reset zoom to 100%"
                aria-label={`Zoom ${Math.round(zoom * 100)} percent, tap to reset`}
                className="flex min-h-[34px] min-w-[54px] items-center justify-center gap-1 rounded-lg border border-white/10 bg-black/30 px-2 font-mono text-xs text-zinc-200 hover:bg-white/10"
              >
                <span>{Math.round(zoom * 100)}%</span>
                {Math.abs(zoom - 1) > 0.03 && <RotateCcw className="h-3 w-3 text-zinc-400" />}
              </button>
              <button
                type="button"
                disabled={zoom >= 3.5}
                onClick={() => applyZoom(zoom + 0.2)}
                aria-label="Zoom in"
                className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg text-zinc-200 hover:bg-white/10 disabled:opacity-35"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <div className="ml-1 hidden items-center gap-1 md:flex">
                {[1.5, 2].map((presetZoom) => (
                  <button
                    key={presetZoom}
                    type="button"
                    onClick={() => applyZoom(presetZoom)}
                    className={`min-h-[30px] rounded-md px-2 font-mono text-[11px] ${
                      Math.abs(zoom - presetZoom) < 0.05
                        ? 'bg-white/20 text-white'
                        : 'text-zinc-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {Math.round(presetZoom * 100)}%
                  </button>
                ))}
              </div>
            </div>

            <div className="hidden items-center gap-1 sm:flex">
              {READING_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleChangeReadingMode(m.id)}
                  className={`flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 text-[11px] font-medium transition-colors ${
                    readingMode === m.id
                      ? 'text-white'
                      : 'text-zinc-400 hover:bg-white/10 hover:text-zinc-200'
                  }`}
                  style={readingMode === m.id ? { backgroundColor: themeAccent } : undefined}
                >
                  {m.icon}
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            <span className="font-mono text-xs text-zinc-300">
              {currentPage} of {totalPages}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

const ContinuousPdfPage: React.FC<{
  pdfDoc: PDFDocumentProxy;
  pageNum: number;
  zoom: number;
  canvasFilter: string;
  pageBorder: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isSpaceHolo: boolean;
  onVisible: () => void;
}> = ({
  pdfDoc,
  pageNum,
  zoom,
  canvasFilter,
  pageBorder,
  containerRef,
  isSpaceHolo,
  onVisible,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onVisible();
      },
      { root: containerRef.current, threshold: 0.45 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [containerRef, onVisible]);

  useEffect(() => {
    let cancelled = false;
    let renderTask: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | null =
      null;
    void (async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
        const baseViewport = page.getViewport({ scale: 1 });
        const targetWidth = Math.min(840, Math.max(260, containerWidth - 56));
        const fitScale = (targetWidth / baseViewport.width) * zoom;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const viewport = page.getViewport({ scale: fitScale * dpr });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
        renderTask = page.render({ canvasContext: ctx, viewport, canvas });
        await renderTask.promise;
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfDoc, pageNum, zoom, containerRef]);

  return (
    <div
      ref={wrapperRef}
      className={`relative overflow-hidden rounded-lg ${
        isSpaceHolo ? 'hologram-frame bg-cyan-950/20' : 'shadow-xl'
      }`}
      style={{ border: isSpaceHolo ? undefined : pageBorder }}
    >
      {isSpaceHolo && (
        <div className="hologram-scanlines pointer-events-none absolute inset-0 z-10 opacity-70" />
      )}
      <canvas
        ref={canvasRef}
        style={{ filter: canvasFilter }}
        className={`block ${isSpaceHolo ? 'bg-transparent' : 'bg-white'}`}
      />
    </div>
  );
};
