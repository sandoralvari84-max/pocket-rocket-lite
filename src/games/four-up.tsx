import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable, Dimensions, Animated, Easing } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, GameOverlay } from "../design/ui";
import { useSettings } from "../settings";

type Disc = "P" | "M" | null; // P = player (amber), M = machine (cyan)
type Board = Disc[]; // row-major, length COLS*ROWS, index 0 = top-left

const COLS = 7;
const ROWS = 6;
const NEED = 4;
const DEPTH = 6; // alpha-beta search depth

// Chunky, near-full-width board. Size the slot from whichever of width/height
// is tighter so the grid keeps its aspect and fills as much screen as possible.
const { width: W, height: H } = Dimensions.get("window");
const PAD = 7; // inner padding of the board frame (per side)
const maxGridW = W - space.md * 2;
const maxGridH = H * 0.6;
const slotByW = Math.floor((maxGridW - PAD * 2) / COLS);
const slotByH = Math.floor((maxGridH - PAD * 2) / ROWS);
const SLOT = Math.max(48, Math.min(slotByW, slotByH)); // keep columns >= 48px touch target
const GRID_W = SLOT * COLS + PAD * 2;
const DISC = Math.floor(SLOT * 0.84);

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

const DIRS: ReadonlyArray<readonly [number, number]> = [[0, 1], [1, 0], [1, 1], [1, -1]];

// Did the disc just placed at (r,c) complete a line of NEED?
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

function placeInto(b: Board, c: number, who: Disc): { next: Board; row: number } {
  const row = dropRow(b, c);
  const next = b.slice();
  if (row !== -1) next[idx(row, c)] = who;
  return { next, row };
}

// ---- Heuristic for non-terminal leaves (from Machine's perspective). ----
function scoreWindow(cells: Disc[]): number {
  let m = 0, p = 0, e = 0;
  for (const v of cells) { if (v === "M") m++; else if (v === "P") p++; else e++; }
  if (m > 0 && p > 0) return 0; // mixed, dead
  if (m === 3 && e === 1) return 50;
  if (m === 2 && e === 2) return 10;
  if (m === 1 && e === 3) return 1;
  if (p === 3 && e === 1) return -80; // weight blocking slightly higher
  if (p === 2 && e === 2) return -10;
  if (p === 1 && e === 3) return -1;
  return 0;
}

function evaluate(b: Board): number {
  let score = 0;
  // center control
  for (let r = 0; r < ROWS; r++) {
    const v = b[idx(r, 3)];
    if (v === "M") score += 6; else if (v === "P") score -= 6;
  }
  // all length-4 windows
  const windows: Disc[][] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      for (const [dr, dc] of DIRS) {
        const er = r + dr * 3, ec = c + dc * 3;
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
        const w: Disc[] = [];
        for (let s = 0; s < NEED; s++) w.push(b[idx(r + dr * s, c + dc * s)]);
        windows.push(w);
      }
  for (const w of windows) score += scoreWindow(w);
  return score;
}

const ORDER = [3, 2, 4, 1, 5, 0, 6]; // center-first move ordering

function minimax(
  b: Board, depth: number, alpha: number, beta: number,
  maximizing: boolean, lastRow: number, lastCol: number,
): number {
  if (lastRow >= 0 && winnerAt(b, lastRow, lastCol)) {
    // The player who just moved won. If it is now the maximizer's turn,
    // the winner was the minimizer (player) -> negative, and vice versa.
    return maximizing ? -100000 - depth : 100000 + depth;
  }
  const cols = legalColumns(b);
  if (depth === 0 || cols.length === 0) return evaluate(b);
  const ordered = ORDER.filter((c) => cols.includes(c));
  if (maximizing) {
    let best = -Infinity;
    for (const c of ordered) {
      const { next, row } = placeInto(b, c, "M");
      best = Math.max(best, minimax(next, depth - 1, alpha, beta, false, row, c));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const c of ordered) {
    const { next, row } = placeInto(b, c, "P");
    best = Math.min(best, minimax(next, depth - 1, alpha, beta, true, row, c));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

function bestColumn(b: Board): number {
  const cols = legalColumns(b);
  const ordered = ORDER.filter((c) => cols.includes(c));
  let bestScore = -Infinity;
  let pick = ordered[0] ?? -1;
  for (const c of ordered) {
    const { next, row } = placeInto(b, c, "M");
    // Immediate win short-circuit (also handled by search, but keeps it crisp).
    if (winnerAt(next, row, c)) return c;
    const score = minimax(next, DEPTH - 1, -Infinity, Infinity, false, row, c);
    if (score > bestScore) { bestScore = score; pick = c; }
  }
  return pick;
}

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useSettings();
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [result, setResult] = useState<"win" | "lose" | "draw" | null>(null);
  const [status, setStatus] = useState("Your turn — drop into a column");
  const [quip, setQuip] = useState("");
  const [last, setLast] = useState<number | null>(null);
  const [dropCell, setDropCell] = useState<number | null>(null); // cell index currently settling
  const drop = useRef(new Animated.Value(1)).current; // 0 = just dropped, 1 = seated
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropSafety = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Settle a freshly placed disc with a bounded scale+fade "pop". A placed disc
  // is ALWAYS rendered in its slot; the pop only scales it up from small, so an
  // interrupted animation (e.g. the machine replying before the player's pop
  // finishes) can never strand a disc off-screen — the old disappearing bug.
  // Honors reduced motion: when on, the disc simply appears seated.
  const runDrop = (cell: number) => {
    if (reducedMotion) { setDropCell(null); return; }
    const r = Math.floor(cell / COLS);
    const ms = 150 + r * 42; // deeper rows fall a little longer
    setDropCell(cell);
    drop.setValue(0);
    Animated.timing(drop, {
      toValue: 1,
      duration: ms,
      easing: Easing.bounce,   // a real falling disc that settles with a bounce
      useNativeDriver: true,
    }).start(({ finished }) => { if (finished) setDropCell(null); });
    // Safety: the disc always ends fully seated even if the animation is pre-empted.
    if (dropSafety.current) clearTimeout(dropSafety.current);
    dropSafety.current = setTimeout(() => setDropCell(null), ms + 260);
  };

  const fetchTaunt = () => {
    ask(
      `We are playing a four-in-a-row drop game. You just dropped a disc. ` +
        `In ONE short sentence (max 10 words) give a cocky taunt. No numbers, no board talk.`,
      "banter",
    )
      .then((r) => { const t = r.trim().replace(/^["']|["']$/g, "").slice(0, 70); if (t) setQuip(t); })
      .catch(() => {});
  };

  const machineTurn = (b: Board) => {
    setStatus("Machine thinking…");
    setBusy(true);
    timer.current = setTimeout(() => {
      const c = bestColumn(b);
      const { next, row } = placeInto(b, c, "M");
      setBoard(next);
      setLast(row >= 0 ? idx(row, c) : null);
      if (row >= 0) runDrop(idx(row, c));
      setBusy(false);
      if (row !== -1 && winnerAt(next, row, c)) { setStatus("The machine connects four."); setResult("lose"); setOver(true); return; }
      if (legalColumns(next).length === 0) { setStatus("The board is full — a draw."); setResult("draw"); setOver(true); return; }
      setStatus("Your turn — drop into a column");
      fetchTaunt();
    }, 420);
  };

  const onColumn = (c: number) => {
    if (busy || over) return;
    const { next, row } = placeInto(board, c, "P");
    if (row === -1) return;
    setBoard(next);
    setLast(idx(row, c));
    runDrop(idx(row, c));
    setQuip("");
    if (winnerAt(next, row, c)) { setStatus("You connect four — you win!"); setResult("win"); setOver(true); return; }
    if (legalColumns(next).length === 0) { setStatus("The board is full — a draw."); setResult("draw"); setOver(true); return; }
    machineTurn(next);
  };

  const reset = () => {
    if (timer.current) clearTimeout(timer.current);
    if (dropSafety.current) clearTimeout(dropSafety.current);
    drop.setValue(1);
    setDropCell(null);
    setBoard(emptyBoard());
    setOver(false);
    setResult(null);
    setBusy(false);
    setQuip("");
    setLast(null);
    setStatus("Your turn — drop into a column");
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (dropSafety.current) clearTimeout(dropSafety.current);
  }, []);

  return (
    <View style={st.fill}>
      <View style={[st.top, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <PixelText size="h2" style={{ color: color.amber }}>FOUR UP</PixelText>
        <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
      </View>

      <View style={st.body}>
        <Body style={st.status}>{status}</Body>

        <View style={[st.grid, { width: GRID_W, padding: PAD }]}>
          {Array.from({ length: COLS }, (_, c) => (
            <Pressable key={c} style={st.colTap} disabled={busy || over} onPress={() => onColumn(c)}>
              {Array.from({ length: ROWS }, (_, r) => {
                const cell = idx(r, c);
                const v = board[cell];
                const isLast = last === cell;
                const falling = dropCell === cell && !reducedMotion;
                // Fall from the TOP of its own column (inside the board) down to
                // the seat — always on-screen, so a placed disc can never vanish.
                const translateY = falling
                  ? drop.interpolate({ inputRange: [0, 1], outputRange: [-r * SLOT, 0] })
                  : 0;
                return (
                  <View key={r} style={[st.slot, { width: SLOT, height: SLOT }]}>
                    {v === null ? (
                      <View style={[st.hole, { width: DISC, height: DISC, borderRadius: DISC / 2 }]} />
                    ) : (
                      <Animated.View
                        style={[
                          st.disc,
                          { width: DISC, height: DISC, borderRadius: DISC / 2 },
                          v === "P" ? st.player : st.machine,
                          isLast && st.lastRing,
                          falling && { transform: [{ translateY }] },
                        ]}
                      >
                        {/* top-left gloss highlight for a chunky, physical read */}
                        <View
                          style={[
                            st.gloss,
                            {
                              width: DISC * 0.5,
                              height: DISC * 0.34,
                              borderRadius: DISC * 0.25,
                              top: DISC * 0.12,
                              left: DISC * 0.16,
                            },
                          ]}
                        />
                      </Animated.View>
                    )}
                  </View>
                );
              })}
            </Pressable>
          ))}
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

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingBottom: space.sm },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.lg },
  status: { color: color.text, fontWeight: "700", textAlign: "center", paddingHorizontal: space.lg },
  grid: {
    flexDirection: "row", backgroundColor: "#1F2940", borderRadius: radius.lg,
    borderWidth: 3, borderColor: "#30406A",
    overflow: "hidden", // clip the falling disc to the board frame
  },
  colTap: { flexDirection: "column" },
  slot: { alignItems: "center", justifyContent: "center" },
  // empty cell = a punched hole in the board surface
  hole: { backgroundColor: "#0B0F1A", borderWidth: 2, borderColor: "rgba(0,0,0,0.5)" },
  // seated disc: chunky circle with a rim for dimensionality
  disc: { alignItems: "center", justifyContent: "flex-start", borderWidth: 3, overflow: "hidden" },
  gloss: { position: "absolute", backgroundColor: "rgba(255,255,255,0.28)" },
  player: { backgroundColor: color.amber, borderColor: color.amberDim },
  machine: { backgroundColor: color.cyan, borderColor: color.cyanDim },
  lastRing: { borderColor: color.text },
  quip: { fontStyle: "italic", textAlign: "center", paddingHorizontal: space.xl, minHeight: 24 },
});

export const fourUpGame: GameModule = {
  id: "four-up",
  title: "Four Up",
  kind: "turn-based",
  Screen,
};
