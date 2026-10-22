import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Dimensions, type GestureResponderEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, IconButton, GameOverlay } from "../design/ui";

const { width: W, height: H } = Dimensions.get("window");
const BALL_R = 9;
const HOLE_R = 16;
const FRICTION = 0.975;
const SAND_FRICTION = 0.90;
const STOP_SPEED = 0.22;
const MAX_POWER = 18;
const DRAG_SCALE = 0.14;
const MAX_PULL = MAX_POWER / DRAG_SCALE; // px of drag for full power
const WALL_REST = 0.7;
const SINK_SPEED = 7.5;

// Fixed play rectangle (deterministic — independent of notch insets).
const PT = 118;            // play top
const PB = H - 146;        // play bottom
const PLx = 14;            // play left
const PRx = W - 14;        // play right
const PW = PRx - PLx;
const PH = PB - PT;
const fx = (v: number) => PLx + PW * v;
const fy = (v: number) => PT + PH * v;

interface Vec { x: number; y: number; }
interface Rect { x: number; y: number; w: number; h: number; }
const rect = (x: number, y: number, w: number, h: number): Rect => ({ x: fx(x), y: fy(y), w: PW * w, h: PH * h });

interface Hole { par: number; start: Vec; hole: Vec; walls: Rect[]; sand: Rect[]; water: Rect[]; }

const HOLES: Hole[] = [
  // 1 — gentle straight putt
  { par: 2, start: { x: fx(0.5), y: fy(0.86) }, hole: { x: fx(0.5), y: fy(0.12) }, walls: [], sand: [], water: [] },
  // 2 — wall across with a gap on the right
  {
    par: 3, start: { x: fx(0.5), y: fy(0.86) }, hole: { x: fx(0.5), y: fy(0.12) },
    walls: [rect(0.0, 0.45, 0.62, 0.055)], sand: [], water: [],
  },
  // 3 — dog-leg around a vertical + bottom wall, sand patch en route
  {
    par: 3, start: { x: fx(0.22), y: fy(0.86) }, hole: { x: fx(0.80), y: fy(0.12) },
    walls: [rect(0.40, 0.0, 0.055, 0.55), rect(0.0, 0.70, 0.55, 0.055)],
    sand: [rect(0.55, 0.52, 0.30, 0.20)], water: [],
  },
  // 4 — weave between two walls, pond hazard in the corner
  {
    par: 4, start: { x: fx(0.2), y: fy(0.85) }, hole: { x: fx(0.82), y: fy(0.16) },
    walls: [rect(0.28, 0.0, 0.055, 0.52), rect(0.55, 0.48, 0.055, 0.52)],
    sand: [], water: [rect(0.0, 0.0, 0.24, 0.22)],
  },
];

function inRect(x: number, y: number, r: Rect) {
  return x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
}

// AABB (expanded by ball radius) resolve with least-penetration axis.
function resolveRect(b: Vec, v: Vec, r: Rect) {
  const left = r.x - BALL_R, right = r.x + r.w + BALL_R, top = r.y - BALL_R, bottom = r.y + r.h + BALL_R;
  if (b.x > left && b.x < right && b.y > top && b.y < bottom) {
    const penL = b.x - left, penR = right - b.x, penT = b.y - top, penB = bottom - b.y;
    const m = Math.min(penL, penR, penT, penB);
    if (m === penL) { b.x = left; v.x = -Math.abs(v.x) * WALL_REST; }
    else if (m === penR) { b.x = right; v.x = Math.abs(v.x) * WALL_REST; }
    else if (m === penT) { b.y = top; v.y = -Math.abs(v.y) * WALL_REST; }
    else { b.y = bottom; v.y = Math.abs(v.y) * WALL_REST; }
  }
}

function GameScreen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const holeRef = useRef(0);
  const ballRef = useRef<Vec>({ ...HOLES[0].start });
  const velRef = useRef<Vec>({ x: 0, y: 0 });
  const preShotRef = useRef<Vec>({ ...HOLES[0].start });
  const movingRef = useRef(false);
  const dragStartRef = useRef<Vec | null>(null);
  const dragNowRef = useRef<Vec | null>(null);
  const phaseRef = useRef<"aim" | "holeDone" | "courseDone">("aim");
  const strokesRef = useRef(0);
  const totalRef = useRef(0);   // strokes on completed holes
  const parRef = useRef(0);     // par of completed holes
  const rafRef = useRef<number | null>(null);

  const [, setTick] = useState(0);
  const [holeIdx, setHoleIdx] = useState(0);
  const [strokes, setStrokes] = useState(0);
  const [phase, setPhase] = useState<"aim" | "holeDone" | "courseDone">("aim");
  const bump = () => setTick((t) => (t + 1) % 1000000);

  const step = () => {
    if (phaseRef.current !== "aim" || !movingRef.current) return;
    const b = ballRef.current;
    const v = velRef.current;
    const hole = HOLES[holeRef.current];

    for (let s = 0; s < 2; s++) {
      b.x += v.x / 2; b.y += v.y / 2;
      if (b.x < PLx + BALL_R) { b.x = PLx + BALL_R; v.x = Math.abs(v.x) * WALL_REST; }
      else if (b.x > PRx - BALL_R) { b.x = PRx - BALL_R; v.x = -Math.abs(v.x) * WALL_REST; }
      if (b.y < PT + BALL_R) { b.y = PT + BALL_R; v.y = Math.abs(v.y) * WALL_REST; }
      else if (b.y > PB - BALL_R) { b.y = PB - BALL_R; v.y = -Math.abs(v.y) * WALL_REST; }
      for (const w of hole.walls) resolveRect(b, v, w);
    }

    // sand slows the ball
    let fr = FRICTION;
    for (const sd of hole.sand) if (inRect(b.x, b.y, sd)) { fr = SAND_FRICTION; break; }
    v.x *= fr; v.y *= fr;

    // water hazard: reset to pre-shot spot with a penalty stroke
    for (const wt of hole.water) {
      if (inRect(b.x, b.y, wt)) {
        b.x = preShotRef.current.x; b.y = preShotRef.current.y;
        v.x = 0; v.y = 0; movingRef.current = false;
        strokesRef.current += 1; setStrokes(strokesRef.current);
        bump(); return;
      }
    }

    const dx = b.x - hole.hole.x, dy = b.y - hole.hole.y;
    const dist = Math.hypot(dx, dy);
    const speed = Math.hypot(v.x, v.y);
    if (dist < HOLE_R && speed < SINK_SPEED) {
      b.x = hole.hole.x; b.y = hole.hole.y; v.x = 0; v.y = 0;
      movingRef.current = false;
      phaseRef.current = "holeDone"; setPhase("holeDone");
      bump(); return;
    }
    if (speed < STOP_SPEED) { v.x = 0; v.y = 0; movingRef.current = false; }
    bump();
  };

  useEffect(() => {
    let mounted = true;
    const loop = () => { step(); if (mounted) rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => { mounted = false; if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canAim = () => phaseRef.current === "aim" && !movingRef.current;

  const onGrant = (e: GestureResponderEvent) => {
    if (!canAim()) return;
    const p = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
    dragStartRef.current = p; dragNowRef.current = p; bump();
  };
  const onMove = (e: GestureResponderEvent) => {
    if (!canAim() || !dragStartRef.current) return;
    dragNowRef.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }; bump();
  };
  const onRelease = () => {
    const start = dragStartRef.current;
    const now = dragNowRef.current;
    dragStartRef.current = null; dragNowRef.current = null;
    if (!canAim() || !start || !now) { bump(); return; }
    let dx = (start.x - now.x) * DRAG_SCALE;
    let dy = (start.y - now.y) * DRAG_SCALE;
    const mag = Math.hypot(dx, dy);
    if (mag < 1.2) { bump(); return; }
    if (mag > MAX_POWER) { dx = (dx / mag) * MAX_POWER; dy = (dy / mag) * MAX_POWER; }
    preShotRef.current = { ...ballRef.current };
    velRef.current = { x: dx, y: dy };
    movingRef.current = true;
    strokesRef.current += 1; setStrokes(strokesRef.current);
    bump();
  };

  const loadHole = (idx: number) => {
    holeRef.current = idx;
    ballRef.current = { ...HOLES[idx].start };
    preShotRef.current = { ...HOLES[idx].start };
    velRef.current = { x: 0, y: 0 };
    movingRef.current = false;
    strokesRef.current = 0;
    setHoleIdx(idx); setStrokes(0);
    phaseRef.current = "aim"; setPhase("aim");
  };

  const nextHole = () => {
    totalRef.current += strokesRef.current;
    parRef.current += HOLES[holeRef.current].par;
    if (holeRef.current >= HOLES.length - 1) { phaseRef.current = "courseDone"; setPhase("courseDone"); bump(); return; }
    loadHole(holeRef.current + 1);
    bump();
  };

  const restartCourse = () => {
    totalRef.current = 0; parRef.current = 0;
    loadHole(0); bump();
  };

  // ----- render -----
  const b = ballRef.current;
  const hole = HOLES[holeIdx];
  const dragging = canAim() && dragStartRef.current && dragNowRef.current;
  let aim: { dots: Vec[]; power: number } | null = null;
  if (dragging && dragStartRef.current && dragNowRef.current) {
    const sdx = dragStartRef.current.x - dragNowRef.current.x;
    const sdy = dragStartRef.current.y - dragNowRef.current.y;
    const pull = Math.hypot(sdx, sdy);
    const power = Math.min(1, pull / MAX_PULL);
    const ang = Math.atan2(sdy, sdx);
    const dots: Vec[] = [];
    const reach = 26 + power * 92;
    for (let i = 1; i <= 5; i++) {
      const d = (reach / 5) * i;
      dots.push({ x: b.x + Math.cos(ang) * d, y: b.y + Math.sin(ang) * d });
    }
    aim = { dots, power };
  }
  const totalSoFar = totalRef.current + strokes;

  return (
    <View
      style={st.fill}
      onStartShouldSetResponder={canAim}
      onMoveShouldSetResponder={canAim}
      onResponderGrant={onGrant}
      onResponderMove={onMove}
      onResponderRelease={onRelease}
    >
      {/* play field */}
      <View pointerEvents="none" style={{ position: "absolute", left: PLx, top: PT, width: PW, height: PH, backgroundColor: "#1C3A1E", borderRadius: radius.md, borderWidth: 2, borderColor: "#0E2410" }} />

      {/* water hazards */}
      {hole.water.map((r, i) => (
        <View key={`w${i}`} pointerEvents="none" style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, backgroundColor: "rgba(0,229,255,0.22)", borderWidth: 2, borderColor: color.cyan, borderRadius: 6 }} />
      ))}
      {/* sand patches */}
      {hole.sand.map((r, i) => (
        <View key={`s${i}`} pointerEvents="none" style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, backgroundColor: "rgba(255,201,77,0.28)", borderWidth: 1, borderColor: color.warn, borderRadius: 6 }} />
      ))}
      {/* walls */}
      {hole.walls.map((r, i) => (
        <View key={`wl${i}`} pointerEvents="none" style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, backgroundColor: color.surface2, borderWidth: 2, borderColor: color.surfaceLine, borderRadius: 4 }} />
      ))}

      {/* hole + flag */}
      <View pointerEvents="none" style={{ position: "absolute", left: hole.hole.x - HOLE_R, top: hole.hole.y - HOLE_R, width: HOLE_R * 2, height: HOLE_R * 2, borderRadius: HOLE_R, backgroundColor: "#06140A", borderWidth: 3, borderColor: "#0E2410" }} />
      <View pointerEvents="none" style={{ position: "absolute", left: hole.hole.x - 1.5, top: hole.hole.y - HOLE_R - 30, width: 3, height: 30, backgroundColor: color.text }} />
      <View pointerEvents="none" style={{ position: "absolute", left: hole.hole.x + 1.5, top: hole.hole.y - HOLE_R - 30, width: 18, height: 12, backgroundColor: color.danger }} />

      {/* aim dots */}
      {aim ? aim.dots.map((d, i) => (
        <View key={`a${i}`} pointerEvents="none" style={{ position: "absolute", left: d.x - 3, top: d.y - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(243,239,230,0.85)" }} />
      )) : null}

      {/* ball */}
      <View pointerEvents="none" style={{ position: "absolute", left: b.x - BALL_R, top: b.y - BALL_R, width: BALL_R * 2, height: BALL_R * 2, borderRadius: BALL_R, backgroundColor: color.text, borderWidth: 2, borderColor: "#C9C3B4" }} />

      {/* HUD */}
      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <View style={st.hudPanel}>
          <PixelText size="score">H{holeIdx + 1}/{HOLES.length}  ·  {strokes}</PixelText>
          <PixelText size="label" style={{ marginTop: 4 }}>PAR {hole.par}  ·  TOT {totalSoFar}</PixelText>
        </View>
        <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
      </View>

      {/* power meter (only while aiming) */}
      {aim ? (
        <View style={[st.powerWrap, { bottom: Math.max(insets.bottom, 16) + 46 }]} pointerEvents="none">
          <View style={st.powerTrack}>
            <View style={[st.powerFill, { width: `${Math.round(aim.power * 100)}%`, backgroundColor: aim.power > 0.75 ? color.danger : aim.power > 0.4 ? color.amber : color.success }]} />
          </View>
        </View>
      ) : null}

      <View style={[st.hint, { bottom: Math.max(insets.bottom, 16) + 12 }]} pointerEvents="none">
        <PixelText size="label" style={{ color: color.textMuted }}>DRAG BACK FROM THE BALL, RELEASE TO PUTT</PixelText>
      </View>

      <GameOverlay
        visible={phase === "holeDone"} kind="win"
        title={`HOLE ${holeIdx + 1} DONE`}
        score={`${strokes} STROKES  ·  PAR ${hole.par}`}
        primaryLabel={holeIdx >= HOLES.length - 1 ? "See results" : "Next hole"}
        onPrimary={nextHole} onExit={onExit}
      />
      <GameOverlay
        visible={phase === "courseDone"} kind="win"
        title="COURSE COMPLETE"
        score={`TOTAL ${totalRef.current}  ·  PAR ${parRef.current}  (${totalRef.current - parRef.current >= 0 ? "+" : ""}${totalRef.current - parRef.current})`}
        primaryLabel="Play again" onPrimary={restartCourse} onExit={onExit}
      />
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  hud: { position: "absolute", left: 0, right: 0, zIndex: 5, paddingHorizontal: space.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  hudPanel: { backgroundColor: "rgba(20,26,34,0.7)", borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, borderColor: color.surfaceLine },
  hint: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  powerWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  powerTrack: { width: W * 0.6, height: 10, borderRadius: 5, backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, overflow: "hidden" },
  powerFill: { height: "100%", borderRadius: 5 },
});

export const puttPalGame: GameModule = {
  id: "putt-pal",
  title: "Putt Pal",
  kind: "arcade",
  Screen: GameScreen,
};
