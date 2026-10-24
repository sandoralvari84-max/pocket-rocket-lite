# Logic / correctness tests (no device needed)

Standalone Node tests that verify the app's DETERMINISTIC logic — the architecture rule
is "code owns correctness, not the model," so these prove it. Each replicates the exact
shipped logic and asserts known outcomes. Run from the repo root with Node 18+:

    node tools/tests/run-all.mjs      # all
    node tools/tests/<file>.mjs       # one

- `tools-math.mjs` — Diet calorie/macro scaling + daily totals + goal %, Fitness volume
  & best weight, Grocery counts.
- `converter.mjs` — length/weight/volume/temperature conversions + round-trip.
- `habits-streak.mjs` — consecutive-day streak (gaps, today-pending, stale).
- `rag-retrieval.mjs` — knowledge-pack retrieval (niche targeting, cross-niche, empty).
- `tictactoe-unbeatable.mjs` — EXHAUSTIVE proof the Three-in-a-Row AI never loses (all
  569 terminal lines; 0 human wins).
- `fourup-ai.mjs` — Four-Up takes immediate wins, blocks horizontal & vertical threats,
  prefers winning over blocking.

These test the LOGIC; on-device feel/layout is separate (see CONTENT_BUILD_CHANGELOG.md).
