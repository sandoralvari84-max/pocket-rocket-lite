// Single source of truth for the user-facing app identity.
// NOTE: the EAS slug ("skeptic-lite") is an internal build id and stays as-is;
// this is the brand shown to users. Keep `version` in sync with app.json.
// Bump `build` on every shared build so testers can confirm which one they have.
export const appMeta = {
  name: "Pocket Rocket Lite",
  version: "1.0.0",
  build: "2026-10-23 · chat+sprites",
} as const;
