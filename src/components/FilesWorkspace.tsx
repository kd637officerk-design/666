import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Edit2,
  Eye,
  EyeOff,
  File as FileIcon,
  FileText,
  Film,
  Folder,
  FolderLock,
  FolderPlus,
  HardDrive,
  Image as ImageIcon,
  Layers,
  Lock,
  MoreVertical,
  Music,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Unlock,
  Upload,
  Wallpaper,
  X,
} from 'lucide-react';
import { DeviceFileEntry, FileCategory, PdfDocState, TrackMetadata } from '../types';
import { formatBytes, resolveEntryFile } from '../lib/fileSystem';
import { isEntryInLockedFolder, isFolderOrAncestorLocked } from '../lib/gestureSecurity';
import { formatExactClockTime } from '../lib/pdfTime';

interface FilesWorkspaceProps {
  allEntries: DeviceFileEntry[];
  folders: string[];
  trackMetaMap: Record<string, TrackMetadata>;
  pdfStates: Record<string, PdfDocState>;
  hasLiveFolder: boolean;
  linkedFolderName: string | null;
  realTimeSyncEnabled: boolean;
  syncing: boolean;
  onOpenPermissions: () => void;
  onManualSync: () => Promise<void>;
  onCreateFolder: (parentPath: string, name: string) => Promise<void>;
  onUploadToFolder: (folderPath: string, files: FileList) => Promise<void>;
  onRenameFile: (entry: DeviceFileEntry, newName: string) => Promise<void>;
  onDeleteFile: (entry: DeviceFileEntry) => Promise<void>;
  onOpenAudio: (entry: DeviceFileEntry) => void;
  onOpenPdf: (entry: DeviceFileEntry) => void;
  onSetAsWallpaper: (entry: DeviceFileEntry) => Promise<void>;
  onAssignImageToTrack: (imgEntry: DeviceFileEntry) => void;
  wallpaperActive: boolean;
  gestureLockEnabled: boolean;
  lockSensitiveFolders: boolean;
  lockedFolderPaths: string[];
  isSecurityUnlocked: boolean;
  onRequestUnlockFolder: (folderPath: string, onUnlocked: () => void) => void;
  onToggleFolderSensitive: (folderPath: string) => void;
  onOpenSecuritySettings: () => void;
  onLockNow: () => void;
}

export const FilesWorkspace: React.FC<FilesWorkspaceProps> = ({
  allEntries,
  folders,
  trackMetaMap,
  pdfStates,
  hasLiveFolder,
  linkedFolderName,
  realTimeSyncEnabled,
  syncing,
  onOpenPermissions,
  onManualSync,
  onCreateFolder,
  onUploadToFolder,
  onRenameFile,
  onDeleteFile,
  onOpenAudio,
  onOpenPdf,
  onSetAsWallpaper,
  onAssignImageToTrack,
  wallpaperActive,
  gestureLockEnabled,
  lockSensitiveFolders,
  lockedFolderPaths,
  isSecurityUnlocked,
  onRequestUnlockFolder,
  onToggleFolderSensitive,
  onOpenSecuritySettings,
  onLockNow,
}) => {
  const [currentPath, setCurrentPath] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'recent' | FileCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('name');
  const [showSystemGroups, setShowSystemGroups] = useState<boolean>(() => {
    try {
      return localStorage.getItem('kurodeck_files_show_groups') !== '0';
    } catch {
      return true;
    }
  });
  const [groupBy, setGroupBy] = useState<'type' | 'extension'>(() => {
    try {
      return localStorage.getItem('kurodeck_files_group_by') === 'extension'
        ? 'extension'
        : 'type';
    } catch {
      return 'type';
    }
  });
  const [activeSystemGroup, setActiveSystemGroup] = useState<{
    key: string;
    label: string;
    mode: 'type' | 'extension';
  } | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [selectedEntry, setSelectedEntry] = useState<DeviceFileEntry | null>(null);
  const [previewEntry, setPreviewEntry] = useState<DeviceFileEntry | null>(null);
  const [renamingEntry, setRenamingEntry] = useState<DeviceFileEntry | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const swipeNavRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  const isFolderLockEnforced =
    gestureLockEnabled && lockSensitiveFolders && !isSecurityUnlocked;

  const visibleSafeEntries = useMemo(() => {
    if (!isFolderLockEnforced || lockedFolderPaths.length === 0) return allEntries;
    return allEntries.filter((e) => !isEntryInLockedFolder(e, lockedFolderPaths));
  }, [allEntries, isFolderLockEnforced, lockedFolderPaths]);

  const hiddenLockedFilesCount = allEntries.length - visibleSafeEntries.length;

  const canGoBack =
    currentPath !== '' ||
    activeSystemGroup !== null ||
    categoryFilter !== 'all' ||
    searchQuery.trim().length > 0;

  const handleGoBack = () => {
    if (activeSystemGroup) {
      setActiveSystemGroup(null);
      return;
    }
    if (searchQuery.trim()) {
      setSearchQuery('');
      return;
    }
    if (categoryFilter !== 'all') {
      setCategoryFilter('all');
      return;
    }
    if (currentPath) {
      const parts = currentPath.split('/');
      parts.pop();
      setCurrentPath(parts.join('/'));
    }
  };

  const handleOpenFolder = (folderPath: string) => {
    if (isFolderLockEnforced && isFolderOrAncestorLocked(folderPath, lockedFolderPaths)) {
      onRequestUnlockFolder(folderPath, () => setCurrentPath(folderPath));
      return;
    }
    setCurrentPath(folderPath);
  };

  const isSearchingOrFiltering =
    searchQuery.trim().length > 0 || categoryFilter !== 'all' || activeSystemGroup !== null;

  const toggleShowSystemGroups = () => {
    setShowSystemGroups((prev) => {
      const next = !prev;
      if (!next) setActiveSystemGroup(null);
      try {
        localStorage.setItem('kurodeck_files_show_groups', next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleChangeGroupBy = (nextMode: 'type' | 'extension') => {
    setGroupBy(nextMode);
    setActiveSystemGroup(null);
    setCollapsedGroups({});
    try {
      localStorage.setItem('kurodeck_files_group_by', nextMode);
    } catch {
      // ignore
    }
  };

  const recentEntries = useMemo(() => {
    const items: { entry: DeviceFileEntry; openedAt: number }[] = [];
    for (const entry of visibleSafeEntries) {
      if (entry.category === 'audio') {
        const openedAt = trackMetaMap[entry.id]?.lastPlayedAt || 0;
        if (openedAt > 0) items.push({ entry, openedAt });
      } else if (entry.category === 'pdf') {
        const openedAt = Math.max(
          pdfStates[entry.id]?.lastLeftAt || 0,
          pdfStates[entry.id]?.lastOpenedAt || 0
        );
        if (openedAt > 0) items.push({ entry, openedAt });
      }
    }
    items.sort((a, b) => b.openedAt - a.openedAt);
    return items;
  }, [visibleSafeEntries, trackMetaMap, pdfStates]);

  const recentOpenedAtMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of recentEntries) {
      map[item.entry.id] = item.openedAt;
    }
    return map;
  }, [recentEntries]);

  const formatRecentTime = (ms: number) => {
    const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    try {
      return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const childFolders = useMemo(() => {
    if (isSearchingOrFiltering) return [];
    const prefix = currentPath ? `${currentPath}/` : '';
    const direct = new Set<string>();
    for (const f of folders) {
      if (!f.startsWith(prefix)) continue;
      const rest = f.slice(prefix.length);
      if (!rest) continue;
      const firstSeg = rest.split('/')[0];
      if (firstSeg) direct.add(prefix + firstSeg);
    }
    return Array.from(direct).sort((a, b) => a.localeCompare(b));
  }, [folders, currentPath, isSearchingOrFiltering]);

  const getGroupDescriptor = (entry: DeviceFileEntry, mode: 'type' | 'extension') => {
    if (mode === 'type') {
      const labels: Record<FileCategory, string> = {
        audio: 'Audio Files',
        pdf: 'PDF Documents',
        image: 'Images & GIFs',
        video: 'Videos',
        other: 'Other Files',
      };
      return { key: entry.category, label: labels[entry.category], category: entry.category };
    }
    const ext = entry.extension ? entry.extension.toLowerCase() : 'no-ext';
    const label = entry.extension ? `.${entry.extension.toUpperCase()}` : 'No Extension';
    return { key: ext, label, category: entry.category };
  };

  // System-generated groups across all unlocked files in the current folder subtree (or whole storage at root)
  const systemGroups = useMemo(() => {
    if (!showSystemGroups) return [];
    const prefix = currentPath ? `${currentPath}/` : '';
    const scopeEntries = currentPath
      ? visibleSafeEntries.filter(
          (e) => e.folderPath === currentPath || e.folderPath.startsWith(prefix)
        )
      : visibleSafeEntries;

    const map = new Map<
      string,
      {
        key: string;
        label: string;
        category: FileCategory;
        count: number;
        totalBytes: number;
      }
    >();

    for (const entry of scopeEntries) {
      const desc = getGroupDescriptor(entry, groupBy);
      const existing = map.get(desc.key);
      if (existing) {
        existing.count += 1;
        existing.totalBytes += entry.size;
      } else {
        map.set(desc.key, {
          key: desc.key,
          label: desc.label,
          category: desc.category,
          count: 1,
          totalBytes: entry.size,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [visibleSafeEntries, currentPath, showSystemGroups, groupBy]);

  const visibleFiles = useMemo(() => {
    let list: DeviceFileEntry[] = [];
    if (activeSystemGroup) {
      const prefix = currentPath ? `${currentPath}/` : '';
      const scopeEntries = currentPath
        ? visibleSafeEntries.filter(
            (e) => e.folderPath === currentPath || e.folderPath.startsWith(prefix)
          )
        : visibleSafeEntries;
      list = scopeEntries.filter(
        (e) => getGroupDescriptor(e, activeSystemGroup.mode).key === activeSystemGroup.key
      );
    } else if (categoryFilter === 'recent') {
      list = recentEntries.map((r) => r.entry);
    } else {
      list = [...visibleSafeEntries];
      if (!isSearchingOrFiltering) {
        list = list.filter((e) => e.folderPath === currentPath);
      } else if (categoryFilter !== 'all') {
        list = list.filter((e) => e.category === categoryFilter);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.relativePath.toLowerCase().includes(q)
      );
    }

    if (categoryFilter !== 'recent') {
      list.sort((a, b) => {
        if (sortBy === 'date') return b.lastModified - a.lastModified;
        if (sortBy === 'size') return b.size - a.size;
        return a.name.localeCompare(b.name);
      });
    }
    return list;
  }, [
    visibleSafeEntries,
    recentEntries,
    currentPath,
    isSearchingOrFiltering,
    categoryFilter,
    activeSystemGroup,
    searchQuery,
    sortBy,
  ]);

  const groupedVisibleFiles = useMemo(() => {
    if (!showSystemGroups || activeSystemGroup || visibleFiles.length === 0) return null;
    const map = new Map<
      string,
      { key: string; label: string; category: FileCategory; files: DeviceFileEntry[] }
    >();
    for (const entry of visibleFiles) {
      const desc = getGroupDescriptor(entry, groupBy);
      const existing = map.get(desc.key);
      if (existing) {
        existing.files.push(entry);
      } else {
        map.set(desc.key, {
          key: desc.key,
          label: desc.label,
          category: desc.category,
          files: [entry],
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.files.length - a.files.length || a.label.localeCompare(b.label)
    );
  }, [showSystemGroups, activeSystemGroup, visibleFiles, groupBy]);

  const pathSegments = currentPath ? currentPath.split('/') : [];

  const counts = useMemo(() => {
    return {
      all: visibleSafeEntries.length,
      recent: recentEntries.length,
      audio: visibleSafeEntries.filter((e) => e.category === 'audio').length,
      pdf: visibleSafeEntries.filter((e) => e.category === 'pdf').length,
      image: visibleSafeEntries.filter((e) => e.category === 'image').length,
      video: visibleSafeEntries.filter((e) => e.category === 'video').length,
      other: visibleSafeEntries.filter((e) => e.category === 'other').length,
    };
  }, [visibleSafeEntries, recentEntries.length]);

  const handleOpenEntry = (entry: DeviceFileEntry) => {
    if (entry.category === 'audio') onOpenAudio(entry);
    else if (entry.category === 'pdf') onOpenPdf(entry);
    else setPreviewEntry(entry);
  };

  const handleDownload = async (entry: DeviceFileEntry) => {
    const file = await resolveEntryFile(entry);
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = entry.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const getCategoryIcon = (cat: FileCategory) => {
    switch (cat) {
      case 'audio':
        return <Music className="h-5 w-5 text-violet-400" />;
      case 'pdf':
        return <FileText className="h-5 w-5 text-red-400" />;
      case 'image':
        return <ImageIcon className="h-5 w-5 text-sky-400" />;
      case 'video':
        return <Film className="h-5 w-5 text-amber-400" />;
      default:
        return <FileIcon className="h-5 w-5 text-zinc-400" />;
    }
  };

  return (
    <div
      className={`flex h-full flex-col text-zinc-100 ${
        wallpaperActive ? 'bg-transparent [text-shadow:0_1px_3px_rgba(0,0,0,0.85)]' : 'bg-[#09090b]'
      }`}
    >
      {/* Top Toolbar */}
      <header
        className={`shrink-0 space-y-3 border-b border-zinc-800/70 px-4 py-3 ${
          wallpaperActive ? 'bg-black/35 backdrop-blur-md' : ''
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {canGoBack ? (
              <button
                type="button"
                onClick={handleGoBack}
                aria-label="Go back"
                title="Go back"
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-amber-300 hover:bg-zinc-800 active:scale-95"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : (
              <HardDrive className="h-5 w-5 text-amber-300" />
            )}
            <div>
              <h1 className="font-display text-base font-semibold text-white">
                {linkedFolderName || 'Internal File Manager'}
              </h1>
              <p className="font-mono text-[11px] text-zinc-400">
                {visibleSafeEntries.length} files
                {hiddenLockedFilesCount > 0 ? ` · ${hiddenLockedFilesCount} locked` : ''}
                {hasLiveFolder && realTimeSyncEnabled ? ' · THE RECONING OF ALL THINGS active' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {gestureLockEnabled && lockSensitiveFolders && isSecurityUnlocked && (
              <button
                type="button"
                onClick={onLockNow}
                aria-label="Lock sensitive folders now"
                title="Lock folders now"
                className="flex min-h-[40px] items-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-2.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25"
              >
                <Unlock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Lock</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenSecuritySettings}
              aria-label="Gesture lock security settings"
              title="Gesture Lock & Sensitive Folders"
              className={`flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border transition-colors ${
                gestureLockEnabled && lockSensitiveFolders
                  ? isSecurityUnlocked
                    ? 'border-amber-400/35 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20'
                    : 'border-amber-400/60 bg-amber-400/20 text-amber-200 hover:bg-amber-400/30'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              {gestureLockEnabled && lockSensitiveFolders && !isSecurityUnlocked ? (
                <Lock className="h-4 w-4" />
              ) : (
                <FolderLock className="h-4 w-4" />
              )}
            </button>
            {hasLiveFolder && (
              <button
                type="button"
                onClick={() => void onManualSync()}
                disabled={syncing}
                aria-label="Sync internal storage"
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowNewFolder(true)}
              aria-label="New folder"
              className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
            >
              <FolderPlus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              aria-label="Add files"
              className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-xs font-medium text-zinc-100 hover:bg-zinc-800"
            >
              <Upload className="h-4 w-4" />
              <span>Add</span>
            </button>
            <button
              type="button"
              onClick={onOpenPermissions}
              className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-amber-300/90 px-3 text-xs font-semibold text-zinc-950 hover:bg-amber-300"
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Permissions</span>
            </button>
          </div>
          <input
            ref={uploadInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                void onUploadToFolder(currentPath, e.target.files);
              }
              e.target.value = '';
            }}
          />
        </div>

        {/* Search, Group Toggle & Sort Row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all internal files..."
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

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleShowSystemGroups}
              aria-pressed={showSystemGroups}
              title={showSystemGroups ? 'Hide system-generated groups' : 'Show system-generated groups'}
              className={`flex min-h-[42px] items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                showSystemGroups
                  ? 'border-amber-300/50 bg-amber-300/15 text-amber-200 hover:bg-amber-300/25'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
            >
              {showSystemGroups ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              <span>{showSystemGroups ? 'Groups: On' : 'Groups: Off'}</span>
            </button>

            {showSystemGroups && (
              <div
                role="group"
                aria-label="Group files by"
                className="flex min-h-[42px] items-center rounded-xl border border-zinc-800 bg-zinc-950 p-0.5"
              >
                <button
                  type="button"
                  onClick={() => handleChangeGroupBy('type')}
                  className={`min-h-[34px] rounded-lg px-2.5 text-xs font-medium transition-colors ${
                    groupBy === 'type'
                      ? 'bg-zinc-100 text-zinc-950'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Type
                </button>
                <button
                  type="button"
                  onClick={() => handleChangeGroupBy('extension')}
                  className={`min-h-[34px] rounded-lg px-2.5 text-xs font-medium transition-colors ${
                    groupBy === 'extension'
                      ? 'bg-zinc-100 text-zinc-950'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Ext
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                setSortBy((s) => (s === 'name' ? 'date' : s === 'date' ? 'size' : 'name'))
              }
              className="min-h-[42px] rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs font-medium text-zinc-300 hover:bg-zinc-900 whitespace-nowrap"
            >
              Sort: {sortBy === 'name' ? 'Name' : sortBy === 'date' ? 'Date' : 'Size'}
            </button>
          </div>
        </div>

        {/* File Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {(
            [
              { id: 'all', label: `All (${counts.all})` },
              { id: 'recent', label: `Recent (${counts.recent})` },
              { id: 'audio', label: `Audio (${counts.audio})` },
              { id: 'pdf', label: `PDF (${counts.pdf})` },
              { id: 'image', label: `Photos & GIFs (${counts.image})` },
              { id: 'video', label: `Videos (${counts.video})` },
              { id: 'other', label: `Other (${counts.other})` },
            ] as { id: 'all' | 'recent' | FileCategory; label: string }[]
          ).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setActiveSystemGroup(null);
                setCategoryFilter(c.id);
              }}
              className={`min-h-[36px] shrink-0 rounded-lg px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                categoryFilter === c.id && !activeSystemGroup
                  ? 'bg-zinc-100 text-zinc-950'
                  : 'border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Breadcrumbs with Quick Back Arrow */}
        {(!isSearchingOrFiltering || activeSystemGroup) && (
          <div className="flex items-center gap-1 overflow-x-auto text-xs text-zinc-400 no-scrollbar">
            {canGoBack && (
              <button
                type="button"
                onClick={handleGoBack}
                aria-label="Back one folder"
                className="mr-1 flex min-h-[30px] items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2 font-medium text-amber-300 hover:bg-zinc-800 whitespace-nowrap"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setActiveSystemGroup(null);
                setCurrentPath('');
              }}
              className={`min-h-[32px] rounded-md px-1.5 font-medium whitespace-nowrap ${
                currentPath === '' && !activeSystemGroup ? 'text-white' : 'hover:text-zinc-200'
              }`}
            >
              Internal Storage
            </button>
            {pathSegments.map((seg, i) => {
              const segPath = pathSegments.slice(0, i + 1).join('/');
              const isLast = i === pathSegments.length - 1 && !activeSystemGroup;
              return (
                <React.Fragment key={segPath}>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSystemGroup(null);
                      handleOpenFolder(segPath);
                    }}
                    className={`min-h-[32px] rounded-md px-1.5 whitespace-nowrap ${
                      isLast ? 'font-medium text-white' : 'hover:text-zinc-200'
                    }`}
                  >
                    {seg}
                  </button>
                </React.Fragment>
              );
            })}
            {activeSystemGroup && (
              <>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-300/15 px-2 py-1 font-medium text-amber-200 whitespace-nowrap">
                  <Layers className="h-3 w-3" />
                  <span>{activeSystemGroup.label}</span>
                  <button
                    type="button"
                    onClick={() => setActiveSystemGroup(null)}
                    aria-label="Exit system group"
                    className="ml-0.5 rounded-full hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              </>
            )}
          </div>
        )}
      </header>

      {/* Main Directory & File List (Supports Swipe-Right Finger Gesture to Go Back) */}
      <div
        className="steady-scroll flex-1 overflow-y-auto pb-28"
        onTouchStart={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest('[data-horizontal-shelf="true"]')) {
            swipeNavRef.current.active = false;
            return;
          }
          if (e.touches.length === 1 && canGoBack) {
            swipeNavRef.current = {
              x: e.touches[0].clientX,
              y: e.touches[0].clientY,
              active: true,
            };
          } else {
            swipeNavRef.current.active = false;
          }
        }}
        onTouchEnd={(e) => {
          const s = swipeNavRef.current;
          swipeNavRef.current.active = false;
          if (!s.active || e.changedTouches.length === 0 || !canGoBack) return;
          const dx = e.changedTouches[0].clientX - s.x;
          const dy = Math.abs(e.changedTouches[0].clientY - s.y);
          if (dx > 76 && dy < 54 && dx > dy * 1.45) {
            handleGoBack();
          }
        }}
      >
        {isFolderLockEnforced && currentPath && isFolderOrAncestorLocked(currentPath, lockedFolderPaths) ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-400/10 text-amber-300">
              <Lock className="h-8 w-8" />
            </div>
            <h2 className="mt-4 font-display text-lg font-bold text-white">
              Sensitive Folder Locked
            </h2>
            <p className="mt-1 max-w-sm text-xs text-zinc-400">
              Draw your finger gesture pattern to view files inside "{currentPath}".
            </p>
            <div className="mt-5 flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleGoBack}
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
              >
                <ArrowLeft className="h-4 w-4 text-amber-300" />
                <span>Go Back</span>
              </button>
              <button
                type="button"
                onClick={() => onRequestUnlockFolder(currentPath, () => {})}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-400 px-5 text-xs font-bold text-zinc-950 hover:bg-amber-300"
              >
                <Unlock className="h-4 w-4" />
                <span>Unlock with Gesture</span>
              </button>
            </div>
          </div>
        ) : allEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <HardDrive className="h-12 w-12 text-zinc-700" />
            <h2 className="mt-4 font-display text-lg font-bold tracking-wide text-amber-300 uppercase">
              THE RECONING OF ALL THINGS
            </h2>
            <p className="mt-1 max-w-sm text-sm text-zinc-400">
              Grant full internal storage access so audio, PDFs, photos, and videos sync in real time — files deleted on your phone disappear simultaneously from the player.
            </p>
            <button
              type="button"
              onClick={onOpenPermissions}
              className="mt-5 flex min-h-[48px] items-center gap-2 rounded-xl bg-amber-300 px-5 text-sm font-semibold text-zinc-950 hover:bg-amber-200"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Activate THE RECONING OF ALL THINGS</span>
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl">
            {/* Recent Section (Most Recently Opened Audio Files & PDFs) */}
            {!isSearchingOrFiltering && currentPath === '' && (
              <section
                aria-label="Recent audio files and PDFs"
                className="border-b border-zinc-900 px-4 py-3.5"
              >
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-300" />
                    <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-zinc-300">
                      Recent
                    </h2>
                    <span className="font-mono text-[11px] text-zinc-500">
                      Audio & PDFs
                    </span>
                  </div>
                  {recentEntries.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCategoryFilter('recent')}
                      className="min-h-[32px] rounded-lg px-2 text-xs font-medium text-amber-300 hover:bg-zinc-900 hover:text-amber-200"
                    >
                      View all ({recentEntries.length})
                    </button>
                  )}
                </div>

                {recentEntries.length === 0 ? (
                  <p className="rounded-xl border border-zinc-800/70 bg-zinc-950/70 px-3.5 py-3 text-xs text-zinc-400">
                    No recently opened audio files or PDFs yet. Open any track or PDF to jump back in here without browsing folders.
                  </p>
                ) : (
                  <div data-horizontal-shelf="true" className="no-scrollbar flex items-stretch gap-2.5 overflow-x-auto pb-1">
                    {recentEntries.slice(0, 10).map(({ entry, openedAt }) => {
                      const isAudio = entry.category === 'audio';
                      const trackMeta = isAudio ? trackMetaMap[entry.id] : undefined;
                      const pdfState = !isAudio ? pdfStates[entry.id] : undefined;
                      const displayTitle = isAudio
                        ? trackMeta?.title || entry.name.replace(/\.[^.]+$/, '')
                        : entry.name.replace(/\.pdf$/i, '');

                      return (
                        <div
                          key={`recent-${entry.id}`}
                          className="flex w-56 shrink-0 items-center gap-2.5 rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-2 transition-colors hover:border-zinc-700 hover:bg-zinc-900/80"
                        >
                          <button
                            type="button"
                            onClick={() => handleOpenEntry(entry)}
                            className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus:outline-none"
                          >
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
                              {trackMeta?.coverUrl ? (
                                <img
                                  src={trackMeta.coverUrl}
                                  alt={displayTitle}
                                  referrerPolicy="no-referrer"
                                  className="h-full w-full object-cover"
                                />
                              ) : pdfState?.thumbnailUrl ? (
                                <img
                                  src={pdfState.thumbnailUrl}
                                  alt={displayTitle}
                                  referrerPolicy="no-referrer"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                getCategoryIcon(entry.category)
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-zinc-100">
                                {displayTitle}
                              </p>
                              <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-400">
                                {isAudio
                                  ? `Audio · ${formatRecentTime(openedAt)}`
                                  : `${
                                      pdfState?.totalPages
                                        ? `PDF p.${pdfState.currentPage}/${pdfState.totalPages}`
                                        : 'PDF'
                                    } · ${
                                      pdfState?.lastLeftAt
                                        ? `Left ${formatExactClockTime(pdfState.lastLeftAt)}`
                                        : formatRecentTime(openedAt)
                                    }`}
                              </p>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* System-Generated Groups Shelf (Auto-grouped by Type or Extension) */}
            {showSystemGroups && !isSearchingOrFiltering && systemGroups.length > 0 && (
              <section
                aria-label="System-generated file groups"
                className="border-b border-zinc-900 px-4 py-3.5"
              >
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-amber-300" />
                    <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-zinc-300">
                      System Groups
                    </h2>
                    <span className="font-mono text-[11px] text-zinc-500">
                      By {groupBy === 'type' ? 'File Type' : 'Extension'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={toggleShowSystemGroups}
                    className="min-h-[32px] rounded-lg px-2 text-xs font-medium text-zinc-400 hover:bg-zinc-900 hover:text-white"
                  >
                    Hide groups
                  </button>
                </div>

                <div data-horizontal-shelf="true" className="no-scrollbar flex items-stretch gap-2.5 overflow-x-auto pb-1">
                  {systemGroups.map((grp) => (
                    <button
                      key={`sysgrp-${groupBy}-${grp.key}`}
                      type="button"
                      onClick={() =>
                        setActiveSystemGroup({
                          key: grp.key,
                          label: grp.label,
                          mode: groupBy,
                        })
                      }
                      className="flex min-h-[60px] w-44 shrink-0 items-center gap-2.5 rounded-xl border border-zinc-800/80 bg-zinc-950/90 px-3 py-2 text-left transition-colors hover:border-amber-300/40 hover:bg-zinc-900/80"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900">
                        {getCategoryIcon(grp.category)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-zinc-100">
                          {grp.label}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-400">
                          {grp.count} {grp.count === 1 ? 'file' : 'files'} · {formatBytes(grp.totalBytes)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {hiddenLockedFilesCount > 0 && (
              <div className="flex items-center justify-between gap-3 border-b border-amber-500/20 bg-amber-950/25 px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-2 text-xs text-amber-200">
                  <Lock className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                  <span className="truncate">
                    {hiddenLockedFilesCount} file{hiddenLockedFilesCount === 1 ? '' : 's'} in sensitive folder(s) hidden
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onRequestUnlockFolder('Sensitive Folders', () => {})}
                  className="min-h-[32px] shrink-0 rounded-lg bg-amber-300 px-2.5 text-[11px] font-semibold text-zinc-950 hover:bg-amber-200"
                >
                  Unlock
                </button>
              </div>
            )}

            <div className="divide-y divide-zinc-900">
              {childFolders.map((folderPath) => {
                const name = folderPath.split('/').pop() || folderPath;
                const isMarkedSensitive = isFolderOrAncestorLocked(folderPath, lockedFolderPaths);
                const isLockedNow = isFolderLockEnforced && isMarkedSensitive;
                const insideCount = allEntries.filter(
                  (e) =>
                    e.folderPath === folderPath ||
                    e.folderPath.startsWith(`${folderPath}/`)
                ).length;
                return (
                  <div
                    key={folderPath}
                    className="lightweight-row flex min-h-[60px] w-full items-center justify-between gap-2 px-4 py-2 hover:bg-zinc-900/60"
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenFolder(folderPath)}
                      className="flex min-w-0 flex-1 items-center gap-3.5 text-left focus:outline-none"
                    >
                      {isLockedNow ? (
                        <FolderLock className="h-5 w-5 shrink-0 text-amber-400" />
                      ) : (
                        <Folder
                          className={`h-5 w-5 shrink-0 ${
                            isMarkedSensitive ? 'text-amber-400' : 'text-amber-300'
                          }`}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-zinc-100">{name}</p>
                          {isMarkedSensitive && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-400/35 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                              <Lock className="h-2.5 w-2.5" />
                              <span>{isLockedNow ? 'Locked' : 'Sensitive'}</span>
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-xs text-zinc-500">
                          {isLockedNow ? 'Tap & draw finger gesture to open' : `${insideCount} items`}
                        </p>
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onToggleFolderSensitive(folderPath)}
                        aria-label={
                          isMarkedSensitive
                            ? `Remove gesture lock from ${name}`
                            : `Lock folder ${name} with gesture`
                        }
                        title={
                          isMarkedSensitive
                            ? 'Protected sensitive folder (tap to change)'
                            : 'Lock folder with gesture'
                        }
                        className={`flex min-h-[38px] min-w-[38px] items-center justify-center rounded-full transition-colors ${
                          isMarkedSensitive
                            ? 'text-amber-300 hover:bg-amber-400/15'
                            : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200'
                        }`}
                      >
                        {isMarkedSensitive ? (
                          <Lock className="h-4 w-4" />
                        ) : (
                          <Unlock className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenFolder(folderPath)}
                        aria-label={`Open folder ${name}`}
                        className="flex min-h-[38px] min-w-[32px] items-center justify-center text-zinc-500"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {groupedVisibleFiles ? (
                groupedVisibleFiles.map((group) => {
                  const isCollapsed = Boolean(collapsedGroups[`${groupBy}:${group.key}`]);
                  return (
                    <div key={`group-${groupBy}-${group.key}`} className="divide-y divide-zinc-900">
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedGroups((prev) => ({
                            ...prev,
                            [`${groupBy}:${group.key}`]: !isCollapsed,
                          }))
                        }
                        className="flex min-h-[44px] w-full items-center justify-between bg-zinc-950/80 px-4 py-2 text-left hover:bg-zinc-900/60"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-amber-300">
                            {group.label}
                          </span>
                          <span className="font-mono text-[11px] text-zinc-500">
                            ({group.files.length})
                          </span>
                        </div>
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-zinc-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-zinc-500" />
                        )}
                      </button>

                      {!isCollapsed &&
                        group.files.map((entry) => {
                          const recentTs = recentOpenedAtMap[entry.id];
                          const trackMeta =
                            entry.category === 'audio' ? trackMetaMap[entry.id] : undefined;
                          const pdfState =
                            entry.category === 'pdf' ? pdfStates[entry.id] : undefined;
                          return (
                            <div
                              key={entry.id}
                              className="lightweight-row flex min-h-[64px] items-center gap-3 px-4 py-2 hover:bg-zinc-900/60"
                            >
                              <button
                                type="button"
                                onClick={() => handleOpenEntry(entry)}
                                className="flex min-w-0 flex-1 items-center gap-3.5 text-left focus:outline-none"
                              >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                                  {trackMeta?.coverUrl ? (
                                    <img
                                      src={trackMeta.coverUrl}
                                      alt={entry.name}
                                      referrerPolicy="no-referrer"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : pdfState?.thumbnailUrl ? (
                                    <img
                                      src={pdfState.thumbnailUrl}
                                      alt={entry.name}
                                      referrerPolicy="no-referrer"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    getCategoryIcon(entry.category)
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-zinc-100">
                                    {entry.name}
                                  </p>
                                  <p className="truncate font-mono text-xs text-zinc-500">
                                    {entry.extension.toUpperCase() || 'FILE'} · {formatBytes(entry.size)}
                                    {pdfState?.lastLeftAt
                                      ? ` · Left ${formatExactClockTime(pdfState.lastLeftAt)}`
                                      : categoryFilter === 'recent' && recentTs
                                        ? ` · Opened ${formatRecentTime(recentTs)}`
                                        : ''}
                                    {isSearchingOrFiltering && entry.folderPath
                                      ? ` · ${entry.folderPath}`
                                      : ''}
                                  </p>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => setSelectedEntry(entry)}
                                aria-label={`File options for ${entry.name}`}
                                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
                              >
                                <MoreVertical className="h-5 w-5" />
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  );
                })
              ) : (
                visibleFiles.map((entry) => {
                  const recentTs = recentOpenedAtMap[entry.id];
                  const trackMeta = entry.category === 'audio' ? trackMetaMap[entry.id] : undefined;
                  const pdfState = entry.category === 'pdf' ? pdfStates[entry.id] : undefined;
                  return (
                    <div
                      key={entry.id}
                      className="lightweight-row flex min-h-[64px] items-center gap-3 px-4 py-2 hover:bg-zinc-900/60"
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenEntry(entry)}
                        className="flex min-w-0 flex-1 items-center gap-3.5 text-left focus:outline-none"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                          {trackMeta?.coverUrl ? (
                            <img
                              src={trackMeta.coverUrl}
                              alt={entry.name}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover"
                            />
                          ) : pdfState?.thumbnailUrl ? (
                            <img
                              src={pdfState.thumbnailUrl}
                              alt={entry.name}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            getCategoryIcon(entry.category)
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-100">{entry.name}</p>
                          <p className="truncate font-mono text-xs text-zinc-500">
                            {entry.extension.toUpperCase() || 'FILE'} · {formatBytes(entry.size)}
                            {pdfState?.lastLeftAt
                              ? ` · Left ${formatExactClockTime(pdfState.lastLeftAt)}`
                              : categoryFilter === 'recent' && recentTs
                                ? ` · Opened ${formatRecentTime(recentTs)}`
                                : ''}
                            {isSearchingOrFiltering && entry.folderPath
                              ? ` · ${entry.folderPath}`
                              : ''}
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedEntry(entry)}
                        aria-label={`File options for ${entry.name}`}
                        className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>
                    </div>
                  );
                })
              )}

              {childFolders.length === 0 && visibleFiles.length === 0 && (
                <p className="px-6 py-12 text-center text-sm text-zinc-500">
                  {categoryFilter === 'recent'
                    ? 'No recently opened audio files or PDFs yet.'
                    : isSearchingOrFiltering
                      ? 'No matching files found.'
                      : 'This folder is empty.'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* File Overflow Actions Sheet */}
      {selectedEntry && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 sm:items-center sm:p-4"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl border border-zinc-800 bg-[#141418] p-4 sm:rounded-2xl"
          >
            <div className="mb-3 border-b border-zinc-800 pb-3">
              <p className="truncate text-sm font-semibold text-white">{selectedEntry.name}</p>
              <p className="truncate font-mono text-xs text-zinc-400">
                {selectedEntry.relativePath} · {formatBytes(selectedEntry.size)}
              </p>
            </div>

            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  const target = selectedEntry;
                  setSelectedEntry(null);
                  handleOpenEntry(target);
                }}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-sm text-zinc-100 hover:bg-zinc-800"
              >
                <Play className="h-4 w-4 text-violet-400" />
                <span>Open / Play</span>
              </button>

              {(selectedEntry.category === 'image' || selectedEntry.category === 'video') && (
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedEntry;
                    setSelectedEntry(null);
                    void onSetAsWallpaper(target);
                  }}
                  className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-sm text-zinc-100 hover:bg-zinc-800"
                >
                  <Wallpaper className="h-4 w-4 text-sky-400" />
                  <span>Set as 4K Wallpaper / GIF</span>
                </button>
              )}

              {selectedEntry.category === 'image' && (
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedEntry;
                    setSelectedEntry(null);
                    onAssignImageToTrack(target);
                  }}
                  className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-sm text-zinc-100 hover:bg-zinc-800"
                >
                  <Music className="h-4 w-4 text-violet-400" />
                  <span>Use as Audio Cover Art</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setRenamingEntry(selectedEntry);
                  setRenameValue(selectedEntry.name);
                  setSelectedEntry(null);
                }}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-sm text-zinc-100 hover:bg-zinc-800"
              >
                <Edit2 className="h-4 w-4 text-zinc-400" />
                <span>Rename</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = selectedEntry;
                  setSelectedEntry(null);
                  void handleDownload(target);
                }}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-sm text-zinc-100 hover:bg-zinc-800"
              >
                <Download className="h-4 w-4 text-zinc-400" />
                <span>Export / Save Copy</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = selectedEntry;
                  setSelectedEntry(null);
                  void onDeleteFile(target);
                }}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-sm text-red-400 hover:bg-red-950/40"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete File</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renamingEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setRenamingEntry(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!renameValue.trim()) return;
              await onRenameFile(renamingEntry, renameValue.trim());
              setRenamingEntry(null);
            }}
            className="w-full max-w-sm space-y-4 rounded-2xl border border-zinc-800 bg-[#141418] p-5"
          >
            <h3 className="font-display text-base font-semibold text-white">Rename File</h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              className="min-h-[44px] w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-white focus:border-amber-300 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenamingEntry(null)}
                className="min-h-[44px] rounded-xl px-4 text-sm text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] rounded-xl bg-amber-300 px-5 text-sm font-semibold text-zinc-950"
              >
                Rename
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowNewFolder(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newFolderName.trim()) return;
              await onCreateFolder(currentPath, newFolderName.trim());
              setNewFolderName('');
              setShowNewFolder(false);
            }}
            className="w-full max-w-sm space-y-4 rounded-2xl border border-zinc-800 bg-[#141418] p-5"
          >
            <h3 className="font-display text-base font-semibold text-white">Create Folder</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              autoFocus
              className="min-h-[44px] w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 text-sm text-white focus:border-amber-300 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewFolder(false)}
                className="min-h-[44px] rounded-xl px-4 text-sm text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] rounded-xl bg-amber-300 px-5 text-sm font-semibold text-zinc-950"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Media Preview Modal (Image / 4K GIF / Video) */}
      {previewEntry && (
        <MediaPreviewModal
          entry={previewEntry}
          onClose={() => setPreviewEntry(null)}
          onSetWallpaper={() => void onSetAsWallpaper(previewEntry)}
        />
      )}
    </div>
  );
};

const MediaPreviewModal: React.FC<{
  entry: DeviceFileEntry;
  onClose: () => void;
  onSetWallpaper: () => void;
}> = ({ entry, onClose, onSetWallpaper }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objUrl: string | null = null;
    void resolveEntryFile(entry).then((file) => {
      if (!active || !file) return;
      objUrl = URL.createObjectURL(file);
      setUrl(objUrl);
    });
    return () => {
      active = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [entry]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center justify-between border-b border-zinc-900 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{entry.name}</p>
          <p className="font-mono text-xs text-zinc-400">
            {entry.extension.toUpperCase()} · {formatBytes(entry.size)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(entry.category === 'image' || entry.category === 'video') && (
            <button
              type="button"
              onClick={() => {
                onSetWallpaper();
                onClose();
              }}
              className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-500"
            >
              <Wallpaper className="h-4 w-4" />
              <span>Set Wallpaper</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-zinc-300 hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-4">
        {url ? (
          entry.category === 'video' ? (
            <video src={url} controls autoPlay className="max-h-full max-w-full rounded-xl" />
          ) : entry.category === 'image' ? (
            <img
              src={url}
              alt={entry.name}
              referrerPolicy="no-referrer"
              className="max-h-full max-w-full rounded-xl object-contain"
            />
          ) : (
            <div className="text-center text-sm text-zinc-400">
              Preview not available for `.{entry.extension}` files. Use Export to open externally.
            </div>
          )
        ) : (
          <p className="font-mono text-xs text-zinc-500">Loading...</p>
        )}
      </div>
    </div>
  );
};
