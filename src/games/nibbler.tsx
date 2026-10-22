import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  PanResponder,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";

const COLS = 13;
const ROWS = 15;
const { width: W, height: H } = Dimensions.get("window");
const CELL = Math.floor(Math.min(W - 24, H * 0.6) / COLS);
const BOARD_W = CELL * COLS;
const BOARD_H = CELL * ROWS;
const TICK = 140;

type Dir = { dx: number; dy: number };
type Cell = { r: number; c: number };

const START: Cell[] = [
  { r: 7, c: 4 },
  { r: 7, c: 3 },
  { r: 7, c: 2 },
];

function randFood(snake: Cell[]): Cell {
  const taken = new Set(snake.map((s) => `${s.r},${s.c}`));
  const free: Cell[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!taken.has(`${r},${c}`)) free.push({ r, c });
    }
  }
  if (free.length === 0) return { r: 0, c: 0 };
  return free[Math.floor(Math.random() * free.length)];
}

function Screen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();

  const snakeRef = useRef<Cell[]>(START.map((s) => ({ ...s })));
  const dirRef = useRef<Dir>({ dx: 1, dy: 0 });
  const nextDirRef = useRef<Dir>({ dx: 1, dy: 0 });
  const foodRef = useRef<Cell>(randFood(START));
  const overRef = useRef<boolean>(false);

  const [, setFrame] = useState(0);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);

  const turn = (d: Dir): void => {
    const cur = dirRef.current;
    // Disallow reversing directly into the neck.
    if (d.dx === -cur.dx && d.dy === -cur.dy) return;
    nextDirRef.current = d;
  };

  const restart = (): void => {
    snakeRef.current = START.map((s) => ({ ...s }));
    dirRef.current = { dx: 1, dy: 0 };
    nextDirRef.current = { dx: 1, dy: 0 };
    foodRef.current = randFood(START);
    overRef.current = false;
    setScore(0);
    setOver(false);
    setFrame((f) => f + 1);
  };

  useEffect(() => {
    const id = setInterval(() => {
      if (overRef.current) return;
      dirRef.current = nextDirRef.current;
      const d = dirRef.current;
      const snake = snakeRef.current;
      const head = snake[0];
      const nh: Cell = { r: head.r + d.dy, c: head.c + d.dx };

      // Wall collision.
      if (nh.r < 0 || nh.c < 0 || nh.r >= ROWS || nh.c >= COLS) {
        overRef.current = true;
        setOver(true);
        setFrame((f) => f + 1);
        return;
      }
      // Self collision (ignore tail tip, which will move away unless growing).
      const eating = nh.r === foodRef.current.r && nh.c === foodRef.current.c;
      const body = eating ? snake : snake.slice(0, snake.length - 1);
      if (body.some((s) => s.r === nh.r && s.c === nh.c)) {
        overRef.current = true;
        setOver(true);
        setFrame((f) => f + 1);
        return;
      }

      const next = [nh, ...snake];
      if (eating) {
        snakeRef.current = next;
        foodRef.current = randFood(next);
        setScore((s) => s + 1);
      } else {
        next.pop();
        snakeRef.current = next;
      }
      setFrame((f) => f + 1);
    }, TICK);
    return () => clearInterval(id);
  }, []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8,
      onPanResponderRelease: (
        _e: GestureResponderEvent,
        g: PanResponderGestureState
      ) => {
        if (Math.abs(g.dx) > Math.abs(g.dy)) {
          turn({ dx: g.dx > 0 ? 1 : -1, dy: 0 });
        } else if (Math.abs(g.dy) > 0) {
          turn({ dx: 0, dy: g.dy > 0 ? 1 : -1 });
        }
      },
    })
  ).current;

  const snake = snakeRef.current;
  const food = foodRef.current;

  return (
    <View style={st.fill}>
      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <Text style={st.info}>Score {score}</Text>
        <Pressable style={st.exit} onPress={onExit}>
          <Text style={st.exitT}>← Menu</Text>
        </Pressable>
      </View>

      <View style={st.center}>
        <Text style={st.title}>Nibbler</Text>
        <View style={[st.board, { width: BOARD_W, height: BOARD_H }]} {...pan.panHandlers}>
          <View
            style={[
              st.food,
              { left: food.c * CELL + 2, top: food.r * CELL + 2, width: CELL - 4, height: CELL - 4 },
            ]}
          />
          {snake.map((s, i) => (
            <View
              key={`s${i}`}
              style={[
                i === 0 ? st.headCell : st.bodyCell,
                { left: s.c * CELL + 1, top: s.r * CELL + 1, width: CELL - 2, height: CELL - 2 },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={st.dpad} pointerEvents="box-none">
        <Pressable style={st.pad} onPress={() => turn({ dx: 0, dy: -1 })}>
          <Text style={st.padT}>▲</Text>
        </Pressable>
        <View style={st.padRow}>
          <Pressable style={st.pad} onPress={() => turn({ dx: -1, dy: 0 })}>
            <Text style={st.padT}>◀</Text>
          </Pressable>
          <Pressable style={st.pad} onPress={() => turn({ dx: 1, dy: 0 })}>
            <Text style={st.padT}>▶</Text>
          </Pressable>
        </View>
        <Pressable style={st.pad} onPress={() => turn({ dx: 0, dy: 1 })}>
          <Text style={st.padT}>▼</Text>
        </Pressable>
      </View>

      {over && (
        <View style={st.overlay}>
          <Text style={st.overTitle}>Game Over</Text>
          <Text style={st.overSub}>Score {score}</Text>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { color: "#9fd0ff", fontSize: 18, fontWeight: "700", marginBottom: 10 },
  board: { backgroundColor: "#05070f", borderRadius: 6, overflow: "hidden" },
  food: { position: "absolute", borderRadius: 999, backgroundColor: "#ffd24d" },
  headCell: { position: "absolute", borderRadius: 4, backgroundColor: "#7ef0a0" },
  bodyCell: { position: "absolute", borderRadius: 3, backgroundColor: "#3fb56e" },
  hud: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  info: { color: "#fff", fontSize: 15, fontWeight: "600" },
  exit: { backgroundColor: "rgba(255,255,255,0.15)", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  exitT: { color: "#fff", fontWeight: "600" },
  dpad: { position: "absolute", bottom: 32, left: 0, right: 0, alignItems: "center" },
  padRow: { flexDirection: "row" },
  pad: {
    width: 58,
    height: 58,
    margin: 4,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  padT: { color: "#fff", fontSize: 22, fontWeight: "700" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,7,15,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  overTitle: { color: "#fff", fontSize: 30, fontWeight: "800", marginBottom: 6 },
  overSub: { color: "#9fd0ff", fontSize: 18, fontWeight: "600", marginBottom: 18 },
  again: { backgroundColor: "#4da3ff", paddingVertical: 12, paddingHorizontal: 26, borderRadius: 10 },
  againT: { color: "#06142e", fontSize: 16, fontWeight: "800" },
});

export const nibblerGame: GameModule = {
  id: "nibbler",
  title: "Nibbler",
  kind: "arcade",
  Screen,
};
