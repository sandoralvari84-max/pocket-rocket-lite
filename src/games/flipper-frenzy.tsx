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
// physics; the playfield is a premium backdrop UNDER the live, physics-aligned inserts
// (lanes, drop targets, lock, ramp, slings) which are drawn as Views below.
const BUMPER_IDLE = require("../../assets/arcade/flipper/bumper_idle.png");
const BUMPER_LIT = require("../../assets/arcade/flipper/bumper_lit.png");
const BALL_IMG = require("../../assets/arcade/flipper/ball.png");
const PLAYFIELD = require("../../assets/arcade/flipper/playfield.png");

const { width: W, height: H } = Dimensions.get("window");

// ---- table geometry -------------------------------------------------------
const R = 11;              // ball radius
const WALL = 12;           // wall thickness
const TOP = 96;            // reserved HUD band / ceiling
const SUBSTEPS = 3;        // collision sub-steps per frame
const BUMP_R = 22;         // bumper radius
const LANE_W = 36;         // shooter-lane width (right side)

const playL = WALL;                 // left edge of play
const SH_X = W - WALL - LANE_W;     // right edge of play = shooter-lane inner wall
const laneR = W - WALL;             // outer right wall (edge of the shooter lane)
const playW = SH_X - playL;
const CX = (playL + SH_X) / 2;
const LANE_TOP = TOP + 92;          // shooter wall runs down from here; the ball exits over the top

// Flippers — sized so the tips leave a clear drain gap in the middle.
const FLIP_LEN = Math.min(playW * 0.25, 140);
const FLIP_HALF = 11;
const PIVOT_Y = H - 172;
const PIVOT_LX = playL + playW * 0.19;
const PIVOT_RX = playL + playW * 0.81;

// ============================================================================
// FEEL CONSTANTS — TUNE ON-DEVICE. These govern how the table "feels" (weight,
// bounce, flipper power, launch). They are grouped + FLAGGED so they are trivial
// to find. To tune feel, change THESE numbers — do NOT touch the collision math
// in collideSeg()/the integrator (that stays stable & deterministic).
// ----------------------------------------------------------------------------
const GRAV = 0.42;          // [FEEL] ball weight (px/frame^2). Higher = heavier / faster drop.
const MAXSPEED = 18;        // [FEEL] speed cap (anti-tunnel). Raise with care.
const L_REST = 0.30, L_ACTIVE = -0.58;   // [FEEL] left flipper rest / raised angle (rad)
const R_REST = Math.PI - 0.30, R_ACTIVE = Math.PI + 0.58; // [FEEL] right flipper (mirrored)
const RAISE = 0.54, LOWER = 0.26;        // [FEEL] flipper up / down speed (rad/frame) = flip power & timing
const FLIP_REST = 0.35;     // [FEEL] restitution of a still flipper (dead-catch bounce)
const BUMPER_KICK = 2.8;    // [FEEL] pop-bumper impulse
const BUMPER_REST = 0.92;   // [FEEL] pop-bumper energy retention
const SLING_KICK = 2.4;     // [FEEL] slingshot impulse
const WALL_REST = 0.86;     // [FEEL] outer-wall bounce retention
const LAUNCH_VX = -4.6;     // [FEEL] launch injection velocity x (ball enters top-right, rolls left)
const LAUNCH_VY = 0.8;      // [FEEL] launch injection velocity y
const BALL_SAVE_FRAMES = 300; // [FEEL] ball-save window after launch (~5s @ 60fps)
const COMBO_WINDOW = 150;   // [FEEL] frames a combo survives with no scoring (~2.5s)
// ============================================================================

// ---- scoring values -------------------------------------------------------
const BUMPER_SCORE = 100;
const SLING_SCORE = 25;
const LANE_SCORE = 250;
const LANE_COMPLETE = 2000;
const DROP_SCORE = 500;
const BANK_BONUS = 2500;
const RAMP_SCORE = 1500;
const LOCK_SCORE = 1000;
const JACKPOT_BASE = 5000;

// ---- entity caps (low-end Android) ----------------------------------------
const MAX_BALLS = 3;        // hard cap on simultaneous balls (multiball)
const LOCKS_FOR_MB = 2;     // locks required to light & start multiball

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
  { ax: playL, ay: TOP + 74, bx: playL + playW * 0.30, by: TOP + 4, rest: 0.6, kind: "wall" },
  { ax: SH_X, ay: TOP + 74, bx: SH_X - playW * 0.22, by: TOP + 4, rest: 0.6, kind: "wall" },
  { ax: SH_X, ay: LANE_TOP, bx: SH_X, by: H - 18, rest: 0.4, kind: "wall" },
  { ax: playL + 4, ay: PIVOT_Y - 150, bx: PIVOT_LX + 16, by: PIVOT_Y - 34, rest: 0.9, kind: "sling" },
  { ax: SH_X - 4, ay: PIVOT_Y - 150, bx: PIVOT_RX - 16, by: PIVOT_Y - 34, rest: 0.9, kind: "sling" },
  { ax: PIVOT_LX + 16, ay: PIVOT_Y - 34, bx: PIVOT_LX - 4, by: PIVOT_Y - 6, rest: 0.4, kind: "wall" },
  { ax: PIVOT_RX - 16, ay: PIVOT_Y - 34, bx: PIVOT_RX + 4, by: PIVOT_Y - 6, rest: 0.4, kind: "wall" },
];
const SLING_IDX = [3, 4]; // indices into SEGS that are slingshots (for flash FX)

// Top rollover lanes — spell FLIP for a bonus-multiplier award.
const LANE_WORD = ["F", "L", "I", "P"];
const LANES = LANE_WORD.map((ch, i) => ({ ch, x: playL + playW * (0.22 + 0.187 * i), y: TOP + 30 }));
const LANE_HW = 17, LANE_HH = 15; // rollover zone half-extents

// Drop-target bank (left mid) — clearing all 3 lights the LOCK.
const DROP_X = playL + playW * 0.16;
const DROPS = [0, 1, 2].map((i) => ({ x: DROP_X, y: TOP + 150 + i * 34 }));
const DROP_HH = 13; // half-height of a standup target

// Lock saucer (right mid) — capture balls for multiball.
const LOCK_X = playL + playW * 0.82;
const LOCK_Y = TOP + (H - TOP) * 0.40;
const LOCK_R = 19;

// Ramp / right orbit — a shot up the right channel (ball moving up, in-zone) scores.
const RAMP_X0 = SH_X - 46, RAMP_X1 = SH_X - 8;
const RAMP_Y0 = TOP + 60, RAMP_Y1 = TOP + 210;

function servedBall(): Ball {
  return { x: (SH_X + laneR) / 2, y: H - 34, vx: 0, vy: 0 };
}
function launchedBall(): Ball {
  // Inject at the top-right of the play area moving LEFT along the ceiling so it rolls
  // into the lanes/bumpers (reliable under the speed cap — see history in git).
  return { x: SH_X - 22, y: TOP + R + 8, vx: LAUNCH_VX, vy: LAUNCH_VY };
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
  const ballsRef = useRef<Ball[]>([]);              // active balls (multiball)
  const servedRef = useRef(true);                   // a ball waits in the lane
  const servedFramesRef = useRef(0);
  const leftDown = useRef(false);
  const rightDown = useRef(false);
  const leftF = useRef<Flip>({ angle: L_REST, omega: 0 });
  const rightF = useRef<Flip>({ angle: R_REST, omega: 0 });
  const overRef = useRef(false);
  const phaseRef = useRef<"ready" | "playing" | "paused">("ready");
  const fxRef = useRef<EffectsHandle>(null);
  const { reducedMotion } = useSettings();

  // live feature state (refs — read during the per-frame re-render; no React churn)
  const flashRef = useRef<number[]>(BUMPERS.map(() => 0));
  const segFlashRef = useRef<number[]>(SEGS.map(() => 0));
  const comboRef = useRef(0);
  const comboTimerRef = useRef(0);
  const lanesRef = useRef<boolean[]>(LANES.map(() => false));
  const dropsRef = useRef<boolean[]>(DROPS.map(() => false)); // true = knocked down
  const dropRaiseRef = useRef(0);        // frames until the bank re-raises
  const lockLitRef = useRef(false);
  const lockCountRef = useRef(0);
  const lockCoolRef = useRef(0);
  const lockFlashRef = useRef(0);
  const multiballRef = useRef(false);
  const jackpotRef = useRef(JACKPOT_BASE);
  const rampCoolRef = useRef(0);
  const rampFlashRef = useRef(0);
  const ballSaveRef = useRef(0);
  const shakeRef = useRef(0);
  const bonusRef = useRef(0);            // accumulated end-of-ball bonus
  const bonusMultRef = useRef(1);        // bonus multiplier (from completing lanes)
  const tallyRef = useRef(0);            // bonus points left to pour into score
  const tallyTickRef = useRef(0);
  const livesRef = useRef(3);
  const bannerRef = useRef<{ text: string; color: string; frames: number }>({ text: "", color: color.amber, frames: 0 });
  const rafRef = useRef<number | null>(null);

  const [, setTick] = useState(0);
  const [score, setScore] = useState(0);
  const [balls, setBalls] = useState(3);
  const [served, setServed] = useState(true);
  const [over, setOver] = useState(false);
  const [phase, setPhase] = useState<"ready" | "playing" | "paused">("ready");
  const bump = () => setTick((t) => (t + 1) % 1000000);
  const addScore = (n: number) => setScore((s) => s + n);

  const multFor = () => Math.min(1 + Math.floor(comboRef.current / 4), 6);
  const bumpCombo = () => { comboRef.current += 1; comboTimerRef.current = COMBO_WINDOW; };
  const banner = (text: string, col: string, frames = 80) => { bannerRef.current = { text, color: col, frames }; };
  const shake = (frames: number) => { if (!reducedMotion) shakeRef.current = Math.max(shakeRef.current, frames); };

  const updateFlipper = (f: Flip, down: boolean, rest: number, active: number) => {
    const target = down ? active : rest;
    const prev = f.angle;
    const maxStep = down ? RAISE : LOWER;
    const diff = target - f.angle;
    f.angle += Math.max(-maxStep, Math.min(maxStep, diff));
    f.omega = f.angle - prev;
  };

  // Reset per-ball targets (keep bonus multiplier + lock progress across balls).
  const resetForNewBall = () => {
    lanesRef.current = LANES.map(() => false);
    dropsRef.current = DROPS.map(() => false);
    dropRaiseRef.current = 0;
    multiballRef.current = false;
    comboRef.current = 0;
    bonusRef.current = 0;
  };

  const releaseMultiball = () => {
    const bs = ballsRef.current;
    let idx = 0;
    while (bs.length < MAX_BALLS) {
      const ang = -Math.PI / 2 + (idx - 0.5) * 0.6; // deterministic upward spread
      bs.push({ x: LOCK_X, y: LOCK_Y, vx: Math.cos(ang) * 3.2, vy: Math.sin(ang) * 3.2 + 1.2 });
      idx++;
    }
    multiballRef.current = true;
    jackpotRef.current = JACKPOT_BASE;
    lockCountRef.current = 0;
    lockLitRef.current = false;
    banner("MULTIBALL!", color.amber, 100);
    shake(16);
    fxRef.current?.burst(LOCK_X, LOCK_Y, { count: 20, color: "#FFB84D", speed: 220, size: 6 });
  };

  const step = () => {
    if (overRef.current || phaseRef.current !== "playing") return;

    updateFlipper(leftF.current, leftDown.current, L_REST, L_ACTIVE);
    updateFlipper(rightF.current, rightDown.current, R_REST, R_ACTIVE);

    // global timers
    if (comboTimerRef.current > 0 && --comboTimerRef.current === 0) comboRef.current = 0;
    if (ballSaveRef.current > 0) ballSaveRef.current -= 1;
    if (shakeRef.current > 0) shakeRef.current -= 1;
    if (lockCoolRef.current > 0) lockCoolRef.current -= 1;
    if (rampCoolRef.current > 0) rampCoolRef.current -= 1;
    if (lockFlashRef.current > 0) lockFlashRef.current -= 1;
    if (rampFlashRef.current > 0) rampFlashRef.current -= 1;
    if (bannerRef.current.frames > 0) bannerRef.current.frames -= 1;
    if (dropRaiseRef.current > 0 && --dropRaiseRef.current === 0) dropsRef.current = DROPS.map(() => false);

    // end-of-ball bonus tally animation (pour points into the score, then continue)
    if (tallyRef.current > 0) {
      if (--tallyTickRef.current <= 0) {
        tallyTickRef.current = 2;
        const chunk = Math.max(250, Math.round(tallyRef.current * 0.14));
        const give = Math.min(chunk, tallyRef.current);
        tallyRef.current -= give;
        addScore(give);
        fxRef.current?.popScore(CX, TOP + 160, `+${give}`, color.warn);
        if (tallyRef.current <= 0) finalizeBallLoss();
      }
      bump();
      return;
    }

    if (servedRef.current) {
      // safety auto-launch so a parked ball can never stick
      servedFramesRef.current += 1;
      if (servedFramesRef.current > 85) { servedFramesRef.current = 0; launch(); }
      bump(); return;
    }
    servedFramesRef.current = 0;

    const lf = leftF.current, rf = rightF.current;
    const lbx = PIVOT_LX + FLIP_LEN * Math.cos(lf.angle);
    const lby = PIVOT_Y + FLIP_LEN * Math.sin(lf.angle);
    const rbx = PIVOT_RX + FLIP_LEN * Math.cos(rf.angle);
    const rby = PIVOT_Y + FLIP_LEN * Math.sin(rf.angle);

    const bs = ballsRef.current;
    for (let bi = bs.length - 1; bi >= 0; bi--) {
      const b = bs[bi];

      for (let s = 0; s < SUBSTEPS; s++) {
        b.vy += GRAV / SUBSTEPS;
        b.x += b.vx / SUBSTEPS;
        b.y += b.vy / SUBSTEPS;

        if (b.x < playL + R) { b.x = playL + R; b.vx = Math.abs(b.vx) * WALL_REST; }
        else if (b.x > laneR - R) { b.x = laneR - R; b.vx = -Math.abs(b.vx) * WALL_REST; }
        if (b.y < TOP + R) { b.y = TOP + R; b.vy = Math.abs(b.vy) * WALL_REST; }
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
            b.vx = (b.vx - 2 * dot * nx) * BUMPER_REST + nx * BUMPER_KICK;
            b.vy = (b.vy - 2 * dot * ny) * BUMPER_REST + ny * BUMPER_KICK;
            flashRef.current[i] = 6;
            bumpCombo();
            const m = multFor();
            addScore(BUMPER_SCORE * m);
            bonusRef.current += 40;
            fxRef.current?.burst(bu.x, bu.y, { count: 10, color: "#FFB84D", speed: 150, size: 5 });
            if (m > 1) fxRef.current?.popScore(bu.x, bu.y - 18, `x${m}`, color.cyan);
            if (multiballRef.current) jackpotRef.current += 100;
          }
        }

        // static segments (walls + slingshots)
        for (let gi = 0; gi < SEGS.length; gi++) {
          const g = SEGS[gi];
          if (collideSeg(b, g.ax, g.ay, g.bx, g.by, 5, g.rest, 0, 0) && g.kind === "sling") {
            const sp = Math.hypot(b.vx, b.vy);
            if (sp > 0.001) { b.vx += (b.vx / sp) * SLING_KICK; b.vy += (b.vy / sp) * SLING_KICK; }
            segFlashRef.current[gi] = 6;
            bumpCombo();
            addScore(SLING_SCORE * multFor());
            bonusRef.current += 10;
            fxRef.current?.burst(b.x, b.y, { count: 8, color: "#00E5FF", speed: 150, size: 5 });
          }
        }

        // drop-target bank (standups that fall)
        if (dropRaiseRef.current === 0) {
          for (let di = 0; di < DROPS.length; di++) {
            if (dropsRef.current[di]) continue;
            const dt = DROPS[di];
            if (collideSeg(b, dt.x, dt.y - DROP_HH, dt.x, dt.y + DROP_HH, 6, 0.5, 0, 0)) {
              dropsRef.current[di] = true;
              bumpCombo();
              addScore(DROP_SCORE * multFor());
              bonusRef.current += 200;
              fxRef.current?.burst(dt.x, dt.y, { count: 8, color: "#00E5FF", speed: 160, size: 5 });
              fxRef.current?.popScore(dt.x + 20, dt.y, `${DROP_SCORE}`, color.cyan);
              if (dropsRef.current.every((v) => v)) {
                addScore(BANK_BONUS);
                bonusRef.current += 1000;
                dropRaiseRef.current = 90;           // re-raise after ~1.5s
                if (!multiballRef.current && lockCountRef.current < LOCKS_FOR_MB) {
                  lockLitRef.current = true;
                  lockFlashRef.current = 60;
                  banner("LOCK IS LIT", color.amber, 80);
                } else {
                  banner("BANK CLEARED", color.cyan, 70);
                }
                shake(8);
              }
            }
          }
        }

        // flippers (dynamic)
        if (collideSeg(b, PIVOT_LX, PIVOT_Y, lbx, lby, FLIP_HALF, FLIP_REST, lf.omega, lf.angle)) {
          if (lf.omega !== 0) { addScore(5); fxRef.current?.burst(b.x, b.y, { count: 6, color: "#00E5FF", speed: 130, size: 4 }); }
        }
        if (collideSeg(b, PIVOT_RX, PIVOT_Y, rbx, rby, FLIP_HALF, FLIP_REST, rf.omega, rf.angle)) {
          if (rf.omega !== 0) { addScore(5); fxRef.current?.burst(b.x, b.y, { count: 6, color: "#00E5FF", speed: 130, size: 4 }); }
        }

        const sp = Math.hypot(b.vx, b.vy);
        if (sp > MAXSPEED) { b.vx = (b.vx / sp) * MAXSPEED; b.vy = (b.vy / sp) * MAXSPEED; }
      }

      // --- rollover lanes (spell FLIP) ---
      for (let i = 0; i < LANES.length; i++) {
        if (lanesRef.current[i]) continue;
        const ln = LANES[i];
        if (Math.abs(b.x - ln.x) < LANE_HW && Math.abs(b.y - ln.y) < LANE_HH) {
          lanesRef.current[i] = true;
          bumpCombo();
          addScore(LANE_SCORE * multFor());
          bonusRef.current += 100;
          fxRef.current?.popScore(ln.x, ln.y + 18, ln.ch, color.amber);
          if (lanesRef.current.every((v) => v)) {
            lanesRef.current = LANES.map(() => false);
            bonusMultRef.current = Math.min(bonusMultRef.current + 1, 5);
            addScore(LANE_COMPLETE);
            bonusRef.current += 1000;
            banner(`FLIP! BONUS x${bonusMultRef.current}`, color.amber, 90);
            shake(6);
          }
        }
      }

      // --- ramp / right-orbit shot ---
      if (rampCoolRef.current === 0 && b.vy < -2 &&
          b.x > RAMP_X0 && b.x < RAMP_X1 && b.y > RAMP_Y0 && b.y < RAMP_Y1) {
        rampCoolRef.current = 40;
        rampFlashRef.current = 24;
        bumpCombo();
        if (multiballRef.current) {
          addScore(jackpotRef.current);
          banner("JACKPOT!", color.amber, 90);
          fxRef.current?.popScore(CX, RAMP_Y0 + 20, `${jackpotRef.current}`, color.amber);
          jackpotRef.current += 1000;
          shake(16);
        } else {
          addScore(RAMP_SCORE * multFor());
          bonusRef.current += 500;
          fxRef.current?.popScore(b.x, b.y - 12, "RAMP", color.cyan);
        }
        fxRef.current?.burst(b.x, b.y, { count: 12, color: "#00E5FF", speed: 180, size: 5 });
        // feed the habitrail return to the left inlane so the player can catch it
        b.x = PIVOT_LX - 6; b.y = PIVOT_Y - 72; b.vx = -0.6; b.vy = 2.4;
      }

      // --- lock saucer ---
      if (lockCoolRef.current === 0 && lockLitRef.current && !multiballRef.current &&
          Math.hypot(b.x - LOCK_X, b.y - LOCK_Y) < LOCK_R) {
        lockCoolRef.current = 30;
        if (lockCountRef.current < LOCKS_FOR_MB - 1) {
          // bank this ball; serve a fresh one (no life lost)
          lockCountRef.current += 1;
          lockLitRef.current = false;
          lockFlashRef.current = 30;
          addScore(LOCK_SCORE);
          bonusRef.current += 500;
          banner(`BALL LOCKED  ${lockCountRef.current}/${LOCKS_FOR_MB}`, color.cyan, 80);
          fxRef.current?.burst(LOCK_X, LOCK_Y, { count: 14, color: "#00E5FF", speed: 180, size: 5 });
          bs.splice(bi, 1);
          if (bs.length === 0) { servedRef.current = true; setServed(true); }
          continue; // this ball is gone
        } else {
          // final lock -> start multiball (keep this ball, fill to MAX_BALLS)
          releaseMultiball();
        }
      }

      // --- drain ---
      if (b.y - R > H && b.x < SH_X) {
        bs.splice(bi, 1);
        if (bs.length > 0) {
          // still balls in play (multiball) — no life lost
          if (multiballRef.current && bs.length === 1) {
            multiballRef.current = false;
            banner("BALL SAVED", color.cyan, 60); // last multiball ball keeps going
          }
          continue;
        }
        // last ball drained
        if (ballSaveRef.current > 0) {
          ballSaveRef.current = 0;
          bs.push(launchedBall());
          banner("BALL SAVED", color.success, 70);
          fxRef.current?.popScore(CX, H - 220, "SAVED", color.success);
          continue;
        }
        beginBallLoss();
      }
    }

    for (let i = 0; i < flashRef.current.length; i++) if (flashRef.current[i] > 0) flashRef.current[i] -= 1;
    for (let i = 0; i < segFlashRef.current.length; i++) if (segFlashRef.current[i] > 0) segFlashRef.current[i] -= 1;

    bump();
  };

  // Compute & start the end-of-ball bonus tally (loses a life once it finishes).
  const beginBallLoss = () => {
    comboRef.current = 0;
    const total = Math.round(bonusRef.current * bonusMultRef.current);
    if (total > 0) {
      tallyRef.current = total;
      tallyTickRef.current = 2;
      banner(`BONUS  x${bonusMultRef.current}`, color.warn, 60);
    } else {
      finalizeBallLoss();
    }
  };
  const finalizeBallLoss = () => {
    tallyRef.current = 0;
    bonusRef.current = 0;
    livesRef.current -= 1;
    setBalls(livesRef.current);
    if (livesRef.current <= 0) {
      overRef.current = true;
      setOver(true);
    } else {
      resetForNewBall();
      servedRef.current = true;
      setServed(true);
    }
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
    ballsRef.current.push(launchedBall());
    servedRef.current = false; setServed(false);
    ballSaveRef.current = BALL_SAVE_FRAMES;
    comboRef.current = 0;
  };
  const togglePause = () => {
    if (phaseRef.current === "playing") { phaseRef.current = "paused"; setPhase("paused"); }
    else if (phaseRef.current === "paused") { phaseRef.current = "playing"; setPhase("playing"); }
  };

  const reset = () => {
    ballsRef.current = [];
    servedRef.current = true; setServed(true);
    leftF.current = { angle: L_REST, omega: 0 };
    rightF.current = { angle: R_REST, omega: 0 };
    leftDown.current = false; rightDown.current = false;
    overRef.current = false;
    comboRef.current = 0; comboTimerRef.current = 0;
    lanesRef.current = LANES.map(() => false);
    dropsRef.current = DROPS.map(() => false);
    dropRaiseRef.current = 0;
    lockLitRef.current = false; lockCountRef.current = 0; lockCoolRef.current = 0;
    multiballRef.current = false; jackpotRef.current = JACKPOT_BASE;
    ballSaveRef.current = 0; shakeRef.current = 0; rampCoolRef.current = 0;
    bonusRef.current = 0; bonusMultRef.current = 1; tallyRef.current = 0;
    bannerRef.current = { text: "", color: color.amber, frames: 0 };
    livesRef.current = 3;
    fxRef.current?.clear();
    phaseRef.current = "playing";
    setOver(false); setScore(0); setBalls(3); setPhase("playing");
  };

  const bs = ballsRef.current;
  const lf = leftF.current, rf = rightF.current;
  const mult = multFor();
  const ban = bannerRef.current;

  // screen shake (reduced-motion safe — shakeRef only ever set via shake())
  const mag = shakeRef.current > 0 ? shakeRef.current * 0.5 : 0;
  const shx = mag ? Math.sin(shakeRef.current * 2.3) * mag : 0;
  const shy = mag ? Math.cos(shakeRef.current * 1.9) * mag : 0;

  return (
    <View style={[st.fill, { transform: [{ translateX: shx }, { translateY: shy }] }]}>
      {/* premium playfield backdrop (physics-neutral; inserts drawn aligned on top) */}
      <Image source={PLAYFIELD} resizeMode="stretch" fadeDuration={0}
        style={{ position: "absolute", left: 0, top: TOP, width: W, height: H - TOP }} />

      {/* flipper control halves (press-and-hold) */}
      {(() => { const hb = served ? Math.max(insets.bottom, 10) + 76 : 0; return (<>
        <Pressable style={[st.half, { left: 0, bottom: hb }]} onPressIn={() => { leftDown.current = true; }} onPressOut={() => { leftDown.current = false; }} />
        <Pressable style={[st.half, { right: 0, bottom: hb }]} onPressIn={() => { rightDown.current = true; }} onPressOut={() => { rightDown.current = false; }} />
      </>); })()}

      {/* outer walls + shooter-lane frame */}
      <View style={[st.wall, { left: 0, top: TOP, width: WALL, height: H - TOP }]} pointerEvents="none" />
      <View style={[st.wall, { right: 0, top: TOP, width: WALL, height: H - TOP }]} pointerEvents="none" />
      <View style={[st.wall, { left: 0, right: 0, top: TOP, height: WALL }]} pointerEvents="none" />
      <View style={[st.laneWall, { left: SH_X - 3, top: LANE_TOP, height: H - LANE_TOP }]} pointerEvents="none" />

      {/* rollover lane inserts (spell FLIP) */}
      {LANES.map((ln, i) => {
        const lit = lanesRef.current[i];
        return (
          <View key={`lane${i}`} pointerEvents="none" style={[st.lane, {
            left: ln.x - 15, top: ln.y - 13,
            borderColor: lit ? color.amber : color.surfaceLine,
            backgroundColor: lit ? "rgba(255,152,0,0.22)" : "rgba(20,26,34,0.45)",
          }, lit && { boxShadow: "0 0 12px rgba(255,152,0,0.5)" } as any]}>
            <Text style={{ color: lit ? color.amber : color.textFaint, fontWeight: "900", fontSize: 13 }}>{ln.ch}</Text>
          </View>
        );
      })}

      {/* drop-target bank */}
      {DROPS.map((dt, i) => {
        const down = dropsRef.current[i]; // knocked-down targets re-raise when dropRaiseRef elapses
        return (
          <View key={`drop${i}`} pointerEvents="none" style={[st.drop, {
            left: dt.x - 8, top: dt.y - DROP_HH,
            height: DROP_HH * 2,
            opacity: down ? 0.25 : 1,
            backgroundColor: down ? color.surface2 : color.cyan,
            borderColor: down ? color.surfaceLine : color.cyanDim,
          }, !down && { boxShadow: "0 0 8px rgba(0,229,255,0.45)" } as any]} />
        );
      })}

      {/* lock saucer */}
      {(() => {
        const lit = lockLitRef.current || lockFlashRef.current > 0;
        const SZc = LOCK_R * 2 + 6;
        return (
          <View key="lock" pointerEvents="none" style={[st.lock, {
            left: LOCK_X - SZc / 2, top: LOCK_Y - SZc / 2, width: SZc, height: SZc, borderRadius: SZc / 2,
            borderColor: lit ? color.amber : "#6B5220",
            backgroundColor: lit ? "rgba(255,152,0,0.18)" : "rgba(20,18,12,0.6)",
          }, lit && { boxShadow: "0 0 14px rgba(255,152,0,0.55)" } as any]}>
            <Text style={{ color: lit ? color.amber : color.textFaint, fontWeight: "900", fontSize: 10 }}>
              {lockCountRef.current > 0 ? `L${lockCountRef.current}` : "LOCK"}
            </Text>
          </View>
        );
      })()}

      {/* ramp / orbit arrow */}
      {(() => {
        const hot = rampFlashRef.current > 0;
        return (
          <Text key="ramp" pointerEvents="none" style={{
            position: "absolute", left: (RAMP_X0 + RAMP_X1) / 2 - 10, top: RAMP_Y0 - 6,
            color: hot ? color.amber : color.cyanDim, fontSize: 22, fontWeight: "900",
            opacity: hot ? 1 : 0.5,
          }}>▲</Text>
        );
      })()}

      {/* static segments (arches / slings / guides) drawn from their collision line */}
      {SEGS.map((g, i) => {
        const len = Math.hypot(g.bx - g.ax, g.by - g.ay);
        const ang = Math.atan2(g.by - g.ay, g.bx - g.ax) * 180 / Math.PI;
        const hot = segFlashRef.current[i] > 0;
        const col = g.kind === "sling" ? (hot ? "#FFFFFF" : color.cyan) : color.surfaceLine;
        return (
          <View key={`seg${i}`} pointerEvents="none" style={{ position: "absolute", left: g.ax, top: g.ay, transform: [{ rotate: `${ang}deg` }] }}>
            <View style={[{ position: "absolute", left: 0, top: -5, width: len, height: 10, borderRadius: 5, backgroundColor: col },
              g.kind === "sling" && hot && { boxShadow: "0 0 12px rgba(0,229,255,0.7)" } as any]} />
          </View>
        );
      })}

      {/* bumpers */}
      {BUMPERS.map((bu, i) => {
        const hot = flashRef.current[i] > 0;
        const SZ = BUMP_R * 2 + 16;
        return (
          <View key={`bump${i}`} pointerEvents="none" style={{ position: "absolute", left: bu.x - SZ / 2, top: bu.y - SZ / 2 }}>
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
        <View key={`piv${i}`} pointerEvents="none" style={{ position: "absolute", left: pv.x - 7, top: PIVOT_Y - 7, width: 14, height: 14, borderRadius: 7, backgroundColor: color.surface2, borderWidth: 2, borderColor: color.cyan }} />
      ))}

      {/* balls (live + the one waiting in the lane) */}
      {served && (
        <View pointerEvents="none" style={{ position: "absolute", left: servedBall().x - (R + 4), top: servedBall().y - (R + 4) }}>
          <Sprite source={BALL_IMG} size={R * 2 + 8} />
        </View>
      )}
      {bs.map((bb, i) => (
        <View key={`ball${i}`} pointerEvents="none" style={{ position: "absolute", left: bb.x - (R + 4), top: bb.y - (R + 4) }}>
          <Sprite source={BALL_IMG} size={R * 2 + 8} />
        </View>
      ))}

      <EffectsLayer ref={fxRef} reduced={reducedMotion} />

      {/* transient event banner (MULTIBALL / JACKPOT / BALL SAVED / BONUS) */}
      {ban.frames > 0 && !!ban.text && (
        <View pointerEvents="none" style={[st.banner, { top: TOP + (H - TOP) * 0.30 }]}>
          <Text style={[st.bannerT, { color: ban.color }]}>{ban.text}</Text>
        </View>
      )}

      {/* ball-save indicator */}
      {ballSaveRef.current > 0 && !served && (
        <View pointerEvents="none" style={[st.saveChip, { bottom: Math.max(insets.bottom, 10) + 74 }]}>
          <Text style={st.saveT}>BALL SAVE  {Math.ceil(ballSaveRef.current / 60)}s</Text>
        </View>
      )}

      {/* full-width LAUNCH bar while a ball waits in the lane */}
      {served && phase === "playing" && (
        <Pressable onPress={launch} accessibilityRole="button" accessibilityLabel="Launch the ball"
          style={[st.launch, { left: WALL, right: WALL, bottom: Math.max(insets.bottom, 10) + 10 }]}>
          <Text style={st.launchT}>⬆   TAP TO LAUNCH</Text>
        </Pressable>
      )}

      {/* HUD */}
      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <View style={st.hudPanel}>
          <PixelText size="score">{String(score).padStart(6, "0")}</PixelText>
          <PixelText size="label" style={{ marginTop: 4 }}>
            BALL {balls}{mult > 1 ? `   x${mult}` : ""}{bonusMultRef.current > 1 ? `   B${bonusMultRef.current}` : ""}
          </PixelText>
          {multiballRef.current && (
            <PixelText size="label" style={{ marginTop: 3, color: color.amber }}>MULTIBALL</PixelText>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <IconButton label="Pause" glyph={phase === "paused" ? "▶" : "❚❚"} onPress={togglePause} />
          <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
        </View>
      </View>

      <GameOverlay visible={phase === "ready"} kind="pause" title="FLIPPER FRENZY"
        primaryLabel="Start" onPrimary={start} onExit={onExit}>
        <Body muted style={{ textAlign: "center", marginTop: space.md }}>
          Tap LAUNCH to fire the ball. Hold either side to flip. Spell F-L-I-P in the top
          lanes for a bonus multiplier, knock down the drop-bank to light the LOCK, stack two
          locks for MULTIBALL, then shoot the right ramp for the JACKPOT. Don't drain.
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
  lane: { position: "absolute", width: 30, height: 26, borderRadius: 7, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  drop: { position: "absolute", width: 16, borderRadius: 3, borderWidth: 1 },
  lock: { borderWidth: 2, alignItems: "center", justifyContent: "center", position: "absolute" },
  flip: { position: "absolute", borderRadius: FLIP_HALF, backgroundColor: color.cyan },
  flipHi: { position: "absolute", left: 4, top: -FLIP_HALF + 2, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.45)" },
  banner: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 15 },
  bannerT: { fontSize: 26, fontWeight: "900", letterSpacing: 2, textShadowColor: "rgba(0,0,0,0.85)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 2 } },
  saveChip: { position: "absolute", alignSelf: "center", left: 0, right: 0, alignItems: "center", zIndex: 14 },
  saveT: { color: color.success, fontWeight: "800", fontSize: 12, letterSpacing: 1, backgroundColor: "rgba(10,14,20,0.7)", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: "hidden" },
  launch: { position: "absolute", height: 58, borderRadius: radius.md, backgroundColor: color.amber, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#B86B07", zIndex: 20 },
  launchT: { color: color.onAmber, fontWeight: "900", fontSize: 17, letterSpacing: 1.5 },
  hud: { position: "absolute", left: 0, right: 0, zIndex: 5, paddingHorizontal: space.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  hudPanel: { backgroundColor: "rgba(20,26,34,0.7)", borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, borderColor: color.surfaceLine },
});

export const flipperFrenzyGame: GameModule = {
  id: "flipper-frenzy",
  title: "Flipper Frenzy",
  kind: "arcade",
  Screen: GameScreen,
};
