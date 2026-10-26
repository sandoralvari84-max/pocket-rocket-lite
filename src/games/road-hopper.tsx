import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Dimensions, Pressable, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius, glow } from "../design/tokens";
import { PixelText, IconButton, GameOverlay, Sprite, Body } from "../design/ui";
import { ArcadeJoystick } from "../design/Joystick";
import { EffectsLayer, type EffectsHandle } from "../design/effects";
import { ScoreboardOverlay } from "../design/Scoreboard";
import { useSettings } from "../settings";

/* ----------------------------------------------------------------------------
 * Road Hopper — Frogger-style crosser, deep overhaul (2026-10-26).
 *
 * Headline: a LIBRARY of distinct crossing types composed into THEMED STAGES with
 * shooter-style escalation + an endless NG+ loop + an optional daily seed, plus
 * BOSS crossings (express line / rising flood). Sprites redesigned to match the
 * owned Pocket-Rocket art (amber #FF9800 / cyan #00E5FF).
 *
 * Crossing/lane types:
 *   - safe    : grass median / start / goal — no hazard, a place to breathe
 *   - road    : traffic (city / highway / construction variants: cars, bus, moto,
 *               ambulance w/ flashing lights, barriers + potholes)
 *   - river   : water = death; ride moving logs & turtles (turtles submerge on a cycle)
 *   - rail    : trains sweep the row; warning lights flash before they pass
 * Depth: power-ups (time-freeze / shield / hop-boost), gem collectibles, a combo
 * multiplier for forward progress, safe-zone rows, moving platforms, night vision.
 *
 * Hardcore-safe: deterministic ref-based core; frame-rate-independent via DT; layout
 * from a seeded PRNG (so daily/NG+ are reproducible); readable telegraphs; entity caps.
 * All decoration honors settings.reducedMotion.
 * ------------------------------------------------------------------------- */

const COLS = 9;
const GOAL_ROW = 0;
const CROSS = 9;                 // crossing rows (1..9)
const START_ROW = CROSS + 1;     // 10
const ROWS = START_ROW + 1;      // 11 (0 goal, 1..9 crossing, 10 start)
const { width: W, height: H } = Dimensions.get("window");
const CELL = Math.floor(Math.min((W - 24) / COLS, (H * 0.52) / ROWS));
const BOARD_W = CELL * COLS;
const BOARD_H = CELL * ROWS;
const TICK = 33;                 // ms
const DT = TICK / 1000;
const LIVES_START = 3;
const COMBO_CAP = 9;
const COMBO_WINDOW = 3.0;        // s before a streak cools off
const DEATH_MS = 520;            // squash/splash frame hold (0 under reducedMotion)
const CAMPAIGN_SEED = 0x51515;

const THEMES = ["CITY", "RIVER DELTA", "RAIL YARD", "HIGHWAY", "CONSTRUCTION", "NIGHT CITY"] as const;

// ---- owned art (tools/art/gen_roadhopper_art.py) --------------------------------
type Img = ReturnType<typeof require>;
const T_GRASS: Img = require("../../assets/arcade/roadhopper/grass.png");
const T_WATER: Img = require("../../assets/arcade/roadhopper/water.png");
const T_ROAD: Img = require("../../assets/arcade/roadhopper/road.png");
const T_RAIL: Img = require("../../assets/arcade/roadhopper/rail.png");
const HOPPER_IDLE: Img = require("../../assets/arcade/roadhopper/hopper_idle.png");
const HOPPER_HOP: Img = require("../../assets/arcade/roadhopper/hopper_hop.png");
const HOPPER_SQUASH: Img = require("../../assets/arcade/roadhopper/hopper_squash.png");
const HOPPER_SPLASH: Img = require("../../assets/arcade/roadhopper/hopper_splash.png");
const TURTLE_DIVE: Img = require("../../assets/arcade/roadhopper/turtle_dive.png");

type MoverKind =
  | "coupe" | "sedan" | "bug" | "taxi" | "van" | "truck"
  | "motorcycle" | "bus" | "ambulance" | "log" | "turtle" | "train" | "barrier";

const SPR: Record<MoverKind, Img> = {
  coupe: require("../../assets/arcade/roadhopper/car_red.png"),
  sedan: require("../../assets/arcade/roadhopper/car_blue.png"),
  bug: require("../../assets/arcade/roadhopper/bug.png"),
  taxi: require("../../assets/arcade/roadhopper/taxi.png"),
  van: require("../../assets/arcade/roadhopper/van.png"),
  truck: require("../../assets/arcade/roadhopper/truck.png"),
  motorcycle: require("../../assets/arcade/roadhopper/motorcycle.png"),
  bus: require("../../assets/arcade/roadhopper/bus.png"),
  ambulance: require("../../assets/arcade/roadhopper/ambulance.png"),
  log: require("../../assets/arcade/roadhopper/log.png"),
  turtle: require("../../assets/arcade/roadhopper/turtle.png"),
  train: require("../../assets/arcade/roadhopper/train.png"),
  barrier: require("../../assets/arcade/roadhopper/barrier.png"),
};

// width of each mover in cells (sprite aspect ratios match: bus/log=3, truck/ambulance/barrier=2, train=4)
const VW: Record<MoverKind, number> = {
  coupe: 1, sedan: 1, bug: 1, taxi: 1, van: 1, truck: 2,
  motorcycle: 1, bus: 3, ambulance: 2, log: 3, turtle: 1, train: 4, barrier: 2,
};

// ---- model ----------------------------------------------------------------------
type LaneKind = "safe" | "road" | "river" | "rail";
type Mover = { x: number; w: number; kind: MoverKind; phase: number };
type Rail = { t: number; gap: number; warn: number; pass: number; w: number };
type Lane = {
  row: number;
  kind: LaneKind;
  dir: 1 | -1;
  speed: number;        // cells/sec
  movers: Mover[];
  potholes: number[];   // death columns (road/construction)
  rail: Rail | null;
  turtleT: number;      // river turtle submerge clock
  turtleRate: number;   // cycles/sec
};
type Boss = null | "express" | "flood";
type PickupKind = "freeze" | "shield" | "boost" | "gem";
type Pickup = { row: number; col: number; kind: PickupKind; taken: boolean };
type Level = { lanes: Lane[]; theme: string; night: boolean; boss: Boss; pickups: Pickup[] };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// deterministic PRNG so layouts are reproducible (campaign / daily / NG+)
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- difficulty curves (small, readable steps; keep climbing but stay humane) ----
function speedScale(level: number) { return Math.min(0.9 + level * 0.06, 2.3); }
function densityBonus(level: number) { return Math.floor(level / 3); }
function floodRate(level: number) { return 0.16 + level * 0.008; } // cells/sec the flood rises

// ---- stage / boss selection -----------------------------------------------------
function stageInfo(level: number): { theme: string; night: boolean; boss: Boss } {
  if (level % 5 === 0) {
    const flood = (level / 5) % 2 === 0;          // L5 express, L10 flood, L15 express, ...
    return { theme: flood ? "BOSS · RISING FLOOD" : "BOSS · EXPRESS LINE", night: false, boss: flood ? "flood" : "express" };
  }
  const theme = THEMES[(level - 1) % THEMES.length];
  return { theme, night: theme === "NIGHT CITY", boss: null };
}

// ---- row-spec DSL ----------------------------------------------------------------
type RoadSpec = { k: "road"; speed: number; pool: MoverKind[]; base: number; construction: boolean };
type RiverSpec = { k: "river"; speed: number; mover: "log" | "turtle" };
type RailSpec = { k: "rail"; express: boolean };
type SafeSpec = { k: "safe" };
type RowSpec = RoadSpec | RiverSpec | RailSpec | SafeSpec;
const road = (pool: MoverKind[], speed: number, base: number, construction = false): RoadSpec =>
  ({ k: "road", pool, speed, base, construction });
const river = (mover: "log" | "turtle", speed: number): RiverSpec => ({ k: "river", mover, speed });
const rail = (express: boolean): RailSpec => ({ k: "rail", express });
const safe = (): SafeSpec => ({ k: "safe" });

const CITY_POOL: MoverKind[] = ["coupe", "sedan", "bug", "taxi", "van"];
const HW_POOL: MoverKind[] = ["coupe", "taxi", "motorcycle", "bus", "ambulance", "sedan"];
const NIGHT_POOL: MoverKind[] = ["coupe", "taxi", "ambulance", "bug", "van"];
const CONST_POOL: MoverKind[] = ["truck", "van", "ambulance", "coupe"];
const BARRIER_POOL: MoverKind[] = ["barrier"];

function composeSpecs(info: { theme: string; boss: Boss }): RowSpec[] {
  if (info.boss === "express")
    return [rail(true), rail(true), safe(), rail(true), road(HW_POOL, 3.6, 2), rail(true), safe(), road(HW_POOL, 3.2, 2), road(HW_POOL, 3.0, 2)];
  if (info.boss === "flood")
    return [river("log", 1.8), river("turtle", 1.6), river("log", 2.0), river("turtle", 1.8), safe(), river("log", 1.9), river("turtle", 1.7), road(CITY_POOL, 2.6, 2), road(CITY_POOL, 2.2, 2)];
  switch (info.theme) {
    case "RIVER DELTA":
      return [river("log", 1.5), river("turtle", 1.3), safe(), river("log", 1.7), river("turtle", 1.5), river("log", 1.9), safe(), road(CITY_POOL, 2.4, 2), road(CITY_POOL, 2.0, 3)];
    case "RAIL YARD":
      return [rail(false), road(CITY_POOL, 2.6, 2), safe(), rail(false), road(CITY_POOL, 2.2, 3), road(CITY_POOL, 2.8, 2), safe(), rail(false), road(CITY_POOL, 2.4, 2)];
    case "HIGHWAY":
      return [road(HW_POOL, 3.6, 3), road(HW_POOL, 4.0, 2), road(HW_POOL, 3.4, 3), safe(), road(HW_POOL, 4.2, 2), road(HW_POOL, 3.8, 3), road(HW_POOL, 4.4, 2), road(HW_POOL, 3.6, 3), road(HW_POOL, 4.0, 2)];
    case "CONSTRUCTION":
      return [road(CONST_POOL, 1.6, 2), road(BARRIER_POOL, 1.3, 2), safe(), road(CONST_POOL, 2.2, 2, true), road(BARRIER_POOL, 1.4, 2), road(CONST_POOL, 2.0, 3, true), safe(), road(CONST_POOL, 1.8, 2), road(BARRIER_POOL, 1.2, 2)];
    case "NIGHT CITY":
      return [road(NIGHT_POOL, 2.4, 2), road(NIGHT_POOL, 2.8, 2), safe(), road(NIGHT_POOL, 2.2, 3), road(NIGHT_POOL, 3.0, 2), road(NIGHT_POOL, 2.6, 3), safe(), road(NIGHT_POOL, 2.4, 2), road(NIGHT_POOL, 2.8, 2)];
    case "CITY":
    default:
      return [road(CITY_POOL, 2.2, 2), road(CITY_POOL, 2.6, 2), safe(), road(CITY_POOL, 2.0, 3), road(CITY_POOL, 2.8, 2), road(CITY_POOL, 2.4, 3), safe(), road(CITY_POOL, 2.2, 2), road(CITY_POOL, 2.6, 2)];
  }
}

function emptyLane(row: number, kind: LaneKind, dir: 1 | -1): Lane {
  return { row, kind, dir, speed: 0, movers: [], potholes: [], rail: null, turtleT: 0, turtleRate: 0.32 };
}

function placeMovers(count: number, w: number, kind: MoverKind, rng: () => number): Mover[] {
  const span = COLS + w;
  const spacing = span / count;
  const jit = rng() * spacing;
  const out: Mover[] = [];
  for (let i = 0; i < count; i++) {
    let x = i * spacing + jit - w;
    if (x > COLS) x -= span;
    out.push({ x, w, kind, phase: i / count });
  }
  return out;
}

function makeRail(express: boolean, level: number, rng: () => number): Rail {
  if (express)
    return { t: rng() * 3, gap: Math.max(0.7, 1.4 - level * 0.01), warn: 0.7, pass: Math.max(0.42, 0.72 - level * 0.006), w: 4 };
  return { t: rng() * 4, gap: Math.max(1.4, 3.0 - level * 0.03), warn: 1.1, pass: Math.max(0.55, 1.0 - level * 0.012), w: 4 };
}

function buildLane(row: number, spec: RowSpec, level: number, rng: () => number): Lane {
  const dir: 1 | -1 = row % 2 === 0 ? 1 : -1;
  const sc = speedScale(level);
  if (spec.k === "safe") return emptyLane(row, "safe", dir);
  if (spec.k === "rail") {
    const l = emptyLane(row, "rail", dir);
    l.rail = makeRail(spec.express, level, rng);
    return l;
  }
  if (spec.k === "river") {
    const l = emptyLane(row, "river", dir);
    const w = spec.mover === "log" ? 3 : 1;
    const count = spec.mover === "log"
      ? clamp(2 + Math.floor(level / 8), 2, 3)
      : clamp(3 + Math.floor(level / 6), 3, 4);
    l.speed = spec.speed * sc;
    l.movers = placeMovers(count, w, spec.mover, rng);
    return l;
  }
  // road / construction
  const l = emptyLane(row, "road", dir);
  const kind = spec.pool[Math.floor(rng() * spec.pool.length)];
  const w = VW[kind];
  let count = clamp(spec.base + densityBonus(level), 2, 5);
  if (w >= 3) count = clamp(count, 1, 3);
  else if (w === 2) count = clamp(count, 2, 4);
  l.speed = spec.speed * sc;
  l.movers = placeMovers(count, w, kind, rng);
  if (spec.construction) l.potholes = [clamp(1 + Math.floor(rng() * (COLS - 2)), 0, COLS - 1)];
  return l;
}

function buildPickups(lanes: Lane[], boss: Boss, rng: () => number): Pickup[] {
  const cands = lanes.filter((l) => l.row > GOAL_ROW && l.row < START_ROW && (l.kind === "road" || l.kind === "safe"));
  if (cands.length === 0) return [];
  const n = boss ? 1 : (rng() < 0.5 ? 2 : 1);
  const used = new Set<number>();
  const out: Pickup[] = [];
  for (let i = 0; i < n; i++) {
    const lane = cands[Math.floor(rng() * cands.length)];
    if (used.has(lane.row)) continue;
    used.add(lane.row);
    let col = clamp(Math.floor(rng() * COLS), 0, COLS - 1);
    if (lane.potholes.includes(col)) col = (col + 1) % COLS;
    const r = rng();
    const kind: PickupKind = r < 0.5 ? "gem" : r < 0.7 ? "shield" : r < 0.87 ? "freeze" : "boost";
    out.push({ row: lane.row, col, kind, taken: false });
  }
  return out;
}

function buildLevel(level: number, seed: number): Level {
  const info = stageInfo(level);
  const rng = mulberry32((seed + level * 0x9e3779b1) >>> 0);
  const specs = composeSpecs(info);
  const lanes: Lane[] = [];
  lanes.push(emptyLane(GOAL_ROW, "safe", 1));
  for (let i = 0; i < CROSS; i++) lanes.push(buildLane(i + 1, specs[i], level, rng));
  lanes.push(emptyLane(START_ROW, "safe", 1));
  const pickups = buildPickups(lanes, info.boss, rng);
  return { lanes, theme: info.theme, night: info.night, boss: info.boss, pickups };
}

// rail train position/telegraph derived deterministically from its clock
function railPhase(l: Lane): { warn: boolean; active: boolean; x: number } {
  const r = l.rail;
  if (!r) return { warn: false, active: false, x: 0 };
  const cyc = r.gap + r.warn + r.pass;
  const t = r.t % cyc;
  if (t < r.gap) return { warn: false, active: false, x: 0 };
  if (t < r.gap + r.warn) return { warn: true, active: false, x: 0 };
  const p = (t - r.gap - r.warn) / r.pass;
  const x = l.dir === 1 ? -r.w + p * (COLS + r.w) : COLS - p * (COLS + r.w);
  return { warn: false, active: true, x };
}

function turtleSubmerged(l: Lane, m: Mover): boolean {
  const phase = (l.turtleT * l.turtleRate + m.phase) % 1;
  return phase > 0.72;
}
function turtleDiving(l: Lane, m: Mover): boolean {
  const phase = (l.turtleT * l.turtleRate + m.phase) % 1;
  return phase > 0.58;
}

function dailySeed(): number {
  const d = new Date();
  return (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) >>> 0;
}

const PICKUP_META: Record<PickupKind, { c: string; g: string }> = {
  freeze: { c: color.cyan, g: "❄" },
  shield: { c: color.amber, g: "◇" },
  boost: { c: color.success, g: "⇑" },
  gem: { c: color.cyan, g: "◆" },
};

function Screen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useSettings();
  const fxRef = useRef<EffectsHandle>(null);
  const cpx = (c: number) => (c + 0.5) * CELL;
  const cpy = (r: number) => (r + 0.5) * CELL;

  // --- deterministic ref-based core ---
  const rowRef = useRef(START_ROW);
  const pxRef = useRef(Math.floor(COLS / 2));         // player left-edge col (float; drifts on water)
  const seedRef = useRef(CAMPAIGN_SEED);
  const modeRef = useRef<"campaign" | "daily">("campaign");
  const levelRef = useRef(1);
  const levelDataRef = useRef<Level>(buildLevel(1, CAMPAIGN_SEED));
  const phaseRef = useRef<"ready" | "playing" | "paused" | "clear" | "over">("ready");
  const clockRef = useRef(0);                          // game seconds (for telegraph/flash timing)

  const comboRef = useRef(1);
  const bestRowRef = useRef(START_ROW);
  const lastProgressRef = useRef(0);
  const freezeRef = useRef(0);
  const boostRef = useRef(0);
  const invulnRef = useRef(0);
  const shieldRef = useRef(false);
  const floodRef = useRef(START_ROW + 1.3);
  const dyingRef = useRef<{ kind: "squash" | "splash"; t: number } | null>(null);
  const clearTallyRef = useRef<{ level: number; theme: string; bonus: number; combo: number }>({ level: 1, theme: "", bonus: 0, combo: 1 });

  const [, setFrame] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(LIVES_START);
  const [level, setLevel] = useState(1);
  const [hopping, setHopping] = useState(false);
  const [mode, setMode] = useState<"campaign" | "daily">("campaign");
  const [phase, setPhase] = useState<"ready" | "playing" | "paused" | "clear" | "over">("ready");
  const hopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bump = () => setFrame((f) => (f + 1) % 1000000);
  const addPts = (n: number) => setScore((s) => s + n);
  const laneAt = (r: number) => levelDataRef.current.lanes[r];
  const comboMult = () => Math.min(1 + (comboRef.current - 1) * 0.25, 3);

  function triggerHop() {
    setHopping(true);
    if (hopTimer.current) clearTimeout(hopTimer.current);
    hopTimer.current = setTimeout(() => setHopping(false), 140);
  }

  function respawn() {
    rowRef.current = START_ROW;
    pxRef.current = Math.floor(COLS / 2);
    bestRowRef.current = START_ROW;
    invulnRef.current = 1.2;
    comboRef.current = 1;
    floodRef.current = START_ROW + 1.3;
    dyingRef.current = null;
  }

  function applyPickup(kind: PickupKind) {
    const x = cpx(Math.round(pxRef.current)), y = cpy(rowRef.current);
    if (kind === "gem") {
      const add = Math.round(60 * comboMult());
      addPts(add);
      fxRef.current?.burst(x, y, { count: 16, color: color.cyan, speed: 150, size: 5 });
      fxRef.current?.popScore(x, y, `+${add}`, color.cyan);
      return;
    }
    addPts(25);
    if (kind === "freeze") { freezeRef.current = 3.2; fxRef.current?.burst(x, y, { count: 18, color: color.cyan, speed: 120, size: 5 }); fxRef.current?.popScore(x, y, "FREEZE", color.cyan); }
    else if (kind === "shield") { shieldRef.current = true; fxRef.current?.burst(x, y, { count: 18, color: color.amber, speed: 120, size: 5 }); fxRef.current?.popScore(x, y, "SHIELD", color.amber); }
    else if (kind === "boost") { boostRef.current = 4.0; fxRef.current?.burst(x, y, { count: 18, color: color.success, speed: 120, size: 5 }); fxRef.current?.popScore(x, y, "BOOST", color.success); }
  }

  function collectAt(r: number, px: number) {
    const col = Math.round(px);
    for (const p of levelDataRef.current.pickups) {
      if (!p.taken && p.row === r && p.col === col) { p.taken = true; applyPickup(p.kind); }
    }
  }

  function killPlayer(kind: "squash" | "splash") {
    if (invulnRef.current > 0 || dyingRef.current) return;
    const x = cpx(Math.round(pxRef.current)), y = cpy(rowRef.current);
    if (shieldRef.current) {
      shieldRef.current = false;
      invulnRef.current = 1.1;
      fxRef.current?.burst(x, y, { count: 20, color: color.amber, speed: 150, size: 6 });
      fxRef.current?.popScore(x, y, "BLOCKED", color.amber);
      return;
    }
    comboRef.current = 1;
    fxRef.current?.burst(x, y, { count: 18, color: kind === "splash" ? color.cyan : color.danger, speed: 150, size: 6 });
    dyingRef.current = { kind, t: reducedMotion ? 0.001 : DEATH_MS / 1000 };
  }

  function finalizeDeath() {
    setLives((v) => {
      const nv = v - 1;
      if (nv <= 0) { phaseRef.current = "over"; setPhase("over"); }
      else respawn();
      return nv;
    });
  }

  function clearLevel() {
    const mult = comboMult();
    const bonus = Math.round((120 + levelRef.current * 25) * mult);
    addPts(bonus);
    fxRef.current?.burst(cpx(Math.round(pxRef.current)), cpy(GOAL_ROW), { count: 22, color: color.success, speed: 160, size: 6 });
    fxRef.current?.popScore(cpx(Math.round(pxRef.current)), cpy(GOAL_ROW), `+${bonus}`, color.success);
    clearTallyRef.current = { level: levelRef.current, theme: levelDataRef.current.theme, bonus, combo: comboRef.current };
    phaseRef.current = "clear"; setPhase("clear");
  }

  function move(dc: number, dr: number) {
    if (phaseRef.current !== "playing" || dyingRef.current) return;
    let ndr = dr;
    if (dr < 0 && boostRef.current > 0) ndr = -2;         // hop-boost: double upward hop
    const nr = clamp(rowRef.current + ndr, GOAL_ROW, START_ROW);
    rowRef.current = nr;
    pxRef.current = clamp(pxRef.current + dc, 0, COLS - 1);
    const lane = laneAt(nr);
    if (!lane || lane.kind !== "river") pxRef.current = clamp(Math.round(pxRef.current), 0, COLS - 1);
    triggerHop();
    if (ndr < 0 && nr < bestRowRef.current) {            // forward progress -> combo + drip score
      bestRowRef.current = nr;
      comboRef.current = Math.min(COMBO_CAP, comboRef.current + 1);
      lastProgressRef.current = clockRef.current;
      const add = Math.round(10 * comboMult());
      addPts(add);
      if (comboRef.current > 1)
        fxRef.current?.popScore(cpx(Math.round(pxRef.current)), cpy(nr), `x${comboRef.current}`, color.amber);
    }
    collectAt(nr, pxRef.current);
    if (nr === GOAL_ROW) clearLevel();
    bump();
  }
  const hop = () => move(0, -1);

  function beginRun() {
    seedRef.current = modeRef.current === "daily" ? dailySeed() : CAMPAIGN_SEED;
    levelRef.current = 1; setLevel(1);
    levelDataRef.current = buildLevel(1, seedRef.current);
    setScore(0); setLives(LIVES_START);
    shieldRef.current = false; freezeRef.current = 0; boostRef.current = 0;
    clockRef.current = 0;
    respawn();
    phaseRef.current = "playing"; setPhase("playing"); bump();
  }
  const start = () => beginRun();
  const fullRestart = () => beginRun();

  function nextLevel() {
    levelRef.current += 1; setLevel(levelRef.current);
    levelDataRef.current = buildLevel(levelRef.current, seedRef.current);
    shieldRef.current = false; freezeRef.current = 0; boostRef.current = 0;
    respawn();
    phaseRef.current = "playing"; setPhase("playing"); bump();
  }

  const togglePause = () => {
    if (phaseRef.current === "playing") { phaseRef.current = "paused"; setPhase("paused"); }
    else if (phaseRef.current === "paused") { phaseRef.current = "playing"; setPhase("playing"); }
  };
  const toggleMode = () => {
    const nm = modeRef.current === "campaign" ? "daily" : "campaign";
    modeRef.current = nm; setMode(nm);
  };

  // --- deterministic simulation loop (frame-rate independent via DT) ---
  useEffect(() => {
    const id = setInterval(() => {
      if (phaseRef.current !== "playing") return;
      const lvl = levelDataRef.current;

      if (freezeRef.current > 0) freezeRef.current = Math.max(0, freezeRef.current - DT);
      if (boostRef.current > 0) boostRef.current = Math.max(0, boostRef.current - DT);
      if (invulnRef.current > 0) invulnRef.current = Math.max(0, invulnRef.current - DT);
      clockRef.current += DT;
      const frozen = freezeRef.current > 0;

      if (dyingRef.current) {
        dyingRef.current.t -= DT;
        if (dyingRef.current.t <= 0) { dyingRef.current = null; finalizeDeath(); }
        bump(); return;
      }

      if (!frozen) {
        for (const lane of lvl.lanes) {
          if (lane.kind === "road" || lane.kind === "river") {
            if (lane.kind === "river") lane.turtleT += DT;
            for (const m of lane.movers) {
              m.x += lane.dir * lane.speed * DT;
              if (lane.dir === 1 && m.x > COLS) m.x = -m.w;
              else if (lane.dir === -1 && m.x < -m.w) m.x = COLS;
            }
          } else if (lane.kind === "rail" && lane.rail) {
            lane.rail.t += DT;
          }
        }
        if (lvl.boss === "flood") floodRef.current -= floodRate(levelRef.current) * DT;
      }

      const prow = rowRef.current;
      const plane = laneAt(prow);

      // river: must ride a platform, and get carried by it
      if (plane && plane.kind === "river") {
        const cx = pxRef.current + 0.5;
        let support: Mover | null = null;
        for (const m of plane.movers) {
          if (m.kind === "turtle" && turtleSubmerged(plane, m)) continue;
          if (cx > m.x + 0.1 && cx < m.x + m.w - 0.1) { support = m; break; }
        }
        if (!support) { killPlayer("splash"); bump(); return; }
        if (!frozen) {
          pxRef.current += plane.dir * plane.speed * DT;
          if (pxRef.current < -0.3 || pxRef.current > COLS - 0.7) { killPlayer("splash"); bump(); return; }
          pxRef.current = clamp(pxRef.current, -0.3, COLS - 0.7);
        }
      }

      // road / rail / pothole collisions
      if (plane) {
        if (plane.kind === "road") {
          const pl = pxRef.current + 0.18, pr = pxRef.current + 0.82;
          for (const m of plane.movers) {
            if (pl < m.x + m.w && pr > m.x) { killPlayer("squash"); bump(); return; }
          }
          if (plane.potholes.length && plane.potholes.includes(Math.round(pxRef.current))) { killPlayer("squash"); bump(); return; }
        } else if (plane.kind === "rail" && plane.rail) {
          const ph = railPhase(plane);
          if (ph.active) {
            const pl = pxRef.current + 0.18, pr = pxRef.current + 0.82;
            if (pl < ph.x + plane.rail.w && pr > ph.x) { killPlayer("squash"); bump(); return; }
          }
        }
      }

      // flood boss: caught by the rising waterline
      if (lvl.boss === "flood" && rowRef.current >= floodRef.current) { killPlayer("splash"); bump(); return; }

      if (comboRef.current > 1 && clockRef.current - lastProgressRef.current > COMBO_WINDOW) comboRef.current = 1;

      bump();
    }, TICK);
    return () => clearInterval(id);
  }, [reducedMotion]);

  useEffect(() => () => { if (hopTimer.current) clearTimeout(hopTimer.current); }, []);

  // --- static background for the current level (rebuilt when level changes) ---
  const laneLayer = useMemo(() => {
    const lvl = levelDataRef.current;
    const out: React.ReactNode[] = [];
    for (let r = 0; r < ROWS; r++) {
      const lane = lvl.lanes[r];
      const img = lane.kind === "river" ? T_WATER : lane.kind === "rail" ? T_RAIL : lane.kind === "safe" ? T_GRASS : T_ROAD;
      for (let c = 0; c < COLS; c++) {
        out.push(
          <View key={`bg${r}-${c}`} style={{ position: "absolute", left: c * CELL, top: r * CELL }}>
            <Sprite source={img} size={CELL} />
          </View>
        );
      }
      // dashed divider between adjacent road rows (classic lane marking)
      const below = lvl.lanes[r + 1];
      if (lane.kind === "road" && below && below.kind === "road") {
        out.push(
          <View key={`ln${r}`} style={{ position: "absolute", left: 0, top: (r + 1) * CELL - 1, width: BOARD_W, height: 2, flexDirection: "row" }}>
            {Array.from({ length: COLS }).map((_, i) => (
              <View key={i} style={{ width: CELL * 0.5, height: 3, marginRight: CELL * 0.5, borderRadius: 1.5, backgroundColor: "rgba(255,221,128,0.5)" }} />
            ))}
          </View>
        );
      }
      // potholes (static death cells, clearly drawn)
      for (const pc of lane.potholes) {
        out.push(
          <View key={`ph${r}-${pc}`} style={{ position: "absolute", left: pc * CELL + CELL * 0.14, top: r * CELL + CELL * 0.18, width: CELL * 0.72, height: CELL * 0.64, borderRadius: CELL * 0.36, backgroundColor: "#05070c", borderWidth: 2, borderColor: "rgba(255,152,0,0.5)" }} />
        );
      }
    }
    // goal pads on the finish row
    for (let c = 0; c < COLS; c++) {
      out.push(
        <View key={`goal${c}`} style={{ position: "absolute", left: c * CELL + CELL * 0.2, top: GOAL_ROW * CELL + CELL * 0.2, width: CELL * 0.6, height: CELL * 0.6, borderRadius: CELL * 0.3, borderWidth: 2, borderColor: "rgba(0,229,255,0.6)", backgroundColor: "rgba(0,229,255,0.1)" }} />
      );
    }
    return out;
  }, [level]);

  const lvl = levelDataRef.current;
  const prow = rowRef.current;
  const px = pxRef.current;
  const flash = reducedMotion ? true : Math.floor(clockRef.current * 6) % 2 === 0;
  const ambFlash = reducedMotion ? 0 : Math.floor(clockRef.current * 4) % 2;
  const dying = dyingRef.current;
  const playerSprite = dying ? (dying.kind === "splash" ? HOPPER_SPLASH : HOPPER_SQUASH) : (hopping ? HOPPER_HOP : HOPPER_IDLE);
  const invBlink = invulnRef.current > 0 && !dying && !flash ? 0.5 : 1;

  // active-powerup HUD line
  const pw: string[] = [];
  if (freezeRef.current > 0) pw.push(`FREEZE ${freezeRef.current.toFixed(1)}`);
  if (boostRef.current > 0) pw.push(`BOOST ${boostRef.current.toFixed(1)}`);
  if (shieldRef.current) pw.push("SHIELD");
  const loopN = Math.floor((level - 1) / THEMES.length);

  return (
    <View style={st.fill}>
      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <View style={st.hudPanel}>
          <PixelText size="score">{String(score).padStart(5, "0")}</PixelText>
          <PixelText size="label" style={{ marginTop: 4 }}>
            LV {level}  LIVES {Math.max(0, lives)}{comboRef.current > 1 ? `  x${comboRef.current}` : ""}
          </PixelText>
          <PixelText size="label" style={{ marginTop: 2, color: lvl.boss ? color.danger : color.cyan }}>
            {lvl.theme}{loopN > 0 ? `  NG+${loopN}` : ""}{mode === "daily" ? "  DAILY" : ""}
          </PixelText>
          {pw.length > 0 && (
            <PixelText size="label" style={{ marginTop: 2, color: color.amber }}>{pw.join("  ")}</PixelText>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <IconButton label="Pause" glyph={phase === "paused" ? "▶" : "❚❚"} onPress={togglePause} />
          <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
        </View>
      </View>

      <View style={st.center}>
        <Pressable onPress={hop}>
          <View style={[st.board, { width: BOARD_W, height: BOARD_H }]}>
            {laneLayer}

            {/* night: darken environment + a soft torch disc around the hopper (hazards stay visible = fair) */}
            {lvl.night && (
              <>
                <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: BOARD_W, height: BOARD_H, backgroundColor: "rgba(4,8,16,0.5)" }} />
                <View pointerEvents="none" style={{ position: "absolute", left: px * CELL - CELL * 1.6, top: prow * CELL - CELL * 1.6, width: CELL * 4.2, height: CELL * 4.2, borderRadius: CELL * 2.1, backgroundColor: "rgba(120,180,255,0.10)", boxShadow: glow.cyanSoft }} />
              </>
            )}

            {/* flood boss: rising waterline from the bottom */}
            {lvl.boss === "flood" && floodRef.current < ROWS && (
              <View pointerEvents="none" style={{ position: "absolute", left: 0, top: Math.max(0, floodRef.current) * CELL, width: BOARD_W, height: BOARD_H, backgroundColor: "rgba(40,120,210,0.35)", borderTopWidth: 3, borderTopColor: "rgba(150,220,255,0.9)" }} />
            )}

            {/* movers */}
            {lvl.lanes.map((lane) =>
              lane.movers.map((m, i) => {
                const diving = lane.kind === "river" && m.kind === "turtle" && turtleDiving(lane, m);
                const submerged = lane.kind === "river" && m.kind === "turtle" && turtleSubmerged(lane, m);
                return (
                  <View key={`m${lane.row}-${i}`} style={{ position: "absolute", left: m.x * CELL, top: lane.row * CELL, width: m.w * CELL, height: CELL }}>
                    <Image
                      source={diving ? TURTLE_DIVE : SPR[m.kind]}
                      resizeMode="contain"
                      fadeDuration={0}
                      style={{ width: m.w * CELL, height: CELL, opacity: submerged ? 0.6 : 1, transform: lane.dir === -1 && !diving ? [{ scaleX: -1 }] : undefined }}
                    />
                    {m.kind === "ambulance" && (
                      <View style={{ position: "absolute", left: m.w * CELL * 0.33, top: CELL * 0.1, width: m.w * CELL * 0.34, height: CELL * 0.14, borderRadius: 3, backgroundColor: ambFlash ? color.danger : color.cyan }} />
                    )}
                  </View>
                );
              })
            )}

            {/* rail: train sprite when passing + warning flash when telegraphing */}
            {lvl.lanes.map((lane) => {
              if (lane.kind !== "rail" || !lane.rail) return null;
              const ph = railPhase(lane);
              if (ph.warn) {
                return (
                  <View key={`warn${lane.row}`} pointerEvents="none" style={{ position: "absolute", left: 0, top: lane.row * CELL, width: BOARD_W, height: CELL, borderWidth: 3, borderColor: flash ? color.danger : "rgba(255,82,71,0.25)", backgroundColor: flash ? "rgba(255,82,71,0.14)" : "transparent" }}>
                    <View style={{ position: "absolute", left: 4, top: CELL * 0.4, width: CELL * 0.2, height: CELL * 0.2, borderRadius: CELL * 0.1, backgroundColor: flash ? color.danger : "rgba(255,82,71,0.3)" }} />
                    <View style={{ position: "absolute", right: 4, top: CELL * 0.4, width: CELL * 0.2, height: CELL * 0.2, borderRadius: CELL * 0.1, backgroundColor: flash ? color.danger : "rgba(255,82,71,0.3)" }} />
                  </View>
                );
              }
              if (ph.active) {
                return (
                  <Image key={`train${lane.row}`} source={SPR.train} resizeMode="contain" fadeDuration={0}
                    style={{ position: "absolute", left: ph.x * CELL, top: lane.row * CELL, width: lane.rail.w * CELL, height: CELL, transform: lane.dir === -1 ? [{ scaleX: -1 }] : undefined }} />
                );
              }
              return null;
            })}

            {/* pickups / collectibles */}
            {lvl.pickups.map((p, i) => p.taken ? null : (
              <View key={`pk${i}`} pointerEvents="none" style={{ position: "absolute", left: p.col * CELL + CELL * 0.22, top: p.row * CELL + CELL * 0.22, width: CELL * 0.56, height: CELL * 0.56, borderRadius: CELL * 0.28, borderWidth: 2, borderColor: PICKUP_META[p.kind].c, backgroundColor: "rgba(10,16,24,0.85)", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: PICKUP_META[p.kind].c, fontSize: CELL * 0.3, fontWeight: "800" }}>{PICKUP_META[p.kind].g}</Text>
              </View>
            ))}

            {/* player */}
            <View style={{ position: "absolute", left: px * CELL, top: prow * CELL, opacity: invBlink }}>
              {!dying && (
                <View style={{ position: "absolute", left: CELL * 0.22, top: CELL * 0.7, width: CELL * 0.56, height: CELL * 0.2, borderRadius: CELL * 0.1, backgroundColor: "rgba(0,0,0,0.3)" }} />
              )}
              {shieldRef.current && !dying && (
                <View pointerEvents="none" style={{ position: "absolute", left: -CELL * 0.1, top: -CELL * 0.1, width: CELL * 1.2, height: CELL * 1.2, borderRadius: CELL * 0.6, borderWidth: 2, borderColor: color.amber, boxShadow: glow.amberSoft }} />
              )}
              <View style={lvl.night ? { boxShadow: glow.cyan } : undefined}>
                <Sprite source={playerSprite} size={CELL} />
              </View>
            </View>

            <EffectsLayer ref={fxRef} reduced={reducedMotion} />
          </View>
        </Pressable>
        <Body muted style={{ marginTop: space.md, textAlign: "center", paddingHorizontal: space.lg }}>
          Tap or press HOP to go up. Reach the cyan pads at the top. Ride logs on water — mind the rails, barriers and traffic.
        </Body>
      </View>

      <View style={st.dpad} pointerEvents="box-none">
        <ArcadeJoystick onDirection={(d) => move(d.dx, d.dy)} />
      </View>

      <GameOverlay
        visible={phase === "ready"} kind="pause" title="ROAD HOPPER"
        primaryLabel="Start" onPrimary={start} onExit={onExit}
      >
        <Body muted style={{ textAlign: "center", marginTop: space.md }}>
          Cross city streets, rivers, rail yards and construction to the top. Varied stages
          escalate and loop endlessly (NG+); boss crossings await at every 5th level.
        </Body>
        <Pressable onPress={toggleMode} style={{ marginTop: space.lg, alignSelf: "center", borderWidth: 1.5, borderColor: mode === "daily" ? color.cyan : color.surfaceLine, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.sm }}>
          <PixelText size="label" style={{ color: mode === "daily" ? color.cyan : color.textMuted }}>
            MODE: {mode === "daily" ? "DAILY SEED" : "CAMPAIGN"}
          </PixelText>
        </Pressable>
      </GameOverlay>

      <GameOverlay
        visible={phase === "paused"} kind="pause" title="PAUSED" score={`SCORE ${score}`}
        primaryLabel="Resume" onPrimary={togglePause} onExit={onExit}
      />

      <GameOverlay
        visible={phase === "clear"} kind="win"
        title={lvl.boss ? "BOSS CLEARED" : `STAGE ${clearTallyRef.current.level} CLEAR`}
        score={`SCORE ${score}`}
        primaryLabel="Next crossing" onPrimary={nextLevel} onExit={onExit}
      >
        <Body muted style={{ textAlign: "center", marginTop: space.md }}>
          {clearTallyRef.current.theme}  ·  BONUS +{clearTallyRef.current.bonus}  ·  COMBO x{clearTallyRef.current.combo}
        </Body>
        <Body muted style={{ textAlign: "center", marginTop: space.sm }}>
          Up next: {stageInfo(level + 1).theme}. Faster, busier, tighter gaps.
        </Body>
      </GameOverlay>

      <ScoreboardOverlay
        visible={phase === "over"} gameId="road-hopper" score={score}
        scoreLabel={`SCORE ${score}`} onPlayAgain={fullRestart} onExit={onExit}
      />
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  board: { backgroundColor: "#05070f", borderRadius: radius.md, overflow: "hidden" },
  hud: {
    position: "absolute", left: 0, right: 0, zIndex: 10, paddingHorizontal: space.lg,
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
  },
  hudPanel: {
    backgroundColor: "rgba(20,26,34,0.7)", borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.sm,
    borderWidth: 1, borderColor: color.surfaceLine,
  },
  dpad: { position: "absolute", bottom: 28, left: 0, right: 0, alignItems: "center" },
});

export const roadHopperGame: GameModule = {
  id: "road-hopper",
  title: "Road Hopper",
  kind: "arcade",
  Screen,
};
