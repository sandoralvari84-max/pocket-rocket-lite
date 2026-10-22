import React, { useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GameEngine, type GameEngineSystem } from "react-native-game-engine";
import type { GameModule, GameContext } from "./contract";

const { width: W, height: H } = Dimensions.get("window");
const PADDLE_W = 90;
const PADDLE_H = 14;
const PADDLE_Y = H - 150;
const BALL_R = 9;
const BRICK_COLS = 6;
const BRICK_ROWS = 4;
const BRICK_GAP = 6;
const BRICK_TOP = 110;
const SIDE_PAD = 14;
const BRICK_W = (W - 2 * SIDE_PAD - (BRICK_COLS - 1) * BRICK_GAP) / BRICK_COLS;
const BRICK_H = 20;
const START_LIVES = 3;
const COLORS = ["#ff5d73", "#ffac4d", "#ffe24d", "#4df0a0"];

interface Brick {
  id: number;
  x: number;
  y: number;
  color: string;
}
interface World {
  paddleX: number;
  ballX: number;
  ballY: number;
  vx: number;
  vy: number;
  bricks: Brick[];
  launched: boolean;
  renderer: React.ComponentType<WorldProps>;
}
type WorldProps = Omit<World, "renderer">;

function makeBricks(): Brick[] {
  const bricks: Brick[] = [];
  let id = 1;
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      bricks.push({
        id: id++,
        x: SIDE_PAD + c * (BRICK_W + BRICK_GAP),
        y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
        color: COLORS[r % COLORS.length] as string,
      });
    }
  }
  return bricks;
}

const WorldView = ({ paddleX, ballX, ballY, bricks }: WorldProps) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {bricks.map((b) => (
      <View
        key={b.id}
        style={[st.brick, { left: b.x, top: b.y, backgroundColor: b.color }]}
      />
    ))}
    <View style={[st.ball, { left: ballX - BALL_R, top: ballY - BALL_R }]} />
    <View style={[st.paddle, { left: paddleX - PADDLE_W / 2, top: PADDLE_Y }]} />
  </View>
);

const Physics: GameEngineSystem = (entities, { touches, time, dispatch }) => {
  const w = entities.world as World;
  const step = time.delta / 16;

  const t = touches
    .filter((x: { type: string }) => x.type === "move" || x.type === "start")
    .pop();
  if (t) {
    w.paddleX = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, t.event.locationX));
  }

  if (!w.launched) {
    // ball rides the paddle until first touch
    w.ballX = w.paddleX;
    w.ballY = PADDLE_Y - BALL_R - 1;
    if (t) w.launched = true;
    return entities;
  }

  w.ballX += w.vx * step;
  w.ballY += w.vy * step;

  // walls
  if (w.ballX - BALL_R <= 0) {
    w.ballX = BALL_R;
    w.vx = Math.abs(w.vx);
  } else if (w.ballX + BALL_R >= W) {
    w.ballX = W - BALL_R;
    w.vx = -Math.abs(w.vx);
  }
  if (w.ballY - BALL_R <= 0) {
    w.ballY = BALL_R;
    w.vy = Math.abs(w.vy);
  }

  // paddle bounce
  if (
    w.vy > 0 &&
    w.ballY + BALL_R >= PADDLE_Y &&
    w.ballY - BALL_R <= PADDLE_Y + PADDLE_H &&
    Math.abs(w.ballX - w.paddleX) <= PADDLE_W / 2 + BALL_R
  ) {
    w.ballY = PADDLE_Y - BALL_R;
    w.vy = -Math.abs(w.vy);
    const offset = (w.ballX - w.paddleX) / (PADDLE_W / 2); // -1..1
    w.vx = offset * 6;
  }

  // brick collisions (resolve one per frame)
  for (const b of w.bricks) {
    if (
      w.ballX + BALL_R >= b.x &&
      w.ballX - BALL_R <= b.x + BRICK_W &&
      w.ballY + BALL_R >= b.y &&
      w.ballY - BALL_R <= b.y + BRICK_H
    ) {
      w.bricks = w.bricks.filter((x) => x.id !== b.id);
      // reflect vertically if hit came from top/bottom, else horizontally
      const fromSide =
        w.ballX < b.x || w.ballX > b.x + BRICK_W;
      if (fromSide) w.vx = -w.vx;
      else w.vy = -w.vy;
      dispatch({ type: "break" });
      break;
    }
  }

  // win
  if (w.bricks.length === 0) {
    dispatch({ type: "win" });
    return entities;
  }

  // lost the ball
  if (w.ballY - BALL_R > H) {
    dispatch({ type: "life" });
    w.launched = false;
    w.vx = 3;
    w.vy = -6;
  }

  return entities;
};

function buildWorld(): World {
  return {
    paddleX: W / 2,
    ballX: W / 2,
    ballY: PADDLE_Y - BALL_R - 1,
    vx: 3,
    vy: -6,
    bricks: makeBricks(),
    launched: false,
    renderer: WorldView,
  };
}

function Screen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [status, setStatus] = useState<"play" | "won" | "lost">("play");
  const [resetKey, setResetKey] = useState(0);
  const engineEntities = useRef(buildWorld());

  const onEvent = (e: { type?: string }) => {
    if (e?.type === "break") setScore((s) => s + 10);
    if (e?.type === "win") setStatus("won");
    if (e?.type === "life") {
      setLives((l) => {
        const next = l - 1;
        if (next <= 0) setStatus("lost");
        return next;
      });
    }
  };

  const restart = () => {
    engineEntities.current = buildWorld();
    setScore(0);
    setLives(START_LIVES);
    setStatus("play");
    setResetKey((k) => k + 1);
  };

  return (
    <View style={st.fill}>
      <GameEngine
        key={resetKey}
        style={st.fill}
        systems={[Physics]}
        entities={engineEntities.current}
        running={status === "play"}
        onEvent={onEvent}
      />
      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <Text style={st.score}>Score {score}   ·   Lives {lives}</Text>
        <Pressable style={st.exit} onPress={onExit}>
          <Text style={st.exitT}>← Menu</Text>
        </Pressable>
      </View>
      {status !== "play" && (
        <View style={st.overlay} pointerEvents="box-none">
          <Text style={[st.overTitle, status === "won" ? st.win : st.lose]}>
            {status === "won" ? "Wall Cleared!" : "Out of Balls"}
          </Text>
          <Text style={st.overSub}>Final score {score}</Text>
          <Pressable style={st.again} onPress={restart}>
            <Text style={st.againT}>Play again</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0b1021" },
  paddle: {
    position: "absolute",
    width: PADDLE_W,
    height: PADDLE_H,
    borderRadius: 7,
    backgroundColor: "#4da3ff",
  },
  ball: {
    position: "absolute",
    width: BALL_R * 2,
    height: BALL_R * 2,
    borderRadius: BALL_R,
    backgroundColor: "#fff",
  },
  brick: {
    position: "absolute",
    width: BRICK_W,
    height: BRICK_H,
    borderRadius: 4,
  },
  hud: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  score: { color: "#fff", fontSize: 16, fontWeight: "600" },
  exit: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  exitT: { color: "#fff", fontWeight: "600" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  overTitle: { fontSize: 32, fontWeight: "800" },
  win: { color: "#4df0a0" },
  lose: { color: "#ff5d73" },
  overSub: { color: "#fff", fontSize: 18, marginTop: 8 },
  again: {
    marginTop: 20,
    backgroundColor: "#4da3ff",
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 10,
  },
  againT: { color: "#06122a", fontWeight: "800", fontSize: 16 },
});

export const brickBusterGame: GameModule = {
  id: "brick-buster",
  title: "Brick Buster",
  kind: "arcade",
  Screen,
};
