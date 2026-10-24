# AI-buddy feature readiness — what each needs + how close
How ready the roadmap capabilities are and what (if any) external software they need.
Foundation already shipped: **local data layer** (`src/data/store.ts`), **model-optional**
chat, **Dictaphone/Notes**, **clock context**. So most features = a focused build on that
layer, NOT new infrastructure. Legend: 🟢 pure on-device code (+ existing data layer) ·
🟡 code + a FREE API/Expo module · 🔴 needs an on-device model/native lib (heavier).

| Feature | How | External software? | Readiness |
|---|---|---|---|
| **Owner memory / preferences** | preferences + user-approved "facts" store on the data layer; fed to the model as context (like the clock context already does). Deterministic recall, user edits/clears. | None | 🟢 Core infra — build first; everything else leans on it |
| **Calendar / reminders** | events on the data layer + local notifications | 🟡 `expo-notifications` (free Expo module) | 🟡 Small build |
| **Budget** | accounts/transactions on the data layer + **tested deterministic math** (never AI for sums); multi-currency | 🟡 **Open ER-API** ✅ (keyless FX, validated) | 🟡 Straightforward |
| **Food / pantry / recipes** | pantry + recipes + grocery list on the data layer; LLM suggests recipes from what's in | 🟡 **OpenFoodFacts** (free, no key — barcode→nutrition) optional | 🟡 Medium |
| **Fitness / training** | routines + workout logs + progress on the data layer; deterministic calcs | 🟡 optional free exercise DB (wger API / bundled JSON) | 🟡 Medium |
| **Drafting** | templates + the on-device model (chat already works); saved to Notes | None | 🟢 Quick |
| **Chat history** | persist conversations on the data layer | None | 🟢 Quick |
| **Offline translator** | on-device translation | 🔴 **ML Kit Translation** (free) via `react-native-vision-camera-ocr-plus`, or Bergamot models | 🔴 Needs native lib (from the arsenal) |
| **OCR** | on-device text recognition | 🔴 **`react-native-nitro-ocr`** (Apple Vision + ML Kit, ~3.5 MB) | 🔴 Needs native lib |
| **Music / radio** | local playback + optional radio | 🔴 `expo-audio` (have it) + background-playback config; radio = online | 🔴 Flagged last |
| **Knowledge packs** | condensed pack content + retrieval over the data layer | 🟡 content via Wikipedia/Wikidata ✅ + Pollinations-text ✅, condensed for the tiny model | 🟡 Content-gated |
| **Neural TTS voices (Sentinel/Nova)** | replace system TTS with real voices | 🔴 `react-native-tts-kit` / Piper (ONNX) | 🔴 Optional upgrade |

## Summary for "ready soon"
- **No heavy external software** for the everyday set — **food, fitness, budget, calendar,
  drafting, chat history, and owner-memory/preferences are pure on-device code** on the data
  layer that already exists, plus a couple of **free** bolt-ons (expo-notifications; Open ER-API
  ✅; OpenFoodFacts). Each is a focused feature build, shippable incrementally.
- **Build order:** owner-memory/preferences first (core infra others use) → chat history →
  drafting → calendar → budget → food → fitness → (then the flagged native: translator/OCR/music).
- **The 🔴 ones** (translator, OCR, music, neural TTS) need an on-device model/native library —
  all identified + free in `D:\ai-toolkit\VALIDATED_ARSENAL.md` (ML Kit, nitro-ocr, Piper) — bolt
  on after the code-only features; verify licence + benchmark on the target device first.

Each feature: build on the data layer, deterministic code for any sums/dates/records (never
the model), verify the real outcome on device, keep it offline-first. See PRODUCT_BRIEF §5.
