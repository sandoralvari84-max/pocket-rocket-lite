import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, GameOverlay } from "../design/ui";

// Board values:
// 0 empty | 1 player man | 2 machine man | 3 player king | 4 machine king
// Player (amber) sits at bottom, men move UP (dr = -1), promote at row 0.
// Machine (cyan) sits at top, men move DOWN (dr = +1), promote at row 7.
type Cell = 0 | 1 | 2 | 3 | 4;
type Board = Cell[][];
interface Pos { r: number; c: number; }
interface Move { from: Pos; to: Pos; path: Pos[]; caps: Pos[]; }

const PLAYER = 1 as const;
const MACHINE = 2 as const;
const DEPTH = 6;

const { width: W } = Dimensions.get("window");
const BOARD = Math.min(W - space.lg * 2, 380);
const SZ = BOARD / 8;

const isDark = (r: number, c: number): boolean => (r + c) % 2 === 1;
const inB = (r: number, c: number): boolean => r >= 0 && r < 8 && c >= 0 && c < 8;
const ownerOf = (v: Cell): 0 | 1 | 2 => (v === 1 || v === 3 ? 1 : v === 2 || v === 4 ? 2 : 0);
const isKing = (v: Cell): boolean => v === 3 || v === 4;

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
const cloneBoard = (b: Board): Board => b.map((row) => row.slice() as Cell[]);

// Diagonals a piece may step/capture along.
function dirsFor(v: Cell): Array<[number, number]> {
  if (isKing(v)) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  return ownerOf(v) === 1 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
}
function promoteIfNeeded(v: Cell, r: number): Cell {
  if (v === 1 && r === 0) return 3;
  if (v === 2 && r === 7) return 4;
  return v;
}

// Recursive multi-jump search from (r,c). Returns full capture sequences.
function captureSeqs(b: Board, r: number, c: number, v: Cell): Move[] {
  const out: Move[] = [];
  const side = ownerOf(v) as 1 | 2;
  for (const [dr, dc] of dirsFor(v)) {
    const mr = r + dr, mc = c + dc;      // square being jumped
    const lr = r + 2 * dr, lc = c + 2 * dc; // landing
    if (!inB(lr, lc) || !inB(mr, mc)) continue;
    const mid = b[mr][mc];
    if (ownerOf(mid) === 0 || ownerOf(mid) === side) continue; // must be enemy
    if (b[lr][lc] !== 0) continue; // landing must be empty
    const nb = cloneBoard(b);
    nb[r][c] = 0;
    nb[mr][mc] = 0;
    const landed = promoteIfNeeded(v, lr);
    nb[lr][lc] = landed;
    // Promotion ends the move (standard American/English rules).
    const sub = landed === v ? captureSeqs(nb, lr, lc, landed) : [];
    if (sub.length === 0) {
      out.push({ from: { r, c }, to: { r: lr, c: lc }, path: [{ r: lr, c: lc }], caps: [{ r: mr, c: mc }] });
    } else {
      for (const s of sub) {
        out.push({
          from: { r, c },
          to: s.to,
          path: [{ r: lr, c: lc }, ...s.path],
          caps: [{ r: mr, c: mc }, ...s.caps],
        });
      }
    }
  }
  return out;
}

function simpleMoves(b: Board, r: number, c: number, v: Cell): Move[] {
  const out: Move[] = [];
  for (const [dr, dc] of dirsFor(v)) {
    const nr = r + dr, nc = c + dc;
    if (inB(nr, nc) && b[nr][nc] === 0) {
      out.push({ from: { r, c }, to: { r: nr, c: nc }, path: [{ r: nr, c: nc }], caps: [] });
    }
  }
  return out;
}

// All legal moves for `side`, enforcing the forced-capture rule:
// if any capture exists anywhere, only captures are legal.
function legalMoves(b: Board, side: 1 | 2): Move[] {
  const caps: Move[] = [];
  const quiet: Move[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const v = b[r][c];
      if (ownerOf(v) !== side) continue;
      caps.push(...captureSeqs(b, r, c, v));
      quiet.push(...simpleMoves(b, r, c, v));
    }
  }
  return caps.length > 0 ? caps : quiet;
}

function applyMove(b: Board, m: Move): Board {
  const nb = cloneBoard(b);
  const v = nb[m.from.r][m.from.c];
  nb[m.from.r][m.from.c] = 0;
  for (const cap of m.caps) nb[cap.r][cap.c] = 0;
  nb[m.to.r][m.to.c] = promoteIfNeeded(v, m.to.r);
  return nb;
}

// ---- Evaluation from MACHINE (side 2) perspective. ----
function evaluate(b: Board): number {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const v = b[r][c];
      if (v === 0) continue;
      const king = isKing(v);
      const base = king ? 170 : 100;
      if (ownerOf(v) === 2) {
        score += base;
        if (!king) score += r * 2;          // advance toward promotion (row 7)
        score += (3.5 - Math.abs(3.5 - c)); // mild centre preference
      } else {
        score -= base;
        if (!king) score -= (7 - r) * 2;    // player advances toward row 0
        score -= (3.5 - Math.abs(3.5 - c));
      }
    }
  }
  return score;
}

function minimax(b: Board, side: 1 | 2, depth: number, alpha: number, beta: number): number {
  const moves = legalMoves(b, side);
  if (moves.length === 0) {
    // Side to move has no moves -> it loses.
    return side === MACHINE ? -100000 - depth : 100000 + depth;
  }
  if (depth === 0) return evaluate(b);
  // Order captures first for better pruning.
  moves.sort((a, z) => z.caps.length - a.caps.length);
  if (side === MACHINE) {
    let best = -Infinity;
    for (const m of moves) {
      best = Math.max(best, minimax(applyMove(b, m), PLAYER, depth - 1, alpha, beta));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    best = Math.min(best, minimax(applyMove(b, m), MACHINE, depth - 1, alpha, beta));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

function bestMachineMove(b: Board): Move | null {
  const moves = legalMoves(b, MACHINE);
  if (moves.length === 0) return null;
  moves.sort((a, z) => z.caps.length - a.caps.length);
  let bestScore = -Infinity;
  let best = moves[0];
  for (const m of moves) {
    const score = minimax(applyMove(b, m), PLAYER, DEPTH - 1, -Infinity, Infinity);
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [board, setBoard] = useState<Board>(() => initialBoard());
  const [sel, setSel] = useState<Pos | null>(null);
  const [turn, setTurn] = useState<"player" | "machine">("player");
  const [over, setOver] = useState<null | "win" | "lose">(null);
  const [msg, setMsg] = useState("Your move (amber). Captures are forced.");
  const [lastPath, setLastPath] = useState<Pos[]>([]);
  const busy = useRef(false);

  const reset = useCallback(() => {
    setBoard(initialBoard());
    setSel(null);
    setTurn("player");
    setOver(null);
    setMsg("Your move (amber). Captures are forced.");
    setLastPath([]);
    busy.current = false;
  }, []);

  // Machine turn — deterministic minimax, never the LLM.
  useEffect(() => {
    if (turn !== "machine" || over) return;
    let alive = true;
    busy.current = true;
    const t = setTimeout(() => {
      if (!alive) return;
      const move = bestMachineMove(board);
      if (!move) { setOver("win"); setMsg("The machine cannot move. You win!"); busy.current = false; return; }
      const after = applyMove(board, move);
      setBoard(after);
      setLastPath([move.from, ...move.path]);
      const playerMoves = legalMoves(after, PLAYER);
      if (playerMoves.length === 0) {
        setOver("lose");
        setMsg("You have no legal moves. You lose.");
        busy.current = false;
        return;
      }
      const captured = move.caps.length > 0 ? ` and captured ${move.caps.length}` : "";
      const forced = hasCapture(after, PLAYER) ? " A capture is forced." : "";
      setMsg(`Machine moved${captured}. Your turn.${forced}`);
      setTurn("player");
      // Optional flavour only — never affects the move.
      if (move.caps.length > 0) {
        ask(`You are playing draughts and just captured ${move.caps.length} piece(s). ` +
            `One short smug sentence (max 10 words). No board talk.`, "banter")
          .then((r) => { const q = r.trim().replace(/^["']|["']$/g, "").slice(0, 60); if (alive && q) setMsg(`Machine: “${q}”`); })
          .catch(() => {});
      }
      busy.current = false;
    }, 420);
    return () => { alive = false; clearTimeout(t); };
  }, [turn, over, board, ask]);

  const playerLegal = turn === "player" && !over ? legalMoves(board, PLAYER) : [];
  const selMoves = sel ? playerLegal.filter((m) => m.from.r === sel.r && m.from.c === sel.c) : [];
  const isTarget = (r: number, c: number): boolean => selMoves.some((m) => m.to.r === r && m.to.c === c);
  const isSelectable = (r: number, c: number): boolean => playerLegal.some((m) => m.from.r === r && m.from.c === c);

  const onCell = (r: number, c: number): void => {
    if (over || turn !== "player" || busy.current) return;
    // Tapping one of our movable pieces selects it.
    if (ownerOf(board[r][c]) === 1 && isSelectable(r, c)) { setSel({ r, c }); return; }
    if (!sel) return;
    const chosen = selMoves.find((m) => m.to.r === r && m.to.c === c);
    if (!chosen) return;
    const after = applyMove(board, chosen);
    setBoard(after);
    setSel(null);
    setLastPath([chosen.from, ...chosen.path]);
    const machineMoves = legalMoves(after, MACHINE);
    if (machineMoves.length === 0) { setOver("win"); setMsg("The machine cannot move. You win!"); return; }
    setMsg("Machine thinking…");
    setTurn("machine");
  };

  return (
    <View style={st.fill}>
      <View style={[st.top, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <PixelText size="h2" style={{ color: color.amber }}>DRAUGHTS</PixelText>
        <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
      </View>
      <Body style={st.msg}>{msg}</Body>

      <View style={st.boardWrap}>
        <View style={[st.board, { width: BOARD, height: BOARD }]}>
          {board.map((row, r) =>
            row.map((v, c) => {
              const selected = !!sel && sel.r === r && sel.c === c;
              const target = isTarget(r, c);
              const lit = lastPath.some((p) => p.r === r && p.c === c);
              return (
                <Pressable
                  key={`${r}-${c}`}
                  onPress={() => onCell(r, c)}
                  style={[
                    st.sq,
                    { left: c * SZ, top: r * SZ, width: SZ, height: SZ, backgroundColor: isDark(r, c) ? color.surface : color.surface2 },
                    lit && { backgroundColor: color.amberGlowBg },
                  ]}
                >
                  {v !== 0 ? (
                    <View
                      style={[
                        st.piece,
                        {
                          width: SZ * 0.72, height: SZ * 0.72, borderRadius: SZ * 0.36,
                          backgroundColor: ownerOf(v) === 1 ? color.amber : color.cyan,
                          borderColor: selected ? color.text : "rgba(0,0,0,0.35)",
                          borderWidth: selected ? 3 : 2,
                        },
                      ]}
                    >
                      {isKing(v) ? <Text style={[st.crown, { fontSize: SZ * 0.34, color: ownerOf(v) === 1 ? color.onAmber : color.onCyan }]}>♛</Text> : null}
                    </View>
                  ) : null}
                  {target ? <View style={[st.dot, { width: SZ * 0.26, height: SZ * 0.26, borderRadius: SZ * 0.13 }]} /> : null}
                </Pressable>
              );
            }),
          )}
        </View>
      </View>

      <GameOverlay
        visible={!!over}
        kind={over === "win" ? "win" : "over"}
        title={over === "win" ? "YOU WIN" : "DEFEATED"}
        primaryLabel="Play again"
        onPrimary={reset}
        onExit={onExit}
      />
    </View>
  );
}

function hasCapture(b: Board, side: 1 | 2): boolean {
  return legalMoves(b, side).some((m) => m.caps.length > 0);
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingBottom: space.sm },
  msg: { color: color.text, textAlign: "center", paddingHorizontal: space.lg, marginBottom: space.sm, minHeight: 40 },
  boardWrap: { alignItems: "center" },
  board: { position: "relative", borderRadius: radius.md, overflow: "hidden", borderWidth: 2, borderColor: color.surfaceLine },
  sq: { position: "absolute", alignItems: "center", justifyContent: "center" },
  piece: { alignItems: "center", justifyContent: "center" },
  crown: { fontWeight: "900", textAlign: "center" },
  dot: { position: "absolute", backgroundColor: color.success, opacity: 0.85 },
});

export const draughtsGame: GameModule = {
  id: "draughts",
  title: "Draughts",
  kind: "turn-based",
  Screen,
};
