import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GameEngine, type GameEngineSystem } from "react-native-game-engine";
import type { GameModule, GameContext } from "./contract";

const { width: W, height: H } = Dimensions.get("window");
const ROUND_SECONDS = 30;
const TARGET_COUNT = 4;
const LANE_TOP = 150;
const LANE_BOTTOM = H - 220;
const HIT_PAD = 10;

interface Target {
  id: number;
  x: number;
  y: number;
  r: number;
  vx: number;
  value: number;
  color: string;
}
interface World {
  targets: Target[];
  nextId: number;
  renderer: React.ComponentType<WorldProps>;
}
type WorldProps = Omit<World, "renderer">;

const PALETTE: { r: number; value: number; color: string }[] = [
  { r: 34, value: 1, color: "#4df0a0" },
  { r: 26, value: 2, color: "#ffe24d" },
  { r: 19, value: 4, color: "#ff5d73" },
];

function spawnTarget(id: number): Target {
  const kind = PALETTE[Math.floor(Math.random() * PALETTE.length)] as {
    r: number;
    value: number;
    color: string;
  };
  const dir = Math.random() < 0.5 ? 1 : -1;
  const speed = 2 + Math.random() * 3 + kind.value * 0.6;
  const y = LANE_TOP + Math.random() * (LANE_BOTTOM - LANE_TOP);
  const x = dir === 1 ? -kind.r : W + kind.r;
  return { id, x, y, r: kind.r, vx: dir * speed, value: kind.value, color: kind.color };
}

const WorldView = ({ targets }: WorldProps) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {targets.map((t) => (
      <View
        key={t.id}
        style={[
          st.target,
          {
            left: t.x - t.r,
            top: t.y - t.r,
            width: t.r * 2,
            height: t.r * 2,
            borderRadius: t.r,
            borderColor: t.color,
          },
        ]}
      >
        <View
          style={[
            st.bull,
            { width: t.r, height: t.r, borderRadius: t.r / 2, backgroundColor: t.color },
          ]}
        />
      </View>
    ))}
  </View>
);

const Physics: GameEngineSystem = (entities, { touches, time, dispatch }) => {
  const w = entities.world as World;
  const step = time.delta / 16;

  // taps
  const taps = touches.filter(
    (x: { type: string }) => x.type === "start" || x.type === "press"
  );
  for (const tap of taps) {
    const tx = tap.event.locationX;
    const ty = tap.event.locationY;
    let hitIdx = -1;
    let hitValue = 0;
    for (let i = 0; i < w.targets.length; i++) {
      const t = w.targets[i] as Target;
      const dx = tx - t.x;
      const dy = ty - t.y;
      if (dx * dx + dy * dy <= (t.r + HIT_PAD) * (t.r + HIT_PAD)) {
        // prefer the smaller (higher-value) target when overlapping
        if (hitIdx === -1 || t.r < (w.targets[hitIdx] as Target).r) {
          hitIdx = i;
          hitValue = t.value;
        }
      }
    }
    if (hitIdx >= 0) {
      const dead = w.targets[hitIdx] as Target;
      w.targets = w.targets.filter((t) => t.id !== dead.id);
      w.targets.push(spawnTarget(w.nextId++));
      dispatch({ type: "hit", value: hitValue });
    }
  }

  // move + wrap
  for (const t of w.targets) {
    t.x += t.vx * step;
    if (t.vx > 0 && t.x - t.r > W) {
      const fresh = spawnTarget(t.id);
      t.x = -fresh.r;
      t.y = fresh.y;
      t.vx = Math.abs(fresh.vx);
      t.r = fresh.r;
      t.value = fresh.value;
      t.color = fresh.color;
    } else if (t.vx < 0 && t.x + t.r < 0) {
      const fresh = spawnTarget(t.id);
      t.x = W + fresh.r;
      t.y = fresh.y;
      t.vx = -Math.abs(fresh.vx);
      t.r = fresh.r;
      t.value = fresh.value;
      t.color = fresh.color;
    }
  }

  return entities;
};

function buildWorld(): World {
  const targets: Target[] = [];
  for (let i = 0; i < TARGET_COUNT; i++) targets.push(spawnTarget(i + 1));
  return { targets, nextId: TARGET_COUNT + 1, renderer: WorldView };
}

function Screen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [over, setOver] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const engineEntities = useRef(buildWorld());

  useEffect(() => {
    if (over) return;
    const iv = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setOver(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [over, resetKey]);

  const onEvent = (e: { type?: string; value?: number }) => {
    if (e?.type === "hit" && !over) setScore((s) => s + (e.value ?? 1));
  };

  const restart = () => {
    engineEntities.current = buildWorld();
    setScore(0);
    setTimeLeft(ROUND_SECONDS);
    setOver(false);
    setResetKey((k) => k + 1);
  };

  return (
    <View style={st.fill}>
      <GameEngine
        key={resetKey}
        style={st.fill}
        systems={[Physics]}
        entities={engineEntities.current}
        running={!over}
        onEvent={onEvent}
      />
      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <Text style={st.score}>Score {score}   ·   {timeLeft}s</Text>
        <Pressable style={st.exit} onPress={onExit}>
          <Text style={st.exitT}>← Menu</Text>
        </Pressable>
      </View>
      {over && (
        <View style={st.overlay} pointerEvents="box-none">
          <Text style={st.overTitle}>Time!</Text>
          <Text style={st.overSub}>You scored {score}</Text>
          <Pressable style={st.again} onPress={restart}>
            <Text style={st.againT}>Shoot again</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#121016" },
  target: {
    position: "absolute",
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  bull: { opacity: 0.85 },
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
  overTitle: { color: "#ffe24d", fontSize: 36, fontWeight: "800" },
  overSub: { color: "#fff", fontSize: 18, marginTop: 8 },
  again: {
    marginTop: 20,
    backgroundColor: "#ffe24d",
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 10,
  },
  againT: { color: "#121016", fontWeight: "800", fontSize: 16 },
});

export const targetRangeGame: GameModule = {
  id: "target-range",
  title: "Target Range",
  kind: "arcade",
  Screen,
};
