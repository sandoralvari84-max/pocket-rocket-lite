import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable, Dimensions, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, GameOverlay } from "../design/ui";

// Owned sprite art for the fleet and firing markers.
const SHIP3_IMG = require("../../assets/arcade/fleet/ship3.png"); // horizontal 3-cell vessel (3:1)
const SHIP2_IMG = require("../../assets/arcade/fleet/ship2.png"); // horizontal 2-cell vessel (2:1)
const HIT_IMG = require("../../assets/arcade/fleet/hit.png");     // explosion (1 cell)
const MISS_IMG = require("../../assets/arcade/fleet/miss.png");   // water splash (1 cell)
const SUNK_IMG = require("../../assets/arcade/fleet/sunk.png");   // burning hull overlay (1 cell)

const N = 6;
const SHIP_SIZES = [3, 2, 2];
const { width: W, height: H } = Dimensions.get("window");

// Full-screen dual-grid layout: size each board to fill the width while both
// boards still fit the screen height (no scroll). A small coordinate ruler
// frames each grid like a naval chart.
const RULER = 18;                        // left number gutter + top letter strip
const GAP = space.md;                    // between the two boards
const V_CHROME = 300;                    // header + message + two HUD rows + safe areas
const availW = W - space.lg * 2 - RULER;
const availH = Math.floor((H - V_CHROME) / 2) - RULER;
const GRID = Math.max(240, Math.min(availW, availH));
const CELL = GRID / N;
const COLS = "ABCDEF";

interface CellState { ship: number; fired: boolean; }
type Grid = CellState[][];
interface Pos { r: number; c: number; }

function emptyGrid(): Grid {
  const g: Grid = [];
  for (let r = 0; r < N; r++) {
    const row: CellState[] = [];
    for (let c = 0; c < N; c++) row.push({ ship: -1, fired: false });
    g.push(row);
  }
  return g;
}

function placeShips(): { grid: Grid; ships: Pos[][] } {
  const grid = emptyGrid();
  const ships: Pos[][] = [];
  SHIP_SIZES.forEach((size, idx) => {
    let placed = false;
    let guard = 0;
    while (!placed && guard < 500) {
      guard++;
      const horizontal = Math.random() < 0.5;
      const r = Math.floor(Math.random() * (horizontal ? N : N - size + 1));
      const c = Math.floor(Math.random() * (horizontal ? N - size + 1 : N));
      const cells: Pos[] = [];
      let ok = true;
      for (let k = 0; k < size; k++) {
        const rr = horizontal ? r : r + k;
        const cc = horizontal ? c + k : c;
        if (grid[rr][cc].ship !== -1) { ok = false; break; }
        cells.push({ r: rr, c: cc });
      }
      if (!ok) continue;
      cells.forEach((p) => { grid[p.r][p.c].ship = idx; });
      ships.push(cells);
      placed = true;
    }
  });
  return { grid, ships };
}

const shipSunk = (grid: Grid, ship: Pos[]): boolean => ship.every((p) => grid[p.r][p.c].fired);
const allSunk = (grid: Grid, ships: Pos[][]): boolean => ships.every((s) => shipSunk(grid, s));
const coordLabel = (p: Pos): string => `${COLS.charAt(p.c)}${p.r + 1}`;
const inB = (r: number, c: number): boolean => r >= 0 && r < N && c >= 0 && c < N;

// ---- Deterministic HUNT / TARGET AI ----
// Persistent memory: `hits` = cells of the currently-wounded (not yet sunk) ship(s).
// TARGET mode derives candidate cells from those hits each turn; HUNT mode uses a
// parity search (every other cell — valid because the smallest ship is length 2).
interface AIState { hits: Pos[]; }

function deriveTargets(hits: Pos[], grid: Grid): Pos[] {
  const untried = (r: number, c: number) => inB(r, c) && !grid[r][c].fired;
  if (hits.length === 0) return [];
  if (hits.length === 1) {
    const { r, c } = hits[0];
    return [{ r: r - 1, c }, { r: r + 1, c }, { r, c: c - 1 }, { r, c: c + 1 }].filter((p) => untried(p.r, p.c));
  }
  const sameRow = hits.every((h) => h.r === hits[0].r);
  const sameCol = hits.every((h) => h.c === hits[0].c);
  const cand: Pos[] = [];
  if (sameRow) {
    const r = hits[0].r;
    const cs = hits.map((h) => h.c);
    cand.push({ r, c: Math.min(...cs) - 1 }, { r, c: Math.max(...cs) + 1 });
  } else if (sameCol) {
    const c = hits[0].c;
    const rs = hits.map((h) => h.r);
    cand.push({ r: Math.min(...rs) - 1, c }, { r: Math.max(...rs) + 1, c });
  } else {
    // Hits not in a line (two adjacent ships touched) — probe all neighbours.
    for (const h of hits) cand.push({ r: h.r - 1, c: h.c }, { r: h.r + 1, c: h.c }, { r: h.r, c: h.c - 1 }, { r: h.r, c: h.c + 1 });
  }
  return cand.filter((p) => untried(p.r, p.c));
}

function chooseShot(grid: Grid, ai: AIState): Pos {
  const targets = deriveTargets(ai.hits, grid);
  if (targets.length > 0) return targets[Math.floor(Math.random() * targets.length)];
  // HUNT: prefer parity cells, else any untried.
  const parity: Pos[] = [];
  const any: Pos[] = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (!grid[r][c].fired) { any.push({ r, c }); if ((r + c) % 2 === 0) parity.push({ r, c }); }
  const pool = parity.length > 0 ? parity : any;
  return pool[Math.floor(Math.random() * pool.length)];
}

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const enemySetup = useRef(placeShips());
  const playerSetup = useRef(placeShips());
  const [enemy, setEnemy] = useState<Grid>(enemySetup.current.grid);
  const [player, setPlayer] = useState<Grid>(playerSetup.current.grid);
  const [turn, setTurn] = useState<"player" | "enemy">("player");
  const [over, setOver] = useState<null | "win" | "lose">(null);
  const [msg, setMsg] = useState("Tap the enemy grid to fire.");
  const ai = useRef<AIState>({ hits: [] });
  const busy = useRef(false);

  const reset = useCallback(() => {
    enemySetup.current = placeShips();
    playerSetup.current = placeShips();
    setEnemy(enemySetup.current.grid);
    setPlayer(playerSetup.current.grid);
    setTurn("player");
    setOver(null);
    setMsg("Tap the enemy grid to fire.");
    ai.current = { hits: [] };
    busy.current = false;
  }, []);

  // Enemy turn — deterministic hunt/target using real hit feedback. No LLM.
  useEffect(() => {
    if (turn !== "enemy" || over) return;
    let alive = true;
    busy.current = true;
    const t = setTimeout(() => {
      if (!alive) return;
      const shot = chooseShot(player, ai.current);
      const ng = player.map((row) => row.map((cell) => ({ ...cell })));
      ng[shot.r][shot.c].fired = true;
      const hitShip = ng[shot.r][shot.c].ship;
      let note = `Enemy fired ${coordLabel(shot)} — ${hitShip >= 0 ? "hit!" : "miss."}`;

      if (hitShip >= 0) {
        const sunkCells = playerSetup.current.ships[hitShip];
        if (shipSunk(ng, sunkCells)) {
          note += " They sank a ship.";
          // Drop this ship's hits; keep any others still being targeted.
          ai.current.hits = ai.current.hits.filter(
            (h) => !sunkCells.some((s) => s.r === h.r && s.c === h.c),
          );
        } else {
          ai.current.hits = [...ai.current.hits, shot];
        }
      }

      setPlayer(ng);
      if (allSunk(ng, playerSetup.current.ships)) {
        setOver("lose");
        setMsg(`${note} Your fleet is destroyed. You lose.`);
      } else {
        setMsg(`${note} Your move.`);
        setTurn("player");
      }
      busy.current = false;
    }, 420);
    return () => { alive = false; clearTimeout(t); };
  }, [turn, over, player]);

  const fireAt = (r: number, c: number): void => {
    if (over || turn !== "player" || busy.current) return;
    if (enemy[r][c].fired) return;
    const ng = enemy.map((row) => row.map((cell) => ({ ...cell })));
    ng[r][c].fired = true;
    setEnemy(ng);
    const hitShip = ng[r][c].ship;
    let note = `You fired ${coordLabel({ r, c })} — ${hitShip >= 0 ? "hit!" : "miss."}`;
    if (hitShip >= 0 && shipSunk(ng, enemySetup.current.ships[hitShip])) note += " You sank a ship!";
    if (allSunk(ng, enemySetup.current.ships)) {
      setOver("win");
      setMsg(`${note} Enemy fleet destroyed. You win!`);
      return;
    }
    setMsg(`${note} Enemy returning fire…`);
    setTurn("enemy");
  };

  // Fleet-status pips: one tick per ship, filled while afloat, hollow once sunk.
  const fleetPips = (grid: Grid, ships: Pos[][], tint: string): React.ReactNode => (
    <View style={st.pips}>
      {ships.map((s, i) => {
        const afloat = !shipSunk(grid, s);
        return (
          <View
            key={i}
            style={[st.pip, { borderColor: tint, backgroundColor: afloat ? tint : "transparent" }]}
          />
        );
      })}
    </View>
  );

  // One board = a coordinate ruler (letters on top, numbers down the left) framing a grid.
  const renderBoard = (
    grid: Grid,
    reveal: boolean,
    onPress: ((r: number, c: number) => void) | null,
    ships: Pos[][],
    accent: string,
  ): React.ReactNode => {
    const sunk = new Set<string>();
    ships.forEach((s) => { if (shipSunk(grid, s)) s.forEach((p) => sunk.add(`${p.r}-${p.c}`)); });
    return (
      <View style={st.board}>
        {/* column letters */}
        <View style={st.colRuler}>
          {COLS.split("").map((ch) => (
            <View key={ch} style={[st.rulerCell, { width: CELL }]}>
              <PixelText size="label" style={{ color: color.textFaint }}>{ch}</PixelText>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row" }}>
          {/* row numbers */}
          <View style={st.rowRuler}>
            {Array.from({ length: N }, (_, i) => (
              <View key={i} style={[st.rulerCell, { height: CELL }]}>
                <PixelText size="label" style={{ color: color.textFaint }}>{String(i + 1)}</PixelText>
              </View>
            ))}
          </View>
          {/* grid */}
          <View style={[st.grid, { width: GRID, height: GRID, borderColor: accent }]}>
            {/* Layer 1 — open water + fire tints + the tap targets. */}
            {grid.map((row, r) =>
              row.map((cell, c) => {
                const isSunk = cell.fired && cell.ship >= 0 && sunk.has(`${r}-${c}`);
                const isHit = cell.fired && cell.ship >= 0 && !isSunk;
                let bg: string = color.surface;              // open water
                if (isSunk) bg = color.dangerDim;            // destroyed hull (dark red block)
                else if (isHit) bg = color.danger;           // fresh hit (bright red)
                return (
                  <Pressable
                    key={`${r}-${c}`}
                    onPress={onPress ? () => onPress(r, c) : undefined}
                    accessibilityRole={onPress ? "button" : undefined}
                    style={[st.cell, { left: c * CELL, top: r * CELL, width: CELL, height: CELL, backgroundColor: bg }]}
                  />
                );
              }),
            )}
            {/* Layer 2 — your revealed ships as sprites spanning their cells. */}
            {reveal &&
              ships.map((s, i) => {
                const rows = s.map((p) => p.r);
                const cols = s.map((p) => p.c);
                const minR = Math.min(...rows);
                const minC = Math.min(...cols);
                const len = s.length;
                const horizontal = s.every((p) => p.r === s[0].r);
                const src = len >= 3 ? SHIP3_IMG : SHIP2_IMG;
                // Un-rotated box is always length*CELL wide by CELL tall (sprite is horizontal).
                const w = len * CELL;
                const h = CELL;
                const shipStyle = horizontal
                  ? { left: minC * CELL, top: minR * CELL, width: w, height: h }
                  : {
                      // Center the horizontal box on the vertical span, then rotate 90°
                      // about that center so it covers column minC from minR down.
                      left: minC * CELL + CELL / 2 - w / 2,
                      top: minR * CELL + len * CELL / 2 - h / 2,
                      width: w,
                      height: h,
                      transform: [{ rotate: "90deg" }],
                    };
                return (
                  <Image
                    key={`ship-${i}`}
                    source={src}
                    resizeMode="contain"
                    style={[st.shipImg, shipStyle]}
                  />
                );
              })}
            {/* Layer 3 — firing markers, always on top of water and ships. */}
            {grid.map((row, r) =>
              row.map((cell, c) => {
                if (!cell.fired) return null;
                const isSunk = cell.ship >= 0 && sunk.has(`${r}-${c}`);
                const isHit = cell.ship >= 0 && !isSunk;
                const isMiss = cell.ship < 0;
                return (
                  <View
                    key={`mk-${r}-${c}`}
                    pointerEvents="none"
                    style={[st.markCell, { left: c * CELL, top: r * CELL, width: CELL, height: CELL }]}
                  >
                    {isMiss ? <Image source={MISS_IMG} resizeMode="contain" style={st.markImg} /> : null}
                    {isHit ? <Image source={HIT_IMG} resizeMode="contain" style={st.markImg} /> : null}
                    {isSunk ? <Image source={SUNK_IMG} resizeMode="contain" style={st.markImg} /> : null}
                  </View>
                );
              }),
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={st.fill}>
      <View style={[st.top, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <PixelText size="h2" style={{ color: color.amber }}>FLEET HUNT</PixelText>
        <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
      </View>
      <Body style={st.msg}>{msg}</Body>

      <View style={st.col}>
        <View style={st.boardWrap}>
          <View style={[st.hud, { width: GRID + RULER }]}>
            <PixelText size="label" style={{ color: color.cyan }}>ENEMY WATERS</PixelText>
            {fleetPips(enemy, enemySetup.current.ships, color.cyan)}
          </View>
          {renderBoard(enemy, false, fireAt, enemySetup.current.ships, color.cyanDim)}
        </View>

        <View style={{ height: GAP }} />

        <View style={st.boardWrap}>
          <View style={[st.hud, { width: GRID + RULER }]}>
            <PixelText size="label" style={{ color: color.amber }}>YOUR FLEET</PixelText>
            {fleetPips(player, playerSetup.current.ships, color.amber)}
          </View>
          {renderBoard(player, true, null, playerSetup.current.ships, color.amberDim)}
        </View>
      </View>

      <GameOverlay
        visible={!!over}
        kind={over === "win" ? "win" : "over"}
        title={over === "win" ? "VICTORY" : "FLEET LOST"}
        primaryLabel="Play again"
        onPrimary={reset}
        onExit={onExit}
      />
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingBottom: space.sm },
  msg: { color: color.text, textAlign: "center", paddingHorizontal: space.lg, marginBottom: space.sm, minHeight: 38 },
  col: { flex: 1, alignItems: "center", justifyContent: "center" },
  boardWrap: { alignItems: "center" },
  hud: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: RULER, marginBottom: space.xs },
  pips: { flexDirection: "row", gap: 5 },
  pip: { width: 12, height: 7, borderRadius: 2, borderWidth: 1.5 },
  board: { alignItems: "flex-start" },
  colRuler: { flexDirection: "row", paddingLeft: RULER, height: RULER },
  rowRuler: { width: RULER, justifyContent: "flex-start" },
  rulerCell: { alignItems: "center", justifyContent: "center" },
  grid: { position: "relative", borderWidth: 2, borderRadius: radius.sm, overflow: "hidden", backgroundColor: color.surface },
  cell: { position: "absolute", borderWidth: 0.5, borderColor: color.bg, alignItems: "center", justifyContent: "center" },
  shipImg: { position: "absolute" },
  markCell: { position: "absolute", alignItems: "center", justifyContent: "center" },
  markImg: { width: "100%", height: "100%" },
});

export const fleetHuntGame: GameModule = {
  id: "fleet-hunt",
  title: "Fleet Hunt",
  kind: "turn-based",
  Screen,
};
