import React, { useEffect, useRef } from 'react';
import { PdfThemeId } from '../types';
import { PDF_THEME_PRESETS } from '../lib/pdfEngine';

interface PdfThemeBackdropProps {
  theme: PdfThemeId;
  aiImageUrl?: string | null;
}

export const PdfThemeBackdrop: React.FC<PdfThemeBackdropProps> = ({ theme, aiImageUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const preset = theme === 'diy' ? null : PDF_THEME_PRESETS[theme];

  useEffect(() => {
    if (!preset) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const kind = preset.ambientKind;

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      phase: number;
      color: string;
      char?: string;
    }

    let w = window.innerWidth;
    let h = window.innerHeight;
    let particles: Particle[] = [];

    const buildParticles = () => {
      const count =
        kind === 'neon-rain' || kind === 'noir-storm'
          ? Math.min(110, Math.floor(w / 10))
          : kind === 'cyber-matrix'
            ? Math.min(85, Math.floor(w / 14))
            : kind === 'space-hologram' || kind === 'orbital-hud'
              ? Math.min(190, Math.floor((w * h) / 7200))
              : Math.min(90, Math.floor((w * h) / 14000));

      const glyphs =
        theme === 'ben-10'
          ? '01⬡⬢◆'
          : theme === 'ghost-in-the-shell'
            ? '01アイウエオカキクケコ'
            : '◇◈○●01';

      particles = Array.from({ length: count }, () => {
        let color = preset.accentColor;
        if (kind === 'space-hologram' || kind === 'orbital-hud') {
          const hues = ['#ffffff', '#bae6fd', '#e0e7ff', preset.accentColor];
          color = hues[Math.floor(Math.random() * hues.length)];
        } else if (theme === 'cyberpunk-2077') {
          color = ['#facc15', '#ec4899', '#22d3ee'][Math.floor(Math.random() * 3)];
        } else if (theme === 'blade-runner') {
          color = Math.random() > 0.35 ? '#22d3ee' : '#f59e0b';
        } else if (theme === 'arcane') {
          color = Math.random() > 0.4 ? '#38bdf8' : '#34d399';
        } else if (theme === 'avatar') {
          color = ['#fbbf24', '#38bdf8', '#f97316', '#34d399'][Math.floor(Math.random() * 4)];
        } else if (theme === 'anime') {
          color = Math.random() > 0.3 ? '#fda4af' : '#f43f5e';
        }

        const isRain = kind === 'neon-rain' || kind === 'noir-storm';
        const isRising =
          kind === 'eclipse-embers' ||
          kind === 'candle-embers' ||
          kind === 'clockwork-steam' ||
          kind === 'hextech-arcane';

        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: isRain
            ? -0.7 - Math.random() * 0.8
            : kind === 'spice-desert'
              ? 0.9 + Math.random() * 1.4
              : (Math.random() - 0.5) * 0.45,
          vy: isRain
            ? 6 + Math.random() * 7
            : isRising
              ? -(0.35 + Math.random() * 0.95)
              : kind === 'snow-fjord'
                ? 0.45 + Math.random() * 0.9
                : kind === 'cyber-matrix'
                  ? 1.5 + Math.random() * 2.4
                  : kind === 'space-hologram'
                    ? -(0.04 + Math.random() * 0.14)
                    : (Math.random() - 0.5) * 0.35,
          size:
            kind === 'neon-rain'
              ? 12 + Math.random() * 18
              : theme === 'harry-potter'
                ? 2.2 + Math.random() * 2.5
                : 1 + Math.random() * 2.4,
          alpha: 0.22 + Math.random() * 0.65,
          phase: Math.random() * Math.PI * 2,
          color,
          char: glyphs[Math.floor(Math.random() * glyphs.length)],
        };
      });
    };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildParticles();
    };

    resize();
    window.addEventListener('resize', resize);

    let frame = 0;

    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, w, h);

      // Base atmospheric tint only when no custom AI image covers the scene
      if (!aiImageUrl) {
        if (kind === 'space-hologram' || kind === 'orbital-hud') {
          const bg = ctx.createRadialGradient(w * 0.5, h * 0.35, 30, w * 0.5, h * 0.5, Math.max(w, h) * 0.85);
          bg.addColorStop(0, theme === 'neo-evangelion' ? '#1c0b22' : '#09152b');
          bg.addColorStop(0.5, '#050a18');
          bg.addColorStop(1, '#02040a');
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, w, h);
        } else if (kind === 'spice-desert') {
          const bg = ctx.createLinearGradient(0, 0, 0, h);
          bg.addColorStop(0, '#180e06');
          bg.addColorStop(0.55, '#2b1708');
          bg.addColorStop(1, '#0d0703');
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, w, h);

          // Twin Arrakis Moons
          ctx.globalAlpha = 0.22;
          ctx.fillStyle = '#fde68a';
          ctx.beginPath();
          ctx.arc(w * 0.78, h * 0.22, 34, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.14;
          ctx.beginPath();
          ctx.arc(w * 0.67, h * 0.16, 16, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        } else if (kind === 'synth-oasis') {
          const horizonY = h * 0.58;
          const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
          sky.addColorStop(0, '#05020d');
          sky.addColorStop(1, '#1e0b36');
          ctx.fillStyle = sky;
          ctx.fillRect(0, 0, w, horizonY);

          // Striped Synthwave Sun
          const sunR = Math.min(w, h) * 0.18;
          const sunG = ctx.createLinearGradient(0, horizonY - sunR * 2, 0, horizonY);
          sunG.addColorStop(0, '#facc15');
          sunG.addColorStop(0.55, '#f43f5e');
          sunG.addColorStop(1, '#a855f7');
          ctx.save();
          ctx.globalAlpha = 0.36;
          ctx.fillStyle = sunG;
          ctx.beginPath();
          ctx.arc(w * 0.5, horizonY - sunR * 0.4, sunR, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Perspective Laser Grid
          ctx.save();
          ctx.strokeStyle = 'rgba(34, 211, 238, 0.28)';
          ctx.lineWidth = 1;
          const vanishX = w * 0.5;
          for (let i = -10; i <= 10; i++) {
            ctx.beginPath();
            ctx.moveTo(vanishX + i * 28, horizonY);
            ctx.lineTo(vanishX + i * (w * 0.22), h);
            ctx.stroke();
          }
          const scrollOffset = reducedMotion ? 0 : (frame * 0.6) % 36;
          for (let row = 0; row < 12; row++) {
            const p = Math.pow((row * 36 + scrollOffset) / (12 * 36), 1.8);
            const y = horizonY + p * (h - horizonY);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // Signature Universe Phenomena
      if (theme === 'berserk' || theme === 'castlevania') {
        const cx = w * 0.5;
        const cy = h * 0.26;
        const r = Math.min(w, h) * 0.13;
        const glow = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 2.6);
        glow.addColorStop(0, 'rgba(220, 38, 38, 0.35)');
        glow.addColorStop(0.5, 'rgba(153, 27, 27, 0.14)');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = theme === 'berserk' ? '#050203' : 'rgba(225, 29, 72, 0.22)';
        ctx.fill();
        ctx.lineWidth = theme === 'berserk' ? 3 : 1.5;
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.55)';
        ctx.stroke();
        ctx.restore();
      }

      if (theme === 'gotham' || theme === 'dc') {
        // Slow rooftop Bat-searchlight sweep
        const sweepAngle = reducedMotion ? -0.3 : Math.sin(frame * 0.008) * 0.38;
        ctx.save();
        ctx.translate(w * 0.22, h);
        ctx.rotate(sweepAngle);
        const beam = ctx.createLinearGradient(0, 0, 0, -h * 1.1);
        beam.addColorStop(0, theme === 'gotham' ? 'rgba(234, 179, 8, 0.16)' : 'rgba(56, 189, 248, 0.14)');
        beam.addColorStop(1, 'transparent');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(-18, 0);
        ctx.lineTo(-w * 0.22, -h * 1.1);
        ctx.lineTo(w * 0.22, -h * 1.1);
        ctx.lineTo(18, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      if (kind === 'snow-fjord') {
        // Subtle Nordic Aurora Wave
        ctx.save();
        const aur = ctx.createLinearGradient(0, h * 0.05, w, h * 0.35);
        aur.addColorStop(0, 'rgba(56, 189, 248, 0.05)');
        aur.addColorStop(0.5, 'rgba(52, 211, 153, 0.11)');
        aur.addColorStop(1, 'rgba(96, 165, 250, 0.05)');
        ctx.fillStyle = aur;
        ctx.beginPath();
        ctx.moveTo(0, h * 0.22);
        for (let x = 0; x <= w; x += 40) {
          const yOff = Math.sin(x * 0.006 + frame * 0.012) * 26;
          ctx.lineTo(x, h * 0.18 + yOff);
        }
        ctx.lineTo(w, 0);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Animate Particles
      for (const p of particles) {
        if (!reducedMotion) {
          p.x += p.vx;
          p.y += p.vy;
          if (kind === 'bioluminescent' || kind === 'candle-embers' || kind === 'snow-fjord') {
            p.x += Math.sin(frame * 0.02 + p.phase) * 0.35;
          }
          if (p.y < -25) p.y = h + 20;
          if (p.y > h + 25) p.y = -20;
          if (p.x < -25) p.x = w + 20;
          if (p.x > w + 25) p.x = -20;
        }

        const flicker = 0.72 + 0.28 * Math.sin(p.phase + frame * 0.04);
        ctx.globalAlpha = p.alpha * flicker;

        if (kind === 'neon-rain' || kind === 'noir-storm') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.15;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 2.1, p.y + p.size);
          ctx.stroke();
        } else if (kind === 'cyber-matrix' && p.char) {
          ctx.fillStyle = p.color;
          ctx.font = '11px monospace';
          ctx.fillText(p.char, p.x, p.y);
        } else if (theme === 'harry-potter') {
          // Floating Great Hall glowing candle spark + tiny body
          ctx.fillStyle = '#fde68a';
          ctx.fillRect(p.x - 1, p.y, 2, 7);
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(p.x, p.y - 2, p.size * 0.65, 0, Math.PI * 2);
          ctx.fill();
        } else if (theme === 'anime') {
          // Sakura blossom petal
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.phase + frame * 0.015);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 1.9, p.size * 0.9, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Gothic Bats silhouettes for Castlevania
      if (kind === 'gothic-bats') {
        const batCount = 6;
        ctx.fillStyle = 'rgba(15, 5, 10, 0.82)';
        for (let i = 0; i < batCount; i++) {
          const t = reducedMotion ? i * 120 : (frame * (0.9 + i * 0.15) + i * 210) % (w + 160);
          const bx = t - 80;
          const by = h * (0.14 + (i % 3) * 0.11) + Math.sin(frame * 0.04 + i) * 14;
          const flap = Math.sin(frame * 0.18 + i) * 6;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.quadraticCurveTo(bx - 10, by - 8 - flap, bx - 18, by + 2);
          ctx.quadraticCurveTo(bx - 8, by + 4, bx, by + 4);
          ctx.quadraticCurveTo(bx + 8, by + 4, bx + 18, by + 2);
          ctx.quadraticCurveTo(bx + 10, by - 8 - flap, bx, by);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;

      if (!reducedMotion) {
        animId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [theme, preset, aiImageUrl]);

  if (!preset) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* AI-Generated Universe Image Layer (with gentle Ken Burns breathing motion) */}
      {aiImageUrl && (
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={aiImageUrl}
            alt=""
            className="universe-ai-breathe h-full w-full object-cover opacity-55"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at center, rgba(5,5,8,0.28) 0%, rgba(4,4,8,0.72) 100%)',
            }}
          />
        </div>
      )}

      {/* Universe Animated Particle & Atmospheric Canvas */}
      <canvas ref={canvasRef} className="relative block h-full w-full" />

      {/* Universe-Specific Architectural SVG / Projector Overlays */}
      {preset.ambientKind === 'clockwork-steam' && (
        <>
          <svg
            viewBox="0 0 120 120"
            className="universe-spin-cw absolute -left-16 -top-16 h-64 w-64 text-amber-500/20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <circle cx="60" cy="60" r="42" strokeDasharray="8 6" />
            <circle cx="60" cy="60" r="28" />
            <circle cx="60" cy="60" r="10" />
            <path d="M60 8V112M8 60H112M23 23L97 97M97 23L23 97" />
          </svg>
          <svg
            viewBox="0 0 120 120"
            className="universe-spin-ccw absolute -bottom-20 -right-16 h-72 w-72 text-amber-600/20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <circle cx="60" cy="60" r="46" strokeDasharray="10 7" />
            <circle cx="60" cy="60" r="30" />
            <circle cx="60" cy="60" r="12" />
            <path d="M60 12V108M12 60H108" />
          </svg>
        </>
      )}

      {(preset.ambientKind === 'orbital-hud' || preset.ambientKind === 'hextech-arcane') && (
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <svg
            viewBox="0 0 240 240"
            className="universe-spin-cw h-[520px] w-[520px]"
            fill="none"
            stroke={preset.accentColor}
            strokeWidth="0.9"
          >
            <circle cx="120" cy="120" r="105" strokeDasharray="14 8" />
            <circle cx="120" cy="120" r="82" strokeDasharray="4 6" />
            {theme === 'neo-evangelion' && (
              <polygon points="120,25 202,72 202,168 120,215 38,168 38,72" strokeWidth="1.2" />
            )}
            {theme === 'arcane' && (
              <polygon points="120,30 198,120 120,210 42,120" strokeWidth="1.1" />
            )}
          </svg>
        </div>
      )}

      {preset.ambientKind === 'space-hologram' && (
        <div
          className="absolute inset-x-0 bottom-12 mx-auto h-72 max-w-2xl opacity-45"
          style={{
            background:
              'conic-gradient(from 180deg at 50% 100%, transparent 145deg, rgba(56, 189, 248, 0.22) 170deg, rgba(125, 211, 252, 0.35) 180deg, rgba(56, 189, 248, 0.22) 190deg, transparent 215deg)',
            filter: 'blur(12px)',
          }}
        />
      )}

      {preset.id === 'medieval' && !aiImageUrl && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 38%, rgba(245, 158, 11, 0.14) 0%, rgba(146, 64, 14, 0.08) 38%, rgba(8, 5, 2, 0.85) 100%)',
          }}
        />
      )}
    </div>
  );
};
