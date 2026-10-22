import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext, AskModel } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, GameOverlay } from "../design/ui";

const MAX_WRONG = 6;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

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

// Parse "WORD | CATEGORY" defensively; fall back to a built-in word.
function parseSecret(reply: string): Secret {
  const cleaned = (reply || "").replace(/[\r\n]+/g, " ").trim();
  const parts = cleaned.split("|");
  if (parts.length >= 1 && parts[0]) {
    const wordMatch = parts[0].match(/[A-Za-z]{3,12}/);
    if (wordMatch) {
      const word = wordMatch[0].toUpperCase();
      let category = "Mystery";
      if (parts.length >= 2 && parts[1]) {
        const catMatch = parts[1].match(/[A-Za-z][A-Za-z \-]{1,20}/);
        if (catMatch) category = catMatch[0].trim();
      }
      return { word, category };
    }
  }
  return randomFallback();
}

async function askWithTimeout(ask: AskModel, prompt: string, note: string, ms = 8000): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<string>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  try {
    const res = await Promise.race([ask(prompt, note), timeout]);
    return (res || "").trim();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const PROMPT =
  "Pick ONE common English word (4 to 8 letters, a normal noun, no proper names) " +
  "and a one-word category for a word-guessing game. " +
  "Reply EXACTLY in this format: WORD | CATEGORY";

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [secret, setSecret] = useState<Secret | null>(null);
  const [guessed, setGuessed] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [solved, setSolved] = useState(0);
  const mounted = useRef(true);
  const scored = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const newGame = useCallback(async (): Promise<void> => {
    setLoading(true);
    setGuessed([]);
    setSecret(null);
    scored.current = false;
    let next: Secret | null = null;
    try {
      const reply = await askWithTimeout(ask, PROMPT, "word-gallows-pick");
      if (reply) next = parseSecret(reply);
    } catch {
      next = null;
    }
    if (!mounted.current) return;
    setSecret(next ?? randomFallback()); // offline fallback — always succeeds
    setLoading(false);
  }, [ask]);

  useEffect(() => { void newGame(); }, [newGame]);

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

  const display = letters.map((l) => (guessed.includes(l) || lost ? l : "_")).join(" ");

  return (
    <View style={st.fill}>
      <View style={[st.bar, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
        <View style={{ alignItems: "center" }}>
          <PixelText size="h2" style={{ color: color.cyan }}>WORD GALLOWS</PixelText>
          <PixelText size="label" style={{ marginTop: 4 }}>SOLVED {solved}</PixelText>
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
          <Gallows wrong={wrongCount} />
          <Body style={st.cat}>Category: {secret ? secret.category : "—"}</Body>
          <Text style={st.word}>{display}</Text>
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
                  <Text style={[st.keyT, used && !good && st.keyTBad]}>{ch}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <GameOverlay
        visible={over && !loading}
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

// Gallows drawing built from Views; body parts appear as wrong count grows.
function Gallows({ wrong }: { wrong: number }): React.ReactElement {
  return (
    <View style={st.gallows}>
      <View style={st.base} />
      <View style={st.post} />
      <View style={st.beam} />
      <View style={st.rope} />
      {wrong >= 1 ? <View style={st.head} /> : null}
      {wrong >= 2 ? <View style={st.torso} /> : null}
      {wrong >= 3 ? <View style={[st.arm, st.armL]} /> : null}
      {wrong >= 4 ? <View style={[st.arm, st.armR]} /> : null}
      {wrong >= 5 ? <View style={[st.leg, st.legL]} /> : null}
      {wrong >= 6 ? <View style={[st.leg, st.legR]} /> : null}
    </View>
  );
}

const PART = color.text;       // the figure — high-contrast warm white
const WOOD = color.amberDim;   // the gallows timber — dim amber (woody)
const ROPE = color.warn;       // the rope — soft yellow

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
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
    borderColor: color.cyan,
    alignItems: "center",
    justifyContent: "center",
  },
  newT: { color: color.cyan, fontWeight: "800", fontSize: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, alignItems: "center", paddingHorizontal: space.lg },
  gallows: { width: 160, height: 180, marginTop: space.sm },
  base: { position: "absolute", left: 10, bottom: 0, width: 110, height: 8, backgroundColor: WOOD, borderRadius: 2 },
  post: { position: "absolute", left: 30, bottom: 0, width: 8, height: 170, backgroundColor: WOOD, borderRadius: 2 },
  beam: { position: "absolute", left: 30, top: 2, width: 80, height: 8, backgroundColor: WOOD, borderRadius: 2 },
  rope: { position: "absolute", left: 104, top: 8, width: 3, height: 20, backgroundColor: ROPE },
  head: { position: "absolute", left: 92, top: 28, width: 28, height: 28, borderRadius: 14, borderWidth: 3, borderColor: PART },
  torso: { position: "absolute", left: 104, top: 56, width: 3, height: 46, backgroundColor: PART },
  arm: { position: "absolute", top: 62, width: 26, height: 3, backgroundColor: PART },
  armL: { left: 80, transform: [{ rotate: "25deg" }] },
  armR: { left: 100, transform: [{ rotate: "-25deg" }] },
  leg: { position: "absolute", top: 100, width: 26, height: 3, backgroundColor: PART },
  legL: { left: 82, transform: [{ rotate: "-25deg" }] },
  legR: { left: 100, transform: [{ rotate: "25deg" }] },
  cat: { color: color.cyan, fontSize: 15, fontWeight: "700", marginTop: space.md },
  word: { color: color.text, fontSize: 30, letterSpacing: 4, fontWeight: "800", marginTop: space.md, textAlign: "center" },
  wrongLine: { color: color.textMuted, fontSize: 14, marginTop: space.md },
  instructions: { marginTop: space.md, textAlign: "center", paddingHorizontal: space.lg },
  keys: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: space.lg },
  key: {
    width: 34,
    height: 42,
    margin: 3,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: color.surfaceLine,
  },
  keyIdle: { backgroundColor: color.surface2 },
  keyGood: { backgroundColor: color.success, borderColor: color.success },
  keyBad: { backgroundColor: "rgba(255,82,71,0.18)", borderColor: color.danger },
  keyDim: { opacity: 0.55 },
  keyT: { color: color.text, fontSize: 16, fontWeight: "800" },
  keyTBad: { color: color.danger },
});

export const wordGallowsGame: GameModule = {
  id: "word-gallows",
  title: "Word Gallows",
  kind: "turn-based",
  Screen,
};
