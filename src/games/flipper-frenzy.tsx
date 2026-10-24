import React, { useEffect, useRef, useState } from "react";
import { View, Image, Text, StyleSheet, Dimensions, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, GameOverlay, Sprite } from "../design/ui";
import { ScoreboardOverlay } from "../design/Scoreboard";
import { EffectsLayer, type EffectsHandle } from "../design/effects";
import { useSettings } from "../settings";

// Owned pinball art (tools/art/gen_flipper_art.py). The bumper/ball sprites skin the
// physics; the playfield backdrop is decorative (the user may swap it).
const BUMPER_IDLE = require("../../assets/arcade/flipper/bumper_idle.png");
const BUMPER_LIT = require("../../assets/arcade/flipper/bumper_lit.png");
const BALL_IMG = require("../../assets/arcade/flipper/ball.png");
const PLAYFIELD = require("../../assets/arcade/flipper/playfield.png");

const { width: W, height: H } = Dimensions.get("window");

// ---- table geometry -------------------------------------------------------
const R = 11;              // ball radius
const WALL = 12;           // wall thickness
const TOP = 96;            // reserved HUD band / ceiling
const GRAV = 0.42;         // px / frame^2
const MAXSPEED = 18;       // speed cap (prevents tunnelling)
const SUBSTEPS = 3;        // collision sub-steps per frame
const BUMP_R = 22;         // bumper radius
const LANE_W = 36;         // shooter-lane width (right side)

const playL = WALL;                 // left edge of play
const SH_X = W - WALL - LANE_W;     // right edge of play = shooter-lane inner wall
const laneR = W - WALL;             // outer right wall (edge of the shooter lane)
const playW = SH_X - playL;
const CX = (playL + SH_X) / 2;
const LANE_TOP = TOP + 92;          // shooter wall runs down from here; the ball exits over the top

// Flippers — bigger than before, pivots inside the (narrower) play area.
const FLIP_LEN = Math.min(playW * 0.33, 152);
const FLIP_HALF = 11;
const PIVOT_Y = H - 172;
const PIVOT_LX = playL + playW * 0.21;
const PIVOT_RX = playL + playW * 0.79;
const L_REST = 0.30, L_ACTIVE = -0.58;
const R_REST = Math.PI - 0.30, R_ACTIVE = Math.PI + 0.58;
const RAISE = 0.54, LOWER = 0.26;

const LAUNCH_V = 17.5;     // plunger launch speed

interface Ball { x: number; y: number; vx: number; vy: number; }
interface Flip { angle: number; omega: number; }

// Pop-bumper cluster (a proper triangle + two upper kickers).
const BUMPERS = [
  { x: CX, y: TOP + 112 },
  { x: CX - playW * 0.26, y: TOP + 196 },
  { x: CX + playW * 0.26, y: TOP + 196 },
  { x: CX - playW * 0.31, y: TOP + 104 },
  { x: CX + playW * 0.31, y: TOP + 104 },
];

// Static table segments. kind 'sling' kicks the ball + scores; 'wall' just bounces.
type Seg = { ax: number; ay: number; bx: number; by: number; rest: number; kind: "wall" | "sling" };
const SEGS: Seg[] = [
  // top corner arches (funnel the ball back down)
  { ax: playL, ay: TOP + 74, bx: playL + playW * 0.30, by: TOP + 4, rest: 0.6, kind: "wall" },
  { ax: SH_X, ay: TOP + 74, bx: SH_X - playW * 0.22, by: TOP + 4, rest: 0.6, kind: "wall" },
  // shooter-lane inner wall (vertical) — separates lane from play, open above LANE_TOP
  { ax: SH_X, ay: LANE_TOP, bx: SH_X, by: H - 18, rest: 0.4, kind: "wall" },
  // lane exit deflector — a rising ball is pushed left into play
  { ax: laneR, ay: TOP + 12, bx: SH_X - 6, by: LANE_TOP - 8, rest: 0.5, kind: "wall" },
  // slingshots above the flippers
  { ax: playL + 4, ay: PIVOT_Y - 150, bx: PIVOT_LX + 16, by: PIVOT_Y - 34, rest: 0.9, kind: "sling" },
  { ax: SH_X - 4, ay: PIVOT_Y - 150, bx: PIVOT_RX - 16, by: PIVOT_Y - 34, rest: 0.9, kind: "sling" },
  // short inner guides from the slingshots toward the flipper gap (inlanes)
  { ax: PIVOT_LX + 16, ay: PIVOT_Y - 34, bx: PIVOT_LX - 4, by: PIVOT_Y - 6, rest: 0.4, kind: "wall" },
  { ax: PIVOT_RX - 16, ay: PIVOT_Y - 34, bx: PIVOT_RX + 4, by: PIVOT_Y - 6, rest: 0.4, kind: "wall" },
];

function servedBall(): Ball {
  // Resting on the plunger at the bottom of the shooter lane.
  return { x: (SH_X + laneR) / 2, y: H - 34, vx: 0, vy: 0 };
}

function closestOnSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const abx = bx - ax, aby = by - ay;
  const len2 = abx * abx + aby * aby || 1;
  let t = ((px - ax) * abx + (py - ay) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: ax + abx * t, y: ay + aby * t };
}

// Resolve ball vs a capsule segment (optionally rotating about pivot ax,ay).
function collideSeg(
  ball: Ball, ax: number, ay: number, bx: number, by: number,
  halfThick: number, rest: number, omega: number, angle: number,
): boolean {
  const c = closestOnSeg(ball.x, ball.y, ax, ay, bx, by);
  let nx = ball.x - c.x, ny = ball.y - c.y;
  let dist = Math.hypot(nx, ny);
  const rad = R + halfThick;
  if (dist >= rad) return false;
  if (dist < 0.0001) { nx = 0; ny = -1; dist = 0.0001; }
  nx /= dist; ny /= dist;
  ball.x = c.x + nx * rad;
  ball.y = c.y + ny * rad;
  let svx = 0, svy = 0;
  if (omega !== 0) {
    const s = Math.hypot(c.x - ax, c.y - ay);
    svx = s * omega * -Math.sin(angle);
    svy = s * omega * Math.cos(angle);
  }
  const rvx = ball.vx - svx, rvy = ball.vy - svy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    const j = -(1 + rest) * vn;
    ball.vx += j * nx;
    ball.vy += j * ny;
  }
  return true;
}

function GameScreen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const ballRef = useRef<Ball>(servedBall());
  const servedRef = useRef(true);
  const leftDown = useRef(false);
  const rightDown = useRef(false);
  const leftF = useRef<Flip>({ angle: L_REST, omega: 0 });
  const rightF = useRef<Flip>({ angle: R_REST, omega: 0 });
  const overRef = useRef(false);
  const flashRef = useRef<number[]>(BUMPERS.map(() => 0));
  const comboRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const phaseRef = useRef<"ready" | "playing" | "paused">("ready");
  const fxRef = useRef<EffectsHandle>(null);
  const { reducedMotion } = useSettings();

  const [, setTick] = useState(0);
  const [score, setScore] = useState(0);
  const [balls, setBalls] = useState(3);
  const [served, setServed] = useState(true);
  const [over, setOver] = useState(false);
  const [phase, setPhase] = useState<"ready" | "playing" | "paused">("ready");
  const bump = () => setTick((t) => (t + 1) % 1000000);
  const addScore = (n: number) => setScore((s) => s + n);

  const multFor = () => Math.min(1 + Math.floor(comboRef.current / 4), 6);

  const updateFlipper = (f: Flip, down: boolean, rest: number, active: number) => {
    const target = down ? active : rest;
    const prev = f.angle;
    const maxStep = down ? RAISE : LOWER;
    const diff = target - f.angle;
    f.angle += Math.max(-maxStep, Math.min(maxStep, diff));
    f.omega = f.angle - prev;
  };

  const step = () => {
    if (overRef.current || phaseRef.current !== "playing") return;
    const b = ballRef.current;

    // advance flippers regardless (so they respond while the ball waits in the lane)
    updateFlipper(leftF.current, leftDown.current, L_REST, L_ACTIVE);
    updateFlipper(rightF.current, rightDown.current, R_REST, R_ACTIVE);
    if (servedRef.current) { bump(); return; } // ball parked on the plunger

    const lf = leftF.current, rf = rightF.current;
    const lbx = PIVOT_LX + FLIP_LEN * Math.cos(lf.angle);
    const lby = PIVOT_Y + FLIP_LEN * Math.sin(lf.angle);
    const rbx = PIVOT_RX + FLIP_LEN * Math.cos(rf.angle);
    const rby = PIVOT_Y + FLIP_LEN * Math.sin(rf.angle);

    for (let s = 0; s < SUBSTEPS; s++) {
      b.vy += GRAV / SUBSTEPS;
      b.x += b.vx / SUBSTEPS;
      b.y += b.vy / SUBSTEPS;

      // outer bounds: left play wall, outer right (lane) wall, ceiling
      if (b.x < playL + R) { b.x = playL + R; b.vx = Math.abs(b.vx) * 0.86; }
      else if (b.x > laneR - R) { b.x = laneR - R; b.vx = -Math.abs(b.vx) * 0.86; }
      if (b.y < TOP + R) { b.y = TOP + R; b.vy = Math.abs(b.vy) * 0.86; }
      // shooter-lane floor (so a ball in the lane never drains there)
      if (b.x > SH_X && b.y > H - 22 - R) { b.y = H - 22 - R; b.vy = -Math.abs(b.vy) * 0.3; }

      // bumpers
      for (let i = 0; i < BUMPERS.length; i++) {
        const bu = BUMPERS[i];
        const dx = b.x - bu.x, dy = b.y - bu.y;
        const dist = Math.hypot(dx, dy);
        const min = R + BUMP_R;
        if (dist < min && dist > 0) {
          const nx = dx / dist, ny = dy / dist;
          b.x = bu.x + nx * min; b.y = bu.y + ny * min;
          const dot = b.vx * nx + b.vy * ny;
          b.vx = (b.vx - 2 * dot * nx) * 0.92 + nx * 2.8;
          b.vy = (b.vy - 2 * dot * ny) * 0.92 + ny * 2.8;
          flashRef.current[i] = 6;
          comboRef.current += 1;
          const m = multFor();
          addScore(100 * m);
          fxRef.current?.burst(bu.x, bu.y, { count: 10, color: "#FFB84D", speed: 150, size: 5 });
          if (m > 1) fxRef.current?.popScore(bu.x, bu.y - 18, `x${m}`, color.cyan);
        }
      }

      // static segments (walls + slingshots)
      for (const g of SEGS) {
        if (collideSeg(b, g.ax, g.ay, g.bx, g.by, 5, g.rest, 0, 0) && g.kind === "sling") {
          const sp = Math.hypot(b.vx, b.vy);
          if (sp > 0.001) { b.vx += (b.vx / sp) * 2.4; b.vy += (b.vy / sp) * 2.4; }
          comboRef.current += 1;
          addScore(25 * multFor());
          fxRef.current?.burst(b.x, b.y, { count: 8, color: "#00E5FF", speed: 150, size: 5 });
        }
      }

      // flippers (dynamic)
      if (collideSeg(b, PIVOT_LX, PIVOT_Y, lbx, lby, FLIP_HALF, 0.35, lf.omega, lf.angle)) {
        comboRef.current = 0; // a successful bat resets the combo chain
        if (lf.omega !== 0) { addScore(5); fxRef.current?.burst(b.x, b.y, { count: 6, color: "#00E5FF", speed: 130, size: 4 }); }
      }
      if (collideSeg(b, PIVOT_RX, PIVOT_Y, rbx, rby, FLIP_HALF, 0.35, rf.omega, rf.angle)) {
        comboRef.current = 0;
        if (rf.omega !== 0) { addScore(5); fxRef.current?.burst(b.x, b.y, { count: 6, color: "#00E5FF", speed: 130, size: 4 }); }
      }

      const sp = Math.hypot(b.vx, b.vy);
      if (sp > MAXSPEED) { b.vx = (b.vx / sp) * MAXSPEED; b.vy = (b.vy / sp) * MAXSPEED; }
    }

    for (let i = 0; i < flashRef.current.length; i++) if (flashRef.current[i] > 0) flashRef.current[i] -= 1;

    // drain — only in the play area (not the shooter lane)
    if (b.y - R > H && b.x < SH_X) {
      comboRef.current = 0;
      setBalls((n) => {
        const left = n - 1;
        if (left <= 0) { overRef.current = true; setOver(true); }
        else { ballRef.current = servedBall(); servedRef.current = true; setServed(true); }
        return left;
      });
    }

    bump();
  };

  useEffect(() => {
    let mounted = true;
    const loop = () => { step(); if (mounted) rafRef.current = requestAnimationFrame(loop); };
    rafRef.current = requestAnimationFrame(loop);
    return () => { mounted = false; if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => { phaseRef.current = "playing"; setPhase("playing"); };
  const launch = () => {
    if (!servedRef.current || phaseRef.current !== "playing") return;
    const b = ballRef.current;
    b.vx = -0.6; b.vy = -LAUNCH_V;
    servedRef.current = false; setServed(false);
  };
  const togglePause = () => {
    if (phaseRef.current === "playing") { phaseRef.current = "paused"; setPhase("paused"); }
    else if (phaseRef.current === "paused") { phaseRef.current = "playing"; setPhase("playing"); }
  };

  const reset = () => {
    ballRef.current = servedBall(); servedRef.current = true; setServed(true);
    leftF.current = { angle: L_REST, omega: 0 };
    rightF.current = { angle: R_REST, omega: 0 };
    leftDown.current = false; rightDown.current = false;
    overRef.current = false; comboRef.current = 0;
    fxRef.current?.clear();
    phaseRef.current = "playing";
    setOver(false); setScore(0); setBalls(3); setPhase("playing");
  };

  const b = ballRef.current;
  const lf = leftF.current, rf = rightF.current;
  const mult = multFor();

  return (
    <View style={st.fill}>
      {/* decorative playfield backdrop (behind the live table; no physics effect) */}
      <Image source={PLAYFIELD} resizeMode="stretch" fadeDuration={0}
        style={{ position: "absolute", left: 0, top: TOP, width: W, height: H - TOP }} />

      {/* flipper control halves (press-and-hold) */}
      <Pressable style={[st.half, { left: 0 }]} onPressIn={() => { leftDown.current = true; }} onPressOut={() => { leftDown.current = false; }} />
      <Pressable style={[st.half, { right: 0 }]} onPressIn={() => { rightDown.current = true; }} onPressOut={() => { rightDown.current = false; }} />

      {/* outer walls + shooter-lane frame */}
      <View style={[st.wall, { left: 0, top: TOP, width: WALL, height: H - TOP }]} pointerEvents="none" />
      <View style={[st.wall, { right: 0, top: TOP, width: WALL, height: H - TOP }]} pointerEvents="none" />
      <View style={[st.wall, { left: 0, right: 0, top: TOP, height: WALL }]} pointerEvents="none" />
      {/* shooter-lane inner wall (matches the vertical collision segment) */}
      <View style={[st.laneWall, { left: SH_X - 3, top: LANE_TOP, height: H - LANE_TOP }]} pointerEvents="none" />

      {/* static segments (arches / slings / guides) drawn from their collision line */}
      {SEGS.map((g, i) => {
        const len = Math.hypot(g.bx - g.ax, g.by - g.ay);
        const ang = Math.atan2(g.by - g.ay, g.bx - g.ax) * 180 / Math.PI;
        const col = g.kind === "sling" ? color.cyan : color.surfaceLine;
        return (
          <View key={i} pointerEvents="none" style={{ position: "absolute", left: g.ax, top: g.ay, transform: [{ rotate: `${ang}deg` }] }}>
            <View style={{ position: "absolute", left: 0, top: -5, width: len, height: 10, borderRadius: 5, backgroundColor: col }} />
          </View>
        );
      })}

      {/* bumpers */}
      {BUMPERS.map((bu, i) => {
        const hot = flashRef.current[i] > 0;
        const SZ = BUMP_R * 2 + 16;
        return (
          <View key={i} pointerEvents="none" style={{ position: "absolute", left: bu.x - SZ / 2, top: bu.y - SZ / 2 }}>
            <Sprite source={hot ? BUMPER_LIT : BUMPER_IDLE} size={SZ} />
          </View>
        );
      })}

      {/* flippers */}
      <View pointerEvents="none" style={{ position: "absolute", left: PIVOT_LX, top: PIVOT_Y, transform: [{ rotate: `${lf.angle * 180 / Math.PI}deg` }] }}>
        <View style={[st.flip, { left: 0, top: -FLIP_HALF, width: FLIP_LEN, height: FLIP_HALF * 2, backgroundColor: color.amber }]} />
        <View style={[st.flipHi, { width: FLIP_LEN - 8 }]} />
      </View>
      <View pointerEvents="none" style={{ position: "absolute", left: PIVOT_RX, top: PIVOT_Y, transform: [{ rotate: `${rf.angle * 180 / Math.PI}deg` }] }}>
        <View style={[st.flip, { left: 0, top: -FLIP_HALF, width: FLIP_LEN, height: FLIP_HALF * 2, backgroundColor: color.cyan }]} />
        <View style={[st.flipHi, { width: FLIP_LEN - 8 }]} />
      </View>
      {[{ x: PIVOT_LX }, { x: PIVOT_RX }].map((pv, i) => (
        <View key={i} pointerEvents="none" style={{ position: "absolute", left: pv.x - 7, top: PIVOT_Y - 7, width: 14, height: 14, borderRadius: 7, backgroundColor: color.surface2, borderWidth: 2, borderColor: color.cyan }} />
      ))}

      {/* ball */}
      <View pointerEvents="none" style={{ position: "absolute", left: b.x - (R + 4), top: b.y - (R + 4) }}>
        <Sprite source={BALL_IMG} size={R * 2 + 8} />
      </View>

      <EffectsLayer ref={fxRef} reduced={reducedMotion} />

      {/* plunger LAUNCH button while a ball waits in the lane */}
      {served && phase === "playing" && (
        <Pressable onPress={launch} accessibilityRole="button" accessibilityLabel="Launch the ball"
          style={[st.launch, { left: SH_X - 8, width: LANE_W + WALL + 8 }]}>
          <Text style={st.launchT}>LAUNCH ▲</Text>
        </Pressable>
      )}

      {/* HUD */}
      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <View style={st.hudPanel}>
          <PixelText size="score">{String(score).padStart(6, "0")}</PixelText>
          <PixelText size="label" style={{ marginTop: 4 }}>BALLS {balls}{mult > 1 ? `   x${mult}` : ""}</PixelText>
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <IconButton label="Pause" glyph={phase === "paused" ? "▶" : "❚❚"} onPress={togglePause} />
          <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
        </View>
      </View>

      <GameOverlay visible={phase === "ready"} kind="pause" title="FLIPPER FRENZY"
        primaryLabel="Launch" onPrimary={start} onExit={onExit}>
        <Body muted style={{ textAlign: "center", marginTop: space.md }}>
          Tap LAUNCH to fire the ball up the shooter lane. Hold the left or right side to flip.
          Chain bumpers and slingshots for a score multiplier — don't let it drain.
        </Body>
      </GameOverlay>
      <GameOverlay visible={phase === "paused" && !over} kind="pause" title="PAUSED"
        primaryLabel="Resume" onPrimary={togglePause} onExit={onExit} />
      <ScoreboardOverlay visible={over} gameId="flipper-frenzy" score={score}
        scoreLabel={`SCORE ${score}`} onPlayAgain={reset} onExit={onExit} />
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0A0E1A" },
  half: { position: "absolute", top: TOP, bottom: 0, width: W / 2, zIndex: 2 },
  wall: { position: "absolute", backgroundColor: "#3A4760", borderRadius: 4 },
  laneWall: { position: "absolute", width: 6, backgroundColor: "#46557A", borderRadius: 3 },
  flip: { position: "absolute", borderRadius: FLIP_HALF, backgroundColor: color.cyan },
  flipHi: { position: "absolute", left: 4, top: -FLIP_HALF + 2, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.45)" },
  launch: { position: "absolute", bottom: 40, height: 52, borderRadius: radius.md, backgroundColor: color.amber, alignItems: "center", justifyContent: "center", zIndex: 6 },
  launchT: { color: color.onAmber, fontWeight: "900", fontSize: 13, letterSpacing: 1 },
  hud: { position: "absolute", left: 0, right: 0, zIndex: 5, paddingHorizontal: space.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  hudPanel: { backgroundColor: "rgba(20,26,34,0.7)", borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, borderColor: color.surfaceLine },
});

export const flipperFrenzyGame: GameModule = {
  id: "flipper-frenzy",
  title: "Flipper Frenzy",
  kind: "arcade",
  Screen: GameScreen,
};
