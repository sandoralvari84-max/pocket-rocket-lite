import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  useWindowDimensions,
  PanResponder,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, IconButton, GameOverlay, Sprite, Body } from "../design/ui";
import { ScoreboardOverlay } from "../design/Scoreboard";
import { ArcadeJoystick } from "../design/Joystick";
import { EffectsLayer, type EffectsHandle } from "../design/effects";
import { useSettings } from "../settings";

/* ----------------------------------------------------------------------------
 * Maze Muncher — Pac-Man-style muncher with a DETERMINISTIC, ref-based core.
 *
 * Overhaul (2026-10): maximised playfield, 8 hand-validated maze layouts
 * (+ vertical-mirror variants -> 16 campaign levels), 8 themed stages, an
 * endless NG+ loop, four distinct ghost personalities + a Hunter mini-boss,
 * fruit/power-ups, stage modifiers (warp tunnels / moving gates / dark maze),
 * a bonus "rush" round, combo scoring, eaten-ghost eyes returning home, and
 * level-clear tallies — all honouring settings.reducedMotion.
 *
 * All gameplay is grid-locked and RNG-free, so the simulation stays fully
 * deterministic and hardcore-safe. Every layout is flood-fill verified fully
 * connected (even with gates treated as walls), so levels can never softlock.
 * Original owned art: tools/art/gen_maze_art.py / gen_maze_tiles.py /
 * gen_maze_extra.py -> assets/arcade/maze/ (CC0 / full rights).
 * ------------------------------------------------------------------------- */

type Dir = { dx: number; dy: number };
type Pos = { r: number; c: number };
type MazeDef = {
  grid: string[];
  player: Pos;
  homes: Pos[];
  corners: Pos[];
  gates: string[];      // keys of '=' cells (moving gates)
  tunnelRows: number[]; // rows whose side borders wrap ('T')
};

// '#' wall · '.' pellet · 'o' power-pellet · 'P' player · ' ' empty floor
// 'T' warp-tunnel opening (floor, no pellet) · '=' moving gate (toggles wall)
// 13 wide x 19 tall, horizontally symmetric, flood-fill-verified connected.
// Generated + validated via tools (scratchpad maze_gen.py); hand-curated here.
const L0: string[] = [
  "#############", "#.o.......o.#", "#.#.#.#.#.#.#", "#.#...#...#.#",
  "#.#.#.#.#.#.#", "#...........#", "#.#.#####.#.#", "#...........#",
  "#.#.#   #.#.#", "#...#   #...#", "#.#.#   #.#.#", "#.#...#...#.#",
  "#.#.#.#.#.#.#", "#...........#", "#.#.#####.#.#", "#.o.......o.#",
  "#.#.#.#.#.#.#", "#.....P.....#", "#############",
];
const L1: string[] = [
  "#############", "#.o.......o.#", "#.#.#####.#.#", "#...........#",
  "#.###.#.###.#", "#.....#.....#", "#.#.#.#.#.#.#", "#...#.#.#...#",
  "###.#   #.###", "#...#   #...#", "#.###   ###.#", "#...........#",
  "#.###.#.###.#", "#...#...#...#", "###.#.#.#.###", "#.o...#...o.#",
  "#.#.#.#.#.#.#", "#.....P.....#", "#############",
];
const L2: string[] = [
  "#############", "#.o.......o.#", "#.#.#.#.#.#.#", "#...........#",
  "#.###.#.###.#", "#.....#.....#", "#.#.#.#.#.#.#", "#...........#",
  "#.#.#   #.#.#", "#.#..   ..#.#", "#.#.#   #.#.#", "#...........#",
  "#.#.#.#.#.#.#", "#...........#", "#.###.#.###.#", "#.o...#...o.#",
  "#.#.#.#.#.#.#", "#.....P.....#", "#############",
];
const L3: string[] = [
  "#############", "#.o.......o.#", "#.#.#.#.#.#.#", "#.....#.....#",
  "#.#.#.#.#.#.#", "#.....#.....#", "#.###.#.###.#", "#.....#.....#",
  "#.#.#   #.#.#", "T.#..   ..#.T", "#.#.#   #.#.#", "#.#.......#.#",
  "#.#.#.#.#.#.#", "#.#...#...#.#", "#.#.#####.#.#", "#.#.......#.#",
  "#o#.#.#.#.#o#", "#.....P.....#", "#############",
];
const L4: string[] = [
  "#############", "#.o...#...o.#", "#.#.#.#.#.#.#", "#.#...#...#.#",
  "#.#.#.#.#.#.#", "#.#...#...#.#", "#.#.#.#.#.#.#", "#...#.#.#...#",
  "#.#.#   #.#.#", "T...#   #...T", "#.#.#   #.#.#", "#.#...#...#.#",
  "#.#.#.#.#.#.#", "#...#...#...#", "#.#.#.#.#.#.#", "#.o.#.#.#.o.#",
  "#.#.#.#.#.#.#", "#.....P.....#", "#############",
];
const L5: string[] = [
  "#############", "#.o...#...o.#", "#.#.#.#.#.#.#", "#...=...=...#",
  "#.#.#####.#.#", "#.#.......#.#", "#.#.#.#.#.#.#", "#...#...#...#",
  "#.#.#   #.#.#", "#....   ....#", "#.#.#   #.#.#", "#...........#",
  "#.###.#.###.#", "#.....#.....#", "#.#.#.#.#.#.#", "#.#...#...#.#",
  "#o##=.#.=##o#", "#.....P.....#", "#############",
];
const L6: string[] = [
  "#############", "#.o.......o.#", "#.#.#.#.#.#.#", "#.....#.....#",
  "#.#.#.#.#.#.#", "#.#...#...#.#", "#.#.#.#.#.#.#", "#...#...#...#",
  "#.#.=   =.#.#", "T....   ....T", "#.##=   =##.#", "#...........#",
  "#.#.#.#.#.#.#", "#...#...#...#", "#.#.#.#.#.#.#", "#.#.......#.#",
  "#o#.#####.#o#", "#.....P.....#", "#############",
];
const L7: string[] = [
  "#############", "#.o.......o.#", "#.###.#.###.#", "#.....#.....#",
  "#.#.#.#.#.#.#", "#.....#.....#", "#.#.#.#.#.#.#", "#.#...#...#.#",
  "#.#.#   #.#.#", "T....   ....T", "#.#.#   #.#.#", "#...........#",
  "#.#.=.#.=.#.#", "#.....#.....#", "#.=.#.#.#.=.#", "#.o.#...#.o.#",
  "#.#.#.#.#.#.#", "#.....P.....#", "#############",
];
const BASE_LAYOUTS: string[][] = [L0, L1, L2, L3, L4, L5, L6, L7];

const flipV = (g: string[]): string[] => [...g].reverse();

const ROWS = L0.length;        // 19
const COLS = L0[0].length;     // 13
const CAMPAIGN = 16;           // unique levels before the NG+ loop repeats shapes
const CX = Math.floor(COLS / 2);
const LIVES_START = 3;

// Bonus "rush" round every N cleared levels; power-up / effect durations (ticks).
const RUSH_EVERY = 4;
const RUSH_TICKS = 150;
const RUSH_PELLET_PTS = 25;
const GATE_PERIOD = 46;        // ticks per moving-gate open/close half-cycle
const DASH_TICKS = 64;
const FREEZE_TICKS = 52;
const DOUBLE_TICKS = 110;
const DEATH_TICKS = 14;        // death-animation freeze
const DARK_R = 2.7;            // lit radius (cells) in the dark-maze modifier

// --- themed stages: palette wash + accent + modifier flags -------------------
type Theme = {
  name: string;
  wash: string;    // translucent board overlay
  accent: string;  // pellet / HUD accent
  dark: boolean;   // dark-maze modifier
  hunter: boolean; // milestone: spawn the Hunter mini-boss
};
const THEMES: Theme[] = [
  { name: "CLASSIC", wash: "rgba(0,0,0,0)",        accent: "#00E5FF", dark: false, hunter: false },
  { name: "NEON",    wash: "rgba(255,0,170,0.08)", accent: "#FF4D8D", dark: false, hunter: false },
  { name: "ICE",     wash: "rgba(0,229,255,0.10)", accent: "#8CF4FF", dark: false, hunter: false },
  { name: "CIRCUIT", wash: "rgba(91,209,107,0.09)",accent: "#5BD16B", dark: false, hunter: true },
  { name: "HAUNTED", wash: "rgba(130,80,200,0.14)",accent: "#B07CFF", dark: true,  hunter: false },
  { name: "CORE",    wash: "rgba(255,82,71,0.10)", accent: "#FF9800", dark: false, hunter: true },
  { name: "VOID",    wash: "rgba(16,26,70,0.20)",  accent: "#00E5FF", dark: true,  hunter: false },
  { name: "SOLAR",   wash: "rgba(255,152,0,0.10)", accent: "#FF9800", dark: false, hunter: true },
];

const campaignLevel = (lvl: number) => (lvl - 1) % CAMPAIGN;          // 0..15
const stageIndexFor = (lvl: number) => Math.floor(campaignLevel(lvl) / 2); // 0..7
const loopFor = (lvl: number) => Math.floor((lvl - 1) / CAMPAIGN);
const themeFor = (lvl: number): Theme => THEMES[stageIndexFor(lvl)];

// --- owned sprites -----------------------------------------------------------
const WALL_IMGS = [
  require("../../assets/arcade/maze/wall_00.png"), require("../../assets/arcade/maze/wall_01.png"),
  require("../../assets/arcade/maze/wall_02.png"), require("../../assets/arcade/maze/wall_03.png"),
  require("../../assets/arcade/maze/wall_04.png"), require("../../assets/arcade/maze/wall_05.png"),
  require("../../assets/arcade/maze/wall_06.png"), require("../../assets/arcade/maze/wall_07.png"),
  require("../../assets/arcade/maze/wall_08.png"), require("../../assets/arcade/maze/wall_09.png"),
  require("../../assets/arcade/maze/wall_10.png"), require("../../assets/arcade/maze/wall_11.png"),
  require("../../assets/arcade/maze/wall_12.png"), require("../../assets/arcade/maze/wall_13.png"),
  require("../../assets/arcade/maze/wall_14.png"), require("../../assets/arcade/maze/wall_15.png"),
];
const FLOOR_IMGS = [
  require("../../assets/arcade/maze/floor_0.png"),
  require("../../assets/arcade/maze/floor_1.png"),
  require("../../assets/arcade/maze/floor_2.png"),
];
const PELLET_IMG = require("../../assets/arcade/maze/pellet.png");
const POWER_IMGS = [
  require("../../assets/arcade/maze/power_0.png"),
  require("../../assets/arcade/maze/power_1.png"),
];
const MUNCH: Record<string, ReturnType<typeof require>> = {
  closed: require("../../assets/arcade/maze/muncher_closed.png"),
  r: require("../../assets/arcade/maze/muncher_r.png"),
  l: require("../../assets/arcade/maze/muncher_l.png"),
  u: require("../../assets/arcade/maze/muncher_u.png"),
  d: require("../../assets/arcade/maze/muncher_d.png"),
};
const GHOST_COLORS = ["rose", "teal", "lime", "amber"] as const;
const GHOST_IMGS: Record<string, ReturnType<typeof require>[]> = {
  rose: [require("../../assets/arcade/maze/ghost_rose_0.png"), require("../../assets/arcade/maze/ghost_rose_1.png")],
  teal: [require("../../assets/arcade/maze/ghost_teal_0.png"), require("../../assets/arcade/maze/ghost_teal_1.png")],
  lime: [require("../../assets/arcade/maze/ghost_lime_0.png"), require("../../assets/arcade/maze/ghost_lime_1.png")],
  amber: [require("../../assets/arcade/maze/ghost_amber_0.png"), require("../../assets/arcade/maze/ghost_amber_1.png")],
};
const FRIGHT_IMGS = [
  require("../../assets/arcade/maze/ghost_fright_0.png"),
  require("../../assets/arcade/maze/ghost_fright_1.png"),
];
const HUNTER_IMGS = [
  require("../../assets/arcade/maze/ghost_hunter_0.png"),
  require("../../assets/arcade/maze/ghost_hunter_1.png"),
];
const EYES_IMG = require("../../assets/arcade/maze/ghost_eyes.png");
const FRUIT_IMGS = [
  require("../../assets/arcade/maze/fruit_0.png"),
  require("../../assets/arcade/maze/fruit_1.png"),
  require("../../assets/arcade/maze/fruit_2.png"),
];
const GATE_IMG = require("../../assets/arcade/maze/gate.png");
type ItemType = "fruit" | "dash" | "freeze" | "life" | "double";
const ITEM_IMGS: Record<Exclude<ItemType, "fruit">, ReturnType<typeof require>> = {
  dash: require("../../assets/arcade/maze/item_dash.png"),
  freeze: require("../../assets/arcade/maze/item_freeze.png"),
  life: require("../../assets/arcade/maze/item_life.png"),
  double: require("../../assets/arcade/maze/item_double.png"),
};

type GhostKind = "chaser" | "ambusher" | "flanker" | "patroller" | "hunter";
const KIND_BY_IDX: GhostKind[] = ["chaser", "ambusher", "flanker", "patroller"];
type Enemy = {
  r: number; c: number; dx: number; dy: number;
  spawn: Pos; corner: Pos; idx: number; kind: GhostKind;
  frightened: boolean; eaten: boolean;
};
type Item = { r: number; c: number; type: ItemType; ttl: number; variant: number };
type Facing = "r" | "l" | "u" | "d";
type Phase = "ready" | "playing" | "paused" | "clear" | "over";

const UP: Dir = { dx: 0, dy: -1 };
const LEFT: Dir = { dx: -1, dy: 0 };
const DOWN: Dir = { dx: 0, dy: 1 };
const RIGHT: Dir = { dx: 1, dy: 0 };
const DIRS: Dir[] = [UP, LEFT, DOWN, RIGHT]; // classic tie-break order

const key = (r: number, c: number): string => `${r},${c}`;

// Structural wall only ('#'), used for the autotile mask so gates/tunnels read
// as openings in the wall ribbon.
function isWall(grid: string[], r: number, c: number): boolean {
  if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return true;
  return grid[r][c] === "#";
}
// Whether a cell blocks movement right now (gates block only while closed).
function cellBlocked(grid: string[], r: number, c: number, gatesOpen: boolean): boolean {
  if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return true;
  const ch = grid[r][c];
  if (ch === "#") return true;
  if (ch === "=") return !gatesOpen;
  return false;
}
// Attempt a one-cell move with warp-tunnel wrapping; null if blocked.
function tryMove(grid: string[], r: number, c: number, d: Dir, gatesOpen: boolean, tunnelRows: Set<number>): Pos | null {
  let nr = r + d.dy;
  let nc = c + d.dx;
  if (nc < 0) { if (tunnelRows.has(r)) nc = COLS - 1; else return null; }
  else if (nc >= COLS) { if (tunnelRows.has(r)) nc = 0; else return null; }
  if (cellBlocked(grid, nr, nc, gatesOpen)) return null;
  return { r: nr, c: nc };
}

function buildMaze(grid: string[]): MazeDef {
  let player: Pos = { r: 1, c: 1 };
  const open: Pos[] = [];
  const gates: string[] = [];
  const tunnelRows: number[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const ch = grid[r][c];
      if (ch === "P") player = { r, c };
      if (ch === "=") gates.push(key(r, c));
      if (ch === "T" && (c === 0 || c === COLS - 1) && !tunnelRows.includes(r)) tunnelRows.push(r);
      if (ch !== "#" && ch !== "=") open.push({ r, c });
    }
  const cr = Math.floor(ROWS / 2), cc = Math.floor(COLS / 2);
  const d2 = (p: Pos, tr: number, tc: number) => (p.r - tr) ** 2 + (p.c - tc) ** 2;
  const homes = [...open]
    .filter((p) => !(p.r === player.r && p.c === player.c))
    .sort((a, b) => d2(a, cr, cc) - d2(b, cr, cc))
    .slice(0, 5);
  const targets: [number, number][] = [
    [1, 1], [1, COLS - 2], [ROWS - 2, 1], [ROWS - 2, COLS - 2],
  ];
  const corners = targets.map(([tr, tc]) =>
    open.reduce((best, p) => (d2(p, tr, tc) < d2(best, tr, tc) ? p : best), open[0]));
  return { grid, player, homes, corners, gates, tunnelRows };
}

// Precompute the 16 campaign mazes: base%8 with orientation (0 normal, 1 flipV).
const MAZES: MazeDef[] = Array.from({ length: CAMPAIGN }, (_, cl) => {
  const base = BASE_LAYOUTS[cl % 8];
  const ori = Math.floor(cl / 8) % 2;
  return buildMaze(ori === 1 ? flipV(base) : base);
});

// Open, pellet-filled rush maze (no ghosts, no power-pellets): a pillar lattice.
const RUSH_MAZE: MazeDef = (() => {
  const g: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    if (r === 0 || r === ROWS - 1) { g.push("#".repeat(COLS)); continue; }
    let row = "";
    for (let c = 0; c < COLS; c++) {
      if (c === 0 || c === COLS - 1) row += "#";
      else if (r % 2 === 0 && c % 2 === 0) row += "#"; // pillar
      else row += ".";
    }
    g.push(row);
  }
  const pr = ROWS - 2, pc = CX;
  g[pr] = g[pr].substring(0, pc) + "P" + g[pr].substring(pc + 1);
  return buildMaze(g);
})();

function initPellets(grid: string[]): { pellets: Set<string>; powers: Set<string> } {
  const pellets = new Set<string>();
  const powers = new Set<string>();
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === ".") pellets.add(key(r, c));
      else if (grid[r][c] === "o") powers.add(key(r, c));
    }
  return { pellets, powers };
}

// difficulty ramp (climbs across NG+ loops since `level` keeps rising, then caps)
const enemyCount = (level: number) => Math.min(2 + (level - 1), 4);
const tickMs = (level: number) => Math.max(100, 190 - (level - 1) * 10);
const scatterTicks = (level: number) => Math.max(6, 30 - (level - 1) * 3);
const chaseTicks = (level: number) => 55 + (level - 1) * 12;
const frightTicks = (level: number) => Math.max(16, 64 - (level - 1) * 5);

function rotatedDirs(idx: number): Dir[] {
  const off = idx % 4;
  return DIRS.map((_, i) => DIRS[(i + off) % 4]);
}
const dist2 = (ar: number, ac: number, br: number, bc: number): number =>
  (ar - br) * (ar - br) + (ac - bc) * (ac - bc);

function Screen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useSettings();
  const { width: winW, height: winH } = useWindowDimensions();
  const fx = useRef<EffectsHandle>(null);

  // ---- maximise the playfield: largest integer CELL that fits the usable area
  const HUD_H = 58;
  const DPAD_H = 168;
  const gutter = 8;
  const usableW = winW - gutter * 2;
  const usableH = Math.max(120, winH - insets.top - insets.bottom - HUD_H - DPAD_H);
  const CELL = Math.max(14, Math.floor(Math.min(usableW / COLS, usableH / ROWS)));
  const BOARD_W = CELL * COLS;
  const BOARD_H = CELL * ROWS;
  const cellRef = useRef(CELL);
  cellRef.current = CELL;
  const px = (c: number) => (c + 0.5) * cellRef.current;
  const py = (r: number) => (r + 0.5) * cellRef.current;

  // ---- deterministic simulation refs -------------------------------------
  const levelRef = useRef(1);
  const mazeRef = useRef<MazeDef>(MAZES[0]);
  const tunnelRowsRef = useRef<Set<number>>(new Set(MAZES[0].tunnelRows));
  const playerRef = useRef<Pos>({ ...MAZES[0].player });
  const dirRef = useRef<Dir>({ dx: 0, dy: 0 });
  const nextDirRef = useRef<Dir>({ dx: 0, dy: 0 });
  const facingRef = useRef<Facing>("l");
  const enemiesRef = useRef<Enemy[]>([]);
  const pelletsRef = useRef<Set<string>>(new Set());
  const powersRef = useRef<Set<string>>(new Set());
  const totalPelletsRef = useRef(1);
  const stepRef = useRef(0);
  const modeRef = useRef<"scatter" | "chase">("scatter");
  const modeCountRef = useRef(0);
  const frightRef = useRef(0);
  const frightMaxRef = useRef(1);
  const comboRef = useRef(0);
  const gateOpenRef = useRef(true);
  const livesRef = useRef(LIVES_START);
  // fresh mechanics
  const itemRef = useRef<Item | null>(null);
  const itemsSpawnedRef = useRef(0);
  const itemThreshRef = useRef<number[]>([9999, 9999]);
  const fruitCellRef = useRef<Pos>({ r: 11, c: CX });
  const dashRef = useRef(0);
  const freezeRef = useRef(0);
  const doubleRef = useRef(0);
  const deathTimerRef = useRef(0);
  // rush round + clear bookkeeping
  const rushRef = useRef(false);
  const rushTimerRef = useRef(0);
  const pendingRushRef = useRef(false);
  const clearKindRef = useRef<"level" | "rush">("level");
  const bonusRef = useRef(0);
  const phaseRef = useRef<Phase>("ready");

  const [, setFrame] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(LIVES_START);
  const [level, setLevel] = useState(1);
  const bump = () => setFrame((f) => (f + 1) % 1000000);
  const addScore = (n: number) => setScore((s) => s + n);
  const mult = () => (doubleRef.current > 0 ? 2 : 1);

  function openBonusCell(maze: MazeDef): Pos {
    const tr = Math.floor(ROWS / 2) + 2;
    let best = maze.player; let bd = Infinity;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const ch = maze.grid[r][c];
        if (ch === "." || ch === " ") {
          const d = (r - tr) ** 2 + (c - CX) ** 2;
          if (d < bd) { bd = d; best = { r, c }; }
        }
      }
    return best;
  }

  function spawnEnemies(maze: MazeDef, lvl: number): Enemy[] {
    const n = enemyCount(lvl);
    const out: Enemy[] = [];
    for (let i = 0; i < n; i++) {
      const home = maze.homes[i % maze.homes.length];
      out.push({
        r: home.r, c: home.c, dx: 0, dy: 0,
        spawn: { ...home }, corner: maze.corners[i % maze.corners.length],
        idx: i, kind: KIND_BY_IDX[i % 4], frightened: false, eaten: false,
      });
    }
    if (themeFor(lvl).hunter) {
      const home = maze.homes[Math.min(4, maze.homes.length - 1)];
      out.push({
        r: home.r, c: home.c, dx: 0, dy: 0,
        spawn: { ...home }, corner: maze.corners[0],
        idx: 4, kind: "hunter", frightened: false, eaten: false,
      });
    }
    return out;
  }

  function resetTimers() {
    stepRef.current = 0;
    modeRef.current = "scatter";
    modeCountRef.current = 0;
    frightRef.current = 0;
    comboRef.current = 0;
    dashRef.current = 0;
    freezeRef.current = 0;
    doubleRef.current = 0;
    deathTimerRef.current = 0;
    gateOpenRef.current = true;
  }

  function loadLevel(lvl: number) {
    const maze = MAZES[campaignLevel(lvl)];
    mazeRef.current = maze;
    tunnelRowsRef.current = new Set(maze.tunnelRows);
    const { pellets, powers } = initPellets(maze.grid);
    pelletsRef.current = pellets;
    powersRef.current = powers;
    totalPelletsRef.current = Math.max(1, pellets.size);
    itemThreshRef.current = [Math.floor(pellets.size * 0.35), Math.floor(pellets.size * 0.7)];
    itemsSpawnedRef.current = 0;
    itemRef.current = null;
    fruitCellRef.current = openBonusCell(maze);
    playerRef.current = { ...maze.player };
    dirRef.current = { dx: 0, dy: 0 };
    nextDirRef.current = { dx: 0, dy: 0 };
    facingRef.current = "l";
    enemiesRef.current = spawnEnemies(maze, lvl);
    rushRef.current = false;
    resetTimers();
  }

  const didInit = useRef(false);
  if (!didInit.current) { didInit.current = true; loadLevel(1); }

  function resetAfterDeath() {
    const maze = mazeRef.current;
    playerRef.current = { ...maze.player };
    dirRef.current = { dx: 0, dy: 0 };
    nextDirRef.current = { dx: 0, dy: 0 };
    facingRef.current = "l";
    enemiesRef.current = spawnEnemies(maze, levelRef.current);
    itemRef.current = null;
    resetTimers();
  }

  function startRush() {
    rushRef.current = true;
    mazeRef.current = RUSH_MAZE;
    tunnelRowsRef.current = new Set();
    const { pellets } = initPellets(RUSH_MAZE.grid);
    pelletsRef.current = pellets;
    powersRef.current = new Set();
    totalPelletsRef.current = Math.max(1, pellets.size);
    playerRef.current = { ...RUSH_MAZE.player };
    dirRef.current = { dx: 0, dy: 0 };
    nextDirRef.current = { dx: 0, dy: 0 };
    facingRef.current = "l";
    enemiesRef.current = [];
    itemRef.current = null;
    resetTimers();
    rushTimerRef.current = RUSH_TICKS;
    phaseRef.current = "playing"; setPhase("playing"); bump();
  }

  function fullRestart() {
    levelRef.current = 1;
    livesRef.current = LIVES_START;
    loadLevel(1);
    fx.current?.clear();
    setLevel(1); setScore(0); setLives(LIVES_START);
    phaseRef.current = "playing"; setPhase("playing"); bump();
  }

  function nextLevel() {
    levelRef.current += 1;
    loadLevel(levelRef.current);
    fx.current?.clear();
    setLevel(levelRef.current);
    phaseRef.current = "playing"; setPhase("playing"); bump();
  }

  function onClearPrimary() {
    if (clearKindRef.current === "level" && pendingRushRef.current) {
      pendingRushRef.current = false;
      startRush();
    } else {
      nextLevel();
    }
  }

  const setDir = (d: Dir) => { nextDirRef.current = d; };

  // ---- main loop ---------------------------------------------------------
  useEffect(() => {
    let id: ReturnType<typeof setInterval>;
    let curTick = tickMs(levelRef.current);
    const arm = () => { id = setInterval(stepGame, curTick); };

    function movePlayer(grid: string[], gatesOpen: boolean, tunnelRows: Set<number>) {
      const p = playerRef.current;
      const nd = nextDirRef.current;
      if ((nd.dx !== 0 || nd.dy !== 0) && tryMove(grid, p.r, p.c, nd, gatesOpen, tunnelRows)) {
        dirRef.current = nd;
      }
      const d = dirRef.current;
      const np = tryMove(grid, p.r, p.c, d, gatesOpen, tunnelRows);
      if (np) {
        p.r = np.r; p.c = np.c;
        if (d.dx > 0) facingRef.current = "r";
        else if (d.dx < 0) facingRef.current = "l";
        else if (d.dy > 0) facingRef.current = "d";
        else if (d.dy < 0) facingRef.current = "u";
      }
    }

    function eatAt() {
      const p = playerRef.current;
      const pk = key(p.r, p.c);
      if (pelletsRef.current.has(pk)) {
        pelletsRef.current.delete(pk);
        addScore(10 * mult());
        fx.current?.burst(px(p.c), py(p.r), { count: 4, color: themeFor(levelRef.current).accent, speed: 70, size: 4, rise: 8 });
      }
      if (powersRef.current.has(pk)) {
        powersRef.current.delete(pk);
        addScore(50 * mult());
        fx.current?.burst(px(p.c), py(p.r), { count: 16, color: "#FF9800", speed: 150, size: 6 });
        const ft = frightTicks(levelRef.current);
        frightRef.current = ft;
        frightMaxRef.current = ft;
        comboRef.current = 0;
        enemiesRef.current.forEach((e) => {
          if (!e.eaten) { e.frightened = true; e.dx = -e.dx; e.dy = -e.dy; }
        });
      }
    }

    function spawnItem() {
      const slot = itemsSpawnedRef.current;
      let type: ItemType;
      if (slot === 0) type = "fruit";
      else if (levelRef.current % 4 === 0 && livesRef.current < 5) type = "life";
      else type = (["dash", "freeze", "double"] as ItemType[])[(levelRef.current - 1) % 3];
      const cell = fruitCellRef.current;
      itemRef.current = { r: cell.r, c: cell.c, type, ttl: 130, variant: stageIndexFor(levelRef.current) % 3 };
      itemsSpawnedRef.current += 1;
    }

    function collectItem() {
      const it = itemRef.current;
      if (!it) return;
      itemRef.current = null;
      const p = playerRef.current;
      const col = it.type === "freeze" ? "#00E5FF" : "#FF9800";
      if (it.type === "fruit") {
        const pts = 100 * (stageIndexFor(levelRef.current) + 1) * mult();
        addScore(pts);
        fx.current?.popScore(px(p.c), py(p.r), `+${pts}`, "#FF9800");
      } else if (it.type === "dash") {
        dashRef.current = DASH_TICKS;
        fx.current?.popScore(px(p.c), py(p.r), "DASH!", "#FF9800");
      } else if (it.type === "freeze") {
        freezeRef.current = FREEZE_TICKS;
        fx.current?.popScore(px(p.c), py(p.r), "FREEZE!", "#00E5FF");
      } else if (it.type === "double") {
        doubleRef.current = DOUBLE_TICKS;
        fx.current?.popScore(px(p.c), py(p.r), "2x PTS", "#FF9800");
      } else if (it.type === "life") {
        livesRef.current += 1;
        setLives((v) => v + 1);
        fx.current?.popScore(px(p.c), py(p.r), "+1 LIFE", "#5BD16B");
      }
      fx.current?.burst(px(p.c), py(p.r), { count: 14, color: col, speed: 140, size: 6 });
    }

    function updateItem() {
      if (!itemRef.current && itemsSpawnedRef.current < 2) {
        const eaten = totalPelletsRef.current - pelletsRef.current.size;
        if (eaten >= itemThreshRef.current[itemsSpawnedRef.current]) spawnItem();
      }
      const it = itemRef.current;
      if (it) {
        const p = playerRef.current;
        if (it.r === p.r && it.c === p.c) { collectItem(); return; }
        it.ttl -= 1;
        if (it.ttl <= 0) itemRef.current = null;
      }
    }

    function updateModes() {
      if (frightRef.current > 0) {
        frightRef.current -= 1;
        if (frightRef.current <= Math.floor(frightMaxRef.current * 0.45)) {
          // Hunter shakes off fright early (short resistance)
          enemiesRef.current.forEach((e) => { if (e.kind === "hunter" && !e.eaten) e.frightened = false; });
        }
        if (frightRef.current === 0) {
          enemiesRef.current.forEach((e) => { e.frightened = false; });
          comboRef.current = 0;
        }
      } else {
        modeCountRef.current += 1;
        const limit = modeRef.current === "scatter"
          ? scatterTicks(levelRef.current) : chaseTicks(levelRef.current);
        if (modeCountRef.current >= limit) {
          modeRef.current = modeRef.current === "scatter" ? "chase" : "scatter";
          modeCountRef.current = 0;
        }
      }
    }

    // returns true if the player died (death animation started)
    function checkCollisions(): boolean {
      const p = playerRef.current;
      let killer = false;
      const toEat: Enemy[] = [];
      for (const e of enemiesRef.current) {
        if (e.r !== p.r || e.c !== p.c) continue;
        if (e.eaten) continue;
        if (e.frightened) toEat.push(e);
        else killer = true;
      }
      if (killer) { onDeathStart(); return true; }
      for (const e of toEat) {
        let pts: number;
        if (e.kind === "hunter") pts = 2000 * mult();
        else {
          pts = 200 * Math.pow(2, Math.min(comboRef.current, 3)) * mult();
          comboRef.current += 1;
        }
        addScore(pts);
        fx.current?.burst(px(e.c), py(e.r), { count: 14, color: "#FF4D8D", speed: 150, size: 6 });
        fx.current?.popScore(px(e.c), py(e.r), `+${pts}`, "#FF4D8D");
        e.eaten = true; e.frightened = false; e.dx = 0; e.dy = 0;
      }
      return false;
    }

    function moveEnemies(grid: string[], gatesOpen: boolean, tunnelRows: Set<number>) {
      const p = playerRef.current;
      const pd = dirRef.current;
      const chaser = enemiesRef.current.find((e) => e.idx === 0);
      enemiesRef.current = enemiesRef.current.map((e) => {
        // eyes that have reached home revive
        if (e.eaten && e.r === e.spawn.r && e.c === e.spawn.c) {
          return { ...e, eaten: false, frightened: false, dx: 0, dy: 0 };
        }
        const period = e.eaten ? 1 : e.kind === "hunter" ? (e.frightened ? 2 : 1) : (e.frightened ? 3 : 2);
        if (stepRef.current % period !== 0) return e;

        const feasible = DIRS
          .map((d) => ({ d, np: tryMove(grid, e.r, e.c, d, gatesOpen, tunnelRows) }))
          .filter((x): x is { d: Dir; np: Pos } => x.np !== null);
        if (feasible.length === 0) return e;
        let pool = feasible.filter((x) => !(x.d.dx === -e.dx && x.d.dy === -e.dy));
        if (pool.length === 0) pool = feasible;

        let tr: number, tc: number;
        if (e.eaten) { tr = e.spawn.r; tc = e.spawn.c; }
        else if (e.frightened) { tr = p.r; tc = p.c; }
        else if (modeRef.current === "scatter" && e.kind !== "hunter") { tr = e.corner.r; tc = e.corner.c; }
        else if (e.kind === "chaser" || e.kind === "hunter") { tr = p.r; tc = p.c; }
        else if (e.kind === "ambusher") { tr = p.r + pd.dy * 4; tc = p.c + pd.dx * 4; }
        else if (e.kind === "flanker") {
          const pivR = p.r + pd.dy * 2, pivC = p.c + pd.dx * 2;
          const cr = chaser ? chaser.r : p.r, cc = chaser ? chaser.c : p.c;
          tr = 2 * pivR - cr; tc = 2 * pivC - cc;
        } else { // patroller: chase when far, retreat to corner when close
          const far = dist2(e.r, e.c, p.r, p.c) > 49;
          tr = far ? p.r : e.corner.r;
          tc = far ? p.c : e.corner.c;
        }

        const order = rotatedDirs(e.idx);
        const prio = (d: Dir) => order.findIndex((o) => o.dx === d.dx && o.dy === d.dy);
        const flee = e.frightened && !e.eaten;
        pool.sort((a, b) => {
          const da = dist2(a.np.r, a.np.c, tr, tc), db = dist2(b.np.r, b.np.c, tr, tc);
          if (da !== db) return flee ? db - da : da - db;
          return prio(a.d) - prio(b.d);
        });
        const best = pool[0];
        return { ...e, r: best.np.r, c: best.np.c, dx: best.d.dx, dy: best.d.dy };
      });
    }

    function onDeathStart() {
      const pp = playerRef.current;
      fx.current?.burst(px(pp.c), py(pp.r), { count: 22, color: "#F4F7FB", speed: 180, size: 6, rise: 10 });
      fx.current?.burst(px(pp.c), py(pp.r), { count: 12, color: "#FF9800", speed: 110, size: 5 });
      dirRef.current = { dx: 0, dy: 0 };
      deathTimerRef.current = DEATH_TICKS;
      bump();
    }

    function applyDeath() {
      const nv = livesRef.current - 1;
      livesRef.current = nv;
      setLives(nv);
      if (nv <= 0) { phaseRef.current = "over"; setPhase("over"); }
      else resetAfterDeath();
    }

    function onLevelClear() {
      const p = playerRef.current;
      fx.current?.burst(px(p.c), py(p.r), { count: 20, color: "#00E5FF", speed: 160, size: 6 });
      const bonus = livesRef.current * 50 + (stageIndexFor(levelRef.current) + 1) * 100 + loopFor(levelRef.current) * 200;
      bonusRef.current = bonus;
      addScore(bonus);
      clearKindRef.current = "level";
      pendingRushRef.current = levelRef.current % RUSH_EVERY === 0;
      phaseRef.current = "clear"; setPhase("clear"); bump();
    }

    function stepRush(grid: string[], tunnelRows: Set<number>) {
      movePlayer(grid, true, tunnelRows);
      if (dashRef.current > 0) movePlayer(grid, true, tunnelRows);
      const p = playerRef.current;
      const pk = key(p.r, p.c);
      if (pelletsRef.current.has(pk)) {
        pelletsRef.current.delete(pk);
        addScore(RUSH_PELLET_PTS);
        fx.current?.burst(px(p.c), py(p.r), { count: 4, color: "#FF9800", speed: 80, size: 4, rise: 8 });
      }
      rushTimerRef.current -= 1;
      if (pelletsRef.current.size === 0 || rushTimerRef.current <= 0) {
        rushRef.current = false;
        clearKindRef.current = "rush";
        phaseRef.current = "clear"; setPhase("clear"); bump(); return;
      }
      bump();
    }

    function stepGame() {
      if (phaseRef.current !== "playing") return;

      const want = tickMs(levelRef.current);
      if (want !== curTick) { clearInterval(id); curTick = want; arm(); }

      if (deathTimerRef.current > 0) {
        deathTimerRef.current -= 1;
        if (deathTimerRef.current === 0) applyDeath();
        bump(); return;
      }

      stepRef.current += 1;
      const grid = mazeRef.current.grid;
      const tunnelRows = tunnelRowsRef.current;

      if (dashRef.current > 0) dashRef.current -= 1;
      if (freezeRef.current > 0) freezeRef.current -= 1;
      if (doubleRef.current > 0) doubleRef.current -= 1;

      if (rushRef.current) { stepRush(grid, tunnelRows); return; }

      const maze = mazeRef.current;
      const gatesOpen = maze.gates.length === 0 ? true : Math.floor(stepRef.current / GATE_PERIOD) % 2 === 1;
      gateOpenRef.current = gatesOpen;

      movePlayer(grid, gatesOpen, tunnelRows);
      if (dashRef.current > 0) movePlayer(grid, gatesOpen, tunnelRows);

      eatAt();
      updateItem();

      if (pelletsRef.current.size === 0 && powersRef.current.size === 0) { onLevelClear(); return; }

      updateModes();

      if (checkCollisions()) return;
      if (freezeRef.current === 0) moveEnemies(grid, gatesOpen, tunnelRows);
      if (checkCollisions()) return;

      bump();
    }

    arm();
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8,
      onPanResponderRelease: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        if (Math.abs(g.dx) > Math.abs(g.dy)) setDir({ dx: g.dx > 0 ? 1 : -1, dy: 0 });
        else if (Math.abs(g.dy) > 0) setDir({ dx: 0, dy: g.dy > 0 ? 1 : -1 });
      },
    })
  ).current;

  const togglePause = () => {
    if (phaseRef.current === "playing") { phaseRef.current = "paused"; setPhase("paused"); }
    else if (phaseRef.current === "paused") { phaseRef.current = "playing"; setPhase("playing"); }
  };
  const start = () => { phaseRef.current = "playing"; setPhase("playing"); bump(); };

  // static floor + wall layers — rebuilt only when CELL or the level changes
  const floorLayer = useMemo(() => {
    const cells: React.ReactNode[] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        cells.push(
          <View key={`f${r}-${c}`} style={{ position: "absolute", left: c * CELL, top: r * CELL }}>
            <Sprite source={FLOOR_IMGS[(r * 7 + c * 3) % FLOOR_IMGS.length]} size={CELL} />
          </View>
        );
    return cells;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [CELL]);

  const wallLayer = useMemo(() => {
    const grid = mazeRef.current.grid;
    const cells: React.ReactNode[] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c] === "#") {
          let m = 0;
          if (isWall(grid, r - 1, c)) m |= 1; // N
          if (isWall(grid, r, c + 1)) m |= 2; // E
          if (isWall(grid, r + 1, c)) m |= 4; // S
          if (isWall(grid, r, c - 1)) m |= 8; // W
          cells.push(
            <View key={`w${r}-${c}`} style={{ position: "absolute", left: c * CELL, top: r * CELL }}>
              <Sprite source={WALL_IMGS[m]} size={CELL} />
            </View>
          );
        }
    return cells;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [CELL, level, phase]);

  const maze = mazeRef.current;
  const theme = themeFor(level);
  const p = playerRef.current;
  const enemies = enemiesRef.current;
  const pelletSize = Math.round(CELL * 0.4);
  const powerSize = Math.round(CELL * 0.9);
  const itemSize = Math.round(CELL * 0.9);
  const animF = stepRef.current % 2;
  const moving = dirRef.current.dx !== 0 || dirRef.current.dy !== 0;
  const dying = deathTimerRef.current > 0;
  const munchImg = dying ? MUNCH.closed : moving && animF === 0 ? MUNCH.closed : MUNCH[facingRef.current];
  const powerPulse = reducedMotion ? powerSize : powerSize + (animF === 0 ? 0 : Math.round(CELL * 0.08));
  const gatesOpen = gateOpenRef.current;

  // active-effect / modifier HUD line
  const mods: string[] = [];
  if (maze.tunnelRows.length) mods.push("WARP");
  if (maze.gates.length) mods.push("GATES");
  if (theme.dark) mods.push("DARK");
  if (enemies.some((e) => e.kind === "hunter")) mods.push("HUNTER");
  const effBadges: string[] = [];
  if (dashRef.current > 0) effBadges.push("DASH");
  if (freezeRef.current > 0) effBadges.push("FREEZE");
  if (doubleRef.current > 0) effBadges.push("2x");

  // dark-maze occlusion window around the muncher
  const darkOverlay = theme.dark && phase === "playing" ? (() => {
    const cx = px(p.c), cy = py(p.r);
    const win = DARK_R * CELL;
    const dk = "rgba(3,6,12,0.92)";
    const left = Math.max(0, cx - win), right = Math.min(BOARD_W, cx + win);
    const top = Math.max(0, cy - win), bot = Math.min(BOARD_H, cy + win);
    return (
      <>
        <View style={{ position: "absolute", left: 0, top: 0, width: BOARD_W, height: top, backgroundColor: dk }} />
        <View style={{ position: "absolute", left: 0, top: bot, width: BOARD_W, height: BOARD_H - bot, backgroundColor: dk }} />
        <View style={{ position: "absolute", left: 0, top, width: left, height: bot - top, backgroundColor: dk }} />
        <View style={{ position: "absolute", left: right, top, width: BOARD_W - right, height: bot - top, backgroundColor: dk }} />
      </>
    );
  })() : null;

  return (
    <View style={st.fill}>
      <View style={[st.hud, { top: Math.max(insets.top, 20) + 6 }]} pointerEvents="box-none">
        <View style={st.hudPanel}>
          <PixelText size="score">{String(score).padStart(6, "0")}</PixelText>
          <PixelText size="label" style={{ marginTop: 3 }}>
            {rushRef.current ? `RUSH  ${Math.ceil(rushTimerRef.current / 6)}` : `LV ${level}  ${theme.name}`}  ♥{Math.max(0, lives)}
          </PixelText>
          {(mods.length > 0 || effBadges.length > 0) && (
            <PixelText size="label" style={{ marginTop: 3, color: theme.accent }}>
              {[...effBadges, ...mods].join(" ")}
            </PixelText>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <IconButton label="Pause" glyph={phase === "paused" ? "▶" : "❚❚"} onPress={togglePause} />
          <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
        </View>
      </View>

      <View style={st.center}>
        <View style={[st.board, { width: BOARD_W, height: BOARD_H }]} {...pan.panHandlers}>
          {floorLayer}
          {wallLayer}

          {/* moving gates (closed only) */}
          {maze.gates.map((kk) => {
            if (gatesOpen) return null;
            const [r, c] = kk.split(",").map(Number);
            return (
              <View key={`g${kk}`} style={{ position: "absolute", left: c * CELL, top: r * CELL }}>
                <Sprite source={GATE_IMG} size={CELL} />
              </View>
            );
          })}

          {Array.from(pelletsRef.current).map((kk) => {
            const [r, c] = kk.split(",").map(Number);
            return (
              <View key={`p${kk}`} style={{ position: "absolute", left: c * CELL + (CELL - pelletSize) / 2, top: r * CELL + (CELL - pelletSize) / 2 }}>
                <Sprite source={PELLET_IMG} size={pelletSize} />
              </View>
            );
          })}
          {Array.from(powersRef.current).map((kk) => {
            const [r, c] = kk.split(",").map(Number);
            return (
              <View key={`pw${kk}`} style={{ position: "absolute", left: c * CELL + (CELL - powerPulse) / 2, top: r * CELL + (CELL - powerPulse) / 2 }}>
                <Sprite source={POWER_IMGS[animF]} size={powerPulse} />
              </View>
            );
          })}

          {/* bonus item / power-up */}
          {itemRef.current && (
            <View style={{ position: "absolute", left: itemRef.current.c * CELL + (CELL - itemSize) / 2, top: itemRef.current.r * CELL + (CELL - itemSize) / 2 }}>
              <Sprite
                source={itemRef.current.type === "fruit" ? FRUIT_IMGS[itemRef.current.variant % FRUIT_IMGS.length] : ITEM_IMGS[itemRef.current.type]}
                size={itemSize}
              />
            </View>
          )}

          {enemies.map((e, i) => (
            <View key={`e${i}`} style={{ position: "absolute", left: e.c * CELL, top: e.r * CELL }}>
              <Sprite
                source={
                  e.eaten ? EYES_IMG
                    : e.frightened ? FRIGHT_IMGS[animF]
                    : e.kind === "hunter" ? HUNTER_IMGS[animF]
                    : GHOST_IMGS[GHOST_COLORS[e.idx % 4]][animF]
                }
                size={CELL}
              />
            </View>
          ))}

          <View style={{ position: "absolute", left: p.c * CELL, top: p.r * CELL }}>
            <Sprite source={munchImg} size={CELL} />
          </View>

          {darkOverlay}
          {theme.dark && phase === "playing" && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute", left: px(p.c) - CELL, top: py(p.r) - CELL, width: CELL * 2, height: CELL * 2,
                borderRadius: CELL, boxShadow: `0 0 ${CELL}px rgba(255,152,0,0.5)`,
              }}
            />
          )}
          {theme.wash !== "rgba(0,0,0,0)" && (
            <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: BOARD_W, height: BOARD_H, backgroundColor: theme.wash }} />
          )}

          <EffectsLayer ref={fx} reduced={reducedMotion} />
        </View>
      </View>

      <View style={st.dpad} pointerEvents="box-none">
        <ArcadeJoystick onDirection={(d) => setDir(d)} />
      </View>

      <GameOverlay
        visible={phase === "ready"} kind="pause" title="MAZE MUNCHER"
        primaryLabel="Start" onPrimary={start} onExit={onExit}
      >
        <Body muted style={{ textAlign: "center", marginTop: space.md }}>
          Swipe or use the stick to munch every coin. Grab a cyan gem to turn the
          hunters blue, then chain-eat them for combo points. Watch for fruit,
          power-ups, warp tunnels, moving gates — and the Hunter.
        </Body>
      </GameOverlay>

      <GameOverlay
        visible={phase === "paused"} kind="pause" title="PAUSED" score={`SCORE ${score}`}
        primaryLabel="Resume" onPrimary={togglePause} onExit={onExit}
      />

      <GameOverlay
        visible={phase === "clear"}
        kind="win"
        title={clearKindRef.current === "rush" ? "RUSH COMPLETE" : `LEVEL ${level} CLEAR`}
        score={`SCORE ${score}`}
        primaryLabel={clearKindRef.current === "level" && pendingRushRef.current ? "Bonus rush" : "Next level"}
        onPrimary={onClearPrimary}
        onExit={onExit}
      >
        <Body muted style={{ textAlign: "center", marginTop: space.md }}>
          {clearKindRef.current === "rush"
            ? "Pace break over — back into the maze."
            : `Clear bonus +${bonusRef.current}. ${pendingRushRef.current ? "Bonus rush round next!" : "Faster, hungrier hunters ahead."}`}
        </Body>
      </GameOverlay>

      <ScoreboardOverlay
        visible={phase === "over"} gameId="maze-muncher" score={score}
        scoreLabel={`SCORE ${score}`} onPlayAgain={fullRestart} onExit={onExit}
      />
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  board: { backgroundColor: "#090d14", borderRadius: radius.md, overflow: "hidden" },
  hud: {
    position: "absolute", left: 0, right: 0, zIndex: 10, paddingHorizontal: space.lg,
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
  },
  hudPanel: {
    backgroundColor: "rgba(20,26,34,0.7)", borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.sm,
    borderWidth: 1, borderColor: color.surfaceLine,
  },
  dpad: { position: "absolute", bottom: 24, left: 0, right: 0, alignItems: "center" },
});

export const mazeMuncherGame: GameModule = {
  id: "maze-muncher",
  title: "Maze Muncher",
  kind: "arcade",
  Screen,
};
