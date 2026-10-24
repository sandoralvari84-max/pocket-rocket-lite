# Maze Muncher — original art set (owned)

**Source:** generated in-repo by `tools/art/gen_maze_art.py` (Python + Pillow).
**Licence:** original work created for Pocket Rocket. Full rights, no attribution
required, no third-party assets used. Safe to ship in a paid/closed app.
**Style:** cartridge-era arcade, on the app palette (amber #FF9800 / cyan #00E5FF /
navy). Drawn at 16px, exported ×6 (96px) nearest-neighbour for pixel-crisp scaling.

| File | Use |
|------|-----|
| `muncher_closed.png`, `muncher_{r,l,u,d}.png` | Player; chomp = alternate closed/open, open frame faces travel direction |
| `ghost_{rose,teal,lime,amber}_{0,1}.png` | Enemies; two-frame skirt wobble, colour per enemy index |
| `ghost_fright_{0,1}.png` | Frightened state (blue, white mouth, no eyes) |
| `wall.png` | Maze wall tile (navy + cyan bevel) |
| `floor.png` | Corridor/background tile |
| `pellet.png` | Standard pellet |
| `power_{0,1}.png` | Power-pellet, two-frame pulse |

Regenerate: `python tools/art/gen_maze_art.py`. Layout is validated for full
connectivity by `tools/art/validate_maze.py` before use.
