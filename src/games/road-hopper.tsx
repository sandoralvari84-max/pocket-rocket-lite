import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";

const COLS = 9;
const ROWS = 8; // row 0 = goal (safe), rows 1..6 = traffic, row 7 = start (safe)
const { width: W, height: H } = Dimensions.get("window");
const CELL = Math.floor(Math.min(W - 24, H * 0.6) / COLS);
const BOARD_W = CELL * COLS;
const BOARD_H = CELL * ROWS;
const PLAYER_COL = 4;
const START_ROW = ROWS - 1;
const TICK = 40; // ms
const DT = TICK / 1000;

type Lane = { row: number; dir: 1 | -1; speed: number; width: number; color: string };
type Obstacle = { lane: number; x: number };

// One obstacle per traffic lane; configurable speed/direction/size.
const LANES: Lane[] = [
  { row: 1, dir: 1, speed: 3.2, width: 2, color: "#ff5c7a" },
  { row: 2, dir: -1, speed: 2.4, width: 3, color: "#ffb24d" },
  { row: 3, dir: 1, speed: 4.1, width: 2, color: "#4da3ff" },
  { row: 4, dir: -1, speed: 3.0, width: 2, color: "#b06cff" },
  { row: 5, dir: 1, speed: 2.1, width: 3, color: "#ff5c7a" },
  { row: 6, dir: -1, speed: 3.6, width: 2, color: "#4dd6a1" },
];

function initObstacles(): Obstacle[] {
  return LANES.map((lane, i) => ({
    lane: i,
    x: lane.dir === 1 ? (i * 3) % COLS : COLS - ((i * 3) % COLS),
  }));
}

function Screen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();

  const rowRef = useRef<number>(START_ROW);
  const obsRef = useRef<Obstacle[]>(initObstacles());

  const [, setFrame] = useState(0);
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);

  const hop = (): void => {
    if (rowRef.current > 0) {
      rowRef.current -= 1;
      if (rowRef.current === 0) {
        // Reached the goal.
        setScore((s) => s + 1);
        rowRef.current = START_ROW;
      }
      setFrame((f) => f + 1);
    }
  };

  useEffect(() => {
    const id = setInterval(() => {
      // Advance obstacles.
      obsRef.current = obsRef.current.map((o) => {
        const lane = LANES[o.lane];
        let nx = o.x + lane.dir * lane.speed * DT;
        if (nx > COLS) nx = -lane.width;
        if (nx < -lane.width) nx = COLS;
        return { ...o, x: nx };
      });

      // Collision: player sits mid-cell; check lane obstacle span.
      const row = rowRef.current;
      const laneIndex = LANES.findIndex((l) => l.row === row);
      if (laneIndex >= 0) {
        const o = obsRef.current[laneIndex];
        const lane = LANES[laneIndex];
        const center = PLAYER_COL + 0.5;
        if (center >= o.x && center <= o.x + lane.width) {
          rowRef.current = START_ROW;
          setHits((v) => v + 1);
        }
      }

      setFrame((f) => f + 1);
    }, TICK);
    return () => clearInterval(id);
  }, []);

  const row = rowRef.current;
  const obstacles = obsRef.current;

  return (
    <View style={st.fill}>
      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <Text style={st.info}>
          Crossed {score} · Hits {hits}
        </Text>
        <Pressable style={st.exit} onPress={onExit}>
          <Text style={st.exitT}>← Menu</Text>
        </Pressable>
      </View>

      <View style={st.center}>
        <Text style={st.title}>Road Hopper</Text>
        <Pressable onPress={hop}>
          <View style={[st.board, { width: BOARD_W, height: BOARD_H }]}>
            {Array.from({ length: ROWS }).map((_, r) => (
              <View
                key={`row${r}`}
                style={[
                  st.laneBg,
                  {
                    top: r * CELL,
                    width: BOARD_W,
                    height: CELL,
                    backgroundColor: r === 0 ? "#123a2a" : r === START_ROW ? "#1a2340" : "#0c1430",
                  },
                ]}
              />
            ))}
            {obstacles.map((o, i) => {
              const lane = LANES[o.lane];
              return (
                <View
                  key={`o${i}`}
                  style={[
                    st.obstacle,
                    {
                      left: o.x * CELL + 2,
                      top: lane.row * CELL + 4,
                      width: lane.width * CELL - 4,
                      height: CELL - 8,
                      backgroundColor: lane.color,
                    },
                  ]}
                />
              );
            })}
            <View
              style={[
                st.player,
                {
                  left: PLAYER_COL * CELL + 3,
                  top: row * CELL + 3,
                  width: CELL - 6,
                  height: CELL - 6,
                },
              ]}
            />
          </View>
        </Pressable>
        <Text style={st.hint}>Tap the board to hop up</Text>
      </View>

      <Pressable style={st.hopBtn} onPress={hop}>
        <Text style={st.hopT}>HOP ▲</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0b1021" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { color: "#9fd0ff", fontSize: 18, fontWeight: "700", marginBottom: 10 },
  board: { backgroundColor: "#05070f", borderRadius: 6, overflow: "hidden" },
  laneBg: { position: "absolute", left: 0 },
  obstacle: { position: "absolute", borderRadius: 6 },
  player: { position: "absolute", borderRadius: 999, backgroundColor: "#7ef0a0" },
  hint: { color: "#6f82b5", fontSize: 13, marginTop: 10 },
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
  hopBtn: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    backgroundColor: "#4da3ff",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  hopT: { color: "#06142e", fontSize: 18, fontWeight: "800" },
});

export const roadHopperGame: GameModule = {
  id: "road-hopper",
  title: "Road Hopper",
  kind: "arcade",
  Screen,
};
