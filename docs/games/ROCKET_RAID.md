# Rocket Raid — design & build spec

> Vertical space shooter (evolved from "Dot Catcher"). Game id stays `catch`
> (`src/games/catch.tsx`, `catchGame`); **display title = "Rocket Raid"**.
> Owner-approved concept 2026-10-26. This doc is the spec to BUILD against later —
> the deep progression/boss/upgrade/animation systems are NOT built yet.

## Status
- ✅ **Player ship art** — re-skinned to the Pocket Rocket *feel*: amber chrome
  rocket-fighter, cyan porthole cockpit, twin flames, nose-up. Source:
  `tools/art/gen_catch_art.py` `ship()`; output `assets/arcade/catch/ship.png`.
  Doubles as the arcade icon for this game (parked: wire into the arcade icon set).
- ✅ **Core loop exists** — `catch.tsx` already has deterministic waves, boss every
  5th wave, enemies (drone/weaver/gunship), orb pickups, parallax stars, capped
  difficulty curves. Deterministic ref-based state = hardcore-safe foundation.
- ⬜ Everything below (stages, 8 bosses, enemy variety, upgrade tree, animation
  beats) is DESIGNED, not implemented.

## Vision (owner)
A daily-driver shmup you can have fun with every day. Deep progression, many
distinct bosses, enemy variety, upgrades. Built for hardcore players — **not
easily breakable** (no score exploits, fair hitboxes, difficulty keeps climbing).
Real **animation beats** for level progression, boss kill, and death — no instant
"play again".

## Progression
- **Stages, not just endless waves.** Themed stages: deep space → asteroid belt →
  enemy fleet → the hive → the dreadnought. Each stage = several waves ending in
  its own boss.
- **NG+ loop:** after the final stage, loop harder (NG+1, NG+2…) — endless for
  hardcore runs but structured. Keep difficulty climbing so it never trivializes.
- Optional **daily seed** so "today's run" is shared/comparable.

## Bosses (8 — distinct patterns, phased; not just more HP)
1. **Carrier** — spawns drones, lazy 3-way spreads.
2. **Interceptor** — fast strafing, aimed bursts, dashes.
3. **Turret Wall** — sweeping laser you dodge.
4. **Hive** — homing swarm + splitting pods.
5. **Dreadnought** — multi-phase finale (core exposes between barrages).
6. **Minelayer** — seeds drifting mines, zones off the arena.
7. **Mirror** — copies the player's movement; punishes lazy dodging (skill check).
8. **Warden** — rotating shield panels; thread the gaps to hit the core.
Spread variety across the climb so meeting them all stays fun, not an HP grind.

## Enemies (current 3 + add)
Have: drone (hp1), weaver (hp2 sine), gunship (hp3 shoots).
Add: **strafer**, **minelayer-grunt**, **shielded** (flank it), **splitter**
(dies into two), **kamikaze**, **sniper**. Each a distinct, readable threat.

## Upgrades (collected mid-run; between-stage pick-one-of-three)
Weapon tiers **single → twin → spread → laser**; **side-drones (options)**;
**shield**; **bomb** (limited); speed; pickup magnet. Build-crafting = replay value.

## Hardcore-safe rules
- Deterministic ref core (keep it). No passive score farming (off-screen enemies
  give no points). Limited bombs. Small fair ship hitbox (`SHIP_R` vs `SHIP_W`) +
  brief i-frames on hit. Difficulty curve keeps scaling. No softlocks.

## Animation beats (required — no instant replay)
- **Boss intro:** "WARNING" + boss slides in, health bar fills.
- **Boss kill:** chained explosions → brief slow-mo → flash → debris → **STAGE
  CLEAR** tally.
- **Death:** ship bursts, short beat, respawn with i-frames; on last life a proper
  game-over sequence before the replay prompt.
- Use existing `EffectsLayer` (burst/popScore) + RN `Animated`.

## Art pipeline
Owned Pillow art, `tools/art/gen_catch_*.py` → `assets/arcade/catch/`. Smooth
chrome-nostalgia style via `polish.py` P helpers (poly_grad/sphere/gloss/glow/spec)
— match the existing drone/gunship/ship. Brand amber `#FF9800`, cyan `#00E5FF`.

## Build order (when we return)
1. Stage/boss framework in `catch.tsx` (stages, boss slot per stage, NG+).
2. Boss art (8) + patterns.  3. Enemy variety.  4. Upgrade system.  5. Animation beats.
