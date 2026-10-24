// Owner memory — who the buddy is talking to, plus user-approved facts it should
// remember across sessions. File-backed (like settings), with a small pub/sub so the
// Memory screen re-renders. The model NEVER writes here; the owner adds/edits/clears
// everything, and ownerContext() feeds it into the system prompt as plain context
// (the same deterministic-injection pattern the device clock already uses).
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useState } from "react";
import { createCollection, type Entity } from "./store";

export type OwnerProfile = {
  name: string;      // what to call them
  pronouns: string;  // free text, e.g. "they/them"
  about: string;     // a sentence or two of context
  prefs: string;     // how they like replies (tone, length, language notes)
};

export type OwnerFact = Entity & { text: string };

const DEFAULTS: OwnerProfile = { name: "", pronouns: "", about: "", prefs: "" };
const FILE = FileSystem.documentDirectory + "owner_profile.json";

// User-approved facts live in the shared data layer so they persist + get a React hook.
export const facts = createCollection<OwnerFact>("owner_facts");

let cache: OwnerProfile = { ...DEFAULTS };
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function loadProfile(): Promise<OwnerProfile> {
  facts.load(); // make facts available to ownerContext() even if the screen never opened
  if (loaded) return cache;
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(FILE);
      cache = { ...DEFAULTS, ...JSON.parse(raw) };
    }
  } catch {}
  loaded = true;
  emit();
  return cache;
}

export function getProfile(): OwnerProfile { return cache; }

export function setProfileField<K extends keyof OwnerProfile>(key: K, value: OwnerProfile[K]) {
  cache = { ...cache, [key]: value };
  emit();
  FileSystem.writeAsStringAsync(FILE, JSON.stringify(cache)).catch(() => {});
}

export function clearProfile() {
  cache = { ...DEFAULTS };
  emit();
  FileSystem.writeAsStringAsync(FILE, JSON.stringify(cache)).catch(() => {});
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useProfile(): OwnerProfile {
  const [, force] = useState(0);
  useEffect(() => {
    loadProfile();
    return subscribe(() => force((n) => n + 1));
  }, []);
  return cache;
}

// Compact context block for the model. Returns "" when nothing is set so the tiny
// model isn't burdened. Caps facts + length to protect its small context window.
export function ownerContext(): string {
  const p = cache;
  const parts: string[] = [];
  if (p.name.trim()) parts.push(`Their name is ${p.name.trim()}.`);
  if (p.pronouns.trim()) parts.push(`They go by ${p.pronouns.trim()}.`);
  if (p.about.trim()) parts.push(`About them: ${p.about.trim()}`);
  if (p.prefs.trim()) parts.push(`How they like replies: ${p.prefs.trim()}`);
  const fs = facts.all().slice(0, 8).map((f) => f.text.trim()).filter(Boolean);
  if (fs.length) parts.push("Things they asked you to remember:\n- " + fs.join("\n- "));
  if (!parts.length) return "";
  let out =
    "About the person you're talking to (use naturally when relevant; never invent details " +
    "beyond this, and don't recite it back unprompted):\n" + parts.join("\n");
  if (out.length > 900) out = out.slice(0, 900) + "…"; // hard cap for the small model
  return out;
}
