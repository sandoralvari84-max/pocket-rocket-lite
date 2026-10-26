import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  PanResponder,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius, consoleUI } from "../design/tokens";
import { PixelText, IconButton, GameOverlay, Body } from "../design/ui";
import { ScoreboardOverlay } from "../design/Scoreboard";
import { ArcadeJoystick } from "../design/Joystick";
import { EffectsLayer, type EffectsHandle } from "../design/effects";
import { useSettings } from "../settings";

/* ----------------------------------------------------------------------------
 * Nibbler — Snake. Grid logic is fully deterministic (visuals never touch it):
 *   - one continuous snake: overlapping tube segments, head→tail gradient,
 *     a directional head with eyes + tongue and a gloss highlight
 *   - vector apple (glossy red + leaf) and blocky crate obstacles
 *   - clean dark playfield with faint gridlines inside a console bezel
 *   - progressive speed as the snake grows; obstacles appear at higher scores
 *   - shared HUD + GameOverlay, pause, crash feedback
 * ------------------------------------------------------------------------- */

const COLS = 13;
const ROWS = 15;
const { width: W, height: H } = Dimensions.get("window");
const CELL = Math.floor(Math.min(W - 24, H * 0.56) / COLS);
const BOARD_W = CELL * COLS;
const BOARD_H = CELL * ROWS;

// Snake tube geometry — segments are drawn slightly undersized and bridged by
// connectors so the body reads as one continuous rounded tube.
const TUBE = Math.round(CELL * 0.82);
const HEAD = Math.round(CELL * 0.94);

// Nibbler's own period palette: a vivid arcade-green snake on a dark field.
const SNAKE_HEAD = "#7CF08A";
const SNAKE_NEAR = "#43C85E"; // body just behind the head
const SNAKE_FAR = "#176B2E";  // body near the tail

// Crate (obstacle) palette — amber-brown with edge shading, distinct from the snake.
const CRATE_FILL = "#8A5A28";
const CRATE_HI = "#C08A42";
const CRATE_LO = "#4E3317";
const CRATE_EDGE = "#2E1E0D";

// Playfield.
const FIELD_BG = "#0A0E13";
const GRID_LINE = "rgba(0,229,255,0.05)";

// Lerp between two "#rrggbb" colours (for the head→tail body gradient).
function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const to = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${pa.map((v, i) => to(v + (pb[i] - v) * t)).join("")}`;
}

type Dir = { dx: number; dy: number };
type Cell = { r: number; c: number };

const START: Cell[] = [
  { r: 7, c: 4 },
  { r: 7, c: 3 },
  { r: 7, c: 2 },
];

// Obstacles revealed progressively by score. Kept clear of the start corridor.
const OBSTACLES: { r: number; c: number; min: number }[] = [
  { r: 3, c: 3, min: 8 }, { r: 3, c: 9, min: 8 },
  { r: 11, c: 3, min: 8 }, { r: 11, c: 9, min: 8 },
  { r: 5, c: 6, min: 16 }, { r: 9, c: 6, min: 16 },
  { r: 7, c: 1, min: 24 }, { r: 7, c: 11, min: 24 },
];

function activeObstacles(score: number): Set<string> {
  const s = new Set<string>();
  for (const o of OBSTACLES) if (score >= o.min) s.add(`${o.r},${o.c}`);
  return s;
}

// speed ramps up with score; grid steps stay fixed-size and deterministic.
const delayFor = (score: number) => Math.max(85, 185 - score * 3); // gentler ramp: slower start, smoother climb

function randFood(snake: Cell[], obstacles: Set<string>): Cell {
  const taken = new Set(snake.map((s) => `${s.r},${s.c}`));
  const free: Cell[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const k = `${r},${c}`;
      if (!taken.has(k) && !obstacles.has(k)) free.push({ r, c });
    }
  }
  if (free.length === 0) return { r: 0, c: 0 };
  return free[Math.floor(Math.random() * free.length)];
}

function Screen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useSettings();
  const fxRef = useRef<EffectsHandle>(null);
  const cpx = (c: number) => (c + 0.5) * CELL;
  const cpy = (r: number) => (r + 0.5) * CELL;

  const snakeRef = useRef<Cell[]>(START.map((s) => ({ ...s })));
  const dirRef = useRef<Dir>({ dx: 1, dy: 0 });
  const nextDirRef = useRef<Dir>({ dx: 1, dy: 0 });
  const foodRef = useRef<Cell>(randFood(START, new Set()));
  const scoreRef = useRef(0);
  const phaseRef = useRef<"ready" | "playing" | "paused" | "over">("ready");
  const crashRef = useRef<Cell | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [, setFrame] = useState(0);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<"ready" | "playing" | "paused" | "over">("ready");

  const bump = () => setFrame((f) => f + 1);

  const turn = (d: Dir): void => {
    const cur = dirRef.current;
    if (d.dx === -cur.dx && d.dy === -cur.dy) return; // no instant reverse
    nextDirRef.current = d;
  };

  function schedule() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(tick, delayFor(scoreRef.current));
  }

  function tick() {
    if (phaseRef.current !== "playing") return;

    dirRef.current = nextDirRef.current;
    const d = dirRef.current;
    const snake = snakeRef.current;
    const head = snake[0];
    const nh: Cell = { r: head.r + d.dy, c: head.c + d.dx };
    const obstacles = activeObstacles(scoreRef.current);

    // wall / obstacle collision
    if (nh.r < 0 || nh.c < 0 || nh.r >= ROWS || nh.c >= COLS || obstacles.has(`${nh.r},${nh.c}`)) {
      crashRef.current = nh.r < 0 || nh.c < 0 || nh.r >= ROWS || nh.c >= COLS ? head : nh;
      return die();
    }

    const eating = nh.r === foodRef.current.r && nh.c === foodRef.current.c;
    const body = eating ? snake : snake.slice(0, snake.length - 1);
    if (body.some((s) => s.r === nh.r && s.c === nh.c)) {
      crashRef.current = nh;
      return die();
    }

    const next = [nh, ...snake];
    if (eating) {
      const ns = scoreRef.current + 1;
      scoreRef.current = ns;
      setScore(ns);
      fxRef.current?.burst(cpx(nh.c), cpy(nh.r), { count: 10, color: color.success, speed: 120, size: 5 });
      fxRef.current?.popScore(cpx(nh.c), cpy(nh.r), "+1", SNAKE_HEAD);
      snakeRef.current = next;
      foodRef.current = randFood(next, activeObstacles(ns));
    } else {
      next.pop();
      snakeRef.current = next;
    }
    bump();
    schedule();
  }

  function die() {
    const cc = crashRef.current;
    if (cc) fxRef.current?.burst(cpx(cc.c), cpy(cc.r), { count: 16, color: color.danger, speed: 150, size: 6 });
    phaseRef.current = "over";
    setPhase("over");
    if (timerRef.current) clearTimeout(timerRef.current);
    bump();
  }

  function restart() {
    snakeRef.current = START.map((s) => ({ ...s }));
    dirRef.current = { dx: 1, dy: 0 };
    nextDirRef.current = { dx: 1, dy: 0 };
    scoreRef.current = 0;
    crashRef.current = null;
    foodRef.current = randFood(START, new Set());
    setScore(0);
    phaseRef.current = "playing";
    setPhase("playing");
    bump();
    schedule();
  }

  const start = () => {
    phaseRef.current = "playing";
    setPhase("playing");
    bump();
    schedule();
  };

  const togglePause = () => {
    if (phaseRef.current === "playing") {
      phaseRef.current = "paused"; setPhase("paused");
      if (timerRef.current) clearTimeout(timerRef.current);
    } else if (phaseRef.current === "paused") {
      phaseRef.current = "playing"; setPhase("playing");
      schedule();
    }
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8,
      onPanResponderRelease: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        if (Math.abs(g.dx) > Math.abs(g.dy)) turn({ dx: g.dx > 0 ? 1 : -1, dy: 0 });
        else if (Math.abs(g.dy) > 0) turn({ dx: 0, dy: g.dy > 0 ? 1 : -1 });
      },
    })
  ).current;

  const snake = snakeRef.current;
  const food = foodRef.current;
  const obstacles = activeObstacles(score);
  const appleSize = Math.round(CELL * 0.74);

  // Clean playfield: faint gridlines matching the cell grid — built once.
  const gridLayer = useMemo(() => {
    const lines: React.ReactNode[] = [];
    for (let c = 1; c < COLS; c++)
      lines.push(
        <View key={`gv${c}`} pointerEvents="none" style={{ position: "absolute", left: c * CELL, top: 0, width: 1, height: BOARD_H, backgroundColor: GRID_LINE }} />
      );
    for (let r = 1; r < ROWS; r++)
      lines.push(
        <View key={`gh${r}`} pointerEvents="none" style={{ position: "absolute", left: 0, top: r * CELL, width: BOARD_W, height: 1, backgroundColor: GRID_LINE }} />
      );
    return lines;
  }, []);

  return (
    <View style={st.fill}>
      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <View style={st.hudPanel}>
          <PixelText size="score">{String(score).padStart(3, "0")}</PixelText>
          <PixelText size="label" style={{ marginTop: 4 }}>LEN {snake.length}</PixelText>
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <IconButton label="Pause" glyph={phase === "paused" ? "▶" : "❚❚"} onPress={togglePause} />
          <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
        </View>
      </View>

      <View style={st.center}>
        <View style={st.bezel}>
          <View
            style={[st.board, { width: BOARD_W, height: BOARD_H, borderColor: phase === "over" ? color.danger : consoleUI.frameLine }]}
            {...pan.panHandlers}
          >
            {gridLayer}

            {/* obstacles — blocky crates */}
            {Array.from(obstacles).map((k) => {
              const [r, c] = k.split(",").map(Number);
              const m = Math.max(1, Math.round(CELL * 0.08));
              const brace = Math.max(2, Math.round(CELL * 0.1));
              const inner = CELL - m * 2;
              return (
                <View
                  key={`o${k}`}
                  pointerEvents="none"
                  style={{
                    position: "absolute", left: c * CELL + m, top: r * CELL + m,
                    width: inner, height: inner, backgroundColor: CRATE_FILL,
                    borderRadius: Math.max(2, Math.round(CELL * 0.08)),
                    borderWidth: 2, borderTopColor: CRATE_HI, borderLeftColor: CRATE_HI,
                    borderRightColor: CRATE_EDGE, borderBottomColor: CRATE_EDGE,
                    overflow: "hidden",
                  }}
                >
                  {/* corner plates + diagonal brace for a wooden-crate read */}
                  <View style={{ position: "absolute", left: 0, top: 0, right: 0, height: brace, backgroundColor: "rgba(0,0,0,0.12)" }} />
                  <View style={{ position: "absolute", left: 0, bottom: 0, right: 0, height: brace, backgroundColor: "rgba(0,0,0,0.22)" }} />
                  <View style={{ position: "absolute", left: inner * 0.5 - 1, top: -inner * 0.2, width: 2, height: inner * 1.4, backgroundColor: CRATE_LO, transform: [{ rotate: "45deg" }] }} />
                  <View style={{ position: "absolute", left: inner * 0.5 - 1, top: -inner * 0.2, width: 2, height: inner * 1.4, backgroundColor: CRATE_LO, transform: [{ rotate: "-45deg" }] }} />
                </View>
              );
            })}

            {/* apple — glossy red with highlight + leaf/stem */}
            <View pointerEvents="none" style={{ position: "absolute", left: food.c * CELL, top: food.r * CELL, width: CELL, height: CELL, alignItems: "center", justifyContent: "center" }}>
              {/* stem */}
              <View style={{ position: "absolute", top: (CELL - appleSize) / 2 - Math.round(appleSize * 0.06), left: CELL / 2 - 1, width: 2.5, height: Math.round(appleSize * 0.2), backgroundColor: "#6B4A2A", borderRadius: 2, transform: [{ rotate: "12deg" }] }} />
              {/* leaf */}
              <View style={{ position: "absolute", top: (CELL - appleSize) / 2 - Math.round(appleSize * 0.02), left: CELL / 2 + 1, width: Math.round(appleSize * 0.26), height: Math.round(appleSize * 0.16), backgroundColor: "#4FB24A", borderTopRightRadius: 999, borderBottomLeftRadius: 999, transform: [{ rotate: "-18deg" }] }} />
              {/* body */}
              <View style={{ width: appleSize, height: appleSize, borderRadius: appleSize / 2, backgroundColor: "#D8362C", overflow: "hidden" }}>
                <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: appleSize * 0.4, backgroundColor: "rgba(90,10,6,0.35)", borderBottomLeftRadius: appleSize / 2, borderBottomRightRadius: appleSize / 2 }} />
                <View style={{ position: "absolute", left: appleSize * 0.18, top: appleSize * 0.16, width: appleSize * 0.26, height: appleSize * 0.2, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.6)" }} />
              </View>
            </View>

            {/* snake connectors — bridge adjacent segments into one tube */}
            {snake.map((s, i) => {
              if (i === 0) return null;
              const prev = snake[i - 1];
              const cc = crashRef.current;
              const crashed = phase === "over" && !!cc && ((cc.r === s.r && cc.c === s.c) || (cc.r === prev.r && cc.c === prev.c));
              const t = snake.length > 1 ? i / (snake.length - 1) : 0;
              const bg = crashed ? color.danger : mixHex(SNAKE_NEAR, SNAKE_FAR, t);
              const x1 = cpx(s.c), y1 = cpy(s.r), x2 = cpx(prev.c), y2 = cpy(prev.r);
              const horiz = s.r === prev.r;
              const left = horiz ? Math.min(x1, x2) - TUBE / 2 : x1 - TUBE / 2;
              const top = horiz ? y1 - TUBE / 2 : Math.min(y1, y2) - TUBE / 2;
              const w = horiz ? Math.abs(x2 - x1) + TUBE : TUBE;
              const h = horiz ? TUBE : Math.abs(y2 - y1) + TUBE;
              return <View key={`sc${i}`} pointerEvents="none" style={{ position: "absolute", left, top, width: w, height: h, backgroundColor: bg, borderRadius: Math.round(TUBE * 0.32) }} />;
            })}

            {/* snake segment blobs + head detail */}
            {snake.map((s, i) => {
              const isHead = i === 0;
              const cc = crashRef.current;
              const crashed = phase === "over" && !!cc && cc.r === s.r && cc.c === s.c;
              const t = snake.length > 1 ? i / (snake.length - 1) : 0;
              const bg = crashed ? color.danger : isHead ? SNAKE_HEAD : mixHex(SNAKE_NEAR, SNAKE_FAR, t);
              const size = isHead ? HEAD : TUBE;
              const left = cpx(s.c) - size / 2;
              const top = cpy(s.r) - size / 2;
              return (
                <View
                  key={`s${i}`}
                  pointerEvents="none"
                  style={{ position: "absolute", left, top, width: size, height: size, backgroundColor: bg, borderRadius: size / 2 }}
                >
                  {/* gloss */}
                  <View pointerEvents="none" style={{ position: "absolute", left: size * 0.18, top: size * 0.12, width: size * 0.5, height: size * (isHead ? 0.32 : 0.26), borderRadius: 999, backgroundColor: isHead ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.14)" }} />
                  {isHead && !crashed ? (() => {
                    const d = dirRef.current;
                    const cx = HEAD / 2 + d.dx * HEAD * 0.16;
                    const cy = HEAD / 2 + d.dy * HEAD * 0.16;
                    const px = -d.dy, py = d.dx;
                    const sep = HEAD * 0.22;
                    const er = Math.max(3, Math.round(HEAD * 0.2));
                    const pr = Math.max(1, Math.round(er * 0.5));
                    const eyes = [
                      { x: cx + px * sep, y: cy + py * sep },
                      { x: cx - px * sep, y: cy - py * sep },
                    ];
                    const tx = HEAD / 2 + d.dx * HEAD * 0.52;
                    const ty = HEAD / 2 + d.dy * HEAD * 0.52;
                    return (
                      <>
                        <View style={{ position: "absolute", left: tx - HEAD * 0.055, top: ty - HEAD * 0.055, width: HEAD * 0.11, height: HEAD * 0.11, borderRadius: 2, backgroundColor: "#FF4D5E" }} />
                        {eyes.map((e, k) => (
                          <View key={k} style={{ position: "absolute", left: e.x - er / 2, top: e.y - er / 2, width: er, height: er, borderRadius: 999, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
                            <View style={{ width: pr, height: pr, borderRadius: 999, backgroundColor: "#0A0A0A" }} />
                          </View>
                        ))}
                      </>
                    );
                  })() : null}
                </View>
              );
            })}

            <EffectsLayer ref={fxRef} reduced={reducedMotion} />
          </View>
        </View>
        <Body muted style={{ marginTop: space.md, textAlign: "center" }}>
          Swipe or use the stick. Eat apples, dodge your tail and the crates.
        </Body>
      </View>

      <View style={st.dpad} pointerEvents="box-none">
        <ArcadeJoystick onDirection={(d) => turn(d)} />
      </View>

      <GameOverlay
        visible={phase === "ready"} kind="pause" title="NIBBLER"
        primaryLabel="Start" onPrimary={start} onExit={onExit}
      >
        <Body muted style={{ textAlign: "center", marginTop: space.md }}>
          Steer the snake with the stick (or a swipe) and eat every apple to
          grow longer. It speeds up as it grows, and crates clutter the field
          the longer you survive. Hit a wall, a crate, or your own tail and it's over.
        </Body>
      </GameOverlay>

      <GameOverlay
        visible={phase === "paused"} kind="pause" title="PAUSED" score={`SCORE ${score}`}
        primaryLabel="Resume" onPrimary={togglePause} onExit={onExit}
      />

      <ScoreboardOverlay
        visible={phase === "over"} gameId="nibbler" score={score}
        scoreLabel={`SCORE ${score}`} onPlayAgain={restart} onExit={onExit}
      />
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  bezel: {
    backgroundColor: consoleUI.frame, padding: space.xs,
    borderRadius: radius.lg, borderWidth: 1, borderColor: consoleUI.frameLine,
  },
  board: {
    backgroundColor: FIELD_BG, borderRadius: radius.md, borderWidth: 1, overflow: "hidden",
    boxShadow: "inset 0 0 12px rgba(0,0,0,0.6)",
  },
  hud: {
    position: "absolute", left: 0, right: 0, zIndex: 10, paddingHorizontal: space.lg,
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
  },
  hudPanel: {
    backgroundColor: "rgba(20,26,34,0.7)", borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.sm,
    borderWidth: 1, borderColor: color.surfaceLine,
  },
  dpad: { position: "absolute", bottom: 28, left: 0, right: 0, alignItems: "center" },
  padRow: { flexDirection: "row" },
  pad: {
    width: 60, height: 56, margin: 4, borderRadius: radius.md,
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine,
    alignItems: "center", justifyContent: "center",
  },
  padT: { color: color.text, fontSize: 22, fontWeight: "700" },
});

export const nibblerGame: GameModule = {
  id: "nibbler",
  title: "Nibbler",
  kind: "arcade",
  Screen,
};
