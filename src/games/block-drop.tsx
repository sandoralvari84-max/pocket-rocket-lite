import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";

const { width: W, height: H } = Dimensions.get("window");
const COLS = 10;
const ROWS = 16;
const CELL = Math.floor(Math.min((W - 24) / COLS, (H * 0.62) / ROWS));
const BOARD_W = CELL * COLS;
const BOARD_H = CELL * ROWS;
const DROP_MS = 650;

type Cell = string; // "" = empty, otherwise a colour
type Board = Cell[][];
interface Piece {
  cells: number[][]; // [x, y] offsets
  x: number;
  y: number;
  color: string;
}

const SHAPES: { cells: number[][]; color: string }[] = [
  { cells: [[0, 1], [1, 1], [2, 1], [3, 1]], color: "#4dd0e1" }, // line
  { cells: [[1, 0], [2, 0], [1, 1], [2, 1]], color: "#ffd24d" }, // square
  { cells: [[1, 0], [0, 1], [1, 1], [2, 1]], color: "#ba68c8" }, // tee
  { cells: [[1, 0], [2, 0], [0, 1], [1, 1]], color: "#81c784" }, // ess
  { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: "#e57373" }, // zed
  { cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: "#64b5f6" }, // jay
  { cells: [[2, 0], [0, 1], [1, 1], [2, 1]], color: "#ffb74d" }, // ell
];

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => "" as Cell));
}

function rotate(cells: number[][]): number[][] {
  const r = cells.map(([x, y]) => [y, -x]);
  const minX = Math.min(...r.map((c) => c[0]));
  const minY = Math.min(...r.map((c) => c[1]));
  return r.map(([x, y]) => [x - minX, y - minY]);
}

function collides(board: Board, cells: number[][], px: number, py: number): boolean {
  for (const [cx, cy] of cells) {
    const x = px + cx;
    const y = py + cy;
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y >= 0 && board[y][x] !== "") return true;
  }
  return false;
}

function spawn(): Piece {
  const s = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  return { cells: s.cells.map((c) => [c[0], c[1]]), x: Math.floor(COLS / 2) - 1, y: 0, color: s.color };
}

function Screen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const boardRef = useRef<Board>(emptyBoard());
  const pieceRef = useRef<Piece>(spawn());
  const overRef = useRef(false);
  const [, setTick] = useState(0);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const bump = () => setTick((t) => (t + 1) % 1000000);

  const lockAndNext = () => {
    const b = boardRef.current;
    const p = pieceRef.current;
    for (const [cx, cy] of p.cells) {
      const y = p.y + cy;
      const x = p.x + cx;
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) b[y][x] = p.color;
    }
    // clear full lines
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (b[y].every((c) => c !== "")) {
        b.splice(y, 1);
        b.unshift(Array.from({ length: COLS }, () => "" as Cell));
        cleared++;
        y++; // re-check the shifted row
      }
    }
    if (cleared > 0) {
      const points = [0, 100, 300, 500, 800][cleared] ?? 800;
      setScore((s) => s + points);
    }
    const next = spawn();
    if (collides(b, next.cells, next.x, next.y)) {
      overRef.current = true;
      setOver(true);
      return;
    }
    pieceRef.current = next;
  };

  const step = () => {
    if (overRef.current) return;
    const p = pieceRef.current;
    if (!collides(boardRef.current, p.cells, p.x, p.y + 1)) {
      p.y += 1;
    } else {
      lockAndNext();
    }
    bump();
  };

  useEffect(() => {
    const id = setInterval(step, DROP_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const move = (dx: number) => {
    if (overRef.current) return;
    const p = pieceRef.current;
    if (!collides(boardRef.current, p.cells, p.x + dx, p.y)) {
      p.x += dx;
      bump();
    }
  };
  const softDrop = () => {
    if (overRef.current) return;
    step();
  };
  const doRotate = () => {
    if (overRef.current) return;
    const p = pieceRef.current;
    const rc = rotate(p.cells);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(boardRef.current, rc, p.x + kick, p.y)) {
        p.cells = rc;
        p.x += kick;
        bump();
        return;
      }
    }
  };
  const reset = () => {
    boardRef.current = emptyBoard();
    pieceRef.current = spawn();
    overRef.current = false;
    setOver(false);
    setScore(0);
    bump();
  };

  // build a display board merging the active piece
  const b = boardRef.current;
  const p = pieceRef.current;
  const display: Cell[][] = b.map((row) => row.slice());
  if (!overRef.current) {
    for (const [cx, cy] of p.cells) {
      const y = p.y + cy;
      const x = p.x + cx;
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) display[y][x] = p.color;
    }
  }

  return (
    <View style={st.fill}>
      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <Pressable style={st.exit} onPress={onExit}>
          <Text style={st.exitT}>← Menu</Text>
        </Pressable>
        <Text style={st.score}>Score {score}</Text>
      </View>

      <View style={st.center}>
        <View style={[st.board, { width: BOARD_W, height: BOARD_H }]}>
          {display.map((row, y) =>
            row.map((c, x) =>
              c !== "" ? (
                <View
                  key={`${x}-${y}`}
                  style={{
                    position: "absolute",
                    left: x * CELL,
                    top: y * CELL,
                    width: CELL - 1,
                    height: CELL - 1,
                    borderRadius: 3,
                    backgroundColor: c,
                  }}
                />
              ) : null
            )
          )}
          {over ? (
            <View style={st.overlay}>
              <Text style={st.overBig}>Stack Overflow</Text>
              <Pressable style={st.again} onPress={reset}>
                <Text style={st.againT}>Play again</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[st.controls, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <Pressable style={st.btn} onPress={() => move(-1)}>
          <Text style={st.btnT}>◀</Text>
        </Pressable>
        <Pressable style={st.btn} onPress={doRotate}>
          <Text style={st.btnT}>⟳</Text>
        </Pressable>
        <Pressable style={st.btn} onPress={softDrop}>
          <Text style={st.btnT}>▼</Text>
        </Pressable>
        <Pressable style={st.btn} onPress={() => move(1)}>
          <Text style={st.btnT}>▶</Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0b1021" },
  hud: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 5,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  score: { color: "#fff", fontSize: 16, fontWeight: "600" },
  exit: { backgroundColor: "rgba(255,255,255,0.15)", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  exitT: { color: "#fff", fontWeight: "600" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  board: {
    backgroundColor: "#11182f",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#223",
    overflow: "hidden",
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  overBig: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 14 },
  again: { backgroundColor: "#4da3ff", paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
  againT: { color: "#fff", fontWeight: "700" },
  controls: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  btn: {
    backgroundColor: "rgba(255,255,255,0.14)",
    width: 64,
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  btnT: { color: "#fff", fontSize: 22, fontWeight: "700" },
});

export const blockDropGame: GameModule = {
  id: "block-drop",
  title: "Block Drop",
  kind: "arcade",
  Screen,
};
