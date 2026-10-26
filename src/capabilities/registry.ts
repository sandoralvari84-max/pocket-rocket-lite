// The capability registry. Each matcher reads the USER's words deterministically and
// returns slots + a confidence. No model involvement in detection — that is what makes
// capability triggering reliable on a 1.5B. Execution (the native/offline side) lives in
// per-capability modules wired as their deps land; this file owns detection + intent.

import type { Capability, Slots } from "./types";

// ---- shared helpers -------------------------------------------------------
function to12h(h: number, m: number): string {
  const mer = h < 12 ? "AM" : "PM";
  let hh = h % 12; if (hh === 0) hh = 12;
  return `${hh}:${String(m).padStart(2, "0")} ${mer}`;
}

// Parse a clock time out of free text: "7", "7:30", "7am", "7:30 pm", "19:00",
// "half 7" (=7:30), "quarter past 8" (=8:15), "quarter to 9" (=8:45). Returns 24h {h,m}.
export function parseTime(t: string): { h: number; m: number } | null {
  let mm = t.match(/\b(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?\b/);
  if (mm) {
    let h = +mm[1]; const m = +mm[2]; const mer = mm[3]?.replace(/\./g, "");
    if (mer === "pm" && h < 12) h += 12; if (mer === "am" && h === 12) h = 0;
    if (h < 24 && m < 60) return { h, m };
  }
  mm = t.match(/\bhalf\s*(?:past\s*)?(\d{1,2})\b/);
  if (mm) return { h: +mm[1] % 24, m: 30 };
  mm = t.match(/\bquarter\s*(past|to)\s*(\d{1,2})\b/);
  if (mm) {
    const base = +mm[2];
    return mm[1] === "to" ? { h: (base + 23) % 24, m: 45 } : { h: base % 24, m: 15 };
  }
  mm = t.match(/\b(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)\b/);
  if (mm) {
    let h = +mm[1]; const mer = mm[2].replace(/\./g, "");
    if (mer === "pm" && h < 12) h += 12; if (mer === "am" && h === 12) h = 0;
    if (h < 24) return { h, m: 0 };
  }
  return null;
}

// Parse a duration: "5 minutes", "90 seconds", "1 hour 30", "an hour", "half an hour".
export function parseDuration(t: string): number | null {
  if (/\bhalf an hour\b/.test(t)) return 1800;
  if (/\ban hour\b/.test(t) && !/\d/.test(t)) return 3600;
  let total = 0, found = false;
  const h = t.match(/(\d+)\s*(?:h|hr|hrs|hour|hours)\b/); if (h) { total += +h[1] * 3600; found = true; }
  const m = t.match(/(\d+)\s*(?:m|min|mins|minute|minutes)\b/); if (m) { total += +m[1] * 60; found = true; }
  const s = t.match(/(\d+)\s*(?:s|sec|secs|second|seconds)\b/); if (s) { total += +s[1]; found = true; }
  return found ? total : null;
}

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function fmtDur(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return [h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(" ") || "0s";
}

// ---- the registry ---------------------------------------------------------
export const CAPABILITIES: Capability[] = [
  {
    id: "set_alarm", sideEffect: true, permission: "alarm",
    blurb: "set an alarm at a time",
    match(t) {
      if (!/\b(alarm|wake me|wake up)\b/.test(t)) return null;
      const tm = parseTime(t);
      const slots: Slots = {};
      if (tm) slots.time = `${tm.h}:${String(tm.m).padStart(2, "0")}`;
      return tm
        ? { slots, confidence: 0.92, label: `Set an alarm for ${to12h(tm.h, tm.m)}` }
        : { slots, confidence: 0.6, label: "Set an alarm", missing: ["time"] };
    },
  },
  {
    id: "set_timer", sideEffect: true, permission: "alarm",
    blurb: "start a countdown timer",
    match(t) {
      if (!/\btimer\b/.test(t) && !/\b(count ?down|remind me in)\b/.test(t)) return null;
      const d = parseDuration(t);
      const slots: Slots = {};
      if (d) slots.seconds = String(d);
      return d
        ? { slots, confidence: 0.9, label: `Start a ${fmtDur(d)} timer` }
        : { slots, confidence: 0.6, label: "Start a timer", missing: ["duration"] };
    },
  },
  {
    id: "directions", sideEffect: false,
    blurb: "get directions / navigate to a place",
    match(t) {
      const m = t.match(/\b(?:directions?|navigate|route|take me|how do i get|drive)\s+(?:to\s+)?(.+)/);
      if (!m) return null;
      const dest = m[1].replace(/[?.!]+$/, "").trim();
      const slots: Slots = {};
      if (dest) slots.destination = dest;
      return dest
        ? { slots, confidence: 0.85, label: `Directions to ${dest}` }
        : { slots, confidence: 0.55, label: "Get directions", missing: ["destination"] };
    },
  },
  {
    id: "scan_text", sideEffect: false, permission: "camera",
    blurb: "scan/read text from a photo or the camera (OCR)",
    match(t) {
      if (/\b(scan|read|ocr|extract)\b.*\b(text|photo|picture|document|receipt|page|label|sign)\b/.test(t)) {
        return { slots: {}, confidence: 0.85, label: "Scan text with the camera" };
      }
      return null;
    },
  },
  {
    id: "pick_photo", sideEffect: false, permission: "photos",
    blurb: "open the photo library / pick a picture",
    match(t) {
      if (/\b(open|show|pick|choose|look at)\b.*\b(photo|picture|gallery|image)s?\b/.test(t)) {
        return { slots: {}, confidence: 0.8, label: "Open your photos" };
      }
      return null;
    },
  },
  {
    id: "read_health", sideEffect: false, permission: "health",
    blurb: "read today's steps / sleep / heart rate from Health",
    match(t) {
      if (/\b(steps|how (far|much) did i walk|walked)\b/.test(t)) return { slots: { metric: "steps" }, confidence: 0.85, label: "Check today's steps" };
      if (/\b(sleep|how (long|well) did i sleep|slept)\b/.test(t)) return { slots: { metric: "sleep" }, confidence: 0.85, label: "Check last night's sleep" };
      if (/\b(heart ?rate|bpm|pulse)\b/.test(t)) return { slots: { metric: "heart" }, confidence: 0.85, label: "Check your heart rate" };
      return null;
    },
  },
  {
    id: "add_reminder", sideEffect: true, permission: "calendar",
    blurb: "add a reminder / calendar event",
    match(t) {
      const m = t.match(/\b(?:remind me to|add (?:a )?reminder|schedule|put .* on (?:my )?calendar|add to (?:my )?calendar)\b\s*(?:to\s+)?(.*)/);
      if (!m) return null;
      const what = (m[1] || "").replace(/[?.!]+$/, "").trim();
      const slots: Slots = {};
      if (what) slots.title = what;
      return what
        ? { slots, confidence: 0.82, label: `Add reminder: ${what}` }
        : { slots, confidence: 0.6, label: "Add a reminder", missing: ["title"] };
    },
  },
  {
    id: "find_contact", sideEffect: false, permission: "contacts",
    blurb: "look up a contact's number",
    match(t) {
      const m = t.match(/\b(?:call|text|message|number for|contact|phone)\s+([a-z][a-z .'-]{1,30})\b/);
      if (!m) return null;
      const name = m[1].trim();
      const draft = /\b(text|message)\b/.test(t);
      return { slots: { name, intent: draft ? "message" : "call" }, confidence: 0.75, label: `${draft ? "Message" : "Call"} ${name}` };
    },
  },
  {
    id: "draft_message", sideEffect: true, permission: "none",
    blurb: "draft a text message (you send it)",
    match(t) {
      const m = t.match(/\b(?:text|message|sms)\s+([a-z][a-z .'-]{1,30})\s+(?:saying|that|about)\s+(.+)/);
      if (!m) return null;
      return { slots: { name: m[1].trim(), body: m[2].trim() }, confidence: 0.8, label: `Draft a message to ${m[1].trim()}` };
    },
  },
  {
    id: "where_am_i", sideEffect: false, permission: "location",
    blurb: "use current location",
    match(t) {
      if (/\b(where am i|my location|current location|near me|nearby)\b/.test(t)) {
        return { slots: {}, confidence: 0.8, label: "Use your location" };
      }
      return null;
    },
  },
  {
    id: "read_notifications", sideEffect: false, permission: "notifications",
    blurb: "read recent notifications",
    match(t) {
      if (/\b(notifications?|what did i miss|any (new )?(messages|alerts))\b/.test(t)) {
        return { slots: {}, confidence: 0.75, label: "Read your recent notifications" };
      }
      return null;
    },
  },
  {
    id: "translate", sideEffect: false, permission: "translate",
    blurb: "translate text between languages (on-device, offline)",
    match(t) {
      let m = t.match(/\btranslate\s+(?:this|that|it)\s+(?:in)?to\s+([a-z]+)\b/);
      if (m) { const slots: Slots = { to: m[1] }; return { slots, confidence: 0.72, label: `Translate to ${title(m[1])}`, missing: ["text"] }; }
      m = t.match(/\btranslate\s+(.+?)\s+(?:in)?to\s+([a-z]+)\b/);
      if (m) { const slots: Slots = { text: m[1].trim(), to: m[2] }; return { slots, confidence: 0.88, label: `Translate to ${title(m[2])}` }; }
      m = t.match(/\bhow do (?:you|i) say\s+(.+?)\s+in\s+([a-z]+)\b/);
      if (m) { const slots: Slots = { text: m[1].trim(), to: m[2] }; return { slots, confidence: 0.85, label: `Say it in ${title(m[2])}` }; }
      return null;
    },
  },

  // ---- ONLINE (leaves the device). Owner build: on. Shipped: off until opt-in. ----
  {
    id: "play_youtube", sideEffect: false, permission: "online", online: true,
    blurb: "play a video on YouTube",
    match(t) {
      if (!/\byoutube\b/.test(t)) return null;
      let q = "";
      let m = t.match(/\b(?:play|watch|put on|search(?: for)?)\s+(.+?)\s+(?:on\s+)?youtube\b/);
      if (m) q = m[1];
      else { m = t.match(/\byoutube\b\s*(?:for\s+)?(.*)/); if (m) q = m[1]; }
      q = q.replace(/[?.!]+$/, "").trim();
      const slots: Slots = {};
      if (q) slots.query = q;
      return q
        ? { slots, confidence: 0.85, label: `Play “${q}” on YouTube` }
        : { slots, confidence: 0.6, label: "Open YouTube", missing: ["query"] };
    },
  },
  {
    id: "web_search", sideEffect: false, permission: "online", online: true,
    blurb: "search the web / look something up online",
    match(t) {
      const m = t.match(/\b(?:google|search the web(?: for)?|search online|look (?:it|that|this|something)? ?up|on the internet)\s*(.*)/);
      if (!m) return null;
      const q = m[1].replace(/\b(online|on the (?:web|internet))\b/g, "").replace(/[?.!]+$/, "").trim();
      const slots: Slots = {};
      if (q) slots.query = q;
      return q
        ? { slots, confidence: 0.8, label: `Search the web for “${q}”` }
        : { slots, confidence: 0.6, label: "Search the web", missing: ["query"] };
    },
  },
  {
    id: "email_draft", sideEffect: true, permission: "online", online: true,
    blurb: "draft an email (sent from your mail app)",
    match(t) {
      if (!/\be-?mail\b/.test(t)) return null;
      let m = t.match(/\be-?mail\s+([a-z][a-z .'-]{1,30})\s+(?:saying|that|about)\s+(.+)/);
      if (m) {
        const slots: Slots = { to: m[1].trim(), body: m[2].replace(/[?.!]+$/, "").trim() };
        return { slots, confidence: 0.82, label: `Draft an email to ${m[1].trim()}` };
      }
      m = t.match(/\b(?:send an? e-?mail to|e-?mail)\s+([a-z][a-z .'-]{1,30})\b/);
      if (m) {
        const slots: Slots = { to: m[1].trim() };
        return { slots, confidence: 0.64, label: `Draft an email to ${m[1].trim()}`, missing: ["body"] };
      }
      return null;
    },
  },
  {
    // Heaviest: reads your mailbox. Owner build only; DISABLED in shipped v1 (see build.ts).
    id: "read_inbox", sideEffect: false, permission: "email", online: true, ownerOnly: true,
    blurb: "read your email inbox",
    match(t) {
      if (/\b(check|read|any)\b.*\b(e-?mail|inbox|mail)\b/.test(t) || /\bnew e-?mails?\b/.test(t)) {
        return { slots: {}, confidence: 0.72, label: "Read your inbox" };
      }
      return null;
    },
  },
];
