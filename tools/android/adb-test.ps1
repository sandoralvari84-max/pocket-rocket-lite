# Pocket Rocket Lite — adb test helper (real device or emulator).
# No secrets printed. Screenshots use pull (adb '>' corrupts binary on PowerShell).
param(
  [Parameter(Position = 0)]
  [ValidateSet('devices','install','launch','screenshot','logcat','smoke','help')]
  [string]$cmd = 'help',
  [string]$apk,
  [string]$name = (Get-Date -Format 'yyyyMMdd-HHmmss')
)
$ErrorActionPreference = 'Stop'
$ADB = 'D:\android\platform-tools\adb.exe'
$PKG = 'com.asandor.pocketrocketlite'   # android.package (unchanged); NOT the brand name
$root  = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$shots = Join-Path $root 'artifacts\screenshots'
$logs  = Join-Path $root 'artifacts\logs'
New-Item -ItemType Directory -Force $shots, $logs | Out-Null

function Need-Device {
  $d = & $ADB devices | Select-String -Pattern "`tdevice$"
  if (-not $d) {
    Write-Host "No authorized device/emulator detected."
    Write-Host "Connect a phone with USB debugging enabled and tap 'Allow', or start an emulator (Path B)."
    exit 1
  }
}

switch ($cmd) {
  'devices' { & $ADB devices -l }
  'install' {
    if (-not $apk) { throw "-apk <path-to-apk> required" }
    Need-Device; & $ADB install -r $apk
  }
  'launch' { Need-Device; & $ADB shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 | Out-Null; "launched $PKG" }
  'screenshot' {
    Need-Device
    $out = Join-Path $shots "$name.png"
    & $ADB shell screencap -p /sdcard/prl-sc.png
    & $ADB pull /sdcard/prl-sc.png $out | Out-Null
    & $ADB shell rm -f /sdcard/prl-sc.png
    "saved $out"
  }
  'logcat' {
    Need-Device
    $out = Join-Path $logs "$name.txt"
    & $ADB logcat -d > $out
    & $ADB logcat -d -b crash > (Join-Path $logs "$name.crash.txt")
    "saved $out (+ .crash.txt)"
  }
  'smoke' {
    Need-Device
    if ($apk) { & $ADB install -r $apk }
    & $ADB shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 | Out-Null
    Start-Sleep -Seconds 6
    $out = Join-Path $shots "smoke-$name.png"
    & $ADB shell screencap -p /sdcard/prl-sc.png
    & $ADB pull /sdcard/prl-sc.png $out | Out-Null
    & $ADB shell rm -f /sdcard/prl-sc.png
    "smoke screenshot: $out"
  }
  default {
    @"
Pocket Rocket Lite - adb test helper
  powershell -File tools/android/adb-test.ps1 <cmd> [-apk <file>] [-name <label>]

  devices                  list connected devices
  install -apk app.apk     install/replace the APK
  launch                   launch the app
  screenshot [-name x]     capture screen -> artifacts/screenshots/
  logcat [-name x]         dump log + crash buffer -> artifacts/logs/
  smoke -apk app.apk       install, launch, wait 6s, screenshot

Device setup: Settings > About > tap Build number 7x > Developer options >
enable USB debugging; plug in USB; tap 'Allow' on the phone.
"@
  }
}
