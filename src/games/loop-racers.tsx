import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";

const { width: W, height: H } = Dimensions.get("window");
const CX = W / 2;
const CY = H * 0.46;
const OUT_RX = W * 0.42;
const OUT_RY = H * 0.3;
const IN_RX = W * 0.2;
const IN_RY = H * 0.14;
const MID_RX = (OUT_RX + IN_RX) / 2;
const TOTAL_LAPS = 3;

const ACCEL = 0.11;
const MAX_SPEED = 4.6;
const OFF_MAX_SPEED = 1.6;
const DRAG = 0.985;
const TURN = 0.055;
const CAR_W = 26;
const CAR_H = 14;

interface Car {
  x: number;
  y: number;
  angle: number; // heading, radians
  speed: number;
}
interface AiCar {
  t: number; // parametric angle around the track
  speed: number; // radians per frame
  lane: number; // 0..1 offset between inner/outer lane
  laps: number;
  color: string;
}

function onTrack(x: number, y: number): boolean {
  const ox = (x - CX) / OUT_RX;
  const oy = (y - CY) / OUT_RY;
  const ix = (x - CX) / IN_RX;
  const iy = (y - CY) / IN_RY;
  const insideOuter = ox * ox + oy * oy <= 1;
  const outsideInner = ix * ix + iy * iy >= 1;
  return insideOuter && outsideInner;
}

function Screen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  // player starts on the right straight, heading down (clockwise)
  const carRef = useRef<Car>({ x: CX + MID_RX, y: CY, angle: Math.PI / 2, speed: 0 });
  const armedRef = useRef(false);
  const lapsRef = useRef(0);
  const accelRef = useRef(false);
  const leftRef = useRef(false);
  const rightRef = useRef(false);
  const overRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const aiRef = useRef<AiCar[]>([
    { t: -0.25, speed: 0.028, lane: 0.32, laps: 0, color: "#ff7043" },
    { t: -0.5, speed: 0.025, lane: 0.68, laps: 0, color: "#ab47bc" },
  ]);

  const [, setTick] = useState(0);
  const [laps, setLaps] = useState(0);
  const [won, setWon] = useState<null | "you" | "ai">(null);

  const step = () => {
    if (overRef.current) return;
    const c = carRef.current;

    if (leftRef.current && c.speed > 0.2) c.angle -= TURN;
    if (rightRef.current && c.speed > 0.2) c.angle += TURN;
    if (accelRef.current) c.speed += ACCEL;
    c.speed *= DRAG;

    const cap = onTrack(c.x, c.y) ? MAX_SPEED : OFF_MAX_SPEED;
    if (c.speed > cap) c.speed = cap;
    if (c.speed < 0) c.speed = 0;

    const prevY = c.y;
    c.x += Math.cos(c.angle) * c.speed;
    c.y += Math.sin(c.angle) * c.speed;

    // keep the car on the play field
    c.x = Math.max(8, Math.min(W - 8, c.x));
    c.y = Math.max(TopBound(insets.top), Math.min(H - 8, c.y));

    // lap line: arm when on the left half, count when crossing the finish
    // line on the right half heading downwards (a full loop completed)
    if (c.x < CX) armedRef.current = true;
    if (armedRef.current && c.x > CX && prevY < CY && c.y >= CY) {
      armedRef.current = false;
      lapsRef.current += 1;
      setLaps(lapsRef.current);
      if (lapsRef.current >= TOTAL_LAPS) {
        overRef.current = true;
        setWon("you");
      }
    }

    // AI cars drive the racing line
    for (const ai of aiRef.current) {
      const before = ai.t;
      ai.t += ai.speed;
      if (Math.floor(ai.t / (Math.PI * 2)) > Math.floor(before / (Math.PI * 2))) {
        ai.laps += 1;
        if (ai.laps >= TOTAL_LAPS && !overRef.current) {
          overRef.current = true;
          setWon("ai");
        }
      }
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
    carRef.current = { x: CX + MID_RX, y: CY, angle: Math.PI / 2, speed: 0 };
    armedRef.current = false;
    lapsRef.current = 0;
    aiRef.current = [
      { t: -0.25, speed: 0.028, lane: 0.32, laps: 0, color: "#ff7043" },
      { t: -0.5, speed: 0.025, lane: 0.68, laps: 0, color: "#ab47bc" },
    ];
    overRef.current = false;
    setWon(null);
    setLaps(0);
  };

  const c = carRef.current;

  const aiPos = (ai: AiCar): { x: number; y: number; angle: number } => {
    const rx = IN_RX + (OUT_RX - IN_RX) * ai.lane;
    const ry = IN_RY + (OUT_RY - IN_RY) * ai.lane;
    const x = CX + rx * Math.cos(ai.t);
    const y = CY + ry * Math.sin(ai.t);
    return { x, y, angle: ai.t + Math.PI / 2 };
  };

  return (
    <View style={st.fill}>
      {/* track: outer grey ellipse with inner infield cut out */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: CX - OUT_RX,
          top: CY - OUT_RY,
          width: OUT_RX * 2,
          height: OUT_RY * 2,
          borderRadius: Math.max(OUT_RX, OUT_RY),
          backgroundColor: "#4a4a52",
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: CX - IN_RX,
          top: CY - IN_RY,
          width: IN_RX * 2,
          height: IN_RY * 2,
          borderRadius: Math.max(IN_RX, IN_RY),
          backgroundColor: "#2e7d32",
        }}
      />
      {/* start / finish line on the right straight */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: CX + MID_RX - 3,
          top: CY - (OUT_RY - IN_RY) / 2,
          width: 6,
          height: OUT_RY - IN_RY,
          backgroundColor: "#fff",
        }}
      />

      {/* AI cars */}
      {aiRef.current.map((ai, i) => {
        const p = aiPos(ai);
        return (
          <View
            key={i}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: p.x - CAR_W / 2,
              top: p.y - CAR_H / 2,
              width: CAR_W,
              height: CAR_H,
              borderRadius: 4,
              backgroundColor: ai.color,
              transform: [{ rotate: `${p.angle}rad` }],
            }}
          />
        );
      })}

      {/* player car */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: c.x - CAR_W / 2,
          top: c.y - CAR_H / 2,
          width: CAR_W,
          height: CAR_H,
          borderRadius: 4,
          backgroundColor: "#4da3ff",
          borderWidth: 2,
          borderColor: "#dcefff",
          transform: [{ rotate: `${c.angle}rad` }],
        }}
      />

      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <Pressable style={st.exit} onPress={onExit}>
          <Text style={st.exitT}>← Menu</Text>
        </Pressable>
        <Text style={st.score}>Lap {Math.min(laps + 1, TOTAL_LAPS)}/{TOTAL_LAPS}</Text>
      </View>

      {/* controls */}
      <View style={[st.controls, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]} pointerEvents="box-none">
        <Pressable
          style={st.sideBtn}
          onPressIn={() => {
            leftRef.current = true;
          }}
          onPressOut={() => {
            leftRef.current = false;
          }}
        >
          <Text style={st.btnT}>◀</Text>
        </Pressable>
        <Pressable
          style={st.gasBtn}
          onPressIn={() => {
            accelRef.current = true;
          }}
          onPressOut={() => {
            accelRef.current = false;
          }}
        >
          <Text style={st.btnT}>GAS</Text>
        </Pressable>
        <Pressable
          style={st.sideBtn}
          onPressIn={() => {
            rightRef.current = true;
          }}
          onPressOut={() => {
            rightRef.current = false;
          }}
        >
          <Text style={st.btnT}>▶</Text>
        </Pressable>
      </View>

      {won ? (
        <View style={st.overlay} pointerEvents="box-none">
          <Text style={st.overBig}>{won === "you" ? "You win!" : "AI wins"}</Text>
          <Pressable style={st.again} onPress={reset}>
            <Text style={st.againT}>Race again</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function TopBound(topInset: number): number {
  return Math.max(topInset, 24) + 56;
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#1b5e20" },
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
  exit: { backgroundColor: "rgba(0,0,0,0.3)", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  exitT: { color: "#fff", fontWeight: "600" },
  controls: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 16,
  },
  sideBtn: {
    backgroundColor: "rgba(255,255,255,0.16)",
    width: 72,
    height: 60,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  gasBtn: {
    backgroundColor: "rgba(77,163,255,0.5)",
    width: 100,
    height: 72,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  btnT: { color: "#fff", fontSize: 20, fontWeight: "800" },
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
  overBig: { color: "#fff", fontSize: 30, fontWeight: "700", marginBottom: 16 },
  again: { backgroundColor: "#4da3ff", paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
  againT: { color: "#fff", fontWeight: "700" },
});

export const loopRacersGame: GameModule = {
  id: "loop-racers",
  title: "Loop Racers",
  kind: "arcade",
  Screen,
};
