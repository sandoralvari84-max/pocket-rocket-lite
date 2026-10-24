import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { View, Text } from "react-native";

/* ----------------------------------------------------------------------------
 * EffectsLayer — a reusable, lightweight particle + floating-score layer.
 *
 * Design goals (per the 90s Arcade Quality brief, Phase 5):
 *   - Delta-time aware, so bursts look the same regardless of frame rate.
 *   - Bounded: a hard cap on live particles; never unbounded creation.
 *   - Self-contained: it runs its OWN requestAnimationFrame ONLY while there is
 *     something to animate, and stops the moment it empties. It never touches a
 *     game's deterministic update loop — gameplay stays RNG-free and frame-rate
 *     independent; these effects are pure decoration layered on top.
 *   - Only this leaf component re-renders each frame (small Views), not the game.
 *   - Respects the reduced-effects setting: particles are suppressed, score
 *     popups stay (they are information, not decoration).
 *
 * Usage:
 *   const fx = useRef<EffectsHandle>(null);
 *   <EffectsLayer ref={fx} reduced={reducedMotion} />   // absolute-fill, on top
 *   fx.current?.burst(x, y, { color: "#00E5FF", count: 12 });
 *   fx.current?.popScore(x, y, "+200", "#FF4D8D");
 * Coordinates are in the pixel space of the layer's parent.
 * ------------------------------------------------------------------------- */

type Particle = {
  id: number; x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string;
};
type Pop = { id: number; x: number; y: number; text: string; color: string; life: number; max: number };

export type BurstOpts = {
  count?: number;   // number of particles (capped)
  color?: string;
  speed?: number;   // px/sec initial speed
  size?: number;    // px square
  gravity?: number; // px/sec^2 downward
  rise?: number;    // initial upward bias (px/sec)
};

export type EffectsHandle = {
  burst: (x: number, y: number, opts?: BurstOpts) => void;
  popScore: (x: number, y: number, text: string, color?: string) => void;
  clear: () => void;
};

const MAX_PARTICLES = 80;
const MAX_POPS = 16;

export const EffectsLayer = forwardRef<EffectsHandle, { reduced?: boolean }>(
  function EffectsLayer({ reduced }, ref) {
    const particles = useRef<Particle[]>([]);
    const pops = useRef<Pop[]>([]);
    const [, setTick] = useState(0);
    const raf = useRef<number | null>(null);
    const last = useRef(0);
    const seq = useRef(0);

    const ensureRunning = () => {
      if (raf.current != null) return;
      last.current = Date.now();
      const loop = () => {
        const now = Date.now();
        const dt = Math.min(48, now - last.current) / 1000; // seconds, clamped for background stalls
        last.current = now;

        const ps = particles.current;
        for (let i = ps.length - 1; i >= 0; i--) {
          const p = ps[i];
          p.life -= dt;
          if (p.life <= 0) { ps.splice(i, 1); continue; }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 240 * dt;      // gravity
          p.vx *= 1 - 1.6 * dt;  // air drag
        }
        const qs = pops.current;
        for (let i = qs.length - 1; i >= 0; i--) {
          const q = qs[i];
          q.life -= dt;
          if (q.life <= 0) { qs.splice(i, 1); continue; }
          q.y -= 46 * dt;        // float upward
        }

        setTick((t) => (t + 1) % 1000000);
        if (ps.length === 0 && qs.length === 0) { raf.current = null; return; }
        raf.current = requestAnimationFrame(loop);
      };
      raf.current = requestAnimationFrame(loop);
    };

    useImperativeHandle(ref, () => ({
      burst(x, y, opts) {
        if (reduced) return;                       // decoration only — suppressed when reduced
        const count = Math.min(Math.max(1, opts?.count ?? 10), 24);
        const speed = opts?.speed ?? 130;
        const col = opts?.color ?? "#FF9800";
        const size = opts?.size ?? 5;
        const rise = opts?.rise ?? 40;
        const ps = particles.current;
        for (let i = 0; i < count; i++) {
          const a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
          const sp = speed * (0.45 + Math.random() * 0.75);
          ps.push({
            id: seq.current++, x, y,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rise,
            life: 0.45 + Math.random() * 0.35, max: 0.8,
            size, color: col,
          });
        }
        if (ps.length > MAX_PARTICLES) ps.splice(0, ps.length - MAX_PARTICLES);
        ensureRunning();
      },
      popScore(x, y, text, col) {
        const qs = pops.current;
        qs.push({ id: seq.current++, x, y, text, color: col ?? "#F4F7FB", life: 0.95, max: 0.95 });
        if (qs.length > MAX_POPS) qs.splice(0, qs.length - MAX_POPS);
        ensureRunning();
      },
      clear() {
        particles.current = [];
        pops.current = [];
        setTick((t) => (t + 1) % 1000000);
      },
    }));

    useEffect(() => () => { if (raf.current != null) cancelAnimationFrame(raf.current); }, []);

    return (
      <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
        {particles.current.map((p) => (
          <View
            key={p.id}
            style={{
              position: "absolute", left: p.x - p.size / 2, top: p.y - p.size / 2,
              width: p.size, height: p.size, backgroundColor: p.color,
              opacity: Math.max(0, Math.min(1, p.life / p.max)), borderRadius: 1,
            }}
          />
        ))}
        {pops.current.map((q) => (
          <Text
            key={q.id}
            style={{
              position: "absolute", left: q.x - 24, top: q.y - 8, width: 48,
              textAlign: "center", color: q.color, fontSize: 13, fontWeight: "800",
              opacity: Math.max(0, Math.min(1, q.life / q.max)),
              textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 2, textShadowOffset: { width: 0, height: 1 },
            }}
          >
            {q.text}
          </Text>
        ))}
      </View>
    );
  }
);
