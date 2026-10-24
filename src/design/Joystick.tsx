// Pocket Rocket — reusable animated arcade joystick.
// Drag the red ball-top; it tilts toward the push and springs back to centre.
// Emits a cardinal direction once per push (re-arms when returned to the deadzone),
// which suits both the continuously-moving grid games and one-step games.
import React, { useRef } from "react";
import { View, Animated, PanResponder, StyleSheet, type GestureResponderEvent, type PanResponderGestureState } from "react-native";
import { color } from "./tokens";

export type JoyDir = { dx: number; dy: number };

export function ArcadeJoystick({ onDirection, size = 128 }: {
  onDirection: (d: JoyDir) => void;
  size?: number;
}) {
  const R = size / 2;
  const travel = R * 0.52;           // how far the ball can move from centre
  const deadzone = travel * 0.45;    // must push past this to register
  const DIAG = 1.6;                  // dominant axis must beat the other by this
  const pos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const lastKey = useRef("");

  const emit = (dx: number, dy: number) => {
    const mag = Math.hypot(dx, dy);
    if (mag < deadzone) { lastKey.current = ""; return; }   // back in deadzone -> re-arm
    const ax = Math.abs(dx), ay = Math.abs(dy);
    // Strict 4-way: in the diagonal wedge (neither axis clearly dominant) HOLD the
    // current direction instead of flip-flopping. Keeps Pac-Man / the maze & snake
    // from snapping sideways and stops spurious hops in Road Hopper.
    if (Math.max(ax, ay) < Math.min(ax, ay) * DIAG) return;
    const d: JoyDir = ax > ay
      ? { dx: dx > 0 ? 1 : -1, dy: 0 }
      : { dx: 0, dy: dy > 0 ? 1 : -1 };
    const key = `${d.dx},${d.dy}`;
    if (key !== lastKey.current) { lastKey.current = key; onDirection(d); }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        let dx = g.dx, dy = g.dy;
        const mag = Math.hypot(dx, dy);
        if (mag > travel) { dx = (dx / mag) * travel; dy = (dy / mag) * travel; }
        pos.setValue({ x: dx, y: dy });
        emit(dx, dy);
      },
      onPanResponderRelease: () => {
        lastKey.current = "";
        Animated.spring(pos, { toValue: { x: 0, y: 0 }, useNativeDriver: true, friction: 5, tension: 140 }).start();
      },
      onPanResponderTerminate: () => {
        lastKey.current = "";
        Animated.spring(pos, { toValue: { x: 0, y: 0 }, useNativeDriver: true, friction: 5, tension: 140 }).start();
      },
    })
  ).current;

  const ball = R * 0.62;

  return (
    <View
      style={[st.wrap, { width: size, height: size, borderRadius: R }]}
      {...pan.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel="Joystick — drag to steer"
    >
      {/* mounting plate + ring (the cabinet dish) */}
      <View style={[st.ring, { width: size * 0.82, height: size * 0.82, borderRadius: (size * 0.82) / 2, top: size * 0.09, left: size * 0.09 }]} />
      {/* centre pivot the shaft rises from */}
      <View style={[st.pivot, { width: R * 0.5, height: R * 0.5, borderRadius: R * 0.25, top: R - R * 0.25, left: R - R * 0.25 }]} />
      {/* red ball-top */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: ball, height: ball, borderRadius: ball / 2,
          top: R - ball / 2, left: R - ball / 2,
          transform: pos.getTranslateTransform(),
        }}
      >
        <View style={[st.ball, { borderRadius: ball / 2 }]} />
        <View style={[st.ballHi, { width: ball * 0.32, height: ball * 0.32, borderRadius: ball * 0.16, top: ball * 0.16, left: ball * 0.2 }]} />
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { backgroundColor: "#10151C", borderWidth: 2, borderColor: color.surfaceLine, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", borderWidth: 2, borderColor: "#2A343F", backgroundColor: "#0A0E13" },
  pivot: { position: "absolute", backgroundColor: "#05070C", borderWidth: 1, borderColor: "#2A343F" },
  ball: { flex: 1, backgroundColor: "#E0433F", borderWidth: 2, borderColor: "#9A2E2B" },
  ballHi: { position: "absolute", backgroundColor: "rgba(255,255,255,0.55)" },
});
