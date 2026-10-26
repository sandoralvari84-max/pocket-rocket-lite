# Turn-based games — mock-3D presentation & polish spec

> The four turn-based games get a tactile "board on a table" look — **mock 3D, not
> full top-down** — plus each one's signature art. Owner-approved 2026-10-26.
> Games: Three-in-a-Row, Rock Paper Scissors, Four Up, Draughts.

## Shared treatment (all four)
- **Mock 3D / perspective**, not flat top-down. Use RN transforms on the board
  container: `transform: [{ perspective: ~900 }, { rotateX: ~16deg }]` so the board
  sits on a surface, with content un-skewed enough to stay readable/tappable.
  (Map touch coords back through the tilt, or keep the tilt gentle so hit areas
  still line up — verify tap accuracy.)
- A **table/surface background** behind the board (wood / felt / desk), soft
  **drop shadows** under pieces for depth, a subtle vignette. Gentle, premium.
- Honor `settings.reducedMotion` (reduce/disable the tilt animation + piece motion;
  the static tilt can stay). Keep brand amber #FF9800 / cyan #00E5FF for UI accents.
- Deterministic game logic UNCHANGED (incl. the unbeatable tic-tac-toe + Four Up AI).

## Per game
### Three-in-a-Row (tic-tac-toe)
- Look like **a sheet of paper on a table** (use existing `assets/arcade/paper` /
  `gen_paper.py`): paper texture + shadow, a **hand-drawn pencil grid**, and X/O
  drawn in **pen/pencil** (sketchy, slightly imperfect strokes — not crisp vectors).
  Tactile notebook feel. Keep the existing unbeatable AI.

### Rock Paper Scissors
- **Nice hand gestures**: proper rock (fist), paper (flat hand), scissors (two
  fingers) sprites — chunky, stylized, readable; the player's + the opponent's hands
  meet with a short **reveal** (shake → throw). New owned art via `gen_rps_art.py`.
  Mock-3D less critical here; present hands on a surface with shadows.

### Four Up (Connect Four)
- **Mock-3D board with depth**: the grid has thickness/edges, discs drop with
  perspective + shadow and a satisfying settle. Keep the token amber/cyan discs.

### Draughts (checkers)
- **Mock-3D angled checkerboard**, little polish (not a big overhaul). 3D-ish pieces
  (stacked discs; crown for kings) with soft shadows. Use existing
  `assets/arcade/draughts` king/man art; add depth/shadow + the tilt.

## Art pipeline
Owned Pillow where sprites are needed (hands for RPS; pencil marks can be drawn in
RN or as paper assets; disc/piece depth via shadows). Match existing styles. New art
needs a human visual review (agents can't see output).

## Build order
1. Shared mock-3D board container + table background + shadow system.
2. Per-game art (RPS hands, tic-tac-toe pencil, Four Up/Draughts depth).
3. Reveal/drop animations + polish. Verify tap accuracy under the tilt.
