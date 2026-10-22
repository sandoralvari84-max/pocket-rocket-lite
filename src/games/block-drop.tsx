import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, IconButton, GameOverlay } from "../design/ui";

const { width: W, height: H } = Dimensions.get("window");
const COLS = 10;
const ROWS = 18;
const SIDE = 92; // side panel (next / hold / stats)
const CELL = Math.max(14, Math.floor(Math.min((W - SIDE - 34) / COLS, (H * 0.58) / ROWS)));
const BOARD_W = CELL * COLS;
const BOARD_H = CELL * ROWS;
const PCELL = Math.floor(CELL * 0.52); // preview cell
const CLEAR_MS = 170;

type Cell = string; // "" = empty, otherwise a colour
type Board = Cell[][];
interface Piece {
  id: number;
  cells: number[][]; // [x, y] offsets
  x: number;
  y: number;
  color: string;
}

// 7 tetrominoes, each a distinct on-palette colour.
const SHAPES: { cells: number[][]; color: string }[] = [
  { cells: [[0, 1], [1, 1], [2, 1], [3, 1]], color: color.cyan },   // I
  { cells: [[1, 0], [2, 0], [1, 1], [2, 1]], color: color.amber },  // O
  { cells: [[1, 0], [0, 1], [1, 1], [2, 1]], color: "#B36BE2" },    // T
  { cells: [[1, 0], [2, 0], [0, 1], [1, 1]], color: color.success },// S
  { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: color.danger }, // Z
  { cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: "#4C8DFF" },    // J
  { cells: [[2, 0], [0, 1], [1, 1], [2, 1]], color: "#FF8A3D" },    // L
];

function shade(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const cl = (c: number) => Math.max(0, Math.min(255, Math.round(c + amt)));
  const to = (c: number) => cl(c).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => "" as Cell));
}

// Deterministic SRS-lite rotation (CW): (x,y) -> (y,-x), then normalise to non-negative offsets.
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

function shuffledBag(): number[] {
  const a = [0, 1, 2, 3, 4, 5, 6];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pieceFrom(id: number): Piece {
  const s = SHAPES[id];
  return { id, cells: s.cells.map((c) => [c[0], c[1]]), x: Math.floor(COLS / 2) - 2, y: 0, color: s.color };
}

// ---- cell renderers -------------------------------------------------------
function BevelCell({ left, top, size, c }: { left: number; top: number; size: number; c: string }) {
  return (
    <View
      style={{
        position: "absolute", left, top, width: size - 1, height: size - 1, borderRadius: 2,
        backgroundColor: c, borderWidth: 2,
        borderTopColor: shade(c, 55), borderLeftColor: shade(c, 30),
        borderRightColor: shade(c, -48), borderBottomColor: shade(c, -62),
      }}
    />
  );
}
function GhostCell({ left, top, size, c }: { left: number; top: number; size: number; c: string }) {
  return (
    <View style={{ position: "absolute", left, top, width: size - 1, height: size - 1, borderRadius: 2, borderWidth: 2, borderColor: c, opacity: 0.45 }} />
  );
}

function MiniPiece({ id }: { id: number | null }) {
  const box = PCELL * 4 + 8;
  if (id == null) return <View style={[st.miniBox, { width: box, height: box }]} />;
  const s = SHAPES[id];
  const xs = s.cells.map((c) => c[0]);
  const ys = s.cells.map((c) => c[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const ox = (4 - (maxx - minx + 1)) / 2 - minx;
  const oy = (4 - (maxy - miny + 1)) / 2 - miny;
  return (
    <View style={[st.miniBox, { width: box, height: box }]}>
      {s.cells.map(([cx, cy], i) => (
        <BevelCell key={i} left={4 + (cx + ox) * PCELL} top={4 + (cy + oy) * PCELL} size={PCELL} c={s.color} />
      ))}
    </View>
  );
}

function GameScreen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const boardRef = useRef<Board>(emptyBoard());
  const queueRef = useRef<number[]>(shuffledBag());
  const pieceRef = useRef<Piece>(pieceFrom(queueRef.current.shift() as number));
  const heldRef = useRef<number | null>(null);
  const holdUsedRef = useRef(false);
  const phaseRef = useRef<"play" | "clear" | "over">("play");
  const clearRowsRef = useRef<number[]>([]);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const linesRef = useRef(0);
  const levelRef = useRef(1);
  const accRef = useRef(0);
  const lastRef = useRef(Date.now());

  const [, setTick] = useState(0);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [over, setOver] = useState(false);
  const [, setNextTick] = useState(0); // force preview refresh
  const bump = () => setTick((t) => (t + 1) % 1000000);

  const dropMs = () => Math.max(85, 800 - (levelRef.current - 1) * 65);

  const nextFromQueue = (): Piece => {
    if (queueRef.current.length < 2) queueRef.current.push(...shuffledBag());
    const id = queueRef.current.shift() as number;
    setNextTick((n) => n + 1);
    return pieceFrom(id);
  };

  const gameOver = () => {
    phaseRef.current = "over";
    setOver(true);
  };

  const spawnNext = () => {
    const p = nextFromQueue();
    holdUsedRef.current = false;
    if (collides(boardRef.current, p.cells, p.x, p.y)) {
      pieceRef.current = p;
      gameOver();
      return;
    }
    pieceRef.current = p;
  };

  const finishClear = (full: number[]) => {
    const b = boardRef.current;
    const fset = new Set(full);
    const kept: Board = [];
    for (let y = 0; y < ROWS; y++) if (!fset.has(y)) kept.push(b[y]);
    while (kept.length < ROWS) kept.unshift(Array.from({ length: COLS }, () => "" as Cell));
    boardRef.current = kept;
    clearRowsRef.current = [];
    const n = full.length;
    const pts = ([0, 100, 300, 500, 800][n] ?? 800) * levelRef.current;
    setScore((s) => s + pts);
    const nl = linesRef.current + n;
    linesRef.current = nl; setLines(nl);
    const lvl = Math.floor(nl / 10) + 1;
    levelRef.current = lvl; setLevel(lvl);
    phaseRef.current = "play";
    spawnNext();
    bump();
  };

  const lockAndNext = () => {
    const b = boardRef.current;
    const p = pieceRef.current;
    for (const [cx, cy] of p.cells) {
      const y = p.y + cy, x = p.x + cx;
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) b[y][x] = p.color;
    }
    const full: number[] = [];
    for (let y = 0; y < ROWS; y++) if (b[y].every((c) => c !== "")) full.push(y);
    if (full.length) {
      clearRowsRef.current = full;
      phaseRef.current = "clear";
      bump();
      clearTimerRef.current = setTimeout(() => finishClear(full), CLEAR_MS);
    } else {
      spawnNext();
    }
  };

  const gravityStep = () => {
    if (phaseRef.current !== "play") return;
    const p = pieceRef.current;
    if (!collides(boardRef.current, p.cells, p.x, p.y + 1)) {
      p.y += 1; bump();
    } else {
      lockAndNext(); bump();
    }
  };

  useEffect(() => {
    let raf = 0;
    lastRef.current = Date.now();
    accRef.current = 0;
    const loop = () => {
      const now = Date.now();
      const dt = now - lastRef.current;
      lastRef.current = now;
      if (phaseRef.current === "play") {
        accRef.current += dt;
        let guard = 0;
        while (accRef.current >= dropMs() && guard < 4) { accRef.current -= dropMs(); gravityStep(); guard++; }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const move = (dx: number) => {
    if (phaseRef.current !== "play") return;
    const p = pieceRef.current;
    if (!collides(boardRef.current, p.cells, p.x + dx, p.y)) { p.x += dx; bump(); }
  };
  const softDrop = () => {
    if (phaseRef.current !== "play") return;
    const p = pieceRef.current;
    if (!collides(boardRef.current, p.cells, p.x, p.y + 1)) { p.y += 1; setScore((s) => s + 1); accRef.current = 0; bump(); }
    else { lockAndNext(); bump(); }
  };
  const hardDrop = () => {
    if (phaseRef.current !== "play") return;
    const p = pieceRef.current;
    let d = 0;
    while (!collides(boardRef.current, p.cells, p.x, p.y + 1)) { p.y += 1; d += 1; }
    setScore((s) => s + d * 2);
    lockAndNext();
    bump();
  };
  const doRotate = () => {
    if (phaseRef.current !== "play") return;
    const p = pieceRef.current;
    const rc = rotate(p.cells);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(boardRef.current, rc, p.x + kick, p.y)) { p.cells = rc; p.x += kick; bump(); return; }
    }
  };
  const doHold = () => {
    if (phaseRef.current !== "play" || holdUsedRef.current) return;
    const cur = pieceRef.current;
    const curId = cur.id;
    let np: Piece;
    if (heldRef.current == null) { heldRef.current = curId; np = nextFromQueue(); }
    else { const h = heldRef.current; heldRef.current = curId; np = pieceFrom(h); }
    holdUsedRef.current = true;
    pieceRef.current = np;
    if (collides(boardRef.current, np.cells, np.x, np.y)) gameOver();
    bump();
  };

  const reset = () => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    boardRef.current = emptyBoard();
    queueRef.current = shuffledBag();
    pieceRef.current = pieceFrom(queueRef.current.shift() as number);
    heldRef.current = null;
    holdUsedRef.current = false;
    clearRowsRef.current = [];
    phaseRef.current = "play";
    linesRef.current = 0; levelRef.current = 1;
    accRef.current = 0; lastRef.current = Date.now();
    setScore(0); setLines(0); setLevel(1); setOver(false);
    setNextTick((n) => n + 1); bump();
  };

  // ----- build render ------
  const b = boardRef.current;
  const p = pieceRef.current;
  const clearing = phaseRef.current === "clear";
  const clearSet = new Set(clearRowsRef.current);

  // ghost landing position
  let ghostY = p.y;
  if (phaseRef.current === "play") {
    while (!collides(b, p.cells, p.x, ghostY + 1)) ghostY += 1;
  }

  return (
    <View style={st.fill}>
      {/* HUD */}
      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <View style={st.hudPanel}>
          <PixelText size="score">{String(score).padStart(5, "0")}</PixelText>
          <PixelText size="label" style={{ marginTop: 4 }}>LVL {level}  ·  LINES {lines}</PixelText>
        </View>
        <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
      </View>

      {/* play area */}
      <View style={[st.playRow, { marginTop: Math.max(insets.top, 24) + 70 }]}>
        <View style={[st.board, { width: BOARD_W, height: BOARD_H }]}>
          {/* grid cells */}
          {b.map((row, y) =>
            row.map((c, x) => {
              if (c === "") return null;
              const flash = clearing && clearSet.has(y);
              return flash
                ? <View key={`${x}-${y}`} style={{ position: "absolute", left: x * CELL, top: y * CELL, width: CELL - 1, height: CELL - 1, borderRadius: 2, backgroundColor: color.text }} />
                : <BevelCell key={`${x}-${y}`} left={x * CELL} top={y * CELL} size={CELL} c={c} />;
            })
          )}
          {/* ghost */}
          {phaseRef.current === "play" && ghostY !== p.y
            ? p.cells.map(([cx, cy], i) => {
                const gy = ghostY + cy;
                return gy >= 0 ? <GhostCell key={`g${i}`} left={(p.x + cx) * CELL} top={gy * CELL} size={CELL} c={p.color} /> : null;
              })
            : null}
          {/* active piece */}
          {phaseRef.current !== "over"
            ? p.cells.map(([cx, cy], i) => {
                const y = p.y + cy;
                return y >= 0 ? <BevelCell key={`a${i}`} left={(p.x + cx) * CELL} top={y * CELL} size={CELL} c={p.color} /> : null;
              })
            : null}
        </View>

        {/* side panel */}
        <View style={st.side}>
          <PixelText size="label" style={st.sideLabel}>NEXT</PixelText>
          <MiniPiece id={queueRef.current.length ? queueRef.current[0] : null} />
          <PixelText size="label" style={[st.sideLabel, { marginTop: space.md }]}>HOLD</PixelText>
          <MiniPiece id={heldRef.current} />
        </View>
      </View>

      {/* controls */}
      <View style={[st.controls, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={st.ctrlRow}>
          <Btn label="◀" onPress={() => move(-1)} />
          <Btn label="⟳" onPress={doRotate} />
          <Btn label="▶" onPress={() => move(1)} />
        </View>
        <View style={st.ctrlRow}>
          <Btn label="HOLD" small onPress={doHold} />
          <Btn label="▼" onPress={softDrop} />
          <Btn label="⤓" accent onPress={hardDrop} />
        </View>
      </View>

      <GameOverlay
        visible={over} kind="over" title="STACK OVERFLOW"
        score={`SCORE ${score}  ·  LVL ${level}`}
        primaryLabel="Play again" onPrimary={reset} onExit={onExit}
      />
    </View>
  );
}

function Btn({ label, onPress, accent, small }: { label: string; onPress: () => void; accent?: boolean; small?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        st.btn,
        accent && { borderColor: color.amber, backgroundColor: color.amberGlowBg },
        pressed && { backgroundColor: color.surface2, transform: [{ scale: 0.97 }] },
      ]}
    >
      <Text style={[st.btnT, small && { fontSize: 13 }, accent && { color: color.amber }]}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  hud: { position: "absolute", left: 0, right: 0, zIndex: 5, paddingHorizontal: space.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  hudPanel: { backgroundColor: "rgba(20,26,34,0.7)", borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, borderColor: color.surfaceLine },
  playRow: { flexDirection: "row", justifyContent: "center", alignItems: "flex-start", gap: space.md, paddingHorizontal: space.md },
  board: { backgroundColor: "#0E141C", borderRadius: radius.md, borderWidth: 2, borderColor: color.surfaceLine, overflow: "hidden" },
  side: { width: SIDE - 8, alignItems: "center" },
  sideLabel: { color: color.textMuted, alignSelf: "flex-start", marginBottom: space.xs },
  miniBox: { backgroundColor: "#0E141C", borderRadius: radius.sm, borderWidth: 1, borderColor: color.surfaceLine },
  controls: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  ctrlRow: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
  btn: { flex: 1, height: 52, borderRadius: radius.md, borderWidth: 1.5, borderColor: color.surfaceLine, backgroundColor: color.surface, alignItems: "center", justifyContent: "center" },
  btnT: { color: color.text, fontSize: 22, fontWeight: "800" },
});

export const blockDropGame: GameModule = {
  id: "block-drop",
  title: "Block Drop",
  kind: "arcade",
  Screen: GameScreen,
};
