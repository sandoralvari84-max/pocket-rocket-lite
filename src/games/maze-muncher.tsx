import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  PanResponder,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, IconButton, GameOverlay, Sprite, Body } from "../design/ui";
import { ArcadeJoystick } from "../design/Joystick";

/* ----------------------------------------------------------------------------
 * Maze Muncher — Pac-Man-style muncher with DETERMINISTIC chase AI.
 *   - Enemies pursue the player by greedy tile-distance (no reverse), with a
 *     periodic scatter phase and a frightened/flee phase after a power-pellet.
 *   - Power-pellets, lives, two maze layouts, difficulty ramp on each clear.
 *   - ORIGINAL owned art (v3): chomping directional muncher, wobbling ghosts
 *     with a frightened state, neon bevel walls, floor tiles, pulsing orbs.
 *     Sprites generated in-repo via tools/art/gen_maze_art.py (CC0 / full rights).
 * All movement is grid-locked and RNG-free, so the sim is fully deterministic.
 * ------------------------------------------------------------------------- */

type Dir = { dx: number; dy: number };
type Pos = { r: number; c: number };
type MazeDef = { grid: string[]; player: Pos; homes: Pos[]; corners: Pos[] };

// '#' wall · '.' pellet · 'o' power-pellet · 'P' player start · ' ' empty floor
// 13 x 15, horizontally symmetric, flood-fill-verified fully connected.
const LAYOUT_A: string[] = [
  "#############",
  "#o..#...#..o#",
  "#.#.#.#.#.#.#",
  "#...........#",
  "#.#.#.#.#.#.#",
  "#.....#.....#",
  "#.##.###.##.#",
  "#.#...#...#.#",
  "#.#.#...#.#.#",
  "#...#.#.#...#",
  "#.#.#.#.#.#.#",
  "#.....#.....#",
  "#.#.#.#.#.#.#",
  "#o..#.P.#..o#",
  "#############",
];
const flipV = (g: string[]): string[] => [...g].reverse();
const LAYOUTS: string[][] = [LAYOUT_A, flipV(LAYOUT_A)];

const ROWS = LAYOUT_A.length;
const COLS = LAYOUT_A[0].length;

// Derive player / enemy homes / scatter corners from the grid so any valid
// layout works without hand-indexed coordinates.
function buildMaze(grid: string[]): MazeDef {
  let player: Pos = { r: 1, c: 1 };
  const open: Pos[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === "P") player = { r, c };
      if (grid[r][c] !== "#") open.push({ r, c });
    }
  const cr = Math.floor(ROWS / 2), cc = Math.floor(COLS / 2);
  const d2 = (p: Pos, tr: number, tc: number) => (p.r - tr) ** 2 + (p.c - tc) ** 2;
  const homes = [...open]
    .filter((p) => !(p.r === player.r && p.c === player.c))
    .sort((a, b) => d2(a, cr, cc) - d2(b, cr, cc))
    .slice(0, 4);
  const targets: [number, number][] = [
    [1, 1], [1, COLS - 2], [ROWS - 2, 1], [ROWS - 2, COLS - 2],
  ];
  const corners = targets.map(([tr, tc]) =>
    open.reduce((best, p) => (d2(p, tr, tc) < d2(best, tr, tc) ? p : best), open[0]));
  return { grid, player, homes, corners };
}
const MAZES: MazeDef[] = LAYOUTS.map(buildMaze);

const { width: W, height: H } = Dimensions.get("window");
const CHROME = 212; // top HUD + bottom d-pad allowance
const CELL = Math.max(16, Math.floor(Math.min((W - 8) / COLS, (H - CHROME) / ROWS)));
const BOARD_W = CELL * COLS;
const BOARD_H = CELL * ROWS;
const LIVES_START = 3;

// Original owned sprites (tools/art/gen_maze_art.py).
const WALL_IMG = require("../../assets/arcade/maze/wall.png");
const FLOOR_IMG = require("../../assets/arcade/maze/floor.png");
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

type Enemy = {
  r: number; c: number; dx: number; dy: number;
  spawn: Pos; corner: Pos; idx: number;
  frightened: boolean; eaten: boolean;
};
type Facing = "r" | "l" | "u" | "d";

const UP: Dir = { dx: 0, dy: -1 };
const LEFT: Dir = { dx: -1, dy: 0 };
const DOWN: Dir = { dx: 0, dy: 1 };
const RIGHT: Dir = { dx: 1, dy: 0 };
const DIRS: Dir[] = [UP, LEFT, DOWN, RIGHT]; // classic tie-break order

const key = (r: number, c: number): string => `${r},${c}`;

function isWall(grid: string[], r: number, c: number): boolean {
  if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return true;
  return grid[r][c] === "#";
}

function initPellets(grid: string[]): { pellets: Set<string>; powers: Set<string> } {
  const pellets = new Set<string>();
  const powers = new Set<string>();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === ".") pellets.add(key(r, c));
      else if (grid[r][c] === "o") powers.add(key(r, c));
    }
  }
  return { pellets, powers };
}

const enemyCount = (level: number) => Math.min(2 + (level - 1), 4);
const tickMs = (level: number) => Math.max(95, 175 - (level - 1) * 14);
const scatterTicks = (level: number) => Math.max(8, 30 - (level - 1) * 4);
const chaseTicks = (level: number) => 55 + (level - 1) * 15;
const frightTicks = (level: number) => Math.max(18, 60 - (level - 1) * 7);

function rotatedDirs(idx: number): Dir[] {
  const off = idx % 4;
  return DIRS.map((_, i) => DIRS[(i + off) % 4]);
}

const dist2 = (ar: number, ac: number, br: number, bc: number): number =>
  (ar - br) * (ar - br) + (ac - bc) * (ac - bc);

function Screen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();

  const levelRef = useRef(1);
  const mazeRef = useRef<MazeDef>(MAZES[0]);
  const playerRef = useRef<Pos>({ ...MAZES[0].player });
  const dirRef = useRef<Dir>({ dx: 0, dy: 0 });
  const nextDirRef = useRef<Dir>({ dx: 0, dy: 0 });
  const facingRef = useRef<Facing>("l");
  const enemiesRef = useRef<Enemy[]>([]);
  const pelletsRef = useRef<Set<string>>(new Set());
  const powersRef = useRef<Set<string>>(new Set());
  const stepRef = useRef(0);
  const modeRef = useRef<"scatter" | "chase">("scatter");
  const modeCountRef = useRef(0);
  const frightRef = useRef(0);
  const phaseRef = useRef<"ready" | "playing" | "paused" | "clear" | "over">("ready");

  const [, setFrame] = useState(0);
  const [phase, setPhase] = useState<"ready" | "playing" | "paused" | "clear" | "over">("ready");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(LIVES_START);
  const [level, setLevel] = useState(1);

  const bump = () => setFrame((f) => f + 1);

  function spawnEnemies(maze: MazeDef, lvl: number): Enemy[] {
    const n = enemyCount(lvl);
    const out: Enemy[] = [];
    for (let i = 0; i < n; i++) {
      const home = maze.homes[i % maze.homes.length];
      out.push({
        r: home.r, c: home.c, dx: 0, dy: 0,
        spawn: { ...home }, corner: maze.corners[i % maze.corners.length],
        idx: i, frightened: false, eaten: false,
      });
    }
    return out;
  }

  function loadLevel(lvl: number) {
    const maze = MAZES[(lvl - 1) % MAZES.length];
    mazeRef.current = maze;
    const { pellets, powers } = initPellets(maze.grid);
    pelletsRef.current = pellets;
    powersRef.current = powers;
    playerRef.current = { ...maze.player };
    dirRef.current = { dx: 0, dy: 0 };
    nextDirRef.current = { dx: 0, dy: 0 };
    facingRef.current = "l";
    enemiesRef.current = spawnEnemies(maze, lvl);
    stepRef.current = 0;
    modeRef.current = "scatter";
    modeCountRef.current = 0;
    frightRef.current = 0;
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
    stepRef.current = 0;
    modeRef.current = "scatter";
    modeCountRef.current = 0;
    frightRef.current = 0;
  }

  function fullRestart() {
    levelRef.current = 1;
    loadLevel(1);
    setLevel(1); setScore(0); setLives(LIVES_START);
    phaseRef.current = "playing"; setPhase("playing"); bump();
  }

  function nextLevel() {
    levelRef.current += 1;
    loadLevel(levelRef.current);
    setLevel(levelRef.current);
    phaseRef.current = "playing"; setPhase("playing"); bump();
  }

  const setDir = (d: Dir) => { nextDirRef.current = d; };

  // ---- main loop ---------------------------------------------------------
  useEffect(() => {
    let id: ReturnType<typeof setInterval>;
    let curTick = tickMs(levelRef.current);
    const arm = () => { id = setInterval(stepGame, curTick); };

    function stepGame() {
      if (phaseRef.current !== "playing") return;

      const want = tickMs(levelRef.current);
      if (want !== curTick) { clearInterval(id); curTick = want; arm(); }

      stepRef.current += 1;
      const grid = mazeRef.current.grid;
      const p = playerRef.current;

      const nd = nextDirRef.current;
      if ((nd.dx !== 0 || nd.dy !== 0) && !isWall(grid, p.r + nd.dy, p.c + nd.dx)) {
        dirRef.current = nd;
      }
      const d = dirRef.current;
      if ((d.dx !== 0 || d.dy !== 0) && !isWall(grid, p.r + d.dy, p.c + d.dx)) {
        p.r += d.dy; p.c += d.dx;
        if (d.dx > 0) facingRef.current = "r";
        else if (d.dx < 0) facingRef.current = "l";
        else if (d.dy > 0) facingRef.current = "d";
        else if (d.dy < 0) facingRef.current = "u";
      }

      const pk = key(p.r, p.c);
      if (pelletsRef.current.has(pk)) { pelletsRef.current.delete(pk); setScore((s) => s + 10); }
      if (powersRef.current.has(pk)) {
        powersRef.current.delete(pk);
        setScore((s) => s + 50);
        frightRef.current = frightTicks(levelRef.current);
        enemiesRef.current.forEach((e) => {
          if (!e.eaten) { e.frightened = true; e.dx = -e.dx; e.dy = -e.dy; }
        });
      }

      if (pelletsRef.current.size === 0 && powersRef.current.size === 0) {
        phaseRef.current = "clear"; setPhase("clear"); bump(); return;
      }

      if (frightRef.current > 0) {
        frightRef.current -= 1;
        if (frightRef.current === 0) enemiesRef.current.forEach((e) => { e.frightened = false; });
      } else {
        modeCountRef.current += 1;
        const limit = modeRef.current === "scatter"
          ? scatterTicks(levelRef.current) : chaseTicks(levelRef.current);
        if (modeCountRef.current >= limit) {
          modeRef.current = modeRef.current === "scatter" ? "chase" : "scatter";
          modeCountRef.current = 0;
        }
      }

      const collide = (): boolean => {
        for (const e of enemiesRef.current) {
          if (e.r === p.r && e.c === p.c) {
            if (e.frightened) {
              e.r = e.spawn.r; e.c = e.spawn.c; e.dx = 0; e.dy = 0; e.frightened = false;
              setScore((s) => s + 200);
            } else {
              return true;
            }
          }
        }
        return false;
      };

      if (collide()) { onDeath(); return; }

      enemiesRef.current = enemiesRef.current.map((e) => {
        const period = e.frightened ? 3 : 2;
        if (stepRef.current % period !== 0) return e;

        const options = DIRS.filter((o) => !isWall(grid, e.r + o.dy, e.c + o.dx));
        if (options.length === 0) return e;
        const nonRev = options.filter((o) => !(o.dx === -e.dx && o.dy === -e.dy));
        const pool = nonRev.length > 0 ? nonRev : options;

        // Four distinct personalities (deterministic): direct chaser, ambusher,
        // flanker/cut-off, and a shy one that peels off when it gets close.
        let tr: number, tc: number;
        const pd = dirRef.current;
        if (e.frightened) {
          tr = p.r; tc = p.c;                                 // flee (distance maximised)
        } else if (modeRef.current === "scatter") {
          tr = e.corner.r; tc = e.corner.c;
        } else if (e.idx === 0) {
          tr = p.r; tc = p.c;                                 // direct: straight at the player
        } else if (e.idx === 1) {
          tr = p.r + pd.dy * 4; tc = p.c + pd.dx * 4;         // ambush: 4 tiles ahead
        } else if (e.idx === 2) {
          tr = p.r + pd.dy * 2 + pd.dx * 2;                   // flank: ahead + to the side
          tc = p.c + pd.dx * 2 - pd.dy * 2;
        } else {
          const far = dist2(e.r, e.c, p.r, p.c) > 64;          // shy (>8 tiles): chase, else retreat
          tr = far ? p.r : e.corner.r;
          tc = far ? p.c : e.corner.c;
        }

        const order = rotatedDirs(e.idx).filter((o) => pool.some((o2) => o2.dx === o.dx && o2.dy === o.dy));
        let best = order[0];
        if (e.frightened) {
          let bestD = -Infinity;
          for (const o of order) { const dd = dist2(e.r + o.dy, e.c + o.dx, tr, tc); if (dd > bestD) { bestD = dd; best = o; } }
        } else {
          let bestD = Infinity;
          for (const o of order) { const dd = dist2(e.r + o.dy, e.c + o.dx, tr, tc); if (dd < bestD) { bestD = dd; best = o; } }
        }
        return { ...e, r: e.r + best.dy, c: e.c + best.dx, dx: best.dx, dy: best.dy };
      });

      if (collide()) { onDeath(); return; }

      bump();
    }

    function onDeath() {
      setLives((v) => {
        const nv = v - 1;
        if (nv <= 0) { phaseRef.current = "over"; setPhase("over"); }
        else resetAfterDeath();
        return nv;
      });
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

  // static floor + wall layers — re-memoised per level, not rebuilt each frame
  const floorLayer = useMemo(() => {
    const cells: React.ReactNode[] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        cells.push(
          <View key={`f${r}-${c}`} style={{ position: "absolute", left: c * CELL, top: r * CELL }}>
            <Sprite source={FLOOR_IMG} size={CELL} />
          </View>
        );
    return cells;
  }, []);

  const wallLayer = useMemo(() => {
    const grid = mazeRef.current.grid;
    const cells: React.ReactNode[] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c] === "#")
          cells.push(
            <View key={`w${r}-${c}`} style={{ position: "absolute", left: c * CELL, top: r * CELL }}>
              <Sprite source={WALL_IMG} size={CELL} />
            </View>
          );
    return cells;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  const p = playerRef.current;
  const enemies = enemiesRef.current;
  const pelletSize = Math.round(CELL * 0.4);
  const powerSize = Math.round(CELL * 0.9);
  const animF = stepRef.current % 2;
  const moving = dirRef.current.dx !== 0 || dirRef.current.dy !== 0;
  const munchImg = moving && animF === 0 ? MUNCH.closed : MUNCH[facingRef.current];

  return (
    <View style={st.fill}>
      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <View style={st.hudPanel}>
          <PixelText size="score">{String(score).padStart(5, "0")}</PixelText>
          <PixelText size="label" style={{ marginTop: 4 }}>
            LV {level}  LIVES {Math.max(0, lives)}
          </PixelText>
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
              <View key={`pw${kk}`} style={{ position: "absolute", left: c * CELL + (CELL - powerSize) / 2, top: r * CELL + (CELL - powerSize) / 2 }}>
                <Sprite source={POWER_IMGS[animF]} size={powerSize} />
              </View>
            );
          })}

          {enemies.map((e, i) => (
            <View key={`e${i}`} style={{ position: "absolute", left: e.c * CELL, top: e.r * CELL }}>
              <Sprite
                source={e.frightened ? FRIGHT_IMGS[animF] : GHOST_IMGS[GHOST_COLORS[e.idx % 4]][animF]}
                size={CELL}
              />
            </View>
          ))}

          <View style={{ position: "absolute", left: p.c * CELL, top: p.r * CELL }}>
            <Sprite source={munchImg} size={CELL} />
          </View>
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
          Swipe or use the D-pad to munch every coin. Grab a cyan gem to turn the
          hunters blue — then eat them. Avoid them otherwise.
        </Body>
      </GameOverlay>

      <GameOverlay
        visible={phase === "paused"} kind="pause" title="PAUSED" score={`SCORE ${score}`}
        primaryLabel="Resume" onPrimary={togglePause} onExit={onExit}
      />

      <GameOverlay
        visible={phase === "clear"} kind="win" title={`LEVEL ${level} CLEAR`} score={`SCORE ${score}`}
        primaryLabel="Next level" onPrimary={nextLevel} onExit={onExit}
      >
        <Body muted style={{ textAlign: "center", marginTop: space.md }}>
          Faster, hungrier hunters ahead.
        </Body>
      </GameOverlay>

      <GameOverlay
        visible={phase === "over"} kind="over" title="GAME OVER" score={`SCORE ${score}`}
        primaryLabel="Play again" onPrimary={fullRestart} onExit={onExit}
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
  dpad: { position: "absolute", bottom: 28, left: 0, right: 0, alignItems: "center" },
  padRow: { flexDirection: "row" },
  pad: {
    width: 60, height: 56, margin: 4, borderRadius: radius.md,
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine,
    alignItems: "center", justifyContent: "center",
  },
  padT: { color: color.text, fontSize: 22, fontWeight: "700" },
});

export const mazeMuncherGame: GameModule = {
  id: "maze-muncher",
  title: "Maze Muncher",
  kind: "arcade",
  Screen,
};
