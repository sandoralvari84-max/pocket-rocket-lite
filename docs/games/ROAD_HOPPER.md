# Road Hopper — overhaul design & build spec

> Frogger-style crosser. Game id `road-hopper` (`src/games/road-hopper.tsx`,
> `roadHopperGame`). Owner-approved deep overhaul 2026-10-26 ("like the shooter
> overhaul"): sprite redesign + lots of varied streets + depth + progression.

## Status / what exists (extend, don't rewrite the core)
- ~344 lines. ONE fixed road layout (7 traffic lanes), vehicles coupe/sedan/bug/
  taxi/van/truck, hopper idle+hop sprites, grass/water/road tiles, difficulty scales
  speed/count per level. `water.png` exists but there is NO river/log mechanic yet.
  Owned art `tools/art/gen_roadhopper_art.py` → `assets/arcade/roadhopper/`.

## Goal
Many different "streets" to cross, redesigned sprites, and shooter-style depth —
a daily-driver that never feels repetitive.

## Varied crossings (the headline)
Build a library of distinct crossing/lane types and compose levels from them:
- **City street** (slow mixed traffic), **Highway** (fast, dense), **River**
  (NEW — ride logs/turtles, water = death), **Railway** (trains with warning
  lights/gates), **Construction** (moving barriers, potholes), **Night** (limited
  vision; hopper glows). Each level stacks several bands of these.

## Progression
- **Themed stages** (city → river delta → rail yard → highway → construction →
  night city → …) with per-stage escalation (speed/density up, safe gaps shrink).
- **NG+ endless loop** after the campaign; optional **daily seed**.
- **Boss crossing** set-pieces at milestones (e.g. a speeding express-train
  sequence, or a flooding river that rises) — a tension spike, not an HP wall.

## Sprite redesign (owner priority)
- **Hopper (player):** redesign crisp and characterful, cohesive with the arcade
  art — keep the hopper identity (a frog/critter) but make it premium; add subtle
  cyan/amber accents so it ties to the brand. Keep idle + hop frames (+ squash +
  splash death frames).
- **Expanded vehicle roster:** add motorcycle, bus, **ambulance (flashing lights)**,
  plus river **log** and **turtle** (dives), and a **train**. Varied widths/speeds.
- **Themed tiles** per stage (road, water, rail, grass/safe, night variants).
Owned Pillow art, match existing roadhopper style, brand amber #FF9800 / cyan #00E5FF.

## Mechanics / depth
- **River section:** ride moving logs/turtles; fall in water = death; turtles
  submerge on a cycle. **Moving platforms**. **Power-ups:** time-freeze, shield
  (one free hit), hop-boost (double hop). **Collectibles/bonus:** optional pickups
  / rescue items for score. **Combo:** consecutive forward hops / fast clears chain
  a multiplier. Safe-zone rows between bands.

## Polish / animation
Hop animation, squash death, water splash, train-warning flash, stage-clear banner +
tally, combo pop, subtle juice — all honor `settings.reducedMotion`.

## Hardcore-safe
Deterministic ref-based state; fair hitboxes; readable telegraphs (warnings before
hazards); no softlocks; difficulty keeps climbing; cap entities for low-end Android.

## Build order
1. Lane-type library + stage/theme + NG+ framework (incl. the river mechanic).
2. Sprite redesign (hopper + new vehicles + tiles).
3. Power-ups + collectibles + combo.  4. Boss crossings.  5. Polish/animation.
