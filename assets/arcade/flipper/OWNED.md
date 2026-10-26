# Flipper Frenzy — original art (owned)

**Source:** `tools/art/gen_flipper_art.py` (Python + Pillow, shared `polish.py`
finish). Full rights, no third-party assets. Skins the EXISTING physics geometry —
collision shapes are unchanged. Brand amber #FF9800 / cyan #00E5FF.

| File | Use |
|------|-----|
| `bumper_idle.png` | Pop-bumper (chrome ring + cyan lit core + glow) |
| `bumper_lit.png` | Bumper hit-flash state (amber-hot core + glow) |
| `ball.png` | Chrome pinball (polished sphere, radial sheen + highlight) |
| `playfield.png` | Premium portrait playfield backdrop (owned, Pillow) |

## playfield backdrop (gen_flipper_art.py — owned, Pillow)
- `playfield.png` — premium portrait playfield composited in Pillow via the shared
  `polish.py` finish: lit top dome, rollover lane slots, pop-bumper insert nest,
  chrome habitrail ramps, drop-target bank plate, lit lock saucer, slingshot wedges,
  inlane/outlane guides, and a metal apron with a FLIPPER FRENZY wordmark (owned 5x7
  vector font, no font file).
- DECORATIVE backdrop only (no physics effect). The interactive inserts (lanes, drop
  targets, lock, ramp arrow, slingshots) are drawn LIVE as React-Native Views on top so
  they stay aligned to the physics across screen sizes.
- Swappable — drop in any owned/licensed art at this path to re-theme the table.
  (A previous revision used a Pollinations.ai/Flux background; now fully owned Pillow art.)
