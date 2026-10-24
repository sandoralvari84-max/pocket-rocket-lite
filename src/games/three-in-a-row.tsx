import React, { useRef, useState } from "react";
import { View, StyleSheet, Pressable, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, GameOverlay } from "../design/ui";

type Cell = "X" | "O" | null; // X = player (amber), O = machine (cyan)
type Board = Cell[];

const { width: W } = Dimensions.get("window");
const GAP = 10; // inner frame padding
// Absolute-positioned cells (no flex-wrap): a sub-pixel rounding that wrapped the
// 3rd cell onto a new row was the old "garbled grid" bug. This can't wrap.
const CELL = Math.floor((Math.min(W - space.lg * 2, 340) - GAP * 2) / 3);
const BOARD = CELL * 3 + GAP * 2;

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

/* ---- Code-drawn marks ---- */
function MarkX() {
  const len = CELL * 0.52;
  return (
    <View style={{ width: CELL, height: CELL, alignItems: "center", justifyContent: "center" }}>
      <View style={[mk.bar, { width: len, backgroundColor: color.amber, transform: [{ rotate: "45deg" }] }]} />
      <View style={[mk.bar, { width: len, backgroundColor: color.amber, transform: [{ rotate: "-45deg" }], position: "absolute" }]} />
    </View>
  );
}
function MarkO() {
  const d = CELL * 0.58;
  return (
    <View style={{ width: CELL, height: CELL, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: d, height: d, borderRadius: d / 2, borderWidth: 6, borderColor: color.cyan }} />
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
      <View style={[st.top, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <PixelText size="h2" style={{ color: color.amber }}>THREE IN A ROW</PixelText>
        <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
      </View>

      <View style={st.body}>
        <Body style={st.status}>{status}</Body>

        <View style={[st.grid, { width: BOARD, height: BOARD }]}>
          {/* # grid lines */}
          {[1, 2].map((n) => (
            <View key={`v${n}`} style={[st.vline, { left: GAP + n * CELL - 1.5, top: GAP, height: BOARD - GAP * 2 }]} />
          ))}
          {[1, 2].map((n) => (
            <View key={`h${n}`} style={[st.hline, { top: GAP + n * CELL - 1.5, left: GAP, width: BOARD - GAP * 2 }]} />
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

        {quip ? <Body muted style={st.quip}>“{quip}”</Body> : <View style={{ height: 24 }} />}
      </View>

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
});

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingBottom: space.sm },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.lg },
  status: { color: color.text, fontWeight: "700", textAlign: "center" },
  grid: {
    position: "relative",
    backgroundColor: "#1C2536", borderRadius: radius.lg,
    borderWidth: 2, borderColor: "#30406A",
  },
  cell: { position: "absolute", alignItems: "center", justifyContent: "center" },
  cellWin: { backgroundColor: "rgba(80,230,140,0.18)", borderRadius: radius.md },
  vline: { position: "absolute", width: 3, borderRadius: 2, backgroundColor: "#3A4E78" },
  hline: { position: "absolute", height: 3, borderRadius: 2, backgroundColor: "#3A4E78" },
  lastDot: { position: "absolute", left: 10, right: 10, bottom: 6, height: 3, borderRadius: 2, backgroundColor: color.amber },
  quip: { fontStyle: "italic", textAlign: "center", paddingHorizontal: space.xl, minHeight: 24 },
});

export const threeInARowGame: GameModule = {
  id: "three-in-a-row",
  title: "Three in a Row",
  kind: "turn-based",
  Screen,
};
