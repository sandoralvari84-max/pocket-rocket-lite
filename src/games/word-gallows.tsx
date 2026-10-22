import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";

const MAX_WRONG = 6;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

interface Secret {
  word: string;
  category: string;
}

const FALLBACKS: Secret[] = [
  { word: "PLANET", category: "Space" },
  { word: "GUITAR", category: "Music" },
  { word: "HARBOR", category: "Places" },
  { word: "COPPER", category: "Metals" },
  { word: "WALNUT", category: "Food" },
  { word: "FALCON", category: "Animals" },
  { word: "CASTLE", category: "Buildings" },
  { word: "MARKET", category: "Places" },
];

const randomFallback = (): Secret =>
  FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];

// Parse "WORD | CATEGORY" defensively; fall back to a built-in word.
function parseSecret(reply: string): Secret {
  const cleaned = reply.replace(/[\r\n]+/g, " ").trim();
  const parts = cleaned.split("|");
  if (parts.length >= 1) {
    const wordMatch = parts[0].match(/[A-Za-z]{3,12}/);
    if (wordMatch) {
      const word = wordMatch[0].toUpperCase();
      let category = "Mystery";
      if (parts.length >= 2) {
        const catMatch = parts[1].match(/[A-Za-z][A-Za-z \-]{1,20}/);
        if (catMatch) category = catMatch[0].trim();
      }
      return { word, category };
    }
  }
  return randomFallback();
}

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [secret, setSecret] = useState<Secret | null>(null);
  const [guessed, setGuessed] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const newGame = useCallback(async (): Promise<void> => {
    setLoading(true);
    setGuessed([]);
    setSecret(null);
    let reply = "";
    try {
      reply = await ask(
        "Pick ONE common English word (4 to 8 letters, a normal noun, no proper names) " +
          "and a one-word category for a word-guessing game. " +
          'Reply EXACTLY in this format: WORD | CATEGORY',
        "word-gallows-pick",
      );
    } catch {
      reply = "";
    }
    if (!mounted.current) return;
    setSecret(reply ? parseSecret(reply) : randomFallback());
    setLoading(false);
  }, [ask]);

  useEffect(() => {
    void newGame();
  }, [newGame]);

  const letters = secret ? secret.word.split("") : [];
  const wrong = guessed.filter((g) => !letters.includes(g));
  const wrongCount = wrong.length;
  const won = secret !== null && letters.every((l) => guessed.includes(l));
  const lost = wrongCount >= MAX_WRONG;
  const over = won || lost;

  const guess = (ch: string): void => {
    if (over || loading || !secret) return;
    if (guessed.includes(ch)) return;
    setGuessed((prev) => [...prev, ch]);
  };

  const display = letters
    .map((l) => (guessed.includes(l) || lost ? l : "_"))
    .join(" ");

  return (
    <View style={st.fill}>
      <View style={[st.bar, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <Pressable style={st.exit} onPress={onExit}>
          <Text style={st.exitT}>← Menu</Text>
        </Pressable>
        <Text style={st.title}>Word Gallows</Text>
        <Pressable style={st.exit} onPress={() => void newGame()}>
          <Text style={st.exitT}>New</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={st.center}>
          <ActivityIndicator color="#4da3ff" />
          <Text style={st.msg}>Thinking of a word...</Text>
        </View>
      ) : (
        <View style={st.body}>
          <Gallows wrong={wrongCount} />
          <Text style={st.cat}>
            Category: {secret ? secret.category : "—"}
          </Text>
          <Text style={st.word}>{display}</Text>
          <Text style={st.wrongLine}>
            Wrong: {wrong.length ? wrong.join(" ") : "none"} ({wrongCount}/
            {MAX_WRONG})
          </Text>
          {over ? (
            <Text style={[st.result, won ? st.win : st.lose]}>
              {won
                ? "You guessed it!"
                : `Out of tries — the word was ${secret ? secret.word : ""}.`}
            </Text>
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
                  style={[
                    st.key,
                    used
                      ? good
                        ? st.keyGood
                        : st.keyBad
                      : st.keyIdle,
                    over ? st.keyDim : null,
                  ]}
                >
                  <Text style={st.keyT}>{ch}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

// Simple gallows drawing built from Views; body parts appear as wrong count grows.
function Gallows({ wrong }: { wrong: number }): React.ReactElement {
  return (
    <View style={st.gallows}>
      {/* structure */}
      <View style={st.base} />
      <View style={st.post} />
      <View style={st.beam} />
      <View style={st.rope} />
      {/* head */}
      {wrong >= 1 ? <View style={st.head} /> : null}
      {/* body */}
      {wrong >= 2 ? <View style={st.torso} /> : null}
      {/* left arm */}
      {wrong >= 3 ? <View style={[st.arm, st.armL]} /> : null}
      {/* right arm */}
      {wrong >= 4 ? <View style={[st.arm, st.armR]} /> : null}
      {/* left leg */}
      {wrong >= 5 ? <View style={[st.leg, st.legL]} /> : null}
      {/* right leg */}
      {wrong >= 6 ? <View style={[st.leg, st.legR]} /> : null}
    </View>
  );
}

const PART = "#f3f3f3";
const WOOD = "#8a6d4b";

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0b1021" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  exit: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  exitT: { color: "#fff", fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  msg: { color: "#cfd6ff", fontSize: 14, marginTop: 10 },
  body: { flex: 1, alignItems: "center", paddingHorizontal: 16 },
  gallows: { width: 160, height: 180, marginTop: 6 },
  base: {
    position: "absolute",
    left: 10,
    bottom: 0,
    width: 110,
    height: 8,
    backgroundColor: WOOD,
    borderRadius: 2,
  },
  post: {
    position: "absolute",
    left: 30,
    bottom: 0,
    width: 8,
    height: 170,
    backgroundColor: WOOD,
    borderRadius: 2,
  },
  beam: {
    position: "absolute",
    left: 30,
    top: 2,
    width: 80,
    height: 8,
    backgroundColor: WOOD,
    borderRadius: 2,
  },
  rope: {
    position: "absolute",
    left: 104,
    top: 8,
    width: 3,
    height: 20,
    backgroundColor: "#d9c08a",
  },
  head: {
    position: "absolute",
    left: 92,
    top: 28,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: PART,
  },
  torso: {
    position: "absolute",
    left: 104,
    top: 56,
    width: 3,
    height: 46,
    backgroundColor: PART,
  },
  arm: {
    position: "absolute",
    top: 62,
    width: 26,
    height: 3,
    backgroundColor: PART,
  },
  armL: { left: 80, transform: [{ rotate: "25deg" }] },
  armR: { left: 100, transform: [{ rotate: "-25deg" }] },
  leg: {
    position: "absolute",
    top: 100,
    width: 26,
    height: 3,
    backgroundColor: PART,
  },
  legL: { left: 82, transform: [{ rotate: "-25deg" }] },
  legR: { left: 100, transform: [{ rotate: "25deg" }] },
  cat: { color: "#9fb0e0", fontSize: 15, fontWeight: "600", marginTop: 8 },
  word: {
    color: "#fff",
    fontSize: 28,
    letterSpacing: 2,
    fontWeight: "700",
    marginTop: 14,
    textAlign: "center",
  },
  wrongLine: { color: "#e59aa0", fontSize: 14, marginTop: 10 },
  result: { fontSize: 16, fontWeight: "700", marginTop: 10, textAlign: "center" },
  win: { color: "#5ed19a" },
  lose: { color: "#e0463e" },
  keys: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 16,
  },
  key: {
    width: 34,
    height: 40,
    margin: 3,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  keyIdle: { backgroundColor: "#2a3f66" },
  keyGood: { backgroundColor: "#2f7d55" },
  keyBad: { backgroundColor: "#6b2a2a" },
  keyDim: { opacity: 0.6 },
  keyT: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

export const wordGallowsGame: GameModule = {
  id: "word-gallows",
  title: "Word Gallows",
  kind: "turn-based",
  Screen,
};
