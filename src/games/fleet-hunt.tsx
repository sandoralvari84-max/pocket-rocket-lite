import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, GameOverlay } from "../design/ui";

const N = 6;
const SHIP_SIZES = [3, 2, 2];
const { width: W } = Dimensions.get("window");
const GRID = Math.min(W - space.lg * 2, 320);
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

  const shipsLeft = (grid: Grid, ships: Pos[][]): number => ships.filter((s) => !shipSunk(grid, s)).length;

  const renderGrid = (grid: Grid, reveal: boolean, onPress: ((r: number, c: number) => void) | null): React.ReactNode => (
    <View style={[st.grid, { width: GRID, height: GRID }]}>
      {grid.map((row, r) =>
        row.map((cell, c) => {
          const hit = cell.fired && cell.ship >= 0;
          const miss = cell.fired && cell.ship < 0;
          const showShip = reveal && cell.ship >= 0 && !cell.fired;
          let bg: string = color.surface;
          if (hit) bg = color.danger;
          else if (miss) bg = color.surface2;
          else if (showShip) bg = color.cyanDim;
          return (
            <Pressable
              key={`${r}-${c}`}
              onPress={onPress ? () => onPress(r, c) : undefined}
              style={[st.cell, { left: c * CELL, top: r * CELL, width: CELL, height: CELL, backgroundColor: bg }]}
            >
              {hit ? <Text style={st.mark}>✕</Text> : null}
              {miss ? <View style={st.missDot} /> : null}
            </Pressable>
          );
        }),
      )}
    </View>
  );

  return (
    <View style={st.fill}>
      <View style={[st.top, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <PixelText size="h2" style={{ color: color.amber }}>FLEET HUNT</PixelText>
        <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
      </View>
      <Body style={st.msg}>{msg}</Body>

      <View style={st.col}>
        <PixelText size="label" style={{ color: color.cyan }}>ENEMY WATERS · {shipsLeft(enemy, enemySetup.current.ships)} LEFT</PixelText>
        <View style={{ height: space.sm }} />
        {renderGrid(enemy, false, fireAt)}
        <View style={{ height: space.lg }} />
        <PixelText size="label" style={{ color: color.amber }}>YOUR FLEET · {shipsLeft(player, playerSetup.current.ships)} LEFT</PixelText>
        <View style={{ height: space.sm }} />
        {renderGrid(player, true, null)}
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
  col: { alignItems: "center", flex: 1, justifyContent: "center" },
  grid: { position: "relative", borderWidth: 2, borderColor: color.surfaceLine, borderRadius: radius.sm, overflow: "hidden" },
  cell: { position: "absolute", borderWidth: 0.5, borderColor: color.bg, alignItems: "center", justifyContent: "center" },
  mark: { color: color.text, fontWeight: "800", fontSize: CELL * 0.5 },
  missDot: { width: CELL * 0.26, height: CELL * 0.26, borderRadius: CELL * 0.13, backgroundColor: color.textFaint },
});

export const fleetHuntGame: GameModule = {
  id: "fleet-hunt",
  title: "Fleet Hunt",
  kind: "turn-based",
  Screen,
};
