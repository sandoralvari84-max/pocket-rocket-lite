import * as Speech from "expo-speech";

// Pick a concrete device TTS voice per persona so Sentinel is reliably MALE and Nova
// FEMALE — instead of just pitch-shifting whatever the system default happens to be.
// Offline-first: prefer local (on-device) voices; never require a network voice.
// expo-speech's Voice has no gender field, so we rank by the well-known Google-TTS
// identifier codes (…-x-<code>-local). Unknown engines fall back gracefully to the
// system default (pitch still biases the character). All best-effort + cached.

export type Persona = "sentinel" | "nova";

type Voice = { identifier: string; name?: string; quality?: string; language?: string };

// Exact voices we WANT per locale (Sentinel = male, Nova = female). Used verbatim when
// the device has them; otherwise we fall back to the ranking below. These are the real
// Google-TTS on-device voices confirmed on the test phone.
const EXACT: Record<string, { sentinel: string[]; nova: string[] }> = {
  en: { sentinel: ["en-us-x-iob-local", "en-us-x-iol-local", "en-us-x-iom-local"], nova: ["en-us-x-tpf-local", "en-us-x-sfg-local"] },
  de: { sentinel: ["de-de-x-deb-local", "de-de-x-deg-local"], nova: ["de-de-x-nfh-local", "de-de-x-deh-local"] },
  es: { sentinel: ["es-es-x-eec-local", "es-es-x-eed-local"], nova: ["es-es-x-eea-local", "es-es-x-eef-local"] },
};

// Google TTS en/de/es identifier codes that are commonly male / female (fallback ranking).
const MALE = ["iom", "iol", "iob", "tpc", "deb", "deg", "eec", "eed"];
const FEMALE = ["sfg", "tpf", "tpd", "nfh", "nsc", "eea", "eef"];

let resolved: Partial<Record<Persona, string>> = {};
let done = false;

function localeFor(language?: string): string {
  return language === "de" ? "de-DE" : language === "es" ? "es-ES" : "en-US";
}

function code(id: string): string {
  // en-us-x-iom-local  ->  "iom"
  const m = id.toLowerCase().match(/-x-([a-z0-9]+)-/);
  return m ? m[1] : "";
}

function rank(v: Voice, want: "male" | "female"): number {
  const id = v.identifier.toLowerCase();
  const c = code(v.identifier);
  const list = want === "male" ? MALE : FEMALE;
  const other = want === "male" ? FEMALE : MALE;
  let score = 0;
  if (list.includes(c)) score += 100;            // known-gender match (Google -x-<code>- scheme)
  else if (other.includes(c)) score -= 100;      // known opposite — avoid
  // Non-Google engines (e.g. Samsung) don't use the -x-<code>- scheme; fall back to any
  // gender hint in the voice NAME so a persona still gets a male/female voice there.
  const nm = (v.name || "").toLowerCase();
  if (want === "male" && /\bmale\b|\bman\b/.test(nm) && !/female|woman/.test(nm)) score += 60;
  if (want === "female" && /\bfemale\b|\bwoman\b/.test(nm)) score += 60;
  if (id.includes("-local")) score += 30;        // offline, no network needed
  if (id.includes("network")) score -= 40;       // needs data — avoid for offline app
  if ((v.quality || "").toLowerCase() === "enhanced") score += 8;
  return score;
}

// Resolve + cache the best male/female voice for the given interface language.
export async function resolveVoices(language?: string): Promise<void> {
  try {
    const want = localeFor(language);
    const prefix = want.slice(0, 2).toLowerCase(); // "en" | "de" | "es"
    const all: Voice[] = await Speech.getAvailableVoicesAsync();
    // One-time visibility so the chosen ids can be confirmed on a real device.
    try { console.log("[voices] available:", JSON.stringify(all.map((v) => ({ id: v.identifier, q: v.quality })))); } catch {}
    const pool = all.filter((v) => (v.language || "").toLowerCase().startsWith(prefix));
    const cands = pool.length ? pool : all;
    const have = new Set(all.map((v) => v.identifier.toLowerCase()));
    // Exact preference first: take the first wanted id the device actually has.
    const exact = EXACT[prefix];
    const pickExact = (ids: string[]) => ids.find((id) => have.has(id.toLowerCase()));
    const best = (want2: "male" | "female") =>
      cands.slice().sort((a, b) => rank(b, want2) - rank(a, want2))[0];
    const male = best("male");
    const female = best("female");
    resolved = {
      sentinel: (exact && pickExact(exact.sentinel)) || (male && rank(male, "male") > -50 ? male.identifier : undefined),
      nova: (exact && pickExact(exact.nova)) || (female && rank(female, "female") > -50 ? female.identifier : undefined),
    };
    console.log("[voices] picked:", JSON.stringify(resolved));
    done = true;
  } catch {
    done = true; // leave resolved empty -> callers fall back to system default + pitch
  }
}

export function voiceId(persona: Persona): string | undefined {
  return resolved[persona];
}

export function voicesReady(): boolean {
  return done;
}
