import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, GameOverlay } from "../design/ui";
import { EffectsLayer, type EffectsHandle } from "../design/effects";
import { useSettings } from "../settings";

/* =============================================================================
 *  MALOM — Nine Men's Morris / Mill.  (Module id stays "draughts".)
 *
 *  Board: 24 points = three nested squares joined at the side midpoints.
 *  Each side has 9 men. Three phases: PLACE → MOVE → FLY (at 3 men left).
 *  Completing a mill (three in a line) removes one opponent man. A player
 *  loses when reduced to two men, or (in the moving phase) has no legal move.
 *
 *  Values on the 24-cell board: 0 empty | 1 player (amber/ivory) | 2 machine (dark/red).
 *  The player sits at the bottom colour of the old draughts set and moves first.
 *  The AI is a deterministic alpha-beta minimax (never the LLM); the LLM is
 *  used only for optional smug banter after a capture.
 * ========================================================================== */

type Side = 1 | 2;
const PLAYER = 1 as const;
const MACHINE = 2 as const;

// A full ply: from === -1 means a placement; remove >= 0 means a mill took that man.
interface Ply { from: number; to: number; remove: number; }
// Search state: the 24-cell board plus men still in each player's hand.
interface GS { b: number[]; hP: number; hM: number; }

// --- The 24 points as (col,row) on a 7x7 grid (both 0..6), index 0..23. ---
const POINTS: Array<[number, number]> = [
  [0, 0], [3, 0], [6, 0], [1, 1], [3, 1], [5, 1], [2, 2], [3, 2], [4, 2],
  [0, 3], [1, 3], [2, 3], [4, 3], [5, 3], [6, 3],
  [2, 4], [3, 4], [4, 4], [1, 5], [3, 5], [5, 5], [0, 6], [3, 6], [6, 6],
];

// --- The 16 mills (lines of three). ---
const MILLS: number[][] = [
  // Horizontal
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], [15, 16, 17], [18, 19, 20], [21, 22, 23],
  // Vertical
  [0, 9, 21], [3, 10, 18], [6, 11, 15], [1, 4, 7], [16, 19, 22], [8, 12, 17], [5, 13, 20], [2, 14, 23],
];

// --- Adjacency, derived from the mills: within each line a↔b and b↔c. ---
const ADJ: number[][] = Array.from({ length: 24 }, () => [] as number[]);
const link = (x: number, y: number): void => {
  if (!ADJ[x].includes(y)) ADJ[x].push(y);
  if (!ADJ[y].includes(x)) ADJ[y].push(x);
};
for (const [a, b, c] of MILLS) { link(a, b); link(b, c); }

// Mill lines passing through each point (for fast "did this close a mill?").
const MILLS_BY_POINT: number[][][] = Array.from({ length: 24 }, () => [] as number[][]);
for (const line of MILLS) for (const p of line) MILLS_BY_POINT[p].push(line);

// --- Pure board helpers (operate on a flat number[24]). ---
const countMen = (b: number[], side: Side): number => {
  let n = 0;
  for (let i = 0; i < 24; i++) if (b[i] === side) n++;
  return n;
};
const emptyPoints = (b: number[]): number[] => {
  const out: number[] = [];
  for (let i = 0; i < 24; i++) if (b[i] === 0) out.push(i);
  return out;
};
// Does `point` belong to a fully-own mill line on board b?
const millLineAt = (b: number[], point: number, side: Side): number[] | null => {
  for (const line of MILLS_BY_POINT[point]) {
    if (b[line[0]] === side && b[line[1]] === side && b[line[2]] === side) return line;
  }
  return null;
};
const inAnyMill = (b: number[], point: number, side: Side): boolean => millLineAt(b, point, side) !== null;

// Opponent men that may be removed: those NOT in a mill, unless all are (then any).
const removableTargets = (b: number[], mover: Side): number[] => {
  const opp = (mover === 1 ? 2 : 1) as Side;
  const men: number[] = [];
  for (let i = 0; i < 24; i++) if (b[i] === opp) men.push(i);
  const free = men.filter((p) => !inAnyMill(b, p, opp));
  return free.length > 0 ? free : men;
};

const handOf = (gs: GS, side: Side): number => (side === 1 ? gs.hP : gs.hM);
const canFly = (gs: GS, side: Side): boolean => handOf(gs, side) === 0 && countMen(gs.b, side) === 3;

// Base actions (ignoring any resulting mill removal): placements, slides, or flights.
function baseActions(gs: GS, side: Side): Array<{ from: number; to: number }> {
  const b = gs.b;
  const out: Array<{ from: number; to: number }> = [];
  if (handOf(gs, side) > 0) {
    for (let i = 0; i < 24; i++) if (b[i] === 0) out.push({ from: -1, to: i });
    return out;
  }
  const fly = canFly(gs, side);
  for (let f = 0; f < 24; f++) {
    if (b[f] !== side) continue;
    if (fly) {
      for (let t = 0; t < 24; t++) if (b[t] === 0) out.push({ from: f, to: t });
    } else {
      for (const t of ADJ[f]) if (b[t] === 0) out.push({ from: f, to: t });
    }
  }
  return out;
}

// Full legal plies (base action + removal choice when the action closes a mill).
function genPlies(gs: GS, side: Side): Ply[] {
  const b = gs.b;
  const out: Ply[] = [];
  for (const a of baseActions(gs, side)) {
    // Simulate in place to test the mill, then revert (no allocation).
    let mill: boolean;
    if (a.from === -1) {
      b[a.to] = side; mill = millLineAt(b, a.to, side) !== null; b[a.to] = 0;
    } else {
      b[a.from] = 0; b[a.to] = side; mill = millLineAt(b, a.to, side) !== null; b[a.from] = side; b[a.to] = 0;
    }
    if (mill) {
      // Apply the action for removable-set purposes.
      if (a.from === -1) b[a.to] = side; else { b[a.from] = 0; b[a.to] = side; }
      const targets = removableTargets(b, side);
      if (a.from === -1) b[a.to] = 0; else { b[a.from] = side; b[a.to] = 0; }
      if (targets.length === 0) out.push({ from: a.from, to: a.to, remove: -1 });
      else for (const r of targets) out.push({ from: a.from, to: a.to, remove: r });
    } else {
      out.push({ from: a.from, to: a.to, remove: -1 });
    }
  }
  return out;
}

function applyPly(gs: GS, side: Side, p: Ply): GS {
  const nb = gs.b.slice();
  let hP = gs.hP, hM = gs.hM;
  if (p.from === -1) { nb[p.to] = side; if (side === 1) hP--; else hM--; }
  else { nb[p.from] = 0; nb[p.to] = side; }
  if (p.remove >= 0) nb[p.remove] = 0;
  return { b: nb, hP, hM };
}

// A side has lost if it is out of hand AND is down to two men or has no move.
function sideLost(gs: GS, side: Side): boolean {
  if (handOf(gs, side) > 0) return false;
  if (countMen(gs.b, side) <= 2) return true;
  return baseActions(gs, side).length === 0;
}

// ---- Evaluation, from MACHINE (side 2) perspective. ----
function evaluate(gs: GS): number {
  const b = gs.b;
  const totM = countMen(b, 2) + gs.hM;
  const totP = countMen(b, 1) + gs.hP;
  let s = (totM - totP) * 100;
  let millM = 0, millP = 0, openM = 0, openP = 0;
  for (const line of MILLS) {
    const va = b[line[0]], vb = b[line[1]], vc = b[line[2]];
    const m = (va === 2 ? 1 : 0) + (vb === 2 ? 1 : 0) + (vc === 2 ? 1 : 0);
    const p = (va === 1 ? 1 : 0) + (vb === 1 ? 1 : 0) + (vc === 1 ? 1 : 0);
    if (m === 3) millM++; else if (m === 2 && p === 0) openM++;       // two + an empty = a threat
    if (p === 3) millP++; else if (p === 2 && m === 0) openP++;
  }
  s += (millM - millP) * 18 + (openM - openP) * 9;
  // Light mobility: empty neighbours of own men (favours freedom + blocks).
  let mobM = 0, mobP = 0;
  for (let i = 0; i < 24; i++) {
    const v = b[i];
    if (v === 0) continue;
    let free = 0;
    for (const n of ADJ[i]) if (b[n] === 0) free++;
    if (v === 2) mobM += free; else mobP += free;
  }
  s += (mobM - mobP) * 2;
  return s;
}

function minimax(gs: GS, side: Side, depth: number, alpha: number, beta: number): number {
  if (sideLost(gs, side)) return side === MACHINE ? -100000 - depth : 100000 + depth;
  if (depth <= 0) return evaluate(gs);
  const plies = genPlies(gs, side);
  // Mill-forming plies first — far better pruning.
  plies.sort((a, z) => (z.remove >= 0 ? 1 : 0) - (a.remove >= 0 ? 1 : 0));
  if (side === MACHINE) {
    let best = -Infinity;
    for (const m of plies) {
      best = Math.max(best, minimax(applyPly(gs, MACHINE, m), PLAYER, depth - 1, alpha, beta));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of plies) {
    best = Math.min(best, minimax(applyPly(gs, PLAYER, m), MACHINE, depth - 1, alpha, beta));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

function bestMachinePly(gs: GS): Ply | null {
  const plies = genPlies(gs, MACHINE);
  if (plies.length === 0) return null;
  // Adapt depth to branching so even low-end phones stay snappy on-tap.
  const nBase = baseActions(gs, MACHINE).length;
  const depth = nBase > 18 ? 2 : nBase > 10 ? 3 : 4;
  plies.sort((a, z) => (z.remove >= 0 ? 1 : 0) - (a.remove >= 0 ? 1 : 0));
  let bestScore = -Infinity;
  const bests: Ply[] = [];
  for (const m of plies) {
    const sc = minimax(applyPly(gs, MACHINE, m), PLAYER, depth - 1, -Infinity, Infinity);
    if (sc > bestScore + 0.5) { bestScore = sc; bests.length = 0; bests.push(m); }
    else if (sc >= bestScore - 0.5) bests.push(m);
  }
  return bests[Math.floor(Math.random() * bests.length)] ?? plies[0];
}

/* =============================================================================
 *  Geometry — map the 24 points onto the tilted wooden board.
 * ========================================================================== */
const { width: W } = Dimensions.get("window");
const BOARD = Math.min(W - space.lg * 2, 380);
const PAD = BOARD * 0.08;                       // inset so edge points don't clip
const STEP = (BOARD - 2 * PAD) / 6;             // one grid unit
const gx = (g: number): number => PAD + g * STEP;
const PT = POINTS.map(([c, r]) => ({ x: gx(c), y: gx(r) }));
const HIT = STEP * 0.9;                          // tap target per point (< STEP, so no overlap)
const DISC = STEP * 0.6;                          // playing-disc diameter
const SOCKET = STEP * 0.42;                       // engraved socket diameter
const LW = 3;                                     // engraved line thickness

// --- Warm wooden desk, built as a stacked vertical gradient (no gradient lib). ---
const mix = (a: string, b: string, t: number): string => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
};
const TABLE = "#1C1109";
const TABLE_TOP = "#5A3E22";
const TABLE_BOT = "#160C06";
const BANDS = Array.from({ length: 12 }, (_, i) => mix(TABLE_TOP, TABLE_BOT, i / 11));
const PLANKS = [0.18, 0.44, 0.71];

// Inlaid playing board + engraved lines.
const INLAY = "#C9A36A";   // warm maple inlay
const LINE = "#5C3B20";    // walnut engraving
const LINE_HL = "rgba(255,255,255,0.14)";
const SOCKET_FILL = "#7A5A33";

// Men: the warm ivory/amber set (player) vs the dark charcoal/red set (machine).
const DISCS = {
  player:  { base: "#ECCF92", rim: "#A9742B", edge: "#7C511C", groove: "#D8B87C", gloss: "rgba(255,255,255,0.55)" },
  machine: { base: "#3B2A2E", rim: "#8E2B2B", edge: "#140D0E", groove: "#5B3B3F", gloss: "rgba(255,255,255,0.22)" },
} as const;
type DiscStyle = typeof DISCS.player | typeof DISCS.machine;

/* ---- One physical man: darker base edge for thickness, glossy face with an
 *      engraved groove ring and a top-left highlight (reused from draughts). ---- */
function PieceDisc({ d, p }: { d: number; p: DiscStyle }) {
  const bw = Math.max(2, d * 0.06);
  return (
    <View style={{ width: d, height: d }}>
      {/* thickness: a darker disc peeking below the face */}
      <View style={{ position: "absolute", top: d * 0.12, left: 0, width: d, height: d, borderRadius: d / 2, backgroundColor: p.edge }} />
      {/* the face */}
      <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: p.base, borderWidth: bw, borderColor: p.rim, overflow: "hidden", boxShadow: "0 3px 4px rgba(0,0,0,0.4)" }}>
        <View style={{ position: "absolute", top: d * 0.17, left: d * 0.17, width: d * 0.66, height: d * 0.66, borderRadius: d * 0.33, borderWidth: Math.max(1.5, d * 0.04), borderColor: p.groove }} />
        <View style={{ position: "absolute", top: d * 0.11, left: d * 0.15, width: d * 0.44, height: d * 0.3, borderRadius: d * 0.22, backgroundColor: p.gloss }} />
      </View>
    </View>
  );
}

// An engraved square (border box) positioned by its top-left grid corner + span.
function EngravedSquare({ g0, span }: { g0: number; span: number }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: gx(g0), top: gx(g0), width: span * STEP, height: span * STEP }}>
      <View style={{ ...StyleSheet.absoluteFillObject, borderWidth: LW, borderColor: LINE, borderRadius: 2 }} />
      <View style={{ position: "absolute", left: 1, top: 1, right: -1, bottom: -1, borderWidth: 1, borderColor: LINE_HL, borderRadius: 2 }} />
    </View>
  );
}

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useSettings();
  const fx = useRef<EffectsHandle>(null);

  const [phase, setPhase] = useState<"ready" | "playing" | "paused">("ready");
  const [board, setBoard] = useState<number[]>(() => new Array(24).fill(0));
  const [handP, setHandP] = useState(9);
  const [handM, setHandM] = useState(9);
  const [turn, setTurn] = useState<"player" | "machine">("player");
  const [sel, setSel] = useState<number | null>(null);
  const [removal, setRemoval] = useState(false);      // player must take an opponent man
  const [over, setOver] = useState<null | "win" | "lose">(null);
  const [msg, setMsg] = useState("Place a piece on any point.");
  const [millGlow, setMillGlow] = useState<number[] | null>(null);
  const [lastMove, setLastMove] = useState<{ from: number; to: number } | null>(null);
  const busy = useRef(false);

  const reset = useCallback(() => {
    setBoard(new Array(24).fill(0));
    setHandP(9); setHandM(9);
    setTurn("player"); setSel(null); setRemoval(false); setOver(null);
    setMsg("Place a piece on any point.");
    setMillGlow(null); setLastMove(null);
    busy.current = false;
    setPhase("playing");
  }, []);

  const start = () => setPhase("playing");
  const togglePause = () => setPhase((p) => (p === "playing" ? "paused" : p === "paused" ? "playing" : p));
  const burstAt = (i: number) => fx.current?.burst(PT[i].x, PT[i].y, { count: 14, color: "#FF9800", speed: 150, size: 6 });

  // Derived, per-render view of the player's situation.
  const gsNow: GS = { b: board, hP: handP, hM: handM };
  const playerFly = canFly(gsNow, PLAYER);
  const playerPhase: "place" | "move" | "fly" = handP > 0 ? "place" : playerFly ? "fly" : "move";
  const selDests: number[] = sel === null ? [] : (playerFly ? emptyPoints(board) : ADJ[sel].filter((t) => board[t] === 0));
  const removableNow = removal ? removableTargets(board, PLAYER) : [];

  // Hand the turn to the machine (after checking it hasn't already lost).
  const finishPlayerTurn = (b: number[], hP: number, hM: number) => {
    const gs: GS = { b, hP, hM };
    if (sideLost(gs, MACHINE)) {
      setOver("win");
      setMsg(countMen(b, MACHINE) <= 2 ? "The machine is down to two pieces. You win!" : "The machine has no move. You win!");
      return;
    }
    setTurn("machine");
    setMsg("Machine thinking…");
  };

  // --- Machine turn: deterministic minimax on tap, never per-frame, never the LLM. ---
  useEffect(() => {
    if (turn !== "machine" || over || phase !== "playing") return;
    let alive = true;
    busy.current = true;
    const t = setTimeout(() => {
      if (!alive) return;
      const gs: GS = { b: board.slice(), hP: handP, hM: handM };
      const ply = bestMachinePly(gs);
      if (!ply) { setOver("win"); setMsg("The machine has no move. You win!"); busy.current = false; return; }
      const res = applyPly(gs, MACHINE, ply);
      setBoard(res.b);
      setHandM(res.hM);
      setSel(null);
      setLastMove({ from: ply.from, to: ply.to });
      if (ply.remove >= 0) { setMillGlow(millLineAt(res.b, ply.to, MACHINE)); burstAt(ply.remove); }
      else setMillGlow(null);

      const after: GS = { b: res.b, hP: handP, hM: res.hM };
      if (sideLost(after, PLAYER)) {
        setOver("lose");
        setMsg(countMen(res.b, PLAYER) <= 2 ? "You are down to two pieces. You lose." : "You have no legal move. You lose.");
        busy.current = false;
        return;
      }

      const act = ply.from === -1 ? "Machine placed a piece." : "Machine moved.";
      const took = ply.remove >= 0 ? " It formed a mill and took one of yours." : "";
      setMsg(`${act}${took} Your turn.`);
      setTurn("player");

      // Optional flavour only — never affects play.
      if (ply.remove >= 0) {
        ask("You are playing Nine Men's Morris (Malom) and just took one of the opponent's pieces with a mill. " +
            "One short smug sentence (max 10 words). No board talk.", "banter")
          .then((r) => { const q = r.trim().replace(/^["']|["']$/g, "").slice(0, 60); if (alive && q) setMsg(`Machine: “${q}”`); })
          .catch(() => {});
      }
      busy.current = false;
    }, 420);
    return () => { alive = false; clearTimeout(t); };
  }, [turn, over, board, handP, handM, ask, phase]);

  // --- Player input: one Pressable per point feeds this. ---
  const onPoint = (i: number): void => {
    if (over || turn !== "player" || busy.current || phase !== "playing") return;

    // REMOVE step after the player closed a mill.
    if (removal) {
      if (board[i] === MACHINE && removableNow.includes(i)) {
        const nb = board.slice(); nb[i] = 0;
        setBoard(nb); setRemoval(false); burstAt(i);
        finishPlayerTurn(nb, handP, handM);
      }
      return;
    }

    if (playerPhase === "place") {
      if (board[i] !== 0) return;
      const nb = board.slice(); nb[i] = PLAYER;
      const nh = handP - 1;
      setBoard(nb); setHandP(nh); setSel(null); setLastMove({ from: -1, to: i });
      const mill = millLineAt(nb, i, PLAYER);
      if (mill) { setMillGlow(mill); setRemoval(true); setMsg("Mill! Remove an opponent piece."); }
      else { setMillGlow(null); finishPlayerTurn(nb, nh, handM); }
      return;
    }

    // MOVE / FLY.
    if (board[i] === PLAYER) { setSel(i); setMsg(playerPhase === "fly" ? "Fly to any empty point." : "Slide along a line."); return; }
    if (sel !== null && board[i] === 0 && selDests.includes(i)) {
      const nb = board.slice(); nb[sel] = 0; nb[i] = PLAYER;
      setBoard(nb); setSel(null); setLastMove({ from: sel, to: i });
      const mill = millLineAt(nb, i, PLAYER);
      if (mill) { setMillGlow(mill); setRemoval(true); setMsg("Mill! Remove an opponent piece."); }
      else { setMillGlow(null); finishPlayerTurn(nb, handP, handM); }
    }
  };

  // Status helpers.
  const phaseWord = removal ? "Remove a piece" : turn === "machine" ? "Machine" : playerPhase === "place" ? "Place" : playerPhase === "fly" ? "Fly" : "Move";
  const statusLine = `${phaseWord}  ·  You ${countMen(board, PLAYER)} on board / ${handP} in hand  ·  Machine ${countMen(board, MACHINE)} / ${handM}`;

  // Highlight geometry for the glowing mill.
  let glowStyle: object | null = null;
  if (millGlow) {
    const a = PT[millGlow[0]], c = PT[millGlow[2]];
    const GH = Math.max(6, STEP * 0.14);
    if (a.y === c.y) glowStyle = { left: a.x, top: a.y - GH / 2, width: c.x - a.x, height: GH };
    else glowStyle = { left: a.x - GH / 2, top: a.y, width: GH, height: c.y - a.y };
  }

  return (
    <View style={st.fill}>
      {/* warm wooden desk: stacked gradient bands + faint plank seams */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {BANDS.map((c, i) => (<View key={i} style={{ flex: 1, backgroundColor: c }} />))}
      </View>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {PLANKS.map((p, i) => (
          <View key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `${p * 100}%`, width: 2, backgroundColor: "rgba(0,0,0,0.16)" }} />
        ))}
      </View>

      <View style={[st.top, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <PixelText size="h2" style={{ color: color.amber }}>MALOM</PixelText>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <IconButton label="Pause" glyph={phase === "paused" ? "▶" : "❚❚"} onPress={togglePause} />
          <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
        </View>
      </View>
      <Body style={st.msg}>{msg}</Body>
      <Body muted style={st.status}>{statusLine}</Body>

      <View style={st.boardWrap}>
        <View style={st.boardStage}>
          {/* soft blurred contact shadow so the board reads as resting on the desk */}
          <View pointerEvents="none" style={st.contactShadow} />

          {/* gentle mock-3D tilt; the slab under the board gives it a thick wooden edge */}
          <View style={st.boardTilt}>
            <View style={st.slab}>
              <View style={[st.board, { width: BOARD, height: BOARD }]}>
                {/* engraved board: three nested squares + four connecting spokes */}
                <EngravedSquare g0={0} span={6} />
                <EngravedSquare g0={1} span={4} />
                <EngravedSquare g0={2} span={2} />
                {/* top spoke: point 1→7 */}
                <View pointerEvents="none" style={[st.line, { left: gx(3) - LW / 2, top: gx(0), width: LW, height: 2 * STEP }]} />
                {/* bottom spoke: 16→22 */}
                <View pointerEvents="none" style={[st.line, { left: gx(3) - LW / 2, top: gx(4), width: LW, height: 2 * STEP }]} />
                {/* left spoke: 9→11 */}
                <View pointerEvents="none" style={[st.line, { left: gx(0), top: gx(3) - LW / 2, width: 2 * STEP, height: LW }]} />
                {/* right spoke: 12→14 */}
                <View pointerEvents="none" style={[st.line, { left: gx(4), top: gx(3) - LW / 2, width: 2 * STEP, height: LW }]} />

                {/* glowing mill */}
                {glowStyle ? <View pointerEvents="none" style={[st.glow, glowStyle]} /> : null}

                {/* the 24 points: socket + piece + overlays, each owning its own tap rect */}
                {PT.map((pt, i) => {
                  const v = board[i];
                  const selected = sel === i;
                  const target = sel !== null && selDests.includes(i);
                  const lit = !!lastMove && (lastMove.from === i || lastMove.to === i);
                  const movable = turn === "player" && !over && !removal && playerPhase !== "place" && v === PLAYER && !selected;
                  const takeable = removal && v === MACHINE && removableNow.includes(i);
                  return (
                    <Pressable
                      key={i}
                      onPress={() => onPoint(i)}
                      style={[st.hit, { left: pt.x - HIT / 2, top: pt.y - HIT / 2, width: HIT, height: HIT }]}
                    >
                      <View style={[st.socket, { width: SOCKET, height: SOCKET, borderRadius: SOCKET / 2 }]} />
                      {lit ? <View style={[st.litRing, { width: HIT * 0.84, height: HIT * 0.84, borderRadius: HIT * 0.42 }]} /> : null}
                      {v !== 0 ? <PieceDisc d={DISC} p={v === PLAYER ? DISCS.player : DISCS.machine} /> : null}
                      {selected ? <View style={[st.ring, { width: DISC * 1.2, height: DISC * 1.2, borderRadius: DISC * 0.6, borderColor: color.text }]} /> : null}
                      {movable ? <View style={[st.ring, { width: DISC * 1.2, height: DISC * 1.2, borderRadius: DISC * 0.6, borderColor: "rgba(90,230,150,0.75)" }]} /> : null}
                      {takeable ? <View style={[st.ring, { width: DISC * 1.2, height: DISC * 1.2, borderRadius: DISC * 0.6, borderColor: color.danger }]} /> : null}
                      {target ? <View style={[st.dot, { width: STEP * 0.3, height: STEP * 0.3, borderRadius: STEP * 0.15 }]} /> : null}
                    </Pressable>
                  );
                })}

                <EffectsLayer ref={fx} reduced={reducedMotion} />
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* subtle vignette for depth (never blocks taps) */}
      <View pointerEvents="none" style={st.vignette} />

      <GameOverlay
        visible={phase === "ready"}
        kind="pause"
        title="MALOM"
        primaryLabel="Play"
        onPrimary={start}
        onExit={onExit}
      >
        <Body muted style={{ textAlign: "center", marginTop: space.md }}>
          Place your 9 pieces, then slide them along the lines. Line up three in a
          row — a mill — to take one of the opponent's pieces. Reduce them to two
          and you win.
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

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: TABLE },
  vignette: { ...StyleSheet.absoluteFillObject, boxShadow: "inset 0 0 130px 26px rgba(0,0,0,0.5)" },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingBottom: space.sm },
  msg: { color: color.text, textAlign: "center", paddingHorizontal: space.lg, marginBottom: 2, minHeight: 40 },
  status: { textAlign: "center", paddingHorizontal: space.lg, marginBottom: space.sm },

  boardWrap: { alignItems: "center" },
  boardStage: { width: BOARD + 48, alignItems: "center", justifyContent: "center", paddingVertical: 18 },
  contactShadow: {
    position: "absolute", bottom: 6, left: 20, right: 20, height: BOARD * 0.5,
    borderRadius: BOARD, backgroundColor: "rgba(0,0,0,0.4)",
    boxShadow: "0 18px 34px 14px rgba(0,0,0,0.55)",
  },
  boardTilt: { transform: [{ perspective: 820 }, { rotateX: "12deg" }], boxShadow: "0 24px 32px rgba(0,0,0,0.6)" },
  slab: { backgroundColor: "#2A1A0E", borderRadius: radius.md + 4, paddingHorizontal: 7, paddingTop: 7, paddingBottom: 16, borderWidth: 1, borderColor: "#5A3E22" },
  board: { position: "relative", borderRadius: radius.md, overflow: "hidden", borderWidth: 3, borderColor: "#7A5531", backgroundColor: INLAY },

  line: { position: "absolute", backgroundColor: LINE, borderRadius: 2 },
  glow: { position: "absolute", backgroundColor: "rgba(255,152,0,0.45)", borderRadius: 4, boxShadow: "0 0 12px 3px rgba(255,152,0,0.65)" },

  hit: { position: "absolute", alignItems: "center", justifyContent: "center" },
  socket: { position: "absolute", backgroundColor: SOCKET_FILL, borderWidth: 1, borderColor: "rgba(0,0,0,0.35)", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)" },
  litRing: { position: "absolute", backgroundColor: "rgba(255,152,0,0.22)", borderRadius: 999 },
  ring: { position: "absolute", borderWidth: 3 },
  dot: { position: "absolute", backgroundColor: color.success, opacity: 0.9 },
});

export const draughtsGame: GameModule = {
  id: "draughts",
  title: "Malom",
  kind: "turn-based",
  Screen,
};
