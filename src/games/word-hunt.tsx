import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext, AskModel } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, Card, Input } from "../design/ui";

interface Secret {
  word: string; // lowercase, letters only
  clue: string;
}

/* ------------------------------------------------------------------ *
 * Deterministic offline bank (>= 40 word/clue pairs, 3-10 letters).
 * No clue contains its own word. Model is used for variety when it
 * responds in time; otherwise the bank keeps the game fully playable.
 * ------------------------------------------------------------------ */
const BANK: Secret[] = [
  { word: "cat", clue: "A whiskered household pet that purrs" },
  { word: "sun", clue: "The star at the centre of our system" },
  { word: "key", clue: "A small metal tool that opens a lock" },
  { word: "owl", clue: "A nocturnal bird known for hooting" },
  { word: "map", clue: "A drawing that shows you the way" },
  { word: "ship", clue: "A large vessel that sails the sea" },
  { word: "lion", clue: "The so-called king of the beasts" },
  { word: "moon", clue: "It lights up the night sky" },
  { word: "cake", clue: "A sweet treat baked for birthdays" },
  { word: "star", clue: "A twinkling point of light at night" },
  { word: "river", clue: "Flowing fresh water heading to the sea" },
  { word: "tiger", clue: "A big striped cat from Asia" },
  { word: "cloud", clue: "A fluffy white shape drifting overhead" },
  { word: "piano", clue: "A large keyboard instrument with 88 keys" },
  { word: "apple", clue: "A crunchy fruit grown in orchards" },
  { word: "robot", clue: "A machine that can act on its own" },
  { word: "bread", clue: "A staple food baked from flour" },
  { word: "whale", clue: "The largest creature in the ocean" },
  { word: "planet", clue: "A large body that orbits a star" },
  { word: "guitar", clue: "A six-stringed instrument you strum" },
  { word: "harbor", clue: "A sheltered place where boats dock" },
  { word: "copper", clue: "A reddish metal used in wiring" },
  { word: "walnut", clue: "A wrinkly nut inside a hard shell" },
  { word: "falcon", clue: "A swift, sharp-eyed bird of prey" },
  { word: "castle", clue: "A fortified stone home for royalty" },
  { word: "market", clue: "A place to buy and sell goods" },
  { word: "island", clue: "A piece of land surrounded by water" },
  { word: "bridge", clue: "A structure that spans a river" },
  { word: "rocket", clue: "It blasts off into outer space" },
  { word: "garden", clue: "A plot where flowers and veg grow" },
  { word: "pencil", clue: "You write with its graphite tip" },
  { word: "jungle", clue: "A dense, steamy tropical forest" },
  { word: "anchor", clue: "It keeps a boat from drifting away" },
  { word: "candle", clue: "A wax stick that gives a small flame" },
  { word: "hammer", clue: "A tool for driving in nails" },
  { word: "orange", clue: "A citrus fruit and also a colour" },
  { word: "puzzle", clue: "Pieces you fit together for fun" },
  { word: "rabbit", clue: "A hopping animal with long ears" },
  { word: "volcano", clue: "A mountain that can erupt with fire" },
  { word: "diamond", clue: "The hardest and most prized gemstone" },
  { word: "compass", clue: "A device whose needle points north" },
  { word: "dolphin", clue: "A clever, playful marine mammal" },
  { word: "picture", clue: "A framed image hung on a wall" },
  { word: "blanket", clue: "You pull it up when you feel cold" },
  { word: "kitchen", clue: "The room where meals are cooked" },
  { word: "library", clue: "A quiet building full of books" },
  { word: "cabbage", clue: "A leafy round green vegetable" },
  { word: "balloon", clue: "It floats when filled with light gas" },
  { word: "mountain", clue: "A towering, rocky landform" },
  { word: "elephant", clue: "A huge grey animal with a trunk" },
];

function parseSecret(raw: string): Secret | null {
  const text = (raw || "").trim();
  if (!text) return null;
  const wm = text.match(/word\s*[:\-]\s*([A-Za-z][A-Za-z'-]*)/i);
  const cm = text.match(/clue\s*[:\-]\s*(.+)/i);
  let word = wm && wm[1] ? wm[1].trim() : "";
  let clue = cm && cm[1] ? cm[1].split("\n")[0]!.trim() : "";
  if (!word) {
    const m = text.match(/\b([A-Za-z]{3,})\b/);
    if (m && m[1]) word = m[1];
  }
  if (!clue) clue = "No clue given — guess away!";
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length < 3 || word.length > 10) return null;
  // Guard: never let the clue literally contain the answer.
  if (clue.toLowerCase().includes(word)) return null;
  return { word, clue };
}

/* Shared-letter heat used for the hot/cold hint. */
function hotness(guess: string, word: string): "boiling hot" | "warm" | "cool" | "cold" {
  const g = guess.toLowerCase().replace(/[^a-z]/g, "");
  if (!g) return "cold";
  const wordSet = new Set(word.split(""));
  let shared = 0;
  for (const ch of new Set(g.split(""))) if (wordSet.has(ch)) shared++;
  const ratio = shared / wordSet.size;
  if (ratio >= 0.7) return "boiling hot";
  if (ratio >= 0.45) return "warm";
  if (ratio >= 0.2) return "cool";
  return "cold";
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

function pickFromBank(used: Set<string>): Secret {
  const avail = BANK.filter((b) => !used.has(b.word));
  const pool = avail.length > 0 ? avail : BANK;
  if (avail.length === 0) used.clear();
  const base = pool[Math.floor(Math.random() * pool.length)]!;
  used.add(base.word);
  return base;
}

const PROMPT =
  "Pick ONE common English word (3-10 letters) for a guessing game and write a short one-line clue " +
  "that does NOT contain the word. Reply EXACTLY as:\nWORD: <word>\nCLUE: <one line>";

function heatColor(h: string): string {
  if (h === "boiling hot") return color.danger;
  if (h === "warm") return color.amber;
  if (h === "cool") return color.cyan;
  return color.textMuted;
}

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [secret, setSecret] = useState<Secret | null>(null);
  const [busy, setBusy] = useState(true);
  const [guess, setGuess] = useState("");
  const [revealed, setRevealed] = useState(0);
  const [log, setLog] = useState<{ text: string; heat: string }[]>([]);
  const [won, setWon] = useState(false);
  const [solved, setSolved] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const mounted = useRef(true);
  const used = useRef<Set<string>>(new Set());

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const newRound = useCallback(async () => {
    setBusy(true);
    setSecret(null);
    setGuess("");
    setRevealed(0);
    setLog([]);
    setWon(false);
    let s: Secret | null = null;
    try {
      const reply = await askWithTimeout(ask, PROMPT, "word hunt");
      s = parseSecret(reply);
    } catch {
      s = null;
    }
    if (!s) s = pickFromBank(used.current); // offline fallback — always succeeds
    if (!mounted.current) return;
    setSecret(s);
    setBusy(false);
  }, [ask]);

  useEffect(() => { void newRound(); }, [newRound]);

  const submit = useCallback(() => {
    if (!secret || won) return;
    const g = guess.trim();
    if (!g) return;
    if (g.toLowerCase().replace(/[^a-z]/g, "") === secret.word) {
      setWon(true);
      setRevealed(secret.word.length);
      setSolved((n) => n + 1);
      setLog((l) => [...l, { text: `"${g}" — correct!`, heat: "win" }]);
    } else {
      const heat = hotness(g, secret.word);
      setRevealed((r) => Math.min(secret.word.length - 1, r + 1));
      setLog((l) => [...l, { text: `"${g}" — ${heat}`, heat }]);
    }
    setGuess("");
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50);
  }, [secret, won, guess]);

  const masked = secret
    ? secret.word.split("").map((ch, i) => (i < revealed || won ? ch.toUpperCase() : "•")).join(" ")
    : "";

  return (
    <View style={st.fill}>
      <View style={[st.bar, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
        <View style={{ alignItems: "center" }}>
          <PixelText size="h2" style={{ color: color.cyan }}>WORD HUNT</PixelText>
          <PixelText size="label" style={{ marginTop: 4 }}>SOLVED {solved}</PixelText>
        </View>
        <Pressable style={st.newBtn} onPress={() => void newRound()} accessibilityRole="button" accessibilityLabel="New word">
          <Body style={st.newT}>New</Body>
        </Pressable>
      </View>

      <View style={st.body}>
        {busy || !secret ? (
          <Card><Body muted>Setting up a word…</Body></Card>
        ) : (
          <>
            <Card>
              <Body style={st.clueLabel}>CLUE</Body>
              <Body style={st.clue}>{secret.clue}</Body>
            </Card>

            <Text style={st.masked}>{masked}</Text>
            <Body muted style={st.sub}>
              {secret.word.length} letters · {won ? "solved!" : `${revealed}/${secret.word.length - 1} letters revealed`}
            </Body>

            {log.length === 0 && !won ? (
              <Body muted style={st.instructions}>
                Type a word and tap Guess. Each wrong try reveals a letter and tells you how hot you are.
              </Body>
            ) : null}

            <ScrollView ref={scroller} style={st.log} contentContainerStyle={st.logInner}>
              {log.map((l, i) => (
                <Body key={i} style={{ fontSize: 15, marginBottom: 4, color: l.heat === "win" ? color.success : heatColor(l.heat) }}>
                  • {l.text}
                </Body>
              ))}
            </ScrollView>

            {won ? (
              <View style={st.winRow}>
                <Body style={st.win}>You found it!</Body>
                <Pressable style={st.goBtn} onPress={() => void newRound()} accessibilityRole="button">
                  <Body style={st.goT}>Next word →</Body>
                </Pressable>
              </View>
            ) : (
              <View style={st.inputRow}>
                <Input
                  style={{ flex: 1 }}
                  value={guess}
                  onChangeText={setGuess}
                  placeholder="Type a guess"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={submit}
                  returnKeyType="go"
                />
                <Pressable style={st.goBtn} onPress={submit} accessibilityRole="button">
                  <Body style={st.goT}>Guess</Body>
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
  fill: { flex: 1, backgroundColor: color.bg },
  bar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  body: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.sm },
  clueLabel: { color: color.cyan, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  clue: { fontSize: 18, marginTop: space.xs, lineHeight: 24 },
  masked: { fontSize: 28, fontWeight: "800", letterSpacing: 4, textAlign: "center", marginTop: space.lg, color: color.amber },
  sub: { textAlign: "center", marginTop: space.sm },
  instructions: { marginTop: space.md },
  log: { flex: 1, marginTop: space.md },
  logInner: { paddingBottom: space.sm },
  logLine: { fontSize: 15, marginBottom: 4 },
  winRow: { alignItems: "center", paddingVertical: space.lg, gap: space.md },
  win: { color: color.success, fontSize: 20, fontWeight: "800" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingBottom: space.xl, paddingTop: space.sm },
  goBtn: {
    backgroundColor: color.amber,
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  goT: { color: color.onAmber, fontWeight: "800", fontSize: 15 },
});

export const wordHuntGame: GameModule = {
  id: "word-hunt",
  title: "Word Hunt",
  kind: "turn-based",
  Screen,
};
