import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext, AskModel } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, Card } from "../design/ui";

interface Question {
  q: string;
  options: string[];
  correct: number; // index into options
  category?: string;
}

const LETTERS = ["A", "B", "C", "D"] as const;

/* ------------------------------------------------------------------ *
 * Deterministic offline bank (>= 40). The model is used for extra
 * variety when it answers in time, but the game is fully playable
 * with no model at all.
 * ------------------------------------------------------------------ */
const BANK: Question[] = [
  { q: "What is the capital of France?", options: ["Paris", "London", "Rome", "Berlin"], correct: 0, category: "Geography" },
  { q: "Which is the largest planet in our solar system?", options: ["Mars", "Jupiter", "Saturn", "Neptune"], correct: 1, category: "Space" },
  { q: "How many continents are there on Earth?", options: ["Five", "Six", "Seven", "Eight"], correct: 2, category: "Geography" },
  { q: "What is the chemical symbol for gold?", options: ["Ag", "Au", "Gd", "Go"], correct: 1, category: "Science" },
  { q: "Which is the largest mammal on Earth?", options: ["African elephant", "Blue whale", "Giraffe", "Hippopotamus"], correct: 1, category: "Nature" },
  { q: "How many legs does a spider have?", options: ["Six", "Eight", "Ten", "Twelve"], correct: 1, category: "Nature" },
  { q: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Mercury"], correct: 1, category: "Space" },
  { q: "What is the hardest natural substance?", options: ["Gold", "Iron", "Diamond", "Quartz"], correct: 2, category: "Science" },
  { q: "How many sides does a hexagon have?", options: ["Five", "Six", "Seven", "Eight"], correct: 1, category: "Math" },
  { q: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], correct: 3, category: "Geography" },
  { q: "What is the most abundant gas in Earth's atmosphere?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], correct: 1, category: "Science" },
  { q: "Which is the fastest land animal?", options: ["Lion", "Cheetah", "Horse", "Greyhound"], correct: 1, category: "Nature" },
  { q: "How many colors are in a traditional rainbow?", options: ["Five", "Six", "Seven", "Eight"], correct: 2, category: "Nature" },
  { q: "What is H2O more commonly known as?", options: ["Salt", "Water", "Hydrogen", "Acid"], correct: 1, category: "Science" },
  { q: "Which planet is closest to the Sun?", options: ["Earth", "Venus", "Mercury", "Mars"], correct: 2, category: "Space" },
  { q: "How many strings does a standard guitar have?", options: ["Four", "Five", "Six", "Seven"], correct: 2, category: "Music" },
  { q: "What is the tallest living animal?", options: ["Elephant", "Giraffe", "Horse", "Camel"], correct: 1, category: "Nature" },
  { q: "What is the freezing point of water in Celsius?", options: ["Minus ten", "Zero", "Ten", "Thirty-two"], correct: 1, category: "Science" },
  { q: "How many minutes are in one hour?", options: ["Thirty", "Forty-five", "Sixty", "Ninety"], correct: 2, category: "Math" },
  { q: "Which is the largest country by land area?", options: ["Canada", "China", "United States", "Russia"], correct: 3, category: "Geography" },
  { q: "What do bees primarily collect from flowers?", options: ["Water", "Nectar", "Sand", "Milk"], correct: 1, category: "Nature" },
  { q: "Which organ pumps blood through the body?", options: ["Lungs", "Heart", "Liver", "Brain"], correct: 1, category: "Science" },
  { q: "How many days are in a leap year?", options: ["364", "365", "366", "367"], correct: 2, category: "Math" },
  { q: "Which is the largest hot desert in the world?", options: ["Sahara", "Gobi", "Kalahari", "Arabian"], correct: 0, category: "Geography" },
  { q: "The Great Barrier Reef lies off the coast of which country?", options: ["Brazil", "Australia", "India", "Mexico"], correct: 1, category: "Geography" },
  { q: "How many planets are in our solar system?", options: ["Seven", "Eight", "Nine", "Ten"], correct: 1, category: "Space" },
  { q: "Which metal is liquid at room temperature?", options: ["Iron", "Mercury", "Lead", "Tin"], correct: 1, category: "Science" },
  { q: "What is the main ingredient in bread?", options: ["Flour", "Rice", "Sugar", "Salt"], correct: 0, category: "Food" },
  { q: "Which bird is famous for its colorful fanned tail?", options: ["Crow", "Peacock", "Sparrow", "Owl"], correct: 1, category: "Nature" },
  { q: "How many letters are in the English alphabet?", options: ["24", "25", "26", "27"], correct: 2, category: "Language" },
  { q: "Which force pulls objects toward the Earth?", options: ["Magnetism", "Gravity", "Friction", "Tension"], correct: 1, category: "Science" },
  { q: "Which of these is a primary color?", options: ["Green", "Orange", "Blue", "Purple"], correct: 2, category: "Art" },
  { q: "What is frozen water called?", options: ["Steam", "Ice", "Fog", "Dew"], correct: 1, category: "Science" },
  { q: "How many hours are in a full day?", options: ["Twelve", "Twenty", "Twenty-four", "Thirty"], correct: 2, category: "Math" },
  { q: "Which animal is often called man's best friend?", options: ["Cat", "Dog", "Horse", "Rabbit"], correct: 1, category: "Nature" },
  { q: "What is the largest internal organ in the human body?", options: ["Heart", "Liver", "Lungs", "Stomach"], correct: 1, category: "Science" },
  { q: "On which continent is the Sahara located?", options: ["Asia", "Africa", "Europe", "Australia"], correct: 1, category: "Geography" },
  { q: "Which shape has exactly three sides?", options: ["Square", "Triangle", "Circle", "Pentagon"], correct: 1, category: "Math" },
  { q: "What is molten rock called once it erupts above ground?", options: ["Ash", "Lava", "Steam", "Coal"], correct: 1, category: "Science" },
  { q: "Which season directly follows winter?", options: ["Summer", "Spring", "Autumn", "Monsoon"], correct: 1, category: "Nature" },
  { q: "How many wheels does a standard car have?", options: ["Two", "Three", "Four", "Six"], correct: 2, category: "General" },
  { q: "Which gas do plants absorb from the air to grow?", options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Helium"], correct: 1, category: "Science" },
  { q: "Which planet is famous for its prominent rings?", options: ["Mars", "Saturn", "Venus", "Mercury"], correct: 1, category: "Space" },
  { q: "What is the capital of Japan?", options: ["Seoul", "Beijing", "Tokyo", "Bangkok"], correct: 2, category: "Geography" },
  { q: "How many faces does a cube have?", options: ["Four", "Six", "Eight", "Twelve"], correct: 1, category: "Math" },
  { q: "What do caterpillars eventually turn into?", options: ["Spiders", "Butterflies", "Bees", "Ants"], correct: 1, category: "Nature" },
];

/* ---- model-reply parser (kept defensive) ---- */
function parseQuestion(raw: string): Question | null {
  const text = (raw || "").trim();
  if (!text) return null;
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  let q = "";
  const options: string[] = [];
  let correct = -1;

  for (const line of lines) {
    const qm = line.match(/^Q(?:uestion)?\s*[:\-.)]\s*(.+)$/i);
    if (qm && qm[1] && !q) { q = qm[1].trim(); continue; }
    const om = line.match(/^([A-D])\s*[:\-.)]\s*(.+)$/i);
    if (om && om[1] && om[2]) {
      const idx = LETTERS.indexOf(om[1].toUpperCase() as (typeof LETTERS)[number]);
      if (idx >= 0) { options[idx] = om[2].trim(); continue; }
    }
    const cm = line.match(/^(?:correct|answer)\s*[:\-.)]\s*([A-D])/i);
    if (cm && cm[1]) { correct = LETTERS.indexOf(cm[1].toUpperCase() as (typeof LETTERS)[number]); continue; }
    if (!q) q = line;
  }

  if (correct < 0) {
    const bare = lines.find((l) => /^[A-D]$/i.test(l));
    if (bare) correct = LETTERS.indexOf(bare.toUpperCase() as (typeof LETTERS)[number]);
  }

  const filled = options.filter((o) => typeof o === "string" && o.length > 0);
  if (!q || filled.length < 2 || correct < 0 || correct > 3 || !options[correct]) return null;

  const clean: string[] = [];
  let newCorrect = 0;
  for (let i = 0; i < 4; i++) {
    const o = options[i];
    if (typeof o === "string" && o.length > 0) {
      if (i === correct) newCorrect = clean.length;
      clean.push(o);
    }
  }
  return { q, options: clean, correct: newCorrect, category: "Model" };
}

/* ---- ask() wrapped with a hard timeout so a stalled model never hangs ---- */
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

function shuffleOptions(q: Question): Question {
  const idx = q.options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = idx[i]!; idx[i] = idx[j]!; idx[j] = tmp;
  }
  const options = idx.map((i) => q.options[i]!);
  const correct = idx.indexOf(q.correct);
  return { q: q.q, options, correct: correct < 0 ? 0 : correct, category: q.category };
}

function pickFromBank(used: Set<string>): Question {
  const avail = BANK.filter((b) => !used.has(b.q));
  const pool = avail.length > 0 ? avail : BANK;
  if (avail.length === 0) used.clear();
  const base = pool[Math.floor(Math.random() * pool.length)]!;
  used.add(base.q);
  return shuffleOptions(base);
}

const PROMPT =
  "Give me ONE fun general-knowledge trivia question with four answer options. " +
  "Format EXACTLY like:\nQ: <question>\nA: <opt>\nB: <opt>\nC: <opt>\nD: <opt>\nCorrect: <letter>";

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [question, setQuestion] = useState<Question | null>(null);
  const [busy, setBusy] = useState(true);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [asked, setAsked] = useState(0);
  const mounted = useRef(true);
  const used = useRef<Set<string>>(new Set());

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const loadQuestion = useCallback(async () => {
    setBusy(true);
    setPicked(null);
    setQuestion(null);
    let q: Question | null = null;
    try {
      const reply = await askWithTimeout(ask, PROMPT, "trivia");
      const parsed = parseQuestion(reply);
      if (parsed) q = shuffleOptions(parsed);
    } catch {
      q = null;
    }
    if (!q) q = pickFromBank(used.current); // offline fallback — always succeeds
    if (!mounted.current) return;
    setQuestion(q);
    setBusy(false);
  }, [ask]);

  useEffect(() => { void loadQuestion(); }, [loadQuestion]);

  const pick = useCallback((i: number) => {
    if (picked !== null || !question) return;
    setPicked(i);
    setAsked((a) => a + 1);
    if (i === question.correct) setScore((s) => s + 1);
  }, [picked, question]);

  const optionStyle = (i: number) => {
    if (picked === null || !question) return [st.opt];
    if (i === question.correct) return [st.opt, st.optRight];
    if (i === picked) return [st.opt, st.optWrong];
    return [st.opt, st.optDim];
  };

  return (
    <View style={st.fill}>
      <View style={[st.bar, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <View style={st.scorePanel}>
          <PixelText size="label">SCORE</PixelText>
          <PixelText size="score" style={{ marginTop: 2 }}>
            {score}/{asked}
          </PixelText>
        </View>
        <View style={{ alignItems: "center" }}>
          <PixelText size="h2" style={{ color: color.cyan }}>TRIVIA</PixelText>
          <PixelText size="label" style={{ marginTop: 4 }}>Q {asked + 1}</PixelText>
        </View>
        <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
      </View>

      <View style={st.body}>
        {busy || !question ? (
          <Card style={st.qCard}>
            <Body muted>Loading a question…</Body>
          </Card>
        ) : (
          <>
            <Card style={st.qCard}>
              {question.category ? (
                <Body style={st.catLabel}>{question.category.toUpperCase()}</Body>
              ) : null}
              <Body style={st.q}>{question.q}</Body>
            </Card>

            {asked === 0 && picked === null ? (
              <Body muted style={st.instructions}>
                Tap the answer you think is correct. A fresh question comes after each one.
              </Body>
            ) : null}

            <View style={{ marginTop: space.md }}>
              {question.options.map((o, i) => (
                <Pressable
                  key={i}
                  style={({ pressed }) => [...optionStyle(i), pressed && picked === null && { opacity: 0.85 }]}
                  onPress={() => pick(i)}
                  disabled={picked !== null}
                  accessibilityRole="button"
                >
                  <Body style={st.optT}>
                    <Body style={st.optLetter}>{LETTERS[i]} </Body>
                    {o}
                  </Body>
                </Pressable>
              ))}
            </View>

            {picked !== null ? (
              <View style={st.verdictRow}>
                <Body style={picked === question.correct ? st.verdictWin : st.verdictLose}>
                  {picked === question.correct ? "Correct!" : "Not quite."}
                </Body>
                <Pressable style={st.nextBtn} onPress={() => void loadQuestion()} accessibilityRole="button">
                  <Body style={st.nextT}>Next →</Body>
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </View>
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
  scorePanel: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.surfaceLine,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minWidth: 76,
  },
  body: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.sm },
  qCard: { marginTop: space.sm },
  catLabel: { color: color.cyan, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: space.xs },
  q: { fontSize: 19, fontWeight: "600", lineHeight: 26 },
  instructions: { marginTop: space.md },
  opt: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.surfaceLine,
    padding: space.lg,
    borderRadius: radius.md,
    marginBottom: space.sm,
  },
  optRight: { backgroundColor: "rgba(91,209,107,0.18)", borderColor: color.success },
  optWrong: { backgroundColor: "rgba(255,82,71,0.16)", borderColor: color.danger },
  optDim: { opacity: 0.45 },
  optT: { fontSize: 16 },
  optLetter: { color: color.amber, fontWeight: "800" },
  verdictRow: {
    marginTop: space.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  verdictWin: { color: color.success, fontSize: 18, fontWeight: "800" },
  verdictLose: { color: color.danger, fontSize: 18, fontWeight: "800" },
  nextBtn: {
    backgroundColor: color.amber,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
  },
  nextT: { color: color.onAmber, fontWeight: "800", fontSize: 15 },
});

export const triviaTimeGame: GameModule = {
  id: "trivia-time",
  title: "Trivia Time",
  kind: "turn-based",
  Screen,
};
