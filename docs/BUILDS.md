# Builds — test build vs. consumer product

Pocket Rocket Lite is produced in two build profiles from a single codebase. The behavioural
difference is governed by one flag — `OWNER_BUILD` in
[`src/capabilities/build.ts`](../src/capabilities/build.ts) — and the public profile additionally
applies the distribution-hardening steps listed below. The capability-by-capability policy lives
in [OWNER_VS_SHIPPED.md](OWNER_VS_SHIPPED.md); product principles in [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md).

## The two profiles

### 1. Full build — development / demo (`OWNER_BUILD = true`)
The complete, maximal-capability build used for development, benchmarking and demos. Every
capability is enabled, including the opt-in online hand-offs (YouTube, web search, email draft)
and the owner-only inbox reader. **Not intended for public distribution.**

### 2. Consumer product — public release (`OWNER_BUILD = false` + hardening)
The build intended for end users. It keeps the core promise — **on-device, offline by default,
no telemetry** — and makes every network-touching capability an explicit, per-feature opt-in. It
is additionally hardened for distribution (least-privilege permissions, backups disabled,
arm-only binaries).

## What differs

| Area | Full build | Consumer product |
|---|---|---|
| Online capabilities (YouTube / web / email) | on by default | **off until the user opts in**, per capability |
| Inbox reader (`read_inbox`) | available (owner only) | **not present** |
| Default posture | maximal capability | offline-first, least-privilege |
| Telemetry | none | none |
| On-device model | local only | local only |

Always true in **both** builds: the model never goes online (it only *triggers* an action the
app performs); side-effecting actions confirm before running; online features show a clear
“this leaves your phone” notice on first use.

## What ships, and how

- **Artifact:** a signed Android APK, `arm64-v8a`. The product targets affordable Android
  hardware, so release binaries are arm-only — `x86`/`x86_64` serve emulators only and are
  excluded to keep the sideloaded download small.
- **Model delivery:** the GGUF model is **not** bundled in the APK (keeps the app small and lets
  the user pick their model). It is shared alongside the app and imported on first run, or
  downloaded once over Wi-Fi — then the app is fully offline, forever.
- **Distribution:** direct APK (QuickShare / sideload) for previews; an Android App Bundle via
  the Play Store for general release.

## Build commands

Development / test build (local, arm64), with the Android SDK + JDK 17 on `PATH`:

```bash
# from the project root
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
# → android/app/build/outputs/apk/release/app-release.apk
```

The consumer release build is the same command after completing the release checklist below.
Cloud builds use EAS (`eas build -p android`).

## Release checklist — consumer product

Before cutting a public build:

1. `OWNER_BUILD = false` — flips online capabilities to opt-in.
2. Per-capability opt-in toggles + the first-use “leaves your phone” consent screen are in place.
3. `read_inbox` held out (`presentInShipped === false`) until its provider + dedicated opt-in exist.
4. `web_search` ships hand-off-only (opens the browser; no fetch/summarise) unless the provider
   and its separate opt-in are finished.
5. The manifest carries only the permissions the shipped features actually use; development-only
   permissions stay in the debug manifest.
6. `android:allowBackup="false"` (or a data-extraction exclude set) so on-device user data is not
   copied off-device by system backup — consistent with the offline promise.
7. Any network-capable helper (e.g. live FX rates) is gated behind the same online opt-in.
8. `versionCode` / `versionName` bumped.

Privacy posture is the product, not a setting: the consumer build asks for the least it can,
keeps data on the device, and makes every byte that would leave the phone an explicit choice.
