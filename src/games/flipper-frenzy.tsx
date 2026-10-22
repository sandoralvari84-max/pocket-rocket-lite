import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";

const { width: W, height: H } = Dimensions.get("window");
const R = 11; // ball radius
const WALL = 10;
const TOP = 90; // reserve space for the HUD
const GRAV = 0.35;
const BUMP_R = 26;
const FLIP_ZONE = 150; // height of the flipper reaction zone at the bottom

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
interface Bumper {
  x: number;
  y: number;
}

const BUMPERS: Bumper[] = [
  { x: W * 0.5, y: TOP + 110 },
  { x: W * 0.28, y: TOP + 220 },
  { x: W * 0.72, y: TOP + 220 },
];

function freshBall(): Ball {
  return { x: W * 0.5, y: TOP + 30, vx: (Math.random() - 0.5) * 2, vy: 0 };
}

function Screen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const ballRef = useRef<Ball>(freshBall());
  const leftRef = useRef(false);
  const rightRef = useRef(false);
  const overRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [, setTick] = useState(0);
  const [score, setScore] = useState(0);
  const [balls, setBalls] = useState(3);
  const [over, setOver] = useState(false);

  const addScore = (n: number) => setScore((s) => s + n);

  const step = () => {
    if (overRef.current) return;
    const b = ballRef.current;
    b.vy += GRAV;
    b.x += b.vx;
    b.y += b.vy;

    // side walls
    if (b.x < WALL + R) {
      b.x = WALL + R;
      b.vx = Math.abs(b.vx) * 0.85;
    } else if (b.x > W - WALL - R) {
      b.x = W - WALL - R;
      b.vx = -Math.abs(b.vx) * 0.85;
    }
    // top wall
    if (b.y < TOP + R) {
      b.y = TOP + R;
      b.vy = Math.abs(b.vy) * 0.85;
    }

    // bumpers
    for (const bu of BUMPERS) {
      const dx = b.x - bu.x;
      const dy = b.y - bu.y;
      const dist = Math.hypot(dx, dy);
      const min = R + BUMP_R;
      if (dist < min && dist > 0) {
        const nx = dx / dist;
        const ny = dy / dist;
        b.x = bu.x + nx * min;
        b.y = bu.y + ny * min;
        const dot = b.vx * nx + b.vy * ny;
        b.vx = (b.vx - 2 * dot * nx) * 0.9 + nx * 2.2;
        b.vy = (b.vy - 2 * dot * ny) * 0.9 + ny * 2.2;
        addScore(100);
      }
    }

    // flippers: a press kicks the ball up when it is low on that side and falling
    const flipY = H - FLIP_ZONE;
    if (b.y > flipY && b.vy > 0) {
      if (leftRef.current && b.x < W / 2) {
        b.vy = -11;
        b.vx += 4;
        addScore(5);
      } else if (rightRef.current && b.x >= W / 2) {
        b.vy = -11;
        b.vx -= 4;
        addScore(5);
      }
    }

    // clamp horizontal speed
    b.vx = Math.max(-12, Math.min(12, b.vx));

    // drained
    if (b.y - R > H) {
      setBalls((n) => {
        const left = n - 1;
        if (left <= 0) {
          overRef.current = true;
          setOver(true);
        } else {
          ballRef.current = freshBall();
        }
        return left;
      });
    }

    setTick((t) => (t + 1) % 1000000);
  };

  useEffect(() => {
    let mounted = true;
    const loop = () => {
      step();
      if (mounted) rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      mounted = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    ballRef.current = freshBall();
    overRef.current = false;
    setOver(false);
    setScore(0);
    setBalls(3);
  };

  const b = ballRef.current;
  const flipY = H - FLIP_ZONE;

  return (
    <View style={st.fill}>
      {/* flipper control halves */}
      <Pressable
        style={[st.half, { left: 0 }]}
        onPressIn={() => {
          leftRef.current = true;
        }}
        onPressOut={() => {
          leftRef.current = false;
        }}
      />
      <Pressable
        style={[st.half, { right: 0 }]}
        onPressIn={() => {
          rightRef.current = true;
        }}
        onPressOut={() => {
          rightRef.current = false;
        }}
      />

      {/* table walls */}
      <View style={[st.wall, { left: 0, top: TOP, width: WALL, height: H - TOP }]} pointerEvents="none" />
      <View style={[st.wall, { right: 0, top: TOP, width: WALL, height: H - TOP }]} pointerEvents="none" />
      <View style={[st.wall, { left: 0, right: 0, top: TOP, height: WALL }]} pointerEvents="none" />

      {/* bumpers */}
      {BUMPERS.map((bu, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: bu.x - BUMP_R,
            top: bu.y - BUMP_R,
            width: BUMP_R * 2,
            height: BUMP_R * 2,
            borderRadius: BUMP_R,
            backgroundColor: "#ff7eb6",
            borderWidth: 3,
            borderColor: "#ffd1e8",
          }}
        />
      ))}

      {/* flipper visuals */}
      <View
        pointerEvents="none"
        style={[
          st.flipper,
          {
            left: WALL + 6,
            top: flipY + 60,
            transform: [{ rotate: leftRef.current ? "-28deg" : "18deg" }],
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          st.flipper,
          {
            right: WALL + 6,
            top: flipY + 60,
            transform: [{ rotate: rightRef.current ? "28deg" : "-18deg" }],
          },
        ]}
      />

      {/* ball */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: b.x - R,
          top: b.y - R,
          width: R * 2,
          height: R * 2,
          borderRadius: R,
          backgroundColor: "#ffe14d",
        }}
      />

      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <Pressable style={st.exit} onPress={onExit}>
          <Text style={st.exitT}>← Menu</Text>
        </Pressable>
        <Text style={st.score}>
          {score}   ·   Balls {balls}
        </Text>
      </View>

      {over ? (
        <View style={st.overlay} pointerEvents="box-none">
          <Text style={st.overBig}>Game Over</Text>
          <Text style={st.overSub}>Score {score}</Text>
          <Pressable style={st.again} onPress={reset}>
            <Text style={st.againT}>Play again</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#141029" },
  half: { position: "absolute", top: TOP, bottom: 0, width: W / 2 },
  wall: { position: "absolute", backgroundColor: "#3a356b", borderRadius: 4 },
  flipper: {
    position: "absolute",
    width: W * 0.34,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#6ee7ff",
  },
  hud: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 5,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  score: { color: "#fff", fontSize: 16, fontWeight: "600" },
  exit: { backgroundColor: "rgba(255,255,255,0.15)", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  exitT: { color: "#fff", fontWeight: "600" },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  overBig: { color: "#fff", fontSize: 26, fontWeight: "700" },
  overSub: { color: "#ddd", fontSize: 16, marginTop: 6, marginBottom: 16 },
  again: { backgroundColor: "#6ee7ff", paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
  againT: { color: "#06283b", fontWeight: "700" },
});

export const flipperFrenzyGame: GameModule = {
  id: "flipper-frenzy",
  title: "Flipper Frenzy",
  kind: "arcade",
  Screen,
};
