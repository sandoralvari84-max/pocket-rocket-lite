import React, { useEffect, useRef, useState } from "react";
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
import { color, space, radius } from "../design/tokens";
import { PixelText, IconButton, GameOverlay, Sprite, Body } from "../design/ui";
import { ArcadeJoystick } from "../design/Joystick";

/* ----------------------------------------------------------------------------
 * Nibbler — Snake. Grid logic is fully deterministic (visuals never touch it):
 *   - clean-tiled snake (token colours) + distinct apple sprite (Kenney CC0)
 *   - progressive speed as the snake grows
 *   - obstacles appear at higher scores
 *   - shared HUD + GameOverlay, pause, crash feedback
 * ------------------------------------------------------------------------- */

const COLS = 13;
const ROWS = 15;
const { width: W, height: H } = Dimensions.get("window");
const CELL = Math.floor(Math.min(W - 24, H * 0.56) / COLS);
const BOARD_W = CELL * COLS;
const BOARD_H = CELL * ROWS;

// Original owned sprites (v3) — tools/art/gen_nibbler_art.py.
const FOOD_IMG = require("../../assets/arcade/nibbler/apple.png");
const ROCK_IMG = require("../../assets/arcade/nibbler/rock.png");

// Nibbler's own period palette: a vivid arcade-green snake on dark.
const SNAKE_BODY = "#2FA84A";
const SNAKE_HEAD = "#6CE06B";

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
const delayFor = (score: number) => Math.max(70, 150 - score * 4);

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
  const foodSize = Math.round(CELL * 0.92);

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
        <View
          style={[st.board, { width: BOARD_W, height: BOARD_H, borderColor: phase === "over" ? color.danger : color.surfaceLine }]}
          {...pan.panHandlers}
        >
          {/* obstacles */}
          {Array.from(obstacles).map((k) => {
            const [r, c] = k.split(",").map(Number);
            return (
              <View key={`o${k}`} style={{ position: "absolute", left: c * CELL, top: r * CELL }}>
                <Sprite source={ROCK_IMG} size={CELL} />
              </View>
            );
          })}

          {/* food */}
          <View style={{ position: "absolute", left: food.c * CELL + (CELL - foodSize) / 2, top: food.r * CELL + (CELL - foodSize) / 2 }}>
            <Sprite source={FOOD_IMG} size={foodSize} />
          </View>

          {/* snake — continuous body: full cells connect; head/tail rounded, eyes face travel */}
          {snake.map((s, i) => {
            const isHead = i === 0;
            const isTail = i === snake.length - 1 && snake.length > 1;
            const crashed = phase === "over" && crashRef.current && crashRef.current.r === s.r && crashRef.current.c === s.c;
            const bg = crashed ? color.danger : isHead ? SNAKE_HEAD : SNAKE_BODY;
            const rounded = isHead || isTail ? Math.round(CELL * 0.4) : 0;
            return (
              <View
                key={`s${i}`}
                style={{ position: "absolute", left: s.c * CELL, top: s.r * CELL, width: CELL, height: CELL, backgroundColor: bg, borderRadius: rounded }}
              >
                {isHead && (() => {
                  const d = dirRef.current;
                  const fx = CELL / 2 + d.dx * CELL * 0.22;
                  const fy = CELL / 2 + d.dy * CELL * 0.22;
                  const px = -d.dy, py = d.dx;
                  const er = Math.max(2, Math.round(CELL * 0.15));
                  const eyes = [
                    { x: fx + px * CELL * 0.2, y: fy + py * CELL * 0.2 },
                    { x: fx - px * CELL * 0.2, y: fy - py * CELL * 0.2 },
                  ];
                  return eyes.map((e, k) => (
                    <View key={k} style={{ position: "absolute", left: e.x - er / 2, top: e.y - er / 2, width: er, height: er, borderRadius: 999, backgroundColor: color.onAmber }} />
                  ));
                })()}
              </View>
            );
          })}
        </View>
        <Body muted style={{ marginTop: space.md, textAlign: "center" }}>
          Swipe or use the D-pad. Eat apples, dodge your tail and the crates.
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
          Guide the snake to each apple. It speeds up as it grows, and crates
          appear the longer you survive.
        </Body>
      </GameOverlay>

      <GameOverlay
        visible={phase === "paused"} kind="pause" title="PAUSED" score={`SCORE ${score}`}
        primaryLabel="Resume" onPrimary={togglePause} onExit={onExit}
      />

      <GameOverlay
        visible={phase === "over"} kind="over" title="GAME OVER" score={`SCORE ${score}`}
        primaryLabel="Play again" onPrimary={restart} onExit={onExit}
      />
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  board: { backgroundColor: "#05070f", borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
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
