// Deterministic capability dispatch. Given the user's utterance, pick the best-matching
// capability (if any) from the registry. This runs BEFORE/alongside the model so the app,
// not the 1.5B, decides when a device capability fires — the model only phrases around it.

import { CAPABILITIES } from "./registry";
import type { Matched } from "./types";

const THRESHOLD = 0.5;

// Detect the single best capability for this utterance, or null if it's plain chat.
export function detectCapability(raw: string): Matched | null {
  const text = raw.toLowerCase().trim();
  if (!text) return null;
  let best: Matched | null = null;
  for (const cap of CAPABILITIES) {
    const m = cap.match(text);
    if (!m) continue;
    if (!best || m.confidence > best.confidence) {
      best = {
        id: cap.id,
        sideEffect: cap.sideEffect,
        permission: cap.permission,
        online: cap.online,
        slots: m.slots,
        confidence: m.confidence,
        label: m.label,
        missing: m.missing,
      };
    }
  }
  return best && best.confidence >= THRESHOLD ? best : null;
}

// The list of capability blurbs, for telling the model what the app can do (so it can
// OFFER a capability in conversation). The model never emits a call — detection is the
// app's job — but knowing the surface makes its suggestions accurate.
export function capabilitySurface(): string {
  return CAPABILITIES.map((c) => `- ${c.blurb}`).join("\n");
}

// A side-effecting, fully-resolved match must be confirmed by the user before it runs.
export function needsConfirm(m: Matched): boolean {
  return m.sideEffect && (!m.missing || m.missing.length === 0);
}
