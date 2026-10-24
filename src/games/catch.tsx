import React, { useRef, useState } from "react";
import { View, StyleSheet, Dimensions, PanResponder } from "react-native";
import { GameEngine, type GameEngineSystem } from "react-native-game-engine";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, GameOverlay, Sprite } from "../design/ui";
import { EffectsLayer, type EffectsHandle } from "../design/effects";
import { useSettings } from "../settings";

// Original owned sprites (tools/art/gen_catch_art.py).
const SHIP = require("../../assets/arcade/catch/ship.png");
const ORB = require("../../assets/arcade/catch/orb.png");

const { width: W, height: H } = Dimensions.get("window");
const PADDLE_W = 92, SHIP_W = 96, PADDLE_Y = H - 170, DOT_R = 16, ORB_VIS = 48;
const MAX_MISS = 5;
const rndX = () => DOT_R + Math.random() * (W - 2 * DOT_R);
const clampPaddle = (x: number) => Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, x));

// Static starfield — a space world behind the play, not dots on a blank screen.
const STARS = Array.from({ length: 34 }, () => {
  const z = Math.random();
  return { x: Math.random() * W, y: Math.random() * (PADDLE_Y + 30), sz: 1 + z * 3, op: 0.3 + z * 0.6 };
});

// Catcher ship. Collision box stays PADDLE_W wide (unchanged logic).
const Paddle = ({ x }: { x: number }) => (
  <View style={{ position: "absolute", left: x - SHIP_W / 2, top: PADDLE_Y - SHIP_W / 2 }}>
    <Sprite source={SHIP} size={SHIP_W} />
  </View>
);
// Collectible = glowing energy orb sprite (centred on its collision point).
const Dot = ({ x, y }: { x: number; y: number }) => (
  <View style={{ position: "absolute", left: x - ORB_VIS / 2, top: y - ORB_VIS / 2 }}>
    <Sprite source={ORB} size={ORB_VIS} />
  </View>
);

const Physics: GameEngineSystem = (entities, { time, dispatch }) => {
  const g = entities as any;
  if (g.over || g.paused) return entities;
  const p = g.paddle, d = g.dot;
  // Smooth follow toward the control target (set by the PanResponder, absolute X).
  p.x += (g.control.x - p.x) * 0.5;
  p.x = clampPaddle(p.x);
  const prevY = d.y;
  d.y += Math.min(28, (d.speed * time.delta) / 16);
  const plane = PADDLE_Y;
  const crossed = prevY - DOT_R <= plane && d.y + DOT_R >= plane;
  if (crossed && Math.abs(d.x - p.x) <= PADDLE_W / 2 + DOT_R) {
    dispatch({ type: "score" });
    d.x = rndX(); d.y = -DOT_R; d.speed = Math.min(11, d.speed + 0.25);
  } else if (d.y - DOT_R > H) {
    dispatch({ type: "miss" });
    d.x = rndX(); d.y = -DOT_R;
  }
  return entities;
};

function GameScreen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useSettings();
  const fx = useRef<EffectsHandle>(null);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [over, setOver] = useState(false);
  const [phase, setPhase] = useState<"ready" | "playing" | "paused">("ready");
  const [key, setKey] = useState(0);
  const entities = useRef(makeEntities()).current;

  function makeEntities() {
    return {
      over: false,
      paused: false,
      control: { x: W / 2 },
      paddle: { x: W / 2, renderer: Paddle },
      dot: { x: rndX(), y: -DOT_R, speed: 4, renderer: Dot },
    };
  }

  // Full-screen control surface: absolute pageX avoids the game-engine's
  // per-child locationX frame-of-reference glitch (the old jumpy paddle).
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => { (entities as any).control.x = clampPaddle(e.nativeEvent.pageX); },
      onPanResponderMove: (e) => { (entities as any).control.x = clampPaddle(e.nativeEvent.pageX); },
    })
  ).current;

  function restart() {
    const e = makeEntities();
    entities.over = false; entities.paused = false;
    entities.paddle = e.paddle; entities.dot = e.dot; entities.control = e.control;
    setScore(0); setMisses(0); setOver(false); setPhase("playing"); setKey((k) => k + 1);
  }
  const start = () => { (entities as any).paused = false; setPhase("playing"); };
  const togglePause = () => {
    setPhase((p) => {
      const np = p === "playing" ? "paused" : p === "paused" ? "playing" : p;
      (entities as any).paused = np !== "playing";
      return np;
    });
  };

  const onEvent = (e: any) => {
    if (over) return;
    if (e?.type === "score") {
      setScore((s) => s + 1);
      const pxx = (entities as any).paddle?.x ?? W / 2;
      fx.current?.burst(pxx, PADDLE_Y - SHIP_W / 2, { count: 10, color: color.amber, speed: 120, size: 5 });
      fx.current?.popScore(pxx, PADDLE_Y - SHIP_W, "+1", color.cyan);
    }
    if (e?.type === "miss") {
      const dx = (entities as any).dot?.x ?? W / 2;
      fx.current?.burst(dx, H - 70, { count: 10, color: color.danger, speed: 120, size: 5, rise: 0 });
      setMisses((m) => {
        const nm = m + 1;
        if (nm >= MAX_MISS) { (entities as any).over = true; setOver(true); }
        return nm;
      });
    }
  };

  const running = phase === "playing" && !over;

  return (
    <View style={st.fill}>
      {/* space world */}
      {STARS.map((s, i) => (
        <View key={i} pointerEvents="none" style={{ position: "absolute", left: s.x, top: s.y, width: s.sz, height: s.sz, borderRadius: s.sz / 2, backgroundColor: "#E8F0FF", opacity: s.op }} />
      ))}
      <View pointerEvents="none" style={st.horizon} />

      <GameEngine key={key} style={st.engine} systems={[Physics]} entities={entities} onEvent={onEvent} running={running} />

      {/* control surface (below HUD + overlays, above the engine) */}
      <View style={StyleSheet.absoluteFill} {...pan.panHandlers} pointerEvents={running ? "auto" : "none"} />

      <EffectsLayer ref={fx} reduced={reducedMotion} />

      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <View style={st.hudPanel}>
          <PixelText size="score">{String(score).padStart(3, "0")}</PixelText>
          <PixelText size="label" style={{ marginTop: 4 }}>MISS {misses}/{MAX_MISS}</PixelText>
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <IconButton label="Pause" glyph={phase === "paused" ? "▶" : "❚❚"} onPress={togglePause} />
          <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
        </View>
      </View>

      <GameOverlay visible={phase === "ready"} kind="pause" title="DOT CATCHER"
        primaryLabel="Launch" onPrimary={start} onExit={onExit}>
        <Body muted style={{ textAlign: "center", marginTop: space.md }}>
          Slide anywhere to steer the ship. Catch the falling energy orbs — miss
          five and it's over.
        </Body>
      </GameOverlay>
      <GameOverlay visible={phase === "paused" && !over} kind="pause" title="PAUSED"
        primaryLabel="Resume" onPrimary={togglePause} onExit={onExit} />
      <GameOverlay visible={over} kind="over" title="GAME OVER" score={`CAUGHT ${score}`}
        primaryLabel="Play again" onPrimary={restart} onExit={onExit} />
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#060912" },
  engine: { flex: 1, backgroundColor: "transparent" },
  horizon: { position: "absolute", left: 0, right: 0, bottom: 0, height: 120, backgroundColor: "#0C1428", borderTopWidth: 2, borderTopColor: "rgba(0,229,255,0.25)" },
  hud: { position: "absolute", left: 0, right: 0, zIndex: 5, paddingHorizontal: space.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  hudPanel: { backgroundColor: "rgba(20,26,34,0.7)", borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, borderColor: color.surfaceLine },
});

export const catchGame: GameModule = { id: "catch", title: "Dot Catcher", kind: "arcade", Screen: GameScreen };
