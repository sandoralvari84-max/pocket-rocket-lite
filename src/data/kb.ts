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
  return (q.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 2 && !STOP.has(t));
}

// Top-N chunks by keyword frequency (heading weighted 2x). Deterministic + offline.
export function searchKB(query: string, nicheId?: string, topN = 4): KBChunk[] {
  const ts = terms(query);
  if (!ts.length) return [];
  const pool = nicheId ? INDEX.filter((c) => c.niche === nicheId) : INDEX;
  const scored = pool.map((c) => {
    const hay = (c.heading + " " + c.heading + " " + c.text).toLowerCase();
    let s = 0;
    for (const t of ts) {
      let i = 0, n = 0;
      while ((i = hay.indexOf(t, i)) >= 0) { n++; i += t.length; }
      s += n;
    }
    return { c, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  return scored.slice(0, topN).map((x) => x.c);
}
