import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";

interface Question {
  q: string;
  options: string[];
  correct: number; // index 0..3
}

const LETTERS = ["A", "B", "C", "D"] as const;

function parseQuestion(raw: string): Question | null {
  const text = (raw || "").trim();
  if (!text) return null;
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let q = "";
  const options: string[] = [];
  let correct = -1;

  for (const line of lines) {
    const qm = line.match(/^Q(?:uestion)?\s*[:\-.)]\s*(.+)$/i);
    if (qm && !q) {
      q = qm[1]!.trim();
      continue;
    }
    const om = line.match(/^([A-D])\s*[:\-.)]\s*(.+)$/i);
    if (om) {
      const idx = LETTERS.indexOf(om[1]!.toUpperCase() as (typeof LETTERS)[number]);
      if (idx >= 0) {
        options[idx] = om[2]!.trim();
        continue;
      }
    }
    const cm = line.match(/^(?:correct|answer)\s*[:\-.)]\s*([A-D])/i);
    if (cm) {
      correct = LETTERS.indexOf(cm[1]!.toUpperCase() as (typeof LETTERS)[number]);
      continue;
    }
    if (!q) q = line;
  }

  // Fallback: a bare letter somewhere on its own line.
  if (correct < 0) {
    const bare = lines.find((l) => /^[A-D]$/i.test(l));
    if (bare) correct = LETTERS.indexOf(bare.toUpperCase() as (typeof LETTERS)[number]);
  }

  const filled = options.filter((o) => typeof o === "string" && o.length > 0);
  if (!q || filled.length < 2 || correct < 0 || correct > 3 || !options[correct]) {
    return null;
  }
  // Compact options so there are no holes.
  const clean: string[] = [];
  let newCorrect = 0;
  for (let i = 0; i < 4; i++) {
    const o = options[i];
    if (typeof o === "string" && o.length > 0) {
      if (i === correct) newCorrect = clean.length;
      clean.push(o);
    }
  }
  return { q, options: clean, correct: newCorrect };
}

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [question, setQuestion] = useState<Question | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [asked, setAsked] = useState(0);

  const loadQuestion = useCallback(async () => {
    setBusy(true);
    setError(null);
    setPicked(null);
    setQuestion(null);
    try {
      const reply = await ask(
        `Give me ONE fun general-knowledge trivia question with four answer options. ` +
          `Format EXACTLY like:\nQ: <question>\nA: <opt>\nB: <opt>\nC: <opt>\nD: <opt>\nCorrect: <letter>`,
        "trivia"
      );
      const parsed = parseQuestion(reply);
      if (!parsed) {
        setError("Couldn't read that one. Tap for another.");
      } else {
        setQuestion(parsed);
      }
    } catch {
      setError("No question came back. Tap to retry.");
    } finally {
      setBusy(false);
    }
  }, [ask]);

  useEffect(() => {
    void loadQuestion();
  }, [loadQuestion]);

  const pick = useCallback(
    (i: number) => {
      if (picked !== null || !question) return;
      setPicked(i);
      setAsked((a) => a + 1);
      if (i === question.correct) setScore((s) => s + 1);
    },
    [picked, question]
  );

  const optionStyle = (i: number) => {
    if (picked === null || !question) return st.opt;
    if (i === question.correct) return [st.opt, st.optRight];
    if (i === picked) return [st.opt, st.optWrong];
    return [st.opt, st.optDim];
  };

  return (
    <View style={st.fill}>
      <View style={[st.bar, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <Pressable style={st.exit} onPress={onExit} hitSlop={8}>
          <Text style={st.exitT}>← Menu</Text>
        </Pressable>
        <Text style={st.counter}>
          Score {score}/{asked}
        </Text>
      </View>

      <Text style={st.title}>Trivia Time</Text>

      <View style={st.body}>
        {busy ? (
          <ActivityIndicator color="#ffd24d" size="large" />
        ) : error ? (
          <View style={st.center}>
            <Text style={st.err}>{error}</Text>
            <Pressable style={st.nextBtn} onPress={() => void loadQuestion()}>
              <Text style={st.nextT}>Try again</Text>
            </Pressable>
          </View>
        ) : question ? (
          <>
            <Text style={st.q}>{question.q}</Text>
            {question.options.map((o, i) => (
              <Pressable key={i} style={optionStyle(i)} onPress={() => pick(i)} disabled={picked !== null}>
                <Text style={st.optT}>
                  {LETTERS[i]}. {o}
                </Text>
              </Pressable>
            ))}
            {picked !== null && (
              <View style={st.center}>
                <Text style={st.verdict}>
                  {picked === question.correct ? "Correct!" : "Not quite."}
                </Text>
                <Pressable style={st.nextBtn} onPress={() => void loadQuestion()}>
                  <Text style={st.nextT}>Next question →</Text>
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
  counter: { color: "#ffd24d", fontWeight: "700", fontSize: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800", paddingHorizontal: 16, marginBottom: 8 },
  body: { flex: 1, paddingHorizontal: 16 },
  center: { alignItems: "center", marginTop: 16 },
  q: { color: "#fff", fontSize: 20, fontWeight: "600", marginBottom: 18, lineHeight: 26 },
  opt: { backgroundColor: "#1b2342", padding: 14, borderRadius: 12, marginBottom: 10 },
  optRight: { backgroundColor: "#2e9e5b" },
  optWrong: { backgroundColor: "#b5453a" },
  optDim: { opacity: 0.5 },
  optT: { color: "#fff", fontSize: 16 },
  verdict: { color: "#ffd24d", fontSize: 18, fontWeight: "700", marginBottom: 12 },
  err: { color: "#ff9d93", fontSize: 16, textAlign: "center", marginBottom: 14 },
  nextBtn: { backgroundColor: "#4da3ff", paddingVertical: 12, paddingHorizontal: 22, borderRadius: 10 },
  nextT: { color: "#fff", fontWeight: "700", fontSize: 16 },
});

export const triviaTimeGame: GameModule = {
  id: "trivia-time",
  title: "Trivia Time",
  kind: "turn-based",
  Screen,
};
