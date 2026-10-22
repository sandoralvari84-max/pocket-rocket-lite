import React, { useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GameEngine, type GameEngineSystem } from "react-native-game-engine";
import type { GameModule, GameContext } from "./contract";

const { width: W, height: H } = Dimensions.get("window");
const CANNON_W = 56;
const CANNON_H = 22;
const CANNON_Y = H - 150;
const BULLET_W = 5;
const BULLET_H = 14;
const BULLET_SPEED = 9;
const ENEMY_W = 34;
const ENEMY_H = 26;
const COLS = 5;
const ROWS = 3;
const GAP_X = (W - COLS * ENEMY_W) / (COLS + 1);
const FIRE_MS = 320;
const ENEMY_FALL = 0.45; // px per 16ms frame
const DEAD_LINE = CANNON_Y - 8;

interface Bullet {
  id: number;
  x: number;
  y: number;
}
interface Enemy {
  id: number;
  x: number;
  y: number;
}
interface World {
  cannonX: number;
  bullets: Bullet[];
  enemies: Enemy[];
  fireAcc: number;
  nextId: number;
  renderer: React.ComponentType<WorldProps>;
}
type WorldProps = Omit<World, "renderer">;

function makeEnemies(startId: number): { enemies: Enemy[]; nextId: number } {
  const enemies: Enemy[] = [];
  let id = startId;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      enemies.push({
        id: id++,
        x: GAP_X + c * (ENEMY_W + GAP_X) + ENEMY_W / 2,
        y: 90 + r * (ENEMY_H + 18),
      });
    }
  }
  return { enemies, nextId: id };
}

const WorldView = ({ cannonX, bullets, enemies }: WorldProps) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {enemies.map((e) => (
      <View
        key={e.id}
        style={[st.enemy, { left: e.x - ENEMY_W / 2, top: e.y - ENEMY_H / 2 }]}
      >
        <Text style={st.enemyFace}>▼</Text>
      </View>
    ))}
    {bullets.map((b) => (
      <View key={b.id} style={[st.bullet, { left: b.x - BULLET_W / 2, top: b.y }]} />
    ))}
    <View style={[st.cannon, { left: cannonX - CANNON_W / 2, top: CANNON_Y }]} />
  </View>
);

const Physics: GameEngineSystem = (entities, { touches, time, dispatch }) => {
  const w = entities.world as World;

  const t = touches
    .filter((x: { type: string }) => x.type === "move" || x.type === "start")
    .pop();
  if (t) {
    w.cannonX = Math.max(CANNON_W / 2, Math.min(W - CANNON_W / 2, t.event.locationX));
  }

  const step = time.delta / 16;

  // auto fire
  w.fireAcc += time.delta;
  if (w.fireAcc >= FIRE_MS) {
    w.fireAcc = 0;
    w.bullets.push({ id: w.nextId++, x: w.cannonX, y: CANNON_Y });
  }

  // move bullets up
  for (const b of w.bullets) b.y -= BULLET_SPEED * step;
  w.bullets = w.bullets.filter((b) => b.y + BULLET_H > 0);

  // move enemies down
  for (const e of w.enemies) e.y += ENEMY_FALL * step;

  // collisions
  const deadEnemies = new Set<number>();
  const deadBullets = new Set<number>();
  for (const b of w.bullets) {
    for (const e of w.enemies) {
      if (deadEnemies.has(e.id)) continue;
      if (
        Math.abs(b.x - e.x) <= ENEMY_W / 2 + BULLET_W / 2 &&
        b.y <= e.y + ENEMY_H / 2 &&
        b.y + BULLET_H >= e.y - ENEMY_H / 2
      ) {
        deadEnemies.add(e.id);
        deadBullets.add(b.id);
        break;
      }
    }
  }
  if (deadEnemies.size > 0) {
    w.enemies = w.enemies.filter((e) => !deadEnemies.has(e.id));
    w.bullets = w.bullets.filter((b) => !deadBullets.has(b.id));
    dispatch({ type: "score", n: deadEnemies.size });
  }

  // lose check
  if (w.enemies.some((e) => e.y + ENEMY_H / 2 >= DEAD_LINE)) {
    dispatch({ type: "lose" });
  }

  // wave cleared -> respawn lower pressure wave
  if (w.enemies.length === 0) {
    const made = makeEnemies(w.nextId);
    w.enemies = made.enemies;
    w.nextId = made.nextId;
    dispatch({ type: "wave" });
  }

  return entities;
};

function buildWorld(): World {
  const made = makeEnemies(1);
  return {
    cannonX: W / 2,
    bullets: [],
    enemies: made.enemies,
    fireAcc: 0,
    nextId: made.nextId,
    renderer: WorldView,
  };
}

function Screen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [over, setOver] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const engineEntities = useRef(buildWorld());

  const onEvent = (e: { type?: string; n?: number }) => {
    if (e?.type === "score") setScore((s) => s + (e.n ?? 1));
    if (e?.type === "wave") setWave((wv) => wv + 1);
    if (e?.type === "lose") setOver(true);
  };

  const restart = () => {
    engineEntities.current = buildWorld();
    setScore(0);
    setWave(1);
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
        <Text style={st.score}>Score {score}   ·   Wave {wave}</Text>
        <Pressable style={st.exit} onPress={onExit}>
          <Text style={st.exitT}>← Menu</Text>
        </Pressable>
      </View>
      {over && (
        <View style={st.overlay} pointerEvents="box-none">
          <Text style={st.overTitle}>Breached!</Text>
          <Text style={st.overSub}>Final score {score}</Text>
          <Pressable style={st.again} onPress={restart}>
            <Text style={st.againT}>Play again</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#05070f" },
  cannon: {
    position: "absolute",
    width: CANNON_W,
    height: CANNON_H,
    borderRadius: 6,
    backgroundColor: "#4df0a0",
  },
  bullet: {
    position: "absolute",
    width: BULLET_W,
    height: BULLET_H,
    borderRadius: 2,
    backgroundColor: "#fff3a3",
  },
  enemy: {
    position: "absolute",
    width: ENEMY_W,
    height: ENEMY_H,
    borderRadius: 6,
    backgroundColor: "#ff5d73",
    alignItems: "center",
    justifyContent: "center",
  },
  enemyFace: { color: "#2a0008", fontSize: 14, fontWeight: "700" },
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
  overTitle: { color: "#ff5d73", fontSize: 34, fontWeight: "800" },
  overSub: { color: "#fff", fontSize: 18, marginTop: 8 },
  again: {
    marginTop: 20,
    backgroundColor: "#4df0a0",
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 10,
  },
  againT: { color: "#05070f", fontWeight: "800", fontSize: 16 },
});

export const starDefenderGame: GameModule = {
  id: "star-defender",
  title: "Star Defender",
  kind: "arcade",
  Screen,
};
