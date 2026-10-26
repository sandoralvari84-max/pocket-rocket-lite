# Wake word & light background listening — spec

> Goal (owner): run light in the background and wake on a spoken phrase ("Hey Buddy") to
> pull up the interface ready for a command. Owner build: on. Shipped: opt-in, off by
> default. NATIVE + battery/OS-sensitive — can only be built and tested on the device.

## The light-vs-always-on architecture (the key idea)
Two tiers, so "always listening" stays light:
1. **Always-on: a tiny wake-word model** in a foreground microphone service. It only
   listens for the one phrase — a few % CPU, small RAM, no transcription. The ~1GB LLM
   stays UNLOADED.
2. **On wake:** foreground the app → start full STT (whisper.rn) for the actual command →
   load the 1.5B only now (on-demand) → run the capability dispatcher. Unload/idle after.

So the heavy model never runs continuously (matches the earlier "full-time feasible if the
model stays on-demand" call). Everything stays on-device/offline.

## Wake-word engine options (evaluate on-device)
- **Porcupine (Picovoice)** — best-in-class offline wake-word, custom "Hey Buddy" keyword
  via their console, RN binding exists. ⚠️ Licensing: free personal tier, paid for
  commercial/shipping — decide before shipping.
- **openWakeWord / precise / Vosk keyword-spotting** — open-source, free, offline; lower
  accuracy / more false-accepts, needs tuning. No license cost.
- Recommendation: prototype with Porcupine's free tier for quality, keep an open-source
  fallback in mind for the shipped build's licensing.

## Android reality (why this is the heaviest feature)
- **Foreground service, type `microphone`** (Android 14+ requires the type) with a
  **persistent notification** — unavoidable for background mic.
- Permissions: `RECORD_AUDIO`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`,
  `POST_NOTIFICATIONS`; plus the user must **exempt the app from battery optimization**
  (OEM battery managers — Samsung/Xiaomi — will otherwise kill it).
- Prebuilt `android/` + a new Kotlin service (sibling to the existing NotifListenerService);
  register in MainApplication; manifest service + permissions by hand (no blind prebuild).
- Native-module work; verify only via a device rebuild.

## Flow
wake-word service detects "Hey Buddy" → launch/foreground the app to the Buddy screen (or a
light overlay) → "listening…" → whisper STT captures the command → `detectCapability()` →
confirm (if side-effecting) → act → speak the reply. Timeout back to idle wake-listening.

## Privacy / builds
- Fully on-device; nothing recorded or sent. The mic buffer for wake detection is not
  stored; STT runs locally only after wake.
- **Owner build:** on by default. **Shipped:** OFF by default, explicit opt-in with a clear
  "this keeps the mic listening for the wake word" disclosure + the persistent notification;
  resolve the Porcupine licensing (or ship the open-source engine) first.

## Build order (device pass)
1. Pick the engine (Porcupine free vs openWakeWord), add the dep.
2. Kotlin foreground mic service + "Hey Buddy" model + permissions + battery-exempt prompt.
3. Wake → foreground → whisper → dispatcher wiring.
4. Battery/false-accept tuning on-device; opt-in toggle + notification.
