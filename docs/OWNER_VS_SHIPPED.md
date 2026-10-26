# Owner build vs shipped build — capability policy & notes

Source of truth: `src/capabilities/build.ts` (`POLICY`, `OWNER_BUILD`, `defaultEnabled`,
`presentInShipped`, `shippedDiffNotes`). This doc is the human summary.

## Principle
Pocket Rocket Lite's identity is **on-device, private, fully offline, no telemetry**. That
is the *default* and the public promise. Online capabilities exist, but they are the user's
explicit, opt-in choice — and **the 1.5B model itself never goes online**: it stays local
and only *triggers* an online action the app performs (usually a hand-off to the user's own
apps). It gains hands, it does not become a cloud model.

## THIS build = OWNER (`OWNER_BUILD = true`)
Everything on, maximal capability, including the online ones. The owner is fine with online
access, so it's enabled by default here.

## SHIPPED (public) build — how it differs
| Capability | Owner | Shipped | Note |
|---|---|---|---|
| alarms, timer, directions, scan/OCR, photos, health, reminders, contacts, draft SMS, location, notifications | on | on | identical — all offline / hand-off, no network |
| **play_youtube** | on | **off until opt-in** | deep-links to the YouTube app (hand-off, no keys) |
| **web_search** | on (may fetch+summarize) | **off until opt-in; hand-off only** | opens the browser with the query; shipped must NOT fetch/summarize without a chosen provider + its own separate opt-in |
| **email_draft** | on | **off until opt-in** | `mailto:` draft in the user's mail app — no stored credentials; confirm before opening |
| **read_inbox** | on | **DISABLED in v1** | reads the mailbox (Gmail/IMAP) — most sensitive; needs a deliberate provider + dedicated heavy opt-in + data-flow explanation before it ships |

Always true in both builds:
- Side-effecting actions (alarm, timer, reminder, email/SMS draft) **confirm** before running.
- No telemetry; the model runs locally; offline is the default.
- Online capabilities show a clear **"this leaves your phone"** prompt the first time.

## Shipping checklist (before the public build)
1. Set `OWNER_BUILD = false` (flips online defaults to off).
2. Add the per-capability opt-in toggles + first-use "leaves your phone" consent screen.
3. Keep `read_inbox` out (presentInShipped === false) until its provider + heavy opt-in exist.
4. For `web_search`, ship the hand-off executor only (no fetch/summarize) unless the
   fetch+summarize provider and its opt-in are finished.
