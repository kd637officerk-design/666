import {
  AiVoiceReaderProfile,
  DiyPdfThemeConfig,
  GestureLockSettings,
  PdfDocState,
  PdfThemeId,
  PermissionState,
  SavedDiyTheme,
  SavedLinkItem,
  TrackMetadata,
  UserPlaylist,
  WallpaperConfig,
  WallpaperItem,
} from '../types';
import { DEFAULT_GESTURE_LOCK_SETTINGS } from './gestureSecurity';

const DB_NAME = 'kurodeck_local_db_v1';
const DB_VERSION = 1;

const STORES = {
  KV: 'kv',
  TRACK_META: 'track_meta',
  WALLPAPERS: 'wallpapers',
  PDF_STATES: 'pdf_states',
  PLAYLISTS: 'playlists',
  FALLBACK_FILES: 'fallback_files',
} as const;

export interface StoredTrackRecord {
  id: string;
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  duration?: number;
  coverBlob?: Blob;
  hasCustomCover?: boolean;
  playCount: number;
  lastPlayedAt: number;
  addedAt: number;
  isFavorite: boolean;
}

export interface StoredFallbackFile {
  id: string;
  name: string;
  relativePath: string;
  folderPath: string;
  size: number;
  lastModified: number;
  mimeType: string;
  blob: Blob;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.KV)) db.createObjectStore(STORES.KV);
      if (!db.objectStoreNames.contains(STORES.TRACK_META)) db.createObjectStore(STORES.TRACK_META, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.WALLPAPERS)) db.createObjectStore(STORES.WALLPAPERS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.PDF_STATES)) db.createObjectStore(STORES.PDF_STATES, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.PLAYLISTS)) db.createObjectStore(STORES.PLAYLISTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.FALLBACK_FILES)) db.createObjectStore(STORES.FALLBACK_FILES, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.KV, 'readonly');
    const req = tx.objectStore(STORES.KV).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function kvSet<T>(key: string, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.KV, 'readwrite');
    const req = tx.objectStore(STORES.KV).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve((req.result as T[]) || []);
    req.onerror = () => reject(req.error);
  });
}

async function putInStore<T>(storeName: string, item: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function deleteFromStore(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function clearStore(storeName: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Directory handle persistence
export async function saveRootDirectoryHandle(handle: FileSystemDirectoryHandle | null): Promise<void> {
  await kvSet('rootDirectoryHandle', handle);
}

export async function loadRootDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  return (await kvGet<FileSystemDirectoryHandle | null>('rootDirectoryHandle')) ?? null;
}

// Permissions
export const DEFAULT_PERMISSIONS: PermissionState = {
  musicAndAudio: false,
  photosAndVideos: false,
  allFilesAccess: false,
  realTimeSyncEnabled: true,
};

export async function loadPermissions(): Promise<PermissionState> {
  return (await kvGet<PermissionState>('permissions')) ?? DEFAULT_PERMISSIONS;
}

export async function savePermissions(perms: PermissionState): Promise<void> {
  await kvSet('permissions', perms);
}

// Gesture Security Lock & Sensitive Folders
export async function loadGestureLockSettings(): Promise<GestureLockSettings> {
  const stored = await kvGet<Partial<GestureLockSettings>>('gestureLockSettings');
  if (!stored) return DEFAULT_GESTURE_LOCK_SETTINGS;
  return {
    ...DEFAULT_GESTURE_LOCK_SETTINGS,
    ...stored,
    lockedFolderPaths: Array.isArray(stored.lockedFolderPaths)
      ? stored.lockedFolderPaths
      : [],
  };
}

export async function saveGestureLockSettings(settings: GestureLockSettings): Promise<void> {
  await kvSet('gestureLockSettings', settings);
}

// Track metadata & custom cover art
export async function loadAllTrackRecords(): Promise<Record<string, StoredTrackRecord>> {
  const rows = await getAllFromStore<StoredTrackRecord>(STORES.TRACK_META);
  const map: Record<string, StoredTrackRecord> = {};
  for (const row of rows) {
    map[row.id] = row;
  }
  return map;
}

export async function saveTrackRecord(record: StoredTrackRecord): Promise<void> {
  await putInStore(STORES.TRACK_META, record);
}

export async function deleteTrackRecord(id: string): Promise<void> {
  await deleteFromStore(STORES.TRACK_META, id);
}

// Playlists (user-created only)
export async function loadPlaylists(): Promise<UserPlaylist[]> {
  return getAllFromStore<UserPlaylist>(STORES.PLAYLISTS);
}

export async function savePlaylist(playlist: UserPlaylist): Promise<void> {
  await putInStore(STORES.PLAYLISTS, playlist);
}

export async function deletePlaylist(id: string): Promise<void> {
  await deleteFromStore(STORES.PLAYLISTS, id);
}

// Wallpapers (4K GIF / Image)
export const DEFAULT_WALLPAPER_CONFIG: WallpaperConfig = {
  activeWallpaperId: null,
  scope: 'global',
  dimOpacity: 24,
  blurPx: 0,
  fit: 'cover',
};

export async function loadWallpapers(): Promise<WallpaperItem[]> {
  const list = await getAllFromStore<WallpaperItem>(STORES.WALLPAPERS);
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveWallpaper(item: WallpaperItem): Promise<void> {
  await putInStore(STORES.WALLPAPERS, item);
}

export async function deleteWallpaper(id: string): Promise<void> {
  await deleteFromStore(STORES.WALLPAPERS, id);
}

export async function loadWallpaperConfig(): Promise<WallpaperConfig> {
  return (await kvGet<WallpaperConfig>('wallpaperConfig')) ?? DEFAULT_WALLPAPER_CONFIG;
}

export async function saveWallpaperConfig(config: WallpaperConfig): Promise<void> {
  await kvSet('wallpaperConfig', config);
}

// PDF states & themes
export const DEFAULT_DIY_THEME: DiyPdfThemeConfig = {
  bgColor: '#09090b',
  surfaceColor: '#141418',
  accentColor: '#5ea3ff',
  textColor: '#f4f4f5',
  pageFilter: 'natural',
  frameBorderColor: '#27272a',
  showWallpaperBehind: false,
  fontScale: 1,
};

export async function loadPdfStates(): Promise<Record<string, PdfDocState>> {
  const rows = await getAllFromStore<PdfDocState>(STORES.PDF_STATES);
  const map: Record<string, PdfDocState> = {};
  for (const r of rows) map[r.id] = r;
  return map;
}

export async function savePdfState(state: PdfDocState): Promise<void> {
  await putInStore(STORES.PDF_STATES, state);
}

export async function deletePdfState(id: string): Promise<void> {
  await deleteFromStore(STORES.PDF_STATES, id);
}

export async function loadActivePdfTheme(): Promise<PdfThemeId> {
  return (await kvGet<PdfThemeId>('activePdfTheme')) ?? 'diy';
}

export async function saveActivePdfTheme(theme: PdfThemeId): Promise<void> {
  await kvSet('activePdfTheme', theme);
}

export async function loadDiyThemeConfig(): Promise<DiyPdfThemeConfig> {
  return (await kvGet<DiyPdfThemeConfig>('diyThemeConfig')) ?? DEFAULT_DIY_THEME;
}

export async function saveDiyThemeConfig(config: DiyPdfThemeConfig): Promise<void> {
  await kvSet('diyThemeConfig', config);
}

export async function loadSavedDiyThemes(): Promise<SavedDiyTheme[]> {
  return (await kvGet<SavedDiyTheme[]>('savedDiyThemes')) ?? [];
}

export async function saveSavedDiyThemes(themes: SavedDiyTheme[]): Promise<void> {
  await kvSet('savedDiyThemes', themes);
}

export async function loadUniverseImages(): Promise<Record<string, string>> {
  return (await kvGet<Record<string, string>>('universeImages')) ?? {};
}

export async function saveUniverseImage(themeId: string, imageDataUrl: string): Promise<Record<string, string>> {
  const curr = await loadUniverseImages();
  const next = { ...curr, [themeId]: imageDataUrl };
  await kvSet('universeImages', next);
  return next;
}

export async function deleteUniverseImage(themeId: string): Promise<Record<string, string>> {
  const curr = await loadUniverseImages();
  const next = { ...curr };
  delete next[themeId];
  await kvSet('universeImages', next);
  return next;
}

// Saved Links Vault
export async function loadSavedLinks(): Promise<SavedLinkItem[]> {
  return (await kvGet<SavedLinkItem[]>('savedLinks')) ?? [];
}

export async function saveSavedLinks(links: SavedLinkItem[]): Promise<void> {
  await kvSet('savedLinks', links);
}

// Custom AI Natural Voice Readers
export async function loadCustomVoiceReaders(): Promise<AiVoiceReaderProfile[]> {
  return (await kvGet<AiVoiceReaderProfile[]>('customVoiceReaders')) ?? [];
}

export async function saveCustomVoiceReaders(readers: AiVoiceReaderProfile[]): Promise<void> {
  await kvSet('customVoiceReaders', readers);
}

export async function loadActiveVoiceReaderId(): Promise<string> {
  return (await kvGet<string>('activeVoiceReaderId')) ?? 'builtin:kore-audiobook';
}

export async function saveActiveVoiceReaderId(id: string): Promise<void> {
  await kvSet('activeVoiceReaderId', id);
}

export async function loadTtsServerUrl(): Promise<string> {
  return (await kvGet<string>('ttsServerUrl')) ?? '';
}

export async function saveTtsServerUrl(url: string): Promise<void> {
  await kvSet('ttsServerUrl', url.trim());
}

interface TtsCacheEntry {
  key: string;
  audioDataUrl: string;
  savedAt: number;
}

export async function loadCachedTtsAudio(key: string): Promise<string | null> {
  try {
    const entries = (await kvGet<TtsCacheEntry[]>('ttsAudioCache')) ?? [];
    const found = entries.find((e) => e.key === key);
    return found ? found.audioDataUrl : null;
  } catch {
    return null;
  }
}

export async function saveCachedTtsAudio(key: string, audioDataUrl: string): Promise<void> {
  try {
    const entries = (await kvGet<TtsCacheEntry[]>('ttsAudioCache')) ?? [];
    const filtered = entries.filter((e) => e.key !== key);
    const next: TtsCacheEntry[] = [
      { key, audioDataUrl, savedAt: Date.now() },
      ...filtered,
    ].slice(0, 36);
    await kvSet('ttsAudioCache', next);
  } catch {
    // Ignore storage quota errors
  }
}

// Fallback local files store (for mobile browsers without showDirectoryPicker)
export async function loadFallbackFiles(): Promise<StoredFallbackFile[]> {
  return getAllFromStore<StoredFallbackFile>(STORES.FALLBACK_FILES);
}

export async function saveFallbackFile(item: StoredFallbackFile): Promise<void> {
  await putInStore(STORES.FALLBACK_FILES, item);
}

export async function deleteFallbackFile(id: string): Promise<void> {
  await deleteFromStore(STORES.FALLBACK_FILES, id);
}

export async function clearFallbackFiles(): Promise<void> {
  await clearStore(STORES.FALLBACK_FILES);
}

export function trackMetadataFromRecord(
  id: string,
  fallbackTitle: string,
  rec?: StoredTrackRecord
): TrackMetadata {
  return {
    id,
    title: rec?.title || fallbackTitle,
    artist: rec?.artist || '<unknown>',
    album: rec?.album || '',
    genre: rec?.genre || '',
    duration: rec?.duration || 0,
    hasCustomCover: rec?.hasCustomCover || false,
    playCount: rec?.playCount || 0,
    lastPlayedAt: rec?.lastPlayedAt || 0,
    addedAt: rec?.addedAt || Date.now(),
    isFavorite: rec?.isFavorite || false,
  };
}
