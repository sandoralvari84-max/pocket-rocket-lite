// Phone-capability framework. The 1.5B model is unreliable at tool-calling, so intent
// is detected DETERMINISTICALLY from the user's own words (app-side NLU) — the model only
// phrases the result. Everything runs on-device/offline; side-effecting actions are
// consent-gated. App = brain, model = mouth, phone = hands.

export type CapabilityId =
  // offline (default on in both owner + shipped builds)
  | "set_alarm"
  | "set_timer"
  | "directions"
  | "share_text"
  | "draft_message"
  | "scan_text"
  | "pick_photo"
  | "read_health"
  | "add_reminder"
  | "find_contact"
  | "where_am_i"
  | "read_notifications"
  // online, opt-in (owner build = on; shipped build = off until the user opts in)
  | "play_youtube"
  | "web_search"
  | "email_draft"
  | "read_inbox";

export type Slots = Record<string, string>;

// A deterministic match of the user's text onto one capability.
export interface Matched {
  id: CapabilityId;
  slots: Slots;
  confidence: number;      // 0..1 — strength of the deterministic match
  sideEffect: boolean;     // true => must be confirmed before executing
  permission?: string;     // consent/permission key required (undefined = none)
  label: string;           // human-readable confirm line, e.g. "Set an alarm for 7:00 AM"
  missing?: string[];      // slot names still needed (e.g. a time) before executing
  online?: boolean;        // true => leaves the device (opt-in; off by default in shipped build)
}

// What a matcher returns (sans the registry-owned fields).
export type MatchResult = Pick<Matched, "slots" | "confidence" | "label"> & {
  missing?: string[];
};

export interface Capability {
  id: CapabilityId;
  sideEffect: boolean;
  permission?: string;
  online?: boolean;        // reaches the network / leaves the device
  ownerOnly?: boolean;     // present in the owner build; gated/absent in shipped (see build.ts)
  // One-line description the model is told about, so it can *offer* the capability
  // in conversation (it never invokes it — the dispatcher does, from the user's words).
  blurb: string;
  // Deterministic matcher over the user's lowercased text. Returns null if not a match.
  match(text: string): MatchResult | null;
}
