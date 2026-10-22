import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";

type Cell = "X" | "O" | null;
type Board = Cell[];

const LINES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const emptyBoard = (): Board => Array<Cell>(9).fill(null);

function winnerOf(b: Board): Cell {
  for (const [a, c, d] of LINES) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  return null;
}

const legalMoves = (b: Board): number[] => {
  const out: number[] = [];
  for (let i = 0; i < b.length; i++) if (b[i] === null) out.push(i);
  return out;
};

// Pull the first digit 0-8 that refers to an empty cell out of the model's reply.
function parseMove(reply: string, b: Board): number | null {
  const digits = reply.match(/[0-8]/g);
  if (digits) {
    for (const d of digits) {
      const n = Number(d);
      if (b[n] === null) return n;
    }
  }
  return null;
}

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Your turn — you are X");
  const [quip, setQuip] = useState("");
  const [over, setOver] = useState(false);

  const finish = (b: Board): boolean => {
    const w = winnerOf(b);
    if (w === "X") { setStatus("You win!"); setOver(true); return true; }
    if (w === "O") { setStatus("The machine wins."); setOver(true); return true; }
    if (legalMoves(b).length === 0) { setStatus("A draw."); setOver(true); return true; }
    return false;
  };

  const modelMove = async (b: Board): Promise<void> => {
    const moves = legalMoves(b);
    if (moves.length === 0) return;
    const fallback = moves[Math.floor(Math.random() * moves.length)]!;
    let pick = fallback;
    try {
      const reply = await ask(
        `Tic-tac-toe. You are O. Cells 0-8 left to right, top to bottom. ` +
          `Board (dash = empty): ${b.map((c) => c ?? "-").join("")}. ` +
          `Reply with ONLY the number of the empty cell you take, then a short taunt.`,
        "Pick one empty cell and add a one-line taunt."
      );
      const parsed = parseMove(reply, b);
      if (parsed !== null) pick = parsed;
      const taunt = reply.replace(/[0-8]/, "").trim().slice(0, 80);
      if (taunt) setQuip(taunt);
    } catch {
      /* keep fallback, no quip */
    }
    const next = b.slice();
    next[pick] = "O";
    setBoard(next);
    if (!finish(next)) setStatus("Your turn — you are X");
  };

  const onCell = (i: number): void => {
    if (busy || over || board[i] !== null) return;
    const next = board.slice();
    next[i] = "X";
    setBoard(next);
    setQuip("");
    if (finish(next)) return;
    setStatus("Machine thinking…");
    setBusy(true);
    void modelMove(next).finally(() => setBusy(false));
  };

  const reset = (): void => {
    setBoard(emptyBoard());
    setOver(false);
    setBusy(false);
    setQuip("");
    setStatus("Your turn — you are X");
  };

  return (
    <View style={st.fill}>
      <View style={[st.top, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <Pressable style={st.exit} onPress={onExit}>
          <Text style={st.exitT}>← Menu</Text>
        </Pressable>
        <Text style={st.title}>Three in a Row</Text>
      </View>
      <View style={st.body}>
        <Text style={st.status}>{status}</Text>
        <View style={st.grid}>
          {board.map((c, i) => (
            <Pressable key={i} style={st.cell} onPress={() => onCell(i)}>
              <Text style={[st.mark, c === "X" ? st.x : st.o]}>{c ?? ""}</Text>
            </Pressable>
          ))}
        </View>
        {quip ? <Text style={st.quip}>“{quip}”</Text> : null}
        {over ? (
          <Pressable style={st.again} onPress={reset}>
            <Text style={st.againT}>Play again</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0b1021" },
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 12 },
  exit: { backgroundColor: "rgba(255,255,255,0.15)", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  exitT: { color: "#fff", fontWeight: "600" },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18 },
  status: { color: "#cdd6ff", fontSize: 16, fontWeight: "600" },
  grid: { width: 300, height: 300, flexDirection: "row", flexWrap: "wrap", borderRadius: 12, overflow: "hidden", backgroundColor: "#1b2550" },
  cell: { width: 100, height: 100, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#0b1021" },
  mark: { fontSize: 52, fontWeight: "800" },
  x: { color: "#4da3ff" },
  o: { color: "#ffd24d" },
  quip: { color: "#9aa7e0", fontStyle: "italic", fontSize: 15, paddingHorizontal: 24, textAlign: "center" },
  again: { backgroundColor: "#4da3ff", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  againT: { color: "#0b1021", fontWeight: "700", fontSize: 16 },
});

export const threeInARowGame: GameModule = {
  id: "three-in-a-row",
  title: "Three in a Row",
  kind: "turn-based",
  Screen,
};
