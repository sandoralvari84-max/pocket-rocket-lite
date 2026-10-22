import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Dimensions, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, IconButton, GameOverlay, Sprite, Body } from "../design/ui";

/* ----------------------------------------------------------------------------
 * Road Hopper — Frogger. Now a real game with win/lose:
 *   - multiple vehicles per lane, varied speeds/directions
 *   - lives + levels: reach the top = level complete + harder next level;
 *     lose all lives = game over
 *   - sprited player, vehicles, lane backgrounds and safe zones (Kenney CC0)
 *   - shared HUD (lives + level + score) + GameOverlay
 * ------------------------------------------------------------------------- */

const COLS = 9;
const GOAL_ROW = 0;
const START_ROW = 8;
const ROWS = START_ROW + 1; // 0 goal, 1..7 traffic, 8 start
const { width: W, height: H } = Dimensions.get("window");
const CELL = Math.floor(Math.min(W - 24, H * 0.52) / COLS);
const BOARD_W = CELL * COLS;
const BOARD_H = CELL * ROWS;
const TICK = 33; // ms
const DT = TICK / 1000;
const LIVES_START = 3;

// Sprites (Kenney Pixel Platformer, CC0).
const GRASS = require("../../assets/arcade/pixel-platformer/Tiles/tile_0000.png"); // grass-top ground
const WATER = require("../../assets/arcade/pixel-platformer/Tiles/tile_0053.png"); // cyan water
const ROAD = require("../../assets/arcade/pixel-platformer/Tiles/tile_0046.png");  // dark asphalt tile
const PLAYER_IMG = require("../../assets/arcade/pixel-platformer/Tiles/Characters/tile_0000.png"); // green blob
const V_RED = require("../../assets/arcade/pixel-platformer/Tiles/Characters/tile_0017.png");
const V_RED2 = require("../../assets/arcade/pixel-platformer/Tiles/Characters/tile_0015.png");
const V_CAR = require("../../assets/arcade/pixel-platformer/Tiles/Characters/tile_0018.png");
const V_TRUCK = require("../../assets/arcade/pixel-platformer/Tiles/Characters/tile_0021.png");
const V_BUG = require("../../assets/arcade/pixel-platformer/Tiles/Characters/tile_0024.png");

type LaneDef = {
  row: number; dir: 1 | -1; speed: number; width: number; count: number;
  img: ReturnType<typeof require>;
};

// Base (level 1). Difficulty scales these per level.
const LANES: LaneDef[] = [
  { row: 1, dir: 1, speed: 2.2, width: 1, count: 2, img: V_RED },
  { row: 2, dir: -1, speed: 1.6, width: 2, count: 2, img: V_TRUCK },
  { row: 3, dir: 1, speed: 2.8, width: 1, count: 2, img: V_BUG },
  { row: 4, dir: -1, speed: 2.0, width: 1, count: 3, img: V_CAR },
  { row: 5, dir: 1, speed: 1.5, width: 2, count: 2, img: V_RED2 },
  { row: 6, dir: -1, speed: 3.0, width: 1, count: 2, img: V_BUG },
  { row: 7, dir: 1, speed: 2.3, width: 1, count: 3, img: V_CAR },
];

type Vehicle = { x: number };
type LaneState = { def: LaneDef; speed: number; count: number; vehicles: Vehicle[] };

function speedMul(level: number) { return 1 + (level - 1) * 0.18; }
function countFor(def: LaneDef, level: number) {
  return Math.min(def.count + Math.floor((level - 1) / 2), 4);
}

function buildLanes(level: number): LaneState[] {
  return LANES.map((def) => {
    const count = countFor(def, level);
    const span = COLS + def.width; // wrap travel length
    const spacing = span / count;
    const vehicles: Vehicle[] = [];
    for (let i = 0; i < count; i++) vehicles.push({ x: -def.width + i * spacing });
    return { def, speed: def.speed * speedMul(level), count, vehicles };
  });
}

function Screen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();

  const rowRef = useRef(START_ROW);
  const colRef = useRef(Math.floor(COLS / 2));
  const lanesRef = useRef<LaneState[]>(buildLanes(1));
  const levelRef = useRef(1);
  const phaseRef = useRef<"ready" | "playing" | "paused" | "clear" | "over">("ready");

  const [, setFrame] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(LIVES_START);
  const [level, setLevel] = useState(1);
  const [phase, setPhase] = useState<"ready" | "playing" | "paused" | "clear" | "over">("ready");

  const bump = () => setFrame((f) => f + 1);

  const resetPlayer = () => { rowRef.current = START_ROW; colRef.current = Math.floor(COLS / 2); };

  function loseLife() {
    setLives((v) => {
      const nv = v - 1;
      if (nv <= 0) { phaseRef.current = "over"; setPhase("over"); }
      else resetPlayer();
      return nv;
    });
  }

  function move(dc: number, dr: number) {
    if (phaseRef.current !== "playing") return;
    const nc = Math.min(COLS - 1, Math.max(0, colRef.current + dc));
    const nr = Math.min(START_ROW, Math.max(GOAL_ROW, rowRef.current + dr));
    colRef.current = nc;
    rowRef.current = nr;
    if (nr === GOAL_ROW) {
      // reached the top -> level complete
      setScore((s) => s + 100 + level * 20);
      phaseRef.current = "clear";
      setPhase("clear");
    }
    bump();
  }
  const hop = () => move(0, -1);

  function nextLevel() {
    levelRef.current += 1;
    lanesRef.current = buildLanes(levelRef.current);
    setLevel(levelRef.current);
    resetPlayer();
    phaseRef.current = "playing";
    setPhase("playing");
    bump();
  }

  function fullRestart() {
    levelRef.current = 1;
    lanesRef.current = buildLanes(1);
    resetPlayer();
    setLevel(1); setScore(0); setLives(LIVES_START);
    phaseRef.current = "playing"; setPhase("playing"); bump();
  }

  const start = () => { phaseRef.current = "playing"; setPhase("playing"); bump(); };
  const togglePause = () => {
    if (phaseRef.current === "playing") { phaseRef.current = "paused"; setPhase("paused"); }
    else if (phaseRef.current === "paused") { phaseRef.current = "playing"; setPhase("playing"); }
  };

  useEffect(() => {
    const id = setInterval(() => {
      if (phaseRef.current !== "playing") return;

      // advance vehicles
      for (const lane of lanesRef.current) {
        const { def, speed } = lane;
        for (const v of lane.vehicles) {
          v.x += def.dir * speed * DT;
          if (def.dir === 1 && v.x > COLS) v.x = -def.width;
          else if (def.dir === -1 && v.x < -def.width) v.x = COLS;
        }
      }

      // collision on the player's current lane
      const row = rowRef.current;
      const lane = lanesRef.current.find((l) => l.def.row === row);
      if (lane) {
        const pL = colRef.current;
        const pR = colRef.current + 1;
        const hit = lane.vehicles.some((v) => pL < v.x + lane.def.width && pR > v.x);
        if (hit) { loseLife(); bump(); return; }
      }

      bump();
    }, TICK);
    return () => clearInterval(id);
  }, []);

  // static lane backgrounds (sprited) — constant, built once
  const laneLayer = useMemo(() => {
    const out: React.ReactNode[] = [];
    for (let r = 0; r < ROWS; r++) {
      const img = r === GOAL_ROW ? WATER : r === START_ROW ? GRASS : ROAD;
      for (let c = 0; c < COLS; c++) {
        out.push(
          <View key={`bg${r}-${c}`} style={{ position: "absolute", left: c * CELL, top: r * CELL }}>
            <Sprite source={img} size={CELL} />
          </View>
        );
      }
      // dashed lane divider between traffic rows
      if (r > GOAL_ROW && r < START_ROW) {
        out.push(
          <View key={`ln${r}`} style={{ position: "absolute", left: 0, top: r * CELL - 1, width: BOARD_W, height: 2, flexDirection: "row" }}>
            {Array.from({ length: COLS }).map((_, i) => (
              <View key={i} style={{ width: CELL * 0.5, height: 2, marginRight: CELL * 0.5, backgroundColor: color.surfaceLine }} />
            ))}
          </View>
        );
      }
    }
    return out;
  }, []);

  const row = rowRef.current;
  const vehSize = CELL;

  return (
    <View style={st.fill}>
      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <View style={st.hudPanel}>
          <PixelText size="score">{String(score).padStart(4, "0")}</PixelText>
          <PixelText size="label" style={{ marginTop: 4 }}>
            LV {level}  LIVES {Math.max(0, lives)}
          </PixelText>
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <IconButton label="Pause" glyph={phase === "paused" ? "▶" : "❚❚"} onPress={togglePause} />
          <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
        </View>
      </View>

      <View style={st.center}>
        <Pressable onPress={hop}>
          <View style={[st.board, { width: BOARD_W, height: BOARD_H }]}>
            {laneLayer}

            {lanesRef.current.map((lane) =>
              lane.vehicles.map((v, i) => (
                <View
                  key={`v${lane.def.row}-${i}`}
                  style={{
                    position: "absolute",
                    left: v.x * CELL,
                    top: lane.def.row * CELL,
                    width: lane.def.width * CELL,
                    height: CELL,
                    flexDirection: "row",
                  }}
                >
                  {Array.from({ length: lane.def.width }).map((_, k) => (
                    <Sprite
                      key={k}
                      source={lane.def.img}
                      size={CELL}
                      style={lane.def.dir === -1 ? { transform: [{ scaleX: -1 }] } : undefined}
                    />
                  ))}
                </View>
              ))
            )}

            <View style={{ position: "absolute", left: colRef.current * CELL, top: row * CELL }}>
              <Sprite source={PLAYER_IMG} size={vehSize} />
            </View>
          </View>
        </Pressable>
        <Body muted style={{ marginTop: space.md, textAlign: "center" }}>
          Tap the board or press HOP to go up. Reach the water to clear the level.
        </Body>
      </View>

      <View style={st.dpad} pointerEvents="box-none">
        <Pressable style={st.pad} onPress={hop}><Text style={st.padT}>▲</Text></Pressable>
        <View style={st.padRow}>
          <Pressable style={st.pad} onPress={() => move(-1, 0)}><Text style={st.padT}>◀</Text></Pressable>
          <Pressable style={st.pad} onPress={() => move(0, 1)}><Text style={st.padT}>▼</Text></Pressable>
          <Pressable style={st.pad} onPress={() => move(1, 0)}><Text style={st.padT}>▶</Text></Pressable>
        </View>
      </View>

      <GameOverlay
        visible={phase === "ready"} kind="pause" title="ROAD HOPPER"
        primaryLabel="Start" onPrimary={start} onExit={onExit}
      >
        <Body muted style={{ textAlign: "center", marginTop: space.md }}>
          Cross the traffic and reach the water at the top. You have three lives —
          each level gets faster and busier.
        </Body>
      </GameOverlay>

      <GameOverlay
        visible={phase === "paused"} kind="pause" title="PAUSED" score={`SCORE ${score}`}
        primaryLabel="Resume" onPrimary={togglePause} onExit={onExit}
      />

      <GameOverlay
        visible={phase === "clear"} kind="win" title={`LEVEL ${level} CLEAR`} score={`SCORE ${score}`}
        primaryLabel="Next level" onPrimary={nextLevel} onExit={onExit}
      >
        <Body muted style={{ textAlign: "center", marginTop: space.md }}>
          More traffic, moving faster.
        </Body>
      </GameOverlay>

      <GameOverlay
        visible={phase === "over"} kind="over" title="GAME OVER" score={`SCORE ${score}`}
        primaryLabel="Play again" onPrimary={fullRestart} onExit={onExit}
      />
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  board: { backgroundColor: "#05070f", borderRadius: radius.md, overflow: "hidden" },
  hud: {
    position: "absolute", left: 0, right: 0, zIndex: 10, paddingHorizontal: space.lg,
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
  },
  hudPanel: {
    backgroundColor: "rgba(20,26,34,0.7)", borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.sm,
    borderWidth: 1, borderColor: color.surfaceLine,
  },
  dpad: { position: "absolute", bottom: 28, left: 0, right: 0, alignItems: "center" },
  padRow: { flexDirection: "row" },
  pad: {
    width: 60, height: 56, margin: 4, borderRadius: radius.md,
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine,
    alignItems: "center", justifyContent: "center",
  },
  padT: { color: color.text, fontSize: 22, fontWeight: "700" },
});

export const roadHopperGame: GameModule = {
  id: "road-hopper",
  title: "Road Hopper",
  kind: "arcade",
  Screen,
};
