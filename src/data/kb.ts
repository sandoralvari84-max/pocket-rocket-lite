// RAG retrieval over the 13 bundled knowledge-base niches (kb_packs.json, built from
// the local-pocket-rocket-pack KBs). Retrieval is DETERMINISTIC keyword scoring — the
// model never invents facts; it only phrases passages this returns. Works fully offline;
// with no model loaded the caller can show the retrieved passages directly.
import PACKS from "./kb_packs.json";

export type KBChunk = { niche: string; title: string; file: string; heading: string; text: string };

type Pack = { id: string; title: string; files: { file: string; chunks: { heading: string; text: string }[] }[] };
const NICHES = (PACKS as { niches: Pack[] }).niches;

const INDEX: KBChunk[] = [];
for (const n of NICHES) for (const f of n.files) for (const c of f.chunks) {
  INDEX.push({ niche: n.id, title: n.title, file: f.file, heading: c.heading, text: c.text });
}

export function listNiches(): { id: string; title: string; chunks: number }[] {
  return NICHES.map((n) => ({ id: n.id, title: n.title, chunks: n.files.reduce((a, f) => a + f.chunks.length, 0) }));
}

const STOP = new Set("the a an of to and or in on for with is are be as at by from this that it its your you we our how what why".split(" "));
function terms(q: string): string[] {
  // Keep 2-char domain terms ("ux", "ai", "ml", "os") — they're high-value query tokens; only
  // drop 1-char noise and stopwords.
  return (q.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 1 && !STOP.has(t));
}

// Per-file preamble stubs and bare "Sources" lists aren't useful answer passages (and they waste
// the small model's scarce context), so they're excluded from retrieval.
function isBoilerplate(c: KBChunk): boolean {
  const h = c.heading.toLowerCase().trim();
  if (h === "sources" || h === "references") return true;
  const t = c.text.trim();
  return t.length < 40 || /^builds on\b/i.test(t);
}

// Top-N chunks, deterministic + offline. Word-boundary token match (not substring, so "art" no
// longer matches "chart"/"smart"), ranked by how many DISTINCT query terms a chunk covers, then
// frequency, length-normalized so long chunks don't win on bulk alone.
export function searchKB(query: string, nicheId?: string, topN = 4): KBChunk[] {
  const ts = terms(query);
  if (!ts.length) return [];
  const want = new Set(ts);
  const pool = (nicheId ? INDEX.filter((c) => c.niche === nicheId) : INDEX).filter((c) => !isBoilerplate(c));
  const scored = pool.map((c) => {
    const toks = (c.heading + " " + c.heading + " " + c.text).toLowerCase().match(/[a-z0-9]+/g) ?? [];
    let freq = 0; const hit = new Set<string>();
    for (const tok of toks) if (want.has(tok)) { freq++; hit.add(tok); }
    return { c, covered: hit.size, norm: freq / Math.sqrt(toks.length || 1) };
  }).filter((x) => x.covered > 0);
  if (!scored.length) return [];
  // Prefer chunks covering at least half the query terms; fall back to any match if none qualify.
  const need = Math.max(1, Math.ceil(ts.length / 2));
  const gated = scored.filter((x) => x.covered >= need);
  return (gated.length ? gated : scored)
    .sort((a, b) => b.covered - a.covered || b.norm - a.norm)
    .slice(0, topN)
    .map((x) => x.c);
}
