// Arcade high-score table — file-backed, best-effort persistence across sessions.
// Mirrors settings.ts: lazy load, cached reads, fire-and-forget writes, pub/sub so
// overlays re-render on change. One board per gameId, top-10, newest-wins on ties.
// Ordering is per-game: "high" (bigger is better, default) or "low" (fewer is better,
// e.g. Putt Pal strokes). Each game always passes the same ordering, so the stored
// board stays correctly sorted.
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useState } from "react";

export type ScoreEntry = { initials: string; score: number; at: number };
export type Ordering = "high" | "low";

export const MAX_SCORES = 10;
const FILE = FileSystem.documentDirectory + "highscores.json";

type Store = { boards: Record<string, ScoreEntry[]>; tag: string };

let cache: Store = { boards: {}, tag: "AAA" };
let loaded = false;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }
function persist() { FileSystem.writeAsStringAsync(FILE, JSON.stringify(cache)).catch(() => {}); }

export async function loadHighScores(): Promise<Store> {
  if (loaded) return cache;
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(FILE);
      const parsed = JSON.parse(raw);
      cache = {
        boards: parsed?.boards && typeof parsed.boards === "object" ? parsed.boards : {},
        tag: typeof parsed?.tag === "string" ? parsed.tag : "AAA",
      };
    }
  } catch {}
  loaded = true;
  emit();
  return cache;
}

function sortBoard(arr: ScoreEntry[], ordering: Ordering): ScoreEntry[] {
  const sorted = [...arr].sort((a, b) => {
    const d = ordering === "low" ? a.score - b.score : b.score - a.score;
    return d !== 0 ? d : b.at - a.at; // newer first on a tie
  });
  return sorted.slice(0, MAX_SCORES);
}

export function topScores(gameId: string): ScoreEntry[] { return cache.boards[gameId] ?? []; }

export function bestScore(gameId: string, ordering: Ordering = "high"): number | null {
  const b = cache.boards[gameId];
  if (!b || b.length === 0) return null;
  return ordering === "low"
    ? Math.min(...b.map((e) => e.score))
    : Math.max(...b.map((e) => e.score));
}

export function lastTag(): string { return cache.tag || "AAA"; }

// Does `score` earn a place on the board? (score 0 never qualifies in "high" mode.)
export function qualifies(gameId: string, score: number, ordering: Ordering = "high"): boolean {
  if (!Number.isFinite(score)) return false;
  if (ordering === "high" && score <= 0) return false;
  const board = cache.boards[gameId] ?? [];
  if (board.length < MAX_SCORES) return true;
  const worst = board[board.length - 1].score;
  return ordering === "low" ? score < worst : score > worst;
}

// Record a score; returns the new board and the inserted entry (so callers can highlight it).
export function addScore(
  gameId: string, initials: string, score: number, ordering: Ordering = "high",
): { board: ScoreEntry[]; entry: ScoreEntry } {
  const tag = (initials || "AAA").toUpperCase().replace(/[^A-Z ]/g, "").slice(0, 3).padEnd(3, " ").trimEnd() || "AAA";
  const entry: ScoreEntry = { initials: tag, score, at: Date.now() };
  const board = sortBoard([...(cache.boards[gameId] ?? []), entry], ordering);
  cache.boards = { ...cache.boards, [gameId]: board };
  cache.tag = tag;
  emit();
  persist();
  return { board, entry };
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// React convenience: returns the current board for a game and re-renders on change.
export function useHighScores(gameId: string): ScoreEntry[] {
  const [, force] = useState(0);
  useEffect(() => {
    loadHighScores();
    return subscribe(() => force((n) => n + 1));
  }, []);
  return topScores(gameId);
}
