import { DeviceFileEntry, GestureLockSettings } from '../types';

export const DEFAULT_GESTURE_LOCK_SETTINGS: GestureLockSettings = {
  enabled: false,
  patternHash: null,
  patternSalt: null,
  patternLength: 0,
  lockPdfReader: true,
  lockSensitiveFolders: true,
  lockedFolderPaths: [],
  autoLockMinutes: 5,
};

/**
 * Android-style 3x3 grid midpoint lookup:
 * dragging straight across an unvisited middle node connects it automatically.
 */
const BRIDGE_MIDPOINTS: Record<string, number> = {
  '0-2': 1,
  '2-0': 1,
  '3-5': 4,
  '5-3': 4,
  '6-8': 7,
  '8-6': 7,
  '0-6': 3,
  '6-0': 3,
  '1-7': 4,
  '7-1': 4,
  '2-8': 5,
  '8-2': 5,
  '0-8': 4,
  '8-0': 4,
  '2-6': 4,
  '6-2': 4,
};

export function getMidpointNode(fromNode: number, toNode: number): number | null {
  const key = `${fromNode}-${toNode}`;
  return key in BRIDGE_MIDPOINTS ? BRIDGE_MIDPOINTS[key] : null;
}

export function normalizeFolderPath(folderPath: string): string {
  return folderPath
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/');
}

export function isFolderOrAncestorLocked(
  folderPath: string,
  lockedFolderPaths: string[]
): boolean {
  if (!lockedFolderPaths || lockedFolderPaths.length === 0) return false;
  const cleanTarget = normalizeFolderPath(folderPath);
  if (!cleanTarget) return false;
  const lowerTarget = cleanTarget.toLowerCase();

  for (const rawLocked of lockedFolderPaths) {
    const cleanLocked = normalizeFolderPath(rawLocked).toLowerCase();
    if (!cleanLocked) continue;
    if (lowerTarget === cleanLocked || lowerTarget.startsWith(`${cleanLocked}/`)) {
      return true;
    }
  }
  return false;
}

export function isEntryInLockedFolder(
  entry: DeviceFileEntry,
  lockedFolderPaths: string[]
): boolean {
  return isFolderOrAncestorLocked(entry.folderPath, lockedFolderPaths);
}

function generateSaltHex(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Deterministic pure-JS fallback mixer used only when SubtleCrypto is unavailable
 * (e.g., an unencrypted file:// single-HTML origin on older WebViews).
 */
function fallbackHashString(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0xdeadbeef;
  let h3 = 0x41c6ce57;
  let h4 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (ch + i), 0x85ebca6b) >>> 0;
    h3 = Math.imul(h3 ^ (ch * 31), 0xc2b2ae35) >>> 0;
    h4 = Math.imul(h4 ^ (h1 ^ h2), 0x27d4eb2f) >>> 0;
  }
  return (
    'fb_' +
    [h1, h2, h3, h4].map((n) => n.toString(16).padStart(8, '0')).join('')
  );
}

export async function hashGesturePattern(
  pattern: number[],
  existingSalt?: string | null
): Promise<{ hash: string; salt: string }> {
  const salt = existingSalt || generateSaltHex(16);
  const payload = `symphony9:${salt}:${pattern.join('-')}`;

  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    try {
      const encoded = new TextEncoder().encode(payload);
      const digest = await window.crypto.subtle.digest('SHA-256', encoded);
      const hex = Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, '0')
      ).join('');
      return { hash: `sha256_${hex}`, salt };
    } catch {
      // fall through to deterministic offline hash
    }
  }

  return { hash: fallbackHashString(payload), salt };
}

export async function verifyGesturePattern(
  pattern: number[],
  settings: GestureLockSettings
): Promise<boolean> {
  if (!settings.patternHash || !settings.patternSalt) return false;
  if (settings.patternHash.startsWith('fb_')) {
    const expected = fallbackHashString(
      `symphony9:${settings.patternSalt}:${pattern.join('-')}`
    );
    return expected === settings.patternHash;
  }
  const { hash } = await hashGesturePattern(pattern, settings.patternSalt);
  return hash === settings.patternHash;
}
