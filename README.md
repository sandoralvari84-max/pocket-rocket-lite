<div align="center">

# 🚀 Pocket Rocket Lite

**A fully-offline AI companion and 13-game retro arcade that runs a 1.5B language model entirely on your phone.**

No cloud. No account. No data leaves the device.

> **Status — early public preview.** Presentable and fully explorable today: the retro arcade, the on-device assistant, the tools and the live persona UI all work on-device. A handful of polish updates (voice tuning, a couple of game passes, UX refinements) still land before the final release. Look around and poke at it.

![Platform](https://img.shields.io/badge/platform-Android-3DDC84?logo=android&logoColor=white)
![Runs offline](https://img.shields.io/badge/runs-100%25%20offline-FF9800)
![On-device LLM](https://img.shields.io/badge/LLM-on--device%201.5B-00E5FF)
![Expo SDK 54](https://img.shields.io/badge/Expo-SDK%2054-000020?logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?logo=react&logoColor=white)

</div>

---

Pocket Rocket Lite is a little AI buddy that lives on your phone — it talks, plays, remembers, and helps — and it does all of it **without ever touching the internet**. The language model, the speech-to-text, the text-to-speech, the games, the knowledge: everything runs on-device.

It was built to answer one question:

> **How much can you actually squeeze out of a *tiny* model on *cheap* hardware?**

## The idea: the model is the mouth, the app is the brain

A 1.5B model is small. On its own it's unreliable at facts, math, and following instructions. So Pocket Rocket **doesn't ask it to be smart** — it asks it to be *natural*, and moves everything that has to be *right* — dates, math, scoring, tool-triggering, retrieval — into deterministic app code, leaving the model only the free-form phrasing:

- **Dates, math, scoring, timers, reminders** → resolved by the app, never guessed by the model.
- **Device capabilities** (alarms, directions, health, photos, OCR, translate…) → triggered by a **deterministic intent dispatcher** that reads *your words*, not the model's output — so tool-use is reliable even on a 1.5B.
- **Knowledge** → retrieval-augmented from bundled, owned knowledge packs; the model phrases, it doesn't invent.

The result: the companion **feels far smarter than its size**, stays **reliable**, and runs **100% offline**. The model is swappable — because the brains live in the app, you can drop in a bigger model later and nothing underneath breaks.

## What's inside

| | |
|---|---|
| 🧠 **On-device companion** | Two personalities, an emoting voice-bar interface, owner memory, voice in/out — all local |
| 🕹️ **13-game arcade** | Rocket Raid (shmup w/ 8 bosses), Maze Muncher, Road Hopper, Fleet Hunt, Flipper Frenzy, Putt Pal, Block Drop, Word Gallows, and more — with **original, hand-generated art** |
| 🧰 **Phone capabilities** | Alarms, timers, directions, OCR scan, health, reminders, contacts, notifications — consent-gated, offline-first |
| 🌐 **Optional online (opt-in)** | YouTube, web search, email draft — **off by default**, your explicit choice, clearly labelled |
| 🗣️ **On-device translator** | Text, speech, and a hands-free two-way "on the table" conversation mode — offline |
| 🔒 **Private by design** | No telemetry, no account, no cloud. Everything stays on your phone. |

## Built for low-end hardware

This isn't a flagship-phone showpiece — it's deliberately engineered for **cheap, low-RAM Android phones**: the model loads on-demand and releases after use, one heavy task runs at a time, effects degrade gracefully. The whole point is accessible, private AI on hardware people actually own.

## Tech

React Native 0.81 (New Architecture) · Expo SDK 54 · TypeScript · **llama.rn** (on-device GGUF inference) · **whisper.rn** (on-device STT) · expo-speech (TTS) · expo-notifications (local reminders) · react-native-game-engine · all art generated in-repo with Python + Pillow (fully owned, CC0).

## Status

**v1 baseline — actively testing on-device.** The console, all 13 games, the capability framework, and the owner/shipped build split are built and committed; the design is documented under [`docs/`](docs/) (see the [product brief](docs/PRODUCT_BRIEF.md), [owner-vs-shipped policy](docs/OWNER_VS_SHIPPED.md), and the per-game specs).

Recently landed: **streaming voice chat**; a **live currency converter** (offline-cached FX rates); **device-capability actions wired into chat** — a tap-to-confirm chip that fires timers, directions, message/email drafts, YouTube/web hand-offs, translate and reminders straight from what you type; and **real timer + calendar reminder notifications** that fire even when the app is closed. Still in progress: on-device voice *input* (recorder-format fix), the notification-reader native module, OCR, and bundling the model into the APK. This is a living project — v2 evolves with real testing, including swapping in a larger model.

## Roadmap

- On-device playtest + feel/balance pass across all 13 games
- ✅ Capability actions wired into chat (timers, directions, drafts, YouTube/web, translate, reminders) + real timer/calendar notifications
- Remaining native pieces: on-device voice input (PCM recorder), the notification-reader service, OCR, and bundling the model
- "Hey Buddy" light background wake word → pull up and listen (see [`docs/WAKE_WORD.md`](docs/WAKE_WORD.md))
- Larger-model tier for better hardware (the architecture is model-agnostic)

## About the creator

I'm a self-taught, solo developer building **local-first, private AI that runs on affordable hardware** — because useful AI shouldn't require a subscription, an account, or sending your life to someone else's servers. Pocket Rocket Lite is me finding out how far that idea goes on a tiny model and a cheap phone.

I'm building in the open and would genuinely love to connect with people working on local/edge AI, on-device inference, and privacy-first tools.

- GitHub: [@sandoralvari84-max](https://github.com/sandoralvari84-max)
<!-- TODO: add your other links — X/Twitter, Mastodon, site, Discord — e.g.: -->
<!-- - X: [@yourhandle](https://x.com/yourhandle) -->

**Stars, issues, ideas and a follow all genuinely help a solo builder with no network get this in front of people — thank you for reading this far.** ⭐

## License

See [LICENSE](LICENSE).
