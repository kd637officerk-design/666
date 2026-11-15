import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { DeviceVoiceOption } from './voiceReaders';

export const DEFAULT_CLOUD_TTS_ORIGIN =
  'https://ais-pre-iobwwoq4lomt4vax7zs6bl-854876328213.us-east1.run.app';

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

export async function listHybridDeviceVoices(): Promise<DeviceVoiceOption[]> {
  if (isNativeAndroidRuntime()) {
    try {
      const { voices } = await TextToSpeech.getSupportedVoices();
      return (voices || [])
        .map((v) => ({
          voiceURI: v.voiceURI || v.name,
          name: v.name,
          lang: v.lang || 'en-US',
        }))
        .sort((a, b) => {
          const aNat = /network|natural|neural|google|wavenet|studio/i.test(a.name) ? 0 : 1;
          const bNat = /network|natural|neural|google|wavenet|studio/i.test(b.name) ? 0 : 1;
          if (aNat !== bNat) return aNat - bNat;
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
        name: v.name,
        lang: v.lang,
      }));
  } catch {
    return [];
  }
}

export async function stopNativeOrDeviceTts(): Promise<void> {
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

export async function speakWithNativeOrDeviceTts(params: {
  text: string;
  rate: number;
  preferredVoiceUri?: string;
  languageHint?: string;
  onStart?: () => void;
  onDone?: () => void;
  onError?: (message: string) => void;
}): Promise<void> {
  const { text, rate, preferredVoiceUri, languageHint, onStart, onDone, onError } = params;
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (!cleanText) {
    onError?.('No readable text on this page.');
    return;
  }

  const guessLang = () => {
    if (languageHint && /es|span/i.test(languageHint)) return 'es-ES';
    if (languageHint && /en/i.test(languageHint)) return 'en-US';
    // Quick heuristic for Spanish passages when set to Auto
    if (/[áéíóúñ¿¡]/i.test(cleanText)) return 'es-ES';
    return 'en-US';
  };

  if (isNativeAndroidRuntime()) {
    try {
      const { voices } = await TextToSpeech.getSupportedVoices();
      const targetLang = guessLang();
      let voiceIndex: number | undefined;
      if (voices && voices.length > 0) {
        const exactIdx = preferredVoiceUri
          ? voices.findIndex(
              (v) => v.voiceURI === preferredVoiceUri || v.name === preferredVoiceUri
            )
          : -1;
        if (exactIdx >= 0) {
          voiceIndex = exactIdx;
        } else {
          const langPrefix = targetLang.slice(0, 2).toLowerCase();
          const bestIdx = voices.findIndex(
            (v) =>
              v.lang?.toLowerCase().startsWith(langPrefix) &&
              /network|neural|natural|google|wavenet/i.test(v.name)
          );
          const langIdx =
            bestIdx >= 0
              ? bestIdx
              : voices.findIndex((v) => v.lang?.toLowerCase().startsWith(langPrefix));
          if (langIdx >= 0) voiceIndex = langIdx;
        }
      }

      onStart?.();
      await TextToSpeech.speak({
        text: cleanText.slice(0, 3800),
        lang: targetLang,
        rate: Math.min(2.0, Math.max(0.5, rate)),
        pitch: 1.0,
        volume: 1.0,
        voice: voiceIndex,
        category: 'playback',
      });
      onDone?.();
      return;
    } catch {
      // Fall through to browser speechSynthesis if plugin fails
    }
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onError?.('Speech synthesis is unavailable on this device.');
    return;
  }

  const utter = new SpeechSynthesisUtterance(cleanText);
  utter.rate = Math.min(2.0, Math.max(0.5, rate));
  const voices = window.speechSynthesis.getVoices();
  const targetLang = guessLang().slice(0, 2).toLowerCase();
  const selected =
    (preferredVoiceUri
      ? voices.find((v) => v.voiceURI === preferredVoiceUri || v.name === preferredVoiceUri)
      : undefined) ||
    voices.find(
      (v) =>
        v.lang.toLowerCase().startsWith(targetLang) &&
        /natural|neural|google|samantha|daniel|aria|jenny|monica|paulina/i.test(v.name)
    ) ||
    voices.find((v) => /natural|neural|google|samantha|daniel|aria/i.test(v.name)) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(targetLang)) ||
    voices[0];
  if (selected) {
    utter.voice = selected;
    utter.lang = selected.lang;
  } else {
    utter.lang = guessLang();
  }
  utter.onend = () => onDone?.();
  utter.onerror = () => onError?.('Unable to read this page aloud.');
  onStart?.();
  window.speechSynthesis.speak(utter);
}
