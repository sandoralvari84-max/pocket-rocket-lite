// Pocket Rocket Lite — shared design tokens (single source of truth).
// Brief §A: deep charcoal/navy base, amber-orange primary, cyan secondary.
// Every screen and component reads from here. No one-off colors in screens.

import { Easing } from "react-native";

export const color = {
  // base / surfaces
  bg: "#0B0F14",          // app background (deep charcoal-navy)
  surface: "#141A22",     // elevated card / row
  surface2: "#1C242F",    // higher elevation / pressed
  surfaceLine: "#2A343F", // hairline borders / dividers

  // accents
  amber: "#FF9800",       // PRIMARY — primary actions, selected nav, scores, key feedback
  amberDim: "#B86B07",    // pressed/disabled amber
  amberGlowBg: "rgba(255,152,0,0.14)", // restrained glow fill
  cyan: "#00E5FF",        // SECONDARY — secondary actions, info, technical detail
  cyanDim: "#0597A8",
  cyanGlowBg: "rgba(0,229,255,0.12)",

  // text
  text: "#F3EFE6",        // high-contrast warm white
  textMuted: "#9AA6B2",   // muted cool grey (secondary text)
  textFaint: "#5E6975",   // tertiary / placeholder

  // semantic
  danger: "#FF5247",      // destructive
  dangerDim: "#B83229",
  success: "#5BD16B",     // correct / win
  warn: "#FFC94D",

  // on-accent text
  onAmber: "#0B0F14",     // text drawn on amber fills
  onCyan: "#0B0F14",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;

// Pixel font (Press Start 2P) for arcade accents: titles, scores, HUD numerals.
// Body/UI text uses the platform system font (brief: modern typography AROUND the canvas).
// Console typography (matches the approved mockup): Chakra Petch = UI/body, JetBrains
// Mono = technical labels/status/meta, VT323 = the CRT screen phrase, Press Start 2P =
// arcade pixel accents. Custom families don't honour fontWeight on Android, so bold is
// its own family. Applied here so EVERY page inherits the look.
export const font = {
  pixel: "PressStart2P_400Regular",
  body: "ChakraPetch_500Medium",
  bodyBold: "ChakraPetch_700Bold",
  mono: "JetBrainsMono_400Regular",
  monoBold: "JetBrainsMono_700Bold",
  crt: "VT323_400Regular",
} as const;

// Type scale. Pixel sizes are kept small — Press Start 2P renders ~1.6x visual size.
export const type = {
  pixelTitle: { fontFamily: font.pixel, fontSize: 20, color: color.text, letterSpacing: 1 },
  pixelH2:    { fontFamily: font.pixel, fontSize: 13, color: color.text, letterSpacing: 0.5 },
  pixelLabel: { fontFamily: font.pixel, fontSize: 9, color: color.textMuted, letterSpacing: 0.5 },
  pixelScore: { fontFamily: font.pixel, fontSize: 16, color: color.amber },
  title:   { fontFamily: font.bodyBold, fontSize: 26, color: color.text, letterSpacing: 0.3 },
  h2:      { fontFamily: font.bodyBold, fontSize: 18, color: color.text, letterSpacing: 0.2 },
  body:    { fontFamily: font.body, fontSize: 15, color: color.text, lineHeight: 22 },
  bodyMuted: { fontFamily: font.body, fontSize: 14, color: color.textMuted, lineHeight: 20 },
  small:   { fontFamily: font.mono, fontSize: 11.5, color: color.textMuted, letterSpacing: 0.3 },
} as const;

// Restrained elevation (brief §A/I: avoid heavy shadows on low-end devices).
export const elevation = {
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.surfaceLine,
  },
} as const;

// Minimum comfortable touch target (brief §I).
export const HIT = 48;

// CRT-console surfaces (CRT_CONSOLE_DESIGN.md): the physical control-deck + display frame.
// Reused so every screen reads as one machine, not separate dark pages.
export const consoleUI = {
  deckBg: "#141A22",       // control-deck housing
  deckRail: "#2E3A49",     // top lip / structural edge
  deckHi: "#39485A",       // thin highlight on the lip
  keyBg: "#1C242F",        // raised key cap
  keyBorder: "#2E3A49",
  keyPressed: "#10151C",   // depressed cap
  ledOff: "#3A4654",       // unlit indicator
  frame: "#1A222C",        // display bezel
  frameLine: "#303E4E",
} as const;

// Motion tokens — deliberate, restrained (honor reduced motion at call sites).
// Semantic durations from CRT_CONSOLE_DESIGN.md nav-motion brief (ms); tune on-device.
export const motion = {
  fast: 120, base: 200, slow: 320,
  press: 130,      // tactile key / button feedback (brief 100–160)
  nav: 240,        // standard destination change (200–280)
  immersive: 400,  // entering an immersive display e.g. Arcade (300–450)
  back: 260,       // returning from immersive (200–300)
} as const;

// Shared easing curves — restrained ease-out entering, ease-in leaving (no bounce/spring).
export const ease = {
  out: Easing.bezier(0.16, 0.84, 0.3, 1),
  in: Easing.bezier(0.5, 0, 0.84, 0.3),
  inOut: Easing.inOut(Easing.cubic),
} as const;

// CRT display treatment — kept LOW intensity (brief: must not reduce contrast or block touch).
export const crt = {
  scanlineOpacity: 0.06,         // fine scanline overlay
  bezelRadius: radius.lg,
  vignette: "rgba(0,0,0,0.45)",  // inner edge darkening
  phosphorHi: "rgba(255,255,255,0.06)", // top gloss highlight
} as const;

// Colored glow presets — New Arch (RN 0.81) boxShadow. Applied via style={{ boxShadow: glow.x }}.
export const glow = {
  amber: "0 0 16px rgba(255,152,0,0.35)",
  amberSoft: "0 0 12px rgba(255,152,0,0.16)",
  cyan: "0 0 16px rgba(0,229,255,0.35)",
  cyanSoft: "0 0 12px rgba(0,229,255,0.16)",
} as const;

// Interactive control states (pressed / focused / disabled). Reused across buttons & nav keys.
export const state = {
  pressedOpacity: 0.72,
  disabledOpacity: 0.4,
  focusRingWidth: 2,
} as const;

// Active accent follows the chosen persona (Sentinel = amber, Nova = cyan) so the whole
// app recolors when the user swaps assistant. Read with the live settings.voice.
export const accentFor = (voice?: string) =>
  voice === "nova"
    ? { c: color.cyan, dim: color.cyanDim, bg: color.cyanGlowBg }
    : { c: color.amber, dim: color.amberDim, bg: color.amberGlowBg };
