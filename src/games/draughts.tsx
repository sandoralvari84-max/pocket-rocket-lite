import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, GameOverlay, Sprite } from "../design/ui";
import { EffectsLayer, type EffectsHandle } from "../design/effects";
import { useSettings } from "../settings";

// Owned art — wooden board tiles + dimensional pieces (tools/art/gen_draughts_art.py).
const SQ_LIGHT = require("../../assets/arcade/draughts/square_light.png");
const SQ_DARK = require("../../assets/arcade/draughts/square_dark.png");
const PIECE_IMG: Record<number, ReturnType<typeof require>> = {
  1: require("../../assets/arcade/draughts/man_amber.png"),
  2: require("../../assets/arcade/draughts/man_cyan.png"),
  3: require("../../assets/arcade/draughts/king_amber.png"),
  4: require("../../assets/arcade/draughts/king_cyan.png"),
};

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
  const { reducedMotion } = useSettings();
  const fx = useRef<EffectsHandle>(null);
  const [phase, setPhase] = useState<"ready" | "playing" | "paused">("ready");
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
    setPhase("playing");
  }, []);

  const start = () => setPhase("playing");
  const togglePause = () => setPhase((p) => (p === "playing" ? "paused" : p === "paused" ? "playing" : p));
  const burstCaps = (caps: Pos[]) => {
    for (const cap of caps) fx.current?.burst((cap.c + 0.5) * SZ, (cap.r + 0.5) * SZ, { count: 14, color: "#FF9800", speed: 150, size: 6 });
  };

  // Machine turn — deterministic minimax, never the LLM.
  useEffect(() => {
    if (turn !== "machine" || over || phase !== "playing") return;
    let alive = true;
    busy.current = true;
    const t = setTimeout(() => {
      if (!alive) return;
      const move = bestMachineMove(board);
      if (!move) { setOver("win"); setMsg("The machine cannot move. You win!"); busy.current = false; return; }
      const after = applyMove(board, move);
      setBoard(after);
      setLastPath([move.from, ...move.path]);
      if (move.caps.length > 0) burstCaps(move.caps);
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
  }, [turn, over, board, ask, phase]);

  const playerLegal = turn === "player" && !over ? legalMoves(board, PLAYER) : [];
  const selMoves = sel ? playerLegal.filter((m) => m.from.r === sel.r && m.from.c === sel.c) : [];
  const isTarget = (r: number, c: number): boolean => selMoves.some((m) => m.to.r === r && m.to.c === c);
  const isSelectable = (r: number, c: number): boolean => playerLegal.some((m) => m.from.r === r && m.from.c === c);

  const onCell = (r: number, c: number): void => {
    if (over || turn !== "player" || busy.current || phase !== "playing") return;
    // Tapping one of our movable pieces selects it.
    if (ownerOf(board[r][c]) === 1 && isSelectable(r, c)) { setSel({ r, c }); return; }
    if (!sel) return;
    const chosen = selMoves.find((m) => m.to.r === r && m.to.c === c);
    if (!chosen) return;
    const after = applyMove(board, chosen);
    setBoard(after);
    setSel(null);
    setLastPath([chosen.from, ...chosen.path]);
    if (chosen.caps.length > 0) burstCaps(chosen.caps);
    const machineMoves = legalMoves(after, MACHINE);
    if (machineMoves.length === 0) { setOver("win"); setMsg("The machine cannot move. You win!"); return; }
    setMsg("Machine thinking…");
    setTurn("machine");
  };

  return (
    <View style={st.fill}>
      <View style={[st.top, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <PixelText size="h2" style={{ color: color.amber }}>DRAUGHTS</PixelText>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <IconButton label="Pause" glyph={phase === "paused" ? "▶" : "❚❚"} onPress={togglePause} />
          <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
        </View>
      </View>
      <Body style={st.msg}>{msg}</Body>

      {/* table surface behind the board */}
      <View pointerEvents="none" style={st.felt} />

      <View style={st.boardWrap}>
        {/* gentle mock-3D tilt; slab gives the board a thick edge */}
        <View style={st.boardTilt}>
        <View style={st.slab}>
        <View style={[st.board, { width: BOARD, height: BOARD }]}>
          {board.map((row, r) =>
            row.map((v, c) => {
              const selected = !!sel && sel.r === r && sel.c === c;
              const target = isTarget(r, c);
              const lit = lastPath.some((p) => p.r === r && p.c === c);
              const movable = isSelectable(r, c) && !selected && turn === "player" && !over;
              return (
                <Pressable
                  key={`${r}-${c}`}
                  onPress={() => onCell(r, c)}
                  style={[st.sq, { left: c * SZ, top: r * SZ, width: SZ, height: SZ }]}
                >
                  <Sprite source={isDark(r, c) ? SQ_DARK : SQ_LIGHT} size={SZ} style={st.sqImg} />
                  {lit ? <View style={[st.lit, { width: SZ, height: SZ }]} /> : null}
                  {v !== 0 ? <Sprite source={PIECE_IMG[v]} size={SZ} /> : null}
                  {selected ? <View style={[st.ring, { width: SZ * 0.9, height: SZ * 0.9, borderRadius: SZ * 0.45, borderColor: color.text }]} /> : null}
                  {movable ? <View style={[st.ring, { width: SZ * 0.9, height: SZ * 0.9, borderRadius: SZ * 0.45, borderColor: "rgba(90,230,150,0.75)" }]} /> : null}
                  {target ? <View style={[st.dot, { width: SZ * 0.32, height: SZ * 0.32, borderRadius: SZ * 0.16 }]} /> : null}
                </Pressable>
              );
            }),
          )}
          <EffectsLayer ref={fx} reduced={reducedMotion} />
        </View>
        </View>
        </View>
      </View>

      {/* subtle vignette for depth (never blocks taps) */}
      <View pointerEvents="none" style={st.vignette} />

      <GameOverlay
        visible={phase === "ready"}
        kind="pause"
        title="DRAUGHTS"
        primaryLabel="Play"
        onPrimary={start}
        onExit={onExit}
      >
        <Body muted style={{ textAlign: "center", marginTop: space.md }}>
          You are amber at the bottom. Move diagonally; captures are forced. Reach
          the far row to crown a king.
        </Body>
      </GameOverlay>

      <GameOverlay
        visible={phase === "paused" && !over}
        kind="pause"
        title="PAUSED"
        primaryLabel="Resume"
        onPrimary={togglePause}
        onExit={onExit}
      />

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
  fill: { flex: 1, backgroundColor: "#0A1018" },
  felt: { position: "absolute", left: 0, right: 0, top: "28%", bottom: 0, backgroundColor: "#15321F", opacity: 0.5 },
  vignette: { ...StyleSheet.absoluteFillObject, boxShadow: "inset 0 0 130px 26px rgba(0,0,0,0.5)" },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingBottom: space.sm },
  msg: { color: color.text, textAlign: "center", paddingHorizontal: space.lg, marginBottom: space.sm, minHeight: 40 },
  boardWrap: { alignItems: "center" },
  // mock-3D: gentle tilt + the board's drop shadow on the table
  boardTilt: { transform: [{ perspective: 900 }, { rotateX: "15deg" }], boxShadow: "0 24px 32px rgba(0,0,0,0.6)" },
  // slab = the board's wooden thickness (darker rim, deeper front lip)
  slab: { backgroundColor: "#2A1A0E", borderRadius: radius.md + 3, paddingHorizontal: 6, paddingTop: 6, paddingBottom: 15, borderWidth: 1, borderColor: "#3C2A1A" },
  board: { position: "relative", borderRadius: radius.md, overflow: "hidden", borderWidth: 2, borderColor: color.surfaceLine },
  sq: { position: "absolute", alignItems: "center", justifyContent: "center" },
  sqImg: { position: "absolute", left: 0, top: 0 },
  lit: { position: "absolute", left: 0, top: 0, backgroundColor: "rgba(255,152,0,0.30)" },
  ring: { position: "absolute", borderWidth: 3 },
  dot: { position: "absolute", backgroundColor: color.success, opacity: 0.9 },
});

export const draughtsGame: GameModule = {
  id: "draughts",
  title: "Draughts",
  kind: "turn-based",
  Screen,
};
