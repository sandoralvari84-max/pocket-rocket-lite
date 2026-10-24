# Fleet Hunt — original art set (owned)

**Source:** generated in-repo by `tools/art/gen_fleet_art.py` (Python + Pillow).
**Licence:** original work created for Pocket Rocket. Full rights, no attribution
required, no third-party assets used. Safe to ship in a paid/closed app.
**Style:** deep-ocean Battleship look; steel vessels on a navy swell chart.
Drawn at the native 120 px cell size (no upscaling → no blur).

| File | Size | Use |
|------|------|-----|
| `water_0.png`, `water_1.png` | 120×120 | Ocean cell, two swell variants (checker by r+c) |
| `ship4.png` | 480×120 | 4-cell flagship (4 turrets) |
| `ship3.png` | 360×120 | 3-cell cruiser (hull, bridge, funnel, 3 turrets) |
| `ship2.png` | 240×120 | 2-cell destroyer |
| `hit.png` | 120×120 | Explosion marker (fireball + debris) |
| `miss.png` | 120×120 | Splash marker (concentric ripple rings) |
| `sunk.png` | 120×120 | Burning wreck (charred hull + flame + smoke) |

Regenerate: `python tools/art/gen_fleet_art.py`.
Preview the board layout: `python tools/art/compose_fleet_preview.py`.
