import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Dimensions, type GestureResponderEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, IconButton, GameOverlay } from "../design/ui";

const { width: W, height: H } = Dimensions.get("window");

// ----- tuning (all deterministic; nothing depends on the model) -----
const BALL_R = 9;
const HOLE_R = 16;
const FRICTION = 0.976;       // green roll decay per frame
const SAND_FRICTION = 0.90;   // bunkers bite harder
const STOP_SPEED = 0.22;      // below this the ball is considered at rest
const MAX_POWER = 19;         // launch speed at full pull
const MIN_PULL = 12;          // px — shorter than this is a tap, not a putt
const MAX_PULL = 170;         // px of pull-back for full power
const GRAB_R = 56;            // you must start the drag within this of the ball
const WALL_REST = 0.7;        // bounce energy kept off bumpers
const RAMP_MAX = 16;          // speed cap while on a boost ramp
const SINK_SPEED = 7.5;       // must be slower than this to drop in the cup

// Fixed play rectangle (deterministic — independent of notch insets).
const PT = 118;            // play top
const PB = H - 150;        // play bottom
const PLx = 14;            // play left
const PRx = W - 14;        // play right
const PW = PRx - PLx;
const PH = PB - PT;
const fx = (v: number) => PLx + PW * v;
const fy = (v: number) => PT + PH * v;

interface Vec { x: number; y: number; }
interface Rect { x: number; y: number; w: number; h: number; }
interface Ramp { r: Rect; dir: Vec; accel: number; } // dir is a unit vector
const rect = (x: number, y: number, w: number, h: number): Rect => ({ x: fx(x), y: fy(y), w: PW * w, h: PH * h });
const ramp = (x: number, y: number, w: number, h: number, dir: Vec, accel: number): Ramp => ({ r: rect(x, y, w, h), dir, accel });

interface Hole { par: number; start: Vec; hole: Vec; walls: Rect[]; sand: Rect[]; water: Rect[]; ramps: Ramp[]; }

const HOLES: Hole[] = [
  // 1 — gentle straight putt
  { par: 2, start: { x: fx(0.5), y: fy(0.86) }, hole: { x: fx(0.5), y: fy(0.12) }, walls: [], sand: [], water: [], ramps: [] },
  // 2 — wall across with a gap on the right
  {
    par: 3, start: { x: fx(0.5), y: fy(0.86) }, hole: { x: fx(0.5), y: fy(0.12) },
    walls: [rect(0.0, 0.45, 0.62, 0.055)], sand: [], water: [], ramps: [],
  },
  // 3 — dog-leg around a vertical + bottom wall, sand patch en route
  {
    par: 3, start: { x: fx(0.22), y: fy(0.86) }, hole: { x: fx(0.80), y: fy(0.12) },
    walls: [rect(0.40, 0.0, 0.055, 0.55), rect(0.0, 0.70, 0.55, 0.055)],
    sand: [rect(0.55, 0.52, 0.30, 0.20)], water: [], ramps: [],
  },
  // 4 — weave between two walls, pond hazard in the corner
  {
    par: 4, start: { x: fx(0.2), y: fy(0.85) }, hole: { x: fx(0.82), y: fy(0.16) },
    walls: [rect(0.28, 0.0, 0.055, 0.52), rect(0.55, 0.48, 0.055, 0.52)],
    sand: [], water: [rect(0.0, 0.0, 0.24, 0.22)], ramps: [],
  },
  // 5 — speed ramp up a bumpered corridor, bunkers down each side
  {
    par: 4, start: { x: fx(0.5), y: fy(0.88) }, hole: { x: fx(0.5), y: fy(0.10) },
    walls: [rect(0.30, 0.22, 0.055, 0.56), rect(0.645, 0.22, 0.055, 0.56)],
    sand: [rect(0.0, 0.40, 0.24, 0.20), rect(0.76, 0.40, 0.24, 0.20)],
    water: [],
    ramps: [ramp(0.40, 0.56, 0.20, 0.16, { x: 0, y: -1 }, 0.95)],
  },
];

function inRect(x: number, y: number, r: Rect) {
  return x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
}

// AABB (expanded by ball radius) resolve with least-penetration axis — a fair,
// readable bumper bounce that never lets the ball tunnel into a wall.
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

const scoreTerm = (diff: number): string => {
  if (diff <= -3) return "ALBATROSS";
  if (diff === -2) return "EAGLE";
  if (diff === -1) return "BIRDIE";
  if (diff === 0) return "PAR";
  if (diff === 1) return "BOGEY";
  if (diff === 2) return "DOUBLE BOGEY";
  return `+${diff}`;
};

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
  const totalRef = useRef(0);          // strokes on completed holes
  const parRef = useRef(0);            // par of completed holes
  const scoresRef = useRef<number[]>([]); // strokes taken, per completed hole
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

    // Adaptive sub-stepping: more slices when the ball is fast so it can never
    // pass through a thin wall in a single frame (fair collisions).
    const speed0 = Math.hypot(v.x, v.y);
    const sub = Math.max(2, Math.min(8, Math.ceil(speed0 / BALL_R)));
    for (let s = 0; s < sub; s++) {
      b.x += v.x / sub; b.y += v.y / sub;
      if (b.x < PLx + BALL_R) { b.x = PLx + BALL_R; v.x = Math.abs(v.x) * WALL_REST; }
      else if (b.x > PRx - BALL_R) { b.x = PRx - BALL_R; v.x = -Math.abs(v.x) * WALL_REST; }
      if (b.y < PT + BALL_R) { b.y = PT + BALL_R; v.y = Math.abs(v.y) * WALL_REST; }
      else if (b.y > PB - BALL_R) { b.y = PB - BALL_R; v.y = -Math.abs(v.y) * WALL_REST; }
      for (const w of hole.walls) resolveRect(b, v, w);
    }

    // ramps: a bounded speed boost along their arrow while the ball is on them
    for (const rp of hole.ramps) {
      if (inRect(b.x, b.y, rp.r)) {
        v.x += rp.dir.x * rp.accel; v.y += rp.dir.y * rp.accel;
        const sp = Math.hypot(v.x, v.y);
        if (sp > RAMP_MAX) { v.x = (v.x / sp) * RAMP_MAX; v.y = (v.y / sp) * RAMP_MAX; }
      }
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
  const nearBall = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX, y = e.nativeEvent.locationY;
    const b = ballRef.current;
    return Math.hypot(x - b.x, y - b.y) <= GRAB_R;
  };

  // Only begin aiming when the touch lands on/near the ball — you grab the ball.
  const onStartResponder = (e: GestureResponderEvent) => canAim() && nearBall(e);

  const onGrant = (e: GestureResponderEvent) => {
    const p = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
    dragStartRef.current = p; dragNowRef.current = p; bump();
  };
  const onMove = (e: GestureResponderEvent) => {
    if (!dragStartRef.current) return;
    dragNowRef.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }; bump();
  };
  const onRelease = () => {
    const now = dragNowRef.current;
    dragStartRef.current = null; dragNowRef.current = null;
    if (!canAim() || !now) { bump(); return; }
    // Pull vector = finger pulled away from the ball; the ball launches opposite.
    const b = ballRef.current;
    const pdx = now.x - b.x, pdy = now.y - b.y;
    const pull = Math.hypot(pdx, pdy);
    if (pull < MIN_PULL) { bump(); return; } // just a tap
    const power = Math.min(1, pull / MAX_PULL);
    const speed = power * MAX_POWER;
    const ux = -pdx / pull, uy = -pdy / pull;
    preShotRef.current = { ...b };
    velRef.current = { x: ux * speed, y: uy * speed };
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
    scoresRef.current[holeRef.current] = strokesRef.current;
    if (holeRef.current >= HOLES.length - 1) { phaseRef.current = "courseDone"; setPhase("courseDone"); bump(); return; }
    loadHole(holeRef.current + 1);
    bump();
  };

  const restartCourse = () => {
    totalRef.current = 0; parRef.current = 0; scoresRef.current = [];
    loadHole(0); bump();
  };

  // ----- derive aim preview -----
  const b = ballRef.current;
  const hole = HOLES[holeIdx];
  const idle = canAim() && !dragStartRef.current;
  const dragging = !!(canAim() && dragStartRef.current && dragNowRef.current);
  let aim: { dots: Vec[]; power: number; ang: number; tip: Vec; finger: Vec } | null = null;
  if (dragging && dragNowRef.current) {
    const finger = dragNowRef.current;
    const pdx = finger.x - b.x, pdy = finger.y - b.y;
    const pull = Math.hypot(pdx, pdy) || 1;
    const power = Math.min(1, pull / MAX_PULL);
    const ang = Math.atan2(-pdy, -pdx); // launch direction (opposite the pull)
    const reach = 28 + power * 120;
    const dots: Vec[] = [];
    for (let i = 1; i <= 6; i++) {
      const d = (reach / 6) * i;
      dots.push({ x: b.x + Math.cos(ang) * d, y: b.y + Math.sin(ang) * d });
    }
    const tip = { x: b.x + Math.cos(ang) * reach, y: b.y + Math.sin(ang) * reach };
    aim = { dots, power, ang, tip, finger };
  }
  const totalSoFar = totalRef.current + strokes;
  const liveDiff = totalSoFar - (parRef.current + hole.par);
  const stripeH = PH / 10;

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
      {/* fairway with mowing stripes */}
      <View pointerEvents="none" style={st.fairway}>
        {Array.from({ length: 10 }).map((_, i) => (
          <View key={`g${i}`} style={{ position: "absolute", left: 0, right: 0, top: i * stripeH, height: stripeH + 1, backgroundColor: i % 2 ? "#2E7D32" : "#34893B" }} />
        ))}
      </View>

      {/* water hazards (blue — resets the stroke) */}
      {hole.water.map((r, i) => (
        <View key={`w${i}`} pointerEvents="none" style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, backgroundColor: "#2F6FB2", borderWidth: 2, borderColor: "#6FA8DC", borderRadius: 6 }} />
      ))}
      {/* sand bunkers (tan) */}
      {hole.sand.map((r, i) => (
        <View key={`s${i}`} pointerEvents="none" style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, backgroundColor: "#D9C27E", borderWidth: 1, borderColor: "#B89B52", borderRadius: 10 }} />
      ))}
      {/* ramps (boost pads) */}
      {hole.ramps.map((rp, i) => {
        const deg = (Math.atan2(rp.dir.y, rp.dir.x) * 180) / Math.PI + 90; // arrow glyph points up by default
        return (
          <View key={`rp${i}`} pointerEvents="none" style={{ position: "absolute", left: rp.r.x, top: rp.r.y, width: rp.r.w, height: rp.r.h, backgroundColor: color.cyanGlowBg, borderWidth: 2, borderColor: color.cyan, borderRadius: 6, alignItems: "center", justifyContent: "center" }}>
            <PixelText size="label" style={{ color: color.cyan, transform: [{ rotate: `${deg}deg` }] }}>^ ^ ^</PixelText>
          </View>
        );
      })}
      {/* walls / bumpers */}
      {hole.walls.map((r, i) => (
        <View key={`wl${i}`} pointerEvents="none" style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, backgroundColor: "#9C6B3F", borderWidth: 2, borderColor: "#6E4A28", borderRadius: 4 }} />
      ))}

      {/* hole + flag */}
      <View pointerEvents="none" style={{ position: "absolute", left: hole.hole.x - HOLE_R, top: hole.hole.y - HOLE_R, width: HOLE_R * 2, height: HOLE_R * 2, borderRadius: HOLE_R, backgroundColor: "#0A2A12", borderWidth: 3, borderColor: "#06160A" }} />
      <View pointerEvents="none" style={{ position: "absolute", left: hole.hole.x - 1.5, top: hole.hole.y - HOLE_R - 30, width: 3, height: 30, backgroundColor: color.text }} />
      <View pointerEvents="none" style={{ position: "absolute", left: hole.hole.x + 1.5, top: hole.hole.y - HOLE_R - 30, width: 18, height: 12, backgroundColor: color.danger }} />

      {/* grab-zone hint while the ball is at rest */}
      {idle ? (
        <View pointerEvents="none" style={{ position: "absolute", left: b.x - GRAB_R, top: b.y - GRAB_R, width: GRAB_R * 2, height: GRAB_R * 2, borderRadius: GRAB_R, borderWidth: 1, borderColor: "rgba(243,239,230,0.18)" }} />
      ) : null}

      {/* pull-back tether (ball -> finger) */}
      {aim ? aim.dots.map((d, i) => (
        <View key={`a${i}`} pointerEvents="none" style={{ position: "absolute", left: d.x - 3.5, top: d.y - 3.5, width: 7, height: 7, borderRadius: 3.5, backgroundColor: color.amber, opacity: 0.45 + (i / aim!.dots.length) * 0.5 }} />
      )) : null}
      {/* arrowhead at the aim tip */}
      {aim ? (
        <View pointerEvents="none" style={{ position: "absolute", left: aim.tip.x - 6, top: aim.tip.y - 7, width: 0, height: 0, borderTopWidth: 7, borderBottomWidth: 7, borderLeftWidth: 12, borderTopColor: "transparent", borderBottomColor: "transparent", borderLeftColor: color.amber, transform: [{ rotate: `${aim.ang}rad` }] }} />
      ) : null}

      {/* ball (shadow + body + highlight) */}
      <View pointerEvents="none" style={{ position: "absolute", left: b.x - BALL_R + 1.5, top: b.y - BALL_R + 2.5, width: BALL_R * 2, height: BALL_R * 2, borderRadius: BALL_R, backgroundColor: "rgba(0,0,0,0.33)" }} />
      <View pointerEvents="none" style={{ position: "absolute", left: b.x - BALL_R, top: b.y - BALL_R, width: BALL_R * 2, height: BALL_R * 2, borderRadius: BALL_R, backgroundColor: color.text, borderWidth: 2, borderColor: "#C9C3B4" }} />
      <View pointerEvents="none" style={{ position: "absolute", left: b.x - 3, top: b.y - 4, width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#FFFFFF" }} />

      {/* HUD */}
      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <View style={st.hudPanel}>
          <PixelText size="score">H{holeIdx + 1}/{HOLES.length}  ·  {strokes}</PixelText>
          <PixelText size="label" style={{ marginTop: 4 }}>
            PAR {hole.par}  ·  {liveDiff === 0 ? "EVEN" : liveDiff > 0 ? `+${liveDiff}` : `${liveDiff}`}
          </PixelText>
        </View>
        <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
      </View>

      {/* power meter (only while aiming) */}
      {aim ? (
        <View style={[st.powerWrap, { bottom: Math.max(insets.bottom, 16) + 48 }]} pointerEvents="none">
          <PixelText size="label" style={{ color: color.text, marginBottom: 6 }}>PWR {Math.round(aim.power * 100)}%</PixelText>
          <View style={st.powerTrack}>
            <View style={[st.powerFill, { width: `${Math.round(aim.power * 100)}%`, backgroundColor: aim.power > 0.75 ? color.danger : aim.power > 0.4 ? color.amber : color.success }]} />
            {[0.25, 0.5, 0.75].map((t) => (
              <View key={`t${t}`} style={[st.tick, { left: `${t * 100}%` }]} />
            ))}
          </View>
        </View>
      ) : null}

      <View style={[st.hint, { bottom: Math.max(insets.bottom, 16) + 12 }]} pointerEvents="none">
        <PixelText size="label" style={{ color: color.textMuted }}>GRAB THE BALL, PULL BACK TO AIM, RELEASE TO PUTT</PixelText>
      </View>

      <GameOverlay
        visible={phase === "holeDone"} kind="win"
        title={`HOLE ${holeIdx + 1}: ${scoreTerm(strokes - hole.par)}`}
        score={`${strokes} STROKES  ·  PAR ${hole.par}`}
        primaryLabel={holeIdx >= HOLES.length - 1 ? "See results" : "Next hole"}
        onPrimary={nextHole} onExit={onExit}
      />
      <GameOverlay
        visible={phase === "courseDone"} kind="win"
        title="COURSE COMPLETE"
        score={`TOTAL ${totalRef.current}  ·  PAR ${parRef.current}  (${totalRef.current - parRef.current >= 0 ? "+" : ""}${totalRef.current - parRef.current})`}
        primaryLabel="Play again" onPrimary={restartCourse} onExit={onExit}
      >
        <View style={st.card}>
          {HOLES.map((h, i) => {
            const s = scoresRef.current[i] ?? 0;
            return (
              <View key={`sc${i}`} style={st.cardRow}>
                <PixelText size="label" style={{ color: color.textMuted }}>HOLE {i + 1}</PixelText>
                <PixelText size="label" style={{ color: color.text }}>{s} / PAR {h.par}</PixelText>
              </View>
            );
          })}
        </View>
      </GameOverlay>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  fairway: { position: "absolute", left: PLx, top: PT, width: PW, height: PH, borderRadius: radius.md, borderWidth: 3, borderColor: "#1B5E20", backgroundColor: "#2E7D32", overflow: "hidden" },
  hud: { position: "absolute", left: 0, right: 0, zIndex: 5, paddingHorizontal: space.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  hudPanel: { backgroundColor: "rgba(20,26,34,0.7)", borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, borderColor: color.surfaceLine },
  hint: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: space.lg },
  powerWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  powerTrack: { width: W * 0.62, height: 12, borderRadius: 6, backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, overflow: "hidden", justifyContent: "center" },
  powerFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 6 },
  tick: { position: "absolute", top: 2, bottom: 2, width: 1, backgroundColor: "rgba(11,15,20,0.5)" },
  card: { marginTop: space.lg, backgroundColor: color.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: color.surfaceLine, paddingHorizontal: space.md, paddingVertical: space.sm },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 5 },
});

export const puttPalGame: GameModule = {
  id: "putt-pal",
  title: "Putt Pal",
  kind: "arcade",
  Screen: GameScreen,
};
