import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";

interface Riddle {
  riddle: string;
  answer: string;
}

function parseRiddle(raw: string): Riddle | null {
  const text = (raw || "").trim();
  if (!text) return null;
  const rm = text.match(/riddle\s*[:\-]\s*([\s\S]+?)(?:\n\s*answer\s*[:\-]|$)/i);
  const am = text.match(/answer\s*[:\-]\s*(.+)/i);
  let riddle = rm ? rm[1]!.trim() : "";
  let answer = am ? am[1]!.split("\n")[0]!.trim() : "";

  if (!riddle || !answer) {
    // Fallback: split on the last line as the answer.
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2 && (!riddle || !answer)) {
      if (!answer) answer = lines[lines.length - 1]!.replace(/^answer\s*[:\-]\s*/i, "").trim();
      if (!riddle) riddle = lines.slice(0, -1).join(" ").trim();
    }
  }
  answer = answer.replace(/^(a|an|the)\s+/i, "").replace(/[.!?]+$/, "").trim();
  if (!riddle || !answer) return null;
  return { riddle, answer };
}

function matches(guess: string, answer: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/^(a|an|the)\s+/i, "").replace(/[^a-z0-9]/g, "");
  const g = norm(guess);
  const a = norm(answer);
  if (!g || !a) return false;
  return g === a || g.includes(a) || a.includes(g);
}

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [riddle, setRiddle] = useState<Riddle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guess, setGuess] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<"win" | "miss" | null>(null);
  const [tries, setTries] = useState(0);
  const [solved, setSolved] = useState(0);

  const newRiddle = useCallback(async () => {
    setBusy(true);
    setError(null);
    setRiddle(null);
    setGuess("");
    setRevealed(false);
    setResult(null);
    try {
      const reply = await ask(
        `Give me ONE short classic-style riddle and its one-or-two-word answer. ` +
          `Reply EXACTLY as:\nRIDDLE: <the riddle>\nANSWER: <the answer>`,
        "riddle"
      );
      const parsed = parseRiddle(reply);
      if (!parsed) setError("Couldn't read that riddle. Tap for another.");
      else setRiddle(parsed);
    } catch {
      setError("No riddle came back. Tap to retry.");
    } finally {
      setBusy(false);
    }
  }, [ask]);

  useEffect(() => {
    void newRiddle();
  }, [newRiddle]);

  const submit = useCallback(() => {
    if (!riddle || revealed || result === "win") return;
    const g = guess.trim();
    if (!g) return;
    setTries((t) => t + 1);
    if (matches(g, riddle.answer)) {
      setResult("win");
      setRevealed(true);
      setSolved((s) => s + 1);
    } else {
      setResult("miss");
    }
  }, [riddle, revealed, result, guess]);

  const giveUp = useCallback(() => {
    setRevealed(true);
    if (result !== "win") setResult("miss");
  }, [result]);

  return (
    <View style={st.fill}>
      <View style={[st.bar, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <Pressable style={st.exit} onPress={onExit} hitSlop={8}>
          <Text style={st.exitT}>← Menu</Text>
        </Pressable>
        <Text style={st.counter}>Solved {solved}</Text>
      </View>

      <Text style={st.title}>Riddle Me</Text>

      <View style={st.body}>
        {busy ? (
          <ActivityIndicator color="#ffd24d" size="large" />
        ) : error ? (
          <View style={st.center}>
            <Text style={st.err}>{error}</Text>
            <Pressable style={st.goBtn} onPress={() => void newRiddle()}>
              <Text style={st.goT}>Try again</Text>
            </Pressable>
          </View>
        ) : riddle ? (
          <>
            <Text style={st.riddle}>{riddle.riddle}</Text>

            {result === "miss" && !revealed && <Text style={st.miss}>Not it — try again or give up.</Text>}

            {revealed ? (
              <View style={st.center}>
                <Text style={result === "win" ? st.win : st.reveal}>
                  {result === "win" ? "Correct!" : "The answer was:"}
                </Text>
                <Text style={st.answer}>{riddle.answer}</Text>
                <Text style={st.sub}>
                  {tries} gues{tries === 1 ? "s" : "ses"}
                </Text>
                <Pressable style={st.goBtn} onPress={() => void newRiddle()}>
                  <Text style={st.goT}>Next riddle →</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={st.inputRow}>
                  <TextInput
                    style={st.input}
                    value={guess}
                    onChangeText={setGuess}
                    placeholder="Your answer"
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
                <Pressable style={st.giveUp} onPress={giveUp}>
                  <Text style={st.giveUpT}>Reveal answer</Text>
                </Pressable>
              </>
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
  counter: { color: "#ffd24d", fontWeight: "700", fontSize: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800", paddingHorizontal: 16, marginBottom: 8 },
  body: { flex: 1, paddingHorizontal: 16 },
  center: { alignItems: "center", marginTop: 20 },
  riddle: { color: "#fff", fontSize: 20, lineHeight: 28, marginTop: 10, marginBottom: 22 },
  miss: { color: "#ff9d93", fontSize: 15, marginBottom: 12 },
  win: { color: "#7fe0a0", fontSize: 22, fontWeight: "800" },
  reveal: { color: "#9fb0d0", fontSize: 16 },
  answer: { color: "#ffd24d", fontSize: 26, fontWeight: "800", marginTop: 6, textAlign: "center" },
  sub: { color: "#9fb0d0", fontSize: 13, marginTop: 8, marginBottom: 16 },
  err: { color: "#ff9d93", fontSize: 16, textAlign: "center", marginBottom: 14 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
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
  giveUp: { marginTop: 16, alignSelf: "center" },
  giveUpT: { color: "#9fb0d0", fontSize: 15, textDecorationLine: "underline" },
});

export const riddleMeGame: GameModule = {
  id: "riddle-me",
  title: "Riddle Me",
  kind: "turn-based",
  Screen,
};
