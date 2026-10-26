import React, { useEffect, useRef, useState } from "react";
import { View, Image, ImageBackground, Text, StyleSheet, Dimensions, type GestureResponderEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, GameOverlay } from "../design/ui";
import { ScoreboardOverlay } from "../design/Scoreboard";
import { EffectsLayer, type EffectsHandle } from "../design/effects";
import { useSettings } from "../settings";

// Owned tileable textures + sprites (tools/art/gen_putt_art.py). Collision rects
// are defined per hole below; the art only skins them (collision is unchanged).
const GRASS = require("../../assets/arcade/putt/grass.png");
const WATER = require("../../assets/arcade/putt/water.png");
const SAND = require("../../assets/arcade/putt/sand.png");
const WOOD = require("../../assets/arcade/putt/wood.png");
const HEDGE = require("../../assets/arcade/putt/hedge.png");
const CUP = require("../../assets/arcade/putt/cup.png");
const FLAG = require("../../assets/arcade/putt/flag.png");
// themed sets
const DUNES = require("../../assets/arcade/putt/dunes.png");    // desert fairway
const NEON = require("../../assets/arcade/putt/neon.png");      // clockwork fairway
const METAL = require("../../assets/arcade/putt/metal.png");    // clockwork walls / gate
const WINDMILL = require("../../assets/arcade/putt/windmill.png"); // spinning deco
const BLOCKER = require("../../assets/arcade/putt/blocker.png");   // moving puck

const { width: W, height: H } = Dimensions.get("window");

// ----- tuning (all deterministic; nothing depends on the model) -----
// NOTE: FEEL ITEMS — friction, power curve, and mover periods below are first-pass
// guesses to be tuned ON-DEVICE (flagged in the report). Content/controls are fixed.
const BALL_R = 9;
const HOLE_R = 16;
const FRICTION = 0.976;       // green roll decay per frame            [feel]
const SAND_FRICTION = 0.90;   // bunkers bite harder                   [feel]
const STOP_SPEED = 0.22;      // below this the ball is at rest
const MAX_POWER = 19;         // launch speed at full pull             [feel]
const MIN_PULL = 12;          // px — shorter than this is a tap, not a putt
const MAX_PULL = 170;         // px of pull-back for full power
const GRAB_R = 56;            // you must start the drag within this of the ball
const WALL_REST = 0.7;        // bounce energy kept off bumpers        [feel]
const RAMP_MAX = 16;          // speed cap while on a boost ramp       [feel]
const SINK_SPEED = 7.5;       // must be slower than this to drop in the cup
const TRAIL_MAX = 12;         // ball-trail ring-buffer length

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
// A Mover translates on a triangle wave (constant speed, mechanical feel). It is a
// pure function of the frame counter — no RNG — so the course stays deterministic.
interface Mover { r: Rect; axis: "x" | "y"; amp: number; period: number; phase: number; kind: "blocker" | "gate"; }
interface Windmill { x: number; y: number; size: number; } // decorative spinning sprite

type ThemeId = "classic" | "desert" | "links" | "clockwork";
interface Theme { fairway: any; border: any; wall: any; rail: string; bg: string; name: string; }
const THEMES: Record<ThemeId, Theme> = {
  classic:   { fairway: GRASS, border: HEDGE, wall: WOOD,  rail: "#C0392B",    bg: "#2E7D32", name: "CLASSIC GREENS" },
  desert:    { fairway: DUNES, border: HEDGE, wall: WOOD,  rail: color.amber,  bg: "#C2A878", name: "DESERT DUNES" },
  links:     { fairway: GRASS, border: HEDGE, wall: WOOD,  rail: color.cyan,   bg: "#2E7D32", name: "WATER LINKS" },
  clockwork: { fairway: NEON,  border: METAL, wall: METAL, rail: color.cyan,   bg: "#141A22", name: "CLOCKWORK" },
};

const rect = (x: number, y: number, w: number, h: number): Rect => ({ x: fx(x), y: fy(y), w: PW * w, h: PH * h });
const ramp = (x: number, y: number, w: number, h: number, dir: Vec, accel: number): Ramp => ({ r: rect(x, y, w, h), dir, accel });
const mv = (x: number, y: number, w: number, h: number, axis: "x" | "y", ampFrac: number, period: number, phase: number, kind: "blocker" | "gate" = "blocker"): Mover =>
  ({ r: rect(x, y, w, h), axis, amp: (axis === "x" ? PW : PH) * ampFrac, period, phase, kind });
const wm = (x: number, y: number, size: number): Windmill => ({ x: fx(x), y: fy(y), size });

interface Hole {
  par: number; theme: ThemeId; start: Vec; hole: Vec;
  walls: Rect[]; sand: Rect[]; water: Rect[]; ramps: Ramp[]; movers: Mover[]; windmills: Windmill[];
}
// shorthand for the (common) empty-dynamic hole
const H0 = (h: Partial<Hole> & Pick<Hole, "par" | "theme" | "start" | "hole">): Hole => ({
  walls: [], sand: [], water: [], ramps: [], movers: [], windmills: [], ...h,
});

const HOLES: Hole[] = [
  // ===================== CLASSIC GREENS (1–5) =====================
  // 1 — gentle straight putt (teaches the pull-back)
  H0({ par: 2, theme: "classic", start: { x: fx(0.5), y: fy(0.86) }, hole: { x: fx(0.5), y: fy(0.12) } }),
  // 2 — wall across with a gap on the right
  H0({ par: 3, theme: "classic", start: { x: fx(0.5), y: fy(0.86) }, hole: { x: fx(0.5), y: fy(0.12) },
    walls: [rect(0.0, 0.45, 0.62, 0.055)] }),
  // 3 — dog-leg around an L of walls, sand patch en route
  H0({ par: 3, theme: "classic", start: { x: fx(0.22), y: fy(0.86) }, hole: { x: fx(0.80), y: fy(0.12) },
    walls: [rect(0.40, 0.0, 0.055, 0.55), rect(0.0, 0.70, 0.55, 0.055)],
    sand: [rect(0.55, 0.52, 0.30, 0.20)] }),
  // 4 — weave between two walls, pond hazard in the corner
  H0({ par: 4, theme: "classic", start: { x: fx(0.2), y: fy(0.85) }, hole: { x: fx(0.82), y: fy(0.16) },
    walls: [rect(0.28, 0.0, 0.055, 0.52), rect(0.55, 0.48, 0.055, 0.52)],
    water: [rect(0.0, 0.0, 0.24, 0.22)] }),
  // 5 — speed ramp up a bumpered corridor, bunkers down each side
  H0({ par: 4, theme: "classic", start: { x: fx(0.5), y: fy(0.88) }, hole: { x: fx(0.5), y: fy(0.10) },
    walls: [rect(0.30, 0.22, 0.055, 0.56), rect(0.645, 0.22, 0.055, 0.56)],
    sand: [rect(0.0, 0.40, 0.24, 0.20), rect(0.76, 0.40, 0.24, 0.20)],
    ramps: [ramp(0.40, 0.56, 0.20, 0.16, { x: 0, y: -1 }, 0.95)] }),

  // ===================== DESERT DUNES (6–9) =====================
  // 6 — go around (or power through) a big central bunker
  H0({ par: 3, theme: "desert", start: { x: fx(0.5), y: fy(0.88) }, hole: { x: fx(0.5), y: fy(0.12) },
    sand: [rect(0.25, 0.38, 0.50, 0.26)] }),
  // 7 — S-curve between two walls, sand on the inside of each bend
  H0({ par: 4, theme: "desert", start: { x: fx(0.5), y: fy(0.88) }, hole: { x: fx(0.5), y: fy(0.12) },
    walls: [rect(0.0, 0.40, 0.62, 0.05), rect(0.38, 0.64, 0.62, 0.05)],
    sand: [rect(0.62, 0.40, 0.38, 0.14), rect(0.0, 0.50, 0.30, 0.12)] }),
  // 8 — thread a grass strip between two long bunkers, nudge past a centre bump
  H0({ par: 4, theme: "desert", start: { x: fx(0.5), y: fy(0.88) }, hole: { x: fx(0.5), y: fy(0.12) },
    walls: [rect(0.46, 0.45, 0.08, 0.06)],
    sand: [rect(0.0, 0.20, 0.30, 0.55), rect(0.70, 0.20, 0.30, 0.55)] }),
  // 9 — long par-5: dog-leg, then a ramp to jump the sand belt
  H0({ par: 5, theme: "desert", start: { x: fx(0.15), y: fy(0.88) }, hole: { x: fx(0.85), y: fy(0.12) },
    walls: [rect(0.45, 0.30, 0.055, 0.50), rect(0.0, 0.74, 0.45, 0.055)],
    sand: [rect(0.50, 0.46, 0.50, 0.14)],
    ramps: [ramp(0.55, 0.60, 0.18, 0.14, { x: 0, y: -1 }, 1.0)] }),

  // ===================== WATER LINKS (10–13) =====================
  // 10 — water band with a central channel to thread
  H0({ par: 3, theme: "links", start: { x: fx(0.5), y: fy(0.88) }, hole: { x: fx(0.5), y: fy(0.12) },
    water: [rect(0.0, 0.42, 0.38, 0.12), rect(0.62, 0.42, 0.38, 0.12)] }),
  // 11 — two corner ponds with a central divider
  H0({ par: 4, theme: "links", start: { x: fx(0.2), y: fy(0.88) }, hole: { x: fx(0.82), y: fy(0.14) },
    walls: [rect(0.40, 0.30, 0.055, 0.40)],
    water: [rect(0.0, 0.0, 0.30, 0.30), rect(0.70, 0.55, 0.30, 0.30)] }),
  // 12 — dog-leg up the right of a top pond, around a wall
  H0({ par: 4, theme: "links", start: { x: fx(0.2), y: fy(0.88) }, hole: { x: fx(0.85), y: fy(0.18) },
    walls: [rect(0.0, 0.55, 0.55, 0.05)],
    water: [rect(0.30, 0.0, 0.40, 0.45)] }),
  // 13 — par-5 island thread: deep water either side, a mid post to swerve
  H0({ par: 5, theme: "links", start: { x: fx(0.5), y: fy(0.9) }, hole: { x: fx(0.5), y: fy(0.1) },
    walls: [rect(0.42, 0.30, 0.055, 0.22)],
    water: [rect(0.0, 0.28, 0.32, 0.44), rect(0.68, 0.28, 0.32, 0.44)] }),

  // ===================== CLOCKWORK (14–18) =====================
  // 14 — a single blocker sweeps across the lane (time your putt)
  H0({ par: 3, theme: "clockwork", start: { x: fx(0.5), y: fy(0.88) }, hole: { x: fx(0.5), y: fy(0.12) },
    movers: [mv(0.35, 0.46, 0.16, 0.08, "x", 0.30, 150, 0, "blocker")] }),
  // 15 — windmill gate: a bar sweeps the doorway between two walls
  H0({ par: 4, theme: "clockwork", start: { x: fx(0.5), y: fy(0.88) }, hole: { x: fx(0.5), y: fy(0.12) },
    walls: [rect(0.0, 0.45, 0.42, 0.05), rect(0.58, 0.45, 0.42, 0.05)],
    movers: [mv(0.44, 0.42, 0.10, 0.11, "x", 0.07, 120, 0, "gate")],
    windmills: [wm(0.5, 0.465, 86)] }),
  // 16 — two counter-phased blockers, then a ramp to the cup
  H0({ par: 4, theme: "clockwork", start: { x: fx(0.5), y: fy(0.9) }, hole: { x: fx(0.5), y: fy(0.1) },
    ramps: [ramp(0.42, 0.66, 0.16, 0.12, { x: 0, y: -1 }, 0.9)],
    movers: [mv(0.10, 0.38, 0.14, 0.07, "x", 0.22, 130, 0, "blocker"),
             mv(0.60, 0.56, 0.14, 0.07, "x", 0.22, 130, 0.5, "blocker")] }),
  // 17 — par-5: sand off the tee, a windmill gate, then a high blocker
  H0({ par: 5, theme: "clockwork", start: { x: fx(0.5), y: fy(0.9) }, hole: { x: fx(0.5), y: fy(0.1) },
    walls: [rect(0.0, 0.5, 0.40, 0.05), rect(0.60, 0.5, 0.40, 0.05)],
    sand: [rect(0.30, 0.68, 0.40, 0.12)],
    movers: [mv(0.43, 0.47, 0.12, 0.11, "x", 0.08, 120, 0, "gate"),
             mv(0.30, 0.22, 0.14, 0.07, "x", 0.24, 140, 0.25, "blocker")],
    windmills: [wm(0.5, 0.515, 88)] }),
  // 18 — GRAND FINALE: ramp, two windmill gates, a blocker between them
  H0({ par: 5, theme: "clockwork", start: { x: fx(0.5), y: fy(0.92) }, hole: { x: fx(0.5), y: fy(0.08) },
    walls: [rect(0.0, 0.62, 0.40, 0.045), rect(0.60, 0.62, 0.40, 0.045),
            rect(0.0, 0.30, 0.42, 0.045), rect(0.58, 0.30, 0.42, 0.045)],
    ramps: [ramp(0.42, 0.72, 0.16, 0.10, { x: 0, y: -1 }, 0.9)],
    movers: [mv(0.42, 0.585, 0.12, 0.10, "x", 0.08, 118, 0.0, "gate"),
             mv(0.43, 0.265, 0.12, 0.10, "x", 0.08, 118, 0.5, "gate"),
             mv(0.30, 0.46, 0.14, 0.06, "x", 0.22, 120, 0.25, "blocker")],
    windmills: [wm(0.5, 0.635, 84), wm(0.5, 0.315, 84)] }),
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

// triangle wave in [-1, 1], continuous, period 1 (constant-speed mechanical motion)
function triWave(t: number): number {
  const u = t - Math.floor(t);
  return u < 0.5 ? 4 * u - 1 : 3 - 4 * u;
}
function moverRect(m: Mover, f: number): Rect {
  const off = m.amp * triWave(f / m.period + m.phase);
  return { x: m.r.x + (m.axis === "x" ? off : 0), y: m.r.y + (m.axis === "y" ? off : 0), w: m.r.w, h: m.r.h };
}

const scoreTerm = (strokes: number, par: number): string => {
  if (strokes === 1) return "HOLE IN ONE";
  const diff = strokes - par;
  if (diff <= -3) return "ALBATROSS";
  if (diff === -2) return "EAGLE";
  if (diff === -1) return "BIRDIE";
  if (diff === 0) return "PAR";
  if (diff === 1) return "BOGEY";
  if (diff === 2) return "DOUBLE BOGEY";
  return `+${diff}`;
};
// 3 = under par or ace, 2 = par, 1 = over (always completed)
const starsFor = (strokes: number, par: number): number =>
  strokes <= 1 ? 3 : strokes < par ? 3 : strokes === par ? 2 : 1;

function Stars({ n, size = 16 }: { n: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <Text key={i} style={{ fontSize: size, color: i < n ? color.amber : color.textFaint }}>
          {i < n ? "★" : "☆"}
        </Text>
      ))}
    </View>
  );
}

function GameScreen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useSettings();
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  const fx2 = useRef<EffectsHandle>(null);
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
  const frameRef = useRef(0);          // deterministic clock for movers / windmills
  const trailRef = useRef<Vec[]>([]);  // ball trail ring buffer
  const inSandRef = useRef(false);     // edge-trigger the sand puff
  const rattleUntilRef = useRef(0);    // cup-rattle animation window (ms)

  const startedRef = useRef(false);
  const [, setTick] = useState(0);
  const [holeIdx, setHoleIdx] = useState(0);
  const [strokes, setStrokes] = useState(0);
  const [phase, setPhase] = useState<"aim" | "holeDone" | "courseDone">("aim");
  const [started, setStarted] = useState(false);
  const bump = () => setTick((t) => (t + 1) % 1000000);
  const start = () => { startedRef.current = true; setStarted(true); };

  const sink = (b: Vec, hole: Hole) => {
    b.x = hole.hole.x; b.y = hole.hole.y;
    velRef.current = { x: 0, y: 0 };
    movingRef.current = false;
    trailRef.current = [];
    const s = strokesRef.current;
    if (!reducedRef.current) {
      fx2.current?.burst(hole.hole.x, hole.hole.y, { color: color.amber, count: s === 1 ? 22 : 12, speed: s === 1 ? 190 : 130 });
      if (s === 1) fx2.current?.burst(hole.hole.x, hole.hole.y, { color: color.cyan, count: 14, speed: 150 });
    }
    fx2.current?.popScore(hole.hole.x, hole.hole.y - 24, scoreTerm(s, hole.par), s === 1 ? color.amber : s <= hole.par ? color.success : color.textMuted);
    rattleUntilRef.current = reducedRef.current ? 0 : Date.now() + 360;
    phaseRef.current = "holeDone"; setPhase("holeDone");
    bump();
  };

  const step = () => {
    frameRef.current++;
    const hole = HOLES[holeRef.current];
    const dynamic = hole.movers.length > 0 || hole.windmills.length > 0;

    // keep the cup-rattle window ticking after a sink, then idle
    if (phaseRef.current !== "aim") {
      if (rattleUntilRef.current && Date.now() < rattleUntilRef.current) bump();
      return;
    }

    if (!movingRef.current) {
      // Ball at rest: still push it clear of any blocker that sweeps into it so it
      // can never be trapped/crushed (all clockwork lanes have open escape room).
      if (hole.movers.length) {
        const b = ballRef.current;
        for (const m of hole.movers) {
          const cur = moverRect(m, frameRef.current);
          const left = cur.x - BALL_R, right = cur.x + cur.w + BALL_R, top = cur.y - BALL_R, bottom = cur.y + cur.h + BALL_R;
          if (b.x > left && b.x < right && b.y > top && b.y < bottom) {
            const pL = b.x - left, pR = right - b.x, pT = b.y - top, pB = bottom - b.y;
            const mm = Math.min(pL, pR, pT, pB);
            if (mm === pL) b.x = left; else if (mm === pR) b.x = right; else if (mm === pT) b.y = top; else b.y = bottom;
            b.x = Math.max(PLx + BALL_R, Math.min(PRx - BALL_R, b.x));
            b.y = Math.max(PT + BALL_R, Math.min(PB - BALL_R, b.y));
          }
        }
      }
      if (dynamic) bump();   // animate movers/windmills while the player lines up
      return;
    }

    const b = ballRef.current;
    const v = velRef.current;

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
      for (const m of hole.movers) resolveRect(b, v, moverRect(m, frameRef.current));
    }

    // ramps: a bounded speed boost along their arrow while the ball is on them
    for (const rp of hole.ramps) {
      if (inRect(b.x, b.y, rp.r)) {
        v.x += rp.dir.x * rp.accel; v.y += rp.dir.y * rp.accel;
        const sp = Math.hypot(v.x, v.y);
        if (sp > RAMP_MAX) { v.x = (v.x / sp) * RAMP_MAX; v.y = (v.y / sp) * RAMP_MAX; }
      }
    }

    // sand slows the ball (and puffs once on entry)
    let fr = FRICTION;
    let onSand = false;
    for (const sd of hole.sand) if (inRect(b.x, b.y, sd)) { fr = SAND_FRICTION; onSand = true; break; }
    if (onSand && !inSandRef.current && !reducedRef.current) fx2.current?.burst(b.x, b.y, { color: "#D8B26A", count: 8, speed: 90, rise: 10 });
    inSandRef.current = onSand;
    v.x *= fr; v.y *= fr;

    // trail (decoration only)
    if (!reducedRef.current) {
      const tr = trailRef.current;
      tr.push({ x: b.x, y: b.y });
      if (tr.length > TRAIL_MAX) tr.shift();
    }

    // water hazard: splash, reset to pre-shot spot, penalty stroke
    for (const wt of hole.water) {
      if (inRect(b.x, b.y, wt)) {
        if (!reducedRef.current) fx2.current?.burst(b.x, b.y, { color: color.cyan, count: 14, speed: 150, rise: 50 });
        fx2.current?.popScore(b.x, b.y - 18, "+1 WATER", color.danger);
        b.x = preShotRef.current.x; b.y = preShotRef.current.y;
        v.x = 0; v.y = 0; movingRef.current = false; trailRef.current = [];
        strokesRef.current += 1; setStrokes(strokesRef.current);
        bump(); return;
      }
    }

    const dx = b.x - hole.hole.x, dy = b.y - hole.hole.y;
    const dist = Math.hypot(dx, dy);
    const speed = Math.hypot(v.x, v.y);
    if (dist < HOLE_R && speed < SINK_SPEED) { sink(b, hole); return; }
    if (speed < STOP_SPEED) { v.x = 0; v.y = 0; movingRef.current = false; trailRef.current = []; }
    bump();
  };

  useEffect(() => {
    let mounted = true;
    const loop = () => { step(); if (mounted) rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => { mounted = false; if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canAim = () => phaseRef.current === "aim" && !movingRef.current && startedRef.current;
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
    trailRef.current = [];
    inSandRef.current = false;
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
    trailRef.current = [];
    inSandRef.current = false;
    rattleUntilRef.current = 0;
    fx2.current?.clear();
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
  const theme = THEMES[hole.theme];
  const idle = canAim() && !dragStartRef.current;
  const dragging = !!(canAim() && dragStartRef.current && dragNowRef.current);
  let aim: { dots: Vec[]; power: number; ang: number; tip: Vec } | null = null;
  if (dragging && dragNowRef.current) {
    const finger = dragNowRef.current;
    const pdx = finger.x - b.x, pdy = finger.y - b.y;
    const pull = Math.hypot(pdx, pdy) || 1;
    const power = Math.min(1, pull / MAX_PULL);
    const ang = Math.atan2(-pdy, -pdx); // launch direction (opposite the pull)
    const reach = 28 + power * 150;
    const dots: Vec[] = [];
    for (let i = 1; i <= 7; i++) {
      const d = (reach / 7) * i;
      dots.push({ x: b.x + Math.cos(ang) * d, y: b.y + Math.sin(ang) * d });
    }
    const tip = { x: b.x + Math.cos(ang) * reach, y: b.y + Math.sin(ang) * reach };
    aim = { dots, power, ang, tip };
  }
  const totalSoFar = totalRef.current + strokes;
  const liveDiff = totalSoFar - (parRef.current + hole.par);

  // cup-rattle offset for the sunk ball (decoration; reducedMotion -> none)
  let rattle = 0;
  if (phase === "holeDone" && rattleUntilRef.current) {
    const left = rattleUntilRef.current - Date.now();
    if (left > 0) { const p = left / 360; rattle = Math.sin(p * Math.PI * 7) * 4 * p; }
  }

  const windmillDeg = reducedMotion ? 0 : (frameRef.current * 2.2) % 360;

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
      {/* themed border behind the course (peeks out as a clipped frame) */}
      <ImageBackground source={theme.border} resizeMode="repeat"
        style={{ position: "absolute", left: PLx - 8, top: PT - 8, width: PW + 16, height: PH + 16, borderRadius: radius.md + 4, overflow: "hidden", pointerEvents: "none" }}
        imageStyle={{ borderRadius: radius.md + 4 }} />
      {/* fairway (themed tile) with themed rail */}
      <ImageBackground source={theme.fairway} resizeMode="repeat"
        style={[st.fairway, { borderColor: theme.rail, backgroundColor: theme.bg }]} imageStyle={{ borderRadius: radius.md }} />

      {/* water hazards (textured — resets the stroke) */}
      {hole.water.map((r, i) => (
        <ImageBackground key={`w${i}`} source={WATER} resizeMode="repeat" style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, borderWidth: 2, borderColor: "#6FA8DC", borderRadius: 6, overflow: "hidden", pointerEvents: "none" }} imageStyle={{ borderRadius: 4 }} />
      ))}
      {/* sand bunkers (textured) */}
      {hole.sand.map((r, i) => (
        <ImageBackground key={`s${i}`} source={SAND} resizeMode="repeat" style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, borderWidth: 1, borderColor: "#B89B52", borderRadius: 10, overflow: "hidden", pointerEvents: "none" }} imageStyle={{ borderRadius: 9 }} />
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
      {/* walls / bumpers (themed texture) */}
      {hole.walls.map((r, i) => (
        <ImageBackground key={`wl${i}`} source={theme.wall} resizeMode="repeat" style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, borderWidth: 2, borderColor: hole.theme === "clockwork" ? "#2E3A49" : "#6E4A28", borderRadius: 4, overflow: "hidden", pointerEvents: "none" }} imageStyle={{ borderRadius: 3 }} />
      ))}

      {/* moving blockers / windmill gates (sprites skin the live collision rect) */}
      {hole.movers.map((m, i) => {
        const cur = moverRect(m, frameRef.current);
        if (m.kind === "gate") {
          return (
            <ImageBackground key={`mv${i}`} source={METAL} resizeMode="repeat" style={{ position: "absolute", left: cur.x, top: cur.y, width: cur.w, height: cur.h, borderWidth: 2, borderColor: color.cyan, borderRadius: 4, overflow: "hidden", pointerEvents: "none" }} imageStyle={{ borderRadius: 3 }} />
          );
        }
        return (
          <Image key={`mv${i}`} source={BLOCKER} fadeDuration={0} resizeMode="stretch"
            style={{ position: "absolute", left: cur.x, top: cur.y, width: cur.w, height: cur.h }} />
        );
      })}
      {/* decorative windmills (spin over their gate; static when reducedMotion) */}
      {hole.windmills.map((w, i) => (
        <Image key={`wm${i}`} source={WINDMILL} fadeDuration={0}
          style={{ position: "absolute", left: w.x - w.size / 2, top: w.y - w.size / 2, width: w.size, height: w.size, transform: [{ rotate: `${windmillDeg}deg` }] }} />
      ))}

      {/* hole cup + flag (sprites) */}
      <View pointerEvents="none">
        <Image source={CUP} fadeDuration={0}
          style={{ position: "absolute", left: hole.hole.x - HOLE_R, top: hole.hole.y - HOLE_R, width: HOLE_R * 2, height: HOLE_R * 2 }} />
        <Image source={FLAG} fadeDuration={0}
          style={{ position: "absolute", left: hole.hole.x - 9, top: hole.hole.y - 52, width: 40, height: 60 }} />
      </View>

      {/* grab-zone hint while the ball is at rest */}
      {idle ? (
        <View pointerEvents="none" style={{ position: "absolute", left: b.x - GRAB_R, top: b.y - GRAB_R, width: GRAB_R * 2, height: GRAB_R * 2, borderRadius: GRAB_R, borderWidth: 1, borderColor: "rgba(243,239,230,0.18)" }} />
      ) : null}

      {/* ball trail (decoration) */}
      {!reducedMotion && !aim ? trailRef.current.map((t, i) => {
        const o = (i / TRAIL_MAX) * 0.33;
        const sz = 3 + (i / TRAIL_MAX) * 6;
        return <View key={`tr${i}`} pointerEvents="none" style={{ position: "absolute", left: t.x - sz / 2, top: t.y - sz / 2, width: sz, height: sz, borderRadius: sz / 2, backgroundColor: color.text, opacity: o }} />;
      }) : null}

      {/* aim hint: dotted trajectory + arrowhead at the tip */}
      {aim ? aim.dots.map((d, i) => (
        <View key={`a${i}`} pointerEvents="none" style={{ position: "absolute", left: d.x - 3.5, top: d.y - 3.5, width: 7, height: 7, borderRadius: 3.5, backgroundColor: color.amber, opacity: 0.4 + (i / aim!.dots.length) * 0.55 }} />
      )) : null}
      {aim ? (
        <View pointerEvents="none" style={{ position: "absolute", left: aim.tip.x - 6, top: aim.tip.y - 7, width: 0, height: 0, borderTopWidth: 7, borderBottomWidth: 7, borderLeftWidth: 12, borderTopColor: "transparent", borderBottomColor: "transparent", borderLeftColor: color.amber, transform: [{ rotate: `${aim.ang}rad` }] }} />
      ) : null}

      {/* ball (shadow + body + highlight), with cup-rattle offset when sinking */}
      <View pointerEvents="none" style={{ position: "absolute", left: b.x - BALL_R + 1.5 + rattle, top: b.y - BALL_R + 2.5, width: BALL_R * 2, height: BALL_R * 2, borderRadius: BALL_R, backgroundColor: "rgba(0,0,0,0.33)" }} />
      <View pointerEvents="none" style={{ position: "absolute", left: b.x - BALL_R + rattle, top: b.y - BALL_R, width: BALL_R * 2, height: BALL_R * 2, borderRadius: BALL_R, backgroundColor: color.text, borderWidth: 2, borderColor: "#C9C3B4" }} />
      <View pointerEvents="none" style={{ position: "absolute", left: b.x - 3 + rattle, top: b.y - 4, width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#FFFFFF" }} />

      {/* particle / score-pop layer (suppressed decoration when reducedMotion) */}
      <EffectsLayer ref={fx2} reduced={reducedMotion} />

      {/* HUD */}
      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <View style={st.hudPanel}>
          <PixelText size="score">H{holeIdx + 1}/{HOLES.length}  ·  {strokes}</PixelText>
          <PixelText size="label" style={{ marginTop: 4 }}>
            PAR {hole.par}  ·  {liveDiff === 0 ? "EVEN" : liveDiff > 0 ? `+${liveDiff}` : `${liveDiff}`}
          </PixelText>
          <PixelText size="label" style={{ marginTop: 4, color: theme.rail }}>{theme.name}</PixelText>
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

      <GameOverlay visible={!started} kind="pause" title="PUTT PAL"
        primaryLabel="Start" onPrimary={start} onExit={onExit}>
        <Body muted style={{ textAlign: "center", marginTop: space.md }}>
          Grab the ball, pull back to aim, release to putt. {HOLES.length} themed holes —
          greens, desert, water links and clockwork. Earn ★★★ by beating par.
        </Body>
      </GameOverlay>

      <GameOverlay
        visible={phase === "holeDone"} kind="win"
        title={`HOLE ${holeIdx + 1}: ${scoreTerm(strokes, hole.par)}`}
        score={`${strokes} STROKES  ·  PAR ${hole.par}`}
        primaryLabel={holeIdx >= HOLES.length - 1 ? "See results" : "Next hole"}
        onPrimary={nextHole} onExit={onExit}
      >
        <View style={{ alignItems: "center", marginTop: space.md }}>
          <Stars n={starsFor(strokes, hole.par)} size={24} />
        </View>
      </GameOverlay>

      <ScoreboardOverlay
        visible={phase === "courseDone"} gameId="putt-pal" ordering="low"
        score={totalRef.current} title="COURSE COMPLETE"
        scoreLabel={`TOTAL ${totalRef.current}  ·  PAR ${parRef.current}  (${totalRef.current - parRef.current >= 0 ? "+" : ""}${totalRef.current - parRef.current})`}
        onPlayAgain={restartCourse} onExit={onExit}
      >
        <View style={st.summary}>
          <View style={st.summaryRow}>
            <PixelText size="label" style={{ color: color.textMuted }}>STARS EARNED</PixelText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 16, color: color.amber }}>★</Text>
              <PixelText size="label" style={{ color: color.amber }}>
                {scoresRef.current.reduce((a, s, i) => a + (s ? starsFor(s, HOLES[i].par) : 0), 0)} / {HOLES.length * 3}
              </PixelText>
            </View>
          </View>
          <View style={st.summaryRow}>
            <PixelText size="label" style={{ color: color.textMuted }}>HOLES IN ONE</PixelText>
            <PixelText size="label" style={{ color: color.cyan }}>
              {scoresRef.current.filter((s) => s === 1).length}
            </PixelText>
          </View>
        </View>
      </ScoreboardOverlay>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  fairway: { position: "absolute", left: PLx, top: PT, width: PW, height: PH, borderRadius: radius.md, borderWidth: 4, overflow: "hidden", pointerEvents: "none" },
  hud: { position: "absolute", left: 0, right: 0, zIndex: 5, paddingHorizontal: space.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  hudPanel: { backgroundColor: "rgba(20,26,34,0.7)", borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, borderColor: color.surfaceLine },
  hint: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: space.lg },
  powerWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  powerTrack: { width: W * 0.62, height: 12, borderRadius: 6, backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, overflow: "hidden", justifyContent: "center" },
  powerFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 6 },
  tick: { position: "absolute", top: 2, bottom: 2, width: 1, backgroundColor: "rgba(11,15,20,0.5)" },
  summary: { marginTop: space.lg, backgroundColor: color.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: color.surfaceLine, paddingHorizontal: space.md, paddingVertical: space.sm },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
});

export const puttPalGame: GameModule = {
  id: "putt-pal",
  title: "Putt Pal",
  kind: "arcade",
  Screen: GameScreen,
};
