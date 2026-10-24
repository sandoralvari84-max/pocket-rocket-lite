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
 * Dot Catcher — vertical space shooter with WAVE progression + BOSSES.
 *   - the ship roams the LOWER HALF (drag to move in X and Y); auto-fires upward
 *   - discrete waves: clear a wave to advance; every 5th wave is a BOSS fight
 *   - enemies: drone (fast, fragile), weaver (sine drift), gunship (tanky, SHOOTS)
 *   - boss: big hull, tracks across the top, fires aimed 3-way spreads you dodge
 *   - orbs are HELPFUL pickups only: rapid-fire / spread-shot / extra life / bonus
 *   - all correctness (hp, wave state, boss state, scoring) is deterministic ref
 *     code; the model is never involved. Scoreboard on end.
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
const BOSS_W = 150, BOSS_R = 64;
const ORB_W = 42, ORB_R = 22;
const BOLT_W = 12, BOLT_H = 26, BOLT_R = 15;
const EBOLT_R = 12;            // enemy bolt radius

const MIN_Y = H * 0.5;
const MAX_Y = H - 128;
const clampX = (x: number) => Math.max(SHIP_W / 2, Math.min(W - SHIP_W / 2, x));
const clampY = (y: number) => Math.max(MIN_Y, Math.min(MAX_Y, y));

const LIVES_START = 3, LIVES_CAP = 5;
const BULLET_V = 17;           // player bolt px/tick, upward

// Boss cadence + composition (deterministic).
const BOSS_EVERY = 5;                                          // every 5th wave
const isBossWave = (w: number) => w % BOSS_EVERY === 0;
const waveCount = (w: number) => Math.min(6 + (w - 1) * 2, 20); // normal-wave enemy count
const bossMaxHp = (w: number) => 26 + Math.floor(w / BOSS_EVERY) * 10;

// Gentle-start difficulty, ramping in small readable steps, each capped.
const enemySpeed = (w: number) => Math.min(1.3 + (w - 1) * 0.2, 4.4);  // px/tick down
const spawnMs = (w: number) => Math.max(520, 1400 - (w - 1) * 95);     // gap between spawns
const fireMs = (rapid: boolean) => (rapid ? 130 : 290);

type EType = "drone" | "weaver" | "gunship";
type Enemy = { x: number; y: number; vx: number; hp: number; type: EType; phase: number; fire: number };
type Boss = { x: number; y: number; vx: number; hp: number; maxHp: number; fire: number; enter: boolean };
type Bolt = { x: number; y: number; vx: number };
type EBolt = { x: number; y: number; vx: number; vy: number };
type OrbKind = "rapid" | "spread" | "life" | "points";
type Orb = { x: number; y: number; kind: OrbKind };

const ORB_META: Record<OrbKind, { ring: string; tag: string; say: string }> = {
  rapid: { ring: color.cyan, tag: "R", say: "RAPID" },
  spread: { ring: "#B98CF0", tag: "W", say: "SPREAD" },
  life: { ring: color.success, tag: "+1", say: "+1 LIFE" },
  points: { ring: color.amber, tag: "50", say: "+50" },
};

const EMETA: Record<EType, { hp: number; pts: number }> = {
  drone: { hp: 1, pts: 10 }, weaver: { hp: 2, pts: 20 }, gunship: { hp: 3, pts: 30 },
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
  const eboltsRef = useRef<EBolt[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const orbsRef = useRef<Orb[]>([]);
  const bossRef = useRef<Boss | null>(null);
  const waveRef = useRef(1);
  const toSpawnRef = useRef(waveCount(1));        // normal enemies left to spawn this wave
  const clearingUntilRef = useRef(0);             // inter-wave pause end (clock ms)
  const bannerRef = useRef<{ text: string; sub: string; until: number } | null>(null);
  const rapidUntilRef = useRef(0);
  const spreadUntilRef = useRef(0);
  const sinceFire = useRef(0);
  const sinceSpawn = useRef(0);
  const sinceOrb = useRef(0);
  const clockRef = useRef(0);
  const phaseRef = useRef<"ready" | "playing" | "paused" | "over">("ready");

  const [, setFrame] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(LIVES_START);
  const [wave, setWave] = useState(1);
  const [phase, setPhase] = useState<"ready" | "playing" | "paused" | "over">("ready");
  const bump = () => setFrame((f) => (f + 1) % 1000000);

  function reset() {
    shipRef.current = { x: W / 2, y: H * 0.78 };
    controlRef.current = { x: W / 2, y: H * 0.78 };
    boltsRef.current = []; eboltsRef.current = []; enemiesRef.current = []; orbsRef.current = [];
    bossRef.current = null;
    waveRef.current = 1; toSpawnRef.current = waveCount(1); clearingUntilRef.current = 0;
    bannerRef.current = { text: "WAVE 1", sub: "", until: 1400 };
    rapidUntilRef.current = 0; spreadUntilRef.current = 0;
    sinceFire.current = 0; sinceSpawn.current = 0; sinceOrb.current = 0; clockRef.current = 0;
    setScore(0); setLives(LIVES_START); setWave(1);
  }
  const start = () => { reset(); phaseRef.current = "playing"; setPhase("playing"); bump(); };
  const restart = start;
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

  function advanceWave() {
    const w = waveRef.current + 1;
    waveRef.current = w; setWave(w);
    sinceSpawn.current = 0;
    if (isBossWave(w)) {
      toSpawnRef.current = 0;
      bossRef.current = { x: W / 2, y: -BOSS_W, vx: 2.2, hp: bossMaxHp(w), maxHp: bossMaxHp(w), fire: 0, enter: true };
      bannerRef.current = { text: "WARNING", sub: "BOSS INCOMING", until: clockRef.current + 1600 };
    } else {
      toSpawnRef.current = waveCount(w);
      bannerRef.current = { text: `WAVE ${w}`, sub: "", until: clockRef.current + 1300 };
    }
  }

  function spawnEnemy() {
    const w = waveRef.current;
    const r = Math.random();
    // mix shifts toward tougher types as waves climb
    const gun = Math.min(0.12 + w * 0.03, 0.4);
    const weave = Math.min(0.18 + w * 0.02, 0.4);
    const type: EType = r < gun ? "gunship" : r < gun + weave ? "weaver" : "drone";
    const x = ENEMY_W / 2 + Math.random() * (W - ENEMY_W);
    const drift = (Math.random() * 2 - 1) * (0.5 + w * 0.1);
    enemiesRef.current.push({
      x, y: -ENEMY_W / 2, vx: type === "gunship" ? drift * 0.5 : drift,
      hp: EMETA[type].hp, type, phase: Math.random() * Math.PI * 2, fire: 800 + Math.random() * 1200,
    });
    toSpawnRef.current -= 1;
  }
  function spawnOrb() {
    const r = Math.random();
    const kind: OrbKind = r < 0.4 ? "points" : r < 0.65 ? "rapid" : r < 0.85 ? "spread" : "life";
    orbsRef.current.push({ x: ORB_W / 2 + Math.random() * (W - ORB_W), y: -ORB_W / 2, kind });
  }

  function fireEnemyBolt(x: number, y: number, spread: number) {
    const ship = shipRef.current;
    const ang = Math.atan2(ship.y - y, ship.x - x);
    const speed = 7;
    for (let k = -Math.floor(spread / 2); k <= Math.floor(spread / 2); k++) {
      const a = ang + k * 0.28;
      eboltsRef.current.push({ x, y, vx: Math.cos(a) * speed, vy: Math.max(2, Math.sin(a) * speed) });
    }
  }

  useEffect(() => {
    const id = setInterval(() => {
      if (phaseRef.current !== "playing") return;
      clockRef.current += TICK;
      const now = clockRef.current;
      const w = waveRef.current;
      const ship = shipRef.current;
      const boss = bossRef.current;

      ship.x += (controlRef.current.x - ship.x) * 0.35;
      ship.y += (controlRef.current.y - ship.y) * 0.35;
      ship.x = clampX(ship.x); ship.y = clampY(ship.y);

      // auto-fire (rapid shortens cadence; spread adds side bolts)
      sinceFire.current += TICK;
      const rapid = now < rapidUntilRef.current;
      const spread = now < spreadUntilRef.current;
      if (sinceFire.current >= fireMs(rapid)) {
        sinceFire.current = 0;
        const y = ship.y - SHIP_W / 2;
        boltsRef.current.push({ x: ship.x, y, vx: 0 });
        if (spread) { boltsRef.current.push({ x: ship.x, y, vx: -5 }); boltsRef.current.push({ x: ship.x, y, vx: 5 }); }
      }

      // spawn normal enemies (not during the inter-wave pause, not on boss waves)
      if (!boss && toSpawnRef.current > 0 && now >= clearingUntilRef.current) {
        sinceSpawn.current += TICK;
        if (sinceSpawn.current >= spawnMs(w)) { sinceSpawn.current = 0; spawnEnemy(); }
      }
      // occasional helpful orb
      sinceOrb.current += TICK;
      if (sinceOrb.current >= 6500) { sinceOrb.current = 0; spawnOrb(); }

      // player bolts up
      for (const b of boltsRef.current) { b.y -= BULLET_V; b.x += b.vx; }
      boltsRef.current = boltsRef.current.filter((b) => b.y > -BOLT_H);

      // enemies move + fire
      const spd = enemySpeed(w);
      for (const e of enemiesRef.current) {
        if (e.type === "weaver") { e.phase += 0.08; e.x += Math.sin(e.phase) * 2.4 + e.vx * 0.3; e.y += spd * 0.9; }
        else { e.y += e.type === "gunship" ? spd * 0.8 : spd; e.x += e.vx; }
        if (e.x < ENEMY_W / 2 || e.x > W - ENEMY_W / 2) { e.vx = -e.vx; e.x = clampX(e.x); }
        if (e.type === "gunship" && e.y > 0 && e.y < H * 0.5) {
          e.fire -= TICK;
          if (e.fire <= 0) { e.fire = 1700; fireEnemyBolt(e.x, e.y + ENEMY_R, 1); }
        }
      }

      // boss update: descend to station, strafe, fire spreads
      if (boss) {
        if (boss.enter) { boss.y += 3; if (boss.y >= H * 0.16) { boss.y = H * 0.16; boss.enter = false; } }
        else {
          boss.x += boss.vx;
          if (boss.x < BOSS_W / 2 || boss.x > W - BOSS_W / 2) { boss.vx = -boss.vx; boss.x = Math.max(BOSS_W / 2, Math.min(W - BOSS_W / 2, boss.x)); }
          boss.fire -= TICK;
          if (boss.fire <= 0) { boss.fire = 1100; fireEnemyBolt(boss.x, boss.y + BOSS_R, 3); }
        }
      }

      // enemy bolts down
      for (const eb of eboltsRef.current) { eb.x += eb.vx; eb.y += eb.vy; }
      eboltsRef.current = eboltsRef.current.filter((eb) => eb.y < H + 20 && eb.x > -20 && eb.x < W + 20);

      // player bolt -> enemy / boss
      const deadBolts = new Set<number>();
      let gainedScore = 0;
      let lifeLostAt: { x: number; y: number } | null = null;
      for (const e of enemiesRef.current) {
        if (e.hp <= 0) continue;
        for (let bi = 0; bi < boltsRef.current.length; bi++) {
          if (deadBolts.has(bi)) continue;
          const b = boltsRef.current[bi];
          if (Math.hypot(b.x - e.x, b.y - e.y) < ENEMY_R + BOLT_R) {
            deadBolts.add(bi); e.hp -= 1;
            fx.current?.burst(b.x, b.y, { count: 6, color: color.cyan, speed: 90, size: 4 });
            if (e.hp <= 0) {
              const pts = EMETA[e.type].pts; gainedScore += pts;
              fx.current?.burst(e.x, e.y, { count: 16, color: color.amber, speed: 150, size: 6 });
              fx.current?.popScore(e.x, e.y, `+${pts}`, color.amber);
            }
            break;
          }
        }
      }
      if (boss && !boss.enter) {
        for (let bi = 0; bi < boltsRef.current.length; bi++) {
          if (deadBolts.has(bi)) continue;
          const b = boltsRef.current[bi];
          if (Math.hypot(b.x - boss.x, b.y - boss.y) < BOSS_R + BOLT_R) {
            deadBolts.add(bi); boss.hp -= 1;
            fx.current?.burst(b.x, b.y, { count: 6, color: color.amber, speed: 90, size: 4 });
            if (boss.hp <= 0) {
              gainedScore += 300;
              fx.current?.burst(boss.x, boss.y, { count: 40, color: color.amber, speed: 220, size: 8 });
              fx.current?.popScore(boss.x, boss.y, "+300", color.amber);
              bossRef.current = null;
              bannerRef.current = { text: "BOSS DOWN", sub: "", until: now + 1300 };
              clearingUntilRef.current = now + 1300;
            }
            break;
          }
        }
      }
      if (deadBolts.size) boltsRef.current = boltsRef.current.filter((_, i) => !deadBolts.has(i));

      // remove dead/escaped enemies (an enemy slipping past the bottom costs a life),
      // then enemy-touch and enemy-bolt hits on the ship, then the boss body.
      enemiesRef.current = enemiesRef.current.filter((e) => {
        if (e.hp <= 0) return false;
        if (e.y - ENEMY_W / 2 > H) { lifeLostAt = { x: e.x, y: H - 60 }; return false; }
        if (Math.hypot(e.x - ship.x, e.y - ship.y) < ENEMY_R + SHIP_R) { lifeLostAt = { x: e.x, y: e.y }; return false; }
        return true;
      });
      eboltsRef.current = eboltsRef.current.filter((eb) => {
        if (Math.hypot(eb.x - ship.x, eb.y - ship.y) < EBOLT_R + SHIP_R) { lifeLostAt = { x: ship.x, y: ship.y }; return false; }
        return true;
      });
      if (boss && !boss.enter && Math.hypot(boss.x - ship.x, boss.y - ship.y) < BOSS_R + SHIP_R) {
        lifeLostAt = { x: ship.x, y: ship.y };
      }

      // helpful orbs: fall, and catching one helps (missing one costs nothing)
      orbsRef.current = orbsRef.current.filter((o) => {
        o.y += 2.4;
        if (Math.hypot(o.x - ship.x, o.y - ship.y) < ORB_R + SHIP_R) {
          if (o.kind === "rapid") rapidUntilRef.current = now + 6000;
          else if (o.kind === "spread") spreadUntilRef.current = now + 6000;
          else if (o.kind === "life") setLives((v) => Math.min(LIVES_CAP, v + 1));
          else gainedScore += 50;
          fx.current?.burst(o.x, o.y, { count: 14, color: ORB_META[o.kind].ring, speed: 130, size: 5 });
          fx.current?.popScore(ship.x, ship.y - SHIP_W, ORB_META[o.kind].say, ORB_META[o.kind].ring);
          return false;
        }
        return o.y - ORB_W / 2 < H;
      });

      if (gainedScore) setScore((s) => s + gainedScore);

      // wave-clear detection (normal waves): all spawned, none alive, not already clearing
      if (!boss && toSpawnRef.current <= 0 && enemiesRef.current.length === 0 && now >= clearingUntilRef.current && clearingUntilRef.current === 0) {
        bannerRef.current = { text: `WAVE ${w} CLEAR`, sub: "", until: now + 1200 };
        clearingUntilRef.current = now + 1200;
      }
      // when the inter-wave pause ends, advance
      if (clearingUntilRef.current > 0 && now >= clearingUntilRef.current && !boss) {
        clearingUntilRef.current = 0;
        advanceWave();
      }

      if (lifeLostAt) loseLife((lifeLostAt as { x: number; y: number }).x, (lifeLostAt as { x: number; y: number }).y);

      bump();
    }, TICK);
    return () => clearInterval(id);
  }, []);

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
  const now = clockRef.current;
  const rapidNow = now < rapidUntilRef.current;
  const spreadNow = now < spreadUntilRef.current;
  const boss = bossRef.current;
  const banner = bannerRef.current && now < bannerRef.current.until ? bannerRef.current : null;

  const midline = useMemo(() => <View pointerEvents="none" style={st.midline} />, []);

  return (
    <View style={st.fill}>
      {STARS.map((s, i) => (
        <View key={i} pointerEvents="none" style={{ position: "absolute", left: s.x, top: s.y, width: s.sz, height: s.sz, borderRadius: s.sz / 2, backgroundColor: "#E8F0FF", opacity: s.op }} />
      ))}
      {midline}

      {/* boss */}
      {boss && (
        <Image source={GUNSHIP} resizeMode="contain" fadeDuration={0}
          style={{ position: "absolute", left: boss.x - BOSS_W / 2, top: boss.y - BOSS_W / 2, width: BOSS_W, height: BOSS_W }} />
      )}

      {/* enemies */}
      {enemiesRef.current.map((e, i) => (
        <Image key={`e${i}`} source={e.type === "gunship" ? GUNSHIP : DRONE} resizeMode="contain" fadeDuration={0}
          style={{ position: "absolute", left: e.x - ENEMY_W / 2, top: e.y - ENEMY_W / 2, width: ENEMY_W, height: ENEMY_W,
            opacity: e.type === "weaver" ? 0.92 : 1 }} />
      ))}

      {/* helpful orbs */}
      {orbsRef.current.map((o, i) => (
        <View key={`o${i}`} pointerEvents="none" style={{ position: "absolute", left: o.x - ORB_W / 2, top: o.y - ORB_W / 2, width: ORB_W, height: ORB_W, alignItems: "center", justifyContent: "center" }}>
          <View style={{ position: "absolute", width: ORB_W, height: ORB_W, borderRadius: ORB_W / 2, borderWidth: 2, borderColor: ORB_META[o.kind].ring, opacity: 0.9 }} />
          <Sprite source={ORB} size={ORB_W - 6} />
          <PixelText size="label" style={{ position: "absolute", bottom: -12, color: ORB_META[o.kind].ring }}>{ORB_META[o.kind].tag}</PixelText>
        </View>
      ))}

      {/* enemy bolts */}
      {eboltsRef.current.map((eb, i) => (
        <View key={`eb${i}`} pointerEvents="none" style={{ position: "absolute", left: eb.x - EBOLT_R, top: eb.y - EBOLT_R, width: EBOLT_R * 2, height: EBOLT_R * 2, borderRadius: EBOLT_R, backgroundColor: "#FF6E5A", borderWidth: 2, borderColor: "#FFC9BE" }} />
      ))}

      {/* player bolts */}
      {boltsRef.current.map((b, i) => (
        <Image key={`b${i}`} source={BOLT} resizeMode="contain" fadeDuration={0}
          style={{ position: "absolute", left: b.x - BOLT_W / 2, top: b.y - BOLT_H / 2, width: BOLT_W, height: BOLT_H }} />
      ))}

      {/* ship */}
      <View pointerEvents="none" style={{ position: "absolute", left: ship.x - SHIP_W / 2, top: ship.y - SHIP_W / 2 }}>
        {rapidNow && <View style={{ position: "absolute", left: -4, top: -4, width: SHIP_W + 8, height: SHIP_W + 8, borderRadius: (SHIP_W + 8) / 2, borderWidth: 2, borderColor: color.cyan, opacity: 0.8 }} />}
        {spreadNow && <View style={{ position: "absolute", left: -8, top: -8, width: SHIP_W + 16, height: SHIP_W + 16, borderRadius: (SHIP_W + 16) / 2, borderWidth: 2, borderColor: "#B98CF0", opacity: 0.7 }} />}
        <Sprite source={SHIP} size={SHIP_W} />
      </View>

      <View style={StyleSheet.absoluteFill} {...pan.panHandlers} pointerEvents={running ? "auto" : "none"} />

      <EffectsLayer ref={fx} reduced={reducedMotion} />

      {/* boss HP bar */}
      {boss && !boss.enter && (
        <View pointerEvents="none" style={st.bossBar}>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: color.danger, width: `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%` }} />
        </View>
      )}

      {/* wave / boss banner */}
      {banner && (
        <View pointerEvents="none" style={st.banner}>
          <PixelText size="h2" style={{ color: color.amber, textAlign: "center" }}>{banner.text}</PixelText>
          {banner.sub ? <PixelText size="label" style={{ color: color.danger, textAlign: "center", marginTop: 4 }}>{banner.sub}</PixelText> : null}
        </View>
      )}

      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <View style={st.hudPanel}>
          <PixelText size="score">{String(score).padStart(5, "0")}</PixelText>
          <PixelText size="label" style={{ marginTop: 4 }}>WAVE {wave}  LIVES {Math.max(0, lives)}</PixelText>
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <IconButton label="Pause" glyph={phase === "paused" ? "▶" : "❚❚"} onPress={togglePause} />
          <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
        </View>
      </View>

      <GameOverlay visible={phase === "ready"} kind="pause" title="DOT CATCHER"
        primaryLabel="Launch" onPrimary={start} onExit={onExit}>
        <Body muted style={{ textAlign: "center", marginTop: space.md }}>
          Drag in the lower half to fly — your ship auto-fires upward. Clear each wave of enemy
          craft to advance; every fifth wave is a boss. Grab orbs to help (rapid fire, spread
          shot, bonus, extra life). Dodge enemy fire. Lose all lives and it's over.
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
  bossBar: { position: "absolute", left: 40, right: 40, top: H * 0.16 + BOSS_W / 2 + 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  banner: { position: "absolute", left: 0, right: 0, top: H * 0.34, alignItems: "center" },
});

export const catchGame: GameModule = { id: "catch", title: "Dot Catcher", kind: "arcade", Screen: GameScreen };
