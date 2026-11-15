import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { DeviceVoiceOption } from './voiceReaders';

export const DEFAULT_CLOUD_TTS_ORIGIN =
  'https://ais-pre-iobwwoq4lomt4vax7zs6bl-854876328213.us-east1.run.app';

let activeSpeechSessionId = 0;
const cloudReachableCache = new Map<string, { ok: boolean; checkedAt: number }>();

export function isNativeAndroidRuntime(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function isStandaloneHtmlRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const proto = window.location.protocol;
  return proto === 'file:' || proto === 'content:' || proto === 'capacitor:';
}

export function normalizeServerOrigin(raw?: string | null): string {
  const trimmed = (raw || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function resolveTtsApiEndpoint(customBaseUrl?: string | null): string {
  const custom = normalizeServerOrigin(customBaseUrl);
  if (custom) return `${custom}/api/tts`;
  if (isNativeAndroidRuntime() || isStandaloneHtmlRuntime()) {
    return `${DEFAULT_CLOUD_TTS_ORIGIN}/api/tts`;
  }
  return '/api/tts';
}

export function resolveHealthApiEndpoint(customBaseUrl?: string | null): string {
  const custom = normalizeServerOrigin(customBaseUrl);
  if (custom) return `${custom}/api/health`;
  if (isNativeAndroidRuntime() || isStandaloneHtmlRuntime()) {
    return `${DEFAULT_CLOUD_TTS_ORIGIN}/api/health`;
  }
  return '/api/health';
}

export function resetCloudTtsReachabilityCache(): void {
  cloudReachableCache.clear();
}

/**
 * Fast reachability check so the Android APK never waits 14 seconds on an unreachable
 * cloud server before switching to Android's instant native TTS engine.
 */
export async function canUseCloudTtsNow(customBaseUrl?: string | null): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  const custom = normalizeServerOrigin(customBaseUrl);
  // In the web app itself (not native APK / standalone file://), same-origin /api/tts is fast & direct.
  if (!custom && !isNativeAndroidRuntime() && !isStandaloneHtmlRuntime()) {
    return true;
  }

  const healthUrl = resolveHealthApiEndpoint(custom);
  const cached = cloudReachableCache.get(healthUrl);
  const ttlMs = cached?.ok ? 120_000 : 45_000;
  if (cached && Date.now() - cached.checkedAt < ttlMs) {
    return cached.ok;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2400);
  try {
    const res = await fetch(healthUrl, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      cloudReachableCache.set(healthUrl, { ok: false, checkedAt: Date.now() });
      return false;
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      cloudReachableCache.set(healthUrl, { ok: false, checkedAt: Date.now() });
      return false;
    }
    const json = (await res.json()) as { ok?: boolean; hasGeminiKey?: boolean };
    const ok = Boolean(json.ok && json.hasGeminiKey);
    cloudReachableCache.set(healthUrl, { ok, checkedAt: Date.now() });
    return ok;
  } catch {
    clearTimeout(timer);
    cloudReachableCache.set(healthUrl, { ok: false, checkedAt: Date.now() });
    return false;
  }
}

export function buildTtsCacheKey(
  voiceName: string,
  stylePrompt: string,
  language: string | undefined,
  text: string
): string {
  const sample = text.slice(0, 2900);
  let hash = 2166136261;
  for (let i = 0; i < sample.length; i += 1) {
    hash ^= sample.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${voiceName}|${language || 'auto'}|${stylePrompt.slice(0, 40)}|${(hash >>> 0).toString(36)}`;
}

function formatAndroidVoiceDisplayName(rawName: string, voiceURI: string, lang: string, isOffline?: boolean): string {
  const id = (voiceURI || rawName || '').trim();
  const baseLabel = (rawName && !/^\s*$/.test(rawName) ? rawName : lang || 'Android Voice').trim();
  // Android voiceURI often looks like "en-us-x-tpf-local" or "es-es-x-ana-network"
  const match = id.match(/^[a-z]{2,3}-[a-z]{2,4}-x-([a-z0-9]+)-(local|network)$/i);
  if (match) {
    const code = match[1].toUpperCase();
    const modeTag = match[2].toLowerCase() === 'local' ? 'Offline' : 'HD Net';
    return `${baseLabel} · ${code} (${modeTag})`;
  }
  const tag = isOffline === true ? 'Offline' : isOffline === false ? 'Network' : '';
  if (id && id.toLowerCase() !== baseLabel.toLowerCase() && id.length <= 28) {
    return `${baseLabel} · ${id}${tag ? ` (${tag})` : ''}`;
  }
  return tag ? `${baseLabel} (${tag})` : baseLabel;
}

async function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchNativeAndroidVoicesWithRetry(): Promise<
  Array<{
    voiceURI: string;
    name: string;
    lang: string;
    localService?: boolean;
  }>
> {
  const attempts = [0, 350, 700, 1100];
  for (let i = 0; i < attempts.length; i += 1) {
    if (attempts[i] > 0) await waitMs(attempts[i]);
    try {
      const res = await TextToSpeech.getSupportedVoices();
      const voices = res?.voices || [];
      if (voices.length > 0) {
        return voices;
      }
    } catch {
      // keep retrying briefly while Android TTS binds
    }
  }
  return [];
}

export async function listHybridDeviceVoices(): Promise<DeviceVoiceOption[]> {
  if (isNativeAndroidRuntime()) {
    try {
      const voices = await fetchNativeAndroidVoicesWithRetry();
      return voices
        .map((v) => {
          const uri = v.voiceURI || v.name;
          const offline =
            typeof v.localService === 'boolean'
              ? v.localService
              : !/network/i.test(uri);
          return {
            voiceURI: uri,
            rawId: uri,
            name: formatAndroidVoiceDisplayName(v.name, uri, v.lang || 'en-US', offline),
            lang: v.lang || 'en-US',
            localService: offline,
          };
        })
        .sort((a, b) => {
          const aPriority = a.localService ? 0 : 1;
          const bPriority = b.localService ? 0 : 1;
          if (aPriority !== bPriority) return aPriority - bPriority;
          const aLang = /^(en|es)/i.test(a.lang) ? 0 : 1;
          const bLang = /^(en|es)/i.test(b.lang) ? 0 : 1;
          if (aLang !== bLang) return aLang - bLang;
          return a.name.localeCompare(b.name);
        });
    } catch {
      // fall through to browser speechSynthesis
    }
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  try {
    const raw = window.speechSynthesis.getVoices() || [];
    return [...raw]
      .sort((a, b) => {
        const aNat = /natural|neural|google|samantha|daniel|aria|jenny|monica|paulina/i.test(
          a.name
        )
          ? 0
          : 1;
        const bNat = /natural|neural|google|samantha|daniel|aria|jenny|monica|paulina/i.test(
          b.name
        )
          ? 0
          : 1;
        if (aNat !== bNat) return aNat - bNat;
        return a.name.localeCompare(b.name);
      })
      .map((v) => ({
        voiceURI: v.voiceURI || v.name,
        rawId: v.voiceURI || v.name,
        name: v.name,
        lang: v.lang,
        localService: v.localService,
      }));
  } catch {
    return [];
  }
}

export async function openAndroidTtsVoiceInstaller(): Promise<boolean> {
  if (!isNativeAndroidRuntime()) return false;
  try {
    await TextToSpeech.openInstall();
    return true;
  } catch {
    return false;
  }
}

export async function stopNativeOrDeviceTts(): Promise<void> {
  activeSpeechSessionId += 1;
  if (isNativeAndroidRuntime()) {
    try {
      await TextToSpeech.stop();
    } catch {
      // ignore if idle
    }
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

function getPersonaTuning(personaHint?: string): { pitch: number; slotOffset: number } {
  const key = (personaHint || '').replace(/^persona:/i, '').toLowerCase();
  switch (key) {
    case 'charon':
    case 'orus':
      return { pitch: 0.85, slotOffset: 1 };
    case 'fenrir':
    case 'umbriel':
      return { pitch: 0.89, slotOffset: 2 };
    case 'gacrux':
    case 'algieba':
      return { pitch: 0.94, slotOffset: 3 };
    case 'leda':
    case 'sulafat':
      return { pitch: 1.03, slotOffset: 4 };
    case 'aoede':
    case 'despina':
      return { pitch: 1.05, slotOffset: 5 };
    case 'zephyr':
    case 'puck':
      return { pitch: 1.02, slotOffset: 6 };
    default:
      return { pitch: 1.0, slotOffset: 0 };
  }
}

function splitSpeechChunks(text: string, maxChunkLen = 900): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= maxChunkLen) return [clean];

  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < clean.length) {
    const remaining = clean.length - cursor;
    if (remaining <= maxChunkLen) {
      chunks.push(clean.slice(cursor).trim());
      break;
    }
    const slice = clean.slice(cursor, cursor + maxChunkLen);
    let breakAt = Math.max(
      slice.lastIndexOf('. '),
      slice.lastIndexOf('! '),
      slice.lastIndexOf('? '),
      slice.lastIndexOf('; '),
      slice.lastIndexOf(', ')
    );
    if (breakAt < maxChunkLen * 0.35) {
      breakAt = slice.lastIndexOf(' ');
    }
    if (breakAt <= 0) {
      breakAt = maxChunkLen;
    } else {
      breakAt += 1;
    }
    chunks.push(clean.slice(cursor, cursor + breakAt).trim());
    cursor += breakAt;
  }
  return chunks.filter(Boolean);
}

export async function speakWithNativeOrDeviceTts(params: {
  text: string;
  rate: number;
  preferredVoiceUri?: string;
  languageHint?: string;
  personaHint?: string;
  onStart?: () => void;
  onDone?: () => void;
  onError?: (message: string) => void;
}): Promise<void> {
  const { text, rate, preferredVoiceUri, languageHint, personaHint, onStart, onDone, onError } = params;
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (!cleanText) {
    onError?.('No readable text on this page.');
    return;
  }

  const sessionId = ++activeSpeechSessionId;

  const guessLangPrefix = () => {
    if (languageHint && /es|span/i.test(languageHint)) return 'es';
    if (languageHint && /en/i.test(languageHint)) return 'en';
    if (/[áéíóúñ¿¡]/i.test(cleanText)) return 'es';
    return 'en';
  };

  const targetPrefix = guessLangPrefix();
  const effectivePersona =
    personaHint ||
    (preferredVoiceUri?.startsWith('persona:') ? preferredVoiceUri.slice(8) : undefined);
  const { pitch, slotOffset } = getPersonaTuning(effectivePersona);
  const clampedRate = Math.min(2.0, Math.max(0.5, rate));
  const chunks = splitSpeechChunks(cleanText, 900);

  if (isNativeAndroidRuntime()) {
    try {
      const voices = await fetchNativeAndroidVoicesWithRetry();
      if (sessionId !== activeSpeechSessionId) return;

      let supportedLangs: string[] = [];
      try {
        const langRes = await TextToSpeech.getSupportedLanguages();
        supportedLangs = langRes?.languages || [];
      } catch {
        supportedLangs = [];
      }

      let voiceIndex: number | undefined;
      let resolvedLang = targetPrefix === 'es' ? 'es-ES' : 'en-US';

      if (voices.length > 0) {
        const directUri =
          preferredVoiceUri && !preferredVoiceUri.startsWith('persona:') && preferredVoiceUri !== 'Default'
            ? preferredVoiceUri
            : undefined;

        const exactIdx = directUri
          ? voices.findIndex((v) => v.voiceURI === directUri || v.name === directUri)
          : -1;

        if (exactIdx >= 0) {
          voiceIndex = exactIdx;
          if (voices[exactIdx].lang) resolvedLang = voices[exactIdx].lang;
        } else {
          // Collect all voices matching the language prefix (prefer offline local voices)
          const matchingIndices: number[] = [];
          const offlineIndices: number[] = [];
          voices.forEach((v, idx) => {
            if ((v.lang || '').toLowerCase().startsWith(targetPrefix)) {
              matchingIndices.push(idx);
              const isLocal =
                typeof v.localService === 'boolean'
                  ? v.localService
                  : !/network/i.test(v.voiceURI || '');
              if (isLocal) offlineIndices.push(idx);
            }
          });

          const pool = offlineIndices.length > 0 ? offlineIndices : matchingIndices;
          if (pool.length > 0) {
            const chosenIdx = pool[slotOffset % pool.length];
            voiceIndex = chosenIdx;
            if (voices[chosenIdx].lang) resolvedLang = voices[chosenIdx].lang;
          } else {
            voiceIndex = 0;
            if (voices[0].lang) resolvedLang = voices[0].lang;
          }
        }
      } else if (supportedLangs.length > 0) {
        const matchedLang =
          supportedLangs.find((l) => l.toLowerCase().startsWith(targetPrefix)) || supportedLangs[0];
        if (matchedLang) resolvedLang = matchedLang;
      }

      onStart?.();
      for (let i = 0; i < chunks.length; i += 1) {
        if (sessionId !== activeSpeechSessionId) return;
        await TextToSpeech.speak({
          text: chunks[i],
          lang: resolvedLang,
          rate: clampedRate,
          pitch,
          volume: 1.0,
          voice: voiceIndex,
          category: 'playback',
        });
      }
      if (sessionId === activeSpeechSessionId) {
        onDone?.();
      }
      return;
    } catch (err) {
      // Only fall through to speechSynthesis if speechSynthesis is actually supported;
      // otherwise surface a clear helpful message.
      if (
        typeof window === 'undefined' ||
        !('speechSynthesis' in window) ||
        (window.speechSynthesis.getVoices() || []).length === 0
      ) {
        if (sessionId === activeSpeechSessionId) {
          const msg =
            err instanceof Error && err.message
              ? `Android TTS error: ${err.message}. Tap "Install Android HD Voices" in AI Voices if no voice pack is downloaded.`
              : 'Android Speech engine is unavailable. Tap "Install Android HD Voices" in AI Voices.';
          onError?.(msg);
        }
        return;
      }
    }
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onError?.('Speech synthesis is unavailable on this device.');
    return;
  }

  const voices = window.speechSynthesis.getVoices();
  const directUri =
    preferredVoiceUri && !preferredVoiceUri.startsWith('persona:') && preferredVoiceUri !== 'Default'
      ? preferredVoiceUri
      : undefined;

  const langMatches = voices.filter((v) => v.lang.toLowerCase().startsWith(targetPrefix));
  const naturalLangMatches = langMatches.filter((v) =>
    /natural|neural|google|samantha|daniel|aria|jenny|monica|paulina/i.test(v.name)
  );
  const pool =
    naturalLangMatches.length > 0
      ? naturalLangMatches
      : langMatches.length > 0
        ? langMatches
        : voices;

  const selected =
    (directUri
      ? voices.find((v) => v.voiceURI === directUri || v.name === directUri)
      : undefined) ||
    (pool.length > 0 ? pool[slotOffset % pool.length] : undefined) ||
    voices[0];

  onStart?.();

  const speakChunkAt = (idx: number) => {
    if (sessionId !== activeSpeechSessionId) return;
    if (idx >= chunks.length) {
      onDone?.();
      return;
    }
    const utter = new SpeechSynthesisUtterance(chunks[idx]);
    utter.rate = clampedRate;
    utter.pitch = pitch;
    if (selected) {
      utter.voice = selected;
      utter.lang = selected.lang;
    } else {
      utter.lang = targetPrefix === 'es' ? 'es-ES' : 'en-US';
    }
    utter.onend = () => {
      if (sessionId === activeSpeechSessionId) {
        speakChunkAt(idx + 1);
      }
    };
    utter.onerror = () => {
      if (sessionId === activeSpeechSessionId) {
        onError?.('Unable to read this page aloud.');
      }
    };
    window.speechSynthesis.speak(utter);
  };

  speakChunkAt(0);
}
