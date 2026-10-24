// Pocket Rocket Lite — shared design tokens (single source of truth).
// Brief §A: deep charcoal/navy base, amber-orange primary, cyan secondary.
// Every screen and component reads from here. No one-off colors in screens.

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
export const font = {
  pixel: "PressStart2P_400Regular",
  // system default = undefined -> RN uses Roboto on Android
  body: undefined as string | undefined,
} as const;

// Type scale. Pixel sizes are kept small — Press Start 2P renders ~1.6x visual size.
export const type = {
  pixelTitle: { fontFamily: font.pixel, fontSize: 20, color: color.text, letterSpacing: 1 },
  pixelH2:    { fontFamily: font.pixel, fontSize: 13, color: color.text, letterSpacing: 0.5 },
  pixelLabel: { fontFamily: font.pixel, fontSize: 9, color: color.textMuted, letterSpacing: 0.5 },
  pixelScore: { fontFamily: font.pixel, fontSize: 16, color: color.amber },
  title:   { fontFamily: font.body, fontSize: 26, fontWeight: "800" as const, color: color.text },
  h2:      { fontFamily: font.body, fontSize: 18, fontWeight: "700" as const, color: color.text },
  body:    { fontFamily: font.body, fontSize: 15, fontWeight: "400" as const, color: color.text, lineHeight: 22 },
  bodyMuted: { fontFamily: font.body, fontSize: 14, fontWeight: "400" as const, color: color.textMuted, lineHeight: 20 },
  small:   { fontFamily: font.body, fontSize: 12, fontWeight: "500" as const, color: color.textMuted },
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
export const motion = {
  fast: 120, base: 200, slow: 320,
} as const;
