import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions, Animated, ImageBackground } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius, consoleUI, crt, glow } from "../design/tokens";
import { PixelText, IconButton, GameOverlay } from "../design/ui";
import { ScoreboardOverlay } from "../design/Scoreboard";
import { EffectsLayer, type EffectsHandle } from "../design/effects";
import { useSettings } from "../settings";

const SCANLINES = require("../../assets/crt/scanlines.png");

const { width: W, height: H } = Dimensions.get("window");
const COLS = 10;
const ROWS = 18;
const SIDE = 92; // side panel (next / hold / stats)
const CELL = Math.max(14, Math.floor(Math.min((W - SIDE - 34) / COLS, (H * 0.58) / ROWS)));
const BOARD_W = CELL * COLS;
const BOARD_H = CELL * ROWS;
const PCELL = Math.floor(CELL * 0.52); // preview cell
const CLEAR_MS = 170;

type Cell = string; // "" = empty, otherwise a colour
type Board = Cell[][];
interface Piece {
  id: number;
  cells: number[][]; // [x, y] offsets
  x: number;
  y: number;
  color: string;
}

// 7 tetrominoes, each a distinct on-palette colour.
const SHAPES: { cells: number[][]; color: string }[] = [
  { cells: [[0, 1], [1, 1], [2, 1], [3, 1]], color: color.cyan },   // I
  { cells: [[1, 0], [2, 0], [1, 1], [2, 1]], color: color.amber },  // O
  { cells: [[1, 0], [0, 1], [1, 1], [2, 1]], color: "#B36BE2" },    // T
  { cells: [[1, 0], [2, 0], [0, 1], [1, 1]], color: color.success },// S
  { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: color.danger }, // Z
  { cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: "#4C8DFF" },    // J
  { cells: [[2, 0], [0, 1], [1, 1], [2, 1]], color: "#FF8A3D" },    // L
];

function shade(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const cl = (c: number) => Math.max(0, Math.min(255, Math.round(c + amt)));
  const to = (c: number) => cl(c).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => "" as Cell));
}

// Deterministic SRS-lite rotation (CW): (x,y) -> (y,-x), then normalise to non-negative offsets.
function rotate(cells: number[][]): number[][] {
  const r = cells.map(([x, y]) => [y, -x]);
  const minX = Math.min(...r.map((c) => c[0]));
  const minY = Math.min(...r.map((c) => c[1]));
  return r.map(([x, y]) => [x - minX, y - minY]);
}

function collides(board: Board, cells: number[][], px: number, py: number): boolean {
  for (const [cx, cy] of cells) {
    const x = px + cx;
    const y = py + cy;
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y >= 0 && board[y][x] !== "") return true;
  }
  return false;
}

function shuffledBag(): number[] {
  const a = [0, 1, 2, 3, 4, 5, 6];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pieceFrom(id: number): Piece {
  // Guard against a bad/undefined index (e.g. an empty-queue shift) so a piece
  // is never created with `cells: undefined` — the cause of the "hit a snag" crash.
  const safe = Number.isInteger(id) && id >= 0 && id < SHAPES.length ? id : 0;
  const s = SHAPES[safe];
  return { id: safe, cells: s.cells.map((c) => [c[0], c[1]]), x: Math.floor(COLS / 2) - 2, y: 0, color: s.color };
}

// ---- cell renderers -------------------------------------------------------
// Glossy arcade cell: bevelled rim + a top phosphor highlight + a soft lower
// shade band so locked blocks read as chrome, not flat fills. Per-piece token
// colour is untouched; the gloss is pure overlay.
function BevelCell({ left, top, size, c }: { left: number; top: number; size: number; c: string }) {
  const s = size - 1;
  return (
    <View
      style={{
        position: "absolute", left, top, width: s, height: s, borderRadius: 2,
        backgroundColor: c, borderWidth: 2, overflow: "hidden",
        borderTopColor: shade(c, 55), borderLeftColor: shade(c, 30),
        borderRightColor: shade(c, -48), borderBottomColor: shade(c, -62),
      }}
    >
      {/* top gloss highlight */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute", left: 0, right: 0, top: 0, height: Math.round(s * 0.46),
          backgroundColor: "rgba(255,255,255,0.22)",
        }}
      />
      {/* crisp specular line along the very top */}
      <View
        pointerEvents="none"
        style={{ position: "absolute", left: 0, right: 0, top: 0, height: 1, backgroundColor: "rgba(255,255,255,0.4)" }}
      />
      {/* lower inner shade for depth */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0, height: Math.round(s * 0.3),
          backgroundColor: "rgba(0,0,0,0.2)",
        }}
      />
    </View>
  );
}
function GhostCell({ left, top, size, c }: { left: number; top: number; size: number; c: string }) {
  return (
    <View style={{ position: "absolute", left, top, width: size - 1, height: size - 1, borderRadius: 2, borderWidth: 2, borderColor: c, opacity: 0.45 }} />
  );
}

// Faint cell gridlines so the empty well reads as a playfield (very low alpha).
function WellGrid() {
  const lines: React.ReactNode[] = [];
  for (let x = 1; x < COLS; x++)
    lines.push(
      <View key={`v${x}`} pointerEvents="none" style={{ position: "absolute", left: x * CELL, top: 0, width: 1, height: BOARD_H, backgroundColor: "rgba(255,255,255,0.055)" }} />
    );
  for (let y = 1; y < ROWS; y++)
    lines.push(
      <View key={`h${y}`} pointerEvents="none" style={{ position: "absolute", left: 0, top: y * CELL, width: BOARD_W, height: 1, backgroundColor: "rgba(255,255,255,0.045)" }} />
    );
  return <>{lines}</>;
}

// Ambient backdrop: coarse console grid + low ambient amber/cyan glow + scanlines.
// All LOW intensity and static — never reduces block contrast, costs nothing per frame.
function Backdrop() {
  const grid: React.ReactNode[] = [];
  const GS = 44;
  for (let x = GS; x < W; x += GS)
    grid.push(<View key={`bv${x}`} style={{ position: "absolute", left: x, top: 0, width: 1, height: H, backgroundColor: "rgba(120,150,180,0.035)" }} />);
  for (let y = GS; y < H; y += GS)
    grid.push(<View key={`bh${y}`} style={{ position: "absolute", left: 0, top: y, width: W, height: 1, backgroundColor: "rgba(120,150,180,0.03)" }} />);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color.bg }]}>
      {/* soft ambient amber glow, upper area */}
      <View style={{ position: "absolute", top: H * 0.12, alignSelf: "center", width: 220, height: 140, borderRadius: 999, boxShadow: "0 0 180px 70px rgba(255,152,0,0.055)" } as any} />
      {/* soft ambient cyan glow, lower area */}
      <View style={{ position: "absolute", bottom: H * 0.1, alignSelf: "center", width: 220, height: 140, borderRadius: 999, boxShadow: "0 0 180px 70px rgba(0,229,255,0.045)" } as any} />
      {grid}
      <ImageBackground source={SCANLINES} resizeMode="repeat" style={StyleSheet.absoluteFill} imageStyle={{ opacity: 0.05 }} />
    </View>
  );
}

function MiniPiece({ id }: { id: number | null }) {
  const box = PCELL * 4 + 8;
  if (id == null) return <View style={[st.miniBox, { width: box, height: box }]} />;
  const s = SHAPES[id];
  if (!s) return <View style={[st.miniBox, { width: box, height: box }]} />;
  const xs = s.cells.map((c) => c[0]);
  const ys = s.cells.map((c) => c[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const ox = (4 - (maxx - minx + 1)) / 2 - minx;
  const oy = (4 - (maxy - miny + 1)) / 2 - miny;
  return (
    <View style={[st.miniBox, { width: box, height: box }]}>
      {s.cells.map(([cx, cy], i) => (
        <BevelCell key={i} left={4 + (cx + ox) * PCELL} top={4 + (cy + oy) * PCELL} size={PCELL} c={s.color} />
      ))}
    </View>
  );
}

// Console-panel wrapper for the side column (surface + border + mono label).
function SidePanel({ label, children, accent }: { label: string; children?: React.ReactNode; accent?: string }) {
  return (
    <View style={st.panel}>
      <PixelText size="label" style={[st.panelLabel, accent ? { color: accent } : null]}>{label}</PixelText>
      {children}
    </View>
  );
}
function StatPanel({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={st.statPanel}>
      <PixelText size="label" style={st.panelLabel}>{label}</PixelText>
      <Text style={[st.statValue, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  );
}

function GameScreen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useSettings();
  const fx = useRef<EffectsHandle>(null);
  const boardRef = useRef<Board>(emptyBoard());
  const queueRef = useRef<number[]>(shuffledBag());
  const pieceRef = useRef<Piece>(pieceFrom(queueRef.current.shift() as number));
  const heldRef = useRef<number | null>(null);
  const holdUsedRef = useRef(false);
  const phaseRef = useRef<"play" | "clear" | "over">("play");
  const clearRowsRef = useRef<number[]>([]);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const linesRef = useRef(0);
  const levelRef = useRef(1);
  const accRef = useRef(0);
  const lastRef = useRef(Date.now());

  const [, setTick] = useState(0);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [over, setOver] = useState(false);
  const [, setNextTick] = useState(0); // force preview refresh
  const bump = () => setTick((t) => (t + 1) % 1000000);

  // Visual-only: full-well flash for tetris / level-up (never affects logic).
  const flashAnim = useRef(new Animated.Value(0)).current;
  const [flashColor, setFlashColor] = useState<string>(color.amber);
  const triggerFlash = (col: string, peak: number) => {
    if (reducedMotion) return; // decoration only
    setFlashColor(col);
    flashAnim.setValue(peak);
    Animated.timing(flashAnim, { toValue: 0, duration: 260, useNativeDriver: true }).start();
  };

  const dropMs = () => Math.max(85, 800 - (levelRef.current - 1) * 65);

  const nextFromQueue = (): Piece => {
    if (queueRef.current.length < 2) queueRef.current.push(...shuffledBag());
    let id = queueRef.current.shift();
    if (id == null) { queueRef.current.push(...shuffledBag()); id = queueRef.current.shift(); }
    setNextTick((n) => n + 1);
    return pieceFrom(id as number);
  };

  const gameOver = () => {
    phaseRef.current = "over";
    setOver(true);
  };

  const spawnNext = () => {
    const p = nextFromQueue();
    holdUsedRef.current = false;
    if (collides(boardRef.current, p.cells, p.x, p.y)) {
      pieceRef.current = p;
      gameOver();
      return;
    }
    pieceRef.current = p;
  };

  const finishClear = (full: number[]) => {
    const b = boardRef.current;
    const fset = new Set(full);
    const kept: Board = [];
    for (let y = 0; y < ROWS; y++) if (!fset.has(y)) kept.push(b[y]);
    while (kept.length < ROWS) kept.unshift(Array.from({ length: COLS }, () => "" as Cell));
    boardRef.current = kept;
    clearRowsRef.current = [];
    const n = full.length;
    const pts = ([0, 100, 300, 500, 800][n] ?? 800) * levelRef.current;
    setScore((s) => s + pts);
    // line-clear feedback: a bounded sparkle along each cleared row + a score pop.
    const popCol = n >= 4 ? color.amber : color.cyan;
    for (const y of full)
      for (let x = 0; x < COLS; x += 2)
        fx.current?.burst(x * CELL + CELL / 2, y * CELL + CELL / 2, { count: 2, color: popCol, speed: 95, size: 4 });
    fx.current?.popScore(BOARD_W / 2, full[0] * CELL + CELL / 2, `+${pts}`, popCol);
    // juice: a bigger central burst + brighter full-well flash on a Tetris.
    if (n >= 4) {
      fx.current?.burst(BOARD_W / 2, full[0] * CELL + CELL / 2, { count: 18, color: color.amber, speed: 150, size: 5, rise: 20 });
      triggerFlash(color.amber, 0.5);
    }
    const prevLvl = levelRef.current;
    const nl = linesRef.current + n;
    linesRef.current = nl; setLines(nl);
    const lvl = Math.floor(nl / 10) + 1;
    levelRef.current = lvl; setLevel(lvl);
    if (lvl > prevLvl) triggerFlash(color.cyan, 0.32); // subtle level-up flash
    phaseRef.current = "play";
    spawnNext();
    bump();
  };

  const lockAndNext = () => {
    const b = boardRef.current;
    const p = pieceRef.current;
    for (const [cx, cy] of p.cells) {
      const y = p.y + cy, x = p.x + cx;
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) b[y][x] = p.color;
    }
    const full: number[] = [];
    for (let y = 0; y < ROWS; y++) if (b[y].every((c) => c !== "")) full.push(y);
    if (full.length) {
      clearRowsRef.current = full;
      phaseRef.current = "clear";
      bump();
      clearTimerRef.current = setTimeout(() => finishClear(full), CLEAR_MS);
    } else {
      spawnNext();
    }
  };

  const gravityStep = () => {
    if (phaseRef.current !== "play") return;
    const p = pieceRef.current;
    if (!collides(boardRef.current, p.cells, p.x, p.y + 1)) {
      p.y += 1; bump();
    } else {
      lockAndNext(); bump();
    }
  };

  useEffect(() => {
    // Lighter than a 60fps requestAnimationFrame loop: a 60ms interval that
    // accumulates time and only steps gravity while playing. Much less work
    // per second, and it idles cheaply when paused / over.
    lastRef.current = Date.now();
    accRef.current = 0;
    const id = setInterval(() => {
      const now = Date.now();
      accRef.current += now - lastRef.current;
      lastRef.current = now;
      if (phaseRef.current !== "play") { accRef.current = 0; return; }
      let guard = 0;
      while (accRef.current >= dropMs() && guard < 4) {
        accRef.current -= dropMs();
        try { gravityStep(); } catch (e) { console.warn("[block-drop]", e); }
        guard++;
      }
    }, 60);
    return () => {
      clearInterval(id);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const move = (dx: number) => {
    if (phaseRef.current !== "play") return;
    const p = pieceRef.current;
    if (!collides(boardRef.current, p.cells, p.x + dx, p.y)) { p.x += dx; bump(); }
  };
  const softDrop = () => {
    if (phaseRef.current !== "play") return;
    const p = pieceRef.current;
    if (!collides(boardRef.current, p.cells, p.x, p.y + 1)) { p.y += 1; setScore((s) => s + 1); accRef.current = 0; bump(); }
    else { lockAndNext(); bump(); }
  };
  const hardDrop = () => {
    if (phaseRef.current !== "play") return;
    const p = pieceRef.current;
    let d = 0;
    while (!collides(boardRef.current, p.cells, p.x, p.y + 1)) { p.y += 1; d += 1; }
    setScore((s) => s + d * 2);
    fx.current?.burst((p.x + 1.5) * CELL, (p.y + 1.5) * CELL, { count: 7, color: p.color, speed: 85, size: 4, rise: 0 });
    lockAndNext();
    bump();
  };
  const doRotate = () => {
    if (phaseRef.current !== "play") return;
    const p = pieceRef.current;
    const rc = rotate(p.cells);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(boardRef.current, rc, p.x + kick, p.y)) { p.cells = rc; p.x += kick; bump(); return; }
    }
  };
  const doHold = () => {
    if (phaseRef.current !== "play" || holdUsedRef.current) return;
    const cur = pieceRef.current;
    const curId = cur.id;
    let np: Piece;
    if (heldRef.current == null) { heldRef.current = curId; np = nextFromQueue(); }
    else { const h = heldRef.current; heldRef.current = curId; np = pieceFrom(h); }
    holdUsedRef.current = true;
    pieceRef.current = np;
    if (collides(boardRef.current, np.cells, np.x, np.y)) gameOver();
    bump();
  };

  const reset = () => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    boardRef.current = emptyBoard();
    queueRef.current = shuffledBag();
    pieceRef.current = pieceFrom(queueRef.current.shift() as number);
    heldRef.current = null;
    holdUsedRef.current = false;
    clearRowsRef.current = [];
    phaseRef.current = "play";
    linesRef.current = 0; levelRef.current = 1;
    accRef.current = 0; lastRef.current = Date.now();
    setScore(0); setLines(0); setLevel(1); setOver(false);
    setNextTick((n) => n + 1); bump();
  };

  // ----- build render ------
  const b = boardRef.current;
  const p = pieceRef.current;
  const clearing = phaseRef.current === "clear";
  const clearSet = new Set(clearRowsRef.current);
  const tetrisClear = clearRowsRef.current.length >= 4;
  const flashCellColor = tetrisClear ? color.amber : color.text;

  // ghost landing position
  let ghostY = p.y;
  if (phaseRef.current === "play") {
    while (!collides(b, p.cells, p.x, ghostY + 1)) ghostY += 1;
  }

  return (
    <View style={st.fill}>
      <Backdrop />

      {/* HUD */}
      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <View style={st.hudPanel}>
          <PixelText size="score">{String(score).padStart(5, "0")}</PixelText>
          <PixelText size="label" style={{ marginTop: 4 }}>LVL {level}  ·  LINES {lines}</PixelText>
        </View>
        <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
      </View>

      {/* play area */}
      <View style={[st.playRow, { marginTop: Math.max(insets.top, 24) + 70 }]}>
        {/* console bezel housing the well — reads as an inset screen */}
        <View style={st.bezel}>
          <View style={[st.board, { width: BOARD_W, height: BOARD_H }]}>
            {/* faint playfield gridlines (behind everything) */}
            <WellGrid />
            {/* top phosphor gloss on the screen */}
            <View pointerEvents="none" style={st.wellGloss} />

            {/* grid cells */}
            {b.map((row, y) =>
              row.map((c, x) => {
                if (c === "") return null;
                const flash = clearing && clearSet.has(y);
                return flash
                  ? <View key={`${x}-${y}`} style={[{ position: "absolute", left: x * CELL, top: y * CELL, width: CELL - 1, height: CELL - 1, borderRadius: 2, backgroundColor: flashCellColor }, !reducedMotion ? ({ boxShadow: tetrisClear ? glow.amber : glow.cyanSoft } as any) : null]} />
                  : <BevelCell key={`${x}-${y}`} left={x * CELL} top={y * CELL} size={CELL} c={c} />;
              })
            )}
            {/* ghost */}
            {phaseRef.current === "play" && ghostY !== p.y
              ? p.cells.map(([cx, cy], i) => {
                  const gy = ghostY + cy;
                  return gy >= 0 ? <GhostCell key={`g${i}`} left={(p.x + cx) * CELL} top={gy * CELL} size={CELL} c={p.color} /> : null;
                })
              : null}
            {/* active piece */}
            {phaseRef.current !== "over"
              ? p.cells.map(([cx, cy], i) => {
                  const y = p.y + cy;
                  return y >= 0 ? <BevelCell key={`a${i}`} left={(p.x + cx) * CELL} top={y * CELL} size={CELL} c={p.color} /> : null;
                })
              : null}

            {/* full-well flash overlay (tetris / level-up) */}
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: flashColor, opacity: flashAnim }]} />

            <EffectsLayer ref={fx} reduced={reducedMotion} />
          </View>
          {/* corner registration ticks — console detail */}
          <View pointerEvents="none" style={[st.tick, st.tickTL]} />
          <View pointerEvents="none" style={[st.tick, st.tickTR]} />
          <View pointerEvents="none" style={[st.tick, st.tickBL]} />
          <View pointerEvents="none" style={[st.tick, st.tickBR]} />
        </View>

        {/* side panel */}
        <View style={st.side}>
          <SidePanel label="NEXT" accent={color.cyan}>
            <MiniPiece id={queueRef.current.length ? queueRef.current[0] : null} />
          </SidePanel>
          <SidePanel label="HOLD" accent={color.amber}>
            <MiniPiece id={heldRef.current} />
          </SidePanel>
          <StatPanel label="SCORE" value={String(score).padStart(5, "0")} accent={color.amber} />
          <View style={st.statRow}>
            <StatPanel label="LVL" value={String(level)} accent={color.cyan} />
            <StatPanel label="LINES" value={String(lines)} />
          </View>
        </View>
      </View>

      {/* controls */}
      <View style={[st.controls, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={st.ctrlRow}>
          <Btn label="◀" onPress={() => move(-1)} />
          <Btn label="⟳" onPress={doRotate} />
          <Btn label="▶" onPress={() => move(1)} />
        </View>
        <View style={st.ctrlRow}>
          <Btn label="HOLD" small onPress={doHold} />
          <Btn label="▼" onPress={softDrop} />
          <Btn label="⤓" accent onPress={hardDrop} />
        </View>
      </View>

      <ScoreboardOverlay
        visible={over} gameId="block-drop" score={score} title="STACK OVERFLOW"
        scoreLabel={`SCORE ${score}  ·  LVL ${level}`}
        onPlayAgain={reset} onExit={onExit}
      />
    </View>
  );
}

function Btn({ label, onPress, accent, small }: { label: string; onPress: () => void; accent?: boolean; small?: boolean }) {
  return (
    <Pressable
      onPress={() => { try { onPress(); } catch (e) { console.warn("[block-drop]", e); } }}
      style={({ pressed }) => [
        st.btn,
        accent && { borderColor: color.amber, backgroundColor: color.amberGlowBg },
        pressed && { backgroundColor: color.surface2, transform: [{ scale: 0.97 }] },
      ]}
    >
      <Text style={[st.btnT, small && { fontSize: 13 }, accent && { color: color.amber }]}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  hud: { position: "absolute", left: 0, right: 0, zIndex: 5, paddingHorizontal: space.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  hudPanel: { backgroundColor: "rgba(20,26,34,0.7)", borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, borderColor: color.surfaceLine },
  playRow: { flexDirection: "row", justifyContent: "center", alignItems: "flex-start", gap: space.md, paddingHorizontal: space.md },
  // console bezel: the physical display frame around the well (restrained amber rim glow)
  bezel: {
    padding: 6, borderRadius: radius.lg, backgroundColor: consoleUI.frame,
    borderWidth: 1, borderColor: consoleUI.frameLine, borderTopColor: consoleUI.deckHi,
    boxShadow: glow.amberSoft,
  } as any,
  board: { backgroundColor: "#090D11", borderRadius: radius.md, borderWidth: 1, borderColor: "#05080B", overflow: "hidden" },
  wellGloss: { position: "absolute", left: 0, right: 0, top: 0, height: "14%", backgroundColor: crt.phosphorHi },
  tick: { position: "absolute", width: 10, height: 10, borderColor: color.amber, opacity: 0.55 },
  tickTL: { top: 2, left: 2, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  tickTR: { top: 2, right: 2, borderTopWidth: 1.5, borderRightWidth: 1.5 },
  tickBL: { bottom: 2, left: 2, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
  tickBR: { bottom: 2, right: 2, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
  side: { width: SIDE - 8, alignItems: "stretch", gap: space.sm },
  panel: { backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: consoleUI.frameLine, padding: space.sm, alignItems: "center" },
  panelLabel: { color: color.textMuted, alignSelf: "flex-start", marginBottom: space.xs },
  statPanel: { flex: 1, backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: consoleUI.frameLine, paddingHorizontal: space.sm, paddingVertical: space.xs },
  statRow: { flexDirection: "row", gap: space.sm },
  statValue: { color: color.text, fontSize: 15, fontWeight: "800", marginTop: 1 },
  miniBox: { backgroundColor: "#0E141C", borderRadius: radius.sm, borderWidth: 1, borderColor: color.surfaceLine },
  controls: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  ctrlRow: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
  btn: { flex: 1, height: 52, borderRadius: radius.md, borderWidth: 1.5, borderColor: color.surfaceLine, backgroundColor: color.surface, alignItems: "center", justifyContent: "center" },
  btnT: { color: color.text, fontSize: 22, fontWeight: "800" },
});

export const blockDropGame: GameModule = {
  id: "block-drop",
  title: "Block Drop",
  kind: "arcade",
  Screen: GameScreen,
};
