// OWNER vs SHIPPED build policy — the single source of truth for which capabilities are
// on by default, and the notes for where the public SHIPPED build will differ from the
// owner's personal build.
//
// THIS BUILD = OWNER: everything on, maximal capability (incl. online). The owner is fine
// with online access; it's on by default here.
//
// SHIPPED (public) differs, per the notes below. In short:
//   • Core identity preserved: offline by default, on-device 1.5B, no telemetry.
//   • Online capabilities DEFAULT OFF — the user opts in per capability, with a clear
//     "this leaves your phone" prompt the first time.
//   • The data-leaving ones (web fetch+summarize, reading your inbox) are harder-gated:
//     web stays HAND-OFF only (opens the browser, no query logging by us); reading the
//     inbox is DISABLED in shipped v1 (needs a deliberate provider + separate heavy opt-in).
//   • Side-effecting actions always confirm, in both builds.

import type { CapabilityId } from "./types";

// Owner (full) build by default. A consumer release passes EXPO_PUBLIC_BUILD_PROFILE=consumer,
// which Expo inlines at build time — so a shipped build can't accidentally go out with owner
// defaults (online on, inbox present). See docs/BUILDS.md.
export const OWNER_BUILD = (process.env.EXPO_PUBLIC_BUILD_PROFILE ?? "owner") !== "consumer";

export interface CapPolicy {
  online: boolean;         // leaves the device
  ownerDefault: boolean;   // enabled by default in THIS (owner) build
  shippedDefault: boolean; // enabled by default in the public shipped build
  shippedNote?: string;    // how shipped differs from owner (empty = identical)
}

export const POLICY: Record<CapabilityId, CapPolicy> = {
  // --- offline: identical in both builds ---
  set_alarm:          { online: false, ownerDefault: true, shippedDefault: true },
  set_timer:          { online: false, ownerDefault: true, shippedDefault: true },
  directions:         { online: false, ownerDefault: true, shippedDefault: true },
  share_text:         { online: false, ownerDefault: true, shippedDefault: true },
  draft_message:      { online: false, ownerDefault: true, shippedDefault: true },
  scan_text:          { online: false, ownerDefault: true, shippedDefault: true },
  pick_photo:         { online: false, ownerDefault: true, shippedDefault: true },
  read_health:        { online: false, ownerDefault: true, shippedDefault: true },
  add_reminder:       { online: false, ownerDefault: true, shippedDefault: true },
  find_contact:       { online: false, ownerDefault: true, shippedDefault: true },
  where_am_i:         { online: false, ownerDefault: true, shippedDefault: true },
  read_notifications: { online: false, ownerDefault: true, shippedDefault: true },
  translate:          { online: false, ownerDefault: true, shippedDefault: true }, // ML Kit on-device, offline

  // --- online hand-off: owner ON, shipped OFF-until-opt-in ---
  play_youtube: {
    online: true, ownerDefault: true, shippedDefault: false,
    shippedNote: "Opt-in. Deep-links into the YouTube app (hand-off, no API/keys). Off by default.",
  },
  web_search: {
    online: true, ownerDefault: true, shippedDefault: false,
    shippedNote:
      "Opt-in. SHIPPED = hand-off only: opens the browser with the query (the browser, not us, " +
      "makes the request). The owner build MAY additionally fetch+summarize; shipped must NOT " +
      "fetch/summarize without a chosen provider + its own separate opt-in.",
  },
  email_draft: {
    online: true, ownerDefault: true, shippedDefault: false,
    shippedNote: "Opt-in. mailto: draft in the user's own mail app — no stored credentials. Confirm before opening.",
  },

  // --- data leaves the device (heaviest): owner ON, shipped DISABLED in v1 ---
  read_inbox: {
    online: true, ownerDefault: true, shippedDefault: false,
    shippedNote:
      "DISABLED in shipped v1. Reads the mailbox via account access (Gmail/IMAP) — the most " +
      "sensitive capability. Before shipping: pick a provider, add a dedicated heavy opt-in with " +
      "an explicit data-flow explanation, and keep it off by default.",
  },
};

// Default-enabled state for a capability in the current build.
export function defaultEnabled(id: CapabilityId): boolean {
  const p = POLICY[id];
  return OWNER_BUILD ? p.ownerDefault : p.shippedDefault;
}

// Is this capability even present in the shipped build? (read_inbox is owner-only in v1.)
export function presentInShipped(id: CapabilityId): boolean {
  return !(id === "read_inbox"); // only the inbox-reader is held back entirely for v1
}

// Human-readable summary of how shipped differs — surfaced in notes / the owner's settings.
export function shippedDiffNotes(): string {
  return (Object.entries(POLICY) as [CapabilityId, CapPolicy][])
    .filter(([, p]) => p.shippedNote)
    .map(([id, p]) => `- ${id}: ${p.shippedNote}`)
    .join("\n");
}
