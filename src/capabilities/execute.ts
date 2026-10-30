// Capability execution. Detection (dispatch.ts) decides WHAT the user asked for; this maps
// that to a concrete, offline-first action: either an in-app screen route (reusing the app's
// own tools) or an OS hand-off via Linking (maps / SMS / mail / browser). Capabilities with
// no on-device path yet return { kind: "none" } so the caller falls back to a plain tool chip.
import { Linking } from "react-native";
import type { Matched } from "./types";
import type { FeatureRoute } from "../screens/Tools";
import { OWNER_BUILD } from "./build";

export type CapAction =
  | { kind: "route"; route: FeatureRoute }
  | { kind: "link"; url: string }
  | { kind: "none" };

const enc = encodeURIComponent;

export function capabilityAction(m: Matched): CapAction {
  // Shipped/consumer build: online hand-offs (YouTube / web search / email draft) are OFF by
  // default — the privacy promise. The owner build keeps them on. (Currency FX stays on: it's a
  // user-initiated, keyless, no-PII rate lookup.)
  if (m.online && !OWNER_BUILD) return { kind: "none" };
  switch (m.id) {
    // In-app screens (offline, no permission hand-off needed).
    case "set_timer":          return { kind: "route", route: "timer" };
    case "add_reminder":       return { kind: "route", route: "calendar" };
    case "translate":          return { kind: "route", route: "translate" };
    case "read_notifications": return { kind: "route", route: "notifs" };

    // OS hand-offs. The app opens the composer/app prefilled; the user stays in control
    // (they send the message, pick the route, run the search) — nothing fires silently.
    case "directions": {
      const d = m.slots.destination;
      return { kind: "link", url: d
        ? `https://www.google.com/maps/dir/?api=1&destination=${enc(d)}&travelmode=driving`
        : "https://www.google.com/maps" };
    }
    case "draft_message":
      return { kind: "link", url: `sms:?body=${enc(m.slots.body || "")}` };
    case "email_draft":
      return { kind: "link", url: `mailto:?body=${enc(m.slots.body || "")}` };
    case "play_youtube": {
      const q = m.slots.query;
      return { kind: "link", url: q ? `https://www.youtube.com/results?search_query=${enc(q)}` : "https://www.youtube.com" };
    }
    case "web_search": {
      const q = m.slots.query;
      return { kind: "link", url: q ? `https://www.google.com/search?q=${enc(q)}` : "https://www.google.com" };
    }

    // No on-device path yet: set_alarm (needs a native alarm intent), scan_text (OCR),
    // pick_photo, read_health, find_contact, where_am_i, read_inbox.
    default:
      return { kind: "none" };
  }
}

// Run a link action. Screen routes are run by the caller via its onOpenTool navigation.
export async function runLink(url: string): Promise<boolean> {
  try { await Linking.openURL(url); return true; } catch { return false; }
}
