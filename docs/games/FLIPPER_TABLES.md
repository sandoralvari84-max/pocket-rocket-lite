# Flipper Frenzy — Three Tables, Three Stories

Design goal: **pinball-level depth** — tables you learn over hundreds of plays. Each table
is a *story* told through modes you light and complete, building to a **wizard mode**.
Shared skeleton (so the physics engine is reused): two flippers + drain, two slingshots,
a plunger lane (right), a pop-bumper cluster, a ramp or two, a drop-target bank, a
lock scoop, and **one hidden tunnel** that re-routes the ball. Themes are *ours* — the
Pocket Rocket world (90s sci-fi utopia, Sentinel = amber/analyst, Nova = cyan/companion).

Scoring language shared by all tables:
- **Pop bumpers** 100 (×10 when its mode is lit) · **Slings** 50
- **Drop-target bank** (3) 250 each, clear all → **lights LOCK**
- **Lock scoop** → ball 1/2 locked; 2 locks → **MULTIBALL**
- **Ramp(s)** 500, combo within 3s escalates ×2 ×3 · **Spinner/orbit** 25/rev
- **Hidden tunnel** → 1,000 + routes to the upper playfield (a "steal")
- **Jackpot** (during multiball) starts 5,000, +1,000 each, **Super Jackpot** at the ramp

Every table has **5 mode inserts** (lit by the drop bank / orbits); light all 5, then the
lock scoop starts the **WIZARD MODE** (all balls, every shot scores, big timed total).

---

## TABLE 1 — "SENTINEL STATION"  (deep space · amber/cyan)
**Story:** You dock a scout ship at Sentinel Station as a meteor swarm closes in. Power
the reactor, launch the defense fleet, and ride the wormhole out before the station falls.

**Playfield**
- Upper-left **pop-bumper cluster** = the meteor field (balls rattling = meteors).
- Center **REACTOR** (3-drop bank): clear it to charge a core segment; 3 charges → LOCK.
- Right **WORMHOLE SCOOP** = lock + mode start.
- Left **ORBIT LANE** loops the top (spinner) → feeds right inlane.
- Right **FLEET RAMP** (the launch tube) → jackpot during multiball; combo = squadron bonus.
- **Hidden tunnel: WARP CONDUIT** — a lane behind the reactor; a hard left-orbit shot drops
  the ball into it and spits it out at the right upper flipper (steal a shot at the ramp).

**Modes (light all 5 → wizard):** DOCKING (skill plunge) · METEOR STORM (timed bumper
frenzy) · POWER CORE (3 reactor clears) · LAUNCH FLEET (3 ramp combos) · DISTRESS CALL
(orbit→scoop relay).
**Multiball:** REACTOR MULTIBALL (2 locks). Jackpot = fleet ramp, Super = wormhole.
**Wizard — "ESCAPE VELOCITY":** 4-ball, 20s, every shot = jackpot, finish by hitting the
wormhole for the escape bonus.

**Ball flow:** plunge → top orbit → bumpers → down to flippers. Right ramp returns to right
inlane for the ramp-ramp combo. Reactor sits dead-center (risky — a miss drains).

---

## TABLE 2 — "HAUNTED KEEP"  (gothic castle · violet/green)
**Story:** Nova's signal is trapped inside a cursed keep. Ring the three bells to wake it,
raise the portcullis, descend the crypt, and banish the Warden to free her.

**Playfield**
- Top-center **PORTCULLIS GATE** (a drop target that rises): behind it, a **captive-ball bell**.
- Three **BELL targets** (standups) scattered mid-field — ring all 3 to raise the gate.
- **CRYPT SCOOP** (right) = lock + "descend".
- Left **TOWER RAMP** → the belfry (jackpot); a habit-trail combo rings the big bell.
- **Hidden tunnel: CRYPT PASSAGE** — under the gate; once the gate is up, a center shot
  falls into the crypt and returns on the *left* outlane side (a save + 1,000).

**Modes:** WAKE THE BELLS (3 bells) · RAISE THE GATE (gate target ×3) · GHOST HUNT (timed
bumpers, ghosts = lit) · CRYPT DESCENT (scoop→tunnel relay) · MOONLIGHT (spinner orbit).
**Multiball:** GRAVE MULTIBALL (gate open + 2 crypt locks). Jackpot = tower ramp.
**Wizard — "BANISH THE WARDEN":** all balls; the Warden (center) takes 6 hits, each hit = a
freed memory of Nova; banish him for the rescue bonus.

**Ball flow:** plunge → right orbit → gate area. The gate, when down, deflects to the
bumpers; when raised, opens the crypt tunnel line. Tower ramp returns left.

---

## TABLE 3 — "THE GRAND MACHINE"  (retro-arcade time journey · magenta/cyan neon)
**Story (the most *ours*):** A pilgrimage through the eras of games — 8-bit, 16-bit, the
arcade, and the future — collecting era tokens to boot up the legendary Grand Machine.
A love letter to the thousands of hours. Each era is a mode; light all four + the secret
era to start the Machine.

**Playfield**
- Four **ERA RAMPS/lanes** fanned across the top, each a neon colour: 8-BIT (green),
  16-BIT (amber), ARCADE (magenta), FUTURE (cyan). Completing a ramp = era token.
- Center **TOKEN REEL** (3-drop bank) banks tokens → LOCK.
- **MACHINE SCOOP** (right) = lock + era mode start.
- **Hidden tunnel: GLITCH WARP** — a flashing lane that only opens when you've lit 2 eras;
  shooting it "glitches" the ball to a random era ramp and awards a token for free.
- A left **SPINNER** = "insert coin" (credits that multiply the next era).

**Modes:** 8-BIT (simple, fast) · 16-BIT (ramp combos) · ARCADE (timed frenzy, high chaos) ·
FUTURE (precision, big single shots) · SECRET ERA (only via the Glitch Warp).
**Multiball:** ARCADE MULTIBALL (2 token locks). Jackpot cycles through era-coloured shots.
**Wizard — "THE GRAND MACHINE":** all balls; every era shot lit at once; a running
"generations" total; the final shot to the Machine scoop = the all-time high bonus.

**Ball flow:** plunge → the four era ramps fan from the top; the token reel is the
center risk; the glitch warp is the reward for mastering two eras.

---

## Build order (once designs are approved)
1. Table **data model**: `{ theme, bg, accents, segments[], bumpers[], ramps[], dropBank,
   scoop, tunnel, modes[5], multiball, wizard, scoring }` — the physics engine already
   reads geometry; we add `modes`/inserts + a small mode state machine per table.
2. One shared engine (flipper-frenzy.tsx) + a **table select** screen (3 cabinets).
3. Theme art per table (bumpers/ball/playfield via gen_flipper_art.py variants).
4. Tune feel on-device (the big one — multiple phone rounds, as the user flagged).
