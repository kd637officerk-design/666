export type FileCategory = 'audio' | 'pdf' | 'image' | 'video' | 'other';

export interface DeviceFileEntry {
  /** Unique stable ID derived from relative path */
  id: string;
  name: string;
  relativePath: string;
  folderPath: string;
  size: number;
  lastModified: number;
  mimeType: string;
  category: FileCategory;
  extension: string;
  /** Live FileSystemFileHandle when linked via File System Access API */
  handle?: FileSystemFileHandle;
  /** Parent directory handle for write/rename/delete operations */
  parentHandle?: FileSystemDirectoryHandle;
  /** Direct File reference (from input picker or resolved from handle) */
  file?: File;
}

export interface TrackMetadata {
  id: string; // matches DeviceFileEntry.id
  title: string;
  artist: string;
  album: string;
  genre?: string;
  duration: number;
  coverUrl?: string;
  hasCustomCover?: boolean;
  playCount: number;
  lastPlayedAt: number;
  addedAt: number;
  isFavorite: boolean;
}

export type SmartPlaylistGroupBy = 'artist' | 'album' | 'genre';

export interface SmartPlaylistRule {
  groupBy: SmartPlaylistGroupBy;
  value: string;
}

export interface UserPlaylist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
  isSmart?: boolean;
  smartRule?: SmartPlaylistRule;
}

export interface WallpaperItem {
  id: string;
  name: string;
  mimeType: string;
  isGif: boolean;
  isVideo: boolean;
  size: number;
  width?: number;
  height?: number;
  createdAt: number;
  blob: Blob;
}

export type WallpaperScope = 'off' | 'global' | 'audio' | 'pdf';

export interface WallpaperConfig {
  activeWallpaperId: string | null;
  scope: WallpaperScope;
  dimOpacity: number; // 0 to 90
  blurPx: number; // 0 to 24
  fit: 'cover' | 'contain';
}

export type PdfThemeId =
  | 'diy'
  | 'vinland-saga'
  | 'dune'
  | 'berserk'
  | 'ben-10'
  | 'gotham'
  | 'justice-league'
  | 'avengers'
  | 'medieval'
  | 'dnd'
  | 'magical-forest'
  | 'blade-runner'
  | 'harry-potter'
  | 'cyberpunk-2077'
  | 'maze-runner'
  | 'ghost-in-the-shell'
  | 'neo-evangelion'
  | 'dc-absolute'
  | 'green-lanterns'
  | 'avatar'
  | 'castlevania'
  | 'steampunk'
  | 'arcane'
  | 'ready-player-one'
  | 'anime'
  | 'dc'
  | 'marvel'
  | 'twd'
  | 'space';

export type UniverseAmbientKind =
  | 'snow-fjord'
  | 'spice-desert'
  | 'eclipse-embers'
  | 'cyber-matrix'
  | 'noir-storm'
  | 'orbital-hud'
  | 'candle-embers'
  | 'bioluminescent'
  | 'neon-rain'
  | 'monolith-shafts'
  | 'gothic-bats'
  | 'clockwork-steam'
  | 'synth-oasis'
  | 'hextech-arcane'
  | 'space-hologram';

export type PdfReadingMode = 'single' | 'two-page' | 'continuous' | 'parchment';

export interface PdfBookmark {
  id: string;
  page: number;
  label: string;
  createdAt: number;
}

export type PdfPageFilter = 'natural' | 'dark-invert' | 'sepia' | 'noir-ink' | 'vibrant';

export interface DiyPdfThemeConfig {
  name?: string;
  bgColor: string;
  surfaceColor: string;
  accentColor: string;
  textColor: string;
  pageFilter: PdfPageFilter;
  frameBorderColor: string;
  showWallpaperBehind: boolean;
  fontScale: number;
}

export interface SavedDiyTheme {
  id: string;
  name: string;
  config: DiyPdfThemeConfig;
  createdAt: number;
}

export type SavedLinkCategory = 'reference' | 'pdf-source' | 'study' | 'voice-ai' | 'other';

export interface SavedLinkItem {
  id: string;
  title: string;
  url: string;
  category: SavedLinkCategory;
  notes?: string;
  linkedPdfId?: string;
  createdAt: number;
}

export type GeminiTtsVoiceName =
  | 'Kore'
  | 'Zephyr'
  | 'Puck'
  | 'Charon'
  | 'Fenrir'
  | 'Aoede'
  | 'Leda'
  | 'Orus'
  | 'Sulafat'
  | 'Gacrux'
  | 'Umbriel'
  | 'Despina'
  | 'Vindemiatrix'
  | 'Enceladus'
  | 'Algieba';

export type VoiceReaderEngine = 'gemini-tts' | 'device-tts' | 'custom-url';

export interface AiVoiceReaderProfile {
  id: string;
  name: string;
  engine: VoiceReaderEngine;
  voiceName: string;
  stylePrompt: string;
  rate: number;
  language?: string;
  customEndpointUrl?: string;
  notes?: string;
  isBuiltIn?: boolean;
  createdAt: number;
}

export interface PdfDocState {
  id: string;
  starred: boolean;
  lastOpenedAt: number;
  lastLeftAt?: number;
  readingDurationSec?: number;
  voicePositionSec?: number;
  scrollRatio?: number;
  currentPage: number;
  totalPages: number;
  zoom: number;
  readingMode?: PdfReadingMode;
  bookmarks?: PdfBookmark[];
  thumbnailUrl?: string;
  author?: string;
  tags?: string[];
  summaryNotes?: string;
}

export interface PermissionState {
  musicAndAudio: boolean;
  photosAndVideos: boolean;
  allFilesAccess: boolean;
  realTimeSyncEnabled: boolean;
}

export interface GestureLockSettings {
  enabled: boolean;
  patternHash: string | null;
  patternSalt: string | null;
  patternLength: number;
  lockPdfReader: boolean;
  lockSensitiveFolders: boolean;
  lockedFolderPaths: string[];
  autoLockMinutes: number;
}

export type MainWorkspace = 'audio' | 'pdf' | 'files' | 'wallpapers';

export type AudioSubTab =
  | 'songs'
  | 'recent'
  | 'queue'
  | 'playing'
  | 'library'
  | 'folders'
  | 'artists'
  | 'albums'
  | 'videos'
  | 'search';

export type AudioLibraryFilter =
  | 'all'
  | 'favorites'
  | 'recent-added'
  | 'recent-played'
  | 'most-played'
  | 'not-played';
