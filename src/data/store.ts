// Local data layer — generic file-backed collections, offline-first.
// Same proven pattern as settings.ts / highscores.ts (lazy load, cached reads,
// fire-and-forget JSON writes, pub/sub + a React hook), generalised so every
// feature (notes, reminders, …) gets its own persisted collection with one call:
//
//   type Note = Entity & { text: string };
//   export const notes = createCollection<Note>("notes");
//   const items = notes.use();            // reactive list, newest first
//   await notes.create({ text: "hi" });   // id/createdAt/updatedAt filled in
//
// Single-user, on-device, modest volume — JSON files are plenty. If a collection
// ever needs real queries/scale, it can move to expo-sqlite behind this same API.
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useState } from "react";

export type Entity = { id: string; createdAt: number; updatedAt: number };

export const DATA_DIR = FileSystem.documentDirectory + "data/";

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export type Collection<T extends Entity> = {
  all(): T[];
  get(id: string): T | undefined;
  create(data: Omit<T, keyof Entity>): Promise<T>;
  update(id: string, patch: Partial<Omit<T, "id" | "createdAt">>): Promise<T | undefined>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
  load(): Promise<T[]>;
  subscribe(fn: () => void): () => void;
  use(): T[];
};

async function ensureDir() {
  try {
    const info = await FileSystem.getInfoAsync(DATA_DIR);
    if (!info.exists) await FileSystem.makeDirectoryAsync(DATA_DIR, { intermediates: true });
  } catch {}
}

export function createCollection<T extends Entity>(name: string): Collection<T> {
  const FILE = DATA_DIR + name + ".json";
  let cache: T[] = [];
  let loaded = false;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((l) => l());
  // Serialize writes so concurrent mutations can't clobber each other's file write, and always
  // finish with the LATEST cache persisted. (Fire-and-forget overlapping writes = last-write-wins race.)
  let writing = false, rewrite = false;
  async function doWrite(): Promise<void> {
    if (writing) { rewrite = true; return; }
    writing = true;
    try { await ensureDir(); await FileSystem.writeAsStringAsync(FILE, JSON.stringify(cache)); } catch {}
    writing = false;
    if (rewrite) { rewrite = false; void doWrite(); }
  }
  const persist = () => { void doWrite(); };

  async function load(): Promise<T[]> {
    if (loaded) return cache;
    try {
      const info = await FileSystem.getInfoAsync(FILE);
      if (info.exists) {
        const raw = await FileSystem.readAsStringAsync(FILE);
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) cache = parsed as T[];
      }
    } catch {}
    loaded = true;
    emit();
    return cache;
  }

  function subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }

  async function create(data: Omit<T, keyof Entity>): Promise<T> {
    const now = Date.now();
    const item = { ...(data as object), id: uid(), createdAt: now, updatedAt: now } as T;
    cache = [item, ...cache];
    emit(); persist();
    return item;
  }

  async function update(id: string, patch: Partial<Omit<T, "id" | "createdAt">>): Promise<T | undefined> {
    let out: T | undefined;
    cache = cache.map((e) => {
      if (e.id !== id) return e;
      out = { ...e, ...patch, updatedAt: Date.now() } as T;
      return out;
    });
    emit(); persist();
    return out;
  }

  async function remove(id: string): Promise<void> {
    cache = cache.filter((e) => e.id !== id);
    emit(); persist();
  }

  async function clear(): Promise<void> {
    cache = [];
    emit(); persist();
  }

  function use(): T[] {
    const [, force] = useState(0);
    useEffect(() => {
      load();
      return subscribe(() => force((n) => n + 1));
    }, []);
    return cache;
  }

  return {
    all: () => cache,
    get: (id) => cache.find((e) => e.id === id),
    create, update, remove, clear, load, subscribe, use,
  };
}
