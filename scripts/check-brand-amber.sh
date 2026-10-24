#!/usr/bin/env bash
# Brand guard: the locked Pocket Rocket shell amber is #FF9800 (rgb 255,152,0).
# It regressed to #FF9810 (255,152,16) twice in src/. This blocks it coming back.
set -u
hits=$(grep -rinE 'FF9810|255, *152, *16\b' src App.tsx app.json 2>/dev/null || true)
if [ -n "$hits" ]; then
  echo "Brand guard FAIL: forbidden amber #FF9810 / rgb(255,152,16) in app shell — use #FF9800 (255,152,0):"
  echo "$hits"
  exit 1
fi
echo "Brand amber OK (#FF9800)"
