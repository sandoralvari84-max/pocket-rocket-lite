// Live exchange rates for the Converter's Money category. Keyless Open ER-API
// (open.er-api.com) returns rates per 1 USD. Fetched at most twice a day and cached
// to disk, so after the first online fetch the converter keeps working fully offline.
import * as FileSystem from "expo-file-system/legacy";
import { DATA_DIR } from "./store";

const FX_URL = "https://open.er-api.com/v6/latest/USD"; // keyless; rates are per 1 USD
const FX_FILE = DATA_DIR + "fx.json";
const MAX_AGE_MS = 12 * 60 * 60 * 1000; // refresh at most twice a day

export type FxData = { base: "USD"; rates: Record<string, number>; asOf: number }; // asOf = ms epoch

// The currencies the Converter offers. USD base; the rest come from the API.
export const CURRENCIES = ["USD", "EUR", "GBP", "HUF", "CHF", "JPY", "CAD", "AUD", "CNY", "SEK", "PLN"] as const;

let mem: FxData | null = null;

async function readCache(): Promise<FxData | null> {
  if (mem) return mem;
  try {
    const i = await FileSystem.getInfoAsync(FX_FILE);
    if (!i.exists) return null;
    const parsed = JSON.parse(await FileSystem.readAsStringAsync(FX_FILE));
    if (parsed && parsed.rates && typeof parsed.rates.USD === "number") { mem = parsed as FxData; return mem; }
  } catch {}
  return null;
}

async function writeCache(d: FxData): Promise<void> {
  try {
    await FileSystem.makeDirectoryAsync(DATA_DIR, { intermediates: true }).catch(() => {});
    await FileSystem.writeAsStringAsync(FX_FILE, JSON.stringify(d));
    mem = d;
  } catch {}
}

// Cached rates immediately when fresh; otherwise try the network and fall back to the
// (possibly stale, possibly null) cache when offline. Never throws.
export async function getRates(force = false): Promise<FxData | null> {
  const cached = await readCache();
  const fresh = cached != null && Date.now() - cached.asOf < MAX_AGE_MS;
  if (cached && fresh && !force) return cached;
  try {
    const res = await fetch(FX_URL);
    const j: any = await res.json();
    if (j && j.result === "success" && j.rates && typeof j.rates.USD === "number") {
      const d: FxData = { base: "USD", rates: j.rates, asOf: Date.now() };
      await writeCache(d);
      return d;
    }
  } catch {}
  return cached; // offline / failed → stale cache (may be null on a first-ever run offline)
}

// Convert an amount from one currency to another using per-USD rates. NaN if unknown.
export function fxConvert(rates: Record<string, number>, from: string, to: string, v: number): number {
  const rf = rates[from], rt = rates[to];
  if (!rf || !rt) return NaN;
  return (v / rf) * rt;
}
