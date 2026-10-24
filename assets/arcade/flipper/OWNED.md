# Flipper Frenzy — original art (owned)

**Source:** `tools/art/gen_flipper_art.py` (Python + Pillow). Full rights, no
third-party assets. Drawn at native 120 px (no upscaling → no blur). Skins the
EXISTING physics geometry — collision shapes are unchanged.

| File | Use |
|------|-----|
| `bumper_idle.png` | Pop-bumper (chrome ring + cyan lit core + glow) |
| `bumper_lit.png` | Bumper hit-flash state (amber-hot core + glow) |
| `ball.png` | Chrome pinball (radial sheen + highlight) |

## playfield backdrop (gen_flipper_art.py)
- `playfield.png` — decorative portrait pinball backdrop (space gradient, arched dome, centre guide rings, lane chevrons, funnel guides, starfield). Behind the live table; no physics effect.

## playfield background — AI-generated (Pollinations.ai / Flux), user-directed
`playfield.png` was regenerated via the free public Pollinations.ai endpoint (Flux
model) from an original prompt, then processed (watermark cropped, calmed, lower-third
darkened for control readability). Not hand-drawn, not third-party copyrighted art;
generated output from a free endpoint at the owner's direction. Swappable — drop in any
owned/licensed art at this path to re-theme the table.
