import React, { useRef, useState } from 'react';

interface SteadyScrubberProps {
  value: number;
  min?: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  accentColor?: string;
  trackClassName?: string;
  ariaLabel: string;
}

/**
 * Steady horizontal scrubber using pointer capture + touch-action: none.
 * Prevents vertical page jitter/scrolling when dragging on mobile touch screens.
 */
export const SteadyScrubber: React.FC<SteadyScrubberProps> = ({
  value,
  min = 0,
  max,
  step = 0.01,
  onChange,
  onCommit,
  accentColor = '#8b5cf6',
  trackClassName = 'bg-zinc-800',
  ariaLabel,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const safeMax = max > min ? max : min + 1;
  const clamped = Math.min(safeMax, Math.max(min, value));
  const pct = ((clamped - min) / (safeMax - min)) * 100;

  const computeValueFromClientX = (clientX: number): number => {
    const el = trackRef.current;
    if (!el) return clamped;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return clamped;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const raw = min + ratio * (safeMax - min);
    const snapped = Math.round(raw / step) * step;
    return Math.min(safeMax, Math.max(min, Number(snapped.toFixed(4))));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    const next = computeValueFromClientX(e.clientX);
    onChange(next);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    e.preventDefault();
    e.stopPropagation();
    const next = computeValueFromClientX(e.clientX);
    onChange(next);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
    const next = computeValueFromClientX(e.clientX);
    onChange(next);
    onCommit?.(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const delta = (safeMax - min) / 20;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(safeMax, clamped + delta);
      onChange(next);
      onCommit?.(next);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(min, clamped - delta);
      onChange(next);
      onCommit?.(next);
    }
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={safeMax}
      aria-valuenow={clamped}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      className="steady-drag relative flex h-11 w-full cursor-pointer items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded-md"
    >
      <div className={`relative h-1.5 w-full overflow-hidden rounded-full ${trackClassName}`}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: accentColor,
          }}
        />
      </div>
      <div
        className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
        style={{
          left: `${pct}%`,
          backgroundColor: accentColor,
          transform: dragging ? 'translate(-50%, -50%) scale(1.15)' : 'translate(-50%, -50%) scale(1)',
        }}
      />
    </div>
  );
};
