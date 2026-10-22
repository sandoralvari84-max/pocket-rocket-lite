import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  type GestureResponderEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";

const { width: W, height: H } = Dimensions.get("window");
const BALL_R = 10;
const HOLE_R = 18;
const FRICTION = 0.975;
const STOP_SPEED = 0.25;
const MAX_POWER = 18;
const WALL = 8;

interface Vec {
  x: number;
  y: number;
}

const START: Vec = { x: W * 0.5, y: H * 0.78 };
const HOLE: Vec = { x: W * 0.5, y: H * 0.26 };

function Screen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const ballRef = useRef<Vec>({ ...START });
  const velRef = useRef<Vec>({ x: 0, y: 0 });
  const movingRef = useRef(false);
  const dragStartRef = useRef<Vec | null>(null);
  const dragNowRef = useRef<Vec | null>(null);
  const sunkRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const [, setTick] = useState(0);
  const [strokes, setStrokes] = useState(0);
  const [sunk, setSunk] = useState(false);
  const bump = () => setTick((t) => (t + 1) % 1000000);

  const step = () => {
    const b = ballRef.current;
    const v = velRef.current;
    if (movingRef.current && !sunkRef.current) {
      b.x += v.x;
      b.y += v.y;
      v.x *= FRICTION;
      v.y *= FRICTION;

      const minX = WALL + BALL_R;
      const maxX = W - WALL - BALL_R;
      const minY = Math.max(insets.top, 24) + 60 + BALL_R;
      const maxY = H - WALL - BALL_R - 120;
      if (b.x < minX) {
        b.x = minX;
        v.x = -v.x * 0.7;
      } else if (b.x > maxX) {
        b.x = maxX;
        v.x = -v.x * 0.7;
      }
      if (b.y < minY) {
        b.y = minY;
        v.y = -v.y * 0.7;
      } else if (b.y > maxY) {
        b.y = maxY;
        v.y = -v.y * 0.7;
      }

      const dx = b.x - HOLE.x;
      const dy = b.y - HOLE.y;
      const dist = Math.hypot(dx, dy);
      const speed = Math.hypot(v.x, v.y);
      if (dist < HOLE_R && speed < 9) {
        sunkRef.current = true;
        movingRef.current = false;
        setSunk(true);
        b.x = HOLE.x;
        b.y = HOLE.y;
      } else if (speed < STOP_SPEED) {
        v.x = 0;
        v.y = 0;
        movingRef.current = false;
      }
      bump();
    }
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

  const canAim = () => !movingRef.current && !sunkRef.current;

  const onGrant = (e: GestureResponderEvent) => {
    if (!canAim()) return;
    const p = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
    dragStartRef.current = p;
    dragNowRef.current = p;
    bump();
  };
  const onMove = (e: GestureResponderEvent) => {
    if (!canAim() || !dragStartRef.current) return;
    dragNowRef.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
    bump();
  };
  const onRelease = () => {
    const start = dragStartRef.current;
    const now = dragNowRef.current;
    dragStartRef.current = null;
    dragNowRef.current = null;
    if (!canAim() || !start || !now) {
      bump();
      return;
    }
    // slingshot: pull back from the ball and release to shoot the opposite way
    let dx = (start.x - now.x) * 0.14;
    let dy = (start.y - now.y) * 0.14;
    const mag = Math.hypot(dx, dy);
    if (mag < 1.2) {
      bump();
      return; // tiny drag, ignore
    }
    if (mag > MAX_POWER) {
      dx = (dx / mag) * MAX_POWER;
      dy = (dy / mag) * MAX_POWER;
    }
    velRef.current = { x: dx, y: dy };
    movingRef.current = true;
    setStrokes((s) => s + 1);
    bump();
  };

  const reset = () => {
    ballRef.current = { ...START };
    velRef.current = { x: 0, y: 0 };
    movingRef.current = false;
    sunkRef.current = false;
    dragStartRef.current = null;
    dragNowRef.current = null;
    setSunk(false);
    setStrokes(0);
    bump();
  };

  const b = ballRef.current;
  const dragging = dragStartRef.current && dragNowRef.current;
  // aim preview: a dot showing the launch direction
  let aim: Vec | null = null;
  if (dragging && dragStartRef.current && dragNowRef.current) {
    const s = dragStartRef.current;
    const n = dragNowRef.current;
    const dx = (s.x - n.x);
    const dy = (s.y - n.y);
    const mag = Math.min(Math.hypot(dx, dy), 90);
    const ang = Math.atan2(dy, dx);
    aim = { x: b.x + Math.cos(ang) * mag, y: b.y + Math.sin(ang) * mag };
  }

  return (
    <View
      style={st.fill}
      onStartShouldSetResponder={canAim}
      onMoveShouldSetResponder={canAim}
      onResponderGrant={onGrant}
      onResponderMove={onMove}
      onResponderRelease={onRelease}
    >
      {/* hole */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: HOLE.x - HOLE_R,
          top: HOLE.y - HOLE_R,
          width: HOLE_R * 2,
          height: HOLE_R * 2,
          borderRadius: HOLE_R,
          backgroundColor: "#07210f",
          borderWidth: 3,
          borderColor: "#d8f5c8",
        }}
      />
      <View
        pointerEvents="none"
        style={{ position: "absolute", left: HOLE.x - 2, top: HOLE.y - HOLE_R - 26, width: 4, height: 26, backgroundColor: "#fff" }}
      />
      <View
        pointerEvents="none"
        style={{ position: "absolute", left: HOLE.x, top: HOLE.y - HOLE_R - 26, width: 20, height: 12, backgroundColor: "#ff5252" }}
      />

      {/* aim preview */}
      {aim ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: aim.x - 5,
            top: aim.y - 5,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: "rgba(255,255,255,0.85)",
          }}
        />
      ) : null}

      {/* ball */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: b.x - BALL_R,
          top: b.y - BALL_R,
          width: BALL_R * 2,
          height: BALL_R * 2,
          borderRadius: BALL_R,
          backgroundColor: "#ffffff",
        }}
      />

      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <Pressable style={st.exit} onPress={onExit}>
          <Text style={st.exitT}>← Menu</Text>
        </Pressable>
        <Text style={st.score}>Strokes {strokes}</Text>
      </View>

      <View style={[st.hint, { bottom: Math.max(insets.bottom, 16) + 10 }]} pointerEvents="none">
        <Text style={st.hintT}>Drag back from the ball, then release to putt</Text>
      </View>

      {sunk ? (
        <View style={st.overlay} pointerEvents="box-none">
          <Text style={st.overBig}>Sunk it!</Text>
          <Text style={st.overSub}>{strokes} stroke{strokes === 1 ? "" : "s"}</Text>
          <Pressable style={st.again} onPress={reset}>
            <Text style={st.againT}>Play again</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#2e7d32" },
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
  hint: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  hintT: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  overBig: { color: "#fff", fontSize: 28, fontWeight: "700" },
  overSub: { color: "#eee", fontSize: 18, marginTop: 6, marginBottom: 16 },
  again: { backgroundColor: "#fff", paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
  againT: { color: "#2e7d32", fontWeight: "700" },
});

export const puttPalGame: GameModule = {
  id: "putt-pal",
  title: "Putt Pal",
  kind: "arcade",
  Screen,
};
