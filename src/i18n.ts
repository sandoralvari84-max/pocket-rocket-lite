// Pocket Rocket Lite — lightweight, fully-offline localization.
// Each screen owns its own {en,de,es} string table and reads the current
// language with pick()/useLang(); no central dictionary to contend on.
import { useEffect, useState } from "react";
import { getSettings, subscribe, type AppLang } from "./settings";

export type { AppLang };

export const LANGS: { key: AppLang; label: string }[] = [
  { key: "en", label: "English" },
  { key: "de", label: "Deutsch" },
  { key: "es", label: "Español" },
];

// A per-string/per-screen translation table.
export type Tr<T> = Record<AppLang, T>;

export function lang(): AppLang {
  return getSettings().language ?? "en";
}

// Pick the current language's entry from a {en,de,es} table (English fallback).
export function pick<T>(table: Tr<T>): T {
  const l = lang();
  return table[l] ?? table.en;
}

// Hook: current language; re-renders the component when it changes.
export function useLang(): AppLang {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force((n) => n + 1)), []);
  return lang();
}
