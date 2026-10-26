# Fleet Hunt — visual overhaul + depth spec

> Battleship (dual-grid). Game id `fleet-hunt` (`src/games/fleet-hunt.tsx`,
> `fleetHuntGame`). Owner-approved 2026-10-26: visual overhaul + little mock-3D +
> real depth (variable fleets / variations), not the same static reruns.

## Status / what exists
- ~446 lines. Dual-grid (your board + enemy), a FIXED fleet randomly placed,
  hit/miss/sunk markers, water tiles, EffectsLayer. Owned art
  `tools/art/gen_fleet_art.py` → `assets/arcade/fleet/` (water_0/1, ship2/3/4,
  hit, miss, sunk). Keep deterministic turn logic; extend it.

## Goal
Make it look great and stop it feeling repetitive: mock-3D presentation + fleet/
mode variety + power-ups + a campaign with smarter AI.

## Visual overhaul
- **Little mock-3D**: give the naval-chart boards a gentle perspective (RN transform
  `[{perspective:~900},{rotateX:~14deg}]`) so they sit like charts on a table; soft
  shadows, a sea/desk background, subtle vignette. Keep taps accurate under the tilt.
- **Overhaul sprites**: nicer ships (and NEW ship types below), animated water,
  better hit (explosion) / miss (splash) / sunk art, a **radar sweep** on the enemy
  board. Owned Pillow, match existing style, amber #FF9800 / cyan #00E5FF.

## Depth / variety (no static reruns)
- **Variable fleets per match/level**: fleet composition changes — more/fewer ships,
  different sizes — across a campaign (growing enemy fleets) or randomized sets.
- **Ship types with character**: carrier (5), destroyer (4), cruiser (3), submarine
  (3, harder to detect), patrol boat (2). New sprites as needed.
- **Power-ups / special shots** (earned or metered): radar scan (reveal a small
  area), sonar ping (nearest-ship direction), salvo (multiple shots in a turn),
  airstrike (line/area), repair. Gives turns real decisions.
- **Smarter enemy AI**: proper hunt→target mode (after a hit, probe neighbors;
  parity search), difficulty scaling per campaign stage.
- **Campaign / modes**: escalating stages (bigger enemy fleets + smarter AI +
  themes); optional salvo mode (shots = surviving ships). Keep a quick single match too.

## Hardcore-safe
Deterministic ref-based state; fair AI (no peeking at the player's board); no
softlocks; difficulty climbs; cap effects for low-end Android. Honor reducedMotion.

## Build order
1. Mock-3D board presentation + sprite/water/fx overhaul + radar sweep.
2. Variable fleets + ship types + hunt/target enemy AI.
3. Power-ups/special shots + campaign stages.  4. Animation/juice polish.
