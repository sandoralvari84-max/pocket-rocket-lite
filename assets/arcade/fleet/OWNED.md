# Fleet Hunt — original art set (owned)

**Source:** generated in-repo by `tools/art/gen_fleet_art.py` (Python + Pillow).
**Licence:** original work created for Pocket Rocket. Full rights, no attribution
required, no third-party assets used. Safe to ship in a paid/closed app.
**Style:** deep-ocean Battleship look; steel vessels on a navy swell chart.
Drawn at the native 120 px cell size (no upscaling → no blur).

| File | Size | Use |
|------|------|-----|
| `water_0.png`, `water_1.png` | 120×120 | Ocean cell, two swell variants (checker by r+c) |
| `water_caustics.png` | 240×240 | Drifting light-ripple overlay (one per chart, animated) |
| `carrier.png` | 600×120 | 5-cell carrier (flat deck, amber runway, island tower) |
| `destroyer.png` | 480×120 | 4-cell destroyer (bridge, 2 funnels, 3 turrets) |
| `cruiser.png` | 360×120 | 3-cell cruiser (bridge, 1 funnel, 2 turrets) |
| `submarine.png` | 360×120 | 3-cell submarine (low dark camo hull, conning tower) |
| `patrol.png` | 240×120 | 2-cell patrol boat (cabin + single gun) |
| `ship2/3/4.png` | 240/360/480×120 | Legacy length-keyed hulls (kept for preview script) |
| `hit.png` | 120×120 | Explosion marker (fireball + debris) |
| `miss.png` | 120×120 | Splash marker (concentric ripple rings) |
| `sunk.png` | 120×120 | Burning wreck (charred hull + flame + smoke) |
| `radar_sweep.png` | 240×240 | Cyan radar wedge + range rings (rotated over enemy chart) |
| `vignette.png` | 256×256 | Transparent-centre → dark-edge table framing (stretched full screen) |

**Needs a human visual review** — generated to spec but not viewed; the new ship
types, radar sweep, caustics and vignette should be eyeballed on a real screen.

Regenerate: `python tools/art/gen_fleet_art.py`.
Preview the board layout: `python tools/art/compose_fleet_preview.py`.
