# Pocket Rocket Lite — Unified CRT Console Design System & Navigation Motion

> Owner-authored design direction (2026-10-24). A phased IMPLEMENTATION task, not a
> one-shot visual. Inspect existing UI/nav first; implement incrementally; verify the
> real rendered app; preserve working screens and strong existing work. Extends the
> existing Pocket Rocket identity — do not restart.

## Mission
Elevate the app into one cohesive, premium retro-futuristic **console** — "one machine,
many capabilities." Operating different functions should feel like operating one
device, not opening unrelated screens in a generic dark app. Inspired by classic arcade
cabinets, CRT displays, 1990s electronics and modern industrial design.

## 1. One shared visual design system
Palette (foundation, use purposefully for state/hierarchy — not to decorate everything):
- Near-black charcoal = primary environment.
- Amber `#FF9800` = primary actions / energy.
- Cyan `#00E5FF` = secondary highlights / signal.
- Dark slate `#2A2A2E` = panels / structural surfaces.
- Warm off-white = readable primary text.

Design language: premium industrial console construction + restrained CRT display
treatments (subtle glass/phosphor/scanlines at LOW intensity) + strong typography &
clear hierarchy + tactile buttons/knobs/controls + crisp legible icons w/ meaningful
active states + layered depth/light/shadow. Sophisticated and deliberate — NOT a noisy
retro-game parody.

Avoid: excessive glow, thick outlines on every component, constant flicker, dense
decorative grids, fake circuitry everywhere, illegible pixel fonts, gratuitous
animation. Pixel type is for branding / small decorative labels only; body/menus/
settings must stay highly readable.

Consolidate reusable TOKENS for: color + semantic states; typography + hierarchy;
spacing/layout; radii + panel construction; borders/shadows/glow; icon sizing + touch
targets; animation durations + easing; CRT effects + display framing; button/nav/control
states. Build reusable COMPONENTS for: CRT display frame; console panel + section
header; primary/secondary buttons; tactile nav keys; knob-style controls (only where
genuinely appropriate); active/pressed/focused/disabled/loading states; screen +
immersive display transitions. Reuse existing good components; don't make near-duplicate
variants.

## 2. Interface built around a coherent CRT console (display + control deck = one device)
**Main display area:** premium CRT feel without hurting usability — clear display
boundary, subtle depth + controlled highlights, optional fine scanlines/phosphor at low
intensity, restrained amber/cyan accents, stable readable layouts, smooth content
changes (no visible jumping). CRT effects must NOT reduce contrast, obscure text or
interfere with touch. Shared framing, but content layout suits each task — don't make
every screen look like a game.

**Physical-feeling control deck (lower nav):** an integrated console control panel in
the established identity. Controls may resemble illuminated hardware keys / selector
switches / knobs but must remain real, accessible, obvious interactive elements.

*(Owner's paste was truncated after "Provide"; navigation-motion specifics to be
confirmed — likely: tactile key feedback, selected-state lighting, and deliberate
screen/display transitions.)*

## How we'll apply it (phased, evidence-based)
1. Audit current tokens/components/nav (src/design/tokens.ts, src/design/ui.tsx,
   Home deck, screens) — classify what already fits.
2. Consolidate/extend tokens (CRT effect tokens, motion tokens, control states).
3. Build the shared CRT display-frame + console-panel + tactile-nav components.
4. Apply incrementally per screen, verifying the real render each step; keep behaviour,
   routes, data, model integration, accessibility and game functionality intact.
5. Keep performance good on modest Android; respect reduced-motion.

See also docs/PRODUCT_BRIEF.md (evidence-based standard) and the Mission Bay home
(already a strong, on-brand console-style screen to build the system around).
