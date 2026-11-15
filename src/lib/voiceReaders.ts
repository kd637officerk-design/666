import { AiVoiceReaderProfile, GeminiTtsVoiceName } from '../types';

export interface GeminiNaturalVoiceMeta {
  id: GeminiTtsVoiceName;
  label: string;
  tone: string;
  defaultStyle: string;
}

export const GEMINI_NATURAL_VOICES: GeminiNaturalVoiceMeta[] = [
  {
    id: 'Kore',
    label: 'Kore',
    tone: 'Warm · Clear Female Narrator',
    defaultStyle: 'Warm, natural, clear audiobook narrator with steady pacing',
  },
  {
    id: 'Zephyr',
    label: 'Zephyr',
    tone: 'Bright · Crisp & Articulate',
    defaultStyle: 'Bright, crisp, expressive reader suited for study notes and articles',
  },
  {
    id: 'Puck',
    label: 'Puck',
    tone: 'Lively · Conversational Storyteller',
    defaultStyle: 'Engaging, lively, natural storyteller with warm inflection',
  },
  {
    id: 'Charon',
    label: 'Charon',
    tone: 'Deep · Calm & Grounded Male',
    defaultStyle: 'Deep, calm, measured documentary narrator',
  },
  {
    id: 'Fenrir',
    label: 'Fenrir',
    tone: 'Rich · Dramatic Fiction Voice',
    defaultStyle: 'Rich, dramatic, resonant fiction and dark fantasy narrator',
  },
  {
    id: 'Aoede',
    label: 'Aoede',
    tone: 'Lyrical · Smooth & Poetic',
    defaultStyle: 'Lyrical, graceful, expressive literary narrator',
  },
  {
    id: 'Leda',
    label: 'Leda',
    tone: 'Gentle · Soft-Spoken & Soothing',
    defaultStyle: 'Gentle, calm, soothing voice with unhurried rhythm',
  },
  {
    id: 'Orus',
    label: 'Orus',
    tone: 'Steady · Authoritative Chronicle',
    defaultStyle: 'Steady, authoritative, composed narrator for history and lore',
  },
  {
    id: 'Sulafat',
    label: 'Sulafat',
    tone: 'Velvet · Warm Evening Reader',
    defaultStyle: 'Warm, relaxed, intimate evening book reader',
  },
  {
    id: 'Gacrux',
    label: 'Gacrux',
    tone: 'Mature · Thoughtful Essayist',
    defaultStyle: 'Mature, thoughtful, clear narrator for essays and research',
  },
  {
    id: 'Umbriel',
    label: 'Umbriel',
    tone: 'Atmospheric · Noir & Mystery',
    defaultStyle: 'Low-key, atmospheric, intriguing noir and mystery narrator',
  },
  {
    id: 'Despina',
    label: 'Despina',
    tone: 'Friendly · Natural & Fluent',
    defaultStyle: 'Friendly, fluent, effortless conversational reader',
  },
  {
    id: 'Vindemiatrix',
    label: 'Vindemiatrix',
    tone: 'Reflective · Calm Academic',
    defaultStyle: 'Calm, reflective, deliberate academic reader',
  },
  {
    id: 'Enceladus',
    label: 'Enceladus',
    tone: 'Breathy · Intimate & Atmospheric',
    defaultStyle: 'Soft, atmospheric, immersive sci-fi and lore voice',
  },
  {
    id: 'Algieba',
    label: 'Algieba',
    tone: 'Smooth · Classic Broadcast',
    defaultStyle: 'Smooth, balanced classic audiobook voice',
  },
];

export const DEFAULT_AI_VOICE_READERS: AiVoiceReaderProfile[] = [
  {
    id: 'builtin:kore-audiobook',
    name: 'Kore · Warm Audiobook',
    engine: 'gemini-tts',
    voiceName: 'Kore',
    stylePrompt: 'Warm, natural, clear audiobook narrator with steady phrasing',
    rate: 1,
    language: 'Auto (EN / ES)',
    notes: 'Balanced all-purpose natural narrator for novels and essays.',
    isBuiltIn: true,
    createdAt: 1,
  },
  {
    id: 'builtin:charon-chronicle',
    name: 'Charon · Deep Chronicle',
    engine: 'gemini-tts',
    voiceName: 'Charon',
    stylePrompt: 'Deep, calm, measured documentary and fantasy lore narrator',
    rate: 0.95,
    language: 'Auto (EN / ES)',
    notes: 'Ideal for dark fantasy, Dune, Vinland Saga, and historical PDFs.',
    isBuiltIn: true,
    createdAt: 2,
  },
  {
    id: 'builtin:aoede-literary',
    name: 'Aoede · Literary Reader',
    engine: 'gemini-tts',
    voiceName: 'Aoede',
    stylePrompt: 'Lyrical, smooth, expressive literary narrator with gentle pauses',
    rate: 1,
    language: 'Auto (EN / ES)',
    notes: 'Expressive natural voice for fiction, poetry, and philosophy.',
    isBuiltIn: true,
    createdAt: 3,
  },
  {
    id: 'builtin:zephyr-study',
    name: 'Zephyr · Study & Focus',
    engine: 'gemini-tts',
    voiceName: 'Zephyr',
    stylePrompt: 'Bright, crisp, articulate academic reader for technical PDFs',
    rate: 1.05,
    language: 'Auto (EN / ES)',
    notes: 'Crisp diction for textbooks, papers, and study notes.',
    isBuiltIn: true,
    createdAt: 4,
  },
  {
    id: 'builtin:fenrir-dramatic',
    name: 'Fenrir · Dramatic Saga',
    engine: 'gemini-tts',
    voiceName: 'Fenrir',
    stylePrompt: 'Rich, dramatic, resonant fiction voice for intense chapters',
    rate: 1,
    language: 'Auto (EN / ES)',
    notes: 'Dramatic weight for Berserk, Gotham, and action chapters.',
    isBuiltIn: true,
    createdAt: 5,
  },
  {
    id: 'builtin:puck-storyteller',
    name: 'Puck · Lively Storyteller',
    engine: 'gemini-tts',
    voiceName: 'Puck',
    stylePrompt: 'Lively, engaging, natural storyteller with dynamic pacing',
    rate: 1.05,
    language: 'Auto (EN / ES)',
    notes: 'Great for dialogue-heavy books, comics scripts, and light novels.',
    isBuiltIn: true,
    createdAt: 6,
  },
  {
    id: 'builtin:leda-night',
    name: 'Leda · Soft Night Reader',
    engine: 'gemini-tts',
    voiceName: 'Leda',
    stylePrompt: 'Gentle, calm, soft-spoken late-night reader',
    rate: 0.92,
    language: 'Auto (EN / ES)',
    notes: 'Unobtrusive calm voice for late-night reading.',
    isBuiltIn: true,
    createdAt: 7,
  },
  {
    id: 'builtin:umbriel-noir',
    name: 'Umbriel · Noir & Sci-Fi',
    engine: 'gemini-tts',
    voiceName: 'Umbriel',
    stylePrompt: 'Atmospheric, calm, intriguing cyberpunk and noir narrator',
    rate: 0.98,
    language: 'Auto (EN / ES)',
    notes: 'Moody tone for Blade Runner, Cyberpunk, and mystery PDFs.',
    isBuiltIn: true,
    createdAt: 8,
  },
];

export interface DeviceVoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
  localService?: boolean;
  rawId?: string;
}

export const OFFLINE_STARTER_VOICE_PACK: AiVoiceReaderProfile[] = [
  {
    id: 'pack:offline-us-warm',
    name: 'English (US) · Warm Storyteller',
    engine: 'device-tts',
    voiceName: 'persona:Kore',
    stylePrompt: 'Warm, steady English offline audiobook narrator',
    rate: 1.0,
    language: 'English (en-US)',
    notes: 'Works 100% offline using your phone speech engine.',
    isBuiltIn: false,
    createdAt: 1001,
  },
  {
    id: 'pack:offline-us-deep',
    name: 'English (US) · Deep Chronicle',
    engine: 'device-tts',
    voiceName: 'persona:Charon',
    stylePrompt: 'Deep, calm, measured narrator for fantasy and history',
    rate: 0.94,
    language: 'English (en-US)',
    notes: 'Tuned deeper tone for Android offline voice.',
    isBuiltIn: false,
    createdAt: 1002,
  },
  {
    id: 'pack:offline-en-crisp',
    name: 'English · Crisp Study Reader',
    engine: 'device-tts',
    voiceName: 'persona:Zephyr',
    stylePrompt: 'Clear, slightly faster narrator for technical PDFs',
    rate: 1.08,
    language: 'English (en-US)',
    notes: 'Great for articles, study notes, and documentation.',
    isBuiltIn: false,
    createdAt: 1003,
  },
  {
    id: 'pack:offline-es-warm',
    name: 'Español · Narrador Natural',
    engine: 'device-tts',
    voiceName: 'persona:Aoede',
    stylePrompt: 'Voz cálida y fluida en español para libros y novelas',
    rate: 1.0,
    language: 'Spanish (es)',
    notes: 'Lee PDFs en español sin internet usando voces del teléfono.',
    isBuiltIn: false,
    createdAt: 1004,
  },
  {
    id: 'pack:offline-es-deep',
    name: 'Español · Crónica Profunda',
    engine: 'device-tts',
    voiceName: 'persona:Fenrir',
    stylePrompt: 'Voz grave y pausada para fantasía y misterio',
    rate: 0.95,
    language: 'Spanish (es)',
    notes: 'Tono grave optimizado para capítulos largos.',
    isBuiltIn: false,
    createdAt: 1005,
  },
  {
    id: 'pack:offline-night-soft',
    name: 'Soft Late-Night Reader (Auto EN/ES)',
    engine: 'device-tts',
    voiceName: 'persona:Leda',
    stylePrompt: 'Gentle, unhurried late-night reader that auto-detects language',
    rate: 0.92,
    language: 'Auto (EN / ES)',
    notes: 'Automatically switches between English and Spanish pages.',
    isBuiltIn: false,
    createdAt: 1006,
  },
];

export function getDeviceNaturalVoices(): DeviceVoiceOption[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  try {
    const raw = window.speechSynthesis.getVoices() || [];
    const sorted = [...raw].sort((a, b) => {
      const aNatural = /natural|neural|google|samantha|daniel|aria|jenny|monica|paulina/i.test(a.name)
        ? 0
        : 1;
      const bNatural = /natural|neural|google|samantha|daniel|aria|jenny|monica|paulina/i.test(b.name)
        ? 0
        : 1;
      if (aNatural !== bNatural) return aNatural - bNatural;
      return a.name.localeCompare(b.name);
    });
    return sorted.map((v) => ({
      voiceURI: v.voiceURI || v.name,
      name: v.name,
      lang: v.lang,
      localService: v.localService,
    }));
  } catch {
    return [];
  }
}
