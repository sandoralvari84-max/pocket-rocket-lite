// Offline RAG retrieval must be deterministic, bounded, and must decline (return nothing) rather
// than surface noise. These lock the retriever's contract without depending on exact pack wording.
import { searchKB, listNiches } from "../data/kb";

describe("RAG retrieval (searchKB)", () => {
  it("bundles the expected knowledge packs", () => {
    const niches = listNiches();
    expect(niches.length).toBeGreaterThanOrEqual(10);
    expect(niches.every((n) => n.chunks > 0)).toBe(true);
  });

  it("returns [] for stopword-only / empty queries (honest decline)", () => {
    expect(searchKB("the a an of to and")).toEqual([]);
    expect(searchKB("")).toEqual([]);
  });

  it("finds relevant chunks for an in-domain query", () => {
    const r = searchKB("marketing", "marketing");
    expect(r.length).toBeGreaterThan(0);
  });

  it("never returns more than topN", () => {
    const r = searchKB("business strategy plan revenue growth", "business", 4);
    expect(r.length).toBeLessThanOrEqual(4);
  });

  it("is deterministic", () => {
    const a = searchKB("design principles layout", "design");
    const b = searchKB("design principles layout", "design");
    expect(a.map((c) => c.heading)).toEqual(b.map((c) => c.heading));
  });

  it("excludes bare 'Sources' boilerplate chunks from answers", () => {
    const r = searchKB("sources references");
    expect(r.every((c) => c.heading.toLowerCase().trim() !== "sources")).toBe(true);
  });
});
