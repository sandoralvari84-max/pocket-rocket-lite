# Pocket Rocket Lite — Arcade Asset Manifest

All bundled game art is **CC0 1.0 (public domain)** by Kenney (kenney.nl). Commercial use
permitted, **no attribution required** (we credit voluntarily in About/Credits). Each pack's
original `License.txt` is kept alongside its sprites in this folder as license evidence.

| Pack | Source URL | License | Local path | PNGs | Used by |
|---|---|---|---|---|---|
| Pixel Platformer | https://kenney.nl/assets/pixel-platformer | CC0 1.0 (License.txt) | `assets/arcade/pixel-platformer/` | ~160 | maze-muncher (walls/floor/player/enemies), road-hopper (player/scenery), nibbler (tiles), dot-catcher (collectibles) |
| Pixel Shmup | https://kenney.nl/assets/pixel-shmup | CC0 1.0 (License.txt) | `assets/arcade/pixel-shmup/` | ~150 | fleet-hunt (ships/hit markers), dot-catcher (catcher/collectibles), explosion FX |
| Pixel UI Pack | https://kenney.nl/assets/pixel-ui-pack | CC0 1.0 (License.txt) | `assets/arcade/pixel-ui-pack/` | 36 | in-canvas HUD panels / 9-slice frames |

Held in staging (not bundled unless needed): `ui-pack-pixel-adventure` (514 PNGs) at
`D:\skeptic-lite-build\asset-staging\ui-pack-pixel-adventure` — CC0, add only if a game needs it.

## Sprite reference (from pack Preview.png sheets)
- **pixel-platformer** `Tiles/Characters/tile_00xx.png`: colored blob characters (green/white/pink/orange,
  helmet variants) → player avatars. `Tiles/tile_00xx.png`: terrain, coins, gems, hearts, keys, ladders,
  water, trees, enemies, vehicles. `Tiles/Backgrounds/`: sky-gradient tiles.
- **pixel-shmup** `Ships/ship_00xx.png` (0–23): top-down planes in blue/red/green/gold + grey variants
  → Fleet Hunt ships, Dot Catcher catcher. `Tiles/tile_00xx.png`: paths/terrain, bullets, pickups,
  explosion/target markers, number glyphs.
- **pixel-ui-pack** `9-Slice/Colored|Outline/*.png`: panel/button frames (tint to amber/cyan in code).

## Rendering rules
- Use `Sprite` from `src/design/ui.tsx` (RN `Image`, `resizeMode=contain`, `fadeDuration=0`).
- Keep sprite render sizes at integer-ish multiples of native tile size to stay crisp.
- Tint monochrome/outline UI frames via `tintColor` to the amber/cyan tokens rather than bundling colored copies.
- Game CANVAS = pixel art; app chrome AROUND the canvas = code-drawn with design tokens (modern).

## Provenance / integrity
Downloaded 2026-10-22 via each pack's official kenney.nl media zip link; unzipped; `License.txt`
verified to read "Creative Commons Zero, CC0 … commercial … (not a requirement)" before bundling.
Editor project folders (Construct 3 / Tiled / Vector) were excluded; only PNG sprites + License.txt bundled.
