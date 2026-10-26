import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Animated, Easing, Image, Dimensions, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, GameOverlay } from "../design/ui";
import { useSettings } from "../settings";

// Pen-and-paper on a tabletop: a single generated "paper on a wooden desk" photo
// (sheet_a.jpg — a cream sheet lying on a warm wooden desk with a pencil + eraser).
// The whole hangman puzzle is drawn on the paper; the letter keyboard sits on the
// wood below. Matches the family look shipped for three-in-a-row.
const SHEET = require("../../assets/arcade/paper/sheet_a.jpg"); // generated paper-on-table surface
const INK = "#27407E";      // blue biro — title / category accent
const RED = "#B23B3B";      // red pen — a missed letter revealed on a loss
const GRAPHITE = "#2A2A32"; // pencil graphite — the drawn figure, blanks, notes
const PENCIL = "#3A3730";   // softer graphite — muted notes
const TABLE = "#1C1109";    // deep warm wood (base of the desk, behind the sheet)

const MAX_WRONG = 6;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const { width: W, height: SCREEN_H } = Dimensions.get("window");
// The puzzle is drawn directly on the generated paper sheet. These map the paper's
// writing area (fractions of the art, inset to clear the curled top-left corner) to px.
const ART_AR = 784 / 1168;                          // sheet_a.jpg aspect
// Cap the sheet HEIGHT to an absolute max so the swipeable letter strip always sits
// above the nav bar, even on short screens. Keep the art's aspect ratio.
const MAX_SHEET_H = 360;
const _sheetW0 = Math.min(W - 24, 340);
const SHEET_H = Math.min(Math.round(_sheetW0 / ART_AR), MAX_SHEET_H);
const SHEET_W = Math.round(SHEET_H * ART_AR);
const PAP = { x0: 0.22, x1: 0.80, y0: 0.20, y1: 0.72 }; // paper writing rect (frac)
const papL = PAP.x0 * SHEET_W, papT = PAP.y0 * SHEET_H;
const papW = (PAP.x1 - PAP.x0) * SHEET_W, papH = (PAP.y1 - PAP.y0) * SHEET_H;

/* ------------------------------------------------------------------ *
 * Hand-drawn figure geometry (all Views — no sprites, no SVG).
 * A minimal gallows: one top beam + a short rope + a little noose.
 * The emphasis is the stickman, NOT the structure — per the brief,
 * no tall upright / base, just a beam the noose hangs from.
 * ------------------------------------------------------------------ */
const FIGW = 150;
const FIGH = 152;
const BEAM_W = 118;
const BEAM_H = 6;
const ROPE_LEN = 28;
const HEAD_D = 24;
const BODY_H = 44;
const ARM_L = 28;
const LEG_L = 36;
const LIMB_W = 5;
const PERSON_H = HEAD_D + BODY_H + LEG_L; // head-top (0) down to foot
const GW = 70;                            // swing-group / person box width
const GH = ROPE_LEN + PERSON_H;           // hanging group height (rope + body)
const GROUP_LEFT = (FIGW - GW) / 2;        // centred under the beam
const GROUP_TOP = BEAM_H;                   // hangs just below the beam
const PERSON_TOP = GROUP_TOP + ROPE_LEN;    // where the head sits when hung

// The gallows figure is scaled down so category + figure + word blanks fit the paper
// writing rect without spilling onto the wood or under the keyboard (worst case: an
// 8-letter word that wraps to two rows on a 320px-wide screen). The negative margin
// reclaims the vertical space the scale removes, so the column packs tightly.
const FIG_S = 0.62;                                   // gallows figure scale on paper
const FIG_MV = -Math.round((FIGH * (1 - FIG_S)) / 2); // reclaim scaled-away height

interface Secret {
  word: string;
  category: string;
}

/* ------------------------------------------------------------------ *
 * Deterministic offline bank (>= 40 words, varied length + category).
 * Keeps the game fully playable offline.
 * ------------------------------------------------------------------ */
const FALLBACKS: Secret[] = [
  { word: "SUN", category: "Space" },
  { word: "OWL", category: "Animals" },
  { word: "KEY", category: "Objects" },
  { word: "JAZZ", category: "Music" },
  { word: "LION", category: "Animals" },
  { word: "MOON", category: "Space" },
  { word: "CAKE", category: "Food" },
  { word: "SHIP", category: "Travel" },
  { word: "RIVER", category: "Nature" },
  { word: "TIGER", category: "Animals" },
  { word: "PIANO", category: "Music" },
  { word: "APPLE", category: "Food" },
  { word: "ROBOT", category: "Technology" },
  { word: "CLOUD", category: "Weather" },
  { word: "WHALE", category: "Animals" },
  { word: "PLANET", category: "Space" },
  { word: "GUITAR", category: "Music" },
  { word: "HARBOR", category: "Places" },
  { word: "COPPER", category: "Metals" },
  { word: "WALNUT", category: "Food" },
  { word: "FALCON", category: "Animals" },
  { word: "CASTLE", category: "Buildings" },
  { word: "MARKET", category: "Places" },
  { word: "ISLAND", category: "Geography" },
  { word: "ROCKET", category: "Space" },
  { word: "GARDEN", category: "Nature" },
  { word: "PENCIL", category: "Objects" },
  { word: "ANCHOR", category: "Travel" },
  { word: "CANDLE", category: "Objects" },
  { word: "HAMMER", category: "Tools" },
  { word: "ORANGE", category: "Food" },
  { word: "PUZZLE", category: "Games" },
  { word: "RABBIT", category: "Animals" },
  { word: "VOLCANO", category: "Nature" },
  { word: "DIAMOND", category: "Gems" },
  { word: "COMPASS", category: "Tools" },
  { word: "DOLPHIN", category: "Animals" },
  { word: "LIBRARY", category: "Buildings" },
  { word: "BALLOON", category: "Objects" },
  { word: "KITCHEN", category: "Home" },
  { word: "MONSOON", category: "Weather" },
  { word: "MOUNTAIN", category: "Geography" },
  { word: "ELEPHANT", category: "Animals" },
  { word: "SANDWICH", category: "Food" },
  { word: "AIRPLANE", category: "Travel" },
  { word: "NOTEBOOK", category: "Objects" },
];

const randomFallback = (): Secret => FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)]!;

function Screen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [secret, setSecret] = useState<Secret | null>(null);
  const [guessed, setGuessed] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [solved, setSolved] = useState(0);
  const [started, setStarted] = useState(false); // pre-game "ready" gate
  // Holds the win/lose overlay back until the figure's outcome animation (run-off /
  // dangle) has played, so the opaque GameOverlay scrim doesn't hide it. Pure
  // presentation — the game result itself (won/lost/scoring) is decided above.
  const [overlayReady, setOverlayReady] = useState(false);
  const mounted = useRef(true);
  const scored = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Puzzles come from the deterministic offline bank: instant, fully offline, and
  // never garbled.
  const newGame = useCallback((): void => {
    setGuessed([]);
    scored.current = false;
    setOverlayReady(false);
    setSecret(randomFallback());
    setLoading(false);
  }, []);

  const handleOutcomeDone = useCallback((): void => {
    if (mounted.current) setOverlayReady(true);
  }, []);

  useEffect(() => { newGame(); }, [newGame]);

  const letters = secret ? secret.word.split("") : [];
  const wrong = guessed.filter((g) => !letters.includes(g));
  const wrongCount = wrong.length;
  const won = secret !== null && letters.length > 0 && letters.every((l) => guessed.includes(l));
  const lost = wrongCount >= MAX_WRONG;
  const over = won || lost;

  useEffect(() => {
    if (won && !scored.current) {
      scored.current = true;
      setSolved((s) => s + 1);
    }
  }, [won]);

  const guess = (ch: string): void => {
    if (over || loading || !started || !secret) return;
    if (guessed.includes(ch)) return;
    setGuessed((prev) => [...prev, ch]);
  };

  return (
    <View style={st.fill}>
      {/* deep warm wood behind the sheet comes from st.fill's background */}
      <View style={[st.bar, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
        <View style={{ alignItems: "center" }}>
          <PixelText size="h2" style={{ color: "#F3EAD4" }}>WORD GALLOWS</PixelText>
          <PixelText size="label" style={{ marginTop: 4, color: "#C9B795" }}>SOLVED {solved}</PixelText>
        </View>
        <Pressable style={st.newBtn} onPress={() => void newGame()} accessibilityRole="button" accessibilityLabel="New word">
          <Body style={st.newT}>New</Body>
        </Pressable>
      </View>

      {loading ? (
        <View style={st.center}>
          <Body muted>Thinking of a word…</Body>
        </View>
      ) : (
        <View style={st.body}>
          {/* a single generated paper-on-table sheet; the puzzle is drawn on the page */}
          <View style={{ width: SHEET_W, height: SHEET_H, marginTop: space.sm }}>
            <Image source={SHEET} resizeMode="cover" fadeDuration={0} style={st.sheetImg} />

            {/* everything below is drawn inside the paper's writing rect */}
            {/* category shown on a little card resting on top of the sheet */}
            <View pointerEvents="none" style={st.catCardWrap}>
              <View style={st.catCard}>
                <Text style={st.catCardLabel}>CATEGORY</Text>
                <Text style={st.catCardTxt}>{secret ? secret.category.toUpperCase() : "—"}</Text>
              </View>
            </View>
            <View style={st.paper}>
              <Hangman wrong={wrongCount} won={won} lost={lost} onOutcomeDone={handleOutcomeDone} />

              <View style={st.wordRow}>
                {letters.map((l, i) => {
                  const shown = guessed.includes(l) || lost;
                  const miss = lost && !guessed.includes(l);
                  return (
                    <View key={i} style={st.blank}>
                      <Text style={[st.blankT, miss && { color: RED }]}>{shown ? l : ""}</Text>
                      <View style={[st.blankLine, miss && { backgroundColor: RED }]} />
                    </View>
                  );
                })}
              </View>

              <Body style={st.wrongLine}>
                Wrong: {wrong.length ? wrong.join(" ") : "none"} · {MAX_WRONG - wrongCount} left
              </Body>
            </View>
          </View>

          {guessed.length === 0 ? (
            <Body style={st.instructions}>
              Tap letters to reveal the hidden word. {MAX_WRONG} wrong guesses and it's over.
            </Body>
          ) : null}

          {/* swipeable letter strip — swipe sideways on the wood, tap a letter to guess */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.keysScroll} contentContainerStyle={st.keys}>
            {ALPHABET.map((ch) => {
              const used = guessed.includes(ch);
              const good = used && letters.includes(ch);
              return (
                <Pressable
                  key={ch}
                  disabled={used || over || !started}
                  onPress={() => guess(ch)}
                  accessibilityRole="button"
                  accessibilityLabel={`Guess ${ch}`}
                  style={[st.key, used ? (good ? st.keyGood : st.keyBad) : st.keyIdle, over ? st.keyDim : null]}
                >
                  <Text style={[st.keyT, used && good && { color: "#2E7D3A" }, used && !good && st.keyTBad]}>{ch}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={{ height: Math.max(insets.bottom, 10) + 10 }} />
        </View>
      )}

      {/* subtle vignette for depth (never blocks taps) */}
      <View pointerEvents="none" style={st.vignette} />

      <GameOverlay
        visible={!started}
        kind="pause"
        title="WORD GALLOWS"
        primaryLabel="Play"
        onPrimary={() => setStarted(true)}
        onExit={onExit}
      >
        <Body muted style={{ textAlign: "center", marginTop: space.md }}>
          Guess the hidden word one letter at a time. Too many wrong guesses and the
          stickman swings — solve it first.
        </Body>
      </GameOverlay>

      <GameOverlay
        visible={started && over && !loading && overlayReady}
        kind={won ? "win" : "over"}
        title={won ? "YOU GOT IT!" : "GAME OVER"}
        score={won ? secret?.word : `WORD: ${secret?.word ?? ""}`}
        primaryLabel="Play again"
        onPrimary={() => void newGame()}
        onExit={onExit}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * A single rounded graphite "stroke" — a limb or the body bar. Each
 * limb pivots about its TOP end (the joint) via the translate-pivot
 * trick, so rotating it swings the free end like a real doodled limb.
 * ------------------------------------------------------------------ */
function Limb({ x, y, length, deg, width = LIMB_W }: {
  x: number; y: number; length: number; deg: number; width?: number;
}): React.ReactElement {
  return (
    <View style={{ position: "absolute", left: x, top: y, width: 0, height: 0 }}>
      <View
        style={{
          position: "absolute",
          left: -width / 2,
          top: 0,
          width,
          height: length,
          borderRadius: width / 2,
          backgroundColor: GRAPHITE,
          // pivot about the top edge (the joint): shift up by half, rotate, shift back
          transform: [{ translateY: -length / 2 }, { rotate: `${deg}deg` }, { translateY: length / 2 }],
        }}
      />
    </View>
  );
}

/* Pose angles (degrees; 0 = straight down). Hanging limbs droop; running
 * limbs pump, swapping between two frames so the figure reads as running. */
function poseFor(mode: "hang" | "run", frame: number): {
  lArm: number; rArm: number; lLeg: number; rLeg: number;
} {
  if (mode === "hang") return { lArm: -20, rArm: 20, lLeg: -9, rLeg: 9 };
  return frame === 0
    ? { lArm: 40, rArm: -42, lLeg: -34, rLeg: 30 }
    : { lArm: -42, rArm: 40, lLeg: 30, rLeg: -34 };
}

/* The stickman itself: head/body/arms/legs drawn as Views, revealing up to
 * `parts` of them (1=head … 6=right leg). Origin y=0 is the head's top. */
function Person({ parts, mode, frame }: {
  parts: number; mode: "hang" | "run"; frame: number;
}): React.ReactElement {
  const cx = GW / 2;
  const shoulderY = HEAD_D + 2;
  const hipY = HEAD_D + BODY_H;
  const { lArm, rArm, lLeg, rLeg } = poseFor(mode, frame);
  return (
    <View style={{ position: "absolute", left: 0, top: 0, width: GW, height: PERSON_H }}>
      {parts >= 1 ? (
        <View style={{ position: "absolute", left: cx - HEAD_D / 2, top: 0, width: HEAD_D, height: HEAD_D, borderRadius: HEAD_D / 2, borderWidth: 3, borderColor: GRAPHITE, backgroundColor: "transparent" }} />
      ) : null}
      {parts >= 2 ? <Limb x={cx} y={HEAD_D} length={BODY_H} deg={0} /> : null}
      {parts >= 3 ? <Limb x={cx} y={shoulderY} length={ARM_L} deg={lArm} /> : null}
      {parts >= 4 ? <Limb x={cx} y={shoulderY} length={ARM_L} deg={rArm} /> : null}
      {parts >= 5 ? <Limb x={cx} y={hipY} length={LEG_L} deg={lLeg} /> : null}
      {parts >= 6 ? <Limb x={cx} y={hipY} length={LEG_L} deg={rLeg} /> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * The minimal gallows + figure, drawn on the paper.
 *
 * As wrong guesses accumulate, parts of the stickman appear in the
 * noose (1 per wrong guess). The setup is deliberately minimal: a top
 * beam and a short rope + noose, no tall structure.
 *
 * Outcome beats (both honour settings.reducedMotion — if reduced, no
 * motion, just the final still state):
 *  - WIN:  the freed stickman RUNS OFF the paper. runX slides him off
 *    the right edge while the pose swaps between two run-frames (leg
 *    bob + forward lean), leaving the noose empty.
 *  - LOSE: the completed stickman DANGLES from the noose — a gentle
 *    pendulum sway pivoting from the beam, amplitude easing to rest.
 * onOutcomeDone() fires once the beat finishes so the caller can reveal
 * the result overlay (whose opaque scrim would otherwise hide it).
 * ------------------------------------------------------------------ */
function Hangman({ wrong, won, lost, onOutcomeDone }: {
  wrong: number; won: boolean; lost: boolean; onOutcomeDone: () => void;
}): React.ReactElement {
  const { reducedMotion } = useSettings();
  const runX = useRef(new Animated.Value(0)).current;   // WIN: slide off the page
  const gait = useRef(new Animated.Value(0)).current;   // WIN: run-bob + lean loop
  const swing = useRef(new Animated.Value(0)).current;  // LOSE: pendulum, [-1..1]

  const [runFrame, setRunFrame] = useState(0);          // alternating run-frame index
  const [ranOff, setRanOff] = useState(false);          // WIN done -> noose is empty
  const doneRef = useRef(false);                         // fire onOutcomeDone once/round

  const stage = Math.min(wrong, MAX_WRONG);
  const inPlay = !won && !lost;

  useEffect(() => {
    doneRef.current = false;
    let frameTimer: ReturnType<typeof setInterval> | undefined;
    let settle: ReturnType<typeof setTimeout> | undefined;
    let gaitLoop: Animated.CompositeAnimation | undefined;

    const finish = (): void => {
      if (doneRef.current) return;
      doneRef.current = true;
      onOutcomeDone();
    };

    // Fresh round: reset every animated value and run-state.
    runX.setValue(0); gait.setValue(0); swing.setValue(0);
    setRunFrame(0); setRanOff(false);

    if (inPlay) return; // round still live — nothing to animate

    if (reducedMotion) {
      // No motion: hold on the final still figure, then reveal the overlay.
      settle = setTimeout(finish, 450);
      return () => { if (settle) clearTimeout(settle); };
    }

    if (won) {
      frameTimer = setInterval(() => setRunFrame((f) => (f === 0 ? 1 : 0)), 110);
      gaitLoop = Animated.loop(
        Animated.timing(gait, { toValue: 1, duration: 230, easing: Easing.linear, useNativeDriver: true }),
      );
      gaitLoop.start();
      Animated.timing(runX, {
        toValue: SHEET_W,                 // clear the right edge of the sheet
        duration: 1050,
        easing: Easing.in(Easing.quad),   // accelerate as he bolts
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (frameTimer) clearInterval(frameTimer);
        gaitLoop?.stop();
        if (finished) setRanOff(true);    // off the page -> figure is gone
        finish();
      });
      return () => { if (frameTimer) clearInterval(frameTimer); gaitLoop?.stop(); };
    }

    // lost: gentle pendulum dangle from the noose, amplitude decaying to rest.
    Animated.sequence([
      Animated.timing(swing, { toValue: 1,     duration: 300, easing: Easing.out(Easing.quad),  useNativeDriver: true }),
      Animated.timing(swing, { toValue: -0.62, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(swing, { toValue: 0.38,  duration: 470, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(swing, { toValue: -0.2,  duration: 430, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(swing, { toValue: 0.08,  duration: 380, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(swing, { toValue: 0,     duration: 340, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]).start(() => finish());
    return;
  }, [won, lost, inPlay, reducedMotion, runX, gait, swing, onOutcomeDone]);

  // Derived transforms.
  const bob = gait.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -7, 0] });
  const lean = gait.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["6deg", "10deg", "6deg"] });
  const swingDeg = swing.interpolate({ inputRange: [-1, 1], outputRange: ["-8deg", "8deg"] });

  const label = won
    ? "You escaped the gallows!"
    : lost
    ? "Game over — the stickman is left dangling."
    : `Hangman: ${wrong} of ${MAX_WRONG} wrong guesses.`;

  // Loosely-typed transform arrays (mix of Animated values + rotate strings).
  const swingTransform: any[] = [{ translateY: -GH / 2 }, { rotate: swingDeg }, { translateY: GH / 2 }];
  const runTransform: any[] = [{ translateX: runX }, { translateY: bob }, { rotate: lean }];

  return (
    <View style={st.figWrap} accessible accessibilityLabel={label}>
      <View style={st.fig} pointerEvents="none">
        {/* minimal gallows: one top beam */}
        <View style={st.beam} />

        {won ? (
          <>
            {/* noose left empty — he's gone */}
            <View style={st.group}>
              <View style={st.ropeStub} />
              <View style={st.noose} />
            </View>
            {!ranOff ? (
              reducedMotion ? (
                // final still state: freed figure standing clear of the noose
                <View style={{ position: "absolute", left: GROUP_LEFT + 10, top: PERSON_TOP }}>
                  <Person parts={MAX_WRONG} mode="run" frame={0} />
                </View>
              ) : (
                <Animated.View style={{ position: "absolute", left: GROUP_LEFT, top: PERSON_TOP, transform: runTransform }}>
                  <Person parts={MAX_WRONG} mode="run" frame={runFrame} />
                </Animated.View>
              )
            ) : null}
          </>
        ) : lost ? (
          // completed figure dangling from the noose (pendulum sway, or still)
          <Animated.View style={[st.group, !reducedMotion ? { transform: swingTransform } : null]}>
            <View style={st.rope} />
            <View style={st.noose} />
            <View style={st.personSlot}>
              <Person parts={MAX_WRONG} mode="hang" frame={0} />
            </View>
          </Animated.View>
        ) : (
          // in play: rope + noose + however many parts the wrong guesses have drawn
          <View style={st.group}>
            {stage >= 1 ? <View style={st.rope} /> : null}
            {stage >= 1 ? <View style={st.noose} /> : null}
            <View style={st.personSlot}>
              <Person parts={stage} mode="hang" frame={0} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: TABLE },
  vignette: { ...StyleSheet.absoluteFillObject, boxShadow: "inset 0 0 110px 22px rgba(0,0,0,0.5)" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  newBtn: {
    minHeight: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: "#C9B795",
    alignItems: "center",
    justifyContent: "center",
  },
  newT: { color: "#F3EAD4", fontWeight: "800", fontSize: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, alignItems: "center", paddingHorizontal: space.lg },

  // --- the single generated paper-on-table sheet + its writing rect ---
  sheetImg: { width: SHEET_W, height: SHEET_H, borderRadius: 12 },
  catCardWrap: { position: "absolute", top: -14, left: 0, right: 0, alignItems: "center", zIndex: 6 },
  catCard: {
    backgroundColor: "#FBF3DC", borderRadius: 10, paddingVertical: 6, paddingHorizontal: 16,
    borderWidth: 1.5, borderColor: "#C9A24B", alignItems: "center",
    boxShadow: "0 5px 12px rgba(0,0,0,0.4)", transform: [{ rotate: "-2.5deg" }],
  },
  catCardLabel: { color: INK, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  catCardTxt: { color: GRAPHITE, fontSize: 15, fontWeight: "800", marginTop: 1 },
  // the paper's writing area (fractions of the art mapped to px); the puzzle is drawn
  // absolutely within it and vertically centred so it reads as doodled on the page.
  paper: {
    position: "absolute",
    left: papL, top: papT, width: papW, height: papH,
    alignItems: "center",
    justifyContent: "center",
  },

  catRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.xs },
  catTxt: { color: PENCIL, fontSize: 14, fontWeight: "800", letterSpacing: 1 },

  // --- the hand-drawn figure (scaled to fit the paper; neg. margin reclaims height) ---
  figWrap: {
    width: FIGW, height: FIGH,
    alignItems: "center", justifyContent: "center",
    transform: [{ scale: FIG_S }],
    marginVertical: FIG_MV,
  },
  fig: { width: FIGW, height: FIGH, position: "relative" },
  beam: { position: "absolute", top: 0, left: (FIGW - BEAM_W) / 2, width: BEAM_W, height: BEAM_H, borderRadius: BEAM_H / 2, backgroundColor: GRAPHITE },
  group: { position: "absolute", left: GROUP_LEFT, top: GROUP_TOP, width: GW, height: GH },
  // person sits at the end of the rope (group-relative)
  personSlot: { position: "absolute", left: 0, top: ROPE_LEN, width: GW, height: PERSON_H },
  rope: { position: "absolute", left: GW / 2 - 1.5, top: 0, width: 3, height: ROPE_LEN, backgroundColor: GRAPHITE },
  ropeStub: { position: "absolute", left: GW / 2 - 1.5, top: 0, width: 3, height: ROPE_LEN * 0.5, backgroundColor: GRAPHITE, opacity: 0.6 },
  // noose loop sitting at the neck (group-relative)
  noose: { position: "absolute", left: GW / 2 - 9, top: ROPE_LEN - 6, width: 18, height: 14, borderRadius: 8, borderWidth: 2.5, borderColor: GRAPHITE, backgroundColor: "transparent" },

  // --- word blanks (sized so up to 8 letters wrap cleanly inside the paper rect) ---
  wordRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: space.sm },
  blank: { width: 24, alignItems: "center" },
  blankT: { color: GRAPHITE, fontSize: 20, fontWeight: "900", height: 26, textAlign: "center" },
  blankLine: { width: 22, height: 3, borderRadius: 2, backgroundColor: GRAPHITE, marginTop: 2 },
  wrongLine: { color: PENCIL, fontSize: 13, marginTop: space.xs },

  instructions: { marginTop: space.sm, textAlign: "center", paddingHorizontal: space.lg, color: "#E8DcC2" },

  // --- tactile console keys (flat, below the sheet) ---
  keysScroll: { marginTop: space.md, maxHeight: 66, flexGrow: 0, alignSelf: "stretch" },
  keys: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg },
  key: {
    width: 42,
    height: 54,
    margin: 4,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#6B5636",
    backgroundColor: "#F3EAD4",
    boxShadow: "0 2px 0 rgba(0,0,0,0.45)",
  },
  keyIdle: {},
  keyGood: { backgroundColor: "#CDE9CF", borderColor: "#2E7D3A" },
  keyBad: { backgroundColor: "#E9CFCF", borderColor: RED },
  keyDim: { opacity: 0.55 },
  keyT: { color: GRAPHITE, fontSize: 16, fontWeight: "800" },
  keyTBad: { color: RED },
});

export const wordGallowsGame: GameModule = {
  id: "word-gallows",
  title: "Word Gallows",
  kind: "turn-based",
  Screen,
};
