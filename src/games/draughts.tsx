import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";

// 0 = empty, 1 = player (red, moves up), 2 = opponent (white, moves down)
type Cell = 0 | 1 | 2;
type Board = Cell[][];
interface Pos {
  r: number;
  c: number;
}
interface Move {
  from: Pos;
  to: Pos;
  cap: Pos | null;
}

const { width: W } = Dimensions.get("window");
const BOARD = Math.min(W - 24, 420);
const SZ = BOARD / 8;

const isDark = (r: number, c: number): boolean => (r + c) % 2 === 1;
const inBounds = (r: number, c: number): boolean =>
  r >= 0 && r < 8 && c >= 0 && c < 8;

function initialBoard(): Board {
  const b: Board = [];
  for (let r = 0; r < 8; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < 8; c++) {
      if (isDark(r, c) && r < 3) row.push(2);
      else if (isDark(r, c) && r > 4) row.push(1);
      else row.push(0);
    }
    b.push(row);
  }
  return b;
}

function cloneBoard(b: Board): Board {
  return b.map((row) => row.slice() as Cell[]);
}

function legalMoves(b: Board, side: Cell): Move[] {
  const moves: Move[] = [];
  const dir = side === 1 ? -1 : 1;
  const enemy: Cell = side === 1 ? 2 : 1;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (b[r][c] !== side) continue;
      for (const dc of [-1, 1]) {
        const nr = r + dir;
        const nc = c + dc;
        if (inBounds(nr, nc) && b[nr][nc] === 0) {
          moves.push({ from: { r, c }, to: { r: nr, c: nc }, cap: null });
        }
        const jr = r + 2 * dir;
        const jc = c + 2 * dc;
        if (
          inBounds(jr, jc) &&
          inBounds(nr, nc) &&
          b[nr][nc] === enemy &&
          b[jr][jc] === 0
        ) {
          moves.push({
            from: { r, c },
            to: { r: jr, c: jc },
            cap: { r: nr, c: nc },
          });
        }
      }
    }
  }
  return moves;
}

function applyMove(b: Board, m: Move): Board {
  const nb = cloneBoard(b);
  const piece = nb[m.from.r][m.from.c];
  nb[m.from.r][m.from.c] = 0;
  nb[m.to.r][m.to.c] = piece;
  if (m.cap) nb[m.cap.r][m.cap.c] = 0;
  return nb;
}

function sameMove(a: Move, b: Move): boolean {
  return (
    a.from.r === b.from.r &&
    a.from.c === b.from.c &&
    a.to.r === b.to.r &&
    a.to.c === b.to.c
  );
}

const colLetter = (c: number): string => "abcdefgh".charAt(c);
const label = (p: Pos): string => `${colLetter(p.c)}${8 - p.r}`;
const moveLabel = (m: Move): string => `${label(m.from)}-${label(m.to)}`;

function boardText(b: Board): string {
  let out = "";
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const v = b[r][c];
      out += v === 0 ? "." : v === 1 ? "r" : "w";
    }
    out += "\n";
  }
  return out;
}

// Pick opponent move from its reply; fall back to capture-first heuristic / random.
function pickOpponentMove(reply: string, moves: Move[]): Move {
  const fallback = (): Move => {
    const caps = moves.filter((m) => m.cap);
    const pool = caps.length > 0 ? caps : moves;
    return pool[Math.floor(Math.random() * pool.length)];
  };
  if (moves.length === 0) return fallback();
  const num = reply.match(/\d+/);
  if (num) {
    const idx = parseInt(num[0], 10);
    if (idx >= 0 && idx < moves.length) return moves[idx];
  }
  return fallback();
}

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [board, setBoard] = useState<Board>(() => initialBoard());
  const [sel, setSel] = useState<Pos | null>(null);
  const [turn, setTurn] = useState<"player" | "opponent">("player");
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [msg, setMsg] = useState<string>("Your move (red). Tap a piece.");
  const busy = useRef(false);

  const reset = useCallback(() => {
    setBoard(initialBoard());
    setSel(null);
    setTurn("player");
    setStatus("playing");
    setMsg("Your move (red). Tap a piece.");
    busy.current = false;
  }, []);

  // Opponent turn.
  useEffect(() => {
    if (turn !== "opponent" || status !== "playing") return;
    let alive = true;
    busy.current = true;
    const run = async (): Promise<void> => {
      const moves = legalMoves(board, 2);
      if (moves.length === 0) {
        if (alive) {
          setStatus("won");
          setMsg("White has no moves. You win!");
        }
        return;
      }
      const list = moves.map((m, i) => `${i}) ${moveLabel(m)}`).join("  ");
      let reply = "";
      try {
        reply = await ask(
          `Draughts (checkers). You are White 'w', moving DOWN. Board 8x8 (row8 top):\n${boardText(
            board,
          )}\nLegal moves:\n${list}\nReply with ONLY the number of your move.`,
          "draughts-move",
        );
      } catch {
        reply = "";
      }
      if (!alive) return;
      const move = pickOpponentMove(reply, moves);
      const after = applyMove(board, move);
      setBoard(after);
      const myMoves = legalMoves(after, 1);
      const theirPieces = after.some((row) => row.includes(1));
      if (!theirPieces) {
        setStatus("lost");
        setMsg("White captured all your pieces. You lose.");
      } else if (myMoves.length === 0) {
        setStatus("lost");
        setMsg("You have no legal moves. You lose.");
      } else {
        setMsg(`White played ${moveLabel(move)}. Your move.`);
        setTurn("player");
      }
      busy.current = false;
    };
    void run();
    return () => {
      alive = false;
    };
  }, [turn, status, board, ask]);

  const onCell = (r: number, c: number): void => {
    if (status !== "playing" || turn !== "player" || busy.current) return;
    const v = board[r][c];
    if (v === 1) {
      setSel({ r, c });
      return;
    }
    if (!sel) return;
    const mine = legalMoves(board, 1).filter(
      (m) => m.from.r === sel.r && m.from.c === sel.c,
    );
    const chosen = mine.find((m) => m.to.r === r && m.to.c === c);
    if (!chosen) return;
    const after = applyMove(board, chosen);
    setBoard(after);
    setSel(null);
    const oppMoves = legalMoves(after, 2);
    const oppPieces = after.some((row) => row.includes(2));
    if (!oppPieces || oppMoves.length === 0) {
      setStatus("won");
      setMsg("You win!");
      return;
    }
    setMsg("White thinking...");
    setTurn("opponent");
  };

  const selMoves =
    sel && status === "playing" && turn === "player"
      ? legalMoves(board, 1).filter(
          (m) => m.from.r === sel.r && m.from.c === sel.c,
        )
      : [];
  const isTarget = (r: number, c: number): boolean =>
    selMoves.some((m) => m.to.r === r && m.to.c === c);

  return (
    <View style={st.fill}>
      <View style={[st.bar, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <Pressable style={st.exit} onPress={onExit}>
          <Text style={st.exitT}>← Menu</Text>
        </Pressable>
        <Text style={st.title}>Draughts</Text>
        <Pressable style={st.exit} onPress={reset}>
          <Text style={st.exitT}>Reset</Text>
        </Pressable>
      </View>
      <Text style={st.msg}>{msg}</Text>
      <View style={st.boardWrap}>
        <View style={[st.board, { width: BOARD, height: BOARD }]}>
          {board.map((row, r) =>
            row.map((v, c) => {
              const selected = sel && sel.r === r && sel.c === c;
              const target = isTarget(r, c);
              return (
                <Pressable
                  key={`${r}-${c}`}
                  onPress={() => onCell(r, c)}
                  style={[
                    st.sq,
                    {
                      left: c * SZ,
                      top: r * SZ,
                      width: SZ,
                      height: SZ,
                      backgroundColor: isDark(r, c) ? "#5b4636" : "#e8d7b8",
                    },
                    target ? st.target : null,
                  ]}
                >
                  {v !== 0 ? (
                    <View
                      style={[
                        st.piece,
                        {
                          width: SZ * 0.7,
                          height: SZ * 0.7,
                          borderRadius: SZ * 0.35,
                          backgroundColor: v === 1 ? "#e0463e" : "#f3f3f3",
                          borderColor: selected ? "#ffd24d" : "#00000055",
                          borderWidth: selected ? 3 : 2,
                        },
                      ]}
                    />
                  ) : null}
                </Pressable>
              );
            }),
          )}
        </View>
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
    marginBottom: 10,
  },
  boardWrap: { alignItems: "center" },
  board: {
    position: "relative",
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#2a2f45",
  },
  sq: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  target: { backgroundColor: "#3b7a57" },
  piece: {},
});

export const draughtsGame: GameModule = {
  id: "draughts",
  title: "Draughts",
  kind: "turn-based",
  Screen,
};
