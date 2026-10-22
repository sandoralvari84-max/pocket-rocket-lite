import React, { useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GameEngine, type GameEngineSystem } from "react-native-game-engine";
import type { GameModule, GameContext } from "./contract";

const { width: W, height: H } = Dimensions.get("window");
const PADDLE_W = 84, PADDLE_H = 16, PADDLE_Y = H - 160, DOT_R = 15;
const rndX = () => DOT_R + Math.random() * (W - 2 * DOT_R);

const Paddle = ({ x }: { x: number }) => (
  <View style={[st.paddle, { left: x - PADDLE_W / 2, top: PADDLE_Y }]} />
);
const Dot = ({ x, y }: { x: number; y: number }) => (
  <View style={[st.dot, { left: x - DOT_R, top: y - DOT_R }]} />
);

const Physics: GameEngineSystem = (entities, { touches, time, dispatch }) => {
  const p = entities.paddle, d = entities.dot;
  const t = touches.filter((x: any) => x.type === "move" || x.type === "start").pop();
  if (t) p.x = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, t.event.locationX));
  d.y += (d.speed * time.delta) / 16;
  if (d.y + DOT_R >= PADDLE_Y && d.y - DOT_R <= PADDLE_Y + PADDLE_H &&
      Math.abs(d.x - p.x) <= PADDLE_W / 2 + DOT_R) {
    dispatch({ type: "score" });
    d.x = rndX(); d.y = -DOT_R; d.speed = Math.min(13, d.speed + 0.4);
  } else if (d.y - DOT_R > H) {
    dispatch({ type: "miss" }); d.x = rndX(); d.y = -DOT_R;
  }
  return entities;
};

function Screen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const entities = useRef({
    paddle: { x: W / 2, renderer: Paddle },
    dot: { x: rndX(), y: -DOT_R, speed: 4.5, renderer: Dot },
  }).current;
  const onEvent = (e: any) => {
    if (e?.type === "score") setScore((s) => s + 1);
    if (e?.type === "miss") setMisses((m) => m + 1);
  };
  return (
    <View style={st.fill}>
      <GameEngine style={st.fill} systems={[Physics]} entities={entities} onEvent={onEvent} />
      <View style={[st.hud, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Text style={st.score}>Caught {score}   ·   Missed {misses}</Text>
        <Pressable style={st.exit} onPress={onExit}><Text style={st.exitT}>← Menu</Text></Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0b1021" },
  paddle: { position: "absolute", width: PADDLE_W, height: PADDLE_H, borderRadius: 8, backgroundColor: "#4da3ff" },
  dot: { position: "absolute", width: DOT_R * 2, height: DOT_R * 2, borderRadius: DOT_R, backgroundColor: "#ffd24d" },
  hud: { position: "absolute", left: 0, right: 0, paddingHorizontal: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  score: { color: "#fff", fontSize: 16, fontWeight: "600" },
  exit: { backgroundColor: "rgba(255,255,255,0.15)", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  exitT: { color: "#fff", fontWeight: "600" },
});

export const catchGame: GameModule = { id: "catch", title: "Dot Catcher", kind: "arcade", Screen };
