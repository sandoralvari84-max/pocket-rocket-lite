import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Animated, Easing, Image, ImageBackground, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext, AskModel } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, GameOverlay } from "../design/ui";
import { useSettings } from "../settings";

// Notebook-paper theme (tools/art/gen_paper.py + gen_gallows_notebook.py) — a
// pen-and-paper word game doodled on a ripped page.
const PAPER = require("../../assets/arcade/paper/paper.png");
const TORN = require("../../assets/arcade/paper/torn.png");
const INK = "#27407E";     // blue biro
const RED = "#B23B3B";     // red pen
const PENCIL = "#3A3730";  // graphite text

const MAX_WRONG = 6;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/* ------------------------------------------------------------------ *
 * Owned cartoon hangman sprite set (assets/arcade/gallows/, ~200x240).
 * stage0 = empty gallows; stage1..6 add one body part per wrong guess
 * (stage6 = fully hanged = LOSS); win.png = escaped stickman = WIN.
 * ------------------------------------------------------------------ */
const GALLOWS_STAGES = [
  require("../../assets/arcade/gallows/stage0.png"),
  require("../../assets/arcade/gallows/stage1.png"),
  require("../../assets/arcade/gallows/stage2.png"),
  require("../../assets/arcade/gallows/stage3.png"),
  require("../../assets/arcade/gallows/stage4.png"),
  require("../../assets/arcade/gallows/stage5.png"),
  require("../../assets/arcade/gallows/stage6.png"),
];
const WIN_SPRITE = require("../../assets/arcade/gallows/win.png");
// Two pencil run-frames (gen_gallows_notebook.py:win_run) alternated to animate
// the freed stickman bolting off the page on a win.
const WIN_RUN = [
  require("../../assets/arcade/gallows/win_run1.png"),
  require("../../assets/arcade/gallows/win_run2.png"),
];

// Hi-res gallows art (600x720, 5:6). Shown at ~34% height so it stays crisp.
const SPRITE_H = Math.round(Dimensions.get("window").height * 0.34);
const SPRITE_W = Math.round((SPRITE_H * 5) / 6);
const SCREEN_W = Dimensions.get("window").width;

interface Secret {
  word: string;
  category: string;
}

/* ------------------------------------------------------------------ *
 * Deterministic offline bank (>= 40 words, varied length + category).
 * Model supplies variety when it responds in time; otherwise the bank
 * keeps the game fully playable offline.
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
  // Holds the win/lose overlay back until the sprite's outcome animation (run-away
  // / dangle) has played, so the opaque GameOverlay scrim doesn't hide it. Pure
  // presentation — the game result itself (won/lost/scoring) is decided above.
  const [overlayReady, setOverlayReady] = useState(false);
  const mounted = useRef(true);
  const scored = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Puzzles come from the deterministic offline bank: instant, fully offline, and
  // never garbled. The 1.5B model could not reliably produce the "WORD | CATEGORY"
  // format, so its replies leaked prompt text into the category ("PICK ONE com…").
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
    if (over || loading || !secret) return;
    if (guessed.includes(ch)) return;
    setGuessed((prev) => [...prev, ch]);
  };

  return (
    <ImageBackground source={PAPER} resizeMode="repeat" style={st.fill}>
      <Image source={TORN} resizeMode="stretch" fadeDuration={0} style={st.torn} />
      <View style={[st.bar, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
        <View style={{ alignItems: "center" }}>
          <PixelText size="h2" style={{ color: INK }}>WORD GALLOWS</PixelText>
          <PixelText size="label" style={{ marginTop: 4, color: PENCIL }}>SOLVED {solved}</PixelText>
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
          <Hangman wrong={wrongCount} won={won} lost={lost} onOutcomeDone={handleOutcomeDone} />

          <View style={st.catPill}>
            <PixelText size="label" style={{ color: INK }}>CATEGORY</PixelText>
            <Body style={st.catTxt}>{secret ? secret.category.toUpperCase() : "—"}</Body>
          </View>

          <View style={st.wordRow}>
            {letters.map((l, i) => {
              const shown = guessed.includes(l) || lost;
              const miss = lost && !guessed.includes(l);
              return (
                <View key={i} style={[st.tile, shown && (miss ? st.tileMiss : st.tileShown)]}>
                  <Text style={[st.tileT, miss && { color: RED }]}>{shown ? l : ""}</Text>
                </View>
              );
            })}
          </View>

          <Body style={st.wrongLine}>
            Wrong: {wrong.length ? wrong.join(" ") : "none"} ({wrongCount}/{MAX_WRONG})
          </Body>

          {guessed.length === 0 ? (
            <Body muted style={st.instructions}>
              Tap letters to reveal the hidden word. {MAX_WRONG} wrong guesses and it's over.
            </Body>
          ) : null}

          <View style={st.keys}>
            {ALPHABET.map((ch) => {
              const used = guessed.includes(ch);
              const good = used && letters.includes(ch);
              return (
                <Pressable
                  key={ch}
                  disabled={used || over}
                  onPress={() => guess(ch)}
                  accessibilityRole="button"
                  accessibilityLabel={`Guess ${ch}`}
                  style={[st.key, used ? (good ? st.keyGood : st.keyBad) : st.keyIdle, over ? st.keyDim : null]}
                >
                  <Text style={[st.keyT, used && good && { color: "#1F6B2E" }, used && !good && st.keyTBad]}>{ch}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <GameOverlay
        visible={over && !loading && overlayReady}
        kind={won ? "win" : "over"}
        title={won ? "YOU GOT IT!" : "GAME OVER"}
        score={won ? secret?.word : `WORD: ${secret?.word ?? ""}`}
        primaryLabel="Play again"
        onPrimary={() => void newGame()}
        onExit={onExit}
      />
    </ImageBackground>
  );
}

/* ------------------------------------------------------------------ *
 * "Getting worse" indicator — the visual signature of this genre.
 *
 * An owned cartoon HANGMAN sprite: stage0 is the empty gallows, and each
 * wrong guess adds one body part (stage1..stage6). The sprite shown is
 * stageN where N = min(wrongCount, 6).
 *
 * Outcome animations (all honour settings.reducedMotion — when reduced,
 * just the still win/loss sprite, no motion):
 *  - WIN:  the freed stickman RUNS off the page. Two pencil run-frames
 *    (win_run1/2) alternate while the sprite slides off the right edge
 *    with a little run-bob + forward lean, leaving the page clear.
 *  - LOSE: the hanged stickman (stage6) DANGLES — a gentle pendulum sway
 *    pivoting from the noose, amplitude easing out to rest over ~2s.
 * onOutcomeDone() fires once the beat finishes so the caller can reveal
 * the result overlay (whose opaque scrim would otherwise hide the motion).
 * ------------------------------------------------------------------ */
const SWING_PIVOT = Math.round(SPRITE_H * 0.36); // noose/beam: above the figure's centre

function Hangman({ wrong, won, lost, onOutcomeDone }: {
  wrong: number; won: boolean; lost: boolean; onOutcomeDone: () => void;
}): React.ReactElement {
  const { reducedMotion } = useSettings();
  const runX = useRef(new Animated.Value(0)).current;   // WIN: slide off-screen
  const gait = useRef(new Animated.Value(0)).current;   // WIN: run-bob + lean loop
  const swing = useRef(new Animated.Value(0)).current;  // LOSE: pendulum, [-1..1]

  const [runFrame, setRunFrame] = useState(0);          // alternating run-frame index
  const [ranOff, setRanOff] = useState(false);          // WIN done -> page is clear
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
      // No motion: hold on the static win/loss sprite, then reveal the overlay.
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
        toValue: SCREEN_W * 0.9,
        duration: 1050,
        easing: Easing.in(Easing.quad), // accelerate as he bolts
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (frameTimer) clearInterval(frameTimer);
        gaitLoop?.stop();
        if (finished) setRanOff(true); // off the page -> stickman is gone
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

  // Derived transforms for each beat.
  const bob = gait.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -9, 0] });
  const lean = gait.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["5deg", "9deg", "5deg"] });
  const swingDeg = swing.interpolate({ inputRange: [-1, 1], outputRange: ["-7deg", "7deg"] });

  const source = won
    ? (reducedMotion ? WIN_SPRITE : WIN_RUN[runFrame])
    : lost ? GALLOWS_STAGES[MAX_WRONG] : GALLOWS_STAGES[stage];

  // RN transform entries mix Animated values and rotate strings; the precise
  // union is unwieldy, so this presentation-only array is loosely typed.
  let transform: any[] = [];
  if (won && !reducedMotion) {
    transform = [{ translateX: runX }, { translateY: bob }, { rotate: lean }];
  } else if (lost && !reducedMotion) {
    // Rotate about the noose (top of the sprite), not its centre.
    transform = [{ translateY: -SWING_PIVOT }, { rotate: swingDeg }, { translateY: SWING_PIVOT }];
  }

  const label = won
    ? "You escaped the gallows!"
    : lost
    ? "Game over — the stickman is fully hanged."
    : `Hangman: ${wrong} of ${MAX_WRONG} wrong guesses.`;

  return (
    <View style={st.hangWrap} accessible accessibilityLabel={label}>
      {won && ranOff ? (
        <View style={st.sprite} /> // runner has left the page — kept clear
      ) : (
        <Animated.Image source={source} style={[st.sprite, { transform }]} resizeMode="contain" fadeDuration={0} />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#F4EEDE" },
  torn: { position: "absolute", left: 0, top: 0, width: "100%", height: 22 },
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
    borderColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  newT: { color: INK, fontWeight: "800", fontSize: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, alignItems: "center", paddingHorizontal: space.lg },

  // --- Cartoon hangman sprite: the "getting worse" indicator ---
  hangWrap: { alignItems: "center", justifyContent: "center", marginTop: space.sm },
  sprite: { width: SPRITE_W, height: SPRITE_H },

  catPill: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md, backgroundColor: "rgba(39,64,126,0.07)", borderRadius: radius.md, borderWidth: 1, borderColor: INK, paddingHorizontal: space.md, paddingVertical: space.xs },
  catTxt: { color: PENCIL, fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  wordRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: space.md },
  tile: { width: 36, height: 46, borderRadius: radius.sm, backgroundColor: "transparent", borderBottomWidth: 3, borderColor: INK, alignItems: "center", justifyContent: "center" },
  tileShown: { backgroundColor: "rgba(39,64,126,0.08)", borderColor: INK },
  tileMiss: { backgroundColor: "rgba(178,59,59,0.12)", borderColor: RED },
  tileT: { color: INK, fontSize: 24, fontWeight: "900" },
  wrongLine: { color: PENCIL, fontSize: 14, marginTop: space.md },
  instructions: { marginTop: space.md, textAlign: "center", paddingHorizontal: space.lg, color: PENCIL },
  keys: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: space.lg },
  key: {
    width: 34,
    height: 42,
    margin: 3,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: INK,
  },
  keyIdle: { backgroundColor: "rgba(39,64,126,0.05)" },
  keyGood: { backgroundColor: "rgba(31,107,46,0.18)", borderColor: "#1F6B2E" },
  keyBad: { backgroundColor: "rgba(178,59,59,0.14)", borderColor: RED },
  keyDim: { opacity: 0.55 },
  keyT: { color: INK, fontSize: 16, fontWeight: "800" },
  keyTBad: { color: RED },
});

export const wordGallowsGame: GameModule = {
  id: "word-gallows",
  title: "Word Gallows",
  kind: "turn-based",
  Screen,
};
