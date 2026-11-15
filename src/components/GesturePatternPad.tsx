import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getMidpointNode } from '../lib/gestureSecurity';

export type GesturePadStatus = 'idle' | 'drawing' | 'success' | 'error';

interface GesturePatternPadProps {
  status?: GesturePadStatus;
  minNodes?: number;
  disabled?: boolean;
  hideLine?: boolean;
  onPatternChange?: (pattern: number[]) => void;
  onPatternComplete: (pattern: number[]) => void;
}

// 3x3 normalized node centers in SVG viewBox (0..300)
const NODE_COORDS: { id: number; x: number; y: number }[] = [
  { id: 0, x: 50, y: 50 },
  { id: 1, x: 150, y: 50 },
  { id: 2, x: 250, y: 50 },
  { id: 3, x: 50, y: 150 },
  { id: 4, x: 150, y: 150 },
  { id: 5, x: 250, y: 150 },
  { id: 6, x: 50, y: 250 },
  { id: 7, x: 150, y: 250 },
  { id: 8, x: 250, y: 250 },
];

const HIT_RADIUS_SVG = 34; // Generous finger-friendly hit radius in 300x300 space

export const GesturePatternPad: React.FC<GesturePatternPadProps> = ({
  status = 'idle',
  minNodes = 4,
  disabled = false,
  hideLine = false,
  onPatternChange,
  onPatternComplete,
}) => {
  const padRef = useRef<HTMLDivElement>(null);
  const [pattern, setPattern] = useState<number[]>([]);
  const [pointerSvgPt, setPointerSvgPt] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const patternRef = useRef<number[]>([]);
  const activePointerIdRef = useRef<number | null>(null);

  // Clear visible trace when parent transitions back to idle after success/error
  useEffect(() => {
    if (status === 'idle' && !isDragging && patternRef.current.length > 0) {
      patternRef.current = [];
      setPattern([]);
      setPointerSvgPt(null);
    }
  }, [status, isDragging]);

  const clientToSvgPoint = useCallback((clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = Math.max(0, Math.min(300, ((clientX - rect.left) / rect.width) * 300));
    const y = Math.max(0, Math.min(300, ((clientY - rect.top) / rect.height) * 300));
    return { x, y };
  }, []);

  const hitTestNode = useCallback((pt: { x: number; y: number }): number | null => {
    let bestId: number | null = null;
    let bestDist = HIT_RADIUS_SVG;
    for (const node of NODE_COORDS) {
      const dist = Math.hypot(pt.x - node.x, pt.y - node.y);
      if (dist <= bestDist) {
        bestDist = dist;
        bestId = node.id;
      }
    }
    return bestId;
  }, []);

  const appendNodeIfNew = useCallback(
    (nodeId: number) => {
      const current = patternRef.current;
      if (current.includes(nodeId)) return;

      const additions: number[] = [];
      if (current.length > 0) {
        const prev = current[current.length - 1];
        const mid = getMidpointNode(prev, nodeId);
        if (mid !== null && !current.includes(mid)) {
          additions.push(mid);
        }
      }
      additions.push(nodeId);

      const next = [...current, ...additions];
      patternRef.current = next;
      setPattern(next);
      onPatternChange?.(next);

      try {
        if ('vibrate' in navigator) navigator.vibrate(12);
      } catch {
        // ignore haptic failure
      }
    },
    [onPatternChange]
  );

  const finishStroke = useCallback(() => {
    if (activePointerIdRef.current === null) return;
    activePointerIdRef.current = null;
    setIsDragging(false);
    setPointerSvgPt(null);

    const finalPattern = [...patternRef.current];
    if (finalPattern.length === 0) return;

    if (finalPattern.length < minNodes) {
      // Too short — clear cleanly after notifying
      onPatternComplete(finalPattern);
      setTimeout(() => {
        if (activePointerIdRef.current === null) {
          patternRef.current = [];
          setPattern([]);
          onPatternChange?.([]);
        }
      }, 420);
      return;
    }

    onPatternComplete(finalPattern);
  }, [minNodes, onPatternChange, onPatternComplete]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    activePointerIdRef.current = e.pointerId;
    patternRef.current = [];
    setPattern([]);
    onPatternChange?.([]);
    setIsDragging(true);

    const pt = clientToSvgPoint(e.clientX, e.clientY);
    if (pt) {
      setPointerSvgPt(pt);
      const hit = hitTestNode(pt);
      if (hit !== null) appendNodeIfNew(hit);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    const pt = clientToSvgPoint(e.clientX, e.clientY);
    if (!pt) return;
    setPointerSvgPt(pt);
    const hit = hitTestNode(pt);
    if (hit !== null) appendNodeIfNew(hit);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
    finishStroke();
  };

  const strokeColor =
    status === 'error'
      ? '#f43f5e'
      : status === 'success'
        ? '#10b981'
        : '#f59e0b';

  const polyPoints = pattern
    .map((id) => {
      const c = NODE_COORDS[id];
      return `${c.x},${c.y}`;
    })
    .join(' ');

  const lastNode = pattern.length > 0 ? NODE_COORDS[pattern[pattern.length - 1]] : null;

  return (
    <div
      ref={padRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="application"
      aria-label="Finger gesture lock grid"
      className={`relative mx-auto aspect-square w-full max-w-[290px] select-none rounded-3xl border bg-[#0c0c10]/90 p-2 shadow-inner transition-transform ${
        status === 'error'
          ? 'border-rose-500/60 shadow-rose-950/50 animate-[shake_0.34s_ease-in-out]'
          : status === 'success'
            ? 'border-emerald-500/60 shadow-emerald-950/40'
            : isDragging
              ? 'border-amber-400/50 shadow-amber-950/30'
              : 'border-zinc-800'
      }`}
      style={{ touchAction: 'none', WebkitUserSelect: 'none' }}
    >
      <svg
        viewBox="0 0 300 300"
        className="h-full w-full overflow-visible"
        aria-hidden="true"
      >
        {/* Connected Pattern Lines */}
        {!hideLine && pattern.length > 1 && (
          <polyline
            points={polyPoints}
            fill="none"
            stroke={strokeColor}
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={0.85}
          />
        )}

        {/* Active Live Line Following User's Finger */}
        {!hideLine && isDragging && lastNode && pointerSvgPt && (
          <line
            x1={lastNode.x}
            y1={lastNode.y}
            x2={pointerSvgPt.x}
            y2={pointerSvgPt.y}
            stroke={strokeColor}
            strokeWidth="5"
            strokeLinecap="round"
            strokeOpacity={0.6}
          />
        )}

        {/* 3x3 Gesture Nodes */}
        {NODE_COORDS.map((node) => {
          const orderIdx = pattern.indexOf(node.id);
          const connected = orderIdx !== -1;

          return (
            <g key={node.id}>
              {/* Outer Halo Ring when connected */}
              {connected && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={24}
                  fill={strokeColor}
                  fillOpacity={0.14}
                  stroke={strokeColor}
                  strokeWidth={2}
                  strokeOpacity={0.75}
                />
              )}

              {/* Subtle resting ring */}
              <circle
                cx={node.x}
                cy={node.y}
                r={connected ? 11 : 9}
                fill={connected ? strokeColor : '#27272a'}
                stroke={connected ? '#09090b' : '#52525b'}
                strokeWidth={2}
              />

              {/* Center specular dot */}
              <circle
                cx={node.x}
                cy={node.y}
                r={connected ? 4 : 3}
                fill={connected ? '#ffffff' : '#a1a1aa'}
              />
            </g>
          );
        })}
      </svg>

      {/* Inline keyframe for shake feedback without needing external CSS */}
      <style>{`@keyframes shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-7px); } 40% { transform: translateX(7px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(5px); } }`}</style>
    </div>
  );
};
