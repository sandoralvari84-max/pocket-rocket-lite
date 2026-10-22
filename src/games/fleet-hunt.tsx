import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";

const N = 6;
const SHIP_SIZES = [3, 2, 2];
const { width: W } = Dimensions.get("window");
const GRID = Math.min(W - 48, 330);
const CELL = GRID / N;
const COLS = "ABCDEF";

interface CellState {
  ship: number; // -1 none, otherwise ship index
  fired: boolean;
}
type Grid = CellState[][];
interface Pos {
  r: number;
  c: number;
}

function emptyGrid(): Grid {
  const g: Grid = [];
  for (let r = 0; r < N; r++) {
    const row: CellState[] = [];
    for (let c = 0; c < N; c++) row.push({ ship: -1, fired: false });
    g.push(row);
  }
  return g;
}

// Returns a grid with ships placed at random (no overlap). ships[i] = cells of ship i.
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
        if (grid[rr][cc].ship !== -1) {
          ok = false;
          break;
        }
        cells.push({ r: rr, c: cc });
      }
      if (!ok) continue;
      cells.forEach((p) => {
        grid[p.r][p.c].ship = idx;
      });
      ships.push(cells);
      placed = true;
    }
  });
  return { grid, ships };
}

function shipSunk(grid: Grid, ship: Pos[]): boolean {
  return ship.every((p) => grid[p.r][p.c].fired);
}
function allSunk(grid: Grid, ships: Pos[][]): boolean {
  return ships.every((s) => shipSunk(grid, s));
}
const coordLabel = (p: Pos): string => `${COLS.charAt(p.c)}${p.r + 1}`;

// Parse an enemy shot from the model reply; fall back to a random untried cell.
function pickEnemyShot(reply: string, grid: Grid): Pos {
  const untried: Pos[] = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (!grid[r][c].fired) untried.push({ r, c });
  const randomShot = (): Pos =>
    untried[Math.floor(Math.random() * untried.length)];
  if (untried.length === 0) return { r: 0, c: 0 };
  const m = reply.toUpperCase().match(/([A-F])\s*([1-6])/);
  if (m) {
    const c = COLS.indexOf(m[1]);
    const r = parseInt(m[2], 10) - 1;
    if (c >= 0 && r >= 0 && r < N && !grid[r][c].fired) return { r, c };
  }
  return randomShot();
}

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const enemySetup = useRef(placeShips());
  const playerSetup = useRef(placeShips());
  const [enemy, setEnemy] = useState<Grid>(enemySetup.current.grid);
  const [player, setPlayer] = useState<Grid>(playerSetup.current.grid);
  const [turn, setTurn] = useState<"player" | "enemy">("player");
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [msg, setMsg] = useState<string>("Tap the enemy grid to fire.");
  const busy = useRef(false);

  const reset = useCallback(() => {
    enemySetup.current = placeShips();
    playerSetup.current = placeShips();
    setEnemy(enemySetup.current.grid);
    setPlayer(playerSetup.current.grid);
    setTurn("player");
    setStatus("playing");
    setMsg("Tap the enemy grid to fire.");
    busy.current = false;
  }, []);

  // Enemy turn.
  useEffect(() => {
    if (turn !== "enemy" || status !== "playing") return;
    let alive = true;
    busy.current = true;
    const run = async (): Promise<void> => {
      const fired: string[] = [];
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++)
          if (player[r][c].fired) fired.push(coordLabel({ r, c }));
      let reply = "";
      try {
        reply = await ask(
          `Fleet Hunt (battleship). Grid columns A-F, rows 1-6. ` +
            `You already fired at: ${fired.length ? fired.join(", ") : "none"}. ` +
            `Give ONE new coordinate to fire at, like "C4". Reply with only the coordinate.`,
          "fleet-shot",
        );
      } catch {
        reply = "";
      }
      if (!alive) return;
      const shot = pickEnemyShot(reply, player);
      const ng = player.map((row) => row.map((cell) => ({ ...cell })));
      ng[shot.r][shot.c].fired = true;
      setPlayer(ng);
      const hitShip = ng[shot.r][shot.c].ship;
      let note = `Enemy fired at ${coordLabel(shot)} — ${
        hitShip >= 0 ? "hit!" : "miss."
      }`;
      if (hitShip >= 0 && shipSunk(ng, playerSetup.current.ships[hitShip])) {
        note += " They sank a ship.";
      }
      if (allSunk(ng, playerSetup.current.ships)) {
        setStatus("lost");
        setMsg(`${note} Your fleet is destroyed. You lose.`);
      } else {
        setMsg(`${note} Your move.`);
        setTurn("player");
      }
      busy.current = false;
    };
    void run();
    return () => {
      alive = false;
    };
  }, [turn, status, player, ask]);

  const fireAt = (r: number, c: number): void => {
    if (status !== "playing" || turn !== "player" || busy.current) return;
    if (enemy[r][c].fired) return;
    const ng = enemy.map((row) => row.map((cell) => ({ ...cell })));
    ng[r][c].fired = true;
    setEnemy(ng);
    const hitShip = ng[r][c].ship;
    let note = `You fired at ${coordLabel({ r, c })} — ${
      hitShip >= 0 ? "hit!" : "miss."
    }`;
    if (hitShip >= 0 && shipSunk(ng, enemySetup.current.ships[hitShip])) {
      note += " You sank a ship!";
    }
    if (allSunk(ng, enemySetup.current.ships)) {
      setStatus("won");
      setMsg(`${note} Enemy fleet destroyed. You win!`);
      return;
    }
    setMsg(`${note} Enemy returning fire...`);
    setTurn("enemy");
  };

  const renderGrid = (
    grid: Grid,
    reveal: boolean,
    onPress: ((r: number, c: number) => void) | null,
  ): React.ReactNode => (
    <View style={[st.grid, { width: GRID, height: GRID }]}>
      {grid.map((row, r) =>
        row.map((cell, c) => {
          const hit = cell.fired && cell.ship >= 0;
          const miss = cell.fired && cell.ship < 0;
          const showShip = reveal && cell.ship >= 0 && !cell.fired;
          let bg = "#13284a";
          if (hit) bg = "#e0463e";
          else if (miss) bg = "#2a3f66";
          else if (showShip) bg = "#5a6b8c";
          return (
            <Pressable
              key={`${r}-${c}`}
              onPress={onPress ? () => onPress(r, c) : undefined}
              style={[
                st.cell,
                {
                  left: c * CELL,
                  top: r * CELL,
                  width: CELL,
                  height: CELL,
                  backgroundColor: bg,
                },
              ]}
            >
              {hit ? <Text style={st.mark}>✕</Text> : null}
              {miss ? <Text style={st.dot}>•</Text> : null}
            </Pressable>
          );
        }),
      )}
    </View>
  );

  return (
    <View style={st.fill}>
      <View style={[st.bar, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <Pressable style={st.exit} onPress={onExit}>
          <Text style={st.exitT}>← Menu</Text>
        </Pressable>
        <Text style={st.title}>Fleet Hunt</Text>
        <Pressable style={st.exit} onPress={reset}>
          <Text style={st.exitT}>Reset</Text>
        </Pressable>
      </View>
      <Text style={st.msg}>{msg}</Text>
      <View style={st.col}>
        <Text style={st.label}>Enemy waters</Text>
        {renderGrid(enemy, false, fireAt)}
        <Text style={[st.label, { marginTop: 16 }]}>Your fleet</Text>
        {renderGrid(player, true, null)}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0b1021" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  exit: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  exitT: { color: "#fff", fontWeight: "600" },
  msg: {
    color: "#cfd6ff",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
    minHeight: 34,
  },
  col: { alignItems: "center" },
  label: { color: "#9fb0e0", fontSize: 13, fontWeight: "600", marginBottom: 6 },
  grid: {
    position: "relative",
    borderWidth: 2,
    borderColor: "#2a2f45",
    borderRadius: 4,
    overflow: "hidden",
  },
  cell: {
    position: "absolute",
    borderWidth: 0.5,
    borderColor: "#0b1021",
    alignItems: "center",
    justifyContent: "center",
  },
  mark: { color: "#fff", fontWeight: "800", fontSize: CELL * 0.5 },
  dot: { color: "#9fb0e0", fontSize: CELL * 0.6 },
});

export const fleetHuntGame: GameModule = {
  id: "fleet-hunt",
  title: "Fleet Hunt",
  kind: "turn-based",
  Screen,
};
