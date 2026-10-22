import React, { useRef, useState } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { GameEngine, type GameEngineSystem } from "react-native-game-engine";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space } from "../design/tokens";
import { PixelText, IconButton, GameOverlay, Sprite } from "../design/ui";

const SHIP = require("../../assets/arcade/pixel-shmup/Ships/ship_0000.png");

const { width: W, height: H } = Dimensions.get("window");
const PADDLE_W = 84, SHIP_W = 72, PADDLE_Y = H - 170, DOT_R = 15;
const MAX_MISS = 5;
const rndX = () => DOT_R + Math.random() * (W - 2 * DOT_R);
const clampPaddle = (x: number) => Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, x));

// Catcher = a pixel ship sprite. Collision box stays PADDLE_W wide (unchanged logic).
const Paddle = ({ x }: { x: number }) => (
  <View style={{ position: "absolute", left: x - SHIP_W / 2, top: PADDLE_Y - SHIP_W / 2 }}>
    <Sprite source={SHIP} size={SHIP_W} />
  </View>
);
// Collectible = crisp amber "energy coin", code-drawn on-palette (cyan ring, amber core).
const Dot = ({ x, y }: { x: number; y: number }) => (
  <View style={[st.dotOuter, { left: x - DOT_R, top: y - DOT_R }]}>
    <View style={st.dotInner} />
  </View>
);

const Physics: GameEngineSystem = (entities, { touches, time, dispatch }) => {
  const g = entities as any;
  if (g.over) return entities;
  const p = g.paddle, d = g.dot;
  const t = touches.filter((x: any) => x.type === "move" || x.type === "start").pop();
  if (t) { const lx = t.event.locationX; if (lx >= 0 && lx <= W) p.x = clampPaddle(lx); }
  const prevY = d.y;
  d.y += Math.min(28, (d.speed * time.delta) / 16);
  const plane = PADDLE_Y;
  const crossed = prevY - DOT_R <= plane && d.y + DOT_R >= plane;
  if (crossed && Math.abs(d.x - p.x) <= PADDLE_W / 2 + DOT_R) {
    dispatch({ type: "score" });
    d.x = rndX(); d.y = -DOT_R; d.speed = Math.min(10, d.speed + 0.25);
  } else if (d.y - DOT_R > H) {
    dispatch({ type: "miss" });
    d.x = rndX(); d.y = -DOT_R;
  }
  return entities;
};

function GameScreen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [over, setOver] = useState(false);
  const [key, setKey] = useState(0);
  const entities = useRef(makeEntities()).current;

  function makeEntities() {
    return {
      over: false,
      paddle: { x: W / 2, renderer: Paddle },
      dot: { x: rndX(), y: -DOT_R, speed: 4, renderer: Dot },
    };
  }
  function restart() {
    const e = makeEntities();
    entities.over = false; entities.paddle = e.paddle; entities.dot = e.dot;
    setScore(0); setMisses(0); setOver(false); setKey((k) => k + 1);
  }
  const onEvent = (e: any) => {
    if (over) return;
    if (e?.type === "score") setScore((s) => s + 1);
    if (e?.type === "miss") {
      setMisses((m) => {
        const nm = m + 1;
        if (nm >= MAX_MISS) { (entities as any).over = true; setOver(true); }
        return nm;
      });
    }
  };

  return (
    <View style={st.fill}>
      <GameEngine key={key} style={st.fill} systems={[Physics]} entities={entities} onEvent={onEvent} running={!over} />
      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <View style={st.hudPanel}>
          <PixelText size="score">{String(score).padStart(3, "0")}</PixelText>
          <PixelText size="label" style={{ marginTop: 4 }}>MISS {misses}/{MAX_MISS}</PixelText>
        </View>
        <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
      </View>
      <GameOverlay visible={over} kind="over" title="GAME OVER" score={`CAUGHT ${score}`}
        primaryLabel="Play again" onPrimary={restart} onExit={onExit} />
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  dotOuter: { position: "absolute", width: DOT_R * 2, height: DOT_R * 2, borderRadius: DOT_R, backgroundColor: color.cyan, alignItems: "center", justifyContent: "center" },
  dotInner: { width: DOT_R * 1.3, height: DOT_R * 1.3, borderRadius: DOT_R, backgroundColor: color.amber },
  hud: { position: "absolute", left: 0, right: 0, paddingHorizontal: space.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  hudPanel: { backgroundColor: "rgba(20,26,34,0.7)", borderRadius: 10, paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, borderColor: color.surfaceLine },
});

export const catchGame: GameModule = { id: "catch", title: "Dot Catcher", kind: "arcade", Screen: GameScreen };
