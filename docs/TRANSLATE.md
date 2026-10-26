# Translator — text, speech & two-way conversation (on-device, offline)

> Owner: translate text OR speech (through the dictaphone/STT), multi-language, and a
> hands-free "leave it on the table" **two-way conversation** translator. All on-device.

## On-device offline stack (no network)
- **STT:** whisper.rn (already in the app) — speech → text.
- **Translate:** ML Kit on-device Translation — ~50+ languages, downloadable packs, offline
  once a pack is installed.
- **Language ID:** ML Kit Language Identification — detect which language was spoken.
- **TTS:** expo-speech (already in the app) — speak the translation aloud.

## Modes
1. **Text** — type → translate → show (+ optional speak). The `translate` capability already
   detects "translate X to <lang>" / "how do you say X in <lang>".
2. **Speech (dictaphone)** — tap the mic → whisper STT → translate → show + speak the result.
   Reuses the existing dictaphone/STT path.
3. **Two-way conversation ("on the table")** — hands-free. Pick two languages (A ↔ B) once.
   The phone listens continuously; for each utterance: STT → **identify language** → translate
   into the *other* language → **speak it aloud** → keep listening. Big split UI showing both
   sides of the conversation; either person just talks and hears the translation.

## Conversation-mode design notes
- **Turn-taking** is the tricky part: detect end-of-utterance by a silence gap (VAD / RMS
  threshold on the mic), transcribe that chunk, then respond. Tune the gap on-device.
- **Language routing:** run ML Kit language-ID on the transcript; if it's language A → output
  B (and vice-versa). Fallback: if ID is unsure, use the last speaker's opposite language.
- **Continuous mic** while the conversation screen is open → foreground mic (like the wake
  word, but only while this screen is active, not a global background service). Battery note:
  only runs on this screen; whisper runs per-utterance, not continuously.
- Mishears happen — show the recognized source text so people can see/correct.

## Setup / packs
- First use of a language downloads its ML Kit pack (one-time, needs network just to fetch
  the pack); after that it's fully offline. Pre-download the owner's common languages.
- Conversation mode: a quick A/B language picker + "download packs" step.

## Builds
- Offline; on in both owner + shipped builds. Needs the ML Kit Translate + Language-ID deps
  + a Translator screen (+ conversation mode). Native deps → wire + test at the device pass.

## Build order (device pass)
1. Add ML Kit Translate + Language-ID deps; Translator screen with Text + Speech modes.
2. Pack download/management UI.
3. Conversation mode: VAD turn-taking + language routing + speak-aloud + split UI + tuning.
