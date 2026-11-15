import { PdfReadingMode, PdfThemeId } from '../types';

/**
 * Pure Web Audio API Page-Turn & UI Sound Engine
 * Synthesizes crisp paper flips, medieval parchment rustles,
 * arcane magic chimes, and futuristic hologram pulses per universe theme.
 */

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    sharedCtx = new AudioCtx();
  }
  if (sharedCtx.state === 'suspended') {
    void sharedCtx.resume().catch(() => undefined);
  }
  return sharedCtx;
}

function createNoiseBuffer(ctx: AudioContext, durationSec: number, type: 'white' | 'pink' | 'brown'): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  if (type === 'white') {
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  } else if (type === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  } else {
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.03 * white) / 1.03;
      lastOut = data[i];
      data[i] *= 3.2;
    }
  }
  return buffer;
}

/**
 * Heavy medieval parchment / vellum unfurl & page rustle
 */
function playParchmentRustle(ctx: AudioContext) {
  const now = ctx.currentTime;

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = createNoiseBuffer(ctx, 0.34, 'pink');

  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.setValueAtTime(1.4, now);
  band.frequency.setValueAtTime(520, now);
  band.frequency.exponentialRampToValueAtTime(1650, now + 0.11);
  band.frequency.exponentialRampToValueAtTime(420, now + 0.32);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.32, now + 0.045);
  gain.gain.exponentialRampToValueAtTime(0.14, now + 0.18);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

  noiseSrc.connect(band).connect(gain).connect(ctx.destination);
  noiseSrc.start(now);
  noiseSrc.stop(now + 0.35);

  const crinkleOffsets = [0.03, 0.12, 0.21];
  for (const offset of crinkleOffsets) {
    const crinkle = ctx.createBufferSource();
    crinkle.buffer = createNoiseBuffer(ctx, 0.055, 'white');

    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(2400 + Math.random() * 1100, now + offset);
    hp.Q.setValueAtTime(3.2, now + offset);

    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.001, now + offset);
    cg.gain.linearRampToValueAtTime(0.14, now + offset + 0.01);
    cg.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.05);

    crinkle.connect(hp).connect(cg).connect(ctx.destination);
    crinkle.start(now + offset);
    crinkle.stop(now + offset + 0.055);
  }

  const thud = ctx.createOscillator();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(105, now + 0.18);
  thud.frequency.exponentialRampToValueAtTime(42, now + 0.29);

  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.001, now + 0.18);
  tg.gain.linearRampToValueAtTime(0.11, now + 0.195);
  tg.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  thud.connect(tg).connect(ctx.destination);
  thud.start(now + 0.18);
  thud.stop(now + 0.31);
}

/**
 * Mystical Tome / Arcane Parchment Shimmer
 */
function playArcaneParchmentTurn(ctx: AudioContext) {
  playParchmentRustle(ctx);
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(660, now + 0.02);
  osc.frequency.exponentialRampToValueAtTime(990, now + 0.2);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, now + 0.02);
  g.gain.linearRampToValueAtTime(0.045, now + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

  osc.connect(g).connect(ctx.destination);
  osc.start(now + 0.02);
  osc.stop(now + 0.25);
}

/**
 * Sci-fi Holographic / Cyber page projection pulse
 */
function playHologramPagePulse(ctx: AudioContext) {
  const now = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = 'sine';
  osc2.type = 'triangle';

  osc1.frequency.setValueAtTime(480, now);
  osc1.frequency.exponentialRampToValueAtTime(920, now + 0.14);

  osc2.frequency.setValueAtTime(720, now);
  osc2.frequency.exponentialRampToValueAtTime(1380, now + 0.14);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.085, now + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  osc1.connect(g);
  osc2.connect(g);
  g.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.23);
  osc2.stop(now + 0.23);

  const sweep = ctx.createBufferSource();
  sweep.buffer = createNoiseBuffer(ctx, 0.16, 'white');
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.setValueAtTime(4.5, now);
  bp.frequency.setValueAtTime(1600, now);
  bp.frequency.exponentialRampToValueAtTime(4600, now + 0.15);

  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.001, now);
  sg.gain.linearRampToValueAtTime(0.07, now + 0.02);
  sg.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

  sweep.connect(bp).connect(sg).connect(ctx.destination);
  sweep.start(now);
  sweep.stop(now + 0.16);
}

/**
 * Crisp modern paper page flip
 */
function playCrispPaperTurn(ctx: AudioContext) {
  const now = ctx.currentTime;
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = createNoiseBuffer(ctx, 0.2, 'pink');

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.setValueAtTime(1.1, now);
  filter.frequency.setValueAtTime(950, now);
  filter.frequency.exponentialRampToValueAtTime(2400, now + 0.08);
  filter.frequency.exponentialRampToValueAtTime(750, now + 0.19);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.22, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

  noiseSrc.connect(filter).connect(gain).connect(ctx.destination);
  noiseSrc.start(now);
  noiseSrc.stop(now + 0.2);
}

const PARCHMENT_THEMES = new Set<PdfThemeId>([
  'medieval',
  'vinland-saga',
  'berserk',
  'castlevania',
  'dune',
  'steampunk',
]);

const ARCANE_THEMES = new Set<PdfThemeId>([
  'dnd',
  'magical-forest',
  'harry-potter',
  'arcane',
  'avatar',
]);

const HOLO_THEMES = new Set<PdfThemeId>([
  'space',
  'blade-runner',
  'cyberpunk-2077',
  'ghost-in-the-shell',
  'neo-evangelion',
  'ready-player-one',
  'ben-10',
  'green-lanterns',
  'avengers',
  'justice-league',
]);

export function playPageTurnSound(theme: PdfThemeId, readingMode: PdfReadingMode): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (readingMode === 'parchment' || PARCHMENT_THEMES.has(theme)) {
    playParchmentRustle(ctx);
  } else if (ARCANE_THEMES.has(theme)) {
    playArcaneParchmentTurn(ctx);
  } else if (HOLO_THEMES.has(theme)) {
    playHologramPagePulse(ctx);
  } else {
    playCrispPaperTurn(ctx);
  }
}

export function playBookmarkSound(theme: PdfThemeId): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const isHolo = HOLO_THEMES.has(theme);
  osc.type = isHolo ? 'sine' : 'triangle';
  osc.frequency.setValueAtTime(isHolo ? 880 : 587.33, now);
  osc.frequency.exponentialRampToValueAtTime(isHolo ? 1318.5 : 880, now + 0.09);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.16);
}
