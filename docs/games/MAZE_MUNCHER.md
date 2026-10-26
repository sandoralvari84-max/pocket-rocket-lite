# Maze Muncher — overhaul design & build spec

> Pac-Man-style muncher. Game id `maze-muncher` (`src/games/maze-muncher.tsx`,
> `mazeMuncherGame`). Owner-approved overhaul 2026-10-26. EXTEND the existing game
> — it already has a solid deterministic core; do not rewrite it.

## Status / what exists (don't rebuild)
- ~611 lines, deterministic chase AI with **scatter + frightened** phases, 4 ghosts
  (amber/lime/rose/teal, 2 frames each + fright frames), power-pellets, lives,
  directional chomping muncher, 16 autotiled wall sprites + floor variants.
- **Only 2 maze layouts** (LAYOUT_A + vertical flip) and a thin level ramp → stale.
  Owned art via `tools/art/gen_maze_art.py` + `gen_maze_tiles.py`, `assets/arcade/maze/`.

## Goal
Add levels, depth and polish; make it enjoyable and **not repetitive**, as a
daily-driver. Keep the deterministic correctness (hardcore-safe).

## Screen / game area (owner priority)
- **Maximise the playfield.** The maze should fill the available screen — compute
  CELL from the real usable width/height (minus safe-area + a slim HUD), pick the
  largest integer cell that fits the grid, and center. No big dead margins; the
  maze is the hero. Keep a compact top HUD (score/lives/level) and bottom gesture
  zone. Design maze grids to a phone-friendly aspect so they fill without stretching.

## Levels & depth
- **8 unique hand-built maze layouts** (+ mirror variants) → ~16 distinct levels
  before any repeat. Grid format already supported ('#','.','o','P',' ').
- **Themed stages** (palette + modifier set): classic → neon → ice → circuit →
  haunted → core (+ 2). Per-stage escalation: ghost speed/aggression up, fright
  time down, bonus value up.
- **NG+ endless loop** after the campaign (harder each loop) for daily play.
  Optional **daily seed** so today's run is shared/comparable.

## Ghosts — deepen the 4 personalities
- **Chaser** (direct), **Ambusher** (targets a few tiles ahead of the muncher),
  **Flanker** (pincer using the Chaser's position), **Patroller** (roams/scatters).
- Scatter↔chase cadence tightens as stages climb.
- **Hunter** (NEW) — a relentless mini-boss ghost that appears at milestone stages:
  faster, ignores scatter, short fright resistance. A tension spike that varies the
  rhythm (not a bullet-sponge; still edible when frightened, worth big points).

## Keep-it-fresh mechanics
- **Fruit / bonus items** per level (points; some grant a brief effect).
- **Power-ups**: speed dash, freeze (ghosts pause), +1 life, double-points.
- **Stage modifiers** (higher stages): **warp tunnels**, **dark maze** (limited
  sight, muncher glows), **moving gates**. Introduce gradually.
- **Bonus "rush" round** between stages (collect-'em-all, no ghosts or timed) to
  break pace.
- **Combo scoring**: chain frightened ghosts for escalating points (200→400→800→…).

## Polish / animation
- Eaten-ghost **eyes return home**; level-clear flourish + score tally; death
  animation; power-pellet pulse; combo pop; subtle screen juice. All honor
  `settings.reducedMotion`. SFX hooks where the app supports them.

## Anti-repetition = rotating layouts × per-stage modifiers × bonus rounds ×
escalating AI × the Hunter milestone.

## Art pipeline
Owned Pillow art, `tools/art/gen_maze_*.py` → `assets/arcade/maze/`. Match the
existing muncher/ghost/wall style. New art likely needed: fruit/bonus sprites,
Hunter ghost, any modifier props (gate, tunnel glow). Brand amber `#FF9800`, cyan
`#00E5FF`. Keep tiles square; autotiling already handles walls.

## Hardcore-safe
Deterministic ref-based state; no softlocks; fair ghost speeds; no passive farming;
difficulty keeps climbing. Cap entities for low-end Android.

## Build order
1. More maze layouts + the stage/theme + NG+ framework.
2. Deepen ghost personalities + the Hunter milestone.
3. Fruit/bonus + power-ups.  4. Stage modifiers + bonus round.  5. Polish/animation.
