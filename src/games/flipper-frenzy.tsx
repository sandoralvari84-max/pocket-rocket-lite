import React, { useEffect, useRef, useState } from "react";
import { View, Image, StyleSheet, Dimensions, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, GameOverlay, Sprite } from "../design/ui";
import { ScoreboardOverlay } from "../design/Scoreboard";
import { EffectsLayer, type EffectsHandle } from "../design/effects";
import { useSettings } from "../settings";

// Owned pinball art (tools/art/gen_flipper_art.py). Skins the existing physics
// geometry — the collision shapes are unchanged.
const BUMPER_IDLE = require("../../assets/arcade/flipper/bumper_idle.png");
const BUMPER_LIT = require("../../assets/arcade/flipper/bumper_lit.png");
const BALL_IMG = require("../../assets/arcade/flipper/ball.png");
const PLAYFIELD = require("../../assets/arcade/flipper/playfield.png");

const { width: W, height: H } = Dimensions.get("window");

// ---- table geometry -------------------------------------------------------
const R = 11;              // ball radius
const WALL = 12;           // side-wall thickness
const TOP = 96;            // reserved HUD band
const GRAV = 0.42;         // px / frame^2
const MAXSPEED = 17;       // speed cap (prevents tunnelling)
const SUBSTEPS = 2;        // collision sub-steps per frame
const BUMP_R = 24;         // bumper radius

const playL = WALL;
const playR = W - WALL;

// Flippers: a flipper is a line segment rooted at a pivot. It is rotated between
// a rest angle and an active angle. Collision uses the SAME segment that is drawn,
// and the segment's rotational surface velocity is what bats the ball.
const FLIP_LEN = Math.min(W * 0.30, 122);
const FLIP_HALF = 9;        // half-thickness of the flipper bar
const PIVOT_Y = H - 168;
const PIVOT_LX = W * 0.17;  // left pivot (near wall, tip points toward centre)
const PIVOT_RX = W * 0.83;  // right pivot
// angles are measured with atan2(dy,dx) in screen space (y points DOWN).
const L_REST = 0.30;        // tip down-right
const L_ACTIVE = -0.55;     // tip up-right
const R_REST = Math.PI - 0.30; // tip down-left
const R_ACTIVE = Math.PI + 0.55; // tip up-left
const RAISE = 0.52;         // rad / frame toward active
const LOWER = 0.26;         // rad / frame toward rest

interface Ball { x: number; y: number; vx: number; vy: number; }
interface Flip { angle: number; omega: number; }

const BUMPERS = [
  { x: W * 0.5, y: TOP + 96 },
  { x: W * 0.27, y: TOP + 196 },
  { x: W * 0.73, y: TOP + 196 },
];

// Static guide walls (outlanes) that funnel the ball toward the flippers.
// Each is a segment; same collision routine as flippers but with omega = 0.
const GUIDES = [
  { ax: playL, ay: PIVOT_Y - 130, bx: PIVOT_LX - 2, by: PIVOT_Y - 18 },  // left funnel onto left flipper
  { ax: playR, ay: PIVOT_Y - 130, bx: PIVOT_RX + 2, by: PIVOT_Y - 18 },  // right funnel onto right flipper
];

function freshBall(): Ball {
  return { x: W - WALL - R - 6, y: TOP + 40, vx: -1.4 - Math.random(), vy: 0 };
}

function closestOnSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const abx = bx - ax, aby = by - ay;
  const len2 = abx * abx + aby * aby || 1;
  let t = ((px - ax) * abx + (py - ay) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: ax + abx * t, y: ay + aby * t };
}

// Resolve ball vs a capsule segment. If the segment rotates (omega != 0 about
// pivot ax,ay with current `angle`), its surface velocity at the contact point is
// added so a swinging flipper genuinely launches the ball.
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
  // positional correction
  ball.x = c.x + nx * rad;
  ball.y = c.y + ny * rad;
  // surface velocity at contact: d/dt of a point at distance s from pivot
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
  const ballRef = useRef<Ball>(freshBall());
  const leftDown = useRef(false);
  const rightDown = useRef(false);
  const leftF = useRef<Flip>({ angle: L_REST, omega: 0 });
  const rightF = useRef<Flip>({ angle: R_REST, omega: 0 });
  const overRef = useRef(false);
  const flashRef = useRef<number[]>([0, 0, 0]); // bumper hit pulse timers
  const rafRef = useRef<number | null>(null);
  const phaseRef = useRef<"ready" | "playing" | "paused">("ready");
  const fxRef = useRef<EffectsHandle>(null);
  const { reducedMotion } = useSettings();

  const [, setTick] = useState(0);
  const [score, setScore] = useState(0);
  const [balls, setBalls] = useState(3);
  const [over, setOver] = useState(false);
  const [phase, setPhase] = useState<"ready" | "playing" | "paused">("ready");
  const bump = () => setTick((t) => (t + 1) % 1000000);
  const addScore = (n: number) => setScore((s) => s + n);

  const updateFlipper = (f: Flip, down: boolean, rest: number, active: number) => {
    const target = down ? active : rest;
    const prev = f.angle;
    const maxStep = down ? RAISE : LOWER;
    const diff = target - f.angle;
    f.angle += Math.max(-maxStep, Math.min(maxStep, diff));
    f.omega = f.angle - prev; // rad / frame
  };

  const step = () => {
    if (overRef.current || phaseRef.current !== "playing") return;
    const b = ballRef.current;

    // advance flippers once per frame (shared omega across sub-steps)
    updateFlipper(leftF.current, leftDown.current, L_REST, L_ACTIVE);
    updateFlipper(rightF.current, rightDown.current, R_REST, R_ACTIVE);
    const lf = leftF.current, rf = rightF.current;
    const lbx = PIVOT_LX + FLIP_LEN * Math.cos(lf.angle);
    const lby = PIVOT_Y + FLIP_LEN * Math.sin(lf.angle);
    const rbx = PIVOT_RX + FLIP_LEN * Math.cos(rf.angle);
    const rby = PIVOT_Y + FLIP_LEN * Math.sin(rf.angle);

    for (let s = 0; s < SUBSTEPS; s++) {
      b.vy += GRAV / SUBSTEPS;
      b.x += b.vx / SUBSTEPS;
      b.y += b.vy / SUBSTEPS;

      // side + top walls
      if (b.x < playL + R) { b.x = playL + R; b.vx = Math.abs(b.vx) * 0.86; }
      else if (b.x > playR - R) { b.x = playR - R; b.vx = -Math.abs(b.vx) * 0.86; }
      if (b.y < TOP + R) { b.y = TOP + R; b.vy = Math.abs(b.vy) * 0.86; }

      // bumpers (real circular collision)
      for (let i = 0; i < BUMPERS.length; i++) {
        const bu = BUMPERS[i];
        const dx = b.x - bu.x, dy = b.y - bu.y;
        const dist = Math.hypot(dx, dy);
        const min = R + BUMP_R;
        if (dist < min && dist > 0) {
          const nx = dx / dist, ny = dy / dist;
          b.x = bu.x + nx * min; b.y = bu.y + ny * min;
          const dot = b.vx * nx + b.vy * ny;
          b.vx = (b.vx - 2 * dot * nx) * 0.92 + nx * 2.6;
          b.vy = (b.vy - 2 * dot * ny) * 0.92 + ny * 2.6;
          flashRef.current[i] = 6;
          addScore(100);
          fxRef.current?.burst(bu.x, bu.y, { count: 10, color: "#FFB84D", speed: 150, size: 5 });
        }
      }

      // static guide walls
      for (const g of GUIDES) collideSeg(b, g.ax, g.ay, g.bx, g.by, 5, 0.55, 0, 0);

      // flippers (dynamic) — collision uses exactly the drawn segment
      if (collideSeg(b, PIVOT_LX, PIVOT_Y, lbx, lby, FLIP_HALF, 0.35, lf.omega, lf.angle)) {
        if (lf.omega !== 0) { addScore(5); fxRef.current?.burst(b.x, b.y, { count: 6, color: "#00E5FF", speed: 130, size: 4 }); }
      }
      if (collideSeg(b, PIVOT_RX, PIVOT_Y, rbx, rby, FLIP_HALF, 0.35, rf.omega, rf.angle)) {
        if (rf.omega !== 0) { addScore(5); fxRef.current?.burst(b.x, b.y, { count: 6, color: "#00E5FF", speed: 130, size: 4 }); }
      }

      // speed cap
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > MAXSPEED) { b.vx = (b.vx / sp) * MAXSPEED; b.vy = (b.vy / sp) * MAXSPEED; }
    }

    for (let i = 0; i < flashRef.current.length; i++) if (flashRef.current[i] > 0) flashRef.current[i] -= 1;

    // drain
    if (b.y - R > H) {
      setBalls((n) => {
        const left = n - 1;
        if (left <= 0) { overRef.current = true; setOver(true); }
        else { ballRef.current = freshBall(); }
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
  const togglePause = () => {
    if (phaseRef.current === "playing") { phaseRef.current = "paused"; setPhase("paused"); }
    else if (phaseRef.current === "paused") { phaseRef.current = "playing"; setPhase("playing"); }
  };

  const reset = () => {
    ballRef.current = freshBall();
    leftF.current = { angle: L_REST, omega: 0 };
    rightF.current = { angle: R_REST, omega: 0 };
    leftDown.current = false; rightDown.current = false;
    overRef.current = false;
    fxRef.current?.clear();
    phaseRef.current = "playing";
    setOver(false); setScore(0); setBalls(3); setPhase("playing");
  };

  const b = ballRef.current;
  const lf = leftF.current, rf = rightF.current;

  return (
    <View style={st.fill}>
      {/* decorative playfield backdrop (behind the live table; no physics effect) */}
      <Image source={PLAYFIELD} resizeMode="stretch" fadeDuration={0}
        style={{ position: "absolute", left: 0, top: TOP, width: W, height: H - TOP }} />

      {/* flipper control halves (press-and-hold) */}
      <Pressable style={[st.half, { left: 0 }]} onPressIn={() => { leftDown.current = true; }} onPressOut={() => { leftDown.current = false; }} />
      <Pressable style={[st.half, { right: 0 }]} onPressIn={() => { rightDown.current = true; }} onPressOut={() => { rightDown.current = false; }} />

      {/* walls */}
      <View style={[st.wall, { left: 0, top: TOP, width: WALL, height: H - TOP }]} pointerEvents="none" />
      <View style={[st.wall, { right: 0, top: TOP, width: WALL, height: H - TOP }]} pointerEvents="none" />
      <View style={[st.wall, { left: 0, right: 0, top: TOP, height: WALL }]} pointerEvents="none" />

      {/* guide walls (drawn to match their collision segments) */}
      {GUIDES.map((g, i) => {
        const len = Math.hypot(g.bx - g.ax, g.by - g.ay);
        const ang = Math.atan2(g.by - g.ay, g.bx - g.ax) * 180 / Math.PI;
        return (
          <View key={i} pointerEvents="none" style={{ position: "absolute", left: g.ax, top: g.ay, transform: [{ rotate: `${ang}deg` }] }}>
            <View style={{ position: "absolute", left: 0, top: -5, width: len, height: 10, borderRadius: 5, backgroundColor: color.surfaceLine }} />
          </View>
        );
      })}

      {/* bumpers (lit sprite flashes on hit) */}
      {BUMPERS.map((bu, i) => {
        const hot = flashRef.current[i] > 0;
        const SZ = BUMP_R * 2 + 18;
        return (
          <View key={i} pointerEvents="none" style={{ position: "absolute", left: bu.x - SZ / 2, top: bu.y - SZ / 2 }}>
            <Sprite source={hot ? BUMPER_LIT : BUMPER_IDLE} size={SZ} />
          </View>
        );
      })}

      {/* flippers — drawn from pivot along current angle (matches collision segment) */}
      <View pointerEvents="none" style={{ position: "absolute", left: PIVOT_LX, top: PIVOT_Y, transform: [{ rotate: `${lf.angle * 180 / Math.PI}deg` }] }}>
        <View style={[st.flip, { left: 0, top: -FLIP_HALF, width: FLIP_LEN, height: FLIP_HALF * 2, backgroundColor: color.amber }]} />
        <View style={[st.flipHi, { width: FLIP_LEN - 8 }]} />
      </View>
      <View pointerEvents="none" style={{ position: "absolute", left: PIVOT_RX, top: PIVOT_Y, transform: [{ rotate: `${rf.angle * 180 / Math.PI}deg` }] }}>
        <View style={[st.flip, { left: 0, top: -FLIP_HALF, width: FLIP_LEN, height: FLIP_HALF * 2, backgroundColor: color.cyan }]} />
        <View style={[st.flipHi, { width: FLIP_LEN - 8 }]} />
      </View>
      {/* pivot caps */}
      {[{ x: PIVOT_LX }, { x: PIVOT_RX }].map((pv, i) => (
        <View key={i} pointerEvents="none" style={{ position: "absolute", left: pv.x - 7, top: PIVOT_Y - 7, width: 14, height: 14, borderRadius: 7, backgroundColor: color.surface2, borderWidth: 2, borderColor: color.cyan }} />
      ))}

      {/* ball (chrome sprite) */}
      <View pointerEvents="none" style={{ position: "absolute", left: b.x - (R + 4), top: b.y - (R + 4) }}>
        <Sprite source={BALL_IMG} size={R * 2 + 8} />
      </View>

      {/* impact sparks */}
      <EffectsLayer ref={fxRef} reduced={reducedMotion} />

      {/* HUD */}
      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <View style={st.hudPanel}>
          <PixelText size="score">{String(score).padStart(6, "0")}</PixelText>
          <PixelText size="label" style={{ marginTop: 4 }}>BALLS {balls}</PixelText>
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <IconButton label="Pause" glyph={phase === "paused" ? "▶" : "❚❚"} onPress={togglePause} />
          <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
        </View>
      </View>

      <GameOverlay visible={phase === "ready"} kind="pause" title="FLIPPER FRENZY"
        primaryLabel="Launch" onPrimary={start} onExit={onExit}>
        <Body muted style={{ textAlign: "center", marginTop: space.md }}>
          Hold the left or right side of the screen to flip. Keep the ball alive and
          rack up points on the bumpers.
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
  flip: { position: "absolute", borderRadius: FLIP_HALF, backgroundColor: color.cyan },
  flipHi: { position: "absolute", left: 4, top: -FLIP_HALF + 2, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.45)" },
  hud: { position: "absolute", left: 0, right: 0, zIndex: 5, paddingHorizontal: space.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  hudPanel: { backgroundColor: "rgba(20,26,34,0.7)", borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, borderColor: color.surfaceLine },
});

export const flipperFrenzyGame: GameModule = {
  id: "flipper-frenzy",
  title: "Flipper Frenzy",
  kind: "arcade",
  Screen: GameScreen,
};
