import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  Ban,
  BookmarkCheck,
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Disc3,
  Download,
  Edit3,
  EyeOff,
  FileCode2,
  FileText,
  Film,
  Flame,
  Folder,
  FolderOpen,
  Heart,
  History,
  Link2,
  ListMusic,
  Lock,
  Menu,
  MoreHorizontal,
  Music,
  Pause,
  Play,
  Plus,
  Repeat,
  Search,
  Settings,
  ShieldCheck,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Timer,
  Trash2,
  User,
  Volume2,
  Wallpaper,
  X,
} from 'lucide-react';
import {
  AudioLibraryFilter,
  AudioSubTab,
  DeviceFileEntry,
  MainWorkspace,
  SavedLinkItem,
  SmartPlaylistGroupBy,
  SmartPlaylistRule,
  TrackMetadata,
  UserPlaylist,
} from '../types';
import { formatBytes, formatDuration, resolveEntryFile } from '../lib/fileSystem';
import { SteadyScrubber } from './SteadyScrubber';
import { PdfLinksPanel } from './PdfLinksPanel';
import { PWAInstallButton } from './PWAInstallButton';

interface AudioWorkspaceProps {
  audioEntries: DeviceFileEntry[];
  videoEntries: DeviceFileEntry[];
  pdfEntries: DeviceFileEntry[];
  savedLinks: SavedLinkItem[];
  folders: string[];
  trackMetaMap: Record<string, TrackMetadata>;
  playlists: UserPlaylist[];
  queueIds: string[];
  currentTrackId: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  shuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  volume: number;
  hasLiveFolder: boolean;
  wallpaperActive: boolean;
  onOpenPermissions: () => void;
  onOpenWorkspace: (ws: MainWorkspace) => void;
  onSaveLink: (item: SavedLinkItem) => void;
  onDeleteLink: (id: string) => void;
  onOpenPdf: (entry: DeviceFileEntry) => void;
  onPauseAudio: () => void;
  onPlayTrack: (trackId: string, queueListIds?: string[]) => void;
  onTogglePlayPause: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onSeek: (time: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onChangeVolume: (vol: number) => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToQueue: (trackId: string, playNext?: boolean) => void;
  onRemoveFromQueue: (index: number) => void;
  onMoveQueueItem: (fromIndex: number, toIndex: number) => void;
  onClearQueue: () => void;
  onOpenArtworkEditor: (entry: DeviceFileEntry) => void;
  onCreatePlaylist: (name: string) => void;
  onAddTrackToPlaylist: (playlistId: string, trackId: string) => void;
  onRemoveTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onSaveSmartPlaylists: (
    items: { name: string; trackIds: string[]; smartRule: SmartPlaylistRule }[]
  ) => void;
  sleepTimerRemainingSec: number | null;
  onStartSleepTimer: (minutes: number) => void;
  onExtendSleepTimer: (extraMinutes: number) => void;
  onCancelSleepTimer: () => void;
  onClearRecentlyPlayed: () => void;
  onDeleteFile: (entry: DeviceFileEntry) => Promise<void>;
  gestureLockEnabled: boolean;
  onOpenGestureSecurity: () => void;
  onExportStandaloneHtml: () => void;
}

export const AudioWorkspace: React.FC<AudioWorkspaceProps> = ({
  audioEntries,
  videoEntries,
  pdfEntries,
  savedLinks,
  folders,
  trackMetaMap,
  playlists,
  queueIds,
  currentTrackId,
  isPlaying,
  currentTime,
  duration,
  shuffle,
  repeatMode,
  volume,
  hasLiveFolder,
  wallpaperActive,
  onOpenPermissions,
  onOpenWorkspace,
  onSaveLink,
  onDeleteLink,
  onOpenPdf,
  onPauseAudio,
  onPlayTrack,
  onTogglePlayPause,
  onPrevTrack,
  onNextTrack,
  onSeek,
  onToggleShuffle,
  onCycleRepeat,
  onChangeVolume,
  onToggleFavorite,
  onAddToQueue,
  onRemoveFromQueue,
  onMoveQueueItem,
  onClearQueue,
  onOpenArtworkEditor,
  onCreatePlaylist,
  onAddTrackToPlaylist,
  onRemoveTrackFromPlaylist,
  onDeletePlaylist,
  onSaveSmartPlaylists,
  sleepTimerRemainingSec,
  onStartSleepTimer,
  onExtendSleepTimer,
  onCancelSleepTimer,
  onClearRecentlyPlayed,
  onDeleteFile,
  gestureLockEnabled,
  onOpenGestureSecurity,
  onExportStandaloneHtml,
}) => {
  const [subTab, setSubTab] = useState<AudioSubTab>('songs');
  const [activeFilter, setActiveFilter] = useState<AudioLibraryFilter | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [smartGroupBy, setSmartGroupBy] = useState<SmartPlaylistGroupBy>('artist');
  const [selectedSmartGroup, setSelectedSmartGroup] = useState<{
    groupBy: SmartPlaylistGroupBy;
    key: string;
    label: string;
  } | null>(null);
  const [showSmartGeneratorModal, setShowSmartGeneratorModal] = useState(false);
  const [generatorGroupBy, setGeneratorGroupBy] = useState<SmartPlaylistGroupBy>('artist');
  const [generatorIncludeUnknown, setGeneratorIncludeUnknown] = useState(false);
  const [generatorMinTracks, setGeneratorMinTracks] = useState<1 | 2>(1);
  const [generatorDeselectedKeys, setGeneratorDeselectedKeys] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'recent' | 'plays'>('title');
  const [actionTrack, setActionTrack] = useState<DeviceFileEntry | null>(null);
  const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [playlistPickerTrackId, setPlaylistPickerTrackId] = useState<string | null>(null);

  // Full-bleed Now Playing art view & Player Settings state
  const [showArtControls, setShowArtControls] = useState(true);
  const [ignoreTrackArt, setIgnoreTrackArt] = useState<boolean>(() => {
    try {
      return localStorage.getItem('kurodeck_ignore_track_art') === '1';
    } catch {
      return false;
    }
  });
  const [showPlayerSettings, setShowPlayerSettings] = useState(false);
  const [showLinksSheet, setShowLinksSheet] = useState(false);
  const [showNowPlayingQueue, setShowNowPlayingQueue] = useState(false);
  const [showSleepTimerModal, setShowSleepTimerModal] = useState(false);
  const [customSleepMinutes, setCustomSleepMinutes] = useState('20');
  const [playingVideoEntry, setPlayingVideoEntry] = useState<DeviceFileEntry | null>(null);
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);

  const formatCountdown = (totalSec: number) => {
    const safe = Math.max(0, Math.floor(totalSec));
    const hrs = Math.floor(safe / 3600);
    const mins = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${mins}:${pad(secs)}`;
  };

  const toggleIgnoreTrackArt = () => {
    setIgnoreTrackArt((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('kurodeck_ignore_track_art', next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  useEffect(() => {
    let active = true;
    let objUrl: string | null = null;
    if (!playingVideoEntry) {
      setPlayingVideoUrl(null);
      return;
    }
    void resolveEntryFile(playingVideoEntry).then((file) => {
      if (!active || !file) return;
      objUrl = URL.createObjectURL(file);
      setPlayingVideoUrl(objUrl);
    });
    return () => {
      active = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [playingVideoEntry]);

  const entryMap = useMemo(() => {
    const m: Record<string, DeviceFileEntry> = {};
    for (const e of audioEntries) m[e.id] = e;
    return m;
  }, [audioEntries]);

  const getMeta = (entry: DeviceFileEntry): TrackMetadata => {
    return (
      trackMetaMap[entry.id] || {
        id: entry.id,
        title: entry.name.replace(/\.[^.]+$/, ''),
        artist: '<unknown>',
        album: entry.folderPath.split('/').pop() || 'Internal Storage',
        genre: '',
        duration: 0,
        playCount: 0,
        lastPlayedAt: 0,
        addedAt: entry.lastModified,
        isFavorite: false,
      }
    );
  };

  const recentlyPlayedTracks = useMemo(() => {
    return audioEntries
      .map((entry) => ({
        entry,
        meta: getMeta(entry),
      }))
      .filter((item) => item.meta.lastPlayedAt > 0)
      .sort((a, b) => b.meta.lastPlayedAt - a.meta.lastPlayedAt);
  }, [audioEntries, trackMetaMap]);

  const formatPlayedAgo = (ms: number) => {
    if (!ms || ms <= 0) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 7 * 86400) return `${Math.floor(diffSec / 86400)}d ago`;
    try {
      return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const getTrackGroupInfo = (
    entry: DeviceFileEntry,
    by: SmartPlaylistGroupBy
  ): { key: string; label: string; isUnknown: boolean } => {
    const meta = getMeta(entry);
    if (by === 'artist') {
      const raw = (meta.artist || '').trim();
      if (!raw || raw === '<unknown>') {
        return { key: '__unknown__', label: 'Unknown Artist', isUnknown: true };
      }
      return { key: raw.toLowerCase(), label: raw, isUnknown: false };
    }
    if (by === 'album') {
      const raw = (meta.album || '').trim();
      if (!raw) {
        return { key: '__unknown__', label: 'No Album', isUnknown: true };
      }
      return { key: raw.toLowerCase(), label: raw, isUnknown: false };
    }
    const rawGenre = (meta.genre || '').trim();
    if (!rawGenre) {
      return { key: '__unknown__', label: 'Untagged Genre', isUnknown: true };
    }
    return { key: rawGenre.toLowerCase(), label: rawGenre, isUnknown: false };
  };

  const computeSmartGroups = (by: SmartPlaylistGroupBy) => {
    const map = new Map<
      string,
      {
        key: string;
        label: string;
        isUnknown: boolean;
        groupBy: SmartPlaylistGroupBy;
        entries: DeviceFileEntry[];
        coverUrl?: string;
        totalDuration: number;
        savedPlaylist?: UserPlaylist;
      }
    >();

    for (const entry of audioEntries) {
      const info = getTrackGroupInfo(entry, by);
      const meta = getMeta(entry);
      const existing = map.get(info.key);
      if (existing) {
        existing.entries.push(entry);
        existing.totalDuration += meta.duration || 0;
        if (!existing.coverUrl && meta.coverUrl) existing.coverUrl = meta.coverUrl;
      } else {
        const saved = playlists.find(
          (p) =>
            p.isSmart &&
            p.smartRule?.groupBy === by &&
            p.smartRule?.value.toLowerCase() === info.key
        );
        map.set(info.key, {
          key: info.key,
          label: info.label,
          isUnknown: info.isUnknown,
          groupBy: by,
          entries: [entry],
          coverUrl: meta.coverUrl,
          totalDuration: meta.duration || 0,
          savedPlaylist: saved,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.isUnknown !== b.isUnknown) return a.isUnknown ? 1 : -1;
      if (b.entries.length !== a.entries.length) return b.entries.length - a.entries.length;
      return a.label.localeCompare(b.label);
    });
  };

  const smartGroups = useMemo(
    () => computeSmartGroups(smartGroupBy),
    [audioEntries, trackMetaMap, playlists, smartGroupBy]
  );

  const generatorAllGroups = useMemo(
    () => computeSmartGroups(generatorGroupBy),
    [audioEntries, trackMetaMap, playlists, generatorGroupBy]
  );

  const generatorCandidateGroups = useMemo(
    () =>
      generatorAllGroups.filter(
        (g) =>
          g.entries.length >= generatorMinTracks &&
          (generatorIncludeUnknown || !g.isUnknown)
      ),
    [generatorAllGroups, generatorMinTracks, generatorIncludeUnknown]
  );

  const resolvePlaylistEntries = (pl: UserPlaylist): DeviceFileEntry[] => {
    if (pl.isSmart && pl.smartRule) {
      const targetKey = pl.smartRule.value.toLowerCase();
      return audioEntries.filter(
        (e) => getTrackGroupInfo(e, pl.smartRule!.groupBy).key === targetKey
      );
    }
    return pl.trackIds.map((id) => entryMap[id]).filter(Boolean);
  };

  // Derive folders containing audio files
  const audioFolders = useMemo(() => {
    const map = new Map<string, DeviceFileEntry[]>();
    for (const e of audioEntries) {
      const key = e.folderPath || 'Internal Storage';
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    }
    for (const f of folders) {
      if (!map.has(f) && audioEntries.some((e) => e.folderPath.startsWith(`${f}/`))) {
        // Keep top-level structure clean
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [audioEntries, folders]);

  const artistsList = useMemo(() => {
    const map = new Map<string, DeviceFileEntry[]>();
    for (const e of audioEntries) {
      const artist = getMeta(e).artist || '<unknown>';
      const arr = map.get(artist) || [];
      arr.push(e);
      map.set(artist, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [audioEntries, trackMetaMap]);

  const albumsList = useMemo(() => {
    const map = new Map<string, DeviceFileEntry[]>();
    for (const e of audioEntries) {
      const album = getMeta(e).album || e.folderPath.split('/').pop() || 'Single';
      const arr = map.get(album) || [];
      arr.push(e);
      map.set(album, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [audioEntries, trackMetaMap]);

  const totalDurationAll = useMemo(() => {
    return audioEntries.reduce((acc, e) => acc + (getMeta(e).duration || 0), 0);
  }, [audioEntries, trackMetaMap]);

  // Filtered song list when inside a sub-view
  const visibleSongs = useMemo(() => {
    let list = [...audioEntries];

    if (subTab === 'library' && activeFilter) {
      if (activeFilter === 'favorites') {
        list = list.filter((e) => getMeta(e).isFavorite);
      } else if (activeFilter === 'recent-added') {
        list.sort((a, b) => b.lastModified - a.lastModified);
      } else if (activeFilter === 'recent-played') {
        list = list
          .filter((e) => getMeta(e).lastPlayedAt > 0)
          .sort((a, b) => getMeta(b).lastPlayedAt - getMeta(a).lastPlayedAt);
      } else if (activeFilter === 'most-played') {
        list = list
          .filter((e) => getMeta(e).playCount > 0)
          .sort((a, b) => getMeta(b).playCount - getMeta(a).playCount);
      } else if (activeFilter === 'not-played') {
        list = list.filter((e) => getMeta(e).playCount === 0);
      }
    } else if (subTab === 'library' && selectedSmartGroup) {
      list = list.filter(
        (e) => getTrackGroupInfo(e, selectedSmartGroup.groupBy).key === selectedSmartGroup.key
      );
    } else if (subTab === 'library' && selectedPlaylistId) {
      const pl = playlists.find((p) => p.id === selectedPlaylistId);
      if (pl) {
        list = resolvePlaylistEntries(pl);
      } else {
        list = [];
      }
    } else if (subTab === 'folders' && selectedFolder !== null) {
      list = list.filter((e) => (e.folderPath || 'Internal Storage') === selectedFolder);
    } else if (subTab === 'artists' && selectedArtist !== null) {
      list = list.filter((e) => (getMeta(e).artist || '<unknown>') === selectedArtist);
    } else if (subTab === 'albums' && selectedAlbum !== null) {
      list = list.filter(
        (e) => (getMeta(e).album || e.folderPath.split('/').pop() || 'Single') === selectedAlbum
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => {
        const m = getMeta(e);
        return (
          m.title.toLowerCase().includes(q) ||
          m.artist.toLowerCase().includes(q) ||
          m.album.toLowerCase().includes(q) ||
          (m.genre || '').toLowerCase().includes(q) ||
          e.name.toLowerCase().includes(q)
        );
      });
    }

    if (activeFilter !== 'recent-added' && activeFilter !== 'recent-played' && activeFilter !== 'most-played') {
      if (sortBy === 'title') {
        list.sort((a, b) => getMeta(a).title.localeCompare(getMeta(b).title));
      } else if (sortBy === 'recent') {
        list.sort((a, b) => b.lastModified - a.lastModified);
      } else if (sortBy === 'plays') {
        list.sort((a, b) => getMeta(b).playCount - getMeta(a).playCount);
      }
    }

    return list;
  }, [
    audioEntries,
    subTab,
    activeFilter,
    selectedSmartGroup,
    selectedPlaylistId,
    selectedFolder,
    selectedArtist,
    selectedAlbum,
    searchQuery,
    sortBy,
    playlists,
    entryMap,
    trackMetaMap,
  ]);

  const currentEntry = currentTrackId ? entryMap[currentTrackId] || null : null;
  const currentMeta = currentEntry ? getMeta(currentEntry) : null;

  const isInsideSubList =
    (subTab === 'library' &&
      (activeFilter !== null || selectedPlaylistId !== null || selectedSmartGroup !== null)) ||
    (subTab === 'folders' && selectedFolder !== null) ||
    (subTab === 'artists' && selectedArtist !== null) ||
    (subTab === 'albums' && selectedAlbum !== null);

  const currentSubListTitle = useMemo(() => {
    if (subTab === 'library') {
      if (activeFilter === 'all') return 'All songs';
      if (activeFilter === 'favorites') return 'Favorites';
      if (activeFilter === 'recent-added') return 'Recently added';
      if (activeFilter === 'recent-played') return 'Recently played';
      if (activeFilter === 'most-played') return 'Most played';
      if (activeFilter === 'not-played') return 'Not played';
      if (selectedSmartGroup) {
        const prefix =
          selectedSmartGroup.groupBy === 'artist'
            ? 'Artist'
            : selectedSmartGroup.groupBy === 'album'
              ? 'Album'
              : 'Genre';
        return `${prefix}: ${selectedSmartGroup.label}`;
      }
      if (selectedPlaylistId) {
        return playlists.find((p) => p.id === selectedPlaylistId)?.name || 'Playlist';
      }
    }
    if (subTab === 'folders' && selectedFolder !== null) {
      return selectedFolder.split('/').pop() || 'Internal Storage';
    }
    if (subTab === 'artists' && selectedArtist !== null) return selectedArtist;
    if (subTab === 'albums' && selectedAlbum !== null) return selectedAlbum;
    return '';
  }, [
    subTab,
    activeFilter,
    selectedSmartGroup,
    selectedPlaylistId,
    selectedFolder,
    selectedArtist,
    selectedAlbum,
    playlists,
  ]);

  const handleBackFromSubList = () => {
    setActiveFilter(null);
    setSelectedSmartGroup(null);
    setSelectedPlaylistId(null);
    setSelectedFolder(null);
    setSelectedArtist(null);
    setSelectedAlbum(null);
    setSearchQuery('');
  };

  const formatSmartPlaylistName = (by: SmartPlaylistGroupBy, label: string) => {
    const prefix = by === 'artist' ? 'Artist' : by === 'album' ? 'Album' : 'Genre';
    return `${prefix}: ${label}`;
  };

  const openSmartGenerator = (initialBy: SmartPlaylistGroupBy = smartGroupBy) => {
    setGeneratorGroupBy(initialBy);
    setGeneratorDeselectedKeys({});
    setShowSmartGeneratorModal(true);
  };

  const selectedSmartGroupSaved = useMemo(() => {
    if (!selectedSmartGroup) return false;
    return playlists.some(
      (p) =>
        p.isSmart &&
        p.smartRule?.groupBy === selectedSmartGroup.groupBy &&
        p.smartRule?.value.toLowerCase() === selectedSmartGroup.key
    );
  }, [selectedSmartGroup, playlists]);

  const renderSongRow = (
    entry: DeviceFileEntry,
    listIds: string[],
    showPlayedAt = false
  ) => {
    const meta = getMeta(entry);
    const isActive = currentTrackId === entry.id;
    const playedAgo = showPlayedAt && meta.lastPlayedAt > 0 ? formatPlayedAgo(meta.lastPlayedAt) : '';

    return (
      <div
        key={entry.id}
        className={`lightweight-row flex min-h-[64px] items-center gap-3 px-4 py-2 transition-colors ${
          isActive
            ? wallpaperActive
              ? 'bg-amber-500/20'
              : 'bg-amber-500/15'
            : wallpaperActive
              ? 'hover:bg-white/10'
              : 'hover:bg-zinc-900/60'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            if (isActive) {
              setShowArtControls(true);
              setSubTab('playing');
            } else {
              onPlayTrack(entry.id, listIds);
            }
          }}
          className="flex min-w-0 flex-1 items-center gap-3.5 text-left focus:outline-none"
        >
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-zinc-900/80 shadow-sm">
            {!ignoreTrackArt && meta.coverUrl ? (
              <img
                src={meta.coverUrl}
                alt={meta.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <Music className="h-5 w-5 text-zinc-500" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p
              className={`truncate text-[15px] font-medium ${
                isActive ? 'text-amber-300' : 'text-white'
              }`}
            >
              {meta.title}
            </p>
            <p className="truncate text-xs text-zinc-300/80">
              {meta.artist}
              {meta.album ? ` · ${meta.album}` : ''}
              {meta.genre ? ` · ${meta.genre}` : ''}
            </p>
          </div>
        </button>

        <div className="shrink-0 text-right">
          {playedAgo ? (
            <>
              <p className="font-mono text-[11px] font-medium text-amber-300">{playedAgo}</p>
              <p className="font-mono text-[10px] text-zinc-400">
                {meta.playCount > 0 ? `${meta.playCount}×` : ''}
                {meta.playCount > 0 && meta.duration > 0 ? ' · ' : ''}
                {meta.duration > 0 ? formatDuration(meta.duration) : ''}
              </p>
            </>
          ) : (
            <span className="font-mono text-xs text-zinc-300/80">
              {meta.duration > 0 ? formatDuration(meta.duration) : entry.extension.toUpperCase()}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setActionTrack(entry)}
          aria-label={`Options for ${meta.title}`}
          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10 hover:text-white"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>
    );
  };

  return (
    <div
      className={`relative flex h-full flex-col ${
        wallpaperActive ? 'bg-transparent [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]' : 'bg-[#0b0b0e]'
      }`}
    >
      {/* Lark Player-style Clean Header + Comfortable Media Indicator Strip */}
      <div
        className={`shrink-0 ${
          wallpaperActive
            ? 'bg-gradient-to-b from-black/45 via-black/20 to-transparent'
            : 'border-b border-zinc-800/70 bg-[#121216]'
        }`}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate font-display text-xl font-bold tracking-tight text-white">
              Symphony No. 9
            </h1>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                handleBackFromSubList();
                setSubTab((t) => (t === 'search' ? 'songs' : 'search'));
              }}
              aria-label="Search tracks"
              title="Search"
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                subTab === 'search'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-100 hover:bg-white/10'
              }`}
            >
              <Search className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() =>
                setSortBy((s) => (s === 'title' ? 'recent' : s === 'recent' ? 'plays' : 'title'))
              }
              aria-label={`Sort: ${sortBy}`}
              title={`Sort: ${sortBy === 'title' ? 'A-Z' : sortBy === 'recent' ? 'Newest' : 'Most Played'}`}
              className="flex h-10 items-center gap-1 rounded-full px-2.5 text-zinc-100 hover:bg-white/10"
            >
              <ArrowUpDown className="h-5 w-5" />
              <span className="hidden font-mono text-[11px] sm:inline">
                {sortBy === 'title' ? 'A-Z' : sortBy === 'recent' ? 'New' : 'Plays'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowSleepTimerModal(true)}
              aria-label={
                sleepTimerRemainingSec !== null
                  ? `Sleep timer ${formatCountdown(sleepTimerRemainingSec)}`
                  : 'Sleep timer'
              }
              title="Sleep Timer"
              className={`flex h-10 items-center gap-1.5 rounded-full transition-colors ${
                sleepTimerRemainingSec !== null
                  ? 'border border-amber-500/40 bg-amber-500/15 px-2.5 text-amber-300'
                  : 'w-10 justify-center text-zinc-100 hover:bg-white/10'
              }`}
            >
              <Timer className="h-4.5 w-4.5 shrink-0" />
              {sleepTimerRemainingSec !== null && (
                <span className="font-mono text-[11px] font-semibold tabular-nums">
                  {formatCountdown(sleepTimerRemainingSec)}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowPlayerSettings(true)}
              aria-label="Player settings"
              title="Player Settings"
              className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-100 hover:bg-white/10"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Comfortable Chip Strip: Video, PDF, Links Indicators | Audio Views */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto px-4 pb-3 pt-1">
          {/* Media Indicators: Video, PDF, Links (placed comfortably without disrupting player) */}
          <button
            type="button"
            onClick={() => {
              handleBackFromSubList();
              setSubTab('videos');
            }}
            className={`flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors whitespace-nowrap ${
              subTab === 'videos'
                ? 'bg-amber-500 text-zinc-950 font-semibold'
                : 'border border-white/15 bg-black/35 text-zinc-100 backdrop-blur-sm hover:bg-white/15'
            }`}
          >
            <Film className="h-3.5 w-3.5" />
            <span>Video</span>
            {videoEntries.length > 0 && (
              <span className="font-mono text-[10px] opacity-80">{videoEntries.length}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onOpenWorkspace('pdf')}
            className="flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-3 text-xs font-medium text-zinc-100 backdrop-blur-sm transition-colors hover:bg-white/15 whitespace-nowrap"
          >
            <FileText className="h-3.5 w-3.5 text-rose-400" />
            <span>PDF</span>
            {pdfEntries.length > 0 && (
              <span className="font-mono text-[10px] opacity-80">{pdfEntries.length}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowLinksSheet(true)}
            className="flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-3 text-xs font-medium text-zinc-100 backdrop-blur-sm transition-colors hover:bg-white/15 whitespace-nowrap"
          >
            <Link2 className="h-3.5 w-3.5 text-sky-400" />
            <span>Links</span>
            {savedLinks.length > 0 && (
              <span className="font-mono text-[10px] opacity-80">{savedLinks.length}</span>
            )}
          </button>

          <span aria-hidden="true" className="mx-0.5 h-4 w-px shrink-0 bg-white/20" />

          {/* Audio Navigation Pills */}
          {(
            [
              { id: 'songs', label: 'Songs' },
              {
                id: 'recent',
                label: 'Recent',
                count: recentlyPlayedTracks.length > 0 ? recentlyPlayedTracks.length : undefined,
              },
              { id: 'library', label: 'Playlists' },
              { id: 'folders', label: 'Folders' },
              { id: 'artists', label: 'Artists' },
              { id: 'albums', label: 'Albums' },
              { id: 'queue', label: 'Queue' },
            ] as { id: AudioSubTab; label: string; count?: number }[]
          ).map((chip) => {
            const active = subTab === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => {
                  setSubTab(chip.id);
                  handleBackFromSubList();
                }}
                className={`flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-amber-500 text-zinc-950 font-semibold shadow-sm'
                    : 'bg-black/30 text-zinc-200 hover:bg-white/15'
                }`}
              >
                <span>{chip.label}</span>
                {chip.count !== undefined && (
                  <span
                    className={`font-mono text-[10px] ${
                      active ? 'text-zinc-900/80' : 'text-zinc-400'
                    }`}
                  >
                    {chip.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty Device State when no audio files loaded (allow Videos tab even if audio is empty) */}
      {audioEntries.length === 0 && subTab !== 'videos' ? (
        <div className="steady-scroll flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 pb-24 text-center">
          <div
            className={`max-w-md space-y-4 rounded-2xl border border-zinc-800/80 p-6 ${
              wallpaperActive ? 'bg-black/50 backdrop-blur-md' : 'bg-zinc-950/90'
            }`}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/20 text-violet-400">
              <FolderOpen className="h-7 w-7" />
            </div>
            <h2 className="font-display text-xl font-semibold text-white">
              Symphony No. 9
            </h2>
            <p className="text-sm leading-relaxed text-zinc-400">
              Grant internal storage access to load your real music folders, play local audio files, and edit embedded cover art directly on your device.
            </p>
            <button
              type="button"
              onClick={onOpenPermissions}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
            >
              <FolderOpen className="h-4 w-4" />
              <span>{hasLiveFolder ? 'Manage Storage Permissions' : 'Allow Music & Internal Files'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`steady-scroll relative flex-1 overflow-y-auto ${
            currentEntry && subTab !== 'playing' ? 'pb-24' : 'pb-6'
          }`}
        >
          {/* Sub-list Header & Song List View */}
          {subTab === 'songs' ? (
            /* Lark Player-inspired Direct Songs List over Wallpaper + Recently Played Shelf */
            <div className="mx-auto max-w-3xl">
              {recentlyPlayedTracks.length > 0 && (
                <section
                  aria-label="Recently Played"
                  className="border-b border-white/10 px-4 pt-3 pb-3.5"
                >
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-amber-400" />
                      <h2 className="font-display text-sm font-semibold tracking-tight text-white">
                        Recently Played
                      </h2>
                      <span className="font-mono text-[11px] text-zinc-400">
                        ({recentlyPlayedTracks.length})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleBackFromSubList();
                        setSubTab('recent');
                      }}
                      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-white/10"
                    >
                      <span>See all</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-0.5">
                    {recentlyPlayedTracks.slice(0, 10).map(({ entry, meta }) => {
                      const isActive = currentTrackId === entry.id;
                      const recentQueueIds = recentlyPlayedTracks.map((r) => r.entry.id);
                      return (
                        <button
                          key={`recent-card-${entry.id}`}
                          type="button"
                          onClick={() => {
                            if (isActive) {
                              setShowArtControls(true);
                              setSubTab('playing');
                            } else {
                              onPlayTrack(entry.id, recentQueueIds);
                            }
                          }}
                          className={`group flex w-28 shrink-0 flex-col rounded-2xl border p-2 text-left transition-colors ${
                            isActive
                              ? 'border-amber-500/60 bg-amber-500/20'
                              : wallpaperActive
                                ? 'border-white/15 bg-black/45 backdrop-blur-sm hover:bg-black/65'
                                : 'border-zinc-800/80 bg-zinc-900/80 hover:bg-zinc-900'
                          }`}
                        >
                          <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-xl bg-zinc-900">
                            {!ignoreTrackArt && meta.coverUrl ? (
                              <img
                                src={meta.coverUrl}
                                alt={meta.title}
                                referrerPolicy="no-referrer"
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-zinc-500">
                                <Music className="h-6 w-6" />
                              </div>
                            )}
                            <span className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-amber-300 backdrop-blur-sm">
                              {isActive && isPlaying ? (
                                <Pause className="h-3 w-3" />
                              ) : (
                                <Play className="ml-0.5 h-3 w-3" />
                              )}
                            </span>
                          </div>
                          <p
                            className={`truncate text-xs font-medium ${
                              isActive ? 'text-amber-300' : 'text-white'
                            }`}
                          >
                            {meta.title}
                          </p>
                          <p className="truncate font-mono text-[10px] text-zinc-400">
                            {formatPlayedAgo(meta.lastPlayedAt)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {visibleSongs.map((entry) =>
                renderSongRow(
                  entry,
                  visibleSongs.map((s) => s.id)
                )
              )}
            </div>
          ) : subTab === 'recent' ? (
            /* Dedicated Recently Played Section */
            <div className="mx-auto max-w-3xl">
              <div
                className={`sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3 backdrop-blur-md ${
                  wallpaperActive ? 'bg-black/45' : 'bg-[#0b0b0e]/95'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                    <History className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-semibold text-white">
                      Recently Played
                    </h2>
                    <p className="font-mono text-xs text-zinc-400">
                      {recentlyPlayedTracks.length}{' '}
                      {recentlyPlayedTracks.length === 1 ? 'track' : 'tracks'} sorted by last played
                    </p>
                  </div>
                </div>

                {recentlyPlayedTracks.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const ids = recentlyPlayedTracks.map((r) => r.entry.id);
                        if (ids.length > 0) onPlayTrack(ids[0], ids);
                      }}
                      className="flex min-h-[36px] items-center gap-1.5 rounded-full bg-amber-500 px-3 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>Play</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const ids = recentlyPlayedTracks.map((r) => r.entry.id);
                        if (ids.length === 0) return;
                        const rnd = ids[Math.floor(Math.random() * ids.length)];
                        onPlayTrack(rnd, ids);
                      }}
                      aria-label="Shuffle recently played"
                      title="Shuffle"
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/35 text-zinc-200 hover:bg-white/15"
                    >
                      <Shuffle className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={onClearRecentlyPlayed}
                      aria-label="Clear recently played history"
                      title="Clear history"
                      className="flex min-h-[36px] items-center gap-1 rounded-full border border-white/15 bg-black/35 px-3 text-xs font-medium text-zinc-300 hover:border-red-500/40 hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Clear</span>
                    </button>
                  </div>
                )}
              </div>

              {recentlyPlayedTracks.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <History className="mx-auto h-10 w-10 text-zinc-600" />
                  <p className="mt-3 text-sm font-medium text-zinc-200">
                    No recently played songs yet
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Play any track in Symphony No. 9 and it will appear here in chronological order.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubTab('songs')}
                    className="mt-4 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                  >
                    Browse All Songs
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {recentlyPlayedTracks.map(({ entry }) =>
                    renderSongRow(
                      entry,
                      recentlyPlayedTracks.map((r) => r.entry.id),
                      true
                    )
                  )}
                </div>
              )}
            </div>
          ) : subTab === 'videos' ? (
            /* Integrated Device Video Files View */
            <div className="mx-auto max-w-3xl">
              <div className="border-b border-white/10 px-4 py-3">
                <h2 className="font-display text-base font-semibold text-white">Device Videos</h2>
                <p className="font-mono text-xs text-zinc-400">
                  {videoEntries.length} {videoEntries.length === 1 ? 'video' : 'videos'} on internal storage
                </p>
              </div>
              {videoEntries.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <Film className="mx-auto h-10 w-10 text-zinc-600" />
                  <p className="mt-3 text-sm text-zinc-300">No video files found in storage.</p>
                  <button
                    type="button"
                    onClick={onOpenPermissions}
                    className="mt-4 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                  >
                    Connect or Sync Folder
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {videoEntries.map((vid) => (
                    <button
                      key={vid.id}
                      type="button"
                      onClick={() => {
                        onPauseAudio();
                        setPlayingVideoEntry(vid);
                      }}
                      className="lightweight-row flex min-h-[64px] w-full items-center gap-3.5 px-4 py-2.5 text-left hover:bg-white/10"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-zinc-900/90 text-amber-400">
                        <Film className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-white">{vid.name}</p>
                        <p className="truncate font-mono text-xs text-zinc-400">
                          {vid.extension.toUpperCase()} · {formatBytes(vid.size)}
                          {vid.folderPath ? ` · ${vid.folderPath}` : ''}
                        </p>
                      </div>
                      <Play className="h-4 w-4 shrink-0 text-amber-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : isInsideSubList ? (
            <div className="flex flex-col">
              <div
                className={`sticky top-0 z-10 border-b border-zinc-800/70 px-4 py-3 backdrop-blur-md ${
                  wallpaperActive ? 'bg-black/45' : 'bg-[#0b0b0e]/95'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={handleBackFromSubList}
                      aria-label="Back"
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-zinc-200 hover:bg-zinc-800"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-lg font-semibold text-white">
                        {currentSubListTitle}
                      </h2>
                      <p className="font-mono text-xs text-zinc-400">
                        {visibleSongs.length} songs · {formatDuration(visibleSongs.reduce((s, e) => s + getMeta(e).duration, 0))}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {selectedSmartGroup && (
                      <button
                        type="button"
                        onClick={() =>
                          onSaveSmartPlaylists([
                            {
                              name: formatSmartPlaylistName(
                                selectedSmartGroup.groupBy,
                                selectedSmartGroup.label
                              ),
                              trackIds: visibleSongs.map((s) => s.id),
                              smartRule: {
                                groupBy: selectedSmartGroup.groupBy,
                                value: selectedSmartGroup.key,
                              },
                            },
                          ])
                        }
                        aria-label={selectedSmartGroupSaved ? 'Sync Smart Playlist' : 'Save Smart Playlist'}
                        className={`flex min-h-[38px] items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium transition-colors ${
                          selectedSmartGroupSaved
                            ? 'border-violet-500/40 bg-violet-500/15 text-violet-300'
                            : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
                        }`}
                      >
                        {selectedSmartGroupSaved ? (
                          <BookmarkCheck className="h-3.5 w-3.5" />
                        ) : (
                          <BookmarkPlus className="h-3.5 w-3.5" />
                        )}
                        <span>{selectedSmartGroupSaved ? 'Saved' : 'Save'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (visibleSongs.length === 0) return;
                        const rnd = visibleSongs[Math.floor(Math.random() * visibleSongs.length)];
                        onPlayTrack(
                          rnd.id,
                          visibleSongs.map((s) => s.id)
                        );
                      }}
                      aria-label="Shuffle play"
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    >
                      <Shuffle className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSortBy((s) => (s === 'title' ? 'recent' : s === 'recent' ? 'plays' : 'title'))
                      }
                      aria-label="Change sort order"
                      title={`Sort: ${sortBy}`}
                      className="flex min-h-[44px] items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
                    >
                      <span>{sortBy === 'title' ? 'A-Z' : sortBy === 'recent' ? 'Newest' : 'Plays'}</span>
                    </button>
                  </div>
                </div>

                {/* Search within list */}
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3">
                  <Search className="h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search in this list..."
                    className="min-h-[40px] w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                      className="text-zinc-400 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="divide-y divide-zinc-900/90">
                {visibleSongs.length === 0 ? (
                  <p className="px-6 py-12 text-center text-sm text-zinc-500">
                    No matching songs in this view.
                  </p>
                ) : (
                  visibleSongs.map((entry) =>
                    renderSongRow(
                      entry,
                      visibleSongs.map((s) => s.id),
                      activeFilter === 'recent-played'
                    )
                  )
                )}
              </div>
            </div>
          ) : subTab === 'library' ? (
            /* Library Home Screen (Matches Screenshot 1 cleanly without hardcoded playlists) */
            <div className="mx-auto max-w-3xl divide-y divide-zinc-900/70">
              <div className="py-1">
                {[
                  {
                    id: 'all' as AudioLibraryFilter,
                    label: 'All songs',
                    count: audioEntries.length,
                    icon: <ListMusic className="h-5 w-5 text-zinc-100" />,
                  },
                  {
                    id: 'favorites' as AudioLibraryFilter,
                    label: 'Favorites',
                    count: audioEntries.filter((e) => getMeta(e).isFavorite).length,
                    icon: <Heart className="h-5 w-5 text-zinc-100" />,
                  },
                  {
                    id: 'recent-added' as AudioLibraryFilter,
                    label: 'Recently added',
                    count: audioEntries.length,
                    icon: <Clock className="h-5 w-5 text-zinc-100" />,
                  },
                  {
                    id: 'recent-played' as AudioLibraryFilter,
                    label: 'Recently played',
                    count: audioEntries.filter((e) => getMeta(e).lastPlayedAt > 0).length,
                    icon: <History className="h-5 w-5 text-zinc-100" />,
                  },
                  {
                    id: 'most-played' as AudioLibraryFilter,
                    label: 'Most played',
                    count: audioEntries.filter((e) => getMeta(e).playCount > 0).length,
                    icon: <Flame className="h-5 w-5 text-zinc-100" />,
                  },
                  {
                    id: 'not-played' as AudioLibraryFilter,
                    label: 'Not played',
                    count: audioEntries.filter((e) => getMeta(e).playCount === 0).length,
                    icon: <Ban className="h-5 w-5 text-zinc-100" />,
                  },
                ].map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setActiveFilter(row.id)}
                    className="flex min-h-[54px] w-full items-center justify-between px-5 py-2.5 text-left hover:bg-zinc-900/60 transition-colors"
                  >
                    <div className="flex items-center gap-5">
                      {row.icon}
                      <span className="text-[16px] font-normal text-zinc-100">{row.label}</span>
                    </div>
                    <span className="font-mono text-xs text-zinc-500">{row.count}</span>
                  </button>
                ))}
              </div>

              {/* Smart Playlists Section (Auto-grouped by Artist, Album, or Genre) */}
              <div className="px-5 py-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-violet-400" />
                    <span className="text-sm font-semibold text-violet-400">Smart Playlists</span>
                    <span className="font-mono text-[11px] text-zinc-500">
                      ({smartGroups.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openSmartGenerator(smartGroupBy)}
                    className="flex min-h-[38px] items-center gap-1.5 rounded-xl bg-violet-600/20 border border-violet-500/40 px-3 text-xs font-semibold text-violet-200 hover:bg-violet-600/30 transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                    <span>Generate Smart Playlists</span>
                  </button>
                </div>

                {/* Group By Selector: Artist | Album | Genre */}
                <div
                  role="group"
                  aria-label="Group Smart Playlists by"
                  className="grid grid-cols-3 gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1"
                >
                  {(
                    [
                      { id: 'artist', label: 'Artist', icon: <User className="h-3.5 w-3.5" /> },
                      { id: 'album', label: 'Album', icon: <Disc3 className="h-3.5 w-3.5" /> },
                      { id: 'genre', label: 'Genre', icon: <Tag className="h-3.5 w-3.5" /> },
                    ] as { id: SmartPlaylistGroupBy; label: string; icon: React.ReactNode }[]
                  ).map((mode) => {
                    const active = smartGroupBy === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setSmartGroupBy(mode.id)}
                        className={`flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors ${
                          active
                            ? 'bg-violet-600 text-white shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {mode.icon}
                        <span>{mode.label}</span>
                      </button>
                    );
                  })}
                </div>

                {smartGroups.length === 0 ? (
                  <p className="py-2 text-xs text-zinc-500">
                    Load audio tracks to automatically group Smart Playlists by {smartGroupBy}.
                  </p>
                ) : (
                  <div className="divide-y divide-zinc-900/90 rounded-xl border border-zinc-800/70 bg-zinc-950/60 overflow-hidden">
                    {smartGroups.slice(0, 8).map((grp) => {
                      const trackIds = grp.entries.map((e) => e.id);
                      return (
                        <div
                          key={`smart-${grp.groupBy}-${grp.key}`}
                          className="flex min-h-[58px] items-center gap-2.5 px-3 py-2 hover:bg-zinc-900/60 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedSmartGroup({
                                groupBy: grp.groupBy,
                                key: grp.key,
                                label: grp.label,
                              })
                            }
                            className="flex min-w-0 flex-1 items-center gap-3 text-left focus:outline-none"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
                              {!ignoreTrackArt && grp.coverUrl ? (
                                <img
                                  src={grp.coverUrl}
                                  alt={grp.label}
                                  referrerPolicy="no-referrer"
                                  className="h-full w-full object-cover"
                                />
                              ) : grp.groupBy === 'artist' ? (
                                <User className="h-4 w-4 text-violet-300" />
                              ) : grp.groupBy === 'album' ? (
                                <Disc3 className="h-4 w-4 text-violet-300" />
                              ) : (
                                <Tag className="h-4 w-4 text-violet-300" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-zinc-100">
                                {grp.label}
                              </p>
                              <p className="truncate font-mono text-[11px] text-zinc-400">
                                {grp.entries.length} {grp.entries.length === 1 ? 'song' : 'songs'}
                                {grp.totalDuration > 0
                                  ? ` · ${formatDuration(grp.totalDuration)}`
                                  : ''}
                              </p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (trackIds.length > 0) {
                                onPlayTrack(trackIds[0], trackIds);
                              }
                            }}
                            aria-label={`Play ${grp.label}`}
                            title="Play Smart Playlist"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600/20 text-violet-300 hover:bg-violet-600 hover:text-white transition-colors"
                          >
                            <Play className="ml-0.5 h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onSaveSmartPlaylists([
                                {
                                  name: formatSmartPlaylistName(grp.groupBy, grp.label),
                                  trackIds,
                                  smartRule: {
                                    groupBy: grp.groupBy,
                                    value: grp.key,
                                  },
                                },
                              ])
                            }
                            aria-label={
                              grp.savedPlaylist
                                ? `Saved ${grp.label}`
                                : `Save ${grp.label} to Your playlists`
                            }
                            title={
                              grp.savedPlaylist ? 'Saved in Your playlists (tap to sync)' : 'Save to Your playlists'
                            }
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
                              grp.savedPlaylist
                                ? 'border-violet-500/40 bg-violet-500/15 text-violet-300'
                                : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
                            }`}
                          >
                            {grp.savedPlaylist ? (
                              <BookmarkCheck className="h-4 w-4" />
                            ) : (
                              <BookmarkPlus className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                    {smartGroups.length > 8 && (
                      <button
                        type="button"
                        onClick={() => openSmartGenerator(smartGroupBy)}
                        className="flex min-h-[42px] w-full items-center justify-center gap-1.5 text-xs font-medium text-violet-300 hover:bg-zinc-900/80"
                      >
                        <span>View & generate all {smartGroups.length} {smartGroupBy} groups</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* User Playlists Section (Includes saved Smart Playlists & manual playlists) */}
              <div className="px-5 py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-violet-400">Your playlists</span>
                  <button
                    type="button"
                    onClick={() => setShowNewPlaylistModal(true)}
                    className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                  >
                    <Plus className="h-3.5 w-3.5 text-violet-400" />
                    <span>New Playlist</span>
                  </button>
                </div>

                {playlists.length === 0 ? (
                  <p className="py-3 text-xs text-zinc-500">
                    No playlists created yet. Tap New Playlist or Generate Smart Playlists above.
                  </p>
                ) : (
                  <div className="divide-y divide-zinc-900">
                    {playlists.map((pl) => {
                      const resolvedCount = resolvePlaylistEntries(pl).length;
                      return (
                        <div key={pl.id} className="flex min-h-[52px] items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedPlaylistId(pl.id)}
                            className="flex min-w-0 flex-1 items-center gap-4 py-2 text-left hover:text-white"
                          >
                            {pl.isSmart ? (
                              <Sparkles className="h-5 w-5 shrink-0 text-violet-400" />
                            ) : (
                              <ListMusic className="h-5 w-5 shrink-0 text-zinc-300" />
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="block truncate text-[15px] text-zinc-100">
                                {pl.name}
                              </span>
                              {pl.isSmart && pl.smartRule && (
                                <span className="block font-mono text-[10px] uppercase tracking-wider text-violet-400">
                                  Smart · {pl.smartRule.groupBy}
                                </span>
                              )}
                            </div>
                            <span className="shrink-0 font-mono text-xs text-zinc-500">
                              {resolvedCount}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeletePlaylist(pl.id)}
                            aria-label={`Delete playlist ${pl.name}`}
                            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full text-zinc-500 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : subTab === 'folders' ? (
            /* Real Folders View from Connected Internal Storage */
            <div className="mx-auto max-w-3xl">
              <div className="border-b border-zinc-800/80 px-5 py-4">
                <h2 className="font-display text-lg font-semibold text-white">Internal Storage</h2>
                <p className="mt-1 font-mono text-xs text-zinc-400">
                  {audioFolders.length} folders · {audioEntries.length} songs · {formatDuration(totalDurationAll)}
                </p>
              </div>
              <div className="divide-y divide-zinc-900">
                {audioFolders.map(([folderName, list]) => (
                  <button
                    key={folderName}
                    type="button"
                    onClick={() => setSelectedFolder(folderName)}
                    className="flex min-h-[58px] w-full items-center justify-between px-5 py-2.5 text-left hover:bg-zinc-900/60"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <Folder className="h-5 w-5 shrink-0 text-zinc-300" />
                      <div className="min-w-0">
                        <p className="truncate text-[15px] text-zinc-100">{folderName}</p>
                        <p className="font-mono text-xs text-zinc-500">{list.length} songs</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
                  </button>
                ))}
              </div>
            </div>
          ) : subTab === 'artists' ? (
            <div className="mx-auto max-w-3xl divide-y divide-zinc-900">
              {artistsList.map(([artist, list]) => (
                <button
                  key={artist}
                  type="button"
                  onClick={() => setSelectedArtist(artist)}
                  className="flex min-h-[58px] w-full items-center justify-between px-5 py-2.5 text-left hover:bg-zinc-900/60"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <User className="h-5 w-5 shrink-0 text-zinc-400" />
                    <div className="min-w-0">
                      <p className="truncate text-[15px] text-zinc-100">{artist}</p>
                      <p className="font-mono text-xs text-zinc-500">{list.length} songs</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
                </button>
              ))}
            </div>
          ) : subTab === 'albums' ? (
            <div className="mx-auto max-w-3xl divide-y divide-zinc-900">
              {albumsList.map(([album, list]) => (
                <button
                  key={album}
                  type="button"
                  onClick={() => setSelectedAlbum(album)}
                  className="flex min-h-[58px] w-full items-center justify-between px-5 py-2.5 text-left hover:bg-zinc-900/60"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <Disc3 className="h-5 w-5 shrink-0 text-zinc-400" />
                    <div className="min-w-0">
                      <p className="truncate text-[15px] text-zinc-100">{album}</p>
                      <p className="font-mono text-xs text-zinc-500">{list.length} songs</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
                </button>
              ))}
            </div>
          ) : subTab === 'search' ? (
            <div className="mx-auto max-w-3xl">
              <div
                className={`sticky top-0 z-10 border-b border-zinc-800/70 px-4 py-3 backdrop-blur-md ${
                  wallpaperActive ? 'bg-black/45' : 'bg-[#0b0b0e]/95'
                }`}
              >
                <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3">
                  <Search className="h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search songs, artists, albums, genres, folders..."
                    autoFocus
                    className="min-h-[44px] w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                      className="text-zinc-400 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="divide-y divide-zinc-900">
                {visibleSongs.map((e) =>
                  renderSongRow(
                    e,
                    visibleSongs.map((s) => s.id)
                  )
                )}
              </div>
            </div>
          ) : subTab === 'queue' ? (
            <div className="mx-auto max-w-3xl">
              <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-3.5">
                <div>
                  <h2 className="font-display text-lg font-semibold text-white">Playing Queue</h2>
                  <p className="font-mono text-xs text-zinc-400">{queueIds.length} tracks</p>
                </div>
                {queueIds.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearQueue}
                    className="min-h-[40px] rounded-lg px-3 text-xs font-medium text-zinc-400 hover:bg-zinc-900 hover:text-red-400"
                  >
                    Clear Queue
                  </button>
                )}
              </div>
              {queueIds.length === 0 ? (
                <p className="px-6 py-12 text-center text-sm text-zinc-500">
                  Queue is empty. Tap any song to start playing.
                </p>
              ) : (
                <div className="divide-y divide-zinc-900">
                  {queueIds.map((id, idx) => {
                    const entry = entryMap[id];
                    if (!entry) return null;
                    const meta = getMeta(entry);
                    const isCurrent = id === currentTrackId;
                    return (
                      <div
                        key={`${id}-${idx}`}
                        className={`flex min-h-[60px] items-center gap-3 px-4 py-2 ${
                          isCurrent ? 'bg-violet-950/35' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onPlayTrack(id)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-zinc-900 flex items-center justify-center">
                            {!ignoreTrackArt && meta.coverUrl ? (
                              <img
                                src={meta.coverUrl}
                                alt={meta.title}
                                referrerPolicy="no-referrer"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Music className="h-4 w-4 text-zinc-600" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`truncate text-sm font-medium ${
                                isCurrent ? 'text-violet-300' : 'text-zinc-100'
                              }`}
                            >
                              {meta.title}
                            </p>
                            <p className="truncate text-xs text-zinc-400">{meta.artist}</p>
                          </div>
                        </button>

                        {/* Steady Up/Down Queue Reorder (Zero accidental vertical drag drift) */}
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => onMoveQueueItem(idx, idx - 1)}
                            aria-label="Move up"
                            className="flex h-10 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-25"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === queueIds.length - 1}
                            onClick={() => onMoveQueueItem(idx, idx + 1)}
                            aria-label="Move down"
                            className="flex h-10 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-25"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveFromQueue(idx)}
                            aria-label="Remove from queue"
                            className="flex h-10 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-red-400"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Floating Mini-Player Bar (Matches Screenshot 1; tap to open Full-Bleed Art Player) */}
      {currentEntry && currentMeta && subTab !== 'playing' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-16 z-30 px-3 lg:bottom-4 lg:left-64">
          <div className="pointer-events-auto mx-auto flex max-w-3xl items-center justify-between gap-2.5 rounded-2xl border border-white/15 bg-zinc-900/85 px-3 py-2 text-white shadow-2xl backdrop-blur-xl">
            <button
              type="button"
              onClick={() => {
                setShowArtControls(true);
                setSubTab('playing');
              }}
              className="flex min-w-0 flex-1 items-center gap-3 text-left focus:outline-none"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-zinc-800">
                {!ignoreTrackArt && currentMeta.coverUrl ? (
                  <img
                    src={currentMeta.coverUrl}
                    alt={currentMeta.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Music className="h-5 w-5 text-zinc-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{currentMeta.title}</p>
                <p className="truncate text-xs text-zinc-300/80">{currentMeta.artist}</p>
              </div>
            </button>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={onCycleRepeat}
                aria-label={`Repeat: ${repeatMode}`}
                className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                  repeatMode !== 'off' ? 'text-amber-400' : 'text-zinc-300 hover:bg-white/10'
                }`}
              >
                <Repeat className="h-4 w-4" />
                {repeatMode === 'one' && (
                  <span className="absolute right-1.5 top-1.5 font-mono text-[9px] font-bold text-amber-300">
                    1
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={onTogglePlayPause}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/15 text-white hover:bg-white/25 transition-colors"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="ml-0.5 h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Bleed Edge-to-Edge Song Art Now Playing View (Screenshot 2 Style + Touch-to-Toggle Controls) */}
      {subTab === 'playing' && (
        <div className="fixed inset-0 z-40 flex flex-col bg-[#070709] text-white">
          {/* Top Bar with Drag Pill & Collapse Chevron */}
          <div className="shrink-0 bg-[#070709] px-3 pt-2 pb-2">
            <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-zinc-700" />
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSubTab('songs')}
                aria-label="Collapse now playing"
                className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-100 hover:bg-zinc-900"
              >
                <ChevronDown className="h-7 w-7" />
              </button>
              <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                Symphony No. 9
              </span>
              <button
                type="button"
                onClick={() => setShowSleepTimerModal(true)}
                aria-label={
                  sleepTimerRemainingSec !== null
                    ? `Sleep timer ${formatCountdown(sleepTimerRemainingSec)}`
                    : 'Sleep timer'
                }
                title="Sleep Timer"
                className={`flex h-10 min-w-[44px] items-center justify-center gap-1.5 rounded-full px-2.5 transition-colors ${
                  sleepTimerRemainingSec !== null
                    ? 'border border-amber-500/40 bg-amber-500/15 text-amber-300'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                }`}
              >
                <Timer className="h-4.5 w-4.5 shrink-0" />
                {sleepTimerRemainingSec !== null && (
                  <span className="font-mono text-[11px] font-semibold tabular-nums">
                    {formatCountdown(sleepTimerRemainingSec)}
                  </span>
                )}
              </button>
            </div>
          </div>

          {currentEntry && currentMeta ? (
            <>
              {/* Full-Bleed Song Art Stage — Tap anywhere to toggle Name, Scrubber, Previous/Play/Next */}
              <div
                role="button"
                tabIndex={0}
                aria-label={showArtControls ? 'Hide playback controls on artwork' : 'Show playback controls on artwork'}
                onClick={() => setShowArtControls((v) => !v)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowArtControls((v) => !v);
                  }
                }}
                className="relative flex flex-1 w-full cursor-pointer select-none items-center justify-center overflow-hidden bg-zinc-950 focus:outline-none"
              >
                {!ignoreTrackArt && currentMeta.coverUrl ? (
                  <img
                    src={currentMeta.coverUrl}
                    alt={currentMeta.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black">
                    <Music className="h-24 w-24 text-zinc-700" />
                    {ignoreTrackArt && (
                      <span className="mt-3 font-mono text-xs text-zinc-500">
                        Minimal mode · Art hidden by settings
                      </span>
                    )}
                  </div>
                )}

                {/* Touch-Toggled Overlay: Song Name + Seek Scrubber + Previous / Pause / Next */}
                <div
                  className={`absolute inset-0 flex flex-col justify-end bg-gradient-to-b from-black/15 via-black/35 to-black/75 px-5 pb-10 transition-opacity duration-300 ${
                    showArtControls ? 'opacity-100' : 'pointer-events-none opacity-0'
                  }`}
                >
                  <div className="mx-auto w-full max-w-lg space-y-6">
                    {/* Song Title (disappears/appears on touch) */}
                    <div>
                      <h2 className="text-2xl font-bold leading-snug text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] sm:text-3xl">
                        {currentMeta.title}
                      </h2>
                      {!ignoreTrackArt && currentMeta.artist !== '<unknown>' && (
                        <p className="mt-1 truncate text-sm font-medium text-white/85 drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
                          {currentMeta.artist}
                        </p>
                      )}
                    </div>

                    {/* Seek Scrubber (stopPropagation so dragging doesn't collapse overlay) */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="space-y-1"
                    >
                      <SteadyScrubber
                        value={currentTime}
                        min={0}
                        max={duration || 1}
                        step={0.1}
                        ariaLabel="Seek audio position"
                        onChange={onSeek}
                      />
                      <div className="flex justify-between font-mono text-xs font-medium text-white/85 drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
                        <span>{formatDuration(currentTime)}</span>
                        <span>{formatDuration(duration)}</span>
                      </div>
                    </div>

                    {/* Previous | Pause/Play | Next Controls */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center justify-around pt-1"
                    >
                      <button
                        type="button"
                        onClick={onPrevTrack}
                        aria-label="Previous track"
                        className="flex h-16 w-16 items-center justify-center rounded-full text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] transition-transform active:scale-90 hover:bg-black/25"
                      >
                        <SkipBack className="h-9 w-9 fill-white" />
                      </button>

                      <button
                        type="button"
                        onClick={onTogglePlayPause}
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                        className="flex h-20 w-20 items-center justify-center rounded-full text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)] transition-transform active:scale-90 hover:bg-black/25"
                      >
                        {isPlaying ? (
                          <Pause className="h-12 w-12 fill-white" />
                        ) : (
                          <Play className="ml-1 h-12 w-12 fill-white" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={onNextTrack}
                        aria-label="Next track"
                        className="flex h-16 w-16 items-center justify-center rounded-full text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] transition-transform active:scale-90 hover:bg-black/25"
                      >
                        <SkipForward className="h-9 w-9 fill-white" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Minimal Bottom Bar (Matches Screenshot 2: Sliders Settings | Center Pill | Queue) */}
              <div className="flex h-16 shrink-0 items-center justify-between bg-[#070709] px-6">
                <button
                  type="button"
                  onClick={() => setShowPlayerSettings(true)}
                  aria-label="Player settings"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-200 hover:bg-zinc-900"
                >
                  <SlidersHorizontal className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={() => onToggleFavorite(currentEntry.id)}
                  className="flex min-h-[40px] items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/90 px-5 text-sm font-medium text-zinc-100 hover:bg-zinc-800"
                >
                  <Heart
                    className={`h-4 w-4 ${
                      currentMeta.isFavorite ? 'fill-rose-500 text-rose-500' : 'text-zinc-300'
                    }`}
                  />
                  <span>{currentMeta.isFavorite ? 'Liked' : 'Favorite'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowNowPlayingQueue(true)}
                  aria-label="Playing queue"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-200 hover:bg-zinc-900"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <Music className="h-14 w-14 text-zinc-700" />
              <p className="mt-3 text-sm text-zinc-400">
                No track playing. Pick any song to view it here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Track 3-Dot Action Sheet */}
      {actionTrack && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center sm:p-4"
          onClick={() => setActionTrack(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border border-zinc-800 bg-[#141418] p-4 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-3 border-b border-zinc-800 pb-3">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-zinc-900 flex items-center justify-center">
                {!ignoreTrackArt && getMeta(actionTrack).coverUrl ? (
                  <img
                    src={getMeta(actionTrack).coverUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Music className="h-5 w-5 text-zinc-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {getMeta(actionTrack).title}
                </p>
                <p className="truncate font-mono text-xs text-zinc-400">
                  {actionTrack.extension.toUpperCase()} · {formatBytes(actionTrack.size)}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  onAddToQueue(actionTrack.id, true);
                  setActionTrack(null);
                }}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-sm text-zinc-100 hover:bg-zinc-800"
              >
                <Play className="h-4 w-4 text-violet-400" />
                <span>Play next</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onAddToQueue(actionTrack.id, false);
                  setActionTrack(null);
                }}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-sm text-zinc-100 hover:bg-zinc-800"
              >
                <ListMusic className="h-4 w-4 text-zinc-400" />
                <span>Add to queue</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenArtworkEditor(actionTrack);
                  setActionTrack(null);
                }}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-sm text-zinc-100 hover:bg-zinc-800"
              >
                <Edit3 className="h-4 w-4 text-violet-400" />
                <span>Modify artwork & tags (on phone)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onToggleFavorite(actionTrack.id);
                  setActionTrack(null);
                }}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-sm text-zinc-100 hover:bg-zinc-800"
              >
                <Heart
                  className={`h-4 w-4 ${
                    getMeta(actionTrack).isFavorite ? 'fill-rose-500 text-rose-500' : 'text-zinc-400'
                  }`}
                />
                <span>
                  {getMeta(actionTrack).isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPlaylistPickerTrackId(actionTrack.id);
                  setActionTrack(null);
                }}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-sm text-zinc-100 hover:bg-zinc-800"
              >
                <Plus className="h-4 w-4 text-zinc-400" />
                <span>Add to playlist</span>
              </button>

              {selectedPlaylistId &&
                !playlists.find((p) => p.id === selectedPlaylistId)?.isSmart && (
                  <button
                    type="button"
                    onClick={() => {
                      onRemoveTrackFromPlaylist(selectedPlaylistId, actionTrack.id);
                      setActionTrack(null);
                    }}
                    className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-sm text-amber-300 hover:bg-zinc-800"
                  >
                    <X className="h-4 w-4" />
                    <span>Remove from this playlist</span>
                  </button>
                )}

              <button
                type="button"
                onClick={() => {
                  const target = actionTrack;
                  setActionTrack(null);
                  void onDeleteFile(target);
                }}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-sm text-red-400 hover:bg-red-950/40"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete file</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Playlist Modal */}
      {showNewPlaylistModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowNewPlaylistModal(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (!newPlaylistName.trim()) return;
              onCreatePlaylist(newPlaylistName.trim());
              setNewPlaylistName('');
              setShowNewPlaylistModal(false);
            }}
            className="w-full max-w-sm space-y-4 rounded-2xl border border-zinc-800 bg-[#141418] p-5"
          >
            <h3 className="font-display text-base font-semibold text-white">New Playlist</h3>
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Playlist name"
              autoFocus
              className="min-h-[44px] w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-white focus:border-violet-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewPlaylistModal(false)}
                className="min-h-[44px] rounded-xl px-4 text-sm text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pick Playlist Modal */}
      {playlistPickerTrackId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPlaylistPickerTrackId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-3 rounded-2xl border border-zinc-800 bg-[#141418] p-5"
          >
            <h3 className="font-display text-base font-semibold text-white">Add to playlist</h3>
            {playlists.filter((p) => !p.isSmart).length === 0 ? (
              <p className="text-xs text-zinc-400">
                No manual playlists yet. Create one first in Library.
              </p>
            ) : (
              <div className="max-h-60 space-y-1 overflow-y-auto steady-scroll">
                {playlists
                  .filter((p) => !p.isSmart)
                  .map((pl) => (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => {
                        onAddTrackToPlaylist(pl.id, playlistPickerTrackId);
                        setPlaylistPickerTrackId(null);
                      }}
                      className="flex min-h-[44px] w-full items-center justify-between rounded-xl px-3 text-sm text-zinc-100 hover:bg-zinc-800"
                    >
                      <span className="truncate">{pl.name}</span>
                      <span className="font-mono text-xs text-zinc-500">{pl.trackIds.length}</span>
                    </button>
                  ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setPlaylistPickerTrackId(null)}
              className="min-h-[44px] w-full rounded-xl border border-zinc-800 text-sm text-zinc-300 hover:bg-zinc-900"
            >
              Close
            </button>
          </div>
        </div>
      )}
      {/* Generate Smart Playlists Modal */}
      {showSmartGeneratorModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center sm:p-4"
          onClick={() => setShowSmartGeneratorModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Generate Smart Playlists"
            className="flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl border border-zinc-800 bg-[#141418] text-zinc-100 sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-400" />
                <h3 className="font-display text-base font-semibold text-white">
                  Generate Smart Playlists
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSmartGeneratorModal(false)}
                aria-label="Close"
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="steady-scroll flex-1 space-y-4 overflow-y-auto p-5">
              {/* Grouping Dimension */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-zinc-400">
                  Group tracks automatically by
                </p>
                <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
                  {(
                    [
                      { id: 'artist', label: 'Artist', icon: <User className="h-3.5 w-3.5" /> },
                      { id: 'album', label: 'Album', icon: <Disc3 className="h-3.5 w-3.5" /> },
                      { id: 'genre', label: 'Genre', icon: <Tag className="h-3.5 w-3.5" /> },
                    ] as { id: SmartPlaylistGroupBy; label: string; icon: React.ReactNode }[]
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setGeneratorGroupBy(opt.id);
                        setGeneratorDeselectedKeys({});
                      }}
                      className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors ${
                        generatorGroupBy === opt.id
                          ? 'bg-violet-600 text-white'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter Rules */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/70 px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setGeneratorMinTracks(1)}
                    className={`min-h-[32px] rounded-lg px-2.5 text-xs font-medium ${
                      generatorMinTracks === 1
                        ? 'bg-zinc-100 text-zinc-950'
                        : 'border border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    1+ tracks
                  </button>
                  <button
                    type="button"
                    onClick={() => setGeneratorMinTracks(2)}
                    className={`min-h-[32px] rounded-lg px-2.5 text-xs font-medium ${
                      generatorMinTracks === 2
                        ? 'bg-zinc-100 text-zinc-950'
                        : 'border border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    2+ tracks
                  </button>
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={generatorIncludeUnknown}
                    onChange={(e) => setGeneratorIncludeUnknown(e.target.checked)}
                    className="h-4 w-4 accent-violet-500"
                  />
                  <span>Include unknown / untagged</span>
                </label>
              </div>

              {/* Preview List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-400">
                    Matching groups ({generatorCandidateGroups.length})
                  </span>
                  {generatorCandidateGroups.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = generatorCandidateGroups.every(
                          (g) => !generatorDeselectedKeys[g.key]
                        );
                        if (allSelected) {
                          const map: Record<string, boolean> = {};
                          for (const g of generatorCandidateGroups) map[g.key] = true;
                          setGeneratorDeselectedKeys(map);
                        } else {
                          setGeneratorDeselectedKeys({});
                        }
                      }}
                      className="text-xs font-medium text-violet-400 hover:text-violet-300"
                    >
                      {generatorCandidateGroups.every((g) => !generatorDeselectedKeys[g.key])
                        ? 'Deselect all'
                        : 'Select all'}
                    </button>
                  )}
                </div>

                {generatorCandidateGroups.length === 0 ? (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-400">
                    {generatorGroupBy === 'genre' && !generatorIncludeUnknown
                      ? 'No genre tags found in your track metadata yet. Enable "Include unknown / untagged" above or assign genres via a track’s 3-dot menu → Modify artwork & tags.'
                      : 'No groups match the current filter rules. Try switching to 1+ tracks or enabling unknown/untagged tracks.'}
                  </div>
                ) : (
                  <div className="max-h-64 divide-y divide-zinc-900 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 steady-scroll">
                    {generatorCandidateGroups.map((grp) => {
                      const checked = !generatorDeselectedKeys[grp.key];
                      return (
                        <button
                          key={`gen-${grp.groupBy}-${grp.key}`}
                          type="button"
                          onClick={() =>
                            setGeneratorDeselectedKeys((prev) => ({
                              ...prev,
                              [grp.key]: checked,
                            }))
                          }
                          className="flex min-h-[54px] w-full items-center gap-3 px-3 py-2 text-left hover:bg-zinc-900/70"
                        >
                          <div
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                              checked
                                ? 'border-violet-500 bg-violet-600 text-white'
                                : 'border-zinc-700 bg-zinc-900'
                            }`}
                          >
                            {checked && <Check className="h-3.5 w-3.5" />}
                          </div>

                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
                            {!ignoreTrackArt && grp.coverUrl ? (
                              <img
                                src={grp.coverUrl}
                                alt={grp.label}
                                referrerPolicy="no-referrer"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Music className="h-4 w-4 text-zinc-500" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-zinc-100">
                              {formatSmartPlaylistName(grp.groupBy, grp.label)}
                            </p>
                            <p className="truncate font-mono text-[11px] text-zinc-500">
                              {grp.entries.length} {grp.entries.length === 1 ? 'track' : 'tracks'}
                              {grp.totalDuration > 0
                                ? ` · ${formatDuration(grp.totalDuration)}`
                                : ''}
                            </p>
                          </div>

                          {grp.savedPlaylist && (
                            <span className="shrink-0 rounded-md bg-violet-500/15 px-2 py-0.5 font-mono text-[10px] text-violet-300">
                              Sync
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-5 py-3.5">
              <button
                type="button"
                onClick={() => setShowSmartGeneratorModal(false)}
                className="min-h-[44px] rounded-xl px-4 text-sm text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  generatorCandidateGroups.filter((g) => !generatorDeselectedKeys[g.key]).length === 0
                }
                onClick={() => {
                  const chosen = generatorCandidateGroups.filter(
                    (g) => !generatorDeselectedKeys[g.key]
                  );
                  if (chosen.length === 0) return;
                  onSaveSmartPlaylists(
                    chosen.map((g) => ({
                      name: formatSmartPlaylistName(g.groupBy, g.label),
                      trackIds: g.entries.map((e) => e.id),
                      smartRule: {
                        groupBy: g.groupBy,
                        value: g.key,
                      },
                    }))
                  );
                  setSmartGroupBy(generatorGroupBy);
                  setShowSmartGeneratorModal(false);
                }}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" />
                <span>
                  Generate (
                  {generatorCandidateGroups.filter((g) => !generatorDeselectedKeys[g.key]).length})
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Player Settings Sheet (Ignores Song Art, Keeps Playback Controls & Tools Separate) */}
      {showPlayerSettings && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center sm:p-4"
          onClick={() => setShowPlayerSettings(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Player settings"
            className="max-h-[88dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-3xl border border-zinc-800 bg-[#141418] p-5 text-zinc-100 sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-amber-400" />
                <h3 className="font-display text-base font-semibold text-white">Player Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPlayerSettings(false)}
                aria-label="Close settings"
                className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Ignore Song Art Toggle */}
            <button
              type="button"
              onClick={toggleIgnoreTrackArt}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-3 text-left hover:bg-zinc-900"
            >
              <div className="flex min-w-0 items-center gap-3">
                <EyeOff className="h-4 w-4 shrink-0 text-amber-400" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">Ignore Song Art</p>
                  <p className="text-[11px] text-zinc-400">
                    Hide embedded & custom album covers across player views
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                  ignoreTrackArt ? 'bg-amber-500 justify-end' : 'bg-zinc-700 justify-start'
                }`}
              >
                <span className="h-5 w-5 rounded-full bg-white shadow" />
              </span>
            </button>

            {/* Playback Volume, Shuffle, Repeat */}
            <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3.5">
              <div className="flex items-center gap-3">
                <Volume2 className="h-4 w-4 shrink-0 text-zinc-400" />
                <SteadyScrubber
                  value={volume}
                  min={0}
                  max={1}
                  step={0.01}
                  ariaLabel="Volume"
                  onChange={onChangeVolume}
                />
                <span className="w-10 text-right font-mono text-xs text-zinc-400">
                  {Math.round(volume * 100)}%
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onToggleShuffle}
                  className={`flex min-h-[42px] items-center justify-center gap-2 rounded-xl border text-xs font-medium transition-colors ${
                    shuffle
                      ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <Shuffle className="h-4 w-4" />
                  <span>Shuffle: {shuffle ? 'On' : 'Off'}</span>
                </button>

                <button
                  type="button"
                  onClick={onCycleRepeat}
                  className={`flex min-h-[42px] items-center justify-center gap-2 rounded-xl border text-xs font-medium transition-colors ${
                    repeatMode !== 'off'
                      ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <Repeat className="h-4 w-4" />
                  <span>
                    Repeat: {repeatMode === 'off' ? 'Off' : repeatMode === 'all' ? 'All' : 'One'}
                  </span>
                </button>
              </div>
            </div>

            {/* Track & Storage Actions */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setShowPlayerSettings(false);
                  setShowSleepTimerModal(true);
                }}
                className="flex min-h-[46px] w-full items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-zinc-100 hover:bg-zinc-900"
              >
                <span className="flex items-center gap-3">
                  <Timer className="h-4 w-4 text-amber-400" />
                  <span>Sleep Timer</span>
                </span>
                <span
                  className={`font-mono text-xs ${
                    sleepTimerRemainingSec !== null ? 'font-semibold text-amber-300' : 'text-zinc-500'
                  }`}
                >
                  {sleepTimerRemainingSec !== null
                    ? formatCountdown(sleepTimerRemainingSec)
                    : 'Off'}
                </span>
              </button>

              {currentEntry && (
                <button
                  type="button"
                  onClick={() => {
                    setShowPlayerSettings(false);
                    onOpenArtworkEditor(currentEntry);
                  }}
                  className="flex min-h-[46px] w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-zinc-100 hover:bg-zinc-900"
                >
                  <Edit3 className="h-4 w-4 text-amber-400" />
                  <span>Modify Audio Artwork & Tags</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowPlayerSettings(false);
                  onOpenWorkspace('wallpapers');
                }}
                className="flex min-h-[46px] w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-zinc-100 hover:bg-zinc-900"
              >
                <Wallpaper className="h-4 w-4 text-sky-400" />
                <span>4K / GIF Wallpapers</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPlayerSettings(false);
                  onOpenPermissions();
                }}
                className="flex min-h-[46px] w-full items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-left text-sm text-zinc-100 hover:bg-zinc-900"
              >
                <span className="flex items-center gap-3">
                  <FolderOpen className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>
                    <span className="block font-medium text-zinc-100">Storage &amp; Permissions</span>
                    <span className="block font-mono text-[10px] uppercase tracking-wider text-amber-300/90">
                      THE RECONING OF ALL THINGS
                    </span>
                  </span>
                </span>
                <span className="font-mono text-[11px] text-zinc-400">
                  {hasLiveFolder ? 'Live' : 'Setup'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPlayerSettings(false);
                  onOpenGestureSecurity();
                }}
                className="flex min-h-[46px] w-full items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-left text-sm text-zinc-100 hover:bg-zinc-900"
              >
                <span className="flex items-center gap-3">
                  {gestureLockEnabled ? (
                    <Lock className="h-4 w-4 shrink-0 text-amber-300" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 shrink-0 text-amber-300" />
                  )}
                  <span>
                    <span className="block font-medium text-zinc-100">
                      Gesture Lock &amp; Folder Vault
                    </span>
                    <span className="block text-[11px] text-zinc-400">
                      Protect PDF reader, sensitive folders &amp; export HTML
                    </span>
                  </span>
                </span>
                <span className="font-mono text-[11px] text-amber-300">
                  {gestureLockEnabled ? 'On' : 'Off'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPlayerSettings(false);
                  onExportStandaloneHtml();
                }}
                className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl border border-cyan-500/35 bg-cyan-950/25 px-3.5 text-left text-sm text-zinc-100 hover:bg-cyan-950/40"
              >
                <span className="flex items-center gap-3">
                  <FileCode2 className="h-4 w-4 shrink-0 text-cyan-300" />
                  <span>
                    <span className="block font-medium text-white">
                      Download Offline HTML
                    </span>
                    <span className="block text-[11px] text-cyan-200/80">
                      Save self-contained symphony-no-9.html to your device
                    </span>
                  </span>
                </span>
                <Download className="h-4 w-4 shrink-0 text-cyan-300" />
              </button>

              <PWAInstallButton variant="row" />
            </div>
          </div>
        </div>
      )}

      {/* Saved Links Sheet (Accessible comfortably from player without leaving audio) */}
      {showLinksSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center sm:p-4"
          onClick={() => setShowLinksSheet(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Saved Links"
            className="flex max-h-[88dvh] w-full max-w-2xl flex-col rounded-t-3xl border border-zinc-800 bg-[#0d0d11] text-zinc-100 sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-sky-400" />
                <h3 className="font-display text-base font-semibold text-white">Saved Links</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLinksSheet(false)}
                aria-label="Close links"
                className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="steady-scroll flex-1 overflow-y-auto">
              <PdfLinksPanel
                links={savedLinks}
                pdfEntries={pdfEntries}
                onSaveLink={onSaveLink}
                onDeleteLink={onDeleteLink}
                onOpenPdf={(pdf) => {
                  setShowLinksSheet(false);
                  onOpenPdf(pdf);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Playing Queue Drawer inside Now Playing */}
      {showNowPlayingQueue && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center sm:p-4"
          onClick={() => setShowNowPlayingQueue(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80dvh] w-full max-w-lg flex-col rounded-t-3xl border border-zinc-800 bg-[#141418] text-zinc-100 sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
              <div>
                <h3 className="font-display text-base font-semibold text-white">Playing Queue</h3>
                <p className="font-mono text-xs text-zinc-400">{queueIds.length} tracks</p>
              </div>
              <div className="flex items-center gap-2">
                {queueIds.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearQueue}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-red-400"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowNowPlayingQueue(false)}
                  aria-label="Close queue"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="steady-scroll flex-1 divide-y divide-zinc-900 overflow-y-auto">
              {queueIds.length === 0 ? (
                <p className="px-6 py-12 text-center text-sm text-zinc-500">Queue is empty.</p>
              ) : (
                queueIds.map((id, idx) => {
                  const entry = entryMap[id];
                  if (!entry) return null;
                  const meta = getMeta(entry);
                  const isCurrent = id === currentTrackId;
                  return (
                    <div
                      key={`npq-${id}-${idx}`}
                      className={`flex min-h-[56px] items-center gap-3 px-4 py-2 ${
                        isCurrent ? 'bg-amber-500/15' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onPlayTrack(id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-900">
                          {!ignoreTrackArt && meta.coverUrl ? (
                            <img
                              src={meta.coverUrl}
                              alt={meta.title}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Music className="h-4 w-4 text-zinc-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate text-sm font-medium ${
                              isCurrent ? 'text-amber-300' : 'text-zinc-100'
                            }`}
                          >
                            {meta.title}
                          </p>
                          <p className="truncate text-xs text-zinc-400">{meta.artist}</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveFromQueue(idx)}
                        aria-label="Remove from queue"
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-red-400"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inline Video Player Modal */}
      {playingVideoEntry && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white"
          role="dialog"
          aria-modal="true"
          aria-label={playingVideoEntry.name}
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <Film className="h-4 w-4 shrink-0 text-amber-400" />
              <span className="truncate text-sm font-medium">{playingVideoEntry.name}</span>
            </div>
            <button
              type="button"
              onClick={() => setPlayingVideoEntry(null)}
              aria-label="Close video player"
              className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center p-4">
            {playingVideoUrl ? (
              <video
                src={playingVideoUrl}
                controls
                autoPlay
                playsInline
                className="max-h-full max-w-full rounded-xl shadow-2xl"
              />
            ) : (
              <p className="text-sm text-zinc-400">Loading video...</p>
            )}
          </div>
        </div>
      )}
      {/* Sleep Timer Modal */}
      {showSleepTimerModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center sm:p-4"
          onClick={() => setShowSleepTimerModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Sleep Timer"
            className="w-full max-w-md space-y-4 rounded-t-3xl border border-zinc-800 bg-[#141418] p-5 text-zinc-100 sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-amber-400" />
                <h3 className="font-display text-base font-semibold text-white">Sleep Timer</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSleepTimerModal(false)}
                aria-label="Close sleep timer"
                className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {sleepTimerRemainingSec !== null ? (
              <div className="space-y-3 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-center">
                <p className="font-mono text-[11px] uppercase tracking-wider text-amber-300">
                  Pausing playback in
                </p>
                <p className="font-mono text-4xl font-bold tabular-nums text-white">
                  {formatCountdown(sleepTimerRemainingSec)}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onExtendSleepTimer(5)}
                    className="min-h-[42px] rounded-xl border border-amber-500/40 bg-amber-500/20 px-3 text-xs font-semibold text-amber-200 hover:bg-amber-500/30"
                  >
                    +5 min
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onCancelSleepTimer();
                      setShowSleepTimerModal(false);
                    }}
                    className="min-h-[42px] rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-red-300"
                  >
                    Cancel Timer
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-400">
                Choose how long to play before Symphony No. 9 automatically pauses.
              </p>
            )}

            <div>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                Quick Presets
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 30, 45, 60, 90, 120].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      onStartSleepTimer(mins);
                      setShowSleepTimerModal(false);
                    }}
                    className="min-h-[44px] rounded-xl border border-zinc-800 bg-zinc-950 px-2 font-mono text-xs font-medium text-zinc-200 transition-colors hover:border-amber-500/50 hover:bg-amber-500/15 hover:text-amber-300"
                  >
                    {mins >= 60 ? `${mins / 60 === 1.5 ? '1.5h' : `${mins / 60}h`}` : `${mins}m`}
                  </button>
                ))}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const parsed = parseInt(customSleepMinutes, 10);
                if (!Number.isFinite(parsed) || parsed <= 0) return;
                onStartSleepTimer(parsed);
                setShowSleepTimerModal(false);
              }}
              className="space-y-2 border-t border-zinc-800 pt-3"
            >
              <label
                htmlFor="custom-sleep-minutes"
                className="block font-mono text-[11px] uppercase tracking-wider text-zinc-500"
              >
                Custom Duration (minutes)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="custom-sleep-minutes"
                  type="number"
                  min={1}
                  max={480}
                  value={customSleepMinutes}
                  onChange={(e) => setCustomSleepMinutes(e.target.value)}
                  className="min-h-[44px] flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 font-mono text-sm text-white outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl bg-amber-500 px-4 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
                >
                  Start Timer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
