---
name: pocket-rocket-game-art
description: >-
  Produce polished, original 80s/90s-arcade pixel art for Pocket Rocket games —
  sprites, animation frames, tilesets, backgrounds, UI icons and effects — using
  only verified-available tools (Python + Pillow drawing; no image generator, no
  Aseprite/Krita/ImageMagick/Godot, no emulator). Use when creating or updating
  game artwork, or when a game still uses placeholder/Kenney art and needs the
  owned retro set. Covers art direction, the Pillow production pipeline, quality
  checks, and integration into the React Native <Sprite> renderer.
---

# Pocket Rocket — Game Art

Original, owned retro arcade art for the Pocket Rocket game pack. Everything here
is drawn in-repo and fully owned (no purchase, nothing copied, no attribution).

## Tool honesty (read first)

Verify tools before relying on them; **do not assume**. Known state in this project
(re-check with the commands below if the environment changed):

- **Available:** Python 3.12 + **Pillow** (procedural drawing/validation), Node + pngjs,
  `tsc`, Expo SDK 54 + **EAS** cloud build, RN/SVG drawing in code, the user's physical
  device for on-screen checks.
- **NOT available:** any image generator (no OpenAI/image-gen wired in), Aseprite,
  LibreSprite, Krita, Inkscape, ImageMagick (`convert` on PATH is Windows' disk tool,
  not IM), Godot, Figma, Android emulator/adb/SDK.

Consequences:
- Produce art by **procedural Pillow drawing** (primitives or pixel matrices). If a task
  truly needs hand-pixeling or generated concept art, document a **manual-art workflow**
  for the user to run — never fake it.
- **In-game visual testing = an EAS APK on the user's device.** There is no local emulator.
- **Never claim** a screenshot, build, or visual test was performed unless it actually ran.
  The asset-composition preview (below) is an *asset check*, not an in-game run — label it so.

Re-verify quickly:
```bash
python -c "import PIL,sys; print('Pillow',PIL.__version__, sys.version)"
for t in aseprite libresprite krita magick inkscape adb emulator; do command -v $t || echo "$t MISSING"; done
```

## Art direction

- **Era:** cartridge-NES to early-90s arcade. Detailed, drawn sprites with personality —
  not flat geometric blocks, not slick modern console chrome.
- **Palette:** app identity is amber `#FF9800`, cyan `#00E5FF`, navy/charcoal bg
  (`#0B0F14` shell, `#090D14` game board). A game *may* use its own period palette inside
  its own screen, but keep outlines dark (`#0A0E16`/`#0E141B`) and lighting consistent
  (top-left highlight, bottom-right shadow).
- **Silhouette & scale:** one clear silhouette per entity; player and enemies size to the
  grid CELL so they read on a ~360–410px-wide phone. Keep sprite scales consistent within a
  game — **never mix integer and stretched scales**.
- **Readability:** high contrast of pickups against floor; enemies distinct from the player;
  state changes (frightened/hit) must be obvious at a glance.
- **Coherence:** across games, reuse the outline weight, highlight logic and palette so the
  pack feels like one console.

## Asset production (Pillow pipeline)

Conventions this project actually uses:
- **Format:** `RGBA` PNG with transparency. Draw at a **16px base**, upscale **×6 NEAREST**
  to 96px for pixel-crisp edges. Pickups can be smaller on the same 16px canvas.
- **Layout:** owned art lives in `assets/arcade/<game>/` (e.g. `assets/arcade/maze/`).
  Generators live in `tools/art/` and are reproducible (`python tools/art/gen_<game>.py`).
- **Rendering:** the app scales via `<Sprite source={require(...)} size={CELL} />`
  (`Image`, `resizeMode="contain"`, `fadeDuration={0}`) — so export square tiles and let
  CELL do the sizing. Nearest-neighbour source keeps it crisp when the device downscales.
- **Animation:** no sprite-sheet runtime engine — frames are **separate PNGs selected in
  render**, e.g. `ghost_rose_0/1.png`, `muncher_{closed,r,l,u,d}.png`. Drive the frame index
  off the game's existing step counter (`stepRef.current % 2`), not a new timer.

Minimal generator shape (primitives are more reliable than hand matrices for round/organic
shapes; use `ImageDraw.ellipse/pieslice/polygon/rectangle`, no anti-alias, then NEAREST ×6):
```python
from PIL import Image, ImageDraw
S, UP = 16, 6
def tile():
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0)); return img, ImageDraw.Draw(img)
def save(img, name):
    img.resize((S*UP, S*UP), Image.NEAREST).save(f"assets/arcade/<game>/{name}.png")
```
Produce, as the game needs them: player (+ directional/idle/move frames), enemies (+ frames +
frightened/hit/defeated variants), wall/floor **tileset**, **background**, pickups (+ pulse),
**UI icons** and simple effects. Keep a palette dict at the top so colours stay consistent.

## Quality checks (before integration)

- **Validate assets:** every PNG is `RGBA`, expected dimensions, has transparency where needed,
  and animation frames in a set share size/anchor. Quick check:
  ```python
  from PIL import Image
  im = Image.open(p); assert im.mode == "RGBA"; assert im.size == (96, 96)
  ```
- **Validate maze/tile layouts** with flood-fill before use (`tools/art/validate_maze.py`):
  rectangular, symmetric, and every floor cell reachable — no stranded pickups.
- **Preview sheet for human review:** build a contact sheet of all frames
  (`gen_*.py` writes one) **and** an integration composite that places the real sprites on the
  real grid at the real device CELL (`tools/art/compose_preview.py`). Open the PNG and inspect
  alignment, transparency, scale and contrast. This is an **asset check, not an in-game test.**
- **No silent damage:** never stretch pixel art to a non-integer base, never introduce mixed
  scales, and **do not bulk-replace working assets without showing the preview first**.

## Integration

1. **Inspect the target game's renderer** before choosing a format: how it draws cells/entities,
   its CELL math, and where its animation/step state lives. Match that; don't impose a new engine.
2. Swap the `require(...)` sprite constants to the owned PNGs; keep `<Sprite size={CELL}>`.
3. **Wire frames to real game states only where they exist:** idle, moving (+ facing), frightened,
   hit, defeated. Select the frame in render from existing refs — add a `facingRef` if needed, but
   don't fabricate states the game doesn't have.
4. **Keep rules separate from art.** Deterministic game logic (AI, collisions, scoring) must not
   change to accommodate sprites. Art is presentation only.
5. **Preserve the existing React Native / Expo architecture** and the full-screen game model
   (`Home.tsx` renders `GameScreen` with no app chrome). Do **not** add an outer frame or switch
   engines unless the project proves RN can't do it.
6. Record provenance in `assets/arcade/<game>/OWNED.md` (source generator, full-rights licence).
7. **Verify:** run `tsc` (PowerShell: portable Node on PATH, `node_modules\.bin\tsc.cmd --noEmit`);
   then on-device verification is an EAS build the user installs. State honestly what was and
   wasn't run.

## How to invoke

- Natural language: ask for Pocket Rocket game art, e.g. *"use the pocket-rocket-game-art skill
  to give Road Hopper an owned sprite set."* Claude loads this skill and follows the pipeline.
- Slash form: `/pocket-rocket-game-art <game-id>`.
- The skill **teaches the workflow**; it does not auto-generate the whole pack. Do one game at a
  time, preview, then integrate.

### Example — Maze Muncher (reference implementation)
```bash
# 1. produce the owned art set (already exists as the reference)
python tools/art/gen_maze_art.py
# 2. validate the layout is fully connected
python tools/art/validate_maze.py
# 3. build the integration preview and inspect it by eye
python tools/art/compose_preview.py   # -> tools/art/maze_ingame_preview.png
# 4. typecheck (PowerShell tool): node_modules\.bin\tsc.cmd --noEmit
# 5. on-device test = EAS build the user installs (no local emulator)
```
Maze Muncher under `assets/arcade/maze/` is the worked example: chomping directional muncher,
wobbling ghosts + frightened frames, neon walls, floor, pulsing orbs — copy its structure per game.
