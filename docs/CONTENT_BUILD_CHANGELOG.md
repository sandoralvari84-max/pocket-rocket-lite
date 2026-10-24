# Content Build — levels / mechanics / bosses (unattended)

Running changelog for the depth pass across the game library. Built to the
bundle-check / logic-test bar while the phone is off adb. **"Awaiting device
verification"** = feel, difficulty pacing, performance, touch — only a real-device
pass confirms these. Go through this game-by-game at the finish line.

Legend: ✅ verified in code/bundle · 🕹️ awaiting device verification

| Game | What was built | Verified (bundle / logic) | Needs real-device |
|---|---|---|---|
| **Dot Catcher** (shooter) | Wave progression (clear-to-advance); **boss every 5th wave** (descends, strafes, fires aimed 3-way spreads, HP bar); 3 enemy types (drone / weaver-sine / gunship that **shoots**); enemy bolts to dodge; **spread-shot** power-up (+ existing rapid/life/points); wave + "BOSS INCOMING" banners. All state deterministic. | ✅ tsc clean · ✅ expo export bundle (777 modules) · ✅ deterministic wave/boss/score logic reviewed | 🕹️ difficulty pacing, boss fight balance, dodge feel, perf with many entities, touch |

## Tools capabilities (13 consumer niches) — reprioritized ahead of games content

Scope confirmed with user: the 13 consumer tools (grocery/diet/fitness/budget/calendar/
habits/water/sleep/measurements/meal-planner/recipes/timers/converter). Separately, the
13 GitHub KB niches become **RAG** knowledge buckets the chat model retrieves from (next).

| Niche | What was built | Verified | Needs real-device |
|---|---|---|---|
| **Grocery** (#1) | Shopping list: add item + qty + category (8 cats), grouped view, check-off, clear-in-cart. Counts (to-buy / in-cart / total) deterministic. `data/store` collection, offline. | ✅ tsc · ✅ bundle (782) · ✅ logic test (counts) | 🕹️ layout/feel, keyboard |
| **Diet** (#2) | Food log over a bundled 48-food reference table; calories + macros scaled deterministically (round(v·g/100)), daily total vs an adjustable goal, today's entries. | ✅ tsc · ✅ bundle · ✅ logic test (scaling, totals, goal %) | 🕹️ feel; food-table coverage is reference data, verify values |
| **Fitness** (#3) | Workout log over a bundled 36-exercise list; training volume (sets×reps×weight) + best-weight per exercise, deterministic; today's sets. | ✅ tsc · ✅ bundle · ✅ logic test (volume, best) | 🕹️ feel |

All three: correctness is deterministic code; no model involvement. Wired into Tools +
Home routes; de/es for headline strings (data-term labels fall back to English this pass).
**Held for confirmation:** consumer tools #4–13 (budget/calendar/habits/water/sleep/
measurements/meal-planner/recipes/timers/converter) — confirm scope + order.

## RAG — Experts tool over the 13 GitHub knowledge packs

| Feature | What was built | Verified | Needs real-device |
|---|---|---|---|
| **Experts** (RAG) | 13 KB niches bundled (`kb_packs.json`, 374 chunks, 166 KB) + deterministic keyword retrieval (`data/kb.ts`). New Experts screen: niche filter (All + 13) → ask → **grounded** answer (model phrases ONLY retrieved passages, cites source) OR, with no model installed, the matching passages shown directly. `askExpert()` in model.ts (temp 0.3, answer-only-from-notes system prompt). Wired into Tools + Home. | ✅ tsc · ✅ bundle (785) · ✅ retrieval logic test (niche targeting, cross-niche, empty/nonsense) | 🕹️ grounded-answer QUALITY with the model on device (retrieval is deterministic & tested; model phrasing needs the ~1 GB model loaded) |
