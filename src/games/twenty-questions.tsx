import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Pressable, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext, AskModel } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, Card, Spinner } from "../design/ui";

const MAX_Q = 20;
const GUESS_AFTER = 15; // when offline, start guessing once this many questions are asked

interface Entry {
  q: string;
  a: string;
}

/* ------------------------------------------------------------------ *
 * Offline fallback bank. The game stays conversational through the
 * model, but if the model stalls (timeout) or returns nothing, we fall
 * back to a deterministic generic question (or, late in the game, a
 * guess) so the state machine never soft-locks.
 * ------------------------------------------------------------------ */
const FALLBACK_QUESTIONS: string[] = [
  "Is it a living thing?",
  "Is it bigger than a microwave?",
  "Can you hold it in one hand?",
  "Is it usually found indoors?",
  "Is it made by people?",
  "Is it something you can eat or drink?",
  "Does it use electricity?",
  "Is it commonly found in a home?",
  "Is it an animal?",
  "Is it used mainly for entertainment?",
  "Is it something you can wear?",
  "Is it found in nature?",
  "Is it heavier than an adult person?",
  "Does it make a sound of its own?",
  "Is it older than a hundred years as an idea?",
  "Would you find it in a kitchen?",
  "Is it mostly made of metal?",
  "Is it something children often play with?",
];

const FALLBACK_GUESSES: string[] = ["a cat", "a smartphone", "a book", "a car", "a tree", "an apple", "a chair"];

async function askWithTimeout(ask: AskModel, prompt: string, note: string, ms = 9000): Promise<string> {
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

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState<Entry[]>([]);
  const [current, setCurrent] = useState<string>("");
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [isGuess, setIsGuess] = useState(false);
  const [offline, setOffline] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const mounted = useRef(true);
  const fbQ = useRef(0); // rotating index into FALLBACK_QUESTIONS
  const fbG = useRef(0); // rotating index into FALLBACK_GUESSES

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Deterministic fallback: a fresh generic question, or a guess late game.
  const useFallback = useCallback((hist: Entry[]) => {
    setOffline(true);
    if (hist.length >= GUESS_AFTER) {
      const g = FALLBACK_GUESSES[fbG.current % FALLBACK_GUESSES.length]!;
      fbG.current += 1;
      setCurrent(g);
      setIsGuess(true);
      return;
    }
    const asked = new Set(hist.map((e) => e.q));
    let picked = "";
    for (let i = 0; i < FALLBACK_QUESTIONS.length; i++) {
      const cand = FALLBACK_QUESTIONS[(fbQ.current + i) % FALLBACK_QUESTIONS.length]!;
      if (!asked.has(cand)) { picked = cand; fbQ.current = (fbQ.current + i + 1) % FALLBACK_QUESTIONS.length; break; }
    }
    if (!picked) picked = FALLBACK_QUESTIONS[fbQ.current % FALLBACK_QUESTIONS.length]!;
    setCurrent(picked);
    setIsGuess(false);
  }, []);

  const askNext = useCallback(
    async (hist: Entry[]) => {
      setBusy(true);
      try {
        const asked = hist.length;
        const transcript =
          hist.length === 0
            ? "(no answers yet)"
            : hist.map((e, i) => `${i + 1}. Q:${e.q} A:${e.a}`).join("\n");
        const reply = await askWithTimeout(
          ask,
          `We are playing Twenty Questions. I am thinking of a single thing (object, animal, person or place). ` +
            `You have asked ${asked} of ${MAX_Q} questions so far:\n${transcript}\n\n` +
            `Reply with ONLY your next single yes/no question. ` +
            `If you are confident what it is, instead reply starting with "GUESS:" followed by your guess.`,
          "twenty questions"
        );
        if (!mounted.current) return;
        const text = (reply || "").trim();
        if (!text) {
          useFallback(hist); // empty/malformed → deterministic fallback
        } else {
          setOffline(false);
          if (/^guess\s*:/i.test(text)) {
            setCurrent(text.replace(/^guess\s*:/i, "").trim() || "what you are thinking of");
            setIsGuess(true);
          } else {
            const firstLine = text.split("\n")[0] ?? text;
            setCurrent(firstLine.trim() || "Is it a living thing?");
            setIsGuess(false);
          }
        }
      } catch {
        if (mounted.current) useFallback(hist); // timeout / error → deterministic fallback
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [ask, useFallback]
  );

  useEffect(() => { void askNext([]); }, [askNext]);

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
        const next = [...history, { q: `Is it ${current}?`, a: "No (wrong guess)" }];
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

  const restart = useCallback(() => {
    setHistory([]);
    setCount(0);
    setDone(null);
    setIsGuess(false);
    setCurrent("");
    fbQ.current = 0;
    fbG.current = 0;
    void askNext([]);
  }, [askNext]);

  return (
    <View style={st.fill}>
      <View style={[st.bar, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
        <View style={{ alignItems: "center" }}>
          <PixelText size="h2" style={{ color: color.cyan }}>20 QUESTIONS</PixelText>
          <PixelText size="label" style={{ marginTop: 4 }}>
            {Math.min(count, MAX_Q)}/{MAX_Q}
          </PixelText>
        </View>
        <View style={{ width: 48 }} />
      </View>

      <Body muted style={st.hint}>
        Think of any one thing. Answer each yes/no question honestly and let it try to guess.
      </Body>

      <ScrollView ref={scroller} style={st.log} contentContainerStyle={st.logInner}>
        {history.map((e, i) => (
          <View key={i} style={st.row}>
            <Body style={st.qText}>{i + 1}. {e.q}</Body>
            <Body style={st.aText}>→ {e.a}</Body>
          </View>
        ))}
      </ScrollView>

      <Card style={st.panel}>
        {done ? (
          <View style={{ alignItems: "center", gap: space.lg }}>
            <Body style={st.done}>{done}</Body>
            <Pressable style={st.againBtn} onPress={restart} accessibilityRole="button">
              <Body style={st.againT}>Play again</Body>
            </Pressable>
          </View>
        ) : busy ? (
          <Spinner label="Thinking…" />
        ) : (
          <>
            {offline ? <Body style={st.offline}>Offline mode</Body> : null}
            <Body style={st.prompt}>
              {isGuess ? `Is it ${current}?` : current}
            </Body>
            {isGuess ? (
              <View style={st.btnRow}>
                <Pressable style={[st.btn, st.yes]} onPress={() => confirmGuess(true)} accessibilityRole="button">
                  <Body style={st.btnT}>Correct!</Body>
                </Pressable>
                <Pressable style={[st.btn, st.no]} onPress={() => confirmGuess(false)} accessibilityRole="button">
                  <Body style={st.btnT}>Nope</Body>
                </Pressable>
              </View>
            ) : (
              <View style={st.btnRow}>
                <Pressable style={[st.btn, st.yes]} onPress={() => answer("Yes")} accessibilityRole="button">
                  <Body style={st.btnT}>Yes</Body>
                </Pressable>
                <Pressable style={[st.btn, st.no]} onPress={() => answer("No")} accessibilityRole="button">
                  <Body style={st.btnT}>No</Body>
                </Pressable>
                <Pressable style={[st.btn, st.maybe]} onPress={() => answer("Maybe")} accessibilityRole="button">
                  <Body style={st.btnT}>Maybe</Body>
                </Pressable>
              </View>
            )}
          </>
        )}
      </Card>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  bar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  hint: { paddingHorizontal: space.lg, marginTop: space.xs },
  log: { flex: 1, marginTop: space.md },
  logInner: { paddingHorizontal: space.lg, paddingBottom: space.md },
  row: { marginBottom: space.md },
  qText: { fontSize: 15, color: color.text },
  aText: { fontSize: 14, color: color.success, fontWeight: "700", marginTop: 2 },
  panel: {
    margin: space.lg,
    minHeight: 130,
    justifyContent: "center",
  },
  offline: { color: color.warn, fontSize: 12, fontWeight: "700", textAlign: "center", marginBottom: space.sm },
  prompt: { color: color.text, fontSize: 19, fontWeight: "700", marginBottom: space.lg, textAlign: "center", lineHeight: 26 },
  done: { color: color.amber, fontSize: 19, fontWeight: "800", textAlign: "center" },
  btnRow: { flexDirection: "row", justifyContent: "center", gap: space.sm },
  btn: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    minWidth: 84,
    alignItems: "center",
    borderWidth: 1.5,
  },
  yes: { backgroundColor: "rgba(91,209,107,0.16)", borderColor: color.success },
  no: { backgroundColor: "rgba(255,82,71,0.16)", borderColor: color.danger },
  maybe: { backgroundColor: color.surface2, borderColor: color.surfaceLine },
  btnT: { color: color.text, fontWeight: "800", fontSize: 15 },
  againBtn: {
    backgroundColor: color.amber,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
  },
  againT: { color: color.onAmber, fontWeight: "800", fontSize: 15 },
});

export const twentyQuestionsGame: GameModule = {
  id: "twenty-questions",
  title: "Twenty Questions",
  kind: "turn-based",
  Screen,
};
