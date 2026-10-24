# Pocket Rocket Lite — overnight report (2026‑10‑24)

**Build tag in‑app:** `2026-10-24 · arcade-2`
**APK:** `android/app/build/outputs/apk/release/app-release.apk` (~171 MB) — **not yet installed** (phone was unplugged, as you asked).

> ⚠️ **Verification honesty:** the phone was off all night, so **nothing below is device‑verified**. Everything is **build‑only**: TypeScript (`tsc --noEmit`) clean and a full `assembleRelease` succeeded after each change. Feel/visuals still need a real play‑test — that's the first thing to do this morning.

---

## What I did (all committed, each on a green build)

### 1. Difficulty "intelligence" — start easy, ramp up
- **Road Hopper (your main complaint — "way too fast"):** level 1 is now clearly gentle.
  - `BASE_SPEED 0.62` slows the whole level‑1 pace ~38%.
  - Speed‑up per level softened (`+0.14/level`, was `+0.18`) **and capped** so late levels stay humanly playable.
  - Fewer cars per lane at the start (one sparser), filling in every couple of levels.
  - It already has **unlimited levels** with a smooth ramp — that's the "extra levels + progressing hardness" for this one.
- **Nibbler:** slower start + smoother climb (`185 − 3×score`, floor 85ms; was `150 − 4×score`). The growing snake does the rest.
- **Maze Muncher:** level 1 eased (base tick 195ms, floor 100ms); ghosts/speed still ramp per level.
- **Block Drop & Flipper:** left as‑is — you said "tetris good," and pinball difficulty is inherent. (Block Drop already ramps 800ms→85ms over its levels.)
- **Dot Catcher (now a shooter):** built a gentle→hard ramp from scratch (see below).

### 2. Arcade high‑score board with initials "tag"
- New persistent store `src/games/highscores.ts` (file‑backed, survives restarts) + `src/design/Scoreboard.tsx` overlay.
- **Top‑10 table**, and when you make the board a **classic 3‑letter initials entry** (▲/▼ per slot, like a cabinet). Your new row is highlighted; your last tag is remembered.
- Wired into **all 6 arcade games**: Road Hopper, Dot Catcher, Nibbler, Maze Muncher, Block Drop, Flipper Frenzy. **Putt Pal** too (ranked by *fewest* strokes, keeps its per‑hole scorecard).

### 3. Dot Catcher → vertical space shooter (as requested)
- Ship now **roams the whole lower half** of the screen (drag in X *and* Y), not just side‑to‑side.
- **Auto‑fires** plasma bolts upward (no fire button needed on touch).
- Descending enemies: **drones** (1 hit) and, at higher levels, **gunships** (3 hits). New owned sprites `drone/gunship/bolt` (`tools/art/gen_catch_shooter.py`).
- **Orbs are help‑only now** — catching one gives rapid‑fire / +1 life / +50 pts; missing one costs nothing.
- Lives + level ramp (every 8 kills), starts with slow sparse drones.
- Dropped `react-native-game-engine` from this screen in favour of the deterministic ref‑loop the other arcade games use.

**Commits (branch `master`, main repo `D:\skeptic-lite-build\skeptic-lite`):**
- `0421c89` visual pass (icons/emblem/nav) — the build you verified before unplugging
- `3777c09` arcade pass 1 (scoreboard infra, Road Hopper curve, shooter)
- `66871bf` arcade pass 2 (scoreboard on all arcade games, Nibbler/Maze easing)

---

## What I deliberately did **not** do, and why
- **Big Master‑Implementation features** (voice, dictaphone, calendar, food/pantry/recipes, training, knowledge packs) and the **flagged native subsystems** (translator / OCR / music) — I held off. They need scope decisions from you and, more importantly, **device verification I couldn't do with the phone off**. Shipping unverifiable half‑features would contradict "wake to a polished app." These remain Codex's handover job; the flagged three stay last, as instructed.
- **In‑play "HI‑SCORE" HUD readout** — skipped on purpose: it's a blind layout change I couldn't eyeball, and I didn't want to risk a cramped/broken HUD you can't see. Easy to add once we're looking at the screen together.
- **Codex workspace copy** (`Documents\Codex\PocketRocketLite`) — **left untouched.** It's still at baseline `bbe9a0e` but has **uncommitted local edits** (App.tsx, Home.tsx, VoiceChat.tsx, several games, model.ts, Settings.tsx). I couldn't tell if that's Codex's in‑progress work or an earlier partial sync, so I didn't overwrite it. **Decision needed:** how you want today's game work merged into the Codex copy.

---

## For this morning (suggested order)
1. **Plug in the phone and install** `app-release.apk` (tag should read `2026-10-24 · arcade-2`).
2. **Road Hopper** — confirm level 1 now feels playable, not frantic. If it's still too quick I can nudge `BASE_SPEED` down further (it's one constant).
3. Play each arcade game to **game‑over**, tag a score, confirm the **top‑10 board** looks right and persists after you relaunch.
4. **Dot Catcher shooter** — check the half‑screen movement feels good and the gentle start is actually gentle.
5. Tell me your read and I'll tune numbers + resume the bigger feature chunk with you awake to verify.

## Still open (awaiting you)
- **13 vs 14 games:** Twenty Questions is still de‑registered ("drop it for now"). Restore it, or keep 13?
- Scope for the next big chunk (features) + how to reconcile the Codex copy.

---

## Update — Codex's foundation work merged (same morning)
Codex had started on its copy and did useful **non‑game foundation** work. You said "games are as is," so I took only the parts that don't touch game mechanics/visuals and merged them onto the current main repo (tsc + release build green):
- **Model is now optional** — "Continue without AI setup" on the setup screen; the choice persists; games/tools work without the ~1 GB model; a "Set up local AI" row added in Settings to install it later.
- **Live clock context in chat** — each chat turn now gets the device's real date/time + timezone (model can answer "what's today?"), with date arithmetic explicitly reserved for app code.
- **Chat robustness** — mic start/stop and send are guarded against double‑taps; one controlled TTS utterance at a time (no stale callbacks); a missing model now shows a friendly "install it in Settings" message instead of a raw error.

**Not ported (honoring "games as is"):** Codex's game‑file tweaks, overlay entrance animation, and per‑control accessibility labels stay only in the Codex copy. Build tag is now `2026-10-24 · arcade-2+foundation`.
