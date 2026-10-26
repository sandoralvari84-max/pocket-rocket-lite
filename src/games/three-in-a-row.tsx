import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable, Dimensions, ImageBackground, Image, Animated, Easing } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, GameOverlay } from "../design/ui";

// Pen-and-paper on a tabletop: a cream sheet lying on a warm wooden desk, seen at a
// slight 3D tilt, with the noughts-and-crosses "field" and marks drawn in ink.
const SHEET = require("../../assets/arcade/paper/sheet_a.jpg"); // generated paper-on-table surface
const INK = "#2E5CB8";    // blue biro (X, the player)
const RED = "#C0392B";    // red pen (O, the machine)
const GRID_INK = "#26324A"; // navy ink for the hand-drawn grid
const TABLE = "#1C1109";    // deep warm wood (base of the desk)

type Cell = "X" | "O" | null; // X = player (blue pen), O = machine (red pen)
type Board = Cell[];

const { width: W } = Dimensions.get("window");
// The board is drawn directly on the generated paper sheet. These map the paper's
// writing area (measured from the art, inset to clear the curled corner) to px.
const ART_AR = 784 / 1168;                        // sheet_a.jpg aspect
const SHEET_W = Math.min(W - 24, 340);
const SHEET_H = Math.round(SHEET_W / ART_AR);
const PAP = { x0: 0.23, x1: 0.79, y0: 0.25, y1: 0.70 }; // paper writing rect (frac)
const papL = PAP.x0 * SHEET_W, papT = PAP.y0 * SHEET_H;
const papW = (PAP.x1 - PAP.x0) * SHEET_W, papH = (PAP.y1 - PAP.y0) * SHEET_H;
const GAP = 10; // inner frame padding
// Fixed square board (sub-pixel rounding once wrapped the 3rd cell — the old
// "garbled grid" bug). A fixed square centred on the page can't wrap.
const FIT = Math.floor(Math.min(papW, papH));
const CELL = Math.floor((FIT - GAP * 2) / 3);
const BOARD = CELL * 3 + GAP * 2;
const boardL = Math.round(papL + (papW - BOARD) / 2);
const boardT = Math.round(papT + (papH - BOARD) / 2);

// --- Warm wood tabletop built as a stacked vertical gradient (no gradient lib). ---
const mix = (a: string, b: string, t: number): string => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
};
const TABLE_TOP = "#5A3E22"; // lit wood receding at the top
const TABLE_BOT = "#160C06"; // dark wood near the viewer
const BANDS = Array.from({ length: 12 }, (_, i) => mix(TABLE_TOP, TABLE_BOT, i / 11));
const PLANKS = [0.16, 0.37, 0.58, 0.79]; // faint plank seams for grain

const LINES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const emptyBoard = (): Board => Array<Cell>(9).fill(null);

function winnerLine(b: Board): { who: Cell; line: readonly [number, number, number] } | null {
  for (const line of LINES) {
    const [a, c, d] = line;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { who: b[a], line };
  }
  return null;
}
const winnerOf = (b: Board): Cell => winnerLine(b)?.who ?? null;

const legalMoves = (b: Board): number[] => {
  const out: number[] = [];
  for (let i = 0; i < b.length; i++) if (b[i] === null) out.push(i);
  return out;
};

// ---- Perfect minimax. Machine is O (maximizing). Depth terms prefer fast
//      wins / slow losses so the AI is optimal: it never loses and punishes blunders.
function minimax(b: Board, isMax: boolean, depth: number): number {
  const w = winnerOf(b);
  if (w === "O") return 10 - depth;
  if (w === "X") return depth - 10;
  const moves = legalMoves(b);
  if (moves.length === 0) return 0;
  if (isMax) {
    let best = -Infinity;
    for (const i of moves) {
      b[i] = "O";
      best = Math.max(best, minimax(b, false, depth + 1));
      b[i] = null;
    }
    return best;
  }
  let best = Infinity;
  for (const i of moves) {
    b[i] = "X";
    best = Math.min(best, minimax(b, true, depth + 1));
    b[i] = null;
  }
  return best;
}

function bestMove(board: Board): number {
  const b = board.slice();
  let bestScore = -Infinity;
  let pick = -1;
  for (const i of legalMoves(b)) {
    b[i] = "O";
    const score = minimax(b, false, 1);
    b[i] = null;
    if (score > bestScore) { bestScore = score; pick = i; }
  }
  return pick;
}

/* ---- A mark animates in once as it is "drawn" (native driver, light). ---- */
function Ink({ children }: { children: React.ReactNode }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [a]);
  return (
    <Animated.View style={{ opacity: a, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1] }) }] }}>
      {children}
    </Animated.View>
  );
}

/* ---- Hand-drawn marks: several slightly-offset strokes read as pen ---- */
function MarkX() {
  const len = CELL * 0.56;
  // Two crossing strokes, each doubled with a faint, slightly-rotated ghost so the
  // ink looks hand-scratched rather than a crisp vector.
  return (
    <View style={{ width: CELL, height: CELL, alignItems: "center", justifyContent: "center" }}>
      <View style={[mk.bar, { width: len, backgroundColor: INK, transform: [{ rotate: "44deg" }] }]} />
      <View style={[mk.barFaint, { width: len * 0.96, backgroundColor: INK, transform: [{ rotate: "47deg" }, { translateY: 1.5 }], position: "absolute" }]} />
      <View style={[mk.bar, { width: len, backgroundColor: INK, transform: [{ rotate: "-45deg" }], position: "absolute" }]} />
      <View style={[mk.barFaint, { width: len * 0.94, backgroundColor: INK, transform: [{ rotate: "-42deg" }, { translateY: -1.5 }], position: "absolute" }]} />
    </View>
  );
}
function MarkO() {
  const d = CELL * 0.58;
  // Two overlapping rings, offset and slightly rotated → a looped, imperfect circle.
  return (
    <View style={{ width: CELL, height: CELL, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: d, height: d, borderRadius: d / 2, borderWidth: 6, borderColor: RED, transform: [{ rotate: "6deg" }] }} />
      <View style={{ position: "absolute", width: d * 0.98, height: d, borderRadius: d / 2, borderWidth: 3, borderColor: RED, opacity: 0.55, transform: [{ rotate: "-9deg" }, { translateX: 1.5 }] }} />
    </View>
  );
}

/* ---- Sketchy ink grid separator: two overlapping strokes with tiny tilt ---- */
function SketchLine({ vertical, left, top, length }: { vertical?: boolean; left: number; top: number; length: number }) {
  const thick = vertical
    ? { width: 3.5, height: length }
    : { width: length, height: 3.5 };
  const thin = vertical
    ? { width: 2, height: length }
    : { width: length, height: 2 };
  return (
    <View pointerEvents="none" style={{ position: "absolute", left, top }}>
      <View style={[st.sketch, thick, { backgroundColor: GRID_INK, transform: [{ rotate: vertical ? "0.6deg" : "-0.5deg" }] }]} />
      <View style={[st.sketch, thin, { position: "absolute", backgroundColor: GRID_INK, opacity: 0.4, transform: [{ rotate: vertical ? "-0.8deg" : "0.7deg" }, vertical ? { translateX: 1.5 } : { translateY: 1.5 }] }]} />
    </View>
  );
}

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [started, setStarted] = useState(false); // pre-game "ready" gate
  const [result, setResult] = useState<"win" | "lose" | "draw" | null>(null);
  const [status, setStatus] = useState("Your turn — you play the blue X");
  const [quip, setQuip] = useState("");
  const [last, setLast] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const win = winnerLine(board);

  const settle = (b: Board): boolean => {
    const w = winnerOf(b);
    if (w === "X") { setStatus("You win!"); setResult("win"); setOver(true); return true; }
    if (w === "O") { setStatus("The machine wins."); setResult("lose"); setOver(true); return true; }
    if (legalMoves(b).length === 0) { setStatus("A draw."); setResult("draw"); setOver(true); return true; }
    return false;
  };

  // Optional flavour only — never used to decide or validate a move.
  const fetchTaunt = (b: Board) => {
    ask(
      `We are playing noughts and crosses. You just moved. In ONE short sentence (max 10 words), ` +
        `give a smug taunt. No board talk, no numbers.`,
      "banter",
    )
      .then((r) => { const t = r.trim().replace(/^["']|["']$/g, "").slice(0, 70); if (t) setQuip(t); })
      .catch(() => {});
  };

  const machineTurn = (b: Board) => {
    setStatus("Machine thinking…");
    setBusy(true);
    timer.current = setTimeout(() => {
      const move = bestMove(b);
      const next = b.slice();
      if (move >= 0) next[move] = "O";
      setBoard(next);
      setLast(move);
      setBusy(false);
      if (!settle(next)) setStatus("Your turn — you play the blue X");
      fetchTaunt(next);
    }, 380);
  };

  const onCell = (i: number) => {
    if (busy || over || !started || board[i] !== null) return;
    const next = board.slice();
    next[i] = "X";
    setBoard(next);
    setLast(i);
    setQuip("");
    if (settle(next)) return;
    machineTurn(next);
  };

  const reset = () => {
    if (timer.current) clearTimeout(timer.current);
    setBoard(emptyBoard());
    setOver(false);
    setResult(null);
    setBusy(false);
    setQuip("");
    setLast(null);
    setStatus("Your turn — you play the blue X");
  };

  // Pencil strike-through across the three winning cells (centre-to-centre).
  let strike: React.ReactNode = null;
  if (win) {
    const cx = (i: number) => GAP + (i % 3) * CELL + CELL / 2;
    const cy = (i: number) => GAP + Math.floor(i / 3) * CELL + CELL / 2;
    const ax = cx(win.line[0]), ay = cy(win.line[0]);
    const bx = cx(win.line[2]), by = cy(win.line[2]);
    const len = Math.hypot(bx - ax, by - ay) + CELL * 0.42;
    const ang = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const col = win.who === "X" ? INK : RED;
    strike = (
      <View pointerEvents="none" style={{ position: "absolute", left: mx - len / 2, top: my - 4, width: len, height: 8 }}>
        <View style={{ width: len, height: 8, borderRadius: 4, backgroundColor: col, opacity: 0.92, transform: [{ rotate: `${ang}deg` }] }} />
        <View style={{ position: "absolute", width: len * 0.97, height: 4, borderRadius: 2, backgroundColor: col, opacity: 0.4, transform: [{ rotate: `${ang + 1.1}deg` }, { translateY: 2 }] }} />
      </View>
    );
  }

  return (
    <View style={st.fill}>
      <View style={[st.top, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <PixelText size="h2" style={{ color: color.text }}>THREE IN A ROW</PixelText>
        <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
      </View>

      <View style={st.body}>
        <Body style={st.status}>{status}</Body>

        {/* the generated paper-on-table sheet; the grid is drawn on the page */}
        <View style={{ width: SHEET_W, height: SHEET_H }}>
          <Image source={SHEET} resizeMode="cover" fadeDuration={0} style={st.sheetImg} />
          <View style={[st.grid, { position: "absolute", left: boardL, top: boardT, width: BOARD, height: BOARD }]}>
                {/* # hand-drawn ink grid */}
                {[1, 2].map((n) => (
                  <SketchLine key={`v${n}`} vertical left={GAP + n * CELL - 1.75} top={GAP} length={BOARD - GAP * 2} />
                ))}
                {[1, 2].map((n) => (
                  <SketchLine key={`h${n}`} left={GAP} top={GAP + n * CELL - 1.75} length={BOARD - GAP * 2} />
                ))}
                {board.map((c, i) => {
                  const r = Math.floor(i / 3), col = i % 3;
                  const isLast = last === i && !over;
                  // Each Pressable owns exactly one board index, so the tap→cell
                  // mapping is correct regardless of the parent's 3D tilt.
                  return (
                    <Pressable
                      key={i}
                      onPress={() => onCell(i)}
                      style={[st.cell, { left: GAP + col * CELL, top: GAP + r * CELL, width: CELL, height: CELL }]}
                    >
                      {c === "X" ? <Ink><MarkX /></Ink> : c === "O" ? <Ink><MarkO /></Ink> : null}
                      {isLast ? <View style={st.lastDot} /> : null}
                    </Pressable>
                  );
                })}
            {strike}
          </View>
        </View>

        {quip ? <Body muted style={st.quip}>“{quip}”</Body> : <View style={{ height: 24 }} />}
      </View>

      <GameOverlay
        visible={!started}
        kind="pause"
        title="THREE IN A ROW"
        primaryLabel="Play"
        onPrimary={() => setStarted(true)}
        onExit={onExit}
      >
        <Body muted style={{ textAlign: "center", marginTop: space.md }}>
          Tap a square to place your mark. Get three in a row — across, down, or diagonally —
          to win.
        </Body>
      </GameOverlay>

      <GameOverlay
        visible={over}
        kind={result === "win" ? "win" : result === "draw" ? "pause" : "over"}
        title={result === "win" ? "YOU WIN" : result === "draw" ? "DRAW" : "DEFEATED"}
        primaryLabel="Play again"
        onPrimary={reset}
        onExit={onExit}
      />
    </View>
  );
}

const mk = StyleSheet.create({
  bar: { height: 6, borderRadius: 3 },
  barFaint: { height: 4, borderRadius: 2, opacity: 0.45 },
});

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: TABLE },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingBottom: space.sm },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md },
  status: { color: color.text, fontWeight: "700", textAlign: "center" },
  sheetImg: { width: SHEET_W, height: SHEET_H, borderRadius: 12 },
  grid: { backgroundColor: "transparent" },
  cell: { position: "absolute", alignItems: "center", justifyContent: "center" },
  sketch: { borderRadius: 2 },
  lastDot: { position: "absolute", left: 12, right: 12, bottom: 7, height: 3, borderRadius: 2, backgroundColor: "rgba(38,50,74,0.5)" },
  quip: { fontStyle: "italic", textAlign: "center", paddingHorizontal: space.xl, minHeight: 24, color: color.text },
});

export const threeInARowGame: GameModule = {
  id: "three-in-a-row",
  title: "Three in a Row",
  kind: "turn-based",
  Screen,
};
