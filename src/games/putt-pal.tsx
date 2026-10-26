import React, { useEffect, useRef, useState } from "react";
import { View, Image, StyleSheet, Dimensions, type GestureResponderEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, GameOverlay } from "../design/ui";
import { EffectsLayer, type EffectsHandle } from "../design/effects";
import { useSettings } from "../settings";

/* ----------------------------------------------------------------------------
 * PUTT PAL — side-view "real golf" (power + angle + arcing ball).
 *
 * Three themed holes painted as landscape art (1168x784). The screen is portrait,
 * so each hole is wider than the screen and the camera scrolls horizontally to
 * follow the ball. The ball is a real projectile: pull back to set angle + power,
 * release to launch; it arcs under gravity (+ wind), bounces, rolls down the
 * contour of the ground, bites in sand, and splashes (penalty) in water. Sink it
 * in the cup by the red flag.
 *
 * Deterministic RAF loop (ref-based; a single setTick bump drives re-render, like
 * flipper-frenzy). The ground profile + hazards are FRACTION data at the top so
 * they are trivial to calibrate against the paintings on-device; a faint surface
 * polyline + translucent hazard tints are drawn over the art as a visual guide.
 * ------------------------------------------------------------------------- */

// Landscape background art (already in repo). Each shows, left->right: a raised TEE
// (left) with the ball, a FAIRWAY that dips, a SAND bunker, a WATER pond, and a
// GREEN with a red FLAG on the right.
const PARKLAND = require("../../assets/arcade/golf/parkland.jpg");
const SEASIDE = require("../../assets/arcade/golf/seaside.jpg");
const DESERT = require("../../assets/arcade/golf/desert.jpg");

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const ART_W = 1168, ART_H = 784;
const scale = SCREEN_H / ART_H;          // fill the screen HEIGHT with the art (cover)
const WORLD_W = ART_W * scale;           // total hole width in world px (WORLD_H = SCREEN_H)
const CAM_MAX = Math.max(0, WORLD_W - SCREEN_W);

const ballR = Math.max(7, Math.round(7 * scale));

// ---- hole data (all positions are FRACTIONS of the art, 0..1) --------------
type Pt = { x: number; y: number };                 // fractions of (WORLD_W, SCREEN_H)
type Hazard = { x0: number; x1: number; kind: "water" | "sand" };
type Hole = { art: any; ground: Pt[]; teeX: number; cupX: number; par: number; wind: number; hazards: Hazard[] };

// ground = left->right control points of the TOP SURFACE the ball rolls on
// (piecewise-linear; interpolate with groundYAt). Tee plateau high-left, dip to the
// fairway, slight rise to the green on the right. TUNE these against the paintings.
const HOLES: Hole[] = [
  {
    // Ball starts up on the painted tee MOUND (left, ~y0.40), steep drop to the fairway.
    art: PARKLAND, par: 3, wind: 0, teeX: 0.11, cupX: 0.93,
    ground: [
      { x: 0.00, y: 0.42 }, { x: 0.16, y: 0.40 }, { x: 0.21, y: 0.70 },
      { x: 0.45, y: 0.72 }, { x: 0.62, y: 0.72 }, { x: 0.80, y: 0.66 }, { x: 1.00, y: 0.66 },
    ],
    hazards: [{ x0: 0.34, x1: 0.44, kind: "sand" }, { x0: 0.50, x1: 0.63, kind: "water" }],
  },
  {
    art: SEASIDE, par: 3, wind: 0.3, teeX: 0.10, cupX: 0.90,
    ground: [
      { x: 0.00, y: 0.40 }, { x: 0.17, y: 0.38 }, { x: 0.23, y: 0.70 },
      { x: 0.50, y: 0.72 }, { x: 0.70, y: 0.72 }, { x: 0.82, y: 0.64 }, { x: 1.00, y: 0.64 },
    ],
    hazards: [{ x0: 0.40, x1: 0.50, kind: "sand" }, { x0: 0.55, x1: 0.78, kind: "water" }],
  },
  {
    art: DESERT, par: 4, wind: -0.3, teeX: 0.08, cupX: 0.92,
    ground: [
      { x: 0.00, y: 0.44 }, { x: 0.15, y: 0.42 }, { x: 0.21, y: 0.72 },
      { x: 0.45, y: 0.74 }, { x: 0.66, y: 0.74 }, { x: 0.84, y: 0.66 }, { x: 1.00, y: 0.66 },
    ],
    hazards: [{ x0: 0.30, x1: 0.55, kind: "sand" }, { x0: 0.60, x1: 0.74, kind: "water" }],
  },
];

// ============================================================================
// FEEL CONSTANTS — TUNE ON-DEVICE. These govern how the golf "feels" (ball weight,
// bounce, roll, grip, shot power). Grouped + FLAGGED so they are trivial to find.
// All are given per-frame in ART units and multiplied by `scale` at use so the feel
// is screen-size independent. The integrator/collision math below stays stable.
// ----------------------------------------------------------------------------
const SUB = 3;                       // physics sub-steps per frame (anti-tunnel)
const GRAV = 0.35 * scale;           // [FEEL] gravity (px/frame^2) — ball weight / drop
const WIND_K = 0.03 * scale;         // [FEEL] horizontal wind accel per unit hole.wind (airborne only)
const REST = 0.38;                   // [FEEL] bounce restitution (vertical energy kept on a hard landing)
const BOUNCE_MIN = 2.2 * scale;      // [FEEL] descend faster than this => bounce; slower => roll
const FR_GREEN = 0.985;              // [FEEL] green/fairway roll friction (per frame)
const FR_SAND = 0.86;                // [FEEL] sand friction (bites, stops fast)
const FR_GREEN_SUB = Math.pow(FR_GREEN, 1 / SUB);  // applied per sub-step
const FR_SAND_SUB = Math.pow(FR_SAND, 1 / SUB);
const WALL_REST = 0.6;               // [FEEL] side / ceiling wall bounce retention
const MAX_POWER = 19 * scale;        // [FEEL] launch speed at full pull
const MAX_PULL = 210;                // [FEEL] screen px of pull-back for full power
const MIN_PULL = 12;                 // px — shorter than this is a tap, not a shot
const MAXSPEED = 24 * scale;         // [FEEL] speed cap (anti-tunnel)
const STOP_SPEED = 0.5 * scale;      // below this (grounded, a few frames) the ball rests
const SINK_SPEED = 3.4 * scale;      // must be slower than this to drop in the cup
const HOLE_R = 15 * scale;           // cup capture radius
// ============================================================================

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Interpolate the TOP surface (world px y) at a world-px x for a hole.
function groundYAt(worldX: number, ground: Pt[]): number {
  const fxp = clamp(worldX / WORLD_W, 0, 1);
  for (let i = 0; i < ground.length - 1; i++) {
    const a = ground[i], b = ground[i + 1];
    if (fxp >= a.x && fxp <= b.x) {
      const t = (fxp - a.x) / ((b.x - a.x) || 1);
      return (a.y + (b.y - a.y) * t) * SCREEN_H;
    }
  }
  if (fxp <= ground[0].x) return ground[0].y * SCREEN_H;
  return ground[ground.length - 1].y * SCREEN_H;
}
// Local surface gradient (dy/dx, px per px) — drives slope acceleration.
function groundSlopeAt(worldX: number, ground: Pt[]): number {
  const fxp = clamp(worldX / WORLD_W, 0, 1);
  for (let i = 0; i < ground.length - 1; i++) {
    const a = ground[i], b = ground[i + 1];
    if (fxp >= a.x && fxp <= b.x) {
      const dyf = (b.y - a.y) * SCREEN_H;
      const dxf = (b.x - a.x) * WORLD_W;
      return dyf / (dxf || 1);
    }
  }
  return 0;
}
// Per-sub-step friction under the ball: sand bites, everything else is green.
function frictionSubAt(worldX: number, hole: Hole): number {
  const fxp = worldX / WORLD_W;
  for (const h of hole.hazards) if (h.kind === "sand" && fxp >= h.x0 && fxp <= h.x1) return FR_SAND_SUB;
  return FR_GREEN_SUB;
}

interface Vec { x: number; y: number; }

const diffTag = (strokes: number, par: number): string => {
  const d = strokes - par;
  return d === 0 ? "E" : d > 0 ? `+${d}` : `${d}`;
};

function GameScreen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useSettings();
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  const fx = useRef<EffectsHandle>(null);

  // ----- deterministic world state (refs; no per-frame React churn) -----
  const holeRef = useRef(0);
  const ballRef = useRef<Vec>({ x: 0, y: 0 });
  const velRef = useRef<Vec>({ x: 0, y: 0 });
  const movingRef = useRef(false);
  const settleRef = useRef(0);           // consecutive low-speed grounded frames
  const moveFramesRef = useRef(0);       // safety: force-settle if a shot runs too long
  const strokesRef = useRef(0);
  const scoresRef = useRef<number[]>([]); // strokes per completed hole
  const phaseRef = useRef<"start" | "play" | "holeDone" | "courseDone">("start");

  const dragStartRef = useRef<Vec | null>(null); // screen px
  const dragNowRef = useRef<Vec | null>(null);
  const rafRef = useRef<number | null>(null);

  const [, setTick] = useState(0);
  const [holeIdx, setHoleIdx] = useState(0);
  const [strokes, setStrokes] = useState(0);
  const [phase, setPhase] = useState<"start" | "play" | "holeDone" | "courseDone">("start");
  const bump = () => setTick((t) => (t + 1) % 1000000);

  // Place the ball at rest on the tee plateau of a hole.
  const teePos = (idx: number): Vec => {
    const h = HOLES[idx];
    const x = h.teeX * WORLD_W;
    return { x, y: groundYAt(x, h.ground) - ballR };
  };

  const loadHole = (idx: number) => {
    holeRef.current = idx;
    ballRef.current = teePos(idx);
    velRef.current = { x: 0, y: 0 };
    movingRef.current = false;
    settleRef.current = 0;
    moveFramesRef.current = 0;
    strokesRef.current = 0;
    fx.current?.clear();
    setHoleIdx(idx);
    setStrokes(0);
    phaseRef.current = "play";
    setPhase("play");
  };

  // lazy init onto hole 1's tee
  if (ballRef.current.x === 0 && ballRef.current.y === 0) ballRef.current = teePos(0);

  const sink = () => {
    const hole = HOLES[holeRef.current];
    const cupX = hole.cupX * WORLD_W;
    const cupY = groundYAt(cupX, hole.ground);
    const b = ballRef.current;
    b.x = cupX; b.y = cupY - ballR;
    velRef.current = { x: 0, y: 0 };
    movingRef.current = false;
    const s = strokesRef.current;
    scoresRef.current[holeRef.current] = s;
    const sx = b.x - cameraFor(b.x), sy = b.y;
    if (!reducedRef.current) {
      fx.current?.burst(sx, sy, { color: color.amber, count: s <= hole.par ? 18 : 12, speed: 160, size: 5 });
      if (s <= hole.par) fx.current?.burst(sx, sy, { color: color.cyan, count: 12, speed: 140, size: 4 });
    }
    fx.current?.popScore(sx, sy - 22, `(${diffTag(s, hole.par)})`, s <= hole.par ? color.success : color.textMuted);
    phaseRef.current = "holeDone";
    setPhase("holeDone");
    bump();
  };

  const splash = (hole: Hole, hz: Hazard) => {
    const b = ballRef.current;
    const sx = b.x - cameraFor(b.x), sy = b.y;
    if (!reducedRef.current) fx.current?.burst(sx, sy, { color: color.cyan, count: 14, speed: 150, size: 5, rise: 40 });
    fx.current?.popScore(sx, sy - 18, "+1 WATER", color.danger);
    // drop just BEFORE x0 of the hazard, at rest
    const dropX = clamp(hz.x0 * WORLD_W - 26 * scale, ballR, WORLD_W - ballR);
    b.x = dropX; b.y = groundYAt(dropX, hole.ground) - ballR;
    velRef.current = { x: 0, y: 0 };
    movingRef.current = false;
    settleRef.current = 0;
    strokesRef.current += 1;
    setStrokes(strokesRef.current);
  };

  const step = () => {
    if (phaseRef.current !== "play") return;   // overlays freeze the sim
    if (!movingRef.current) return;            // ball at rest — nothing to integrate

    const hole = HOLES[holeRef.current];
    const b = ballRef.current;
    const v = velRef.current;
    let grounded = false;

    for (let s = 0; s < SUB; s++) {
      const gcBefore = groundYAt(b.x, hole.ground) - ballR;
      const airborne = b.y < gcBefore - 0.5;
      if (airborne) { v.y += GRAV / SUB; v.x += (WIND_K * hole.wind) / SUB; }

      b.x += v.x / SUB;
      b.y += v.y / SUB;

      // side walls + ceiling
      if (b.x < ballR) { b.x = ballR; v.x = Math.abs(v.x) * WALL_REST; }
      else if (b.x > WORLD_W - ballR) { b.x = WORLD_W - ballR; v.x = -Math.abs(v.x) * WALL_REST; }
      if (b.y < ballR) { b.y = ballR; v.y = Math.abs(v.y) * WALL_REST; }

      // ground
      const gc = groundYAt(b.x, hole.ground) - ballR;
      if (b.y >= gc) {
        b.y = gc;
        grounded = true;
        if (v.y > BOUNCE_MIN) {
          // hard landing -> bounce
          v.y = -v.y * REST;
          v.x *= 0.7;
        } else {
          // roll: project velocity onto the local surface tangent, add slope
          // acceleration (hills matter) and terrain friction, then glide on surface.
          const slope = groundSlopeAt(b.x, hole.ground);
          const len = Math.hypot(1, slope) || 1;
          const tx = 1 / len, ty = slope / len;
          let vt = v.x * tx + v.y * ty;
          vt += (GRAV / SUB) * ty;                 // gravity along the slope
          vt *= frictionSubAt(b.x, hole);          // grip
          v.x = vt * tx;
          v.y = vt * ty;
        }
      }
    }

    // speed cap (anti-tunnel)
    const sp0 = Math.hypot(v.x, v.y);
    if (sp0 > MAXSPEED) { v.x = (v.x / sp0) * MAXSPEED; v.y = (v.y / sp0) * MAXSPEED; }

    // water hazard: splash + penalty when the ball is at/below ground in a water band
    if (grounded) {
      for (const hz of hole.hazards) {
        if (hz.kind !== "water") continue;
        const x0 = hz.x0 * WORLD_W, x1 = hz.x1 * WORLD_W;
        if (b.x >= x0 && b.x <= x1) { splash(hole, hz); bump(); return; }
      }
    }

    // cup: close + slow enough to drop in
    const cupX = hole.cupX * WORLD_W;
    const cupCY = groundYAt(cupX, hole.ground) - ballR;
    const speed = Math.hypot(v.x, v.y);
    if (Math.hypot(b.x - cupX, b.y - cupCY) < HOLE_R && speed < SINK_SPEED) { sink(); return; }

    // rest detection (+ absolute safety so the ball can never get stuck)
    moveFramesRef.current += 1;
    if (grounded && speed < STOP_SPEED) {
      settleRef.current += 1;
      if (settleRef.current >= 4) { v.x = 0; v.y = 0; movingRef.current = false; settleRef.current = 0; }
    } else {
      settleRef.current = 0;
    }
    if (moveFramesRef.current > 2200) { v.x = 0; v.y = 0; movingRef.current = false; }

    bump();
  };

  useEffect(() => {
    let mounted = true;
    const loop = () => { step(); if (mounted) rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => { mounted = false; if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // camera: center on the ball, clamped to the hole bounds
  const cameraFor = (bx: number) => clamp(bx - SCREEN_W / 2, 0, CAM_MAX);

  const canAim = () => phaseRef.current === "play" && !movingRef.current;

  // Pull vector = p0 - pNow; the ball launches along it (pull down-left => up-right).
  const launchVel = (p0: Vec, pNow: Vec) => {
    const dx = p0.x - pNow.x, dy = p0.y - pNow.y;
    const pull = Math.hypot(dx, dy);
    if (pull < MIN_PULL) return null;
    const frac = Math.min(1, pull / MAX_PULL);
    const speed = frac * MAX_POWER;
    return { vx: (dx / pull) * speed, vy: (dy / pull) * speed, frac };
  };

  const onStartResponder = () => canAim();
  const onGrant = (e: GestureResponderEvent) => {
    const p = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
    dragStartRef.current = p; dragNowRef.current = p; bump();
  };
  const onMove = (e: GestureResponderEvent) => {
    if (!dragStartRef.current) return;
    dragNowRef.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }; bump();
  };
  const onRelease = () => {
    const p0 = dragStartRef.current, pNow = dragNowRef.current;
    dragStartRef.current = null; dragNowRef.current = null;
    if (!canAim() || !p0 || !pNow) { bump(); return; }
    const lv = launchVel(p0, pNow);
    if (!lv) { bump(); return; }  // mis-tap
    velRef.current = { x: lv.vx, y: lv.vy };
    movingRef.current = true;
    settleRef.current = 0;
    moveFramesRef.current = 0;
    strokesRef.current += 1;
    setStrokes(strokesRef.current);
    bump();
  };

  const start = () => { phaseRef.current = "play"; setPhase("play"); bump(); };
  const advance = () => {
    if (holeRef.current >= HOLES.length - 1) { phaseRef.current = "courseDone"; setPhase("courseDone"); bump(); return; }
    loadHole(holeRef.current + 1);
    bump();
  };
  const restart = () => { scoresRef.current = []; loadHole(0); bump(); };

  // ----- render -----
  const hole = HOLES[holeIdx];
  const b = ballRef.current;
  const cameraX = cameraFor(b.x);
  const ballSX = b.x - cameraX, ballSY = b.y;

  const cupX = hole.cupX * WORLD_W;
  const cupSurfaceY = groundYAt(cupX, hole.ground);
  const cupSX = cupX - cameraX;

  // aim preview — simulate the launch arc with the same gravity/wind
  let aim: { dots: Vec[]; frac: number } | null = null;
  if (canAim() && dragStartRef.current && dragNowRef.current) {
    const lv = launchVel(dragStartRef.current, dragNowRef.current);
    if (lv) {
      const dots: Vec[] = [];
      let sx = b.x, sy = b.y, svx = lv.vx, svy = lv.vy;
      for (let i = 0; i < 26; i++) {
        svy += GRAV; svx += WIND_K * hole.wind;
        sx += svx; sy += svy;
        const gc = groundYAt(sx, hole.ground) - ballR;
        if (sy >= gc) { dots.push({ x: sx - cameraX, y: gc }); break; }
        dots.push({ x: sx - cameraX, y: sy });
        if (sx < ballR || sx > WORLD_W - ballR) break;
      }
      aim = { dots, frac: lv.frac };
    }
  }

  // faint surface polyline segments (calibration guide over the painting)
  const ground = hole.ground;
  const surfaceSegs = [];
  for (let i = 0; i < ground.length - 1; i++) {
    const a = ground[i], c = ground[i + 1];
    const ax = a.x * WORLD_W - cameraX, ay = a.y * SCREEN_H;
    const cx = c.x * WORLD_W - cameraX, cy = c.y * SCREEN_H;
    const len = Math.hypot(cx - ax, cy - ay);
    const ang = (Math.atan2(cy - ay, cx - ax) * 180) / Math.PI;
    surfaceSegs.push({ key: `sf${i}`, left: ax, top: ay, width: len, ang });
  }

  // translucent hazard tints (calibration guide; also a surface hint)
  const hazTints = hole.hazards.map((h, i) => {
    const x0 = h.x0 * WORLD_W, x1 = h.x1 * WORLD_W;
    let top = SCREEN_H;
    for (let xp = x0; xp <= x1; xp += (x1 - x0) / 6) top = Math.min(top, groundYAt(xp, ground));
    return {
      key: `hz${i}`, left: x0 - cameraX, top, width: x1 - x0, height: SCREEN_H - top,
      bg: h.kind === "water" ? "rgba(0,150,230,0.22)" : "rgba(214,178,90,0.22)",
      border: h.kind === "water" ? "rgba(0,150,230,0.5)" : "rgba(214,178,90,0.5)",
    };
  });

  const totalStrokes = scoresRef.current.reduce((a, s) => a + (s || 0), 0);
  const totalPar = HOLES.reduce((a, h) => a + h.par, 0);
  const windArrow = hole.wind > 0 ? "▶" : hole.wind < 0 ? "◀" : "•";
  const windMag = Math.abs(hole.wind).toFixed(1);

  return (
    <View
      style={st.fill}
      onStartShouldSetResponder={onStartResponder}
      onMoveShouldSetResponder={() => false}
      onResponderGrant={onGrant}
      onResponderMove={onMove}
      onResponderRelease={onRelease}
      onResponderTerminate={onRelease}
    >
      {/* landscape art, scrolled horizontally by the camera */}
      <Image source={hole.art} fadeDuration={0} resizeMode="stretch"
        style={{ position: "absolute", left: -cameraX, top: 0, width: WORLD_W, height: SCREEN_H }} />

      {/* translucent hazard tints (calibration + surface hint) */}
      {hazTints.map((h) => (
        <View key={h.key} pointerEvents="none" style={{
          position: "absolute", left: h.left, top: h.top, width: h.width, height: h.height,
          backgroundColor: h.bg, borderTopWidth: 1.5, borderColor: h.border,
        }} />
      ))}

      {/* faint surface polyline (calibration guide) */}
      {surfaceSegs.map((s) => (
        <View key={s.key} pointerEvents="none" style={{
          position: "absolute", left: s.left, top: s.top, width: s.width, height: 2,
          backgroundColor: "rgba(243,239,230,0.25)", transform: [{ translateY: -1 }, { rotate: `${s.ang}deg` }],
          transformOrigin: "left center" as any,
        }} />
      ))}

      {/* flag at the cup (pole + triangular flag + cup notch) */}
      <View pointerEvents="none" style={{ position: "absolute", left: cupSX - 1, top: cupSurfaceY - 58 * scale, width: 2, height: 58 * scale, backgroundColor: "#E8E2D4" }} />
      <View pointerEvents="none" style={{
        position: "absolute", left: cupSX + 1, top: cupSurfaceY - 58 * scale, width: 0, height: 0,
        borderTopWidth: 9 * scale, borderBottomWidth: 9 * scale, borderLeftWidth: 18 * scale,
        borderTopColor: "transparent", borderBottomColor: "transparent", borderLeftColor: color.danger,
      }} />
      <View pointerEvents="none" style={{ position: "absolute", left: cupSX - HOLE_R / 2, top: cupSurfaceY - 2, width: HOLE_R, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.5)" }} />

      {/* aim preview: dotted predicted arc from the ball */}
      {aim ? aim.dots.map((d, i) => (
        <View key={`aim${i}`} pointerEvents="none" style={{
          position: "absolute", left: d.x - 3, top: d.y - 3, width: 6, height: 6, borderRadius: 3,
          backgroundColor: color.amber, opacity: 0.35 + (i / aim!.dots.length) * 0.5,
        }} />
      )) : null}

      {/* ball (shadow + body + highlight) */}
      <View pointerEvents="none" style={{ position: "absolute", left: ballSX - ballR + 1.5, top: ballSY - ballR + 2.5, width: ballR * 2, height: ballR * 2, borderRadius: ballR, backgroundColor: "rgba(0,0,0,0.33)" }} />
      <View pointerEvents="none" style={{ position: "absolute", left: ballSX - ballR, top: ballSY - ballR, width: ballR * 2, height: ballR * 2, borderRadius: ballR, backgroundColor: color.text, borderWidth: 2, borderColor: "#C9C3B4" }} />
      <View pointerEvents="none" style={{ position: "absolute", left: ballSX - ballR * 0.35, top: ballSY - ballR * 0.5, width: ballR * 0.55, height: ballR * 0.55, borderRadius: ballR * 0.3, backgroundColor: "#FFFFFF" }} />

      {/* particle / score-pop layer */}
      <EffectsLayer ref={fx} reduced={reducedMotion} />

      {/* HUD */}
      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <View style={st.hudPanel}>
          <PixelText size="score">HOLE {holeIdx + 1}/{HOLES.length}  ·  PAR {hole.par}</PixelText>
          <PixelText size="label" style={{ marginTop: 4 }}>STROKES {strokes}</PixelText>
          <PixelText size="label" style={{ marginTop: 4, color: hole.wind === 0 ? color.textMuted : color.cyan }}>
            WIND {windArrow} {hole.wind === 0 ? "CALM" : windMag}
          </PixelText>
        </View>
        <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
      </View>

      {/* power meter while aiming */}
      {aim ? (
        <View style={[st.powerWrap, { bottom: Math.max(insets.bottom, 16) + 48 }]} pointerEvents="none">
          <PixelText size="label" style={{ color: color.text, marginBottom: 6 }}>PWR {Math.round(aim.frac * 100)}%</PixelText>
          <View style={st.powerTrack}>
            <View style={[st.powerFill, { width: `${Math.round(aim.frac * 100)}%`, backgroundColor: aim.frac > 0.75 ? color.danger : aim.frac > 0.4 ? color.amber : color.success }]} />
          </View>
        </View>
      ) : null}

      {!aim && phase === "play" ? (
        <View style={[st.hint, { bottom: Math.max(insets.bottom, 16) + 12 }]} pointerEvents="none">
          <PixelText size="label" style={{ color: color.textMuted }}>DRAG BACK FROM THE BALL TO AIM · RELEASE TO SHOOT</PixelText>
        </View>
      ) : null}

      {/* start */}
      <GameOverlay visible={phase === "start"} kind="pause" title="PUTT PAL"
        primaryLabel="Play" onPrimary={start} onExit={onExit}>
        <Body muted style={{ textAlign: "center", marginTop: space.md }}>
          Drag back from the ball to aim and power — arc it down the fairway and sink it. Mind the water.
        </Body>
      </GameOverlay>

      {/* hole complete */}
      <GameOverlay
        visible={phase === "holeDone"} kind="win"
        title={`HOLE ${holeIdx + 1}`}
        score={`${strokes} / PAR ${hole.par}  (${diffTag(strokes, hole.par)})`}
        primaryLabel={holeIdx >= HOLES.length - 1 ? "Course complete" : "Next hole"}
        onPrimary={advance} onExit={onExit}
      />

      {/* course complete */}
      <GameOverlay
        visible={phase === "courseDone"} kind="win"
        title="COURSE COMPLETE"
        score={`TOTAL ${totalStrokes} / PAR ${totalPar}  (${diffTag(totalStrokes, totalPar)})`}
        primaryLabel="Play again" onPrimary={restart} onExit={onExit}
      />
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  hud: { position: "absolute", left: 0, right: 0, zIndex: 5, paddingHorizontal: space.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  hudPanel: { backgroundColor: "rgba(20,26,34,0.72)", borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, borderColor: color.surfaceLine },
  hint: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: space.lg },
  powerWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  powerTrack: { width: SCREEN_W * 0.62, height: 12, borderRadius: 6, backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, overflow: "hidden", justifyContent: "center" },
  powerFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 6 },
});

export const puttPalGame: GameModule = {
  id: "putt-pal",
  title: "Putt Pal",
  kind: "arcade",
  Screen: GameScreen,
};
