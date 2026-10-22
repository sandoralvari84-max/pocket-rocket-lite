import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";

const MAX_Q = 20;

interface Entry {
  q: string;
  a: string;
}

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState<Entry[]>([]);
  const [current, setCurrent] = useState<string>("");
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [isGuess, setIsGuess] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const askNext = useCallback(
    async (hist: Entry[]) => {
      setBusy(true);
      try {
        const asked = hist.length;
        const transcript =
          hist.length === 0
            ? "(no answers yet)"
            : hist.map((e, i) => `${i + 1}. Q:${e.q} A:${e.a}`).join("\n");
        const reply = await ask(
          `We are playing Twenty Questions. I am thinking of a single thing (object, animal, person or place). ` +
            `You have asked ${asked} of ${MAX_Q} questions so far:\n${transcript}\n\n` +
            `Reply with ONLY your next single yes/no question. ` +
            `If you are confident what it is, instead reply starting with "GUESS:" followed by your guess.`,
          "twenty questions"
        );
        const text = (reply || "").trim();
        if (!text) {
          setCurrent("Is it something you can hold in your hand?");
          setIsGuess(false);
        } else if (/^guess\s*:/i.test(text)) {
          setCurrent(text.replace(/^guess\s*:/i, "").trim() || "Is it what I think?");
          setIsGuess(true);
        } else {
          setCurrent(text.split("\n")[0]!.trim());
          setIsGuess(false);
        }
      } catch {
        setCurrent("Is it a living thing?");
        setIsGuess(false);
      } finally {
        setBusy(false);
      }
    },
    [ask]
  );

  useEffect(() => {
    void askNext([]);
  }, [askNext]);

  const answer = useCallback(
    (a: string) => {
      if (busy || done) return;
      const entry: Entry = { q: current, a };
      const next = [...history, entry];
      const n = count + 1;
      setHistory(next);
      setCount(n);
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50);
      if (n >= MAX_Q) {
        setDone("That was 20 questions. Did it get there?");
        return;
      }
      void askNext(next);
    },
    [busy, done, current, history, count, askNext]
  );

  const confirmGuess = useCallback(
    (correct: boolean) => {
      if (busy) return;
      if (correct) {
        setDone(`Got it in ${count + 1} question${count === 0 ? "" : "s"}!`);
      } else {
        const next = [...history, { q: current, a: "No (wrong guess)" }];
        const n = count + 1;
        setHistory(next);
        setCount(n);
        if (n >= MAX_Q) {
          setDone("Out of questions — you stumped it!");
          return;
        }
        void askNext(next);
      }
    },
    [busy, count, history, current, askNext]
  );

  return (
    <View style={st.fill}>
      <View style={[st.bar, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <Pressable style={st.exit} onPress={onExit} hitSlop={8}>
          <Text style={st.exitT}>← Menu</Text>
        </Pressable>
        <Text style={st.counter}>
          {Math.min(count, MAX_Q)}/{MAX_Q}
        </Text>
      </View>

      <Text style={st.title}>Twenty Questions</Text>
      <Text style={st.hint}>Think of a thing. Answer each question honestly.</Text>

      <ScrollView ref={scroller} style={st.log} contentContainerStyle={st.logInner}>
        {history.map((e, i) => (
          <View key={i} style={st.row}>
            <Text style={st.qText}>
              {i + 1}. {e.q}
            </Text>
            <Text style={st.aText}>→ {e.a}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={st.panel}>
        {done ? (
          <Text style={st.done}>{done}</Text>
        ) : busy ? (
          <ActivityIndicator color="#ffd24d" />
        ) : (
          <>
            <Text style={st.prompt}>
              {isGuess ? "Is it... " : ""}
              {current}
              {isGuess ? "?" : ""}
            </Text>
            {isGuess ? (
              <View style={st.btnRow}>
                <Pressable style={[st.btn, st.yes]} onPress={() => confirmGuess(true)}>
                  <Text style={st.btnT}>Correct!</Text>
                </Pressable>
                <Pressable style={[st.btn, st.no]} onPress={() => confirmGuess(false)}>
                  <Text style={st.btnT}>Nope</Text>
                </Pressable>
              </View>
            ) : (
              <View style={st.btnRow}>
                <Pressable style={[st.btn, st.yes]} onPress={() => answer("Yes")}>
                  <Text style={st.btnT}>Yes</Text>
                </Pressable>
                <Pressable style={[st.btn, st.no]} onPress={() => answer("No")}>
                  <Text style={st.btnT}>No</Text>
                </Pressable>
                <Pressable style={[st.btn, st.maybe]} onPress={() => answer("Maybe")}>
                  <Text style={st.btnT}>Maybe</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
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
  exit: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  exitT: { color: "#fff", fontWeight: "600" },
  counter: { color: "#ffd24d", fontWeight: "700", fontSize: 16 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800", paddingHorizontal: 16 },
  hint: { color: "#9fb0d0", fontSize: 13, paddingHorizontal: 16, marginTop: 2 },
  log: { flex: 1, marginTop: 12 },
  logInner: { paddingHorizontal: 16, paddingBottom: 12 },
  row: { marginBottom: 10 },
  qText: { color: "#dce6ff", fontSize: 15 },
  aText: { color: "#7fe0a0", fontSize: 14, fontWeight: "600" },
  panel: {
    padding: 16,
    paddingBottom: 28,
    backgroundColor: "#141a33",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    minHeight: 120,
    justifyContent: "center",
  },
  prompt: { color: "#fff", fontSize: 18, fontWeight: "600", marginBottom: 14, textAlign: "center" },
  done: { color: "#ffd24d", fontSize: 18, fontWeight: "700", textAlign: "center" },
  btnRow: { flexDirection: "row", justifyContent: "center", gap: 10 },
  btn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, minWidth: 80, alignItems: "center" },
  yes: { backgroundColor: "#2e9e5b" },
  no: { backgroundColor: "#b5453a" },
  maybe: { backgroundColor: "#5a69a8" },
  btnT: { color: "#fff", fontWeight: "700", fontSize: 16 },
});

export const twentyQuestionsGame: GameModule = {
  id: "twenty-questions",
  title: "Twenty Questions",
  kind: "turn-based",
  Screen,
};
