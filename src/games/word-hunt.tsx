import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";

interface Secret {
  word: string; // lowercase, letters only expected
  clue: string;
}

function parseSecret(raw: string): Secret | null {
  const text = (raw || "").trim();
  if (!text) return null;
  const wm = text.match(/word\s*[:\-]\s*([A-Za-z][A-Za-z'-]*)/i);
  const cm = text.match(/clue\s*[:\-]\s*(.+)/i);
  let word = wm ? wm[1]!.trim() : "";
  let clue = cm ? cm[1]!.split("\n")[0]!.trim() : "";
  if (!word) {
    // Fallback: first standalone word token.
    const m = text.match(/\b([A-Za-z]{3,})\b/);
    if (m) word = m[1]!;
  }
  if (!clue) clue = "No clue given — guess away!";
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length < 3 || word.length > 14) return null;
  return { word, clue };
}

function hotness(guess: string, word: string): string {
  const g = guess.toLowerCase().replace(/[^a-z]/g, "");
  if (!g) return "cold";
  const wordSet = new Set(word.split(""));
  let shared = 0;
  for (const ch of new Set(g.split(""))) if (wordSet.has(ch)) shared++;
  const ratio = shared / new Set(word.split("")).size;
  if (ratio >= 0.7) return "boiling hot";
  if (ratio >= 0.45) return "warm";
  if (ratio >= 0.2) return "cool";
  return "cold";
}

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [secret, setSecret] = useState<Secret | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guess, setGuess] = useState("");
  const [revealed, setRevealed] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [won, setWon] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const newRound = useCallback(async () => {
    setBusy(true);
    setError(null);
    setSecret(null);
    setGuess("");
    setRevealed(0);
    setLog([]);
    setWon(false);
    try {
      const reply = await ask(
        `Pick ONE common English word (3-10 letters) for a guessing game and write a short one-line clue ` +
          `that does NOT contain the word. Reply EXACTLY as:\nWORD: <word>\nCLUE: <one line>`,
        "word hunt"
      );
      const parsed = parseSecret(reply);
      if (!parsed) setError("Couldn't set up a word. Tap for a new round.");
      else setSecret(parsed);
    } catch {
      setError("No word came back. Tap to retry.");
    } finally {
      setBusy(false);
    }
  }, [ask]);

  useEffect(() => {
    void newRound();
  }, [newRound]);

  const submit = useCallback(() => {
    if (!secret || won) return;
    const g = guess.trim();
    if (!g) return;
    if (g.toLowerCase().replace(/[^a-z]/g, "") === secret.word) {
      setWon(true);
      setRevealed(secret.word.length);
      setLog((l) => [...l, `"${g}" — correct!`]);
    } else {
      const temp = hotness(g, secret.word);
      setRevealed((r) => Math.min(secret.word.length - 1, r + 1));
      setLog((l) => [...l, `"${g}" — ${temp}`]);
    }
    setGuess("");
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50);
  }, [secret, won, guess]);

  const masked = secret
    ? secret.word
        .split("")
        .map((ch, i) => (i < revealed || won ? ch : "•"))
        .join(" ")
    : "";

  return (
    <View style={st.fill}>
      <View style={[st.bar, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <Pressable style={st.exit} onPress={onExit} hitSlop={8}>
          <Text style={st.exitT}>← Menu</Text>
        </Pressable>
        <Pressable style={st.exit} onPress={() => void newRound()} hitSlop={8}>
          <Text style={st.exitT}>New word</Text>
        </Pressable>
      </View>

      <Text style={st.title}>Word Hunt</Text>

      <View style={st.body}>
        {busy ? (
          <ActivityIndicator color="#ffd24d" size="large" />
        ) : error ? (
          <View style={st.center}>
            <Text style={st.err}>{error}</Text>
            <Pressable style={st.goBtn} onPress={() => void newRound()}>
              <Text style={st.goT}>New round</Text>
            </Pressable>
          </View>
        ) : secret ? (
          <>
            <Text style={st.clueLabel}>Clue</Text>
            <Text style={st.clue}>{secret.clue}</Text>
            <Text style={st.masked}>{masked}</Text>
            <Text style={st.sub}>
              {secret.word.length} letters · {won ? "solved" : `${revealed} revealed`}
            </Text>

            <ScrollView ref={scroller} style={st.log} contentContainerStyle={st.logInner}>
              {log.map((l, i) => (
                <Text key={i} style={st.logLine}>
                  • {l}
                </Text>
              ))}
            </ScrollView>

            {won ? (
              <View style={st.center}>
                <Text style={st.win}>You found it!</Text>
                <Pressable style={st.goBtn} onPress={() => void newRound()}>
                  <Text style={st.goT}>Next word →</Text>
                </Pressable>
              </View>
            ) : (
              <View style={st.inputRow}>
                <TextInput
                  style={st.input}
                  value={guess}
                  onChangeText={setGuess}
                  placeholder="Type a guess"
                  placeholderTextColor="#6b7aa0"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={submit}
                  returnKeyType="go"
                />
                <Pressable style={st.goBtn} onPress={submit}>
                  <Text style={st.goT}>Guess</Text>
                </Pressable>
              </View>
            )}
          </>
        ) : null}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0b1021" },
  bar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  exit: { backgroundColor: "rgba(255,255,255,0.15)", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  exitT: { color: "#fff", fontWeight: "600" },
  title: { color: "#fff", fontSize: 24, fontWeight: "800", paddingHorizontal: 16, marginBottom: 8 },
  body: { flex: 1, paddingHorizontal: 16 },
  center: { alignItems: "center", marginTop: 16 },
  clueLabel: { color: "#9fb0d0", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 },
  clue: { color: "#fff", fontSize: 18, marginTop: 4, marginBottom: 18 },
  masked: { color: "#ffd24d", fontSize: 30, fontWeight: "800", letterSpacing: 2, textAlign: "center" },
  sub: { color: "#9fb0d0", fontSize: 13, textAlign: "center", marginTop: 6 },
  log: { flex: 1, marginTop: 12 },
  logInner: { paddingBottom: 8 },
  logLine: { color: "#cdd8f3", fontSize: 15, marginBottom: 4 },
  win: { color: "#7fe0a0", fontSize: 20, fontWeight: "700", marginBottom: 12 },
  err: { color: "#ff9d93", fontSize: 16, textAlign: "center", marginBottom: 14 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 24, paddingTop: 8 },
  input: {
    flex: 1,
    backgroundColor: "#1b2342",
    color: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 16,
  },
  goBtn: { backgroundColor: "#4da3ff", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  goT: { color: "#fff", fontWeight: "700", fontSize: 16 },
});

export const wordHuntGame: GameModule = {
  id: "word-hunt",
  title: "Word Hunt",
  kind: "turn-based",
  Screen,
};
