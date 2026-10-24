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
| **Budget** (#4) | Income/expense log by category; monthly income, expenses, balance, and per-category breakdown all deterministic sums; single currency (€). Offline. | ✅ tsc · ✅ bundle (786) | 🕹️ feel; multi-currency FX (Open ER-API) is a later add |
| **Habits** (#6) | Daily check-in + consecutive-day streaks; streak = deterministic date math; done-today toggle. Offline. | ✅ tsc · ✅ bundle · ✅ logic test (streak incl. gaps, today-pending, stale) | 🕹️ feel |

All three: correctness is deterministic code; no model involvement. Wired into Tools +
Home routes; de/es for headline strings (data-term labels fall back to English this pass).
**Held for confirmation:** consumer tools #4–13 (budget/calendar/habits/water/sleep/
measurements/meal-planner/recipes/timers/converter) — confirm scope + order.

## RAG — Experts tool over the 13 GitHub knowledge packs

| Feature | What was built | Verified | Needs real-device |
|---|---|---|---|
| **Experts** (RAG) | 13 KB niches bundled (`kb_packs.json`, 374 chunks, 166 KB) + deterministic keyword retrieval (`data/kb.ts`). New Experts screen: niche filter (All + 13) → ask → **grounded** answer (model phrases ONLY retrieved passages, cites source) OR, with no model installed, the matching passages shown directly. `askExpert()` in model.ts (temp 0.3, answer-only-from-notes system prompt). Wired into Tools + Home. | ✅ tsc · ✅ bundle (785) · ✅ retrieval logic test (niche targeting, cross-niche, empty/nonsense) | 🕹️ grounded-answer QUALITY with the model on device (retrieval is deterministic & tested; model phrasing needs the ~1 GB model loaded) |

| **Water** (#7) | Daily cup tally vs goal; deterministic count; +/− + goal steppers, dot grid. | ✅ tsc · ✅ bundle (792) | 🕹️ feel |
| **Sleep** (#8) | Nightly hours; deterministic 7-night mean; one entry/night. | ✅ tsc · ✅ bundle | 🕹️ feel |
| **Measurements** (#9) | Weight/waist/body-fat; deterministic delta vs previous reading; per-metric history. | ✅ tsc · ✅ bundle | 🕹️ feel |
| **Timer** (#12) | Countdown off a target timestamp (drift-free); presets + adjust; haptic buzz at 0 (sound later). | ✅ tsc · ✅ bundle | 🕹️ haptics/feel on device |
| **Converter** (#13) | Length/weight/volume/temperature, exact factors, offline. | ✅ tsc · ✅ bundle · ✅ logic test (m↔ft, kg↔lb, C↔F↔K, gal→L, roundtrip) | 🕹️ feel; live currency FX = later add |

**Consumer tools: 10 of 13 built.** Remaining: Calendar (#5 — agenda is pure JS; reminder *notifications* need expo-notifications, a native rebuild), Meal-planner (#10), Recipes (#11).

### Flagged native tier (needs a native rebuild + on-device verification — NOT "lite")
- **Calendar reminders** — `expo-notifications` (config plugin + prebuild) to fire local notifications.
- **Notification reader** — a quiet background service woken from a button that reads incoming message/notification content aloud (on-device TTS). Needs a native **NotificationListenerService** + the user granting "Notification access". Fine for a sideloaded app.
- **"Lives with the phone" deep integration** (Tier‑2/3, user's vision 2026-10-24) — answer/read messages, calls, reach Android surfaces. Needs telephony/ConnectionService + Accessibility/quick-reply (RemoteInput). Heavy + Play-policy-sensitive; sideload makes it viable. Build after lite ships; see memory offline-voice-buddy-plan.
- **Privacy broker (Tier‑2):** route AI queries to another on-device AI via the phone integration so the app never makes its own network call ("exposes nothing"). Flagged.
- **Hardened memory vault:** encrypted second box (Keystore/SecureStore + crypto, biometric unlock) for sensitive data (memory/health/budget), safe even if the phone is compromised. Flagged.

| **Calendar** (#5) | Event agenda with deterministic date grouping (Today/Tomorrow/This week/Later); add w/ day stepper + quick picks. Reminder notifications flagged (native). | ✅ tsc · ✅ bundle (795) | 🕹️ feel; notifications later |
| **Meal planner** (#10) | Breakfast/lunch/dinner across a 7-day week strip; per-day slots, planned-count dots. Offline. | ✅ tsc · ✅ bundle | 🕹️ feel |
| **Recipes** (#11) | Save recipes (title/ingredients/steps) + **push ingredients to Grocery** (deterministic line-split). Offline. | ✅ tsc · ✅ bundle | 🕹️ feel |

**✅ All 13 consumer tools built.** Next per the user's plan: UI polish creative pass → games content (on device) → sounds → finalize.

## Games — audit + correctness verification (no device needed)

Audit finding: the arcade games already have real depth — Maze/Block Drop/Road Hopper
have levels, Nibbler a continuous speed+obstacle ramp, **Putt Pal a 5-hole course with
par/water penalties**, Dot Catcher waves+boss (this session), Fleet Hunt a hunt/target AI.
So the "content build" was largely already satisfied. Remaining game work is device-gated
feel/tuning (flipper) + sounds + the voice-bar EKG/wave swap.

Instead of churning working code unattended, **verified the deterministic turn-based AIs**
(the correctness the architecture rests on) with a re-runnable harness in `tools/tests/`:
- **Three-in-a-Row: PROVEN unbeatable** — exhaustive walk of every human line (569 terminal
  games, 0 human wins, 386 AI wins punishing blunders, 183 draws).
- **Four-Up: takes immediate wins, blocks horizontal & vertical threats, prefers winning.**
- Plus the earlier tool-math / converter / streak / RAG-retrieval suites. `node tools/tests/run-all.mjs`.
