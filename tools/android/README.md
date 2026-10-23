# Android testing (Path A: real device over adb)

`adb` lives at `D:\android\platform-tools\adb.exe`. Outputs go to `artifacts/` (gitignored).

## One-time device setup
1. Phone: Settings → About → tap **Build number** 7× to unlock Developer options.
2. Developer options → enable **USB debugging**.
3. Plug in USB, tap **Allow** on the phone when prompted.
4. Verify: `powershell -File tools/android/adb-test.ps1 devices`

## Build → install → test loop
1. Build an APK with the existing EAS workflow (unchanged):
   `eas build -p android --profile preview` → download the resulting `.apk`.
2. Install + launch + screenshot:
   `powershell -File tools/android/adb-test.ps1 smoke -apk <path-to.apk>`
3. Individual steps: `install -apk <f>` · `launch` · `screenshot -name home` · `logcat`.

## Typecheck (no device needed)
`node_modules\.bin\tsc.cmd --noEmit` (portable Node on PATH).

Expo Go cannot load this app's native modules (llama.rn / whisper.rn), so always
test a preview/dev APK, never Expo Go.
