// Shared app settings — file-backed, best-effort persistence across sessions.
// Simple pub/sub so screens re-render on change. Load is lazy; reads return cached defaults
// until the file loads. Writes update cache immediately and persist fire-and-forget.
import * as FileSystem from "expo-file-system/legacy";

export type VoiceId = "sentinel" | "nova";
export type Settings = {
  voice: VoiceId;        // selected TTS persona (voice track wires the engine behind this)
  speechRate: number;    // 0.5..1.3
  reducedMotion: boolean;
  gameSound: boolean;
};

const DEFAULTS: Settings = { voice: "sentinel", speechRate: 0.96, reducedMotion: false, gameSound: true };
const FILE = FileSystem.documentDirectory + "settings.json";

let cache: Settings = { ...DEFAULTS };
let loaded = false;
const listeners = new Set<() => void>();

export async function loadSettings(): Promise<Settings> {
  if (loaded) return cache;
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(FILE);
      cache = { ...DEFAULTS, ...JSON.parse(raw) };
    }
  } catch {}
  loaded = true;
  listeners.forEach((l) => l());
  return cache;
}

export function getSettings(): Settings { return cache; }

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  cache = { ...cache, [key]: value };
  listeners.forEach((l) => l());
  FileSystem.writeAsStringAsync(FILE, JSON.stringify(cache)).catch(() => {});
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// React hook convenience.
import { useEffect, useState } from "react";
export function useSettings(): Settings {
  const [, force] = useState(0);
  useEffect(() => {
    loadSettings();
    return subscribe(() => force((n) => n + 1));
  }, []);
  return cache;
}
