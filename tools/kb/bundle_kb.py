#!/usr/bin/env python3
"""
Bundle the 13 knowledge-base niches (from the local-pocket-rocket-pack working copy
D:\local-expert-pack\kb) into the app as src/data/kb_packs.json, chunked by heading
for deterministic retrieval (RAG). The model never invents facts — it answers ONLY
from retrieved chunks. Owned content (user's own KB repo). Run: python tools/kb/bundle_kb.py
"""
import json
import os
import re

SRC = r"D:\local-expert-pack\kb"
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "src", "data", "kb_packs.json")
NICHES = ["business", "coding", "cybersecurity", "datascience", "design", "finance",
          "health", "legal", "marketing", "philosophy", "product", "software", "webdesign"]


def chunk_md(text):
    """Split a markdown doc into {heading, text} chunks by ## headings."""
    lines = text.splitlines()
    chunks = []
    cur_head = None
    cur = []
    title = None
    for ln in lines:
        if ln.startswith("# ") and title is None:
            title = ln[2:].strip()
            cur_head = title
            continue
        m = re.match(r"^##\s+(.*)", ln)
        if m:
            if cur and any(s.strip() for s in cur):
                chunks.append({"heading": cur_head or title or "", "text": "\n".join(cur).strip()})
            cur_head = m.group(1).strip()
            cur = []
        else:
            cur.append(ln)
    if cur and any(s.strip() for s in cur):
        chunks.append({"heading": cur_head or title or "", "text": "\n".join(cur).strip()})
    # keep only chunks with real content
    return [c for c in chunks if len(c["text"]) > 20]


def main():
    out = {"generatedFrom": "local-pocket-rocket-pack / kb", "niches": []}
    total_chunks = 0
    for niche in NICHES:
        d = os.path.join(SRC, niche)
        if not os.path.isdir(d):
            print("MISSING niche:", niche); continue
        files = []
        for fn in sorted(os.listdir(d)):
            if not fn.endswith(".md"):
                continue
            with open(os.path.join(d, fn), encoding="utf-8") as f:
                chunks = chunk_md(f.read())
            if chunks:
                files.append({"file": fn, "chunks": chunks})
                total_chunks += len(chunks)
        out["niches"].append({"id": niche, "title": niche.capitalize(), "files": files})
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    sz = os.path.getsize(OUT)
    print(f"wrote {len(out['niches'])} niches, {total_chunks} chunks, {sz//1024} KB -> {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
