import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Dimensions, PanResponder, Image, Animated, Pressable, Easing } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, GameOverlay, Sprite } from "../design/ui";
import { EffectsLayer, type EffectsHandle } from "../design/effects";
import { ScoreboardOverlay } from "../design/Scoreboard";
import { useSettings } from "../settings";

/* ----------------------------------------------------------------------------
 * ROCKET RAID — vertical space shooter (game id stays `catch`).
 *
 * Built on the original deterministic ref-based core (hardcore-safe) and extended
 * with the full spec in docs/games/ROCKET_RAID.md:
 *   - STAGES (8 themed stages, several waves each + a boss slot) and an NG+ loop.
 *   - 8 BOSSES with distinct, phased patterns (Carrier, Interceptor, Turret Wall,
 *     Hive, Dreadnought, Minelayer, Mirror, Warden).
 *   - ENEMY variety: drone / weaver / gunship + strafer / shielded / splitter /
 *     kamikaze / sniper (+ hive pods, drifting mines).
 *   - UPGRADES: weapon tiers (single→twin→spread→laser), side-drones, shield,
 *     limited bomb, speed, magnet — mid-run pickups + between-stage pick-one-of-three.
 *   - ANIMATION BEATS: boss intro (WARNING + slide-in + HP bar fill), boss kill
 *     (chained explosions → slow-mo → flash → STAGE CLEAR tally), death (burst →
 *     beat → respawn with i-frames; proper game-over before replay).
 *
 * HARDCORE-SAFE: all correctness is deterministic ref code. Gameplay RNG is a
 * SEEDED PRNG (daily seed) so "today's run" is comparable and never desyncs. No
 * passive score farming (off-screen / escaped enemies award nothing). Small fair
 * ship hitbox (SHIP_R vs SHIP_W) + brief i-frames after a hit. Limited bombs.
 * Entity/particle counts are capped for low-end Android. No softlocks.
 * ------------------------------------------------------------------------- */

const SHIP = require("../../assets/arcade/catch/ship.png");
const ORB = require("../../assets/arcade/catch/orb.png");
const DRONE = require("../../assets/arcade/catch/drone.png");
const GUNSHIP = require("../../assets/arcade/catch/gunship.png");
const STRAFER = require("../../assets/arcade/catch/strafer.png");
const SHIELDED = require("../../assets/arcade/catch/shielded.png");
const SPLITTER = require("../../assets/arcade/catch/splitter.png");
const KAMIKAZE = require("../../assets/arcade/catch/kamikaze.png");
const SNIPER = require("../../assets/arcade/catch/sniper.png");
const POD = require("../../assets/arcade/catch/pod.png");
const MINE = require("../../assets/arcade/catch/mine.png");
const BOLT = require("../../assets/arcade/catch/bolt.png");
const EBOLT = require("../../assets/arcade/catch/ebolt.png");

const B_CARRIER = require("../../assets/arcade/catch/boss_carrier.png");
const B_INTER = require("../../assets/arcade/catch/boss_interceptor.png");
const B_TURRET = require("../../assets/arcade/catch/boss_turret.png");
const B_HIVE = require("../../assets/arcade/catch/boss_hive.png");
const B_DREAD = require("../../assets/arcade/catch/boss_dreadnought.png");
const B_MINELAYER = require("../../assets/arcade/catch/boss_minelayer.png");
const B_MIRROR = require("../../assets/arcade/catch/boss_mirror.png");
const B_WARDEN = require("../../assets/arcade/catch/boss_warden.png");

const { width: W, height: H } = Dimensions.get("window");
const TICK = 33;

const SHIP_W = 74, SHIP_R = 24;           // small, fair hitbox vs. the big sprite
const ENEMY_W = 48, ENEMY_R = 22;
const POD_W = 34, POD_R = 15;
const MINE_W = 44, MINE_R = 20;
const BOSS_R = 60;                        // boss body collision radius
const ORB_W = 42, ORB_R = 22;
const BOLT_W = 12, BOLT_H = 26, BOLT_R = 15;
const EBOLT_W = 22, EBOLT_R = 11;

const MIN_Y = H * 0.44;
const MAX_Y = H - 120;
const clampX = (x: number) => Math.max(SHIP_W / 2, Math.min(W - SHIP_W / 2, x));
const clampY = (y: number) => Math.max(MIN_Y, Math.min(MAX_Y, y));
const clampBoss = (x: number) => Math.max(BOSS_R, Math.min(W - BOSS_R, x));

const LIVES_START = 3, LIVES_CAP = 5;
const BULLET_V = 17;
const BOMB_CAP = 3;

// Entity caps (low-end Android safety).
const BOLT_CAP = 48, EBOLT_CAP = 80, ENEMY_CAP = 24, MINE_CAP = 10;

const IFRAME_MS = 1500;       // invulnerability after a hit
const RESPAWN_MS = 850;       // ship-dead beat before respawn
const GAMEOVER_MS = 1500;     // death cinematic before the scoreboard
const BOSSDEATH_MS = 1250;    // chained explosions + slow-mo
const STAGECLEAR_MS = 1900;   // tally shown before the upgrade pick

/* ----- Stages & bosses ---------------------------------------------------- */
type BossKind =
  | "carrier" | "interceptor" | "turret" | "hive"
  | "dreadnought" | "minelayer" | "mirror" | "warden";

const STAGES: { name: string; boss: BossKind }[] = [
  { name: "DEEP SPACE", boss: "carrier" },
  { name: "ASTEROID BELT", boss: "minelayer" },
  { name: "ENEMY FLEET", boss: "interceptor" },
  { name: "OUTER PICKET", boss: "turret" },
  { name: "THE HIVE", boss: "hive" },
  { name: "SIEGE LINE", boss: "mirror" },
  { name: "WARDEN GATE", boss: "warden" },
  { name: "THE DREADNOUGHT", boss: "dreadnought" },
];
const STAGE_COUNT = STAGES.length;
const WAVES_PER_STAGE = 3;
const STAGE_LEN = WAVES_PER_STAGE + 1;    // normal waves + boss wave

const BOSS_SPRITE: Record<BossKind, number> = {
  carrier: B_CARRIER, interceptor: B_INTER, turret: B_TURRET, hive: B_HIVE,
  dreadnought: B_DREAD, minelayer: B_MINELAYER, mirror: B_MIRROR, warden: B_WARDEN,
};
const BOSS_DRAW: Record<BossKind, number> = {
  carrier: 180, interceptor: 180, turret: 210, hive: 176,
  dreadnought: 220, minelayer: 190, mirror: 176, warden: 190,
};
const BOSS_LABEL: Record<BossKind, string> = {
  carrier: "CARRIER", interceptor: "INTERCEPTOR", turret: "TURRET WALL", hive: "HIVE",
  dreadnought: "DREADNOUGHT", minelayer: "MINELAYER", mirror: "MIRROR", warden: "WARDEN",
};
const BOSS_BASE_HP: Record<BossKind, number> = {
  carrier: 58, minelayer: 70, interceptor: 78, turret: 92,
  hive: 104, mirror: 116, warden: 128, dreadnought: 170,
};

/* ----- Enemies ------------------------------------------------------------ */
type EType =
  | "drone" | "weaver" | "gunship"
  | "strafer" | "shielded" | "splitter" | "kamikaze" | "sniper" | "pod";

const ESPRITE: Record<EType, number> = {
  drone: DRONE, weaver: DRONE, gunship: GUNSHIP, strafer: STRAFER,
  shielded: SHIELDED, splitter: SPLITTER, kamikaze: KAMIKAZE, sniper: SNIPER, pod: POD,
};
const EHP: Record<EType, number> = {
  drone: 1, weaver: 2, gunship: 3, strafer: 2, shielded: 3,
  splitter: 2, kamikaze: 1, sniper: 2, pod: 1,
};
const EPTS: Record<EType, number> = {
  drone: 10, weaver: 20, gunship: 30, strafer: 20, shielded: 40,
  splitter: 25, kamikaze: 20, sniper: 35, pod: 10,
};

type Enemy = {
  x: number; y: number; vx: number; vy: number; hp: number; type: EType;
  phase: number; fire: number; born: number;
  lockX: number; diving: boolean; split: boolean; bandY: number;
};
type Boss = {
  kind: BossKind; x: number; y: number; vx: number; hp: number; maxHp: number;
  enter: boolean; stationY: number; phase: number; t: number; t2: number; fire: number;
  sweep: number; sweepDir: number; beamState: number; panelAng: number;
  dashUntil: number; dashVX: number; exposed: boolean;
};
type Bolt = { x: number; y: number; vx: number; dmg: number };
type EBolt = { x: number; y: number; vx: number; vy: number };
type Mine = { x: number; y: number; vx: number; vy: number; hp: number };

type OrbKind = "power" | "drone" | "shield" | "bomb" | "life" | "points" | "rapid";
const ORB_META: Record<OrbKind, { ring: string; tag: string; say: string }> = {
  power: { ring: color.amber, tag: "P", say: "WEAPON UP" },
  drone: { ring: color.cyan, tag: "D", say: "+DRONE" },
  shield: { ring: color.success, tag: "S", say: "SHIELD" },
  bomb: { ring: color.warn, tag: "B", say: "+BOMB" },
  life: { ring: color.success, tag: "+1", say: "+1 LIFE" },
  points: { ring: color.amber, tag: "50", say: "+50" },
  rapid: { ring: color.cyan, tag: "R", say: "RAPID" },
};
type Orb = { x: number; y: number; kind: OrbKind };

type Upgrades = {
  weapon: number;   // 0 single, 1 twin, 2 spread, 3 laser
  drones: number;   // 0..2 side drones (options)
  speed: number;    // 0..3 responsiveness
  magnet: boolean;  // orbs drift toward the ship
  shieldMax: number;// 0..2 shield charge capacity
  bombs: number;    // current bombs (limited)
};
const WEAPON_NAME = ["SINGLE", "TWIN", "SPREAD", "LASER"];

type UpId = "weapon" | "drone" | "shield" | "speed" | "magnet" | "bomb" | "life";
type UpOption = { id: UpId; title: string; desc: string; ring: string };

type Flow = "play" | "respawn" | "bossdeath" | "stageclear" | "choose" | "gameover";

// Deterministic seeded PRNG (mulberry32). Seeded per-run from the daily seed so
// spawn patterns are reproducible and "today's run" is comparable.
function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const DAILY_SEED = (() => {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
})();

const norm = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

// Difficulty curves driven by the ABSOLUTE wave index (climbs across stages + NG+).
const enemySpeed = (d: number) => Math.min(1.3 + (d - 1) * 0.16, 4.8);
const spawnMs = (d: number) => Math.max(360, 1250 - (d - 1) * 72);   // denser spawns
const waveCount = (d: number) => Math.min(8 + (d - 1) * 2, 26);       // bigger waves

// Parallax starfield — 3 layers drift downward at different speeds so it reads as flying
// through space. Native-driven (translateY loops) → smooth + cheap on low-end hardware.
const STAR_FAR = require("../../assets/arcade/catch/star_far.png");
const STAR_MID = require("../../assets/arcade/catch/star_mid.png");
const STAR_NEAR = require("../../assets/arcade/catch/star_near.png");
const STAR_TILE = 1000;

function Starfield({ reduced }: { reduced?: boolean }) {
  const far = useRef(new Animated.Value(0)).current;
  const mid = useRef(new Animated.Value(0)).current;
  const near = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const mk = (v: Animated.Value, dur: number) =>
      Animated.loop(Animated.timing(v, { toValue: 1, duration: dur, easing: Easing.linear, useNativeDriver: true }));
    const loops = [mk(far, 32000), mk(mid, 18000), mk(near, 10000)];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduced]);
  const rowOf = (img: any, v: Animated.Value) => {
    const ty = v.interpolate({ inputRange: [0, 1], outputRange: [0, STAR_TILE] });
    return (
      <Animated.View style={{ position: "absolute", left: 0, right: 0, top: 0, height: STAR_TILE * 2, transform: [{ translateY: ty }] }}>
        <Image source={img} resizeMode="stretch" fadeDuration={0} style={{ position: "absolute", top: -STAR_TILE, left: 0, right: 0, height: STAR_TILE }} />
        <Image source={img} resizeMode="stretch" fadeDuration={0} style={{ position: "absolute", top: 0, left: 0, right: 0, height: STAR_TILE }} />
      </Animated.View>
    );
  };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {rowOf(STAR_FAR, far)}
      {rowOf(STAR_MID, mid)}
      {rowOf(STAR_NEAR, near)}
    </View>
  );
}

function GameScreen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useSettings();
  const fx = useRef<EffectsHandle>(null);

  const shipRef = useRef({ x: W / 2, y: H * 0.78 });
  const controlRef = useRef({ x: W / 2, y: H * 0.78 });
  const boltsRef = useRef<Bolt[]>([]);
  const eboltsRef = useRef<EBolt[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const minesRef = useRef<Mine[]>([]);
  const orbsRef = useRef<Orb[]>([]);
  const bossRef = useRef<Boss | null>(null);

  const rngRef = useRef<() => number>(mulberry32(DAILY_SEED));
  const rnd = () => rngRef.current();

  const stageRef = useRef(0);
  const loopRef = useRef(0);
  const waveRef = useRef(1);
  const toSpawnRef = useRef(0);
  const clearingRef = useRef(false);        // inter-wave pause active
  const clearUntilRef = useRef(0);

  const flowRef = useRef<Flow>("play");
  const respawnAtRef = useRef(0);
  const gameoverAtRef = useRef(0);
  const bossDeathAtRef = useRef(0);
  const stageClearAtRef = useRef(0);
  const deathCenterRef = useRef({ x: W / 2, y: H / 2 });
  const slowUntilRef = useRef(0);
  const fxQueueRef = useRef<{ at: number; x: number; y: number; big: boolean }[]>([]);
  const bossBarFillRef = useRef(0);         // 0..1 fill animation for the boss HP bar

  const upRef = useRef<Upgrades>({ weapon: 0, drones: 0, speed: 0, magnet: false, shieldMax: 0, bombs: 0 });
  const shieldRef = useRef(0);              // current shield charges
  const invulnUntilRef = useRef(0);
  const livesRef = useRef(LIVES_START);

  const rapidUntilRef = useRef(0);
  const spreadUntilRef = useRef(0);
  const sinceFire = useRef(0);
  const sinceSpawn = useRef(0);
  const sinceOrb = useRef(0);
  const clockRef = useRef(0);
  const bannerRef = useRef<{ text: string; sub: string; warn: boolean; until: number } | null>(null);
  const phaseRef = useRef<"ready" | "playing" | "paused" | "over">("ready");

  const flashA = useRef(new Animated.Value(0)).current;

  const [, setFrame] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(LIVES_START);
  const [phase, setPhase] = useState<"ready" | "playing" | "paused" | "over">("ready");
  const [choices, setChoices] = useState<UpOption[] | null>(null);
  const bump = () => setFrame((f) => (f + 1) % 1000000);

  function reset() {
    shipRef.current = { x: W / 2, y: H * 0.78 };
    controlRef.current = { x: W / 2, y: H * 0.78 };
    boltsRef.current = []; eboltsRef.current = []; enemiesRef.current = [];
    minesRef.current = []; orbsRef.current = []; bossRef.current = null;
    rngRef.current = mulberry32(DAILY_SEED);
    stageRef.current = 0; loopRef.current = 0; waveRef.current = 1;
    toSpawnRef.current = waveCount(1); clearingRef.current = false; clearUntilRef.current = 0;
    flowRef.current = "play"; fxQueueRef.current = []; bossBarFillRef.current = 0;
    upRef.current = { weapon: 0, drones: 0, speed: 0, magnet: false, shieldMax: 0, bombs: 1 };
    shieldRef.current = 0; invulnUntilRef.current = 0; livesRef.current = LIVES_START;
    rapidUntilRef.current = 0; spreadUntilRef.current = 0;
    sinceFire.current = 0; sinceSpawn.current = 0; sinceOrb.current = 0; clockRef.current = 0;
    slowUntilRef.current = 0; respawnAtRef.current = 0; gameoverAtRef.current = 0;
    bannerRef.current = { text: STAGES[0].name, sub: "STAGE 1", warn: false, until: 1600 };
    setScore(0); setLives(LIVES_START); setChoices(null);
  }
  const start = () => { reset(); phaseRef.current = "playing"; setPhase("playing"); bump(); };
  const restart = start;
  const togglePause = () => {
    if (phaseRef.current === "playing") { phaseRef.current = "paused"; setPhase("paused"); }
    else if (phaseRef.current === "paused") { phaseRef.current = "playing"; setPhase("playing"); }
  };

  const absWave = () => loopRef.current * STAGE_COUNT * STAGE_LEN + stageRef.current * STAGE_LEN + waveRef.current;
  const loopTag = () => (loopRef.current > 0 ? ` NG+${loopRef.current}` : "");

  function triggerFlash() {
    if (reducedMotion) return;
    flashA.setValue(0.75);
    Animated.timing(flashA, { toValue: 0, duration: 320, useNativeDriver: true }).start();
  }

  function bossMaxHp(kind: BossKind) {
    return Math.round(BOSS_BASE_HP[kind] * (1 + loopRef.current * 0.55));
  }

  function startBoss() {
    const kind = STAGES[stageRef.current].boss;
    enemiesRef.current = []; eboltsRef.current = []; minesRef.current = [];
    const hp = bossMaxHp(kind);
    bossRef.current = {
      kind, x: W / 2, y: -BOSS_DRAW[kind], vx: 2.4 + loopRef.current * 0.4,
      hp, maxHp: hp, enter: true, stationY: H * 0.17, phase: 0, t: 0, t2: 1200, fire: 900,
      sweep: 0, sweepDir: 1, beamState: 0, panelAng: 0, dashUntil: 0, dashVX: 0, exposed: false,
    };
    bossBarFillRef.current = 0;
    bannerRef.current = { text: "WARNING", sub: `${BOSS_LABEL[kind]} INCOMING`, warn: true, until: clockRef.current + 2000 };
  }

  function advanceWave() {
    if (waveRef.current < WAVES_PER_STAGE) {
      waveRef.current += 1;
      toSpawnRef.current = waveCount(absWave());
      sinceSpawn.current = 0;
      bannerRef.current = { text: `WAVE ${waveRef.current}`, sub: STAGES[stageRef.current].name + loopTag(), warn: false, until: clockRef.current + 1300 };
    } else {
      waveRef.current = WAVES_PER_STAGE + 1;
      startBoss();
    }
  }

  function nextStage() {
    if (stageRef.current < STAGE_COUNT - 1) stageRef.current += 1;
    else { stageRef.current = 0; loopRef.current += 1; }
    waveRef.current = 1;
    toSpawnRef.current = waveCount(absWave());
    sinceSpawn.current = 0;
    if (upRef.current.shieldMax > 0) shieldRef.current = upRef.current.shieldMax;   // recharge shield
    bannerRef.current = { text: STAGES[stageRef.current].name, sub: `STAGE ${stageRef.current + 1}${loopTag()}`, warn: false, until: clockRef.current + 1600 };
  }

  /* ----- upgrade pool ----- */
  function pickThree(): UpOption[] {
    const u = upRef.current;
    const pool: UpOption[] = [];
    if (u.weapon < 3) pool.push({ id: "weapon", title: "WEAPON UP", desc: `→ ${WEAPON_NAME[u.weapon + 1]}`, ring: color.amber });
    if (u.drones < 2) pool.push({ id: "drone", title: "SIDE DRONE", desc: "extra wing gun", ring: color.cyan });
    if (u.shieldMax < 2) pool.push({ id: "shield", title: "SHIELD", desc: "absorbs a hit", ring: color.success });
    if (u.speed < 3) pool.push({ id: "speed", title: "THRUSTERS", desc: "+handling", ring: color.cyan });
    if (!u.magnet) pool.push({ id: "magnet", title: "MAGNET", desc: "pull in orbs", ring: color.amber });
    pool.push({ id: "bomb", title: "+1 BOMB", desc: "screen clear", ring: color.warn });
    pool.push({ id: "life", title: "+1 LIFE", desc: "extra ship", ring: color.success });
    // shuffle (seeded) and take 3 distinct
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, 3);
  }
  function applyUpgrade(id: UpId) {
    const u = upRef.current;
    if (id === "weapon") u.weapon = Math.min(3, u.weapon + 1);
    else if (id === "drone") u.drones = Math.min(2, u.drones + 1);
    else if (id === "shield") { u.shieldMax = Math.min(2, u.shieldMax + 1); shieldRef.current = u.shieldMax; }
    else if (id === "speed") u.speed = Math.min(3, u.speed + 1);
    else if (id === "magnet") u.magnet = true;
    else if (id === "bomb") u.bombs = Math.min(BOMB_CAP, u.bombs + 1);
    else if (id === "life") { livesRef.current = Math.min(LIVES_CAP, livesRef.current + 1); setLives(livesRef.current); }
  }
  function onChoose(id: UpId) {
    applyUpgrade(id);
    setChoices(null);
    nextStage();
    flowRef.current = "play";
    bump();
  }

  /* ----- spawns ----- */
  function enemyMix(d: number): EType[] {
    const bag: EType[] = ["drone", "drone", "weaver"];
    if (d >= 2) bag.push("gunship");
    if (d >= 3) bag.push("strafer");
    if (d >= 4) bag.push("splitter");
    if (d >= 5) bag.push("shielded", "gunship");
    if (d >= 6) bag.push("kamikaze");
    if (d >= 7) bag.push("sniper", "weaver");
    if (d >= 9) bag.push("shielded", "kamikaze");
    return bag;
  }
  function spawnEnemy() {
    if (enemiesRef.current.length >= ENEMY_CAP) { toSpawnRef.current -= 1; return; }
    const d = absWave();
    const bag = enemyMix(d);
    const type = bag[Math.floor(rnd() * bag.length)];
    const x = ENEMY_W / 2 + rnd() * (W - ENEMY_W);
    const drift = (rnd() * 2 - 1) * (0.5 + d * 0.08);
    const e: Enemy = {
      x, y: -ENEMY_W / 2, vx: drift, vy: 0, hp: EHP[type], type,
      phase: rnd() * Math.PI * 2, fire: 700 + rnd() * 1200, born: clockRef.current,
      lockX: x, diving: false, split: false, bandY: H * (0.18 + rnd() * 0.12),
    };
    if (type === "strafer") { const fromLeft = rnd() < 0.5; e.bandY = H * (0.48 + rnd() * 0.14); e.x = fromLeft ? -ENEMY_W / 2 : W + ENEMY_W / 2; e.y = e.bandY; e.vx = (fromLeft ? 1 : -1) * (4 + d * 0.15); }
    enemiesRef.current.push(e);
    toSpawnRef.current -= 1;
  }
  function spawnMinion(x: number, y: number, type: EType) {
    if (enemiesRef.current.length >= ENEMY_CAP) return;
    enemiesRef.current.push({
      x: clampX(x), y, vx: (rnd() * 2 - 1) * 1.2, vy: 0, hp: EHP[type], type,
      phase: rnd() * Math.PI * 2, fire: 900 + rnd() * 900, born: clockRef.current,
      lockX: x, diving: false, split: false, bandY: H * 0.2,
    });
  }
  function spawnPod(x: number, y: number, splitting: boolean) {
    if (enemiesRef.current.length >= ENEMY_CAP) return;
    enemiesRef.current.push({
      x, y, vx: 0, vy: 0, hp: 1, type: "pod", phase: 0, fire: 0, born: clockRef.current,
      lockX: x, diving: false, split: splitting, bandY: 0,
    });
  }
  function spawnShards(x: number, y: number) {
    for (const dx of [-1, 1]) {
      if (enemiesRef.current.length >= ENEMY_CAP) break;
      enemiesRef.current.push({
        x, y, vx: dx * 1.8, vy: 0, hp: 1, type: "drone", phase: 0, fire: 0, born: clockRef.current,
        lockX: x, diving: false, split: false, bandY: 0,
      });
    }
  }
  function dropMine(x: number, y: number) {
    if (minesRef.current.length >= MINE_CAP) return;
    minesRef.current.push({ x: clampX(x), y, vx: (rnd() * 2 - 1) * 0.6, vy: 0.85, hp: 2 });
  }
  function spawnOrb() {
    const r = rnd();
    let kind: OrbKind;
    if (r < 0.26) kind = "points";
    else if (r < 0.46) kind = "power";
    else if (r < 0.60) kind = "drone";
    else if (r < 0.74) kind = "shield";
    else if (r < 0.86) kind = "bomb";
    else if (r < 0.94) kind = "rapid";
    else kind = "life";
    orbsRef.current.push({ x: ORB_W / 2 + rnd() * (W - ORB_W), y: -ORB_W / 2, kind });
  }

  /* ----- enemy / boss fire ----- */
  function pushE(x: number, y: number, vx: number, vy: number) {
    if (eboltsRef.current.length < EBOLT_CAP) eboltsRef.current.push({ x, y, vx, vy });
  }
  function fireAimed(x: number, y: number, n: number, step: number, speed: number) {
    const s = shipRef.current;
    const ang = Math.atan2(s.y - y, s.x - x);
    const half = Math.floor(n / 2);
    for (let k = -half; k <= half; k++) {
      const a = ang + k * step;
      pushE(x, y, Math.cos(a) * speed, Math.max(2, Math.sin(a) * speed));
    }
  }
  function fireRadial(x: number, y: number, count: number, speed: number) {
    for (let k = 0; k < count; k++) { const a = (Math.PI * 2 * k) / count; pushE(x, y, Math.cos(a) * speed, Math.sin(a) * speed); }
  }
  function fireDown(x: number, y: number, speed: number) { pushE(x, y, 0, speed); }

  /* ----- player fire ----- */
  function doFire(now: number) {
    const s = shipRef.current;
    const y = s.y - SHIP_W / 2;
    const tier = upRef.current.weapon;
    const dmg = tier >= 3 ? 2 : 1;
    const push = (px: number, vx: number) => { if (boltsRef.current.length < BOLT_CAP) boltsRef.current.push({ x: px, y, vx, dmg }); };
    if (tier === 0) { if (absWave() >= 10) { push(s.x - 8, 0); push(s.x + 8, 0); } else push(s.x, 0); }  // base scales to twin late so a post-death reset isn't squashed
    else if (tier === 1) { push(s.x - 10, 0); push(s.x + 10, 0); }
    else if (tier === 2) { push(s.x, 0); push(s.x - 7, -5); push(s.x + 7, 5); }
    else { push(s.x - 9, 0); push(s.x + 9, 0); }
    if (now < spreadUntilRef.current) { push(s.x - 4, -8); push(s.x + 4, 8); }
    if (upRef.current.drones >= 1) push(s.x - 42, 0);
    if (upRef.current.drones >= 2) push(s.x + 42, 0);
  }
  const fireMs = (now: number) => {
    const tier = upRef.current.weapon;
    // Slightly slower than before (rocket was a bit OP); base fire quickens with progress.
    let ms = tier >= 3 ? 190 : 340 - Math.min(absWave() * 5, 80);
    if (now < rapidUntilRef.current) ms = Math.min(ms, 150);
    return ms;
  };

  /* ----- bomb ----- */
  function triggerBomb() {
    if (phaseRef.current !== "playing" || flowRef.current !== "play") return;
    if (upRef.current.bombs <= 0) return;
    upRef.current.bombs -= 1;
    triggerFlash();
    const now = clockRef.current;
    let gained = 0;
    // clear enemy fire + mines
    for (const eb of eboltsRef.current) fx.current?.burst(eb.x, eb.y, { count: 3, color: "#FF6E5A", speed: 60, size: 3 });
    eboltsRef.current = [];
    for (const m of minesRef.current) fx.current?.burst(m.x, m.y, { count: 8, color: color.amber, speed: 120, size: 5 });
    minesRef.current = [];
    // damage every on-screen enemy
    for (const e of enemiesRef.current) {
      e.hp -= 3;
      if (e.hp <= 0) { gained += EPTS[e.type]; fx.current?.burst(e.x, e.y, { count: 12, color: color.amber, speed: 160, size: 6 }); }
    }
    enemiesRef.current = enemiesRef.current.filter((e) => e.hp > 0);
    const b = bossRef.current;
    if (b && !b.enter && bossVulnerable(b)) { b.hp -= 10; fx.current?.burst(b.x, b.y, { count: 20, color: color.amber, speed: 180, size: 7 }); }
    if (gained) setScore((s) => s + gained);
    bump();
    void now;
  }

  /* ----- boss vulnerability (dreadnought armor / warden panels) ----- */
  function bossVulnerable(b: Boss) { return b.kind !== "dreadnought" || b.exposed; }
  function bossTakesHit(b: Boss, bx: number, by: number) {
    if (b.kind === "dreadnought") return b.exposed;
    if (b.kind === "warden") {
      const ang = Math.atan2(by - b.y, bx - b.x);
      const gw = b.phase >= 2 ? 0.20 : 0.32;
      for (const base of [Math.PI / 2, (Math.PI * 3) / 2]) {
        const g = base + b.panelAng;
        if (Math.abs(norm(ang - g)) < gw) return true;
      }
      return false;
    }
    return true;
  }

  /* ----- boss pattern state machine (deterministic, phased) ----- */
  function tickBoss(b: Boss, now: number, ts: number) {
    if (b.enter) {
      b.y += 3.2 * ts;
      if (b.y >= b.stationY) { b.y = b.stationY; b.enter = false; b.t = 0; }
      return;
    }
    b.t += TICK;
    const ratio = b.hp / b.maxHp;
    b.phase = ratio > 0.66 ? 0 : ratio > 0.33 ? 1 : 2;
    const ship = shipRef.current;
    switch (b.kind) {
      case "carrier": {
        b.x += b.vx * ts;
        if (b.x < BOSS_R || b.x > W - BOSS_R) { b.vx = -b.vx; b.x = clampBoss(b.x); }
        b.t2 -= TICK;
        if (b.t2 <= 0) { b.t2 = b.phase >= 1 ? 1500 : 2300; spawnMinion(b.x, b.y + BOSS_R * 0.4, b.phase >= 1 ? "weaver" : "drone"); }
        b.fire -= TICK;
        if (b.fire <= 0) { b.fire = 1300; fireAimed(b.x, b.y + BOSS_R, b.phase >= 2 ? 5 : 3, 0.3, 6); }
        break;
      }
      case "interceptor": {
        b.x += b.vx * ts * 1.5;
        if (b.x < BOSS_R || b.x > W - BOSS_R) { b.vx = -b.vx; b.x = clampBoss(b.x); }
        b.t2 -= TICK;
        if (b.dashUntil > now) {
          b.x = clampBoss(b.x + b.dashVX * ts);
          if (b.phase >= 1) b.y = b.stationY + Math.sin(((b.dashUntil - now) / 480) * Math.PI) * (H * 0.12);
        } else {
          b.y += (b.stationY - b.y) * 0.1;
          if (b.t2 <= 0) { b.t2 = b.phase >= 1 ? 1500 : 2200; b.dashUntil = now + 480; b.dashVX = (ship.x > b.x ? 1 : -1) * 9; }
        }
        b.fire -= TICK;
        if (b.fire <= 0) { b.fire = b.phase >= 2 ? 650 : 1000; fireAimed(b.x, b.y + BOSS_R, b.phase >= 1 ? 3 : 1, 0.2, 8); }
        break;
      }
      case "turret": {
        b.x += (W / 2 - b.x) * 0.04;
        b.t2 -= TICK;
        if (b.beamState === 0) { if (b.t2 <= 0) { b.beamState = 1; b.t2 = 700; b.sweep = -0.85; b.sweepDir = 1; } }
        else if (b.beamState === 1) { if (b.t2 <= 0) { b.beamState = 2; b.t2 = b.phase >= 1 ? 1500 : 1200; } }
        else {
          b.sweep += b.sweepDir * 0.016 * ts * (b.phase >= 1 ? 1.5 : 1);
          if (b.sweep > 0.85) { b.sweep = 0.85; b.sweepDir = -1; }
          if (b.sweep < -0.85) { b.sweep = -0.85; b.sweepDir = 1; }
          if (b.t2 <= 0) { b.beamState = 0; b.t2 = b.phase >= 2 ? 700 : 1100; }
        }
        b.fire -= TICK;
        if (b.fire <= 0) { b.fire = 1400; fireAimed(b.x, b.y + BOSS_R, 3, 0.35, 6); }
        break;
      }
      case "hive": {
        b.x += b.vx * ts * 0.6;
        if (b.x < BOSS_R || b.x > W - BOSS_R) { b.vx = -b.vx; b.x = clampBoss(b.x); }
        b.t2 -= TICK;
        if (b.t2 <= 0) { b.t2 = b.phase >= 1 ? 900 : 1300; spawnPod(b.x - 30, b.y + BOSS_R, b.phase >= 2); spawnPod(b.x + 30, b.y + BOSS_R, false); }
        b.fire -= TICK;
        if (b.fire <= 0) { b.fire = 2000; fireRadial(b.x, b.y, b.phase >= 1 ? 10 : 7, 5); }
        break;
      }
      case "minelayer": {
        b.x += b.vx * ts;
        if (b.x < BOSS_R || b.x > W - BOSS_R) { b.vx = -b.vx; b.x = clampBoss(b.x); }
        b.t2 -= TICK;
        if (b.t2 <= 0) { b.t2 = b.phase >= 1 ? 900 : 1300; dropMine(b.x, b.y + BOSS_R); }
        b.fire -= TICK;
        if (b.fire <= 0) { b.fire = 1600; fireAimed(b.x, b.y + BOSS_R, b.phase >= 2 ? 3 : 1, 0.25, 6); }
        break;
      }
      case "mirror": {
        const target = W - ship.x;
        const lag = b.phase >= 1 ? 0.09 : 0.14;
        b.x = clampBoss(b.x + (target - b.x) * lag);
        b.fire -= TICK;
        if (b.fire <= 0) {
          b.fire = b.phase >= 1 ? 700 : 950;
          fireDown(b.x, b.y + BOSS_R, 9);
          if (b.phase >= 2) { fireDown(b.x - 26, b.y + BOSS_R, 9); fireDown(b.x + 26, b.y + BOSS_R, 9); }
        }
        break;
      }
      case "warden": {
        b.x += (W / 2 - b.x) * 0.04;
        b.panelAng += (b.phase >= 2 ? 0.05 : b.phase >= 1 ? 0.04 : 0.03) * ts;
        if (b.panelAng > Math.PI * 2) b.panelAng -= Math.PI * 2;
        b.fire -= TICK;
        if (b.fire <= 0) { b.fire = 1700; fireRadial(b.x, b.y, b.phase >= 1 ? 12 : 8, 5); }
        break;
      }
      case "dreadnought": {
        b.x += b.vx * ts * 0.5;
        if (b.x < BOSS_R || b.x > W - BOSS_R) { b.vx = -b.vx; b.x = clampBoss(b.x); }
        b.t2 -= TICK;
        if (b.exposed) {
          if (b.t2 <= 0) { b.exposed = false; b.t2 = b.phase >= 2 ? 2600 : 3200; }
        } else {
          b.fire -= TICK;
          if (b.fire <= 0) { b.fire = b.phase >= 2 ? 360 : 520; fireAimed(b.x, b.y + BOSS_R, b.phase >= 1 ? 5 : 3, 0.22, 6); }
          if (b.t2 <= 0) { b.exposed = true; b.t2 = b.phase >= 2 ? 1500 : 1800; }
        }
        break;
      }
    }
  }

  /* ----- hit handling ----- */
  function hitShip() {
    const now = clockRef.current;
    if (now < invulnUntilRef.current) return;
    if (flowRef.current !== "play") return;
    const s = shipRef.current;
    if (shieldRef.current > 0) {
      shieldRef.current -= 1;
      invulnUntilRef.current = now + 1100;
      fx.current?.burst(s.x, s.y, { count: 16, color: color.cyan, speed: 150, size: 6 });
      return;
    }
    fx.current?.burst(s.x, s.y, { count: 22, color: color.danger, speed: 180, size: 7 });
    livesRef.current -= 1;
    setLives(livesRef.current);
    eboltsRef.current = [];                   // fair: clear the bullet screen on death
    if (livesRef.current <= 0) {
      flowRef.current = "gameover";
      deathCenterRef.current = { x: s.x, y: s.y };
      gameoverAtRef.current = now + GAMEOVER_MS;
      queueExplosions(s.x, s.y, 5, now);
      triggerFlash();
    } else {
      flowRef.current = "respawn";
      respawnAtRef.current = now + RESPAWN_MS;
      // Death costs your upgrades (keeps the rocket from snowballing OP); base weapon
      // scaling above keeps a reset player viable. Keep one panic bomb.
      upRef.current = { weapon: 0, drones: 0, speed: 0, magnet: false, shieldMax: 0, bombs: 1 };
      shieldRef.current = 0; spreadUntilRef.current = 0; rapidUntilRef.current = 0;
    }
  }

  function queueExplosions(x: number, y: number, n: number, now: number) {
    for (let i = 0; i < n; i++) {
      fxQueueRef.current.push({
        at: now + i * 150,
        x: x + (rnd() * 2 - 1) * 70,
        y: y + (rnd() * 2 - 1) * 70,
        big: i === n - 1,
      });
    }
  }

  function onBossDown(b: Boss) {
    const now = clockRef.current;
    const pts = 300 + stageRef.current * 80 + loopRef.current * 150;
    setScore((s) => s + pts);
    fx.current?.popScore(b.x, b.y, `+${pts}`, color.amber);
    deathCenterRef.current = { x: b.x, y: b.y };
    bossRef.current = null;
    enemiesRef.current = []; eboltsRef.current = []; minesRef.current = [];
    flowRef.current = "bossdeath";
    bossDeathAtRef.current = now + BOSSDEATH_MS;
    if (!reducedMotion) slowUntilRef.current = now + 900;
    queueExplosions(b.x, b.y, 7, now);
    bannerRef.current = null;
  }

  useEffect(() => {
    const id = setInterval(() => {
      if (phaseRef.current !== "playing") return;
      const flow = flowRef.current;
      if (flow === "choose") { bump(); return; }   // frozen for the upgrade pick

      clockRef.current += TICK;
      const now = clockRef.current;
      const ts = (!reducedMotion && now < slowUntilRef.current) ? 0.35 : 1;
      const d = absWave();
      const ship = shipRef.current;
      const boss = bossRef.current;
      const beat = flow !== "play";

      // drain the chained-explosion queue
      if (fxQueueRef.current.length) {
        const keep: { at: number; x: number; y: number; big: boolean }[] = [];
        for (const q of fxQueueRef.current) {
          if (now >= q.at) {
            fx.current?.burst(q.x, q.y, { count: q.big ? 24 : 16, color: q.big ? color.amber : color.warn, speed: q.big ? 240 : 170, size: q.big ? 9 : 6 });
            if (q.big) triggerFlash();
          } else keep.push(q);
        }
        fxQueueRef.current = keep;
      }

      // cinematic timeline transitions
      if (flow === "bossdeath" && now >= bossDeathAtRef.current) {
        flowRef.current = "stageclear";
        stageClearAtRef.current = now + STAGECLEAR_MS;
      } else if (flow === "stageclear" && now >= stageClearAtRef.current) {
        flowRef.current = "choose";
        setChoices(pickThree());
        bump();
        return;
      } else if (flow === "respawn" && now >= respawnAtRef.current) {
        ship.x = W / 2; ship.y = H * 0.78; controlRef.current = { x: ship.x, y: ship.y };
        invulnUntilRef.current = now + IFRAME_MS;
        flowRef.current = "play";
      } else if (flow === "gameover" && now >= gameoverAtRef.current) {
        phaseRef.current = "over"; setPhase("over"); bump(); return;
      }

      // ship tracking (speed upgrade => snappier)
      const follow = 0.30 + upRef.current.speed * 0.05;
      if (flowRef.current === "play") {
        ship.x += (controlRef.current.x - ship.x) * follow;
        ship.y += (controlRef.current.y - ship.y) * follow;
        ship.x = clampX(ship.x); ship.y = clampY(ship.y);
      }

      // auto-fire (only while truly playing and visible)
      if (flowRef.current === "play") {
        sinceFire.current += TICK;
        if (sinceFire.current >= fireMs(now)) { sinceFire.current = 0; doFire(now); }
      }

      // spawn normal enemies (not during beats, not on boss waves, not in the pause)
      if (!boss && !beat && toSpawnRef.current > 0 && !clearingRef.current) {
        sinceSpawn.current += TICK;
        if (sinceSpawn.current >= spawnMs(d)) { sinceSpawn.current = 0; spawnEnemy(); }
      }
      // helpful orbs (never during beats)
      if (!beat) {
        sinceOrb.current += TICK;
        if (sinceOrb.current >= 6800) { sinceOrb.current = 0; spawnOrb(); }
      }

      // player bolts up
      for (const b of boltsRef.current) { b.y -= BULLET_V * ts; b.x += b.vx * ts; }
      boltsRef.current = boltsRef.current.filter((b) => b.y > -BOLT_H && b.x > -30 && b.x < W + 30);

      // enemies move + fire
      const spd = enemySpeed(d);
      for (const e of enemiesRef.current) {
        switch (e.type) {
          case "weaver": e.phase += 0.08 * ts; e.x += (Math.sin(e.phase) * 2.4 + e.vx * 0.3) * ts; e.y += spd * 0.9 * ts; break;
          case "gunship":
            e.y += spd * 0.8 * ts; e.x += e.vx * ts;
            if (e.y > 0 && e.y < H * 0.5) { e.fire -= TICK; if (e.fire <= 0) { e.fire = 1700; fireAimed(e.x, e.y + ENEMY_R, 1, 0, 7); } }
            break;
          case "strafer": e.x += e.vx * ts; e.y += 0.25 * ts; break;
          case "shielded": e.y += spd * 0.62 * ts; e.x += e.vx * 0.5 * ts; break;
          case "splitter": e.y += spd * 0.8 * ts; e.x += e.vx * ts; break;
          case "kamikaze":
            if (!e.diving) { e.y += spd * 0.5 * ts; if (e.y > H * 0.3) { e.diving = true; e.lockX = ship.x; e.vy = spd * 1.1; } }
            else { e.vy = Math.min(e.vy + 0.35 * ts, spd * 2.4); e.x += Math.sign(e.lockX - e.x) * Math.min(2.4, Math.abs(e.lockX - e.x)) * 0.12 * ts; e.y += e.vy * ts; }
            break;
          case "sniper":
            if (e.y < e.bandY) e.y += spd * 0.7 * ts;
            else { e.x += Math.sign(ship.x - e.x) * 0.8 * ts; e.fire -= TICK; if (e.fire <= 0) { e.fire = 1500; fireAimed(e.x, e.y + ENEMY_R, 1, 0, 11); } }
            break;
          case "pod": {
            const dx = ship.x - e.x, dy = ship.y - e.y; const L = Math.hypot(dx, dy) || 1;
            const ps = 2.3 + loopRef.current * 0.3;
            e.x += (dx / L) * ps * ts; e.y += (dy / L) * ps * ts;
            break;
          }
          default: e.y += spd * ts; e.x += e.vx * ts; break; // drone
        }
        if (e.type !== "strafer" && e.type !== "pod" && (e.x < ENEMY_W / 2 || e.x > W - ENEMY_W / 2)) { e.vx = -e.vx; e.x = Math.max(ENEMY_W / 2, Math.min(W - ENEMY_W / 2, e.x)); }
      }

      // boss update
      if (boss) tickBoss(boss, now, ts);
      // ease the HP bar fill in once the boss has arrived
      if (boss && !boss.enter && bossBarFillRef.current < 1) bossBarFillRef.current = Math.min(1, bossBarFillRef.current + 0.06);

      // mines drift
      for (const m of minesRef.current) {
        m.x += m.vx * ts; m.y += m.vy * ts;
        if (m.x < MINE_R || m.x > W - MINE_R) { m.vx = -m.vx; m.x = Math.max(MINE_R, Math.min(W - MINE_R, m.x)); }
      }

      // enemy bolts
      for (const eb of eboltsRef.current) { eb.x += eb.vx * ts; eb.y += eb.vy * ts; }
      eboltsRef.current = eboltsRef.current.filter((eb) => eb.y < H + 24 && eb.y > -40 && eb.x > -24 && eb.x < W + 24);

      // player bolts -> enemies
      const deadBolts = new Set<number>();
      let gained = 0;
      for (const e of enemiesRef.current) {
        if (e.hp <= 0) continue;
        for (let bi = 0; bi < boltsRef.current.length; bi++) {
          if (deadBolts.has(bi)) continue;
          const b = boltsRef.current[bi];
          const r = e.type === "pod" ? POD_R : ENEMY_R;
          if (Math.hypot(b.x - e.x, b.y - e.y) < r + BOLT_R) {
            if (e.type === "shielded" && Math.abs(b.x - e.x) < ENEMY_R * 0.6) {
              deadBolts.add(bi);
              fx.current?.burst(b.x, b.y, { count: 4, color: color.cyan, speed: 70, size: 3 });  // blocked by the frontal plate
              break;
            }
            deadBolts.add(bi); e.hp -= b.dmg;
            fx.current?.burst(b.x, b.y, { count: 5, color: color.cyan, speed: 90, size: 4 });
            if (e.hp <= 0) {
              gained += EPTS[e.type];
              fx.current?.burst(e.x, e.y, { count: 14, color: color.amber, speed: 150, size: 6 });
              fx.current?.popScore(e.x, e.y, `+${EPTS[e.type]}`, color.amber);
              if (e.type === "splitter") spawnShards(e.x, e.y);
              else if (e.type === "pod" && e.split) { spawnPod(e.x - 16, e.y, false); spawnPod(e.x + 16, e.y, false); }
            }
            break;
          }
        }
      }
      // player bolts -> mines
      for (const m of minesRef.current) {
        if (m.hp <= 0) continue;
        for (let bi = 0; bi < boltsRef.current.length; bi++) {
          if (deadBolts.has(bi)) continue;
          const b = boltsRef.current[bi];
          if (Math.hypot(b.x - m.x, b.y - m.y) < MINE_R + BOLT_R) {
            deadBolts.add(bi); m.hp -= b.dmg;
            if (m.hp <= 0) { gained += 10; fx.current?.burst(m.x, m.y, { count: 14, color: color.amber, speed: 150, size: 6 }); }
            break;
          }
        }
      }
      // player bolts -> boss
      if (boss && !boss.enter) {
        for (let bi = 0; bi < boltsRef.current.length; bi++) {
          if (deadBolts.has(bi)) continue;
          const b = boltsRef.current[bi];
          if (Math.hypot(b.x - boss.x, b.y - boss.y) < BOSS_R + BOLT_R) {
            deadBolts.add(bi);
            if (bossTakesHit(boss, b.x, b.y)) {
              boss.hp -= b.dmg;
              fx.current?.burst(b.x, b.y, { count: 5, color: color.amber, speed: 90, size: 4 });
              if (boss.hp <= 0) { onBossDown(boss); break; }
            } else {
              fx.current?.burst(b.x, b.y, { count: 4, color: "#9AA6B2", speed: 70, size: 3 });   // blocked (armor / panel)
            }
            break;
          }
        }
      }
      if (deadBolts.size) boltsRef.current = boltsRef.current.filter((_, i) => !deadBolts.has(i));
      enemiesRef.current = enemiesRef.current.filter((e) => e.hp > 0);
      minesRef.current = minesRef.current.filter((m) => m.hp > 0);

      // escaped enemies cost a life (NO points) — strafers/pods exit harmlessly off the sides
      enemiesRef.current = enemiesRef.current.filter((e) => {
        if (e.type === "strafer") return e.x > -ENEMY_W && e.x < W + ENEMY_W;
        if (e.type === "pod") return e.y - POD_W / 2 < H && e.y > -POD_W;
        if (e.y - ENEMY_W / 2 > H) { if (!beat) hitShip(); return false; }
        return true;
      });
      minesRef.current = minesRef.current.filter((m) => m.y - MINE_R < H);

      // collisions on the ship (skipped while invulnerable or during a beat)
      if (!beat && now >= invulnUntilRef.current) {
        for (const e of enemiesRef.current) {
          const r = e.type === "pod" ? POD_R : ENEMY_R;
          if (Math.hypot(e.x - ship.x, e.y - ship.y) < r + SHIP_R) { e.hp = 0; hitShip(); break; }
        }
      }
      enemiesRef.current = enemiesRef.current.filter((e) => e.hp > 0);
      if (!beat && now >= invulnUntilRef.current) {
        for (const eb of eboltsRef.current) {
          if (Math.hypot(eb.x - ship.x, eb.y - ship.y) < EBOLT_R + SHIP_R) { hitShip(); break; }
        }
        for (const m of minesRef.current) {
          if (Math.hypot(m.x - ship.x, m.y - ship.y) < MINE_R + SHIP_R) { m.hp = 0; hitShip(); break; }
        }
        if (boss && !boss.enter && Math.hypot(boss.x - ship.x, boss.y - ship.y) < BOSS_R + SHIP_R) hitShip();
        // turret sweeping beam
        if (boss && boss.kind === "turret" && boss.beamState === 2) {
          const dirx = Math.sin(boss.sweep), diry = Math.cos(boss.sweep);
          const rx = ship.x - boss.x, ry = ship.y - boss.y;
          const proj = rx * dirx + ry * diry;
          const perp = Math.abs(rx * diry - ry * dirx);
          if (proj > 0 && perp < 18 + SHIP_R) hitShip();
        }
      }

      // orbs fall (magnet pulls them in); catching helps, missing costs nothing
      orbsRef.current = orbsRef.current.filter((o) => {
        if (upRef.current.magnet && Math.hypot(o.x - ship.x, o.y - ship.y) < 170) {
          o.x += (ship.x - o.x) * 0.12; o.y += (ship.y - o.y) * 0.12;
        } else o.y += 2.6 * ts;
        if (Math.hypot(o.x - ship.x, o.y - ship.y) < ORB_R + SHIP_R && flowRef.current === "play") {
          if (o.kind === "power") { if (upRef.current.weapon < 3) upRef.current.weapon += 1; else gained += 50; }
          else if (o.kind === "drone") { if (upRef.current.drones < 2) upRef.current.drones += 1; else gained += 50; }
          else if (o.kind === "shield") { upRef.current.shieldMax = Math.max(upRef.current.shieldMax, 1); shieldRef.current = upRef.current.shieldMax; }
          else if (o.kind === "bomb") upRef.current.bombs = Math.min(BOMB_CAP, upRef.current.bombs + 1);
          else if (o.kind === "life") { livesRef.current = Math.min(LIVES_CAP, livesRef.current + 1); setLives(livesRef.current); }
          else if (o.kind === "rapid") rapidUntilRef.current = now + 6000;
          else gained += 50;
          fx.current?.burst(o.x, o.y, { count: 14, color: ORB_META[o.kind].ring, speed: 130, size: 5 });
          fx.current?.popScore(ship.x, ship.y - SHIP_W, ORB_META[o.kind].say, ORB_META[o.kind].ring);
          return false;
        }
        return o.y - ORB_W / 2 < H;
      });

      if (gained) setScore((s) => s + gained);

      // wave-clear detection (normal waves)
      if (!boss && !beat && toSpawnRef.current <= 0 && enemiesRef.current.length === 0) {
        if (!clearingRef.current) {
          clearingRef.current = true;
          clearUntilRef.current = now + 1100;
          bannerRef.current = { text: `WAVE ${waveRef.current} CLEAR`, sub: "", warn: false, until: now + 1100 };
        }
      }
      if (clearingRef.current && now >= clearUntilRef.current && !boss) { clearingRef.current = false; advanceWave(); }

      bump();
    }, TICK);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => { controlRef.current = { x: clampX(e.nativeEvent.pageX), y: clampY(e.nativeEvent.pageY) }; },
      onPanResponderMove: (e) => { controlRef.current = { x: clampX(e.nativeEvent.pageX), y: clampY(e.nativeEvent.pageY) }; },
    })
  ).current;

  const flow = flowRef.current;
  const running = phase === "playing" && flow === "play";
  const ship = shipRef.current;
  const now = clockRef.current;
  const rapidNow = now < rapidUntilRef.current;
  const spreadNow = now < spreadUntilRef.current;
  const boss = bossRef.current;
  const banner = bannerRef.current && now < bannerRef.current.until ? bannerRef.current : null;
  const up = upRef.current;
  const invuln = now < invulnUntilRef.current;
  const shipHidden = flow === "respawn" || flow === "gameover";
  const shipBlink = invuln && Math.floor(now / 100) % 2 === 0;
  const stageName = STAGES[stageRef.current].name;

  const midline = useMemo(() => <View pointerEvents="none" style={st.midline} />, []);

  // turret beam geometry (render)
  let beam: { cx: number; cy: number; len: number; w: number; deg: number; active: boolean } | null = null;
  if (boss && boss.kind === "turret" && !boss.enter && boss.beamState >= 1) {
    const len = H;
    const dirx = Math.sin(boss.sweep), diry = Math.cos(boss.sweep);
    beam = {
      cx: boss.x + dirx * (len / 2), cy: boss.y + diry * (len / 2),
      len, w: boss.beamState === 2 ? 30 : 8, deg: (boss.sweep * 180) / Math.PI,
      active: boss.beamState === 2,
    };
  }

  return (
    <View style={st.fill}>
      <Starfield reduced={reducedMotion} />
      {midline}

      {/* turret sweeping laser */}
      {beam && (
        <View pointerEvents="none" style={{
          position: "absolute", left: beam.cx - beam.w / 2, top: beam.cy - beam.len / 2, width: beam.w, height: beam.len,
          backgroundColor: beam.active ? "rgba(255,82,71,0.55)" : "rgba(255,201,77,0.25)",
          borderRadius: beam.w / 2, transform: [{ rotate: `${beam.deg}deg` }],
        }} />
      )}

      {/* boss */}
      {boss && (
        <View pointerEvents="none" style={{ position: "absolute", left: boss.x - BOSS_DRAW[boss.kind] / 2, top: boss.y - BOSS_DRAW[boss.kind] / 2, width: BOSS_DRAW[boss.kind], height: BOSS_DRAW[boss.kind], alignItems: "center", justifyContent: "center" }}>
          {boss.kind === "warden" ? (
            <Image source={BOSS_SPRITE.warden} resizeMode="contain" fadeDuration={0}
              style={{ width: BOSS_DRAW.warden, height: BOSS_DRAW.warden, transform: [{ rotate: `${(boss.panelAng * 180) / Math.PI}deg` }] }} />
          ) : (
            <Image source={BOSS_SPRITE[boss.kind]} resizeMode="contain" fadeDuration={0} style={{ width: BOSS_DRAW[boss.kind], height: BOSS_DRAW[boss.kind] }} />
          )}
          {boss.kind === "dreadnought" && !boss.enter && (
            <View style={{ position: "absolute", width: 70, height: 70, borderRadius: 35, borderWidth: 3, borderColor: boss.exposed ? color.cyan : color.danger, opacity: boss.exposed ? 0.95 : 0.5 }} />
          )}
        </View>
      )}

      {/* enemies */}
      {enemiesRef.current.map((e, i) => {
        const sz = e.type === "pod" ? POD_W : ENEMY_W;
        const telegraph = e.type === "kamikaze" && !e.diving;
        return (
          <View key={`e${i}`} pointerEvents="none" style={{ position: "absolute", left: e.x - sz / 2, top: e.y - sz / 2, width: sz, height: sz, alignItems: "center", justifyContent: "center" }}>
            {telegraph && <View style={{ position: "absolute", width: sz + 8, height: sz + 8, borderRadius: (sz + 8) / 2, borderWidth: 2, borderColor: color.danger, opacity: 0.6 }} />}
            {e.type === "shielded" && <View style={{ position: "absolute", top: -2, width: sz, height: sz / 2, borderTopLeftRadius: sz, borderTopRightRadius: sz, borderWidth: 2, borderColor: color.cyan, borderBottomWidth: 0, opacity: 0.8 }} />}
            <Image source={ESPRITE[e.type]} resizeMode="contain" fadeDuration={0} style={{ width: sz, height: sz, opacity: e.type === "weaver" ? 0.92 : 1 }} />
          </View>
        );
      })}

      {/* mines */}
      {minesRef.current.map((m, i) => (
        <Image key={`m${i}`} source={MINE} resizeMode="contain" fadeDuration={0}
          style={{ position: "absolute", left: m.x - MINE_W / 2, top: m.y - MINE_W / 2, width: MINE_W, height: MINE_W }} />
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
        <Image key={`eb${i}`} source={EBOLT} resizeMode="contain" fadeDuration={0}
          style={{ position: "absolute", left: eb.x - EBOLT_W / 2, top: eb.y - EBOLT_W / 2, width: EBOLT_W, height: EBOLT_W }} />
      ))}

      {/* player bolts */}
      {boltsRef.current.map((b, i) => (
        <Image key={`b${i}`} source={BOLT} resizeMode="contain" fadeDuration={0}
          style={{ position: "absolute", left: b.x - BOLT_W / 2, top: b.y - BOLT_H / 2, width: BOLT_W, height: BOLT_H, opacity: b.dmg > 1 ? 1 : 0.95, transform: b.dmg > 1 ? [{ scaleX: 1.4 }] : undefined }} />
      ))}

      {/* ship */}
      {!shipHidden && (
        <View pointerEvents="none" style={{ position: "absolute", left: ship.x - SHIP_W / 2, top: ship.y - SHIP_W / 2, opacity: shipBlink ? 0.35 : 1 }}>
          {shieldRef.current > 0 && <View style={{ position: "absolute", left: -6, top: -6, width: SHIP_W + 12, height: SHIP_W + 12, borderRadius: (SHIP_W + 12) / 2, borderWidth: 2, borderColor: color.success, opacity: 0.85 }} />}
          {rapidNow && <View style={{ position: "absolute", left: -2, top: -2, width: SHIP_W + 4, height: SHIP_W + 4, borderRadius: (SHIP_W + 4) / 2, borderWidth: 2, borderColor: color.cyan, opacity: 0.7 }} />}
          {spreadNow && <View style={{ position: "absolute", left: -10, top: -10, width: SHIP_W + 20, height: SHIP_W + 20, borderRadius: (SHIP_W + 20) / 2, borderWidth: 2, borderColor: "#B98CF0", opacity: 0.6 }} />}
          <Sprite source={SHIP} size={SHIP_W} />
        </View>
      )}

      <View style={StyleSheet.absoluteFill} {...pan.panHandlers} pointerEvents={running ? "auto" : "none"} />

      <EffectsLayer ref={fx} reduced={reducedMotion} />

      {/* white flash */}
      <Animated.View pointerEvents="none" style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "#FFFFFF", opacity: flashA }} />

      {/* boss HP bar (fills in on intro) */}
      {boss && !boss.enter && (
        <View pointerEvents="none" style={st.bossBarWrap}>
          <PixelText size="label" style={{ color: color.danger, textAlign: "center", marginBottom: 3 }}>{BOSS_LABEL[boss.kind]}</PixelText>
          <View style={st.bossBar}>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: color.danger, width: `${Math.max(0, (boss.hp / boss.maxHp) * 100 * bossBarFillRef.current)}%` }} />
          </View>
        </View>
      )}

      {/* wave / boss banner */}
      {banner && (
        <View pointerEvents="none" style={st.banner}>
          <PixelText size="h2" style={{ color: banner.warn ? color.danger : color.amber, textAlign: "center", opacity: banner.warn ? (reducedMotion ? 1 : 0.5 + 0.5 * Math.abs(Math.sin(now / 160))) : 1 }}>{banner.text}</PixelText>
          {banner.sub ? <PixelText size="label" style={{ color: banner.warn ? color.warn : color.textMuted, textAlign: "center", marginTop: 4 }}>{banner.sub}</PixelText> : null}
        </View>
      )}

      {/* STAGE CLEAR tally */}
      {flow === "stageclear" && (
        <View pointerEvents="none" style={st.banner}>
          <PixelText size="h2" style={{ color: color.success, textAlign: "center" }}>STAGE CLEAR</PixelText>
          <PixelText size="label" style={{ color: color.textMuted, textAlign: "center", marginTop: 6 }}>{stageName}{loopTag()}</PixelText>
          <PixelText size="score" style={{ textAlign: "center", marginTop: 8 }}>{String(score).padStart(5, "0")}</PixelText>
        </View>
      )}

      <View style={[st.hud, { top: Math.max(insets.top, 24) + 8 }]} pointerEvents="box-none">
        <View style={st.hudPanel}>
          <PixelText size="score">{String(score).padStart(5, "0")}</PixelText>
          <PixelText size="label" style={{ marginTop: 4 }}>ST {stageRef.current + 1}/{STAGE_COUNT}{loopTag()}  LIVES {Math.max(0, lives)}</PixelText>
          <PixelText size="label" style={{ marginTop: 3, color: color.cyan }}>{WEAPON_NAME[up.weapon]}{up.drones ? ` +${up.drones}D` : ""}{up.magnet ? " +M" : ""}</PixelText>
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <IconButton label="Bomb" glyph={`✸${up.bombs}`} onPress={triggerBomb} disabled={up.bombs <= 0} />
          <IconButton label="Pause" glyph={phase === "paused" ? "▶" : "❚❚"} onPress={togglePause} />
          <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
        </View>
      </View>

      {/* between-stage upgrade: pick one of three */}
      {choices && (
        <View style={st.chooseScrim} pointerEvents="auto">
          <PixelText size="h2" style={{ color: color.amber, textAlign: "center", marginBottom: space.lg }}>CHOOSE AN UPGRADE</PixelText>
          <View style={{ gap: space.md, width: "100%", maxWidth: 420 }}>
            {choices.map((c) => (
              <Pressable key={c.id} onPress={() => onChoose(c.id)} style={({ pressed }) => [st.choiceCard, { borderColor: c.ring, opacity: pressed ? 0.75 : 1 }]}>
                <PixelText size="h2" style={{ color: c.ring }}>{c.title}</PixelText>
                <Body muted style={{ marginTop: 4 }}>{c.desc}</Body>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <GameOverlay visible={phase === "ready"} kind="pause" title="ROCKET RAID"
        primaryLabel="Launch" onPrimary={start} onExit={onExit}>
        <Body muted style={{ textAlign: "center", marginTop: space.md }}>
          Drag to fly — your ship auto-fires upward. Clear each wave to advance; every stage
          ends in a boss. Grab orbs to upgrade your weapon, drones, shield and bombs; pick an
          upgrade after each boss. Tap ✸ to bomb. Dodge fire, flank shielded foes, and thread
          the Warden's panels. Beat all 8 stages to loop harder (NG+).
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
  midline: { position: "absolute", left: 0, right: 0, top: H * 0.5, height: 2, backgroundColor: "rgba(0,229,255,0.1)" },
  hud: { position: "absolute", left: 0, right: 0, zIndex: 5, paddingHorizontal: space.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  hudPanel: { backgroundColor: "rgba(20,26,34,0.7)", borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 1, borderColor: color.surfaceLine },
  bossBarWrap: { position: "absolute", left: 30, right: 30, top: H * 0.17 + BOSS_R + 18 },
  bossBar: { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  banner: { position: "absolute", left: 0, right: 0, top: H * 0.33, alignItems: "center" },
  chooseScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(6,9,13,0.9)", alignItems: "center", justifyContent: "center", padding: space.xl, zIndex: 60 },
  choiceCard: { backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 2, padding: space.lg },
});

export const catchGame: GameModule = { id: "catch", title: "Rocket Raid", kind: "arcade", Screen: GameScreen };
