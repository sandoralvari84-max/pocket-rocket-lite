# Content Build — levels / mechanics / bosses (unattended)

Running changelog for the depth pass across the game library. Built to the
bundle-check / logic-test bar while the phone is off adb. **"Awaiting device
verification"** = feel, difficulty pacing, performance, touch — only a real-device
pass confirms these. Go through this game-by-game at the finish line.

Legend: ✅ verified in code/bundle · 🕹️ awaiting device verification

| Game | What was built | Verified (bundle / logic) | Needs real-device |
|---|---|---|---|
| **Dot Catcher** (shooter) | Wave progression (clear-to-advance); **boss every 5th wave** (descends, strafes, fires aimed 3-way spreads, HP bar); 3 enemy types (drone / weaver-sine / gunship that **shoots**); enemy bolts to dodge; **spread-shot** power-up (+ existing rapid/life/points); wave + "BOSS INCOMING" banners. All state deterministic. | ✅ tsc clean · ✅ expo export bundle (777 modules) · ✅ deterministic wave/boss/score logic reviewed | 🕹️ difficulty pacing, boss fight balance, dodge feel, perf with many entities, touch |
