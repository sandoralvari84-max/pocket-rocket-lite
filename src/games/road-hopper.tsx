import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Dimensions, Pressable, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, IconButton, GameOverlay, Sprite, Body } from "../design/ui";
import { ArcadeJoystick } from "../design/Joystick";
import { EffectsLayer, type EffectsHandle } from "../design/effects";
import { ScoreboardOverlay } from "../design/Scoreboard";
import { useSettings } from "../settings";

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

// Original owned sprites (v3) — tools/art/gen_roadhopper_art.py. Own period palette.
const GRASS = require("../../assets/arcade/roadhopper/grass.png");
const WATER = require("../../assets/arcade/roadhopper/water.png");
const ROAD = require("../../assets/arcade/roadhopper/road.png");
const HOPPER_IDLE = require("../../assets/arcade/roadhopper/hopper_idle.png");
const HOPPER_HOP = require("../../assets/arcade/roadhopper/hopper_hop.png");
const V_RED = require("../../assets/arcade/roadhopper/car_red.png");   // 1 wide
const V_RED2 = require("../../assets/arcade/roadhopper/truck.png");    // 2 wide
const V_CAR = require("../../assets/arcade/roadhopper/car_blue.png");  // 1 wide
const V_TRUCK = require("../../assets/arcade/roadhopper/truck.png");   // 2 wide
const V_BUG = require("../../assets/arcade/roadhopper/bug.png");       // 1 wide

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

// Difficulty "intelligence": level 1 is deliberately gentle and gets busier/faster in
// small, readable steps. BASE_SPEED tames the first level (the base table was too frantic
// to start on); speedMul ramps slowly and caps so late levels stay humanly playable;
// countFor starts one car sparser per lane and fills in every couple of levels.
const BASE_SPEED = 0.62;
function speedMul(level: number) { return Math.min(1 + (level - 1) * 0.14, 2.3); }
function countFor(def: LaneDef, level: number) {
  return Math.min(Math.max(1, def.count - 1) + Math.floor((level - 1) / 2), 4);
}

function buildLanes(level: number): LaneState[] {
  return LANES.map((def) => {
    const count = countFor(def, level);
    const span = COLS + def.width; // wrap travel length
    const spacing = span / count;
    const vehicles: Vehicle[] = [];
    for (let i = 0; i < count; i++) vehicles.push({ x: -def.width + i * spacing });
    return { def, speed: def.speed * speedMul(level) * BASE_SPEED, count, vehicles };
  });
}

function Screen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useSettings();
  const fxRef = useRef<EffectsHandle>(null);
  const cpx = (c: number) => (c + 0.5) * CELL;
  const cpy = (r: number) => (r + 0.5) * CELL;

  const rowRef = useRef(START_ROW);
  const colRef = useRef(Math.floor(COLS / 2));
  const lanesRef = useRef<LaneState[]>(buildLanes(1));
  const levelRef = useRef(1);
  const phaseRef = useRef<"ready" | "playing" | "paused" | "clear" | "over">("ready");

  const [, setFrame] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(LIVES_START);
  const [level, setLevel] = useState(1);
  const [hopping, setHopping] = useState(false);
  const hopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    setHopping(true);
    if (hopTimer.current) clearTimeout(hopTimer.current);
    hopTimer.current = setTimeout(() => setHopping(false), 140);
    if (nr === GOAL_ROW) {
      // reached the top -> level complete
      const pts = 100 + level * 20;
      setScore((s) => s + pts);
      fxRef.current?.burst(cpx(nc), cpy(GOAL_ROW), { count: 20, color: color.cyan, speed: 150, size: 6 });
      fxRef.current?.popScore(cpx(nc), cpy(GOAL_ROW), `+${pts}`, color.cyan);
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
        if (hit) {
          fxRef.current?.burst(cpx(colRef.current), cpy(row), { count: 16, color: color.danger, speed: 150, size: 6 });
          loseLife(); bump(); return;
        }
      }

      bump();
    }, TICK);
    return () => clearInterval(id);
  }, []);

  useEffect(() => () => { if (hopTimer.current) clearTimeout(hopTimer.current); }, []);

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
              <View key={i} style={{ width: CELL * 0.5, height: 3, marginRight: CELL * 0.5, borderRadius: 1.5, backgroundColor: "rgba(255,221,128,0.55)" }} />
            ))}
          </View>
        );
      }
    }
    return out;
  }, []);

  const row = rowRef.current;

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
                <Image
                  key={`v${lane.def.row}-${i}`}
                  source={lane.def.img}
                  resizeMode="contain"
                  fadeDuration={0}
                  style={{
                    position: "absolute",
                    left: v.x * CELL,
                    top: lane.def.row * CELL,
                    width: lane.def.width * CELL,
                    height: CELL,
                    transform: lane.def.dir === -1 ? [{ scaleX: -1 }] : undefined,
                  }}
                />
              ))
            )}

            <View style={{ position: "absolute", left: colRef.current * CELL, top: row * CELL }}>
              <View style={{ position: "absolute", left: CELL * 0.22, top: CELL * 0.7, width: CELL * 0.56, height: CELL * 0.2, borderRadius: CELL * 0.1, backgroundColor: "rgba(0,0,0,0.3)" }} />
              <Sprite source={hopping ? HOPPER_HOP : HOPPER_IDLE} size={CELL} />
            </View>

            <EffectsLayer ref={fxRef} reduced={reducedMotion} />
          </View>
        </Pressable>
        <Body muted style={{ marginTop: space.md, textAlign: "center" }}>
          Tap the board or press HOP to go up. Reach the water to clear the level.
        </Body>
      </View>

      <View style={st.dpad} pointerEvents="box-none">
        <ArcadeJoystick onDirection={(d) => move(d.dx, d.dy)} />
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

      <ScoreboardOverlay
        visible={phase === "over"} gameId="road-hopper" score={score}
        scoreLabel={`SCORE ${score}`} onPlayAgain={fullRestart} onExit={onExit}
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
