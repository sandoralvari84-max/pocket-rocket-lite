import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable, Dimensions, Image, Animated, Easing } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space } from "../design/tokens";
import { PixelText, Body, IconButton, GameOverlay } from "../design/ui";
import { useSettings } from "../settings";

// Pen-and-paper on a tabletop: a cream sheet lying on a warm wooden desk, with the
// four-in-a-row grid and discs doodled in ink — same surface as Three in a Row.
const SHEET = require("../../assets/arcade/paper/sheet_a.jpg"); // generated paper-on-table surface
const INK = "#2E5CB8";     // blue biro (the player's discs)
const INK_RIM = "#1E3E80";
const RED = "#C0392B";     // red pen (the machine's discs)
const RED_RIM = "#8C271B";
const GRID_INK = "#26324A"; // navy ink for the hand-drawn grid
const TABLE = "#1C1109";    // deep warm wood (base of the desk)

// Fixed ink colours, readable on cream paper: player = blue biro, machine = red pen.
const PLAYER = { base: INK, rim: INK_RIM };
const MACHINE = { base: RED, rim: RED_RIM };

type Disc = "P" | "M" | null; // P = player, M = machine
type Board = Disc[]; // row-major, length COLS*ROWS, index 0 = top-left

const COLS = 7;
const ROWS = 6;
const NEED = 4;
const DEPTH = 6; // alpha-beta search depth

// The grid is drawn directly on the generated paper sheet. These map the paper's
// writing area (slightly wider than Tic-Tac-Toe's, since the grid is 7 wide) to px.
const { width: W } = Dimensions.get("window");
const ART_AR = 784 / 1168;                        // sheet_a.jpg aspect
const SHEET_W = Math.min(W - 24, 340);
const SHEET_H = Math.round(SHEET_W / ART_AR);
const PAP = { x0: 0.21, x1: 0.81, y0: 0.26, y1: 0.70 }; // wider paper writing rect (frac)
const papL = PAP.x0 * SHEET_W, papT = PAP.y0 * SHEET_H;
const papW = (PAP.x1 - PAP.x0) * SHEET_W, papH = (PAP.y1 - PAP.y0) * SHEET_H;
// Fit the 7x6 grid inside the paper writing area, centred. A square cell keeps the
// grid regular; floor() avoids the sub-pixel wrap that once garbled the layout.
const CELL = Math.floor(Math.min(papW / 7, papH / 6));
const gridW = CELL * 7;
const gridH = CELL * 6;
const boardL = Math.round(papL + (papW - gridW) / 2);
const boardT = Math.round(papT + (papH - gridH) / 2);
const DISC = Math.floor(CELL * 0.74); // inked disc diameter

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

// Same test, but returns the exact cells of the winning line (for highlighting).
function winnerCellsAt(b: Board, r: number, c: number): number[] | null {
  const who = b[idx(r, c)];
  if (!who) return null;
  for (const [dr, dc] of DIRS) {
    const cells = [idx(r, c)];
    for (let s = 1; s < NEED; s++) {
      const nr = r + dr * s, nc = c + dc * s;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || b[idx(nr, nc)] !== who) break;
      cells.push(idx(nr, nc));
    }
    for (let s = 1; s < NEED; s++) {
      const nr = r - dr * s, nc = c - dc * s;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || b[idx(nr, nc)] !== who) break;
      cells.push(idx(nr, nc));
    }
    if (cells.length >= NEED) return cells;
  }
  return null;
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

/* ---- Sketchy ink grid line: two overlapping strokes with a tiny tilt ---- */
function SketchLine({ vertical, left, top, length }: { vertical?: boolean; left: number; top: number; length: number }) {
  const thick = vertical ? { width: 3, height: length } : { width: length, height: 3 };
  const thin = vertical ? { width: 1.6, height: length } : { width: length, height: 1.6 };
  return (
    <View pointerEvents="none" style={{ position: "absolute", left, top }}>
      <View style={[st.sketch, thick, { backgroundColor: GRID_INK, transform: [{ rotate: vertical ? "0.5deg" : "-0.4deg" }] }]} />
      <View style={[st.sketch, thin, { position: "absolute", backgroundColor: GRID_INK, opacity: 0.4, transform: [{ rotate: vertical ? "-0.6deg" : "0.5deg" }, vertical ? { translateX: 1.2 } : { translateY: 1.2 }] }]} />
    </View>
  );
}

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useSettings();
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [started, setStarted] = useState(false); // pre-game "ready" gate
  const [result, setResult] = useState<"win" | "lose" | "draw" | null>(null);
  const [status, setStatus] = useState("Your turn — drop into a column");
  const [quip, setQuip] = useState("");
  const [last, setLast] = useState<number | null>(null);
  const [winCells, setWinCells] = useState<number[]>([]);
  const [dropCell, setDropCell] = useState<number | null>(null); // cell index currently falling

  // Drop animation: an accelerating fall (translateY, native-driven) ending in a
  // small squash "thunk". fallY is the disc's vertical offset in px; squash drives
  // a brief scaleX up / scaleY down on landing. A placed disc is ALWAYS rendered in
  // its seat — the transform only offsets it while falling — so an interrupted
  // animation can never strand a disc off-screen.
  const fallY = useRef(new Animated.Value(0)).current;
  const squash = useRef(new Animated.Value(0)).current;
  const winPulse = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropSafety = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runDrop = (cell: number) => {
    if (reducedMotion) { setDropCell(null); return; }
    const r = Math.floor(cell / COLS);
    const startY = -(CELL * (r + 1)); // from above the top opening of the grid
    const fall = 200 + r * 40;        // deeper rows fall a little longer
    setDropCell(cell);
    fallY.setValue(startY);
    squash.setValue(0);
    Animated.sequence([
      // accelerating drop
      Animated.timing(fallY, { toValue: 0, duration: fall, easing: Easing.in(Easing.quad), useNativeDriver: false }),
      // impact squash + settle back (the satisfying "thunk")
      Animated.timing(squash, { toValue: 1, duration: 80, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(squash, { toValue: 0, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: false }),
    ]).start(({ finished }) => { if (finished) setDropCell(null); });
    // Safety: the disc always ends fully seated even if the animation is pre-empted.
    if (dropSafety.current) clearTimeout(dropSafety.current);
    dropSafety.current = setTimeout(() => setDropCell(null), fall + 400);
  };

  // Pulse the four winning discs (opacity loop is native-driver safe).
  useEffect(() => {
    winPulse.stopAnimation();
    if (winCells.length === 0) { winPulse.setValue(0); return; }
    if (reducedMotion) { winPulse.setValue(1); return; }
    winPulse.setValue(0.3);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(winPulse, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(winPulse, { toValue: 0.3, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [winCells, reducedMotion, winPulse]);

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
      if (row !== -1 && winnerAt(next, row, c)) {
        setWinCells(winnerCellsAt(next, row, c) ?? []);
        setStatus("The machine connects four.");
        setResult("lose"); setOver(true); return;
      }
      if (legalColumns(next).length === 0) { setStatus("The board is full — a draw."); setResult("draw"); setOver(true); return; }
      setStatus("Your turn — drop into a column");
      fetchTaunt();
    }, 420);
  };

  const onColumn = (c: number) => {
    if (busy || over || !started) return;
    const { next, row } = placeInto(board, c, "P");
    if (row === -1) return;
    setBoard(next);
    setLast(idx(row, c));
    runDrop(idx(row, c));
    setQuip("");
    if (winnerAt(next, row, c)) {
      setWinCells(winnerCellsAt(next, row, c) ?? []);
      setStatus("You connect four — you win!");
      setResult("win"); setOver(true); return;
    }
    if (legalColumns(next).length === 0) { setStatus("The board is full — a draw."); setResult("draw"); setOver(true); return; }
    machineTurn(next);
  };

  const reset = () => {
    if (timer.current) clearTimeout(timer.current);
    if (dropSafety.current) clearTimeout(dropSafety.current);
    fallY.setValue(0);
    squash.setValue(0);
    setDropCell(null);
    setBoard(emptyBoard());
    setOver(false);
    setResult(null);
    setBusy(false);
    setQuip("");
    setLast(null);
    setWinCells([]);
    setStatus("Your turn — drop into a column");
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (dropSafety.current) clearTimeout(dropSafety.current);
  }, []);

  const scaleX = squash.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const scaleY = squash.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] });

  // Clamp grid-line positions so every rule stays inside the clipped board box.
  const vLeft = (n: number) => Math.min(Math.max(n * CELL - 1.5, 0), gridW - 3);
  const hTop = (n: number) => Math.min(Math.max(n * CELL - 1.5, 0), gridH - 3);

  return (
    <View style={st.fill}>
      <View style={[st.top, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <PixelText size="h2" style={{ color: color.amber }}>FOUR UP</PixelText>
        <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
      </View>

      <View style={st.body}>
        <Body style={st.status}>{status}</Body>

        {/* the generated paper-on-table sheet; the grid is drawn on the page */}
        <View style={{ width: SHEET_W, height: SHEET_H }}>
          <Image source={SHEET} resizeMode="cover" fadeDuration={0} style={st.sheetImg} />
          <View style={[st.grid, { position: "absolute", left: boardL, top: boardT, width: gridW, height: gridH }]}>
            {/* # hand-drawn ink grid: 8 verticals x 7 horizontals rule the box */}
            {Array.from({ length: COLS + 1 }, (_, n) => (
              <SketchLine key={`v${n}`} vertical left={vLeft(n)} top={0} length={gridH} />
            ))}
            {Array.from({ length: ROWS + 1 }, (_, n) => (
              <SketchLine key={`h${n}`} left={0} top={hTop(n)} length={gridW} />
            ))}

            {/* one Pressable per column spans the full height; discs seat inside */}
            {Array.from({ length: COLS }, (_, c) => (
              <Pressable
                key={c}
                style={[st.colTap, { left: c * CELL, width: CELL, height: gridH }]}
                disabled={busy || over || !started}
                onPress={() => onColumn(c)}
              >
                {Array.from({ length: ROWS }, (_, r) => {
                  const cell = idx(r, c);
                  const v = board[cell];
                  const isLast = last === cell && winCells.length === 0;
                  const inWin = winCells.includes(cell);
                  const falling = dropCell === cell && !reducedMotion;
                  const paint = v === "P" ? PLAYER : v === "M" ? MACHINE : null;
                  return (
                    <View key={r} style={[st.slot, { width: CELL, height: CELL }]}>
                      {v === null || paint === null ? (
                        // empty cell = the cream paper showing through, with a faint pencilled ring
                        <View style={[st.empty, { width: DISC, height: DISC, borderRadius: DISC / 2 }]} />
                      ) : (
                        <>
                          <Animated.View
                            style={[
                              st.disc,
                              { width: DISC, height: DISC, borderRadius: DISC / 2, backgroundColor: paint.base, borderColor: paint.rim },
                              isLast && st.lastRing,
                              falling && { transform: [{ translateY: fallY }, { scaleX }, { scaleY }] },
                            ]}
                          />
                          {inWin ? (
                            <Animated.View
                              pointerEvents="none"
                              style={[
                                st.winRing,
                                { width: DISC + 7, height: DISC + 7, borderRadius: (DISC + 7) / 2, opacity: winPulse },
                              ]}
                            />
                          ) : null}
                        </>
                      )}
                    </View>
                  );
                })}
              </Pressable>
            ))}
          </View>
        </View>

        {quip ? <Body muted style={st.quip}>“{quip}”</Body> : <View style={{ height: 24 }} />}
      </View>

      <GameOverlay
        visible={!started}
        kind="pause"
        title="FOUR UP"
        primaryLabel="Play"
        onPrimary={() => setStarted(true)}
        onExit={onExit}
      >
        <Body muted style={{ textAlign: "center", marginTop: space.md }}>
          Drop discs into the columns. Line up four of your colour — across, down, or
          diagonally — before the machine does.
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

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: TABLE },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingBottom: space.sm },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md },
  status: { color: color.text, fontWeight: "700", textAlign: "center", paddingHorizontal: space.lg },

  sheetImg: { width: SHEET_W, height: SHEET_H, borderRadius: 12 },
  grid: { backgroundColor: "transparent", overflow: "hidden" },
  sketch: { borderRadius: 2 },
  colTap: { position: "absolute", top: 0, flexDirection: "column" },
  slot: { alignItems: "center", justifyContent: "center" },
  // empty cell: a faint pencilled ring, cream paper showing through
  empty: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: "rgba(38,50,74,0.22)" },
  // seated disc: a flat inked circle with a darker rim, a touch of hand-drawn shadow
  disc: { borderWidth: 2.5, boxShadow: "0 1px 2px rgba(28,17,9,0.28)" },
  lastRing: { borderColor: TABLE },
  winRing: { position: "absolute", borderWidth: 3, borderColor: GRID_INK, backgroundColor: "transparent" },
  quip: { fontStyle: "italic", textAlign: "center", paddingHorizontal: space.xl, minHeight: 24, color: color.text },
});

export const fourUpGame: GameModule = {
  id: "four-up",
  title: "Four Up",
  kind: "turn-based",
  Screen,
};
