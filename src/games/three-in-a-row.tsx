import React, { useRef, useState } from "react";
import { View, StyleSheet, Pressable, Dimensions, ImageBackground, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, GameOverlay } from "../design/ui";

// Notebook-paper theme (tools/art/gen_paper.py) — a pen-and-paper game on a ripped page.
const PAPER = require("../../assets/arcade/paper/paper.png");
const TORN = require("../../assets/arcade/paper/torn.png");
const INK = "#27407E";   // blue biro (X)
const RED = "#B23B3B";   // red pen (O)
const GRAPHITE = "#4A463E"; // pencil grid lead
const TABLE = "#2A1D12";    // dark desk/wood the sheet rests on
const TABLE_HI = "#3C2A1A"; // warmer wood grain tint

type Cell = "X" | "O" | null; // X = player (amber), O = machine (cyan)
type Board = Cell[];

const { width: W } = Dimensions.get("window");
const GAP = 10; // inner frame padding
// Absolute-positioned cells (no flex-wrap): a sub-pixel rounding that wrapped the
// 3rd cell onto a new row was the old "garbled grid" bug. This can't wrap.
const CELL = Math.floor((Math.min(W - space.lg * 2, 340) - GAP * 2) / 3);
const BOARD = CELL * 3 + GAP * 2;
const SHEET_MARGIN = 22; // cream border around the grid on the sheet
const SHEET_W = BOARD + SHEET_MARGIN * 2;

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

/* ---- Hand-drawn marks: several slightly-offset strokes read as pen/pencil ---- */
function MarkX() {
  const len = CELL * 0.54;
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

/* ---- Sketchy pencil grid separator: two overlapping graphite strokes ---- */
function SketchLine({ vertical, left, top, length }: { vertical?: boolean; left: number; top: number; length: number }) {
  const thick = vertical
    ? { width: 3.5, height: length }
    : { width: length, height: 3.5 };
  const thin = vertical
    ? { width: 2, height: length }
    : { width: length, height: 2 };
  return (
    <View pointerEvents="none" style={{ position: "absolute", left, top }}>
      <View style={[st.sketch, thick, { backgroundColor: GRAPHITE, transform: [{ rotate: vertical ? "0.6deg" : "-0.5deg" }] }]} />
      <View style={[st.sketch, thin, { position: "absolute", backgroundColor: GRAPHITE, opacity: 0.4, transform: [{ rotate: vertical ? "-0.8deg" : "0.7deg" }, vertical ? { translateX: 1.5 } : { translateY: 1.5 }] }]} />
    </View>
  );
}

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [result, setResult] = useState<"win" | "lose" | "draw" | null>(null);
  const [status, setStatus] = useState("Your turn — you are amber");
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
      if (!settle(next)) setStatus("Your turn — you are amber");
      fetchTaunt(next);
    }, 380);
  };

  const onCell = (i: number) => {
    if (busy || over || board[i] !== null) return;
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
    setStatus("Your turn — you are amber");
  };

  return (
    <View style={st.fill}>
      {/* warm wood grain near the top of the desk */}
      <View pointerEvents="none" style={st.grain} />

      <View style={[st.top, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <PixelText size="h2" style={{ color: color.text }}>THREE IN A ROW</PixelText>
        <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
      </View>

      <View style={st.body}>
        <Body style={st.status}>{status}</Body>

        {/* a sheet of paper resting on the desk — gentle perspective tilt */}
        <View style={st.sheetWrap}>
          <View style={st.sheet}>
            <ImageBackground source={PAPER} resizeMode="repeat" style={st.sheetPaper} imageStyle={st.sheetImg}>
              <Image source={TORN} resizeMode="stretch" fadeDuration={0} style={st.torn} />

              <View style={[st.grid, { width: BOARD, height: BOARD }]}>
                {/* # hand-drawn pencil grid */}
                {[1, 2].map((n) => (
                  <SketchLine key={`v${n}`} vertical left={GAP + n * CELL - 1.75} top={GAP} length={BOARD - GAP * 2} />
                ))}
                {[1, 2].map((n) => (
                  <SketchLine key={`h${n}`} left={GAP} top={GAP + n * CELL - 1.75} length={BOARD - GAP * 2} />
                ))}
                {board.map((c, i) => {
                  const r = Math.floor(i / 3), col = i % 3;
                  const inWin = win ? win.line.includes(i) : false;
                  const isLast = last === i;
                  return (
                    <Pressable
                      key={i}
                      onPress={() => onCell(i)}
                      style={[st.cell, { left: GAP + col * CELL, top: GAP + r * CELL, width: CELL, height: CELL }, inWin && st.cellWin]}
                    >
                      {c === "X" ? <MarkX /> : c === "O" ? <MarkO /> : null}
                      {isLast && !inWin ? <View style={st.lastDot} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </ImageBackground>
          </View>
        </View>

        {quip ? <Body muted style={st.quip}>“{quip}”</Body> : <View style={{ height: 24 }} />}
      </View>

      {/* subtle vignette for depth (never blocks taps) */}
      <View pointerEvents="none" style={st.vignette} />

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
  grain: { position: "absolute", left: 0, right: 0, top: 0, height: "52%", backgroundColor: TABLE_HI, opacity: 0.55 },
  vignette: { ...StyleSheet.absoluteFillObject, boxShadow: "inset 0 0 130px 26px rgba(0,0,0,0.5)" },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingBottom: space.sm },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.lg },
  status: { color: color.text, fontWeight: "700", textAlign: "center" },

  // the tilted sheet + its drop shadow on the desk
  sheetWrap: { alignItems: "center", justifyContent: "center" },
  sheet: {
    borderRadius: radius.md,
    boxShadow: "0 24px 32px rgba(0,0,0,0.55)",
    transform: [{ perspective: 900 }, { rotateX: "15deg" }],
  },
  sheetPaper: { width: SHEET_W, paddingTop: SHEET_MARGIN + 6, paddingBottom: SHEET_MARGIN, alignItems: "center", backgroundColor: "#F4EEDE" },
  sheetImg: { borderRadius: radius.md },
  torn: { position: "absolute", left: 0, top: 0, width: "100%", height: 20 },

  grid: { position: "relative", backgroundColor: "transparent" },
  cell: { position: "absolute", alignItems: "center", justifyContent: "center" },
  cellWin: { backgroundColor: "rgba(80,180,110,0.22)", borderRadius: radius.md },
  sketch: { borderRadius: 2 },
  lastDot: { position: "absolute", left: 10, right: 10, bottom: 6, height: 3, borderRadius: 2, backgroundColor: RED },
  quip: { fontStyle: "italic", textAlign: "center", paddingHorizontal: space.xl, minHeight: 24, color: color.text },
});

export const threeInARowGame: GameModule = {
  id: "three-in-a-row",
  title: "Three in a Row",
  kind: "turn-based",
  Screen,
};
