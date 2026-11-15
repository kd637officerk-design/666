import { DeviceFileEntry, FileCategory } from '../types';
import { StoredFallbackFile } from './storage';

const AUDIO_EXTS = new Set(['mp3', 'flac', 'm4a', 'aac', 'wav', 'ogg', 'opus', 'weba', 'wma']);
const PDF_EXTS = new Set(['pdf']);
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mkv', 'mov', 'm4v', 'avi']);

export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx > 0 ? filename.slice(idx + 1).toLowerCase() : '';
}

export function categorizeFile(filename: string, mimeType = ''): FileCategory {
  const ext = getExtension(filename);
  if (AUDIO_EXTS.has(ext) || mimeType.startsWith('audio/')) return 'audio';
  if (PDF_EXTS.has(ext) || mimeType === 'application/pdf') return 'pdf';
  if (IMAGE_EXTS.has(ext) || mimeType.startsWith('image/')) return 'image';
  if (VIDEO_EXTS.has(ext) || mimeType.startsWith('video/')) return 'video';
  return 'other';
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exp = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, exp);
  return `${val >= 100 ? val.toFixed(0) : val.toFixed(1)} ${units[exp]}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function supportsDirectoryPicker(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export function supportsFileSystemObserver(): boolean {
  return typeof window !== 'undefined' && 'FileSystemObserver' in window;
}

interface FileSystemObserverInstance {
  observe: (
    handle: FileSystemDirectoryHandle,
    options?: { recursive?: boolean }
  ) => Promise<void>;
  disconnect: () => void;
}

export function observeDirectoryHandle(
  rootHandle: FileSystemDirectoryHandle,
  onChange: () => void
): { active: boolean; disconnect: () => void } {
  if (!supportsFileSystemObserver()) {
    return { active: false, disconnect: () => {} };
  }
  try {
    const ObserverCtor = (
      window as unknown as {
        FileSystemObserver: new (cb: () => void) => FileSystemObserverInstance;
      }
    ).FileSystemObserver;
    const observer = new ObserverCtor(() => {
      onChange();
    });
    void observer.observe(rootHandle, { recursive: true }).catch(() => {
      // Fallback polling stays active even if recursive observe rejects on older engines
    });
    return {
      active: true,
      disconnect: () => {
        try {
          observer.disconnect();
        } catch {
          // ignore
        }
      },
    };
  } catch {
    return { active: false, disconnect: () => {} };
  }
}

interface PermissionCapableDirHandle extends FileSystemDirectoryHandle {
  queryPermission?: (desc: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (desc: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
}

export async function queryDirectoryPermissionState(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite'
): Promise<PermissionState> {
  const h = handle as PermissionCapableDirHandle;
  if (typeof h.queryPermission === 'function') {
    return h.queryPermission({ mode });
  }
  return 'granted';
}

export async function verifyDirectoryPermission(
  handle: FileSystemDirectoryHandle,
  readWrite = true
): Promise<boolean> {
  try {
    const h = handle as PermissionCapableDirHandle;
    const mode = readWrite ? 'readwrite' : 'read';
    if (typeof h.queryPermission === 'function' && typeof h.requestPermission === 'function') {
      if ((await h.queryPermission({ mode })) === 'granted') return true;
      if ((await h.requestPermission({ mode })) === 'granted') return true;
      if (readWrite) {
        if ((await h.queryPermission({ mode: 'read' })) === 'granted') return true;
        if ((await h.requestPermission({ mode: 'read' })) === 'granted') return true;
      }
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function scanDirectoryHandle(
  rootHandle: FileSystemDirectoryHandle
): Promise<{ entries: DeviceFileEntry[]; folders: string[] }> {
  const entries: DeviceFileEntry[] = [];
  const folderSet = new Set<string>();

  async function walk(dir: FileSystemDirectoryHandle, prefix: string) {
    for await (const handle of dir.values()) {
      if (handle.name.startsWith('.')) continue;
      const rel = prefix ? `${prefix}/${handle.name}` : handle.name;
      if (handle.kind === 'directory') {
        folderSet.add(rel);
        await walk(handle as FileSystemDirectoryHandle, rel);
      } else if (handle.kind === 'file') {
        try {
          const fh = handle as FileSystemFileHandle;
          const file = await fh.getFile();
          const ext = getExtension(file.name);
          entries.push({
            id: `fs:${rel}`,
            name: file.name,
            relativePath: rel,
            folderPath: prefix,
            size: file.size,
            lastModified: file.lastModified,
            mimeType: file.type,
            category: categorizeFile(file.name, file.type),
            extension: ext,
            handle: fh,
            parentHandle: dir,
            file,
          });
        } catch {
          // Skip unreadable system file
        }
      }
    }
  }

  await walk(rootHandle, '');
  return { entries, folders: Array.from(folderSet).sort() };
}

export function fileListToEntries(files: FileList | File[]): {
  entries: DeviceFileEntry[];
  folders: string[];
  fallbackRecords: StoredFallbackFile[];
} {
  const arr = Array.from(files);
  const entries: DeviceFileEntry[] = [];
  const folderSet = new Set<string>();
  const fallbackRecords: StoredFallbackFile[] = [];

  for (const file of arr) {
    if (file.name.startsWith('.')) continue;
    const rawRel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const parts = rawRel.split('/').filter(Boolean);
    const folderPath = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
    if (folderPath) {
      // Add all ancestor folders
      const segs = folderPath.split('/');
      let acc = '';
      for (const s of segs) {
        acc = acc ? `${acc}/${s}` : s;
        folderSet.add(acc);
      }
    }
    const id = `local:${rawRel}:${file.size}`;
    entries.push({
      id,
      name: file.name,
      relativePath: rawRel,
      folderPath,
      size: file.size,
      lastModified: file.lastModified,
      mimeType: file.type,
      category: categorizeFile(file.name, file.type),
      extension: getExtension(file.name),
      file,
    });

    fallbackRecords.push({
      id,
      name: file.name,
      relativePath: rawRel,
      folderPath,
      size: file.size,
      lastModified: file.lastModified,
      mimeType: file.type,
      blob: file,
    });
  }

  return { entries, folders: Array.from(folderSet).sort(), fallbackRecords };
}

export function fallbackRecordsToEntries(records: StoredFallbackFile[]): {
  entries: DeviceFileEntry[];
  folders: string[];
} {
  const folderSet = new Set<string>();
  const entries: DeviceFileEntry[] = records.map((rec) => {
    if (rec.folderPath) {
      const segs = rec.folderPath.split('/');
      let acc = '';
      for (const s of segs) {
        acc = acc ? `${acc}/${s}` : s;
        folderSet.add(acc);
      }
    }
    const file = new File([rec.blob], rec.name, {
      type: rec.mimeType,
      lastModified: rec.lastModified,
    });
    return {
      id: rec.id,
      name: rec.name,
      relativePath: rec.relativePath,
      folderPath: rec.folderPath,
      size: rec.size,
      lastModified: rec.lastModified,
      mimeType: rec.mimeType,
      category: categorizeFile(rec.name, rec.mimeType),
      extension: getExtension(rec.name),
      file,
    };
  });
  return { entries, folders: Array.from(folderSet).sort() };
}

export async function resolveEntryFile(entry: DeviceFileEntry): Promise<File | null> {
  if (entry.handle) {
    try {
      return await entry.handle.getFile();
    } catch (err) {
      if ((err as DOMException)?.name === 'NotFoundError') {
        return null;
      }
      return entry.file ?? null;
    }
  }
  return entry.file ?? null;
}

export async function writeBytesToFileHandle(
  handle: FileSystemFileHandle,
  bytes: Uint8Array
): Promise<boolean> {
  try {
    const writable = await handle.createWritable();
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    await writable.write(copy.buffer);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

export async function deleteEntryFromHandle(entry: DeviceFileEntry): Promise<boolean> {
  if (!entry.parentHandle) return false;
  try {
    await entry.parentHandle.removeEntry(entry.name);
    return true;
  } catch {
    return false;
  }
}

export async function renameEntryInHandle(
  entry: DeviceFileEntry,
  newName: string
): Promise<boolean> {
  if (!entry.handle || !entry.parentHandle) return false;
  try {
    // Chromium supports handle.move(newName)
    const movable = entry.handle as FileSystemFileHandle & {
      move?: (name: string) => Promise<void>;
    };
    if (typeof movable.move === 'function') {
      await movable.move(newName);
      return true;
    }
    // Manual copy + delete fallback
    const file = await entry.handle.getFile();
    const newHandle = await entry.parentHandle.getFileHandle(newName, { create: true });
    const writable = await newHandle.createWritable();
    await writable.write(await file.arrayBuffer());
    await writable.close();
    await entry.parentHandle.removeEntry(entry.name);
    return true;
  } catch {
    return false;
  }
}

export async function createSubfolderInHandle(
  rootHandle: FileSystemDirectoryHandle,
  folderPath: string,
  newFolderName: string
): Promise<boolean> {
  try {
    let dir = rootHandle;
    if (folderPath) {
      for (const seg of folderPath.split('/').filter(Boolean)) {
        dir = await dir.getDirectoryHandle(seg, { create: false });
      }
    }
    await dir.getDirectoryHandle(newFolderName, { create: true });
    return true;
  } catch {
    return false;
  }
}

export async function writeUploadedFilesToDirectory(
  rootHandle: FileSystemDirectoryHandle,
  folderPath: string,
  files: FileList | File[]
): Promise<number> {
  let count = 0;
  let dir = rootHandle;
  if (folderPath) {
    for (const seg of folderPath.split('/').filter(Boolean)) {
      dir = await dir.getDirectoryHandle(seg, { create: true });
    }
  }
  for (const file of Array.from(files)) {
    try {
      const fh = await dir.getFileHandle(file.name, { create: true });
      const writable = await fh.createWritable();
      await writable.write(await file.arrayBuffer());
      await writable.close();
      count++;
    } catch {
      // skip
    }
  }
  return count;
}
