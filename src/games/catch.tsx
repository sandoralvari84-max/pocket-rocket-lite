import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Dimensions, PanResponder, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, GameOverlay, Sprite } from "../design/ui";
import { EffectsLayer, type EffectsHandle } from "../design/effects";
import { ScoreboardOverlay } from "../design/Scoreboard";
import { useSettings } from "../settings";

/* ----------------------------------------------------------------------------
 * Dot Catcher — now a vertical space shooter.
 *   - the ship roams the LOWER HALF of the screen (drag to move in X and Y)
 *   - auto-fires plasma bolts upward at descending enemy craft
 *   - orbs are HELPFUL pickups only (rapid-fire / extra life / bonus points) —
 *     never a penalty if you miss them
 *   - lives + levels: difficulty starts gentle and ramps up every few kills
 *   - deterministic ref-based loop (same pattern as Road Hopper), scoreboard on end
 * ------------------------------------------------------------------------- */

const SHIP = require("../../assets/arcade/catch/ship.png");
const ORB = require("../../assets/arcade/catch/orb.png");
const DRONE = require("../../assets/arcade/catch/drone.png");
const GUNSHIP = require("../../assets/arcade/catch/gunship.png");
const BOLT = require("../../assets/arcade/catch/bolt.png");

const { width: W, height: H } = Dimensions.get("window");
const TICK = 33;

const SHIP_W = 74, SHIP_R = 26;
const ENEMY_W = 48, ENEMY_R = 22;
const ORB_W = 42, ORB_R = 22;
const BOLT_W = 12, BOLT_H = 26, BOLT_R = 15;

// Movement band: the ship may roam the lower half of the screen.
const MIN_Y = H * 0.5;
const MAX_Y = H - 128;
const clampX = (x: number) => Math.max(SHIP_W / 2, Math.min(W - SHIP_W / 2, x));
const clampY = (y: number) => Math.max(MIN_Y, Math.min(MAX_Y, y));

const LIVES_START = 3, LIVES_CAP = 5;
const BULLET_V = 17;           // px per tick, upward
const KILLS_PER_LEVEL = 8;

// Gentle-start difficulty "intelligence": slow enemies + sparse spawns at level 1,
// ramping in small readable steps, each capped so late levels stay playable.
const enemySpeed = (lvl: number) => Math.min(1.3 + (lvl - 1) * 0.22, 4.6);   // px/tick down
const spawnMs = (lvl: number) => Math.max(520, 1500 - (lvl - 1) * 115);
const gunshipChance = (lvl: number) => Math.min((lvl - 1) * 0.05, 0.4);
const fireMs = (rapid: boolean) => (rapid ? 140 : 300);

type Enemy = { x: number; y: number; vx: number; hp: number; type: "drone" | "gunship" };
type Bolt = { x: number; y: number };
type OrbKind = "rapid" | "life" | "points";
type Orb = { x: number; y: number; kind: OrbKind };

const ORB_META: Record<OrbKind, { ring: string; tag: string }> = {
  rapid: { ring: color.cyan, tag: "R" },
  life: { ring: color.success, tag: "+1" },
  points: { ring: color.amber, tag: "50" },
};

const STARS = Array.from({ length: 40 }, () => {
  const z = Math.random();
  return { x: Math.random() * W, y: Math.random() * H, sz: 1 + z * 3, op: 0.3 + z * 0.6 };
});

function GameScreen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useSettings();
  const fx = useRef<EffectsHandle>(null);

  const shipRef = useRef({ x: W / 2, y: H * 0.78 });
  const controlRef = useRef({ x: W / 2, y: H * 0.78 });
  const boltsRef = useRef<Bolt[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const orbsRef = useRef<Orb[]>([]);
  const killsRef = useRef(0);
  const levelRef = useRef(1);
  const rapidUntilRef = useRef(0);
  const sinceFire = useRef(0);
  const sinceSpawn = useRef(0);
  const sinceOrb = useRef(0);
  const clockRef = useRef(0);
  const phaseRef = useRef<"ready" | "playing" | "paused" | "over">("ready");

  const [, setFrame] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(LIVES_START);
  const [level, setLevel] = useState(1);
  const [phase, setPhase] = useState<"ready" | "playing" | "paused" | "over">("ready");
  const bump = () => setFrame((f) => (f + 1) % 1000000);

  function reset() {
    shipRef.current = { x: W / 2, y: H * 0.78 };
    controlRef.current = { x: W / 2, y: H * 0.78 };
    boltsRef.current = []; enemiesRef.current = []; orbsRef.current = [];
    killsRef.current = 0; levelRef.current = 1; rapidUntilRef.current = 0;
    sinceFire.current = 0; sinceSpawn.current = 0; sinceOrb.current = 0; clockRef.current = 0;
    setScore(0); setLives(LIVES_START); setLevel(1);
  }
  const start = () => { phaseRef.current = "playing"; setPhase("playing"); bump(); };
  const restart = () => { reset(); phaseRef.current = "playing"; setPhase("playing"); bump(); };
  const togglePause = () => {
    if (phaseRef.current === "playing") { phaseRef.current = "paused"; setPhase("paused"); }
    else if (phaseRef.current === "paused") { phaseRef.current = "playing"; setPhase("playing"); }
  };

  function loseLife(atX: number, atY: number) {
    fx.current?.burst(atX, atY, { count: 18, color: color.danger, speed: 160, size: 6 });
    setLives((v) => {
      const nv = v - 1;
      if (nv <= 0) { phaseRef.current = "over"; setPhase("over"); }
      return nv;
    });
  }

  function spawnEnemy() {
    const lvl = levelRef.current;
    const isGun = Math.random() < gunshipChance(lvl);
    const x = ENEMY_W / 2 + Math.random() * (W - ENEMY_W);
    const drift = (Math.random() * 2 - 1) * (0.6 + lvl * 0.12);
    enemiesRef.current.push({
      x, y: -ENEMY_W / 2, vx: isGun ? drift * 0.5 : drift,
      hp: isGun ? 3 : 1, type: isGun ? "gunship" : "drone",
    });
  }
  function spawnOrb() {
    const r = Math.random();
    const kind: OrbKind = r < 0.5 ? "points" : r < 0.8 ? "rapid" : "life";
    orbsRef.current.push({ x: ORB_W / 2 + Math.random() * (W - ORB_W), y: -ORB_W / 2, kind });
  }

  useEffect(() => {
    const id = setInterval(() => {
      if (phaseRef.current !== "playing") return;
      clockRef.current += TICK;
      const lvl = levelRef.current;
      const ship = shipRef.current;

      // ship follows the control target (both axes), clamped to the lower half
      ship.x += (controlRef.current.x - ship.x) * 0.35;
      ship.y += (controlRef.current.y - ship.y) * 0.35;
      ship.x = clampX(ship.x); ship.y = clampY(ship.y);

      // auto-fire
      sinceFire.current += TICK;
      const rapid = clockRef.current < rapidUntilRef.current;
      if (sinceFire.current >= fireMs(rapid)) {
        sinceFire.current = 0;
        boltsRef.current.push({ x: ship.x, y: ship.y - SHIP_W / 2 });
      }

      // spawn enemies / orbs
      sinceSpawn.current += TICK;
      if (sinceSpawn.current >= spawnMs(lvl)) { sinceSpawn.current = 0; spawnEnemy(); }
      sinceOrb.current += TICK;
      if (sinceOrb.current >= 7000) { sinceOrb.current = 0; spawnOrb(); }

      // move bolts up
      for (const b of boltsRef.current) b.y -= BULLET_V;
      boltsRef.current = boltsRef.current.filter((b) => b.y > -BOLT_H);

      // move enemies down (+ drift, bounce off edges)
      const spd = enemySpeed(lvl);
      for (const e of enemiesRef.current) {
        e.y += e.type === "gunship" ? spd * 0.8 : spd;
        e.x += e.vx;
        if (e.x < ENEMY_W / 2 || e.x > W - ENEMY_W / 2) { e.vx = -e.vx; e.x = clampX(e.x); }
      }

      // bolt -> enemy collisions
      const deadBolts = new Set<number>();
      let gainedKills = 0, gainedScore = 0;
      for (const e of enemiesRef.current) {
        if (e.hp <= 0) continue;
        for (let bi = 0; bi < boltsRef.current.length; bi++) {
          if (deadBolts.has(bi)) continue;
          const b = boltsRef.current[bi];
          if (Math.hypot(b.x - e.x, b.y - e.y) < ENEMY_R + BOLT_R) {
            deadBolts.add(bi); e.hp -= 1;
            fx.current?.burst(b.x, b.y, { count: 6, color: color.cyan, speed: 90, size: 4 });
            if (e.hp <= 0) {
              const pts = e.type === "gunship" ? 30 : 10;
              gainedScore += pts; gainedKills += 1;
              fx.current?.burst(e.x, e.y, { count: 16, color: color.amber, speed: 150, size: 6 });
              fx.current?.popScore(e.x, e.y, `+${pts}`, color.amber);
            }
            break;
          }
        }
      }
      if (deadBolts.size) boltsRef.current = boltsRef.current.filter((_, i) => !deadBolts.has(i));

      // enemy -> ship collision, and enemies that slip past the bottom
      let lifeLostAt: { x: number; y: number } | null = null;
      enemiesRef.current = enemiesRef.current.filter((e) => {
        if (e.hp <= 0) return false;
        if (Math.hypot(e.x - ship.x, e.y - ship.y) < ENEMY_R + SHIP_R) {
          lifeLostAt = { x: e.x, y: e.y }; return false;
        }
        if (e.y - ENEMY_W / 2 > H) { lifeLostAt = { x: e.x, y: H - 60 }; return false; }
        return true;
      });

      // orbs fall; catching one helps (missing one costs nothing)
      orbsRef.current = orbsRef.current.filter((o) => {
        o.y += 2.4;
        if (Math.hypot(o.x - ship.x, o.y - ship.y) < ORB_R + SHIP_R) {
          if (o.kind === "rapid") rapidUntilRef.current = clockRef.current + 6000;
          else if (o.kind === "life") setLives((v) => Math.min(LIVES_CAP, v + 1));
          else gainedScore += 50;
          fx.current?.burst(o.x, o.y, { count: 14, color: ORB_META[o.kind].ring, speed: 130, size: 5 });
          fx.current?.popScore(ship.x, ship.y - SHIP_W, o.kind === "points" ? "+50" : o.kind === "life" ? "+1 LIFE" : "RAPID", ORB_META[o.kind].ring);
          return false;
        }
        return o.y - ORB_W / 2 < H;
      });

      // apply score / kills / level
      if (gainedScore) setScore((s) => s + gainedScore);
      if (gainedKills) {
        killsRef.current += gainedKills;
        const nl = 1 + Math.floor(killsRef.current / KILLS_PER_LEVEL);
        if (nl !== levelRef.current) { levelRef.current = nl; setLevel(nl); }
      }
      if (lifeLostAt) loseLife((lifeLostAt as { x: number; y: number }).x, (lifeLostAt as { x: number; y: number }).y);

      bump();
    }, TICK);
    return () => clearInterval(id);
  }, []);

  // control surface — absolute pageX/pageY, clamped to the lower half
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => { controlRef.current = { x: clampX(e.nativeEvent.pageX), y: clampY(e.nativeEvent.pageY) }; },
      onPanResponderMove: (e) => { controlRef.current = { x: clampX(e.nativeEvent.pageX), y: clampY(e.nativeEvent.pageY) }; },
    })
  ).current;

  const running = phase === "playing";
  const ship = shipRef.current;
  const rapidNow = clockRef.current < rapidUntilRef.current;

  const horizon = useMemo(() => (
    <View pointerEvents="none" style={st.midline} />
  ), []);

  return (
    <View style={st.fill}>
      {STARS.map((s, i) => (
        <View key={i} pointerEvents="none" style={{ position: "absolute", left: s.x, top: s.y, width: s.sz, height: s.sz, borderRadius: s.sz / 2, backgroundColor: "#E8F0FF", opacity: s.op }} />
      ))}
      {horizon}

      {/* enemies */}
      {enemiesRef.current.map((e, i) => (
        <Image key={`e${i}`} source={e.type === "gunship" ? GUNSHIP : DRONE} resizeMode="contain" fadeDuration={0}
          style={{ position: "absolute", left: e.x - ENEMY_W / 2, top: e.y - ENEMY_W / 2, width: ENEMY_W, height: ENEMY_W }} />
      ))}

      {/* helpful orbs */}
      {orbsRef.current.map((o, i) => (
        <View key={`o${i}`} pointerEvents="none" style={{ position: "absolute", left: o.x - ORB_W / 2, top: o.y - ORB_W / 2, width: ORB_W, height: ORB_W, alignItems: "center", justifyContent: "center" }}>
          <View style={{ position: "absolute", width: ORB_W, height: ORB_W, borderRadius: ORB_W / 2, borderWidth: 2, borderColor: ORB_META[o.kind].ring, opacity: 0.9 }} />
          <Sprite source={ORB} size={ORB_W - 6} />
          <PixelText size="label" style={{ position: "absolute", bottom: -12, color: ORB_META[o.kind].ring }}>{ORB_META[o.kind].tag}</PixelText>
        </View>
      ))}

      {/* bolts */}
      {boltsRef.current.map((b, i) => (
        <Image key={`b${i}`} source={BOLT} resizeMode="contain" fadeDuration={0}
          style={{ position: "absolute", left: b.x - BOLT_W / 2, top: b.y - BOLT_H / 2, width: BOLT_W, height: BOLT_H }} />
      ))}

      {/* ship */}
      <View pointerEvents="none" style={{ position: "absolute", left: ship.x - SHIP_W / 2, top: ship.y - SHIP_W / 2 }}>
        {rapidNow && <View style={{ position: "absolute", left: -4, top: -4, width: SHIP_W + 8, height: SHIP_W + 8, borderRadius: (SHIP_W + 8) / 2, borderWidth: 2, borderColor: color.cyan, opacity: 0.8 }} />}
        <Sprite source={SHIP} size={SHIP_W} />
      </View>

      <View style={StyleSheet.absoluteFill} {...pan.panHandlers} pointerEvents={running ? "auto" : "none"} />

      <EffectsLayer ref={fx} reduced={reducedMotion} />

      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <View style={st.hudPanel}>
          <PixelText size="score">{String(score).padStart(5, "0")}</PixelText>
          <PixelText size="label" style={{ marginTop: 4 }}>LV {level}  LIVES {Math.max(0, lives)}</PixelText>
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <IconButton label="Pause" glyph={phase === "paused" ? "▶" : "❚❚"} onPress={togglePause} />
          <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
        </View>
      </View>

      <GameOverlay visible={phase === "ready"} kind="pause" title="DOT CATCHER"
        primaryLabel="Launch" onPrimary={start} onExit={onExit}>
        <Body muted style={{ textAlign: "center", marginTop: space.md }}>
          Drag anywhere in the lower half to fly — your ship auto-fires upward. Blast the
          enemy craft, grab orbs to help (rapid fire, bonus, extra life). Lose all lives and
          it's over. It starts gentle and ramps up.
        </Body>
      </GameOverlay>
      <GameOverlay visible={phase === "paused"} kind="pause" title="PAUSED"
        primaryLabel="Resume" onPrimary={togglePause} onExit={onExit} />
      <ScoreboardOverlay visible={phase === "over"} gameId="catch" score={score}
        scoreLabel={`SCORE ${score}`} onPlayAgain={restart} onExit={onExit} />
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#060912" },
  midline: { position: "absolute", left: 0, right: 0, top: H * 0.5, height: 2, backgroundColor: "rgba(0,229,255,0.14)" },
  hud: { position: "absolute", left: 0, right: 0, zIndex: 5, paddingHorizontal: space.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  hudPanel: { backgroundColor: "rgba(20,26,34,0.7)", borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, borderColor: color.surfaceLine },
});

export const catchGame: GameModule = { id: "catch", title: "Dot Catcher", kind: "arcade", Screen: GameScreen };
