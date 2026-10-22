import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext, AskModel } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, Card, Input } from "../design/ui";

interface Riddle {
  riddle: string;
  answer: string;
}

/* ------------------------------------------------------------------ *
 * Deterministic offline bank (>= 30). Model supplies variety when it
 * answers in time; otherwise the bank keeps the game playable offline.
 * ------------------------------------------------------------------ */
const BANK: Riddle[] = [
  { riddle: "I speak without a mouth and hear without ears. I have no body, but I come alive with the wind. What am I?", answer: "echo" },
  { riddle: "The more you take, the more you leave behind. What am I?", answer: "footsteps" },
  { riddle: "What has keys but can't open a single lock?", answer: "piano" },
  { riddle: "What has hands but cannot clap?", answer: "clock" },
  { riddle: "What has a neck but no head?", answer: "bottle" },
  { riddle: "What gets wetter and wetter the more it dries?", answer: "towel" },
  { riddle: "What has an eye but cannot see?", answer: "needle" },
  { riddle: "What can travel all around the world while staying in one corner?", answer: "stamp" },
  { riddle: "What has many teeth but cannot bite?", answer: "comb" },
  { riddle: "What has a thumb and four fingers but is not alive?", answer: "glove" },
  { riddle: "What goes up but never ever comes down?", answer: "age" },
  { riddle: "What must be broken before you can use it?", answer: "egg" },
  { riddle: "What has one head, one foot, and four legs?", answer: "bed" },
  { riddle: "What has words on every page but never speaks a sound?", answer: "book" },
  { riddle: "What can you catch but never throw?", answer: "cold" },
  { riddle: "I have a bed but never sleep, and I run but never walk. What am I?", answer: "river" },
  { riddle: "What building has the most stories?", answer: "library" },
  { riddle: "I have roots nobody sees, and I am taller than any tree. What am I?", answer: "mountain" },
  { riddle: "I have cities but no houses, forests but no trees, and water but no fish. What am I?", answer: "map" },
  { riddle: "What comes down but never goes back up?", answer: "rain" },
  { riddle: "What has a ring but no finger?", answer: "telephone" },
  { riddle: "What is full of holes but still holds water?", answer: "sponge" },
  { riddle: "I am tall when I am young and short when I am old. What am I?", answer: "candle" },
  { riddle: "What can fill an entire room but takes up no space at all?", answer: "light" },
  { riddle: "What invention lets you look right through a wall?", answer: "window" },
  { riddle: "What flies forever but has no wings?", answer: "time" },
  { riddle: "What has a head and a tail but no body at all?", answer: "coin" },
  { riddle: "What kind of coat is only ever put on when it is wet?", answer: "paint" },
  { riddle: "What has four legs but cannot walk a step?", answer: "table" },
  { riddle: "What goes through towns and over hills but never once moves?", answer: "road" },
  { riddle: "What has branches but no fruit, trunk, or leaves?", answer: "bank" },
  { riddle: "The more you take away from me, the bigger I become. What am I?", answer: "hole" },
  { riddle: "What is always in front of you but can never be seen?", answer: "future" },
  { riddle: "What can you break even if you never touch or hold it?", answer: "promise" },
  { riddle: "What word is spelled incorrectly in every dictionary?", answer: "incorrectly" },
  { riddle: "I have a heart that never beats. What am I?", answer: "artichoke" },
  { riddle: "What kind of room has no doors and no windows?", answer: "mushroom" },
  { riddle: "I begin with T, end with T, and have tea inside me. What am I?", answer: "teapot" },
];

function parseRiddle(raw: string): Riddle | null {
  const text = (raw || "").trim();
  if (!text) return null;
  const rm = text.match(/riddle\s*[:\-]\s*([\s\S]+?)(?:\n\s*answer\s*[:\-]|$)/i);
  const am = text.match(/answer\s*[:\-]\s*(.+)/i);
  let riddle = rm && rm[1] ? rm[1].trim() : "";
  let answer = am && am[1] ? am[1].split("\n")[0]!.trim() : "";

  if (!riddle || !answer) {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      if (!answer) answer = lines[lines.length - 1]!.replace(/^answer\s*[:\-]\s*/i, "").trim();
      if (!riddle) riddle = lines.slice(0, -1).join(" ").trim();
    }
  }
  answer = answer.replace(/^(a|an|the)\s+/i, "").replace(/[.!?]+$/, "").trim();
  if (!riddle || !answer || answer.length > 40) return null;
  return { riddle, answer };
}

/* ------------------------------------------------------------------ *
 * TIGHTENED answer matching.
 * The previous version accepted ANY substring overlap
 * (g.includes(a) || a.includes(g)), so "a" matched "an apple" and
 * "bank robber" matched "bank". We now require a PROPER match:
 *   - normalized exact equality, OR
 *   - singular/plural of the exact same stem, OR
 *   - a tiny typo tolerance (Levenshtein) for SINGLE-token answers,
 *     scaled to the answer length.
 * No loose substring acceptance.
 * ------------------------------------------------------------------ */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/^(a|an|the)\s+/i, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripPlural(s: string): string {
  if (s.endsWith("es") && s.length > 4) return s.slice(0, -2);
  if (s.endsWith("s") && s.length > 3) return s.slice(0, -1);
  return s;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    const tmp = prev; prev = curr; curr = tmp;
  }
  return prev[n]!;
}

function matches(guess: string, answer: string): boolean {
  const g = normalize(guess);
  const a = normalize(answer);
  if (!g || !a) return false;
  if (g === a) return true;
  // Singular/plural of the exact same stem (not a loose substring).
  if (stripPlural(g) === stripPlural(a)) return true;
  // Small typo tolerance for single-token answers only.
  if (!a.includes(" ") && !g.includes(" ")) {
    const tol = a.length >= 7 ? 2 : a.length >= 4 ? 1 : 0;
    if (tol > 0 && levenshtein(g, a) <= tol) return true;
  }
  return false;
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

function pickFromBank(used: Set<string>): Riddle {
  const avail = BANK.filter((b) => !used.has(b.riddle));
  const pool = avail.length > 0 ? avail : BANK;
  if (avail.length === 0) used.clear();
  const base = pool[Math.floor(Math.random() * pool.length)]!;
  used.add(base.riddle);
  return base;
}

const PROMPT =
  "Give me ONE short classic-style riddle and its one-or-two-word answer. " +
  "Reply EXACTLY as:\nRIDDLE: <the riddle>\nANSWER: <the answer>";

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [riddle, setRiddle] = useState<Riddle | null>(null);
  const [busy, setBusy] = useState(true);
  const [guess, setGuess] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<"win" | "miss" | null>(null);
  const [tries, setTries] = useState(0);
  const [solved, setSolved] = useState(0);
  const mounted = useRef(true);
  const used = useRef<Set<string>>(new Set());

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const newRiddle = useCallback(async () => {
    setBusy(true);
    setRiddle(null);
    setGuess("");
    setRevealed(false);
    setResult(null);
    setTries(0);
    let r: Riddle | null = null;
    try {
      const reply = await askWithTimeout(ask, PROMPT, "riddle");
      r = parseRiddle(reply);
    } catch {
      r = null;
    }
    if (!r) r = pickFromBank(used.current); // offline fallback — always succeeds
    if (!mounted.current) return;
    setRiddle(r);
    setBusy(false);
  }, [ask]);

  useEffect(() => { void newRiddle(); }, [newRiddle]);

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
    setGuess("");
  }, [riddle, revealed, result, guess]);

  const giveUp = useCallback(() => {
    setRevealed(true);
    setResult((r) => (r === "win" ? r : "miss"));
  }, []);

  return (
    <View style={st.fill}>
      <View style={[st.bar, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
        <View style={{ alignItems: "center" }}>
          <PixelText size="h2" style={{ color: color.cyan }}>RIDDLE ME</PixelText>
          <PixelText size="label" style={{ marginTop: 4 }}>SOLVED {solved}</PixelText>
        </View>
        <View style={{ width: 48 }} />
      </View>

      <View style={st.body}>
        {busy || !riddle ? (
          <Card><Body muted>Thinking of a riddle…</Body></Card>
        ) : (
          <>
            <Card>
              <Body style={st.riddle}>{riddle.riddle}</Body>
            </Card>

            {result === "miss" && !revealed ? (
              <Body style={st.miss}>Not it — try again or reveal the answer.</Body>
            ) : null}

            {!revealed && tries === 0 && result === null ? (
              <Body muted style={st.instructions}>
                Read the riddle, type your answer, and tap Guess. Stuck? Reveal the answer.
              </Body>
            ) : null}

            {revealed ? (
              <View style={st.center}>
                <Body style={result === "win" ? st.win : st.reveal}>
                  {result === "win" ? "Correct!" : "The answer was:"}
                </Body>
                <Text style={st.answer}>{riddle.answer.toUpperCase()}</Text>
                <Body muted style={st.sub}>
                  {tries} {tries === 1 ? "guess" : "guesses"}
                </Body>
                <Pressable style={st.goBtn} onPress={() => void newRiddle()} accessibilityRole="button">
                  <Body style={st.goT}>Next riddle →</Body>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={st.inputRow}>
                  <Input
                    style={{ flex: 1 }}
                    value={guess}
                    onChangeText={setGuess}
                    placeholder="Your answer"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onSubmitEditing={submit}
                    returnKeyType="go"
                  />
                  <Pressable style={st.goBtn} onPress={submit} accessibilityRole="button">
                    <Body style={st.goT}>Guess</Body>
                  </Pressable>
                </View>
                <Pressable style={st.giveUp} onPress={giveUp} accessibilityRole="button">
                  <Body style={st.giveUpT}>Reveal answer</Body>
                </Pressable>
              </>
            )}
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
  body: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.sm },
  center: { alignItems: "center", marginTop: space.xl, gap: space.sm },
  riddle: { fontSize: 19, lineHeight: 27 },
  miss: { color: color.danger, fontSize: 15, marginTop: space.md },
  instructions: { marginTop: space.md },
  win: { color: color.success, fontSize: 22, fontWeight: "800" },
  reveal: { color: color.textMuted, fontSize: 16 },
  answer: { color: color.amber, fontSize: 26, fontWeight: "800", letterSpacing: 2, textAlign: "center", marginTop: space.sm },
  sub: { marginTop: space.sm, marginBottom: space.md },
  inputRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.lg },
  goBtn: {
    backgroundColor: color.amber,
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  goT: { color: color.onAmber, fontWeight: "800", fontSize: 15 },
  giveUp: { marginTop: space.lg, alignSelf: "center" },
  giveUpT: { color: color.textMuted, fontSize: 15, textDecorationLine: "underline" },
});

export const riddleMeGame: GameModule = {
  id: "riddle-me",
  title: "Riddle Me",
  kind: "turn-based",
  Screen,
};
