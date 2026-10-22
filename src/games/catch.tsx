import React, { useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { GameEngine, type GameEngineSystem } from "react-native-game-engine";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";

const { width: W, height: H } = Dimensions.get("window");
const PADDLE_W = 84, PADDLE_H = 16, PADDLE_Y = H - 170, DOT_R = 15;
const MAX_MISS = 5;
const rndX = () => DOT_R + Math.random() * (W - 2 * DOT_R);
const clampPaddle = (x: number) => Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, x));

const Paddle = ({ x }: { x: number }) => (
  <View style={[st.paddle, { left: x - PADDLE_W / 2, top: PADDLE_Y }]} />
);
const Dot = ({ x, y }: { x: number; y: number }) => (
  <View style={[st.dot, { left: x - DOT_R, top: y - DOT_R }]} />
);

const Physics: GameEngineSystem = (entities, { touches, time, dispatch }) => {
  const g = entities as any;
  if (g.over) return entities;
  const p = g.paddle, d = g.dot;
  // paddle: follow the latest touch, clamped (ignores off-screen coords)
  const t = touches.filter((x: any) => x.type === "move" || x.type === "start").pop();
  if (t) { const lx = t.event.locationX; if (lx >= 0 && lx <= W) p.x = clampPaddle(lx); }
  // swept vertical motion (cap per-frame step so a lagging frame can't teleport the dot)
  const prevY = d.y;
  d.y += Math.min(28, (d.speed * time.delta) / 16);
  // CATCH: the dot crossed the paddle plane this frame AND overlaps the paddle in x
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

function Screen({ onExit }: GameContext) {
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
        <Text style={st.score}>Caught {score}   ·   Missed {misses}/{MAX_MISS}</Text>
        <Pressable style={st.exit} onPress={onExit}><Text style={st.exitT}>← Menu</Text></Pressable>
      </View>
      {over && (
        <View style={st.overlay}>
          <Text style={st.overT}>Game over</Text>
          <Text style={st.overS}>You caught {score}</Text>
          <Pressable style={st.again} onPress={restart}><Text style={st.againT}>Play again</Text></Pressable>
        </View>
      )}
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
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(11,16,33,0.85)" },
  overT: { color: "#fff", fontSize: 28, fontWeight: "800" },
  overS: { color: "#cfe2ff", fontSize: 16, marginTop: 8, marginBottom: 20 },
  again: { backgroundColor: "#4da3ff", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  againT: { color: "#fff", fontWeight: "700", fontSize: 16 },
});

export const catchGame: GameModule = { id: "catch", title: "Dot Catcher", kind: "arcade", Screen };
