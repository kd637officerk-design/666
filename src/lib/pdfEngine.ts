import type { PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { DiyPdfThemeConfig, PdfThemeId, UniverseAmbientKind } from '../types';

let pdfjsPromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null;

async function getPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      return lib;
    });
  }
  return pdfjsPromise;
}

export interface PdfThemePreset {
  id: Exclude<PdfThemeId, 'diy'>;
  label: string;
  emblem: string;
  subtitle: string;
  bgClass: string;
  surfaceClass: string;
  borderClass: string;
  accentColor: string;
  glowColor: string;
  textColor: string;
  canvasFilter: string;
  pageBorder: string;
  headerBadge: string;
  ambientKind: UniverseAmbientKind;
  isHologramStyle?: boolean;
  isParchmentStyle?: boolean;
  aiPrompt: string;
}

export const PDF_THEME_PRESETS: Record<Exclude<PdfThemeId, 'diy'>, PdfThemePreset> = {
  'vinland-saga': {
    id: 'vinland-saga',
    label: 'Vinland Saga',
    emblem: '🪓',
    subtitle: 'Nordic fjord mist, drifting frost & amber hearthlight',
    bgClass: 'bg-[#070b10]',
    surfaceClass: 'bg-[#0e151f]/90',
    borderClass: 'border-sky-300/30',
    accentColor: '#60a5fa',
    glowColor: 'rgba(96, 165, 250, 0.35)',
    textColor: '#f1f5f9',
    canvasFilter: 'contrast(1.08) saturate(0.92) brightness(0.96)',
    pageBorder: '1px solid rgba(148, 163, 184, 0.45)',
    headerBadge: 'North Sea Fjord',
    ambientKind: 'snow-fjord',
    isParchmentStyle: true,
    aiPrompt:
      'Atmospheric dark Nordic fjord landscape at twilight, wooden longship moored in icy mist, faint aurora borealis, falling snow, dramatic moody painting, high contrast, no text, no watermark.',
  },
  dune: {
    id: 'dune',
    label: 'Dune',
    emblem: '🏜️',
    subtitle: 'Arrakis golden spice storm & twin-moon desert horizon',
    bgClass: 'bg-[#120b05]',
    surfaceClass: 'bg-[#1e1208]/92',
    borderClass: 'border-amber-500/40',
    accentColor: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.38)',
    textColor: '#fef3c7',
    canvasFilter: 'sepia(0.32) contrast(1.1) brightness(0.95)',
    pageBorder: '1px solid rgba(245, 158, 11, 0.5)',
    headerBadge: 'Arrakis Spice',
    ambientKind: 'spice-desert',
    isParchmentStyle: true,
    aiPrompt:
      'Monumental dark desert dunes under a burning amber sky, shimmering golden spice dust storm, brutalist monolith stone citadel in silhouette, twin moons on horizon, epic sci-fi cinema lighting, no text.',
  },
  berserk: {
    id: 'berserk',
    label: 'Berserk',
    emblem: '🌑',
    subtitle: 'Crimson Eclipse, obsidian iron & drifting ash embers',
    bgClass: 'bg-[#0b0406]',
    surfaceClass: 'bg-[#17080c]/92',
    borderClass: 'border-red-600/45',
    accentColor: '#dc2626',
    glowColor: 'rgba(220, 38, 38, 0.45)',
    textColor: '#fee2e2',
    canvasFilter: 'grayscale(35%) contrast(1.24) brightness(0.92)',
    pageBorder: '1px solid rgba(220, 38, 38, 0.55)',
    headerBadge: 'Crimson Eclipse',
    ambientKind: 'eclipse-embers',
    isParchmentStyle: true,
    aiPrompt:
      'Dark gothic fantasy solar eclipse over jagged obsidian plains, crimson-red corona ring in stormy black clouds, drifting glowing embers and mist, dramatic chiaroscuro ink aesthetic, no text.',
  },
  'ben-10': {
    id: 'ben-10',
    label: 'Ben 10',
    emblem: '⌚',
    subtitle: 'Omnitrix emerald bio-matrix hexes & neon energy pulse',
    bgClass: 'bg-[#040d07]',
    surfaceClass: 'bg-[#08190e]/92',
    borderClass: 'border-emerald-400/40',
    accentColor: '#22c55e',
    glowColor: 'rgba(34, 197, 94, 0.42)',
    textColor: '#dcfce7',
    canvasFilter: 'contrast(1.08) saturate(1.14)',
    pageBorder: '1px solid rgba(34, 197, 94, 0.55)',
    headerBadge: 'Omnitrix Bio-Grid',
    ambientKind: 'cyber-matrix',
    isHologramStyle: true,
    aiPrompt:
      'Dark futuristic alien biotech chamber with glowing neon emerald green geometric energy rings and crystalline circuit conduits, sleek obsidian surfaces, atmospheric sci-fi glow, no text.',
  },
  gotham: {
    id: 'gotham',
    label: 'Gotham',
    emblem: '🦇',
    subtitle: 'Noir midnight rain, sodium mist & rooftop searchlight',
    bgClass: 'bg-[#06070a]',
    surfaceClass: 'bg-[#0d1017]/92',
    borderClass: 'border-amber-400/35',
    accentColor: '#eab308',
    glowColor: 'rgba(234, 179, 8, 0.34)',
    textColor: '#f8fafc',
    canvasFilter: 'contrast(1.16) saturate(0.85) brightness(0.94)',
    pageBorder: '1px solid rgba(234, 179, 8, 0.45)',
    headerBadge: 'Gotham Rain Noir',
    ambientKind: 'noir-storm',
    aiPrompt:
      'Rain-drenched neo-gothic metropolis skyline at midnight, towering gargoyle rooftops in fog, distant amber searchlight beam cutting through dark storm clouds, moody detective noir cinematography, no text.',
  },
  'justice-league': {
    id: 'justice-league',
    label: 'Justice League',
    emblem: '⚡',
    subtitle: 'Watchtower orbital gold & cosmic cobalt lattice',
    bgClass: 'bg-[#050812]',
    surfaceClass: 'bg-[#0b1224]/90',
    borderClass: 'border-blue-400/40',
    accentColor: '#3b82f6',
    glowColor: 'rgba(59, 130, 246, 0.42)',
    textColor: '#eff6ff',
    canvasFilter: 'contrast(1.1) saturate(1.12)',
    pageBorder: '1px solid rgba(59, 130, 246, 0.5)',
    headerBadge: 'Watchtower Orbit',
    ambientKind: 'orbital-hud',
    isHologramStyle: true,
    aiPrompt:
      'Sleek orbital space station observation deck overlooking curved Earth below, deep cosmic blue starlight and subtle golden architectural rim lighting, heroic futuristic grandeur, no text.',
  },
  avengers: {
    id: 'avengers',
    label: 'The Avengers',
    emblem: '🛡️',
    subtitle: 'Stark holographic arc rings & tactical obsidian HUD',
    bgClass: 'bg-[#070913]',
    surfaceClass: 'bg-[#101426]/90',
    borderClass: 'border-cyan-400/40',
    accentColor: '#06b6d4',
    glowColor: 'rgba(6, 182, 212, 0.42)',
    textColor: '#ecfeff',
    canvasFilter: 'contrast(1.08) saturate(1.15)',
    pageBorder: '1px solid rgba(6, 182, 212, 0.5)',
    headerBadge: 'Stark Tactical HUD',
    ambientKind: 'orbital-hud',
    isHologramStyle: true,
    aiPrompt:
      'High-tech dark tactical command lab with glowing cyan concentric arc-reactor holographic projections hovering over brushed titanium tables, subtle crimson accents, sleek cinema lighting, no text.',
  },
  medieval: {
    id: 'medieval',
    label: 'Medieval Times',
    emblem: '🏰',
    subtitle: 'Old Europe candlelit oak & aged vellum parchment',
    bgClass: 'pdf-medieval-desk',
    surfaceClass: 'bg-[#1d130a]/92',
    borderClass: 'border-amber-700/45',
    accentColor: '#d97706',
    glowColor: 'rgba(217, 119, 6, 0.38)',
    textColor: '#fef3c7',
    canvasFilter: 'sepia(0.55) contrast(1.08) brightness(0.92)',
    pageBorder: '1px solid rgba(146, 64, 14, 0.65)',
    headerBadge: 'Old Europe Vellum',
    ambientKind: 'candle-embers',
    isParchmentStyle: true,
    aiPrompt:
      'Atmospheric medieval European monastery library scriptorium at night, warm flickering tallow candlelight illuminating aged oak desks, stone arches in deep shadow, realistic oil painting atmosphere, no text.',
  },
  dnd: {
    id: 'dnd',
    label: 'D&D',
    emblem: '🐉',
    subtitle: 'Dungeon torchlight, arcane runes & dragonfire sparks',
    bgClass: 'bg-[#100807]',
    surfaceClass: 'bg-[#1d0e0c]/92',
    borderClass: 'border-orange-500/45',
    accentColor: '#ea580c',
    glowColor: 'rgba(234, 88, 12, 0.42)',
    textColor: '#ffedd5',
    canvasFilter: 'sepia(0.28) contrast(1.1) brightness(0.95)',
    pageBorder: '1px solid rgba(234, 88, 12, 0.55)',
    headerBadge: 'Dungeon Archive',
    ambientKind: 'candle-embers',
    isParchmentStyle: true,
    aiPrompt:
      'Ancient subterranean stone dungeon vault lit by glowing amber wall torches and faint arcane rune circles etched into dark stone floor, drifting embers and cavern mist, high fantasy concept art, no text.',
  },
  'magical-forest': {
    id: 'magical-forest',
    label: 'Magical Forest',
    emblem: '🌿',
    subtitle: 'Bioluminescent canopy mist & drifting golden fireflies',
    bgClass: 'bg-[#040e0a]',
    surfaceClass: 'bg-[#091c14]/90',
    borderClass: 'border-emerald-400/35',
    accentColor: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.38)',
    textColor: '#ecfdf5',
    canvasFilter: 'contrast(1.06) saturate(1.14)',
    pageBorder: '1px solid rgba(16, 185, 129, 0.48)',
    headerBadge: 'Enchanted Glade',
    ambientKind: 'bioluminescent',
    aiPrompt:
      'Enchanted ancient forest at night illuminated by bioluminescent emerald moss, glowing teal mushrooms, and golden fireflies drifting beneath silver moonlight shafts through giant roots, atmospheric fantasy art, no text.',
  },
  'blade-runner': {
    id: 'blade-runner',
    label: 'Blade Runner',
    emblem: '🌧️',
    subtitle: '2049 amber smog, cyan holograms & rain streaks',
    bgClass: 'bg-[#080a0f]',
    surfaceClass: 'bg-[#0e141c]/90',
    borderClass: 'border-cyan-400/40',
    accentColor: '#22d3ee',
    glowColor: 'rgba(34, 211, 238, 0.45)',
    textColor: '#ecfeff',
    canvasFilter: 'contrast(1.12) saturate(1.12) brightness(0.95)',
    pageBorder: '1px solid rgba(34, 211, 238, 0.52)',
    headerBadge: '2049 Off-World Noir',
    ambientKind: 'neon-rain',
    isHologramStyle: true,
    aiPrompt:
      'Monolithic brutalist cyberpunk megacity in torrential midnight rain, thick amber atmospheric haze pierced by cold cyan neon reflections on wet asphalt, dramatic Blade Runner 2049 cinematography, no text.',
  },
  'harry-potter': {
    id: 'harry-potter',
    label: 'Harry Potter',
    emblem: '✨',
    subtitle: 'Floating starlit candles & enchanted warm parchment',
    bgClass: 'bg-[#0e0a06]',
    surfaceClass: 'bg-[#1a130b]/92',
    borderClass: 'border-amber-400/40',
    accentColor: '#fbbf24',
    glowColor: 'rgba(251, 191, 36, 0.38)',
    textColor: '#fef3c7',
    canvasFilter: 'sepia(0.35) contrast(1.06) brightness(0.95)',
    pageBorder: '1px solid rgba(251, 191, 36, 0.5)',
    headerBadge: 'Astral Great Hall',
    ambientKind: 'candle-embers',
    isParchmentStyle: true,
    aiPrompt:
      'Cavernous gothic castle hall at night beneath an enchanted starry ceiling, hundreds of warm floating golden candles hovering in mid-air above dark oak tables, soft magical gold dust, cinematic warm lighting, no text.',
  },
  'cyberpunk-2077': {
    id: 'cyberpunk-2077',
    label: 'Cyberpunk 2077',
    emblem: '🌆',
    subtitle: 'Night City neon yellow, magenta & cyber rain',
    bgClass: 'bg-[#0b0712]',
    surfaceClass: 'bg-[#150c24]/92',
    borderClass: 'border-fuchsia-500/45',
    accentColor: '#facc15',
    glowColor: 'rgba(236, 72, 153, 0.45)',
    textColor: '#fef08a',
    canvasFilter: 'contrast(1.14) saturate(1.22)',
    pageBorder: '1px solid rgba(250, 204, 21, 0.55)',
    headerBadge: 'Night City Net',
    ambientKind: 'neon-rain',
    isHologramStyle: true,
    aiPrompt:
      'Rain-slicked futuristic Night City alleyway at midnight glowing with electric yellow, hot magenta, and cyan neon reflections, steam rising from vents, dense vertical cyber megastructures, no text.',
  },
  'maze-runner': {
    id: 'maze-runner',
    label: 'Maze Runner',
    emblem: '🧱',
    subtitle: 'Colossal moss-draped monolith walls & sky shafts',
    bgClass: 'bg-[#090c09]',
    surfaceClass: 'bg-[#131813]/92',
    borderClass: 'border-lime-500/35',
    accentColor: '#84cc16',
    glowColor: 'rgba(132, 204, 22, 0.35)',
    textColor: '#ecfccb',
    canvasFilter: 'contrast(1.1) saturate(0.95)',
    pageBorder: '1px solid rgba(132, 204, 22, 0.45)',
    headerBadge: 'Sector Glade Wall',
    ambientKind: 'monolith-shafts',
    aiPrompt:
      'Towering ancient brutalist concrete labyrinth corridors covered in cascading green ivy and moss, narrow shafts of dramatic sunlight slicing down through mist into dark stone passages, cinematic scale, no text.',
  },
  'ghost-in-the-shell': {
    id: 'ghost-in-the-shell',
    label: 'Ghost in the Shell',
    emblem: '👁️',
    subtitle: 'Section 9 optic phosphor, net-dive streams & rain',
    bgClass: 'bg-[#040c0b]',
    surfaceClass: 'bg-[#081715]/92',
    borderClass: 'border-teal-400/40',
    accentColor: '#2dd4bf',
    glowColor: 'rgba(45, 212, 191, 0.42)',
    textColor: '#ccfbf1',
    canvasFilter: 'contrast(1.12) saturate(1.08)',
    pageBorder: '1px solid rgba(45, 212, 191, 0.52)',
    headerBadge: 'Net-Dive Phosphor',
    ambientKind: 'cyber-matrix',
    isHologramStyle: true,
    aiPrompt:
      'Atmospheric 1995 anime cyberpunk metropolis canal in fog and rain, glowing teal and phosphor green holographic data streams reflecting over dark water, moody architectural silhouettes, no text.',
  },
  'neo-evangelion': {
    id: 'neo-evangelion',
    label: 'Neo Evangelion',
    emblem: '🤖',
    subtitle: 'NERV amber/crimson AT-Field hexes & tactical HUD',
    bgClass: 'bg-[#0b070c]',
    surfaceClass: 'bg-[#170b1a]/92',
    borderClass: 'border-orange-500/45',
    accentColor: '#f97316',
    glowColor: 'rgba(249, 115, 22, 0.45)',
    textColor: '#ffedd5',
    canvasFilter: 'contrast(1.15) saturate(1.15)',
    pageBorder: '1px solid rgba(249, 115, 22, 0.55)',
    headerBadge: 'NERV Magi HUD',
    ambientKind: 'orbital-hud',
    isHologramStyle: true,
    aiPrompt:
      'Colossal subterranean dark geofront command cavern with glowing amber and crimson octagonal AT-field wireframe shields and dramatic red emergency spotlights cutting through mist, stark sci-fi anime aesthetic, no text.',
  },
  'dc-absolute': {
    id: 'dc-absolute',
    label: 'DC Absolute Universe',
    emblem: '🔥',
    subtitle: 'Brutalist obsidian ink, stark crimson rim light & ash',
    bgClass: 'bg-[#070709]',
    surfaceClass: 'bg-[#121216]/94',
    borderClass: 'border-rose-500/45',
    accentColor: '#f43f5e',
    glowColor: 'rgba(244, 63, 94, 0.45)',
    textColor: '#fff1f2',
    canvasFilter: 'contrast(1.2) saturate(0.95) brightness(0.94)',
    pageBorder: '1px solid rgba(244, 63, 94, 0.55)',
    headerBadge: 'Absolute Dark Omega',
    ambientKind: 'eclipse-embers',
    aiPrompt:
      'Stark brutalist monochrome comic-noir cityscape torn by glowing crimson-red atmospheric rifts and drifting dark ash, dramatic high-contrast ink shadows and razor rim lighting, no text.',
  },
  'green-lanterns': {
    id: 'green-lanterns',
    label: 'Green Lanterns',
    emblem: '💍',
    subtitle: 'Oa emerald willpower rings & deep cosmic starlight',
    bgClass: 'bg-[#030b07]',
    surfaceClass: 'bg-[#071810]/90',
    borderClass: 'border-green-400/45',
    accentColor: '#4ade80',
    glowColor: 'rgba(74, 222, 128, 0.48)',
    textColor: '#dcfce7',
    canvasFilter: 'contrast(1.1) saturate(1.16)',
    pageBorder: '1px solid rgba(74, 222, 128, 0.6)',
    headerBadge: 'Oa Emerald Sector',
    ambientKind: 'cyber-matrix',
    isHologramStyle: true,
    aiPrompt:
      'Deep cosmic nebula glowing with radiant emerald-green willpower energy rings and crystalline citadel spires floating in star-filled space, dramatic sci-fi cosmic aura, no text.',
  },
  avatar: {
    id: 'avatar',
    label: 'Avatar: Last Airbender',
    emblem: '🌪️',
    subtitle: 'Four-elements spirit gold, wind currents & ember glow',
    bgClass: 'bg-[#0b0a07]',
    surfaceClass: 'bg-[#18150e]/92',
    borderClass: 'border-amber-400/40',
    accentColor: '#f59e0b',
    glowColor: 'rgba(56, 189, 248, 0.35)',
    textColor: '#fef3c7',
    canvasFilter: 'sepia(0.18) contrast(1.06) saturate(1.12)',
    pageBorder: '1px solid rgba(245, 158, 11, 0.5)',
    headerBadge: 'Four Elements Scroll',
    ambientKind: 'candle-embers',
    isParchmentStyle: true,
    aiPrompt:
      'Serene ancient mountain air temple cliffside above twilight clouds, glowing spirit-world golden mist, swirling wind ribbons and warm lantern light by calm water, painterly fantasy landscape, no text.',
  },
  castlevania: {
    id: 'castlevania',
    label: 'Castlevania',
    emblem: '🧛',
    subtitle: 'Crimson blood-moon spire, stained glass & night mist',
    bgClass: 'bg-[#0b0408]',
    surfaceClass: 'bg-[#190912]/92',
    borderClass: 'border-rose-500/45',
    accentColor: '#e11d48',
    glowColor: 'rgba(225, 29, 72, 0.45)',
    textColor: '#ffe4e6',
    canvasFilter: 'contrast(1.16) saturate(1.08) brightness(0.94)',
    pageBorder: '1px solid rgba(225, 29, 72, 0.52)',
    headerBadge: 'Dracula Spire Gothic',
    ambientKind: 'gothic-bats',
    isParchmentStyle: true,
    aiPrompt:
      'Towering gothic vampire castle perched on a cliff beneath an enormous glowing crimson blood moon, drifting silver mist, silhouetted bats flying across tattered night clouds, dark gothic anime aesthetic, no text.',
  },
  steampunk: {
    id: 'steampunk',
    label: 'Steampunk',
    emblem: '⚙️',
    subtitle: 'Brass clockwork gears, copper valves & warm steam',
    bgClass: 'bg-[#110c07]',
    surfaceClass: 'bg-[#1e150c]/92',
    borderClass: 'border-amber-500/45',
    accentColor: '#d97706',
    glowColor: 'rgba(217, 119, 6, 0.4)',
    textColor: '#fef3c7',
    canvasFilter: 'sepia(0.38) contrast(1.1) brightness(0.95)',
    pageBorder: '1px solid rgba(217, 119, 6, 0.55)',
    headerBadge: 'Brass Clockwork',
    ambientKind: 'clockwork-steam',
    isParchmentStyle: true,
    aiPrompt:
      'Intricate Victorian brass clockwork observatory interior filled with giant interlocking copper gears, glowing amber pressure gauges, rising wisps of warm steam and mahogany wood beams, dramatic chiaroscuro, no text.',
  },
  arcane: {
    id: 'arcane',
    label: 'Arcane',
    emblem: '💎',
    subtitle: 'Piltover Hextech sapphire & Zaun shimmer spores',
    bgClass: 'bg-[#070a12]',
    surfaceClass: 'bg-[#0e1526]/92',
    borderClass: 'border-sky-400/45',
    accentColor: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.45)',
    textColor: '#e0f2fe',
    canvasFilter: 'contrast(1.1) saturate(1.18)',
    pageBorder: '1px solid rgba(56, 189, 248, 0.55)',
    headerBadge: 'Hextech & Shimmer',
    ambientKind: 'hextech-arcane',
    isHologramStyle: true,
    aiPrompt:
      'Painterly stylized Steampunk-Arcane workshop blending Piltover brass-and-gold filigree with hovering glowing sapphire Hextech crystal runes and drifting neon teal mist below, Fortiche painterly brushstroke lighting, no text.',
  },
  'ready-player-one': {
    id: 'ready-player-one',
    label: 'Ready Player One',
    emblem: '🕶️',
    subtitle: 'OASIS synthwave neon horizon & retro prism grid',
    bgClass: 'bg-[#080514]',
    surfaceClass: 'bg-[#120b29]/90',
    borderClass: 'border-cyan-400/45',
    accentColor: '#e879f9',
    glowColor: 'rgba(232, 121, 249, 0.45)',
    textColor: '#fae8ff',
    canvasFilter: 'contrast(1.12) saturate(1.2)',
    pageBorder: '1px solid rgba(232, 121, 249, 0.55)',
    headerBadge: 'OASIS Synthwave',
    ambientKind: 'synth-oasis',
    isHologramStyle: true,
    aiPrompt:
      '1980s retro-futuristic virtual reality horizon landscape, glowing magenta and cyan laser grid receding toward a massive striped sunset moon and cosmic starfield, vibrant arcade synthwave atmosphere, no text.',
  },
  anime: {
    id: 'anime',
    label: 'Anime',
    emblem: '🌸',
    subtitle: 'Midnight ink, drifting sakura petals & cel-shaded glow',
    bgClass: 'bg-[#0b0914]',
    surfaceClass: 'bg-[#151126]/92',
    borderClass: 'border-rose-500/35',
    accentColor: '#f43f5e',
    glowColor: 'rgba(244, 63, 94, 0.38)',
    textColor: '#fdf2f8',
    canvasFilter: 'contrast(1.08) saturate(1.14)',
    pageBorder: '1px solid rgba(244, 63, 94, 0.42)',
    headerBadge: 'Anime Edition',
    ambientKind: 'bioluminescent',
    aiPrompt:
      'Atmospheric dark Tokyo shrine steps at midnight illuminated by glowing crimson lanterns and drifting luminous sakura cherry blossom petals against a starry indigo sky, Makoto Shinkai style lighting, no text.',
  },
  dc: {
    id: 'dc',
    label: 'DC',
    emblem: '🦇',
    subtitle: 'Nocturne slate, steel blue rain & amber beacon',
    bgClass: 'bg-[#06090f]',
    surfaceClass: 'bg-[#0e1522]/92',
    borderClass: 'border-sky-400/35',
    accentColor: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.36)',
    textColor: '#f0f9ff',
    canvasFilter: 'contrast(1.14) brightness(0.96)',
    pageBorder: '1px solid rgba(56, 189, 248, 0.42)',
    headerBadge: 'DC Nocturne',
    ambientKind: 'noir-storm',
    aiPrompt:
      'Dramatic dark metropolitan skyline at midnight under heavy steel-blue storm clouds, subtle rain streaks and silver moonlight grazing monumental art-deco skyscrapers, moody superhero cinema framing, no text.',
  },
  marvel: {
    id: 'marvel',
    label: 'Marvel',
    emblem: '🦸',
    subtitle: 'Comic bullpen crimson halftone & kinetic gold',
    bgClass: 'bg-[#100909]',
    surfaceClass: 'bg-[#1c1010]/92',
    borderClass: 'border-red-500/40',
    accentColor: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.42)',
    textColor: '#fef2f2',
    canvasFilter: 'saturate(1.18) contrast(1.06)',
    pageBorder: '2px solid rgba(239, 68, 68, 0.48)',
    headerBadge: 'Marvel Issue',
    ambientKind: 'orbital-hud',
    aiPrompt:
      'Dynamic cosmic marvel-inspired nebula rift above a dark futuristic skyline with glowing crimson and gold dimensional energy streaks, dramatic comic-book cinematic lighting, no text.',
  },
  twd: {
    id: 'twd',
    label: 'The Walking Dead',
    emblem: '🧟',
    subtitle: 'Survival monochrome ink, drifting ash & weathered oak',
    bgClass: 'bg-[#10110e]',
    surfaceClass: 'bg-[#191b16]/92',
    borderClass: 'border-amber-600/35',
    accentColor: '#d97706',
    glowColor: 'rgba(217, 119, 6, 0.34)',
    textColor: '#e7e5e4',
    canvasFilter: 'grayscale(100%) contrast(1.22) brightness(0.95)',
    pageBorder: '1px solid rgba(217, 119, 6, 0.42)',
    headerBadge: 'TWD Survival Ink',
    ambientKind: 'noir-storm',
    aiPrompt:
      'Desolate overgrown southern highway at dusk in muted charcoal and sepia survival tones, tangled pines silhouette, drifting bonfire ash in heavy fog, gritty graphic novel ink atmosphere, no text.',
  },
  space: {
    id: 'space',
    label: 'Space',
    emblem: '🚀',
    subtitle: 'Orbital cosmos & holographic page projection',
    bgClass: 'bg-[#030712]',
    surfaceClass: 'bg-[#060d1f]/88',
    borderClass: 'border-cyan-400/40',
    accentColor: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.48)',
    textColor: '#e0f2fe',
    canvasFilter: 'invert(0.91) hue-rotate(185deg) contrast(1.12) saturate(1.2)',
    pageBorder: '1px solid rgba(56, 189, 248, 0.55)',
    headerBadge: 'Space Hologram',
    ambientKind: 'space-hologram',
    isHologramStyle: true,
    aiPrompt:
      'Deep outer space cosmos view with luminous blue-violet nebula dust clouds, crisp pinpoint starlight and a distant ringed exoplanet rim-lit by a blue star, ultra-realistic space telescope depth, no text.',
  },
};

export const UNIVERSE_THEME_ORDER: Exclude<PdfThemeId, 'diy'>[] = [
  'vinland-saga',
  'dune',
  'berserk',
  'ben-10',
  'gotham',
  'justice-league',
  'avengers',
  'medieval',
  'dnd',
  'magical-forest',
  'blade-runner',
  'harry-potter',
  'cyberpunk-2077',
  'maze-runner',
  'ghost-in-the-shell',
  'neo-evangelion',
  'dc-absolute',
  'green-lanterns',
  'avatar',
  'castlevania',
  'steampunk',
  'arcane',
  'ready-player-one',
  'anime',
  'dc',
  'marvel',
  'twd',
  'space',
];

export function getDiyCanvasFilter(cfg: DiyPdfThemeConfig): string {
  switch (cfg.pageFilter) {
    case 'dark-invert':
      return 'invert(0.9) hue-rotate(180deg) contrast(1.05)';
    case 'sepia':
      return 'sepia(0.45) contrast(1.04) brightness(0.96)';
    case 'noir-ink':
      return 'grayscale(100%) contrast(1.25)';
    case 'vibrant':
      return 'saturate(1.25) contrast(1.06)';
    default:
      return 'none';
  }
}

export async function closePdfDocument(pdf: PDFDocumentProxy | null): Promise<void> {
  if (!pdf) return;
  const p = pdf as unknown as { destroy?: () => Promise<void>; cleanup?: () => Promise<void> };
  if (typeof p.destroy === 'function') await p.destroy();
  else if (typeof p.cleanup === 'function') await p.cleanup();
}

export async function generatePdfThumbnail(file: File): Promise<{
  thumbnailUrl?: string;
  totalPages: number;
}> {
  try {
    const pdfjsLib = await getPdfJs();
    const data = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(data) });
    const pdf = (await loadingTask.promise) as unknown as PDFDocumentProxy;
    const totalPages = pdf.numPages;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.35 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      await closePdfDocument(pdf);
      return { totalPages };
    }
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.78);
    await closePdfDocument(pdf);
    return { thumbnailUrl, totalPages };
  } catch {
    return { totalPages: 0 };
  }
}

export async function openPdfDocument(file: File): Promise<PDFDocumentProxy> {
  const pdfjsLib = await getPdfJs();
  const data = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(data) });
  return (await loadingTask.promise) as unknown as PDFDocumentProxy;
}
