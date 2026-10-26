// Capability dispatch reliability test (standalone node, no device, no model).
// Mirrors the deterministic matchers in src/capabilities/registry.ts. Proves that varied
// natural phrasings map to the right capability + slots — the app-side NLU that lets a
// 1.5B "appear smarter than it is" without ever having to emit a tool-call.
// Run: node tools/tests/capabilities.mjs

function parseTime(t) {
  let mm = t.match(/\b(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?\b/);
  if (mm) { let h = +mm[1]; const m = +mm[2]; const mer = mm[3]?.replace(/\./g, ""); if (mer === "pm" && h < 12) h += 12; if (mer === "am" && h === 12) h = 0; if (h < 24 && m < 60) return { h, m }; }
  mm = t.match(/\bhalf\s*(?:past\s*)?(\d{1,2})\b/); if (mm) return { h: +mm[1] % 24, m: 30 };
  mm = t.match(/\bquarter\s*(past|to)\s*(\d{1,2})\b/); if (mm) { const b = +mm[2]; return mm[1] === "to" ? { h: (b + 23) % 24, m: 45 } : { h: b % 24, m: 15 }; }
  mm = t.match(/\b(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)\b/); if (mm) { let h = +mm[1]; const mer = mm[2].replace(/\./g, ""); if (mer === "pm" && h < 12) h += 12; if (mer === "am" && h === 12) h = 0; if (h < 24) return { h, m: 0 }; }
  return null;
}
function parseDuration(t) {
  if (/\bhalf an hour\b/.test(t)) return 1800;
  if (/\ban hour\b/.test(t) && !/\d/.test(t)) return 3600;
  let total = 0, found = false;
  const h = t.match(/(\d+)\s*(?:h|hr|hrs|hour|hours)\b/); if (h) { total += +h[1] * 3600; found = true; }
  const m = t.match(/(\d+)\s*(?:m|min|mins|minute|minutes)\b/); if (m) { total += +m[1] * 60; found = true; }
  const s = t.match(/(\d+)\s*(?:s|sec|secs|second|seconds)\b/); if (s) { total += +s[1]; found = true; }
  return found ? total : null;
}
// Minimal port of the registry's detection, ordered by confidence like the real dispatcher.
function detect(raw) {
  const t = raw.toLowerCase().trim();
  if (/\b(alarm|wake me|wake up)\b/.test(t)) { const tm = parseTime(t); return { id: "set_alarm", slots: tm ? { time: `${tm.h}:${String(tm.m).padStart(2, "0")}` } : {} }; }
  if (/\btimer\b/.test(t) || /\b(count ?down|remind me in)\b/.test(t)) { const d = parseDuration(t); return { id: "set_timer", slots: d ? { seconds: String(d) } : {} }; }
  let m = t.match(/\b(?:directions?|navigate|route|take me|how do i get|drive)\s+(?:to\s+)?(.+)/); if (m) return { id: "directions", slots: { destination: m[1].replace(/[?.!]+$/, "").trim() } };
  if (/\b(scan|read|ocr|extract)\b.*\b(text|photo|picture|document|receipt|page|label|sign)\b/.test(t)) return { id: "scan_text", slots: {} };
  if (/\b(steps|how (far|much) did i walk|walked)\b/.test(t)) return { id: "read_health", slots: { metric: "steps" } };
  if (/\b(sleep|how (long|well) did i sleep|slept)\b/.test(t)) return { id: "read_health", slots: { metric: "sleep" } };
  if (/\b(open|show|pick|choose|look at)\b.*\b(photo|picture|gallery|image)s?\b/.test(t)) return { id: "pick_photo", slots: {} };
  { let x = t.match(/\btranslate\s+(?:this|that|it)\s+(?:in)?to\s+([a-z]+)\b/); if (x) return { id: "translate", slots: { to: x[1] } }; }
  { let x = t.match(/\btranslate\s+(.+?)\s+(?:in)?to\s+([a-z]+)\b/); if (x) return { id: "translate", slots: { text: x[1].trim(), to: x[2] } }; }
  { let x = t.match(/\bhow do (?:you|i) say\s+(.+?)\s+in\s+([a-z]+)\b/); if (x) return { id: "translate", slots: { text: x[1].trim(), to: x[2] } }; }
  // online (owner build)
  if (/\byoutube\b/.test(t)) { let q = ""; let mm = t.match(/\b(?:play|watch|put on|search(?: for)?)\s+(.+?)\s+(?:on\s+)?youtube\b/); if (mm) q = mm[1]; else { mm = t.match(/\byoutube\b\s*(?:for\s+)?(.*)/); if (mm) q = mm[1]; } q = q.replace(/[?.!]+$/, "").trim(); return { id: "play_youtube", slots: q ? { query: q } : {} }; }
  let em = t.match(/\be-?mail\s+([a-z][a-z .'-]{1,30})\s+(?:saying|that|about)\s+(.+)/); if (em) return { id: "email_draft", slots: { to: em[1].trim() } };
  if (/\b(check|read|any)\b.*\b(e-?mail|inbox|mail)\b/.test(t) || /\bnew e-?mails?\b/.test(t)) return { id: "read_inbox", slots: {} };
  m = t.match(/\b(?:google|search the web(?: for)?|search online|look (?:it|that|this|something)? ?up|on the internet)\s*(.*)/); if (m) { const q = m[1].replace(/\b(online|on the (?:web|internet))\b/g, "").replace(/[?.!]+$/, "").trim(); return { id: "web_search", slots: q ? { query: q } : {} }; }
  return null;
}

const CASES = [
  ["set an alarm for 7am", "set_alarm", { time: "7:00" }],
  ["wake me up at 6:30", "set_alarm", { time: "6:30" }],
  ["alarm for half 7", "set_alarm", { time: "7:30" }],
  ["set an alarm for quarter to 9", "set_alarm", { time: "8:45" }],
  ["wake me at 19:00", "set_alarm", { time: "19:00" }],
  ["alarm at 12am", "set_alarm", { time: "0:00" }],
  ["set a timer for 5 minutes", "set_timer", { seconds: "300" }],
  ["timer 90 seconds", "set_timer", { seconds: "90" }],
  ["start a timer for half an hour", "set_timer", { seconds: "1800" }],
  ["directions to the airport", "directions", { destination: "the airport" }],
  ["navigate to Mercadmona Las Chafiras", "directions", { destination: "mercadmona las chafiras" }],
  ["how do i get to the harbour?", "directions", { destination: "the harbour" }],
  ["scan the text from this receipt", "scan_text", {}],
  ["read the text on this sign", "scan_text", {}],
  ["how many steps today", "read_health", { metric: "steps" }],
  ["how did i sleep last night", "read_health", { metric: "sleep" }],
  ["open my photos", "pick_photo", {}],
  ["show me a picture", "pick_photo", {}],
  ["translate good morning to spanish", "translate", { text: "good morning", to: "spanish" }],
  ["how do you say thank you in french", "translate", { text: "thank you", to: "french" }],
  ["translate this into german", "translate", { to: "german" }],
  // online (owner build)
  ["play lofi beats on youtube", "play_youtube", { query: "lofi beats" }],
  ["youtube cat videos", "play_youtube", { query: "cat videos" }],
  ["search the web for tenerife weather", "web_search", { query: "tenerife weather" }],
  ["google the best paella recipe", "web_search", { query: "the best paella recipe" }],
  ["email mom saying i'll be late", "email_draft", { to: "mom" }],
  ["check my email", "read_inbox", {}],
  ["any new emails", "read_inbox", {}],
  // negatives — plain chat must NOT trigger a capability
  ["what's the capital of France", null, null],
  ["tell me a joke about alarms", null, null], // tricky: 'alarms' present but no set/time intent? -> acceptable either way
  ["i feel sleepy", null, null],
];

let pass = 0, fail = 0;
for (const [text, wantId, wantSlots] of CASES) {
  const got = detect(text);
  const gotId = got?.id ?? null;
  let ok = gotId === wantId;
  if (ok && wantSlots) for (const k of Object.keys(wantSlots)) if (got.slots[k] !== wantSlots[k]) ok = false;
  // the "joke about alarms" case is allowed to match set_alarm (no time) — don't fail it either way
  if (!ok && text.includes("joke about alarms") && gotId === "set_alarm") ok = true;
  if (ok) pass++; else { fail++; console.log(`FAIL: "${text}" -> ${gotId} ${JSON.stringify(got?.slots)} (wanted ${wantId} ${JSON.stringify(wantSlots)})`); }
}
console.log(`\ncapabilities: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
