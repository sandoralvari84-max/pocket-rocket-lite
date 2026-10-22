import React, { useEffect, useMemo, useRef, useState } from "react";
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

// Fixed small maze. '#' wall, '.' floor+pellet, 'P' player start, 'E' enemy start.
const LAYOUT: string[] = [
  "###########",
  "#....#....#",
  "#.##.#.##.#",
  "#E.......E#",
  "#.##.#.##.#",
  "#....#....#",
  "#.##.#.##.#",
  "#....P....#",
  "###########",
];
const ROWS = LAYOUT.length;
const COLS = LAYOUT[0].length;

const { width: W, height: H } = Dimensions.get("window");
const CELL = Math.floor(Math.min(W - 24, H * 0.62) / COLS);
const BOARD_W = CELL * COLS;
const BOARD_H = CELL * ROWS;
const LIVES_START = 3;

type Dir = { dx: number; dy: number };
type Pos = { r: number; c: number };
type Enemy = { r: number; c: number; dx: number; dy: number };

const DIRS: Dir[] = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
];

const isWall = (r: number, c: number): boolean =>
  r < 0 || c < 0 || r >= ROWS || c >= COLS || LAYOUT[r][c] === "#";

const key = (r: number, c: number): string => `${r},${c}`;

function initialPellets(): Set<string> {
  const s = new Set<string>();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (LAYOUT[r][c] === ".") s.add(key(r, c));
    }
  }
  return s;
}

function findChar(ch: string): Pos {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (LAYOUT[r][c] === ch) return { r, c };
    }
  }
  return { r: 1, c: 1 };
}

function allEnemies(): Enemy[] {
  const out: Enemy[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (LAYOUT[r][c] === "E") out.push({ r, c, dx: 0, dy: 0 });
    }
  }
  return out;
}

const PLAYER_START: Pos = findChar("P");

function Screen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();

  const playerRef = useRef<Pos>({ ...PLAYER_START });
  const dirRef = useRef<Dir>({ dx: 0, dy: 0 });
  const nextDirRef = useRef<Dir>({ dx: 0, dy: 0 });
  const enemiesRef = useRef<Enemy[]>(allEnemies());
  const pelletsRef = useRef<Set<string>>(initialPellets());
  const stepRef = useRef<number>(0);
  const statusRef = useRef<"playing" | "won" | "lost">("playing");

  const [, setFrame] = useState(0);
  const [lives, setLives] = useState(LIVES_START);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");

  const totalPellets = useMemo(() => initialPellets().size, []);
  const [left, setLeft] = useState(totalPellets);

  const setDir = (d: Dir): void => {
    nextDirRef.current = d;
  };

  const resetPositions = (): void => {
    playerRef.current = { ...PLAYER_START };
    dirRef.current = { dx: 0, dy: 0 };
    nextDirRef.current = { dx: 0, dy: 0 };
    enemiesRef.current = allEnemies();
  };

  const restart = (): void => {
    pelletsRef.current = initialPellets();
    stepRef.current = 0;
    statusRef.current = "playing";
    resetPositions();
    setLives(LIVES_START);
    setLeft(totalPellets);
    setStatus("playing");
    setFrame((f) => f + 1);
  };

  useEffect(() => {
    const id = setInterval(() => {
      if (statusRef.current !== "playing") return;
      stepRef.current += 1;
      const p = playerRef.current;

      // Player: apply queued direction if possible, else continue.
      const nd = nextDirRef.current;
      if ((nd.dx !== 0 || nd.dy !== 0) && !isWall(p.r + nd.dy, p.c + nd.dx)) {
        dirRef.current = nd;
      }
      const d = dirRef.current;
      if ((d.dx !== 0 || d.dy !== 0) && !isWall(p.r + d.dy, p.c + d.dx)) {
        p.r += d.dy;
        p.c += d.dx;
      }

      // Eat pellet.
      const k = key(p.r, p.c);
      if (pelletsRef.current.has(k)) {
        pelletsRef.current.delete(k);
        const remaining = pelletsRef.current.size;
        setLeft(remaining);
        if (remaining === 0) {
          statusRef.current = "won";
          setStatus("won");
          setFrame((f) => f + 1);
          return;
        }
      }

      const hit = (): boolean =>
        enemiesRef.current.some((e) => e.r === p.r && e.c === p.c);

      const loseLife = (): void => {
        resetPositions();
        setLives((v) => {
          const nv = v - 1;
          if (nv <= 0) {
            statusRef.current = "lost";
            setStatus("lost");
          }
          return nv;
        });
      };

      if (hit()) {
        loseLife();
        setFrame((f) => f + 1);
        return;
      }

      // Enemies move every other tick (slower than player).
      if (stepRef.current % 2 === 0) {
        enemiesRef.current = enemiesRef.current.map((e) => {
          const options = DIRS.filter((o) => !isWall(e.r + o.dy, e.c + o.dx));
          if (options.length === 0) return e;
          const forward = options.filter(
            (o) => !(o.dx === -e.dx && o.dy === -e.dy)
          );
          const pool = forward.length > 0 ? forward : options;
          const o = pool[Math.floor(Math.random() * pool.length)];
          return { r: e.r + o.dy, c: e.c + o.dx, dx: o.dx, dy: o.dy };
        });
        if (hit()) {
          loseLife();
        }
      }

      setFrame((f) => f + 1);
    }, 150);
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
          setDir({ dx: g.dx > 0 ? 1 : -1, dy: 0 });
        } else if (Math.abs(g.dy) > 0) {
          setDir({ dx: 0, dy: g.dy > 0 ? 1 : -1 });
        }
      },
    })
  ).current;

  const p = playerRef.current;
  const pellets = pelletsRef.current;
  const enemies = enemiesRef.current;

  return (
    <View style={st.fill}>
      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <Text style={st.info}>
          Lives {lives} · Pellets {left}
        </Text>
        <Pressable style={st.exit} onPress={onExit}>
          <Text style={st.exitT}>← Menu</Text>
        </Pressable>
      </View>

      <View style={st.center}>
        <Text style={st.title}>Maze Muncher</Text>
        <View style={[st.board, { width: BOARD_W, height: BOARD_H }]} {...pan.panHandlers}>
          {LAYOUT.map((row, r) =>
            row.split("").map((ch, c) =>
              ch === "#" ? (
                <View
                  key={`w${r}-${c}`}
                  style={[st.wall, { left: c * CELL, top: r * CELL, width: CELL, height: CELL }]}
                />
              ) : null
            )
          )}
          {Array.from(pellets).map((kk) => {
            const [r, c] = kk.split(",").map(Number);
            return (
              <View
                key={`p${kk}`}
                style={[
                  st.pellet,
                  {
                    left: c * CELL + CELL / 2 - 3,
                    top: r * CELL + CELL / 2 - 3,
                  },
                ]}
              />
            );
          })}
          {enemies.map((e, i) => (
            <View
              key={`e${i}`}
              style={[
                st.enemy,
                { left: e.c * CELL + 2, top: e.r * CELL + 2, width: CELL - 4, height: CELL - 4 },
              ]}
            />
          ))}
          <View
            style={[
              st.player,
              { left: p.c * CELL + 2, top: p.r * CELL + 2, width: CELL - 4, height: CELL - 4 },
            ]}
          />
        </View>
      </View>

      <View style={st.dpad} pointerEvents="box-none">
        <Pressable style={[st.pad, st.padUp]} onPress={() => setDir({ dx: 0, dy: -1 })}>
          <Text style={st.padT}>▲</Text>
        </Pressable>
        <View style={st.padRow}>
          <Pressable style={st.pad} onPress={() => setDir({ dx: -1, dy: 0 })}>
            <Text style={st.padT}>◀</Text>
          </Pressable>
          <Pressable style={st.pad} onPress={() => setDir({ dx: 1, dy: 0 })}>
            <Text style={st.padT}>▶</Text>
          </Pressable>
        </View>
        <Pressable style={[st.pad, st.padDown]} onPress={() => setDir({ dx: 0, dy: 1 })}>
          <Text style={st.padT}>▼</Text>
        </Pressable>
      </View>

      {status !== "playing" && (
        <View style={st.overlay}>
          <Text style={st.overTitle}>{status === "won" ? "Cleared!" : "Caught!"}</Text>
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
  wall: { position: "absolute", backgroundColor: "#1f3a7a" },
  pellet: { position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: "#ffd24d" },
  player: { position: "absolute", borderRadius: 999, backgroundColor: "#4da3ff" },
  enemy: { position: "absolute", borderRadius: 5, backgroundColor: "#ff5c7a" },
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
  padUp: { marginBottom: 0 },
  padDown: { marginTop: 0 },
  padT: { color: "#fff", fontSize: 22, fontWeight: "700" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,7,15,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  overTitle: { color: "#fff", fontSize: 30, fontWeight: "800", marginBottom: 18 },
  again: { backgroundColor: "#4da3ff", paddingVertical: 12, paddingHorizontal: 26, borderRadius: 10 },
  againT: { color: "#06142e", fontSize: 16, fontWeight: "800" },
});

export const mazeMuncherGame: GameModule = {
  id: "maze-muncher",
  title: "Maze Muncher",
  kind: "arcade",
  Screen,
};
