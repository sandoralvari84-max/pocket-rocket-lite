import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, Dimensions, Image, Animated, Easing,
  type ImageSourcePropType,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius, font, consoleUI } from "../design/tokens";
import { PixelText, Body, IconButton, GameOverlay, Sprite, Button } from "../design/ui";
import { EffectsLayer, type EffectsHandle } from "../design/effects";
import { useSettings } from "../settings";

// Owned sprite art (tools/art/gen_fleet_art.py → assets/arcade/fleet/).
const WATER_IMGS = [
  require("../../assets/arcade/fleet/water_0.png"),
  require("../../assets/arcade/fleet/water_1.png"),
];
const CAUSTICS_IMG = require("../../assets/arcade/fleet/water_caustics.png");
const RADAR_IMG = require("../../assets/arcade/fleet/radar_sweep.png");
const VIGNETTE_IMG = require("../../assets/arcade/fleet/vignette.png");
const HIT_IMG = require("../../assets/arcade/fleet/hit.png");
const MISS_IMG = require("../../assets/arcade/fleet/miss.png");
const SUNK_IMG = require("../../assets/arcade/fleet/sunk.png");

type ShipType = "carrier" | "destroyer" | "cruiser" | "submarine" | "patrol";
const SHIP_SIZE: Record<ShipType, number> = { carrier: 5, destroyer: 4, cruiser: 3, submarine: 3, patrol: 2 };
const SHIP_LABEL: Record<ShipType, string> = {
  carrier: "Carrier", destroyer: "Destroyer", cruiser: "Cruiser", submarine: "Submarine", patrol: "Patrol boat",
};
const SHIP_IMG: Record<ShipType, ImageSourcePropType> = {
  carrier: require("../../assets/arcade/fleet/carrier.png"),
  destroyer: require("../../assets/arcade/fleet/destroyer.png"),
  cruiser: require("../../assets/arcade/fleet/cruiser.png"),
  submarine: require("../../assets/arcade/fleet/submarine.png"),
  patrol: require("../../assets/arcade/fleet/patrol.png"),
};

const N = 8;
const COLS = "ABCDEFGH";
const { width: W, height: H } = Dimensions.get("window");

// Layout: the enemy TARGET chart is the clear focus (big, flat, top-down radar), and the
// player's own fleet is a small secondary minimap. V_CHROME reserves room for the header,
// message, console stats bar, the minimap/fleet-status row and the power-up tray plus safe
// areas, so a full match never scrolls — even on a ~320px-wide / short device.
const RULER = 16;
const GAP = space.sm;
const V_CHROME = 408;
const bigAvailW = W - space.lg * 2 - RULER;
const bigAvailH = H - V_CHROME;
const BIG = Math.min(bigAvailW, Math.max(180, bigAvailH)); // target grid, pixels
const BCELL = BIG / N;

const MINI = Math.max(78, Math.min(Math.round(W * 0.3), 108)); // player minimap, pixels
const MCELL = MINI / N;

interface CellState { ship: number; fired: boolean; }
type Grid = CellState[][];
interface Pos { r: number; c: number; }
interface Ship { type: ShipType; cells: Pos[]; }
interface Setup { grid: Grid; ships: Ship[]; }

function emptyGrid(): Grid {
  const g: Grid = [];
  for (let r = 0; r < N; r++) {
    const row: CellState[] = [];
    for (let c = 0; c < N; c++) row.push({ ship: -1, fired: false });
    g.push(row);
  }
  return g;
}

// Place a fleet. Random attempts first; a deterministic scan as fallback so a match
// can NEVER soft-lock on placement (guaranteed if any legal slot exists).
function placeFleet(fleet: ShipType[]): Setup {
  const grid = emptyGrid();
  const ships: Ship[] = [];
  const fits = (r: number, c: number, size: number, horiz: boolean): Pos[] | null => {
    const cells: Pos[] = [];
    for (let k = 0; k < size; k++) {
      const rr = horiz ? r : r + k;
      const cc = horiz ? c + k : c;
      if (rr >= N || cc >= N || grid[rr][cc].ship !== -1) return null;
      cells.push({ r: rr, c: cc });
    }
    return cells;
  };
  fleet.forEach((type, idx) => {
    const size = SHIP_SIZE[type];
    let cells: Pos[] | null = null;
    for (let t = 0; t < 400 && !cells; t++) {
      const horiz = Math.random() < 0.5;
      const r = Math.floor(Math.random() * (horiz ? N : N - size + 1));
      const c = Math.floor(Math.random() * (horiz ? N - size + 1 : N));
      cells = fits(r, c, size, horiz);
    }
    if (!cells) {
      outer: for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const horiz of [true, false]) {
        const f = fits(r, c, size, horiz);
        if (f) { cells = f; break outer; }
      }
    }
    if (cells) {
      cells.forEach((p) => { grid[p.r][p.c].ship = idx; });
      ships.push({ type, cells });
    } else {
      ships.push({ type, cells: [] }); // unreachable on 8x8 with these fleets
    }
  });
  return { grid, ships };
}

const shipSunk = (grid: Grid, ship: Ship): boolean => ship.cells.length > 0 && ship.cells.every((p) => grid[p.r][p.c].fired);
const allSunk = (grid: Grid, ships: Ship[]): boolean => ships.every((s) => shipSunk(grid, s));
const coordLabel = (p: Pos): string => `${COLS.charAt(p.c)}${p.r + 1}`;
const inB = (r: number, c: number): boolean => r >= 0 && r < N && c >= 0 && c < N;
const cloneGrid = (g: Grid): Grid => g.map((row) => row.map((cell) => ({ ...cell })));

// ---- Deterministic, FAIR HUNT/TARGET AI (never reads ship positions) ----
// `hits` = confirmed hit cells on the player's fleet not yet resolved into a sink.
// `skill` scales difficulty: how reliably it follows up hits and uses parity hunting.
interface AIState { hits: Pos[]; skill: number; }

function deriveTargets(hits: Pos[], grid: Grid): Pos[] {
  const untried = (r: number, c: number) => inB(r, c) && !grid[r][c].fired;
  if (hits.length === 0) return [];
  if (hits.length === 1) {
    const { r, c } = hits[0];
    return [{ r: r - 1, c }, { r: r + 1, c }, { r, c: c - 1 }, { r, c: c + 1 }].filter((p) => untried(p.r, p.c));
  }
  const sameRow = hits.every((h) => h.r === hits[0].r);
  const sameCol = hits.every((h) => h.c === hits[0].c);
  const cand: Pos[] = [];
  if (sameRow) {
    const r = hits[0].r; const cs = hits.map((h) => h.c);
    cand.push({ r, c: Math.min(...cs) - 1 }, { r, c: Math.max(...cs) + 1 });
  } else if (sameCol) {
    const c = hits[0].c; const rs = hits.map((h) => h.r);
    cand.push({ r: Math.min(...rs) - 1, c }, { r: Math.max(...rs) + 1, c });
  } else {
    for (const h of hits) cand.push({ r: h.r - 1, c: h.c }, { r: h.r + 1, c: h.c }, { r: h.r, c: h.c - 1 }, { r: h.r, c: h.c + 1 });
  }
  return cand.filter((p) => untried(p.r, p.c));
}

function chooseShot(grid: Grid, ai: AIState): Pos {
  const targets = deriveTargets(ai.hits, grid);
  // Follow up a wounded ship — but a weaker AI (low skill) sometimes fails to.
  if (targets.length > 0 && Math.random() < ai.skill) return targets[Math.floor(Math.random() * targets.length)];
  const parity: Pos[] = []; const any: Pos[] = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (!grid[r][c].fired) { any.push({ r, c }); if ((r + c) % 2 === 0) parity.push({ r, c }); }
  const useParity = parity.length > 0 && Math.random() < 0.35 + 0.65 * ai.skill;
  const pool = useParity ? parity : any;
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : { r: 0, c: 0 };
}

// ---- Fleets, modes, campaign ----
type Mode = "quick" | "campaign";
type PowerKey = "radar" | "sonar" | "airstrike" | "salvo" | "repair";
type Powerups = Record<PowerKey, number>;

const POWER_META: { key: PowerKey; glyph: string; label: string; hint: string }[] = [
  { key: "radar", glyph: "◎", label: "Radar", hint: "Reveal a 3×3 area (subs read as ?)" },
  { key: "sonar", glyph: "))", label: "Sonar", hint: "Bearing to nearest surface ship" },
  { key: "airstrike", glyph: "✈", label: "Air", hint: "Bomb a whole row" },
  { key: "salvo", glyph: "⁙", label: "Salvo", hint: "Three shots this turn" },
  { key: "repair", glyph: "✚", label: "Repair", hint: "Patch one hit on your fleet" },
];

const QUICK_FLEET: ShipType[] = ["carrier", "destroyer", "cruiser", "submarine", "patrol"];
const STAGES: { name: string; fleet: ShipType[]; skill: number }[] = [
  { name: "Coastal Patrol", fleet: ["cruiser", "patrol", "patrol"], skill: 0.35 },
  { name: "Open Water", fleet: ["destroyer", "cruiser", "submarine", "patrol"], skill: 0.5 },
  { name: "Contested Sea", fleet: ["carrier", "destroyer", "cruiser", "submarine", "patrol"], skill: 0.68 },
  { name: "Deep Blockade", fleet: ["carrier", "destroyer", "cruiser", "cruiser", "submarine", "patrol"], skill: 0.82 },
  { name: "Final Armada", fleet: ["carrier", "destroyer", "destroyer", "cruiser", "submarine", "submarine", "patrol"], skill: 0.95 },
];

function loadoutFor(mode: Mode, stage: number): Powerups {
  if (mode === "quick") return { radar: 2, sonar: 2, airstrike: 1, salvo: 1, repair: 1 };
  return {
    radar: 1 + (stage >= 2 ? 1 : 0),
    sonar: 1 + (stage >= 3 ? 1 : 0),
    airstrike: stage >= 1 ? 1 : 0,
    salvo: stage >= 2 ? 1 : 0,
    repair: stage >= 1 ? 1 : 0,
  };
}

function Screen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useSettings();
  const fxEnemy = useRef<EffectsHandle>(null);
  const fxPlayer = useRef<EffectsHandle>(null);

  const [phase, setPhase] = useState<"menu" | "playing" | "paused">("menu");
  const mode = useRef<Mode>("campaign");
  const stage = useRef(0);
  const enemySetup = useRef<Setup>(placeFleet(QUICK_FLEET));
  const playerSetup = useRef<Setup>(placeFleet(QUICK_FLEET));
  const [enemy, setEnemy] = useState<Grid>(enemySetup.current.grid);
  const [player, setPlayer] = useState<Grid>(playerSetup.current.grid);
  const [turn, setTurn] = useState<"player" | "enemy">("player");
  const [over, setOver] = useState<null | "win" | "lose">(null);
  const [msg, setMsg] = useState("Tap the enemy chart to fire.");
  const [stageLabel, setStageLabel] = useState("");
  const ai = useRef<AIState>({ hits: [], skill: 0.6 });
  const busy = useRef(false);

  // Console HUD readouts — purely informational, never touch gameplay rules.
  const [shots, setShots] = useState(0);   // player shots fired on the enemy chart
  const [hits, setHits] = useState(0);     // of those, how many struck a hull
  const [target, setTarget] = useState<Pos | null>(null); // last/locked target coordinate

  // Power-ups + armed tool + intel reveals (radar/sonar) on the enemy chart.
  const [power, setPower] = useState<Powerups>(loadoutFor("quick", 0));
  const [armed, setArmed] = useState<PowerKey | null>(null);
  const salvoLeft = useRef(0);
  const grantIdx = useRef(0);
  const [intel, setIntel] = useState<Record<string, "ship" | "sub" | "water">>({});

  // Animated decoration (all disabled under reducedMotion).
  const sweep = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  const startMatch = useCallback((m: Mode, stg: number) => {
    const fleetDef = m === "campaign" ? STAGES[stg] : { name: "Quick Match", fleet: QUICK_FLEET, skill: 0.6 };
    mode.current = m; stage.current = stg;
    enemySetup.current = placeFleet(fleetDef.fleet);
    playerSetup.current = placeFleet(fleetDef.fleet);
    setEnemy(enemySetup.current.grid);
    setPlayer(playerSetup.current.grid);
    setTurn("player");
    setOver(null);
    ai.current = { hits: [], skill: fleetDef.skill };
    busy.current = false;
    salvoLeft.current = 0;
    grantIdx.current = 0;
    setArmed(null);
    setIntel({});
    setShots(0);
    setHits(0);
    setTarget(null);
    setPower(loadoutFor(m, stg));
    setStageLabel(m === "campaign" ? `STAGE ${stg + 1}/${STAGES.length} · ${fleetDef.name}` : "QUICK MATCH");
    setMsg(`${fleetDef.fleet.length} enemy ships. Tap the enemy chart to fire.`);
    setPhase("playing");
  }, []);

  const togglePause = () => setPhase((p) => (p === "playing" ? "paused" : p === "paused" ? "playing" : p));

  // Radar sweep + water drift loops — only while actively playing and motion allowed.
  useEffect(() => {
    if (reducedMotion || phase !== "playing" || over) return;
    const s = Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 3600, easing: Easing.linear, useNativeDriver: true }));
    const d = Animated.loop(Animated.timing(drift, { toValue: 1, duration: 7000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }));
    s.start(); d.start();
    return () => { s.stop(); d.stop(); sweep.setValue(0); drift.setValue(0); };
  }, [reducedMotion, phase, over, sweep, drift]);

  // Grant the player a rotating power-up charge (deterministic order) per enemy sink.
  const grantPower = useCallback((count: number) => {
    if (count <= 0) return;
    const order: PowerKey[] = ["radar", "salvo", "sonar", "airstrike", "repair"];
    setPower((prev) => {
      const next = { ...prev };
      for (let i = 0; i < count; i++) { const k = order[grantIdx.current % order.length]; grantIdx.current++; next[k] += 1; }
      return next;
    });
  }, []);

  // Resolve a batch of player shots on the enemy chart. Returns a summary + whether it won.
  const applyPlayerShots = useCallback((cells: Pos[]): { note: string; won: boolean } => {
    const ng = cloneGrid(enemy);
    const ships = enemySetup.current.ships;
    let hitCount = 0, sunkNow = 0, firedCount = 0;
    const freshSunk: string[] = [];
    cells.forEach(({ r, c }) => {
      if (!inB(r, c) || ng[r][c].fired) return;
      ng[r][c].fired = true;
      firedCount++;
      const si = ng[r][c].ship;
      if (si >= 0) {
        hitCount++;
        fxEnemy.current?.burst((c + 0.5) * BCELL, (r + 0.5) * BCELL, { count: 16, color: "#FF5C47", speed: 160, size: 6 });
        if (shipSunk(ng, ships[si])) { sunkNow++; freshSunk.push(SHIP_LABEL[ships[si].type]); }
      } else {
        fxEnemy.current?.burst((c + 0.5) * BCELL, (r + 0.5) * BCELL, { count: 8, color: "#78D2FF", speed: 110, size: 5 });
      }
    });
    setEnemy(ng);
    // HUD counters — shots fired and hits landed (display only).
    if (firedCount > 0) setShots((s) => s + firedCount);
    if (hitCount > 0) setHits((h) => h + hitCount);
    // Clear intel dots on any cell now fired.
    setIntel((prev) => {
      const next = { ...prev };
      cells.forEach(({ r, c }) => delete next[`${r}-${c}`]);
      return next;
    });
    if (sunkNow > 0) grantPower(sunkNow);
    const won = allSunk(ng, ships);
    let note = hitCount > 0 ? `${hitCount} hit${hitCount > 1 ? "s" : ""}!` : "All misses.";
    if (freshSunk.length) note += ` Sank ${freshSunk.join(" & ")}.`;
    return { note, won };
  }, [enemy, grantPower]);

  const endPlayerTurn = useCallback((note: string, won: boolean) => {
    setArmed(null);
    salvoLeft.current = 0;
    if (won) {
      setOver("win");
      setMsg(`${note} Enemy fleet destroyed. Victory!`);
      return;
    }
    setMsg(`${note} Enemy returning fire…`);
    setTurn("enemy");
  }, []);

  // Enemy turn — deterministic hunt/target from real feedback only. Never peeks.
  useEffect(() => {
    if (turn !== "enemy" || over || phase !== "playing") return;
    let alive = true;
    busy.current = true;
    const t = setTimeout(() => {
      if (!alive) return;
      const shot = chooseShot(player, ai.current);
      const ng = cloneGrid(player);
      ng[shot.r][shot.c].fired = true;
      const si = ng[shot.r][shot.c].ship;
      let note = `Enemy fired ${coordLabel(shot)} — ${si >= 0 ? "hit!" : "miss."}`;
      if (si >= 0) {
        const ship = playerSetup.current.ships[si];
        if (shipSunk(ng, ship)) {
          note += ` They sank your ${SHIP_LABEL[ship.type].toLowerCase()}.`;
          ai.current.hits = ai.current.hits.filter((h) => !ship.cells.some((s) => s.r === h.r && s.c === h.c));
        } else {
          ai.current.hits = [...ai.current.hits, shot];
        }
        fxPlayer.current?.burst((shot.c + 0.5) * MCELL, (shot.r + 0.5) * MCELL, { count: 14, color: "#FF5C47", speed: 150, size: 6 });
      } else {
        fxPlayer.current?.burst((shot.c + 0.5) * MCELL, (shot.r + 0.5) * MCELL, { count: 8, color: "#78D2FF", speed: 110, size: 5 });
      }
      setPlayer(ng);
      if (allSunk(ng, playerSetup.current.ships)) {
        setOver("lose");
        setMsg(`${note} Your fleet is destroyed.`);
      } else {
        setMsg(`${note} Your move.`);
        setTurn("player");
      }
      busy.current = false;
    }, 460);
    return () => { alive = false; clearTimeout(t); };
  }, [turn, over, player, phase]);

  const canAct = (): boolean => !(over || turn !== "player" || busy.current || phase !== "playing");

  // ---- Enemy-chart tap: normal shot or an armed offensive power-up. ----
  const handleEnemyPress = (r: number, c: number): void => {
    if (!canAct()) return;
    setTarget({ r, c }); // lock the targeting reticle + HUD coordinate

    if (armed === "radar") {
      if (power.radar <= 0) { setArmed(null); return; }
      const reveal: Record<string, "ship" | "sub" | "water"> = {};
      for (let rr = r - 1; rr <= r + 1; rr++) for (let cc = c - 1; cc <= c + 1; cc++) {
        if (!inB(rr, cc) || enemy[rr][cc].fired) continue;
        const si = enemySetup.current.ships.findIndex((s) => s.cells.some((p) => p.r === rr && p.c === cc));
        reveal[`${rr}-${cc}`] = si >= 0 ? (enemySetup.current.ships[si].type === "submarine" ? "sub" : "ship") : "water";
      }
      setIntel((prev) => ({ ...prev, ...reveal }));
      setPower((p) => ({ ...p, radar: p.radar - 1 }));
      endPlayerTurn(`Radar scan at ${coordLabel({ r, c })}.`, false);
      return;
    }

    if (armed === "airstrike") {
      if (power.airstrike <= 0) { setArmed(null); return; }
      const row: Pos[] = [];
      for (let cc = 0; cc < N; cc++) if (!enemy[r][cc].fired) row.push({ r, c: cc });
      if (row.length === 0) { setMsg("That row is already cleared — pick another."); return; }
      setPower((p) => ({ ...p, airstrike: p.airstrike - 1 }));
      const { note, won } = applyPlayerShots(row);
      endPlayerTurn(`Airstrike on row ${r + 1} — ${note}`, won);
      return;
    }

    if (armed === "salvo") {
      if (enemy[r][c].fired) return;
      const { note, won } = applyPlayerShots([{ r, c }]);
      salvoLeft.current -= 1;
      if (won) { endPlayerTurn(note, true); return; }
      if (salvoLeft.current <= 0) { endPlayerTurn(`Salvo complete — ${note}`, false); return; }
      setMsg(`Salvo — ${note} ${salvoLeft.current} shot${salvoLeft.current > 1 ? "s" : ""} left.`);
      return;
    }

    // Normal single shot.
    if (enemy[r][c].fired) return;
    const { note, won } = applyPlayerShots([{ r, c }]);
    endPlayerTurn(`You fired ${coordLabel({ r, c })} — ${note}`, won);
  };

  // ---- Your-chart tap: only active to place a Repair. ----
  const handlePlayerPress = (r: number, c: number): void => {
    if (!canAct() || armed !== "repair") return;
    if (!(player[r][c].fired && player[r][c].ship >= 0)) { setMsg("Tap one of YOUR hit cells to patch it."); return; }
    const ng = cloneGrid(player);
    ng[r][c].fired = false;
    setPlayer(ng);
    ai.current.hits = ai.current.hits.filter((h) => !(h.r === r && h.c === c));
    setPower((p) => ({ ...p, repair: p.repair - 1 }));
    endPlayerTurn(`Repaired ${coordLabel({ r, c })}.`, false);
  };

  // ---- Sonar: instant intel on the nearest surface (non-sub) enemy ship. ----
  const fireSonar = (): void => {
    if (!canAct() || power.sonar <= 0) return;
    const surface: Pos[] = [];
    enemySetup.current.ships.forEach((s) => { if (s.type !== "submarine") s.cells.forEach((p) => { if (!enemy[p.r][p.c].fired) surface.push(p); }); });
    setPower((p) => ({ ...p, sonar: p.sonar - 1 }));
    if (surface.length === 0) { endPlayerTurn("Sonar: no surface contacts (subs run silent).", false); return; }
    const center = { r: (N - 1) / 2, c: (N - 1) / 2 };
    let best = surface[0]; let bestD = Infinity;
    surface.forEach((p) => { const dd = (p.r - center.r) ** 2 + (p.c - center.c) ** 2; if (dd < bestD) { bestD = dd; best = p; } });
    const dr = best.r - center.r, dc = best.c - center.c;
    const ns = dr < -0.5 ? "N" : dr > 0.5 ? "S" : "";
    const ew = dc < -0.5 ? "W" : dc > 0.5 ? "E" : "";
    const bearing = (ns + ew) || "centre";
    setIntel((prev) => ({ ...prev, [`${best.r}-${best.c}`]: "ship" }));
    endPlayerTurn(`Sonar: nearest surface contact bears ${bearing}.`, false);
  };

  const onPowerPress = (k: PowerKey): void => {
    if (!canAct()) return;
    if (k === "sonar") { fireSonar(); return; }
    if (power[k] <= 0) return;
    if (armed === k) { setArmed(null); salvoLeft.current = 0; setMsg("Power-up disarmed."); return; }
    setArmed(k);
    if (k === "salvo") { salvoLeft.current = 3; setMsg("Salvo armed — tap up to 3 enemy cells."); }
    else if (k === "radar") setMsg("Radar armed — tap the enemy chart to scan a 3×3 area.");
    else if (k === "airstrike") setMsg("Airstrike armed — tap a cell to bomb its row.");
    else if (k === "repair") setMsg("Repair armed — tap one of YOUR hit cells to patch it.");
  };

  // Fleet-status pips: one tick per ship, filled while afloat, hollow once sunk.
  const fleetPips = (grid: Grid, ships: Ship[], tint: string): React.ReactNode => (
    <View style={st.pips}>
      {ships.map((s, i) => (
        <View key={i} style={[st.pip, { borderColor: tint, backgroundColor: shipSunk(grid, s) ? "transparent" : tint, width: 5 + s.cells.length * 2 }]} />
      ))}
    </View>
  );

  // One chart = a flat top-down radar grid (water, grid lines, ships, markers, reticle, fx).
  // `cell`/`gridPx` size it; `showRulers` frames the big enemy chart with A–H / 1–8 labels and
  // draws the targeting reticle. The minimap renders bare (no rulers/reticle).
  const renderBoard = (
    grid: Grid, isPlayer: boolean, onPress: ((r: number, c: number) => void) | null,
    ships: Ship[], accent: string, fxRef: React.RefObject<EffectsHandle | null>, showSweep: boolean,
    cell: number, gridPx: number, showRulers: boolean, reticle: Pos | null,
  ): React.ReactNode => {
    const sunkSet = new Set<string>();
    ships.forEach((s) => { if (shipSunk(grid, s)) s.cells.forEach((p) => sunkSet.add(`${p.r}-${p.c}`)); });
    const rb = Math.max(2, Math.min(cell * 0.3, 11)); // reticle corner bracket length

    const chart = (
      <View style={[st.grid, { width: gridPx, height: gridPx, borderColor: accent }]}>
        {/* Layer 0 — ocean tiles. */}
        {grid.map((row, r) => row.map((_c, c) => (
          <View key={`w-${r}-${c}`} pointerEvents="none" style={{ position: "absolute", left: c * cell, top: r * cell }}>
            <Sprite source={WATER_IMGS[(r + c) % 2]} size={cell} />
          </View>
        )))}
        {/* Layer 0.5 — drifting caustics (one cheap animated overlay). */}
        <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: gridPx, height: gridPx }}>
          <Animated.Image
            source={CAUSTICS_IMG} resizeMode="stretch"
            style={{
              width: gridPx, height: gridPx, opacity: 0.16,
              transform: reducedMotion ? [] : [
                { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-6, 6] }) },
                { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [4, -4] }) },
              ],
            }}
          />
        </View>
        {/* Layer 1 — fire tints + tap targets (cell borders give the sonar-grid texture). */}
        {grid.map((row, r) => row.map((cellState, c) => {
          const isSunk = cellState.fired && cellState.ship >= 0 && sunkSet.has(`${r}-${c}`);
          const isHit = cellState.fired && cellState.ship >= 0 && !isSunk;
          const tint = isSunk ? "rgba(120,20,16,0.55)" : isHit ? "rgba(255,70,54,0.42)" : "transparent";
          return (
            <Pressable
              key={`${r}-${c}`}
              onPress={onPress ? () => onPress(r, c) : undefined}
              accessibilityRole={onPress ? "button" : undefined}
              accessibilityLabel={onPress ? coordLabel({ r, c }) : undefined}
              style={[st.cell, { left: c * cell, top: r * cell, width: cell, height: cell, backgroundColor: tint }]}
            />
          );
        }))}
        {/* Layer 2 — revealed ships (yours always; enemy's only once sunk). */}
        {ships.map((s, i) => {
          if (s.cells.length === 0) return null;
          const revealed = isPlayer || shipSunk(grid, s);
          if (!revealed) return null;
          const rows = s.cells.map((p) => p.r); const cols = s.cells.map((p) => p.c);
          const minR = Math.min(...rows); const minC = Math.min(...cols);
          const len = s.cells.length;
          const horizontal = s.cells.every((p) => p.r === s.cells[0].r);
          const w = len * cell; const h = cell;
          const shipStyle = horizontal
            ? { left: minC * cell, top: minR * cell, width: w, height: h }
            : { left: minC * cell + cell / 2 - w / 2, top: minR * cell + (len * cell) / 2 - h / 2, width: w, height: h, transform: [{ rotate: "90deg" }] };
          return (
            <Image key={`ship-${i}`} source={SHIP_IMG[s.type]} resizeMode="contain" style={[st.shipImg, shipStyle, !isPlayer && { opacity: 0.85 }]} />
          );
        })}
        {/* Layer 3 — intel dots from radar/sonar (enemy chart, un-fired cells). */}
        {!isPlayer && Object.entries(intel).map(([key, kind]) => {
          const [rr, cc] = key.split("-").map(Number);
          if (grid[rr][cc].fired) return null;
          const dotC = kind === "water" ? "rgba(120,210,255,0.5)" : kind === "sub" ? color.warn : color.cyan;
          return (
            <View key={`i-${key}`} pointerEvents="none" style={[st.intel, { left: cc * cell, top: rr * cell, width: cell, height: cell }]}>
              {kind === "sub"
                ? <PixelText size="label" style={{ color: dotC }}>?</PixelText>
                : <View style={{ width: cell * 0.26, height: cell * 0.26, borderRadius: 999, backgroundColor: dotC }} />}
            </View>
          );
        })}
        {/* Layer 4 — firing markers. */}
        {grid.map((row, r) => row.map((cellState, c) => {
          if (!cellState.fired) return null;
          const isSunk = cellState.ship >= 0 && sunkSet.has(`${r}-${c}`);
          const isHit = cellState.ship >= 0 && !isSunk;
          const isMiss = cellState.ship < 0;
          return (
            <View key={`mk-${r}-${c}`} pointerEvents="none" style={[st.markCell, { left: c * cell, top: r * cell, width: cell, height: cell }]}>
              {isMiss ? <Image source={MISS_IMG} resizeMode="contain" style={st.markImg} /> : null}
              {isHit ? <Image source={HIT_IMG} resizeMode="contain" style={st.markImg} /> : null}
              {isSunk ? <Image source={SUNK_IMG} resizeMode="contain" style={st.markImg} /> : null}
            </View>
          );
        }))}
        {/* Layer 5 — targeting reticle: crosshair lines + corner brackets on the locked cell. */}
        {reticle && (
          <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: gridPx, height: gridPx }}>
            <View style={{ position: "absolute", top: 0, bottom: 0, left: (reticle.c + 0.5) * cell - 0.5, width: 1, backgroundColor: "rgba(0,229,255,0.22)" }} />
            <View style={{ position: "absolute", left: 0, right: 0, top: (reticle.r + 0.5) * cell - 0.5, height: 1, backgroundColor: "rgba(0,229,255,0.22)" }} />
            <View style={{ position: "absolute", left: reticle.c * cell, top: reticle.r * cell, width: cell, height: cell }}>
              <View style={[st.ret, { top: 0, left: 0, width: rb, height: rb, borderLeftWidth: 2, borderTopWidth: 2 }]} />
              <View style={[st.ret, { top: 0, right: 0, width: rb, height: rb, borderRightWidth: 2, borderTopWidth: 2 }]} />
              <View style={[st.ret, { bottom: 0, left: 0, width: rb, height: rb, borderLeftWidth: 2, borderBottomWidth: 2 }]} />
              <View style={[st.ret, { bottom: 0, right: 0, width: rb, height: rb, borderRightWidth: 2, borderBottomWidth: 2 }]} />
            </View>
          </View>
        )}
        {/* Layer 6 — rotating radar sweep (enemy chart only). */}
        {showSweep && (
          <View pointerEvents="none" style={{ position: "absolute", left: gridPx / 2 - gridPx * 0.72, top: gridPx / 2 - gridPx * 0.72, width: gridPx * 1.44, height: gridPx * 1.44 }}>
            <Animated.Image
              source={RADAR_IMG} resizeMode="contain"
              style={{
                width: gridPx * 1.44, height: gridPx * 1.44, opacity: 0.5,
                transform: reducedMotion ? [{ rotate: "0deg" }] : [{ rotate: sweep.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }],
              }}
            />
          </View>
        )}
        {/* corner registration ticks — console framing */}
        <View pointerEvents="none" style={[st.corner, st.cornerTL, { borderColor: accent }]} />
        <View pointerEvents="none" style={[st.corner, st.cornerBR, { borderColor: accent }]} />
        <EffectsLayer ref={fxRef} reduced={reducedMotion} />
      </View>
    );

    if (!showRulers) return <View style={st.board}>{chart}</View>;

    return (
      <View style={st.board}>
        <View style={st.colRuler}>
          {COLS.split("").map((ch) => (
            <View key={ch} style={[st.rulerCell, { width: cell }]}>
              <PixelText size="label" style={{ color: color.textFaint }}>{ch}</PixelText>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row" }}>
          <View style={st.rowRuler}>
            {Array.from({ length: N }, (_, i) => (
              <View key={i} style={[st.rulerCell, { height: cell }]}>
                <PixelText size="label" style={{ color: color.textFaint }}>{String(i + 1)}</PixelText>
              </View>
            ))}
          </View>
          {chart}
        </View>
      </View>
    );
  };

  const campaignDone = mode.current === "campaign" && stage.current >= STAGES.length - 1;
  const nextLabel = over === "win" && mode.current === "campaign" && !campaignDone ? "Next stage" : over === "win" && campaignDone ? "New campaign" : "Play again";
  const onNext = () => {
    if (over === "win" && mode.current === "campaign" && !campaignDone) startMatch("campaign", stage.current + 1);
    else if (over === "win" && campaignDone) startMatch("campaign", 0);
    else startMatch(mode.current, mode.current === "campaign" ? stage.current : 0);
  };

  // HUD derived values.
  const enemyShips = enemySetup.current.ships;
  const playerShips = playerSetup.current.ships;
  const enemyAlive = enemyShips.filter((s) => !shipSunk(enemy, s)).length;
  const playerAlive = playerShips.filter((s) => !shipSunk(player, s)).length;
  const accuracy = shots > 0 ? Math.round((hits / shots) * 100) : 0;
  const turnText = over ? "—" : turn === "player" ? "YOURS" : "ENEMY";
  const turnTint = over ? color.textFaint : turn === "player" ? color.amber : color.cyan;
  const targetText = target ? coordLabel(target) : "—";

  // Console readout cell (mono numerals, pixel label).
  const Stat = ({ label, value, tint }: { label: string; value: string; tint: string }) => (
    <View style={st.statCell}>
      <Text style={st.statLabel}>{label}</Text>
      <Text style={[st.statValue, { color: tint }]} numberOfLines={1}>{value}</Text>
    </View>
  );

  return (
    <View style={st.fill}>
      <Image source={VIGNETTE_IMG} resizeMode="stretch" style={st.vignette} />

      <View style={[st.top, { paddingTop: Math.max(insets.top, 24) + 6 }]}>
        <View>
          <PixelText size="h2" style={{ color: color.amber }}>FLEET HUNT</PixelText>
          {!!stageLabel && <PixelText size="label" style={{ color: color.textFaint, marginTop: 3 }}>{stageLabel}</PixelText>}
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <IconButton label="Pause" glyph={phase === "paused" ? "▶" : "❚❚"} onPress={togglePause} />
          <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
        </View>
      </View>
      <Body style={st.msg}>{msg}</Body>

      {/* Naval console readout. */}
      <View style={st.statsBar}>
        <Stat label="TURN" value={turnText} tint={turnTint} />
        <View style={st.statDiv} />
        <Stat label="SHOTS" value={String(shots)} tint={color.text} />
        <View style={st.statDiv} />
        <Stat label="HITS" value={String(hits)} tint={color.amber} />
        <View style={st.statDiv} />
        <Stat label="ACC" value={`${accuracy}%`} tint={color.cyan} />
        <View style={st.statDiv} />
        <Stat label="TARGET" value={targetText} tint={color.cyan} />
      </View>

      <View style={st.colWrap}>
        {/* Primary focus: the big enemy target chart. */}
        <View style={st.boardWrap}>
          <View style={[st.gridHeader, { width: BIG + RULER }]}>
            <PixelText size="label" style={{ color: color.cyan }}>ENEMY WATERS</PixelText>
            <Text style={[st.afloat, { color: color.cyan }]}>{enemyAlive}/{enemyShips.length} AFLOAT</Text>
          </View>
          {renderBoard(enemy, false, handleEnemyPress, enemyShips, color.cyanDim, fxEnemy, phase === "playing" && !over, BCELL, BIG, true, target)}
        </View>

        {/* Secondary row: your fleet minimap + enemy fleet status panel. */}
        <View style={st.bottomRow}>
          <View style={st.miniCol}>
            <View style={st.miniHead}>
              <PixelText size="label" style={{ color: color.amber }}>YOUR FLEET</PixelText>
              <Text style={[st.afloat, { color: color.amber }]}>{playerAlive}/{playerShips.length}</Text>
            </View>
            {renderBoard(player, true, armed === "repair" ? handlePlayerPress : null, playerShips, color.amberDim, fxPlayer, false, MCELL, MINI, false, null)}
            <View style={{ marginTop: 4 }}>{fleetPips(player, playerShips, color.amber)}</View>
          </View>

          <View style={st.sidePanel}>
            <View style={st.sideHead}>
              <View style={[st.sideTick, { backgroundColor: color.cyan }]} />
              <PixelText size="label" style={{ color: color.cyan, letterSpacing: 1 }}>ENEMY FLEET</PixelText>
            </View>
            <View style={st.sideBody}>
              {enemyShips.map((s, i) => {
                const sunk = shipSunk(enemy, s);
                const len = s.cells.length || SHIP_SIZE[s.type];
                return (
                  <View key={i} style={st.fleetRow}>
                    <Text style={[st.fleetName, { color: sunk ? color.textFaint : color.text }]} numberOfLines={1}>
                      {SHIP_LABEL[s.type]}
                    </Text>
                    <View style={st.fleetDots}>
                      {Array.from({ length: len }, (_, k) => (
                        <View
                          key={k}
                          style={[st.fleetDot, {
                            backgroundColor: sunk ? "transparent" : color.cyan,
                            borderColor: sunk ? color.dangerDim : color.cyanDim,
                          }]}
                        />
                      ))}
                    </View>
                    <Text style={[st.fleetStat, { color: sunk ? color.danger : color.cyan }]}>
                      {sunk ? "SUNK" : "●"}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Power-up tray. */}
        <View style={st.tray}>
          {POWER_META.map((p) => {
            const n = power[p.key];
            const on = armed === p.key;
            const disabled = n <= 0 || turn !== "player" || !!over || phase !== "playing";
            return (
              <Pressable
                key={p.key}
                onPress={() => onPowerPress(p.key)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={`${p.label} power-up, ${n} left`}
                style={[st.power, on && st.powerOn, disabled && { opacity: 0.4 }]}
              >
                <PixelText size="label" style={{ color: on ? color.onAmber : color.cyan, fontSize: 11 }}>{p.glyph}</PixelText>
                <PixelText size="label" style={{ color: on ? color.onAmber : color.textMuted, fontSize: 7, marginTop: 2 }}>{p.label}</PixelText>
                <View style={[st.badge, { backgroundColor: on ? color.onAmber : color.amber }]}>
                  <PixelText size="label" style={{ color: on ? color.amber : color.onAmber, fontSize: 7 }}>{String(n)}</PixelText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Start / mode select. */}
      {phase === "menu" && (
        <View style={st.menuScrim} pointerEvents="auto">
          <View style={st.menuPanel}>
            <PixelText size="h2" style={{ color: color.amber, textAlign: "center" }}>FLEET HUNT</PixelText>
            <Body muted style={{ textAlign: "center", marginTop: space.sm }}>
              Sink the enemy fleet before they sink yours. A full tactical radar console:
              lock the target chart, read the fleet status, and spend power-ups wisely.
            </Body>
            <View style={{ gap: space.sm, marginTop: space.lg }}>
              <Button title="Campaign" onPress={() => startMatch("campaign", 0)} full />
              <Button title="Quick Match" variant="secondary" onPress={() => startMatch("quick", 0)} full />
              <Button title="Exit to menu" variant="tertiary" onPress={onExit} full />
            </View>
          </View>
        </View>
      )}

      <GameOverlay visible={phase === "paused" && !over} kind="pause" title="PAUSED" primaryLabel="Resume" onPrimary={togglePause} onExit={onExit} />

      <GameOverlay
        visible={!!over}
        kind={over === "win" ? "win" : "over"}
        title={over === "win" ? (campaignDone ? "CAMPAIGN WON" : "VICTORY") : "FLEET LOST"}
        primaryLabel={nextLabel}
        onPrimary={onNext}
        onExit={onExit}
      />
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  vignette: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined, zIndex: 1, pointerEvents: "none" },
  top: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: space.lg, paddingBottom: space.xs, zIndex: 2 },
  msg: { color: color.text, textAlign: "center", paddingHorizontal: space.lg, marginBottom: space.xs, minHeight: 32, zIndex: 2 },

  // Console stats readout bar.
  statsBar: {
    flexDirection: "row", marginHorizontal: space.lg, marginBottom: space.xs,
    backgroundColor: consoleUI.frame, borderWidth: 1, borderColor: consoleUI.frameLine,
    borderTopColor: consoleUI.deckHi, borderRadius: radius.md, overflow: "hidden", zIndex: 2,
  },
  statCell: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 6, paddingHorizontal: 2 },
  statDiv: { width: 1, backgroundColor: consoleUI.frameLine },
  statLabel: { fontFamily: font.mono, fontSize: 7.5, letterSpacing: 0.6, color: color.textFaint, marginBottom: 2 },
  statValue: { fontFamily: font.monoBold, fontSize: 13, letterSpacing: 0.3 },

  colWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: GAP, zIndex: 2 },
  boardWrap: { alignItems: "center" },

  gridHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: RULER, marginBottom: 2 },
  afloat: { fontFamily: font.monoBold, fontSize: 9, letterSpacing: 0.5 },

  pips: { flexDirection: "row", gap: 4, alignItems: "center" },
  pip: { height: 7, borderRadius: 2, borderWidth: 1.5 },

  board: { alignItems: "flex-start" },
  colRuler: { flexDirection: "row", paddingLeft: RULER, height: RULER },
  rowRuler: { width: RULER, justifyContent: "flex-start" },
  rulerCell: { alignItems: "center", justifyContent: "center" },
  grid: { position: "relative", borderWidth: 2, borderRadius: radius.sm, overflow: "hidden", backgroundColor: "#0A182E", boxShadow: "0 10px 22px rgba(0,0,0,0.5)" },
  cell: { position: "absolute", borderWidth: 0.5, borderColor: "rgba(120,180,220,0.1)", alignItems: "center", justifyContent: "center" },
  shipImg: { position: "absolute" },
  markCell: { position: "absolute", alignItems: "center", justifyContent: "center" },
  markImg: { width: "100%", height: "100%" },
  intel: { position: "absolute", alignItems: "center", justifyContent: "center" },
  ret: { position: "absolute", borderColor: color.cyan },
  corner: { position: "absolute", width: 10, height: 10, opacity: 0.7 },
  cornerTL: { top: 3, left: 3, borderLeftWidth: 2, borderTopWidth: 2 },
  cornerBR: { bottom: 3, right: 3, borderRightWidth: 2, borderBottomWidth: 2 },

  // Secondary row: minimap + enemy fleet status.
  bottomRow: { flexDirection: "row", alignItems: "flex-start", alignSelf: "stretch", paddingHorizontal: space.lg, gap: space.md },
  miniCol: { alignItems: "center" },
  miniHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", alignSelf: "stretch", marginBottom: 2 },
  sidePanel: { flex: 1, backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.surfaceLine, overflow: "hidden" },
  sideHead: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.sm, paddingVertical: 5, backgroundColor: color.surface2, borderBottomWidth: 1, borderColor: color.surfaceLine },
  sideTick: { width: 3, height: 10, borderRadius: 1 },
  sideBody: { paddingHorizontal: space.sm, paddingVertical: 4 },
  fleetRow: { flexDirection: "row", alignItems: "center", paddingVertical: 2 },
  fleetName: { flex: 1, fontFamily: font.mono, fontSize: 10, letterSpacing: 0.2 },
  fleetDots: { flexDirection: "row", gap: 2, marginHorizontal: 6 },
  fleetDot: { width: 4, height: 4, borderRadius: 1, borderWidth: 1 },
  fleetStat: { fontFamily: font.monoBold, fontSize: 8, letterSpacing: 0.4, minWidth: 28, textAlign: "right" },

  tray: { flexDirection: "row", gap: space.sm, justifyContent: "center" },
  power: { width: 56, height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: color.surfaceLine, backgroundColor: color.surface, alignItems: "center", justifyContent: "center" },
  powerOn: { borderColor: color.amber, backgroundColor: color.amber },
  badge: { position: "absolute", top: -5, right: -5, minWidth: 15, height: 15, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  menuScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(6,9,13,0.88)", alignItems: "center", justifyContent: "center", padding: space.xl, zIndex: 50 },
  menuPanel: { width: "100%", maxWidth: 360, backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 2, borderColor: color.amber, padding: space.xl },
});

export const fleetHuntGame: GameModule = {
  id: "fleet-hunt",
  title: "Fleet Hunt",
  kind: "turn-based",
  Screen,
};
