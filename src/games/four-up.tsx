import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";

type Disc = "P" | "M" | null; // Player, Machine
type Board = Disc[]; // row-major, length COLS*ROWS, index 0 = top-left

const COLS = 7;
const ROWS = 6;
const NEED = 4;

const idx = (r: number, c: number): number => r * COLS + c;
const emptyBoard = (): Board => Array<Disc>(COLS * ROWS).fill(null);

const dropRow = (b: Board, c: number): number => {
  for (let r = ROWS - 1; r >= 0; r--) if (b[idx(r, c)] === null) return r;
  return -1;
};

const legalColumns = (b: Board): number[] => {
  const out: number[] = [];
  for (let c = 0; c < COLS; c++) if (b[idx(0, c)] === null) out.push(c);
  return out;
};

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 0], [1, 1], [1, -1],
];

function winnerAt(b: Board, r: number, c: number): boolean {
  const who = b[idx(r, c)];
  if (!who) return false;
  for (const [dr, dc] of DIRS) {
    let count = 1;
    for (let s = 1; s < NEED; s++) {
      const nr = r + dr * s, nc = c + dc * s;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || b[idx(nr, nc)] !== who) break;
      count++;
    }
    for (let s = 1; s < NEED; s++) {
      const nr = r - dr * s, nc = c - dc * s;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || b[idx(nr, nc)] !== who) break;
      count++;
    }
    if (count >= NEED) return true;
  }
  return false;
}

// Pull the first digit 0-6 that names a non-full column from the model's reply.
function parseColumn(reply: string, b: Board): number | null {
  const digits = reply.match(/[0-6]/g);
  if (digits) {
    for (const d of digits) {
      const n = Number(d);
      if (dropRow(b, n) !== -1) return n;
    }
  }
  return null;
}

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState("Your turn — tap a column");
  const [quip, setQuip] = useState("");

  const place = (b: Board, c: number, who: Disc): { next: Board; row: number } => {
    const row = dropRow(b, c);
    const next = b.slice();
    if (row !== -1) next[idx(row, c)] = who;
    return { next, row };
  };

  const machineMove = async (b: Board): Promise<void> => {
    const cols = legalColumns(b);
    if (cols.length === 0) { setStatus("The board is full — a draw."); setOver(true); return; }
    const fallback = cols[Math.floor(Math.random() * cols.length)]!;
    let pick = fallback;
    try {
      const rows: string[] = [];
      for (let r = 0; r < ROWS; r++) {
        let line = "";
        for (let c = 0; c < COLS; c++) {
          const v = b[idx(r, c)];
          line += v === "P" ? "P" : v === "M" ? "M" : ".";
        }
        rows.push(line);
      }
      const reply = await ask(
        `Connect-four on a 7-wide 6-tall grid. Columns numbered 0-6. ` +
          `You are M, opponent is P, dots are empty, top row first:\n${rows.join("\n")}\n` +
          `Reply with ONLY the column number 0-6 you drop into, then a short taunt.`,
        "Pick one non-full column 0-6 and add a one-line taunt."
      );
      const parsed = parseColumn(reply, b);
      if (parsed !== null) pick = parsed;
      const taunt = reply.replace(/[0-6]/, "").trim().slice(0, 80);
      if (taunt) setQuip(taunt);
    } catch {
      /* keep fallback, no quip */
    }
    const { next, row } = place(b, pick, "M");
    setBoard(next);
    if (row !== -1 && winnerAt(next, row, pick)) { setStatus("The machine connects four."); setOver(true); return; }
    if (legalColumns(next).length === 0) { setStatus("The board is full — a draw."); setOver(true); return; }
    setStatus("Your turn — tap a column");
  };

  const onColumn = (c: number): void => {
    if (busy || over) return;
    const row = dropRow(board, c);
    if (row === -1) return;
    const { next } = place(board, c, "P");
    setBoard(next);
    setQuip("");
    if (winnerAt(next, row, c)) { setStatus("You connect four — you win!"); setOver(true); return; }
    if (legalColumns(next).length === 0) { setStatus("The board is full — a draw."); setOver(true); return; }
    setStatus("Machine thinking…");
    setBusy(true);
    void machineMove(next).finally(() => setBusy(false));
  };

  const reset = (): void => {
    setBoard(emptyBoard());
    setOver(false);
    setBusy(false);
    setQuip("");
    setStatus("Your turn — tap a column");
  };

  return (
    <View style={st.fill}>
      <View style={[st.top, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <Pressable style={st.exit} onPress={onExit}>
          <Text style={st.exitT}>← Menu</Text>
        </Pressable>
        <Text style={st.title}>Four Up</Text>
      </View>
      <View style={st.body}>
        <Text style={st.status}>{status}</Text>
        <View style={st.grid}>
          {Array.from({ length: COLS }, (_, c) => (
            <Pressable key={c} style={st.col} disabled={busy || over} onPress={() => onColumn(c)}>
              {Array.from({ length: ROWS }, (_, r) => {
                const v = board[idx(r, c)];
                return (
                  <View key={r} style={st.slot}>
                    <View style={[st.disc, v === "P" ? st.player : v === "M" ? st.machine : st.empty]} />
                  </View>
                );
              })}
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
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  status: { color: "#cdd6ff", fontSize: 16, fontWeight: "600", textAlign: "center", paddingHorizontal: 16 },
  grid: { flexDirection: "row", backgroundColor: "#1b2550", borderRadius: 12, padding: 6 },
  col: { flexDirection: "column" },
  slot: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  disc: { width: 34, height: 34, borderRadius: 17 },
  empty: { backgroundColor: "#0b1021" },
  player: { backgroundColor: "#4da3ff" },
  machine: { backgroundColor: "#ffd24d" },
  quip: { color: "#9aa7e0", fontStyle: "italic", fontSize: 15, paddingHorizontal: 24, textAlign: "center" },
  again: { backgroundColor: "#4da3ff", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  againT: { color: "#0b1021", fontWeight: "700", fontSize: 16 },
});

export const fourUpGame: GameModule = {
  id: "four-up",
  title: "Four Up",
  kind: "turn-based",
  Screen,
};
