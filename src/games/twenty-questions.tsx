import React, { useCallback, useRef, useState } from "react";
import { View, Pressable, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, Card, Button, Chip } from "../design/ui";

/* ================================================================== *
 * TWENTY QUESTIONS - deterministic, offline, bounded ("Option A").
 *
 * The on-device 1.5B model is NOT the authority here. The game is a
 * pure decision procedure over a fixed, in-file catalogue of ~48
 * well-known items, each tagged with boolean attributes. On every turn
 * the app picks the attribute whose Yes/No answer splits the remaining
 * candidates closest to 50/50 (maximum information gain), asks it as a
 * yes/no question, and filters the candidate set by the answer. When one
 * candidate remains (or questions run out) the app guesses. Nothing
 * about correctness depends on the LLM - so it is reliable at any model
 * size. The LLM is intentionally not used; the phrasing is fixed.
 * ================================================================== */

const MAX_Q = 20;

/* ---- Attributes (14). `key` is the fact; `q` is the fixed phrasing. ---- */
const ATTRS = [
  { key: "living", q: "Is it a living thing?" },
  { key: "animal", q: "Is it an animal?" },
  { key: "canFly", q: "Can it fly?" },
  { key: "hasLegs", q: "Does it have legs?" },
  { key: "bigger", q: "Is it bigger than a microwave oven?" },
  { key: "manMade", q: "Is it made by people?" },
  { key: "indoors", q: "Is it usually found indoors?" },
  { key: "electric", q: "Does it use electricity?" },
  { key: "edible", q: "Can you eat it?" },
  { key: "metal", q: "Is it mostly made of metal?" },
  { key: "vehicle", q: "Is it used to travel or carry people?" },
  { key: "place", q: "Is it a place you can visit?" },
  { key: "wheels", q: "Does it have wheels?" },
  { key: "sweet", q: "Is it sweet to taste?" },
] as const;

type AttrKey = (typeof ATTRS)[number]["key"];

interface Item {
  name: string;
  domain: string;
  tags: AttrKey[]; // attributes that are TRUE; anything absent is FALSE
}

/* ---- The bounded catalogue. ~48 items across 5 shown domains. ---- */
const ITEMS: Item[] = [
  // Animals & plants
  { name: "cat", domain: "Animals", tags: ["living", "animal", "hasLegs", "indoors"] },
  { name: "dog", domain: "Animals", tags: ["living", "animal", "hasLegs", "indoors", "bigger"] },
  { name: "rabbit", domain: "Animals", tags: ["living", "animal", "hasLegs", "indoors", "edible"] },
  { name: "elephant", domain: "Animals", tags: ["living", "animal", "hasLegs", "bigger"] },
  { name: "horse", domain: "Animals", tags: ["living", "animal", "hasLegs", "bigger"] },
  { name: "lion", domain: "Animals", tags: ["living", "animal", "hasLegs", "bigger"] },
  { name: "cow", domain: "Animals", tags: ["living", "animal", "hasLegs", "bigger", "edible"] },
  { name: "chicken", domain: "Animals", tags: ["living", "animal", "hasLegs", "edible"] },
  { name: "eagle", domain: "Animals", tags: ["living", "animal", "hasLegs", "canFly"] },
  { name: "spider", domain: "Animals", tags: ["living", "animal", "hasLegs"] },
  { name: "snake", domain: "Animals", tags: ["living", "animal"] },
  { name: "salmon", domain: "Animals", tags: ["living", "animal", "edible"] },
  { name: "shark", domain: "Animals", tags: ["living", "animal", "bigger"] },
  { name: "tree", domain: "Animals", tags: ["living", "bigger"] },
  { name: "rose", domain: "Animals", tags: ["living"] },

  // Everyday objects
  { name: "chair", domain: "Everyday objects", tags: ["manMade", "indoors", "hasLegs"] },
  { name: "table", domain: "Everyday objects", tags: ["manMade", "indoors", "hasLegs", "bigger"] },
  { name: "book", domain: "Everyday objects", tags: ["manMade", "indoors"] },
  { name: "guitar", domain: "Everyday objects", tags: ["manMade", "indoors"] },
  { name: "lamp", domain: "Everyday objects", tags: ["manMade", "indoors", "electric"] },
  { name: "television", domain: "Everyday objects", tags: ["manMade", "indoors", "electric", "bigger"] },
  { name: "smartphone", domain: "Everyday objects", tags: ["manMade", "indoors", "electric", "metal"] },
  { name: "laptop", domain: "Everyday objects", tags: ["manMade", "indoors", "electric", "metal"] },
  { name: "toaster", domain: "Everyday objects", tags: ["manMade", "indoors", "electric", "metal"] },
  { name: "refrigerator", domain: "Everyday objects", tags: ["manMade", "indoors", "electric", "metal", "bigger"] },
  { name: "spoon", domain: "Everyday objects", tags: ["manMade", "indoors", "metal"] },
  { name: "umbrella", domain: "Everyday objects", tags: ["manMade"] },
  { name: "soccer ball", domain: "Everyday objects", tags: ["manMade"] },

  // Food
  { name: "apple", domain: "Food", tags: ["edible", "sweet"] },
  { name: "banana", domain: "Food", tags: ["edible", "sweet"] },
  { name: "carrot", domain: "Food", tags: ["edible"] },
  { name: "egg", domain: "Food", tags: ["edible"] },
  { name: "bread", domain: "Food", tags: ["edible", "manMade"] },
  { name: "cheese", domain: "Food", tags: ["edible", "manMade"] },
  { name: "pizza", domain: "Food", tags: ["edible", "manMade"] },
  { name: "chocolate", domain: "Food", tags: ["edible", "manMade", "sweet"] },
  { name: "ice cream", domain: "Food", tags: ["edible", "manMade", "sweet"] },

  // Places
  { name: "beach", domain: "Places", tags: ["place", "bigger"] },
  { name: "mountain", domain: "Places", tags: ["place", "bigger"] },
  { name: "forest", domain: "Places", tags: ["place", "bigger"] },
  { name: "school", domain: "Places", tags: ["place", "bigger", "manMade"] },
  { name: "hospital", domain: "Places", tags: ["place", "bigger", "manMade"] },
  { name: "library", domain: "Places", tags: ["place", "bigger", "manMade"] },

  // Vehicles
  { name: "car", domain: "Vehicles", tags: ["vehicle", "manMade", "wheels", "metal", "bigger"] },
  { name: "bicycle", domain: "Vehicles", tags: ["vehicle", "manMade", "wheels", "metal", "bigger"] },
  { name: "train", domain: "Vehicles", tags: ["vehicle", "manMade", "wheels", "metal", "bigger", "electric"] },
  { name: "airplane", domain: "Vehicles", tags: ["vehicle", "manMade", "canFly", "metal", "bigger"] },
  { name: "boat", domain: "Vehicles", tags: ["vehicle", "manMade", "metal", "bigger"] },
];

const DOMAINS = ["Animals", "Everyday objects", "Food", "Places", "Vehicles"];

function qText(key: AttrKey): string {
  const a = ATTRS.find((x) => x.key === key);
  return a ? a.q : "";
}

function article(name: string): string {
  return /^[aeiou]/i.test(name) ? "an" : "a";
}

/* ---- The decision procedure. Pure; no LLM, no randomness. ---- */
type Decision =
  | { type: "ask"; key: AttrKey }
  | { type: "guess"; item: Item }
  | { type: "lose" };

function decide(cands: Item[], asked: AttrKey[]): Decision {
  if (cands.length === 0) return { type: "lose" };
  if (cands.length === 1) return { type: "guess", item: cands[0] };

  let bestKey: AttrKey | null = null;
  let bestScore = Number.POSITIVE_INFINITY; // |yes - no|, lower = closer to 50/50
  for (const a of ATTRS) {
    if (asked.includes(a.key)) continue;
    let yes = 0;
    for (const it of cands) if (it.tags.includes(a.key)) yes++;
    if (yes === 0 || yes === cands.length) continue; // splits nothing -> skip
    const score = Math.abs(2 * yes - cands.length);
    if (score < bestScore) {
      bestScore = score;
      bestKey = a.key;
    }
  }
  // No attribute can split the set further -> commit to a guess.
  if (bestKey === null) return { type: "guess", item: cands[0] };
  return { type: "ask", key: bestKey };
}

type Phase = "intro" | "ask" | "guess" | "win" | "lose";

interface Entry {
  q: string;
  a: string;
}

function Screen({ onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>("intro");
  const [candidates, setCandidates] = useState<Item[]>(ITEMS);
  const [asked, setAsked] = useState<AttrKey[]>([]);
  const [curKey, setCurKey] = useState<AttrKey | null>(null);
  const [guess, setGuess] = useState<Item | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [count, setCount] = useState(0);
  const scroller = useRef<ScrollView>(null);

  const scrollDown = useCallback(() => {
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50);
  }, []);

  // Move the machine forward from an explicit (candidates, asked, count).
  const advance = useCallback((cands: Item[], askedKeys: AttrKey[], qCount: number) => {
    if (qCount >= MAX_Q) {
      if (cands.length > 0) {
        setGuess(cands[0]);
        setPhase("guess");
      } else {
        setPhase("lose");
      }
      return;
    }
    const d = decide(cands, askedKeys);
    if (d.type === "ask") {
      setCurKey(d.key);
      setPhase("ask");
    } else if (d.type === "guess") {
      setGuess(d.item);
      setPhase("guess");
    } else {
      setPhase("lose");
    }
  }, []);

  const begin = useCallback(() => {
    setHistory([]);
    setAsked([]);
    setCandidates(ITEMS);
    setCount(0);
    setGuess(null);
    setCurKey(null);
    advance(ITEMS, [], 0);
  }, [advance]);

  const toIntro = useCallback(() => {
    setPhase("intro");
    setHistory([]);
    setAsked([]);
    setCandidates(ITEMS);
    setCount(0);
    setGuess(null);
    setCurKey(null);
  }, []);

  // Answer a yes/no question. "skip" = maybe/unsure: no filtering.
  const answer = useCallback(
    (ans: "yes" | "no" | "skip") => {
      if (phase !== "ask" || curKey === null) return;
      const key = curKey;
      const label = ans === "yes" ? "Yes" : ans === "no" ? "No" : "Maybe";
      const nextHist: Entry[] = [...history, { q: qText(key), a: label }];
      const nextAsked: AttrKey[] = [...asked, key];
      const nextCands =
        ans === "skip" ? candidates : candidates.filter((it) => it.tags.includes(key) === (ans === "yes"));
      const n = count + 1;
      setHistory(nextHist);
      setAsked(nextAsked);
      setCandidates(nextCands);
      setCount(n);
      scrollDown();
      advance(nextCands, nextAsked, n);
    },
    [phase, curKey, history, asked, candidates, count, advance, scrollDown]
  );

  const confirmGuess = useCallback(
    (correct: boolean) => {
      if (phase !== "guess" || !guess) return;
      const g = guess;
      const nextHist: Entry[] = [
        ...history,
        { q: `Is it ${article(g.name)} ${g.name}?`, a: correct ? "Yes" : "No" },
      ];
      const n = count + 1;
      setHistory(nextHist);
      setCount(n);
      scrollDown();
      if (correct) {
        setPhase("win");
        return;
      }
      const nextCands = candidates.filter((it) => it !== g);
      setCandidates(nextCands);
      advance(nextCands, asked, n);
    },
    [phase, guess, history, count, candidates, asked, advance, scrollDown]
  );

  const header = (
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
  );

  if (phase === "intro") {
    return (
      <View style={st.fill}>
        {header}
        <ScrollView style={st.log} contentContainerStyle={st.introInner}>
          <Body style={st.lead}>
            Think of ONE thing and I will try to guess it with yes/no questions. To keep it fair, pick something from
            one of these categories:
          </Body>
          <View style={st.chips}>
            {DOMAINS.map((d) => (
              <View key={d} style={st.chipWrap}>
                <Chip label={d} tone="cyan" />
              </View>
            ))}
          </View>
          <Body muted style={st.examples}>
            For example: a cat, a chair, a pizza, a beach, an airplane.
          </Body>
          <Body style={st.lead}>
            I ask the single most useful question each turn and narrow it down. I will make a guess once I am sure, or
            after 20 questions.
          </Body>
        </ScrollView>
        <Card style={st.panel}>
          <Button title="I have one in mind - start" full onPress={begin} />
        </Card>
      </View>
    );
  }

  return (
    <View style={st.fill}>
      {header}
      <Body muted style={st.hint}>
        Answer honestly. Tap Maybe if you are not sure.
      </Body>

      <ScrollView ref={scroller} style={st.log} contentContainerStyle={st.logInner}>
        {history.map((e, i) => (
          <View key={i} style={st.row}>
            <Body style={st.qText}>{i + 1}. {e.q}</Body>
            <Body style={st.aText}>{"→"} {e.a}</Body>
          </View>
        ))}
      </ScrollView>

      <Card style={st.panel}>
        {phase === "win" ? (
          <View style={{ alignItems: "center", gap: space.lg }}>
            <Body style={st.done}>
              Got it in {count} question{count === 1 ? "" : "s"}!
            </Body>
            <Pressable style={st.againBtn} onPress={toIntro} accessibilityRole="button">
              <Body style={st.againT}>Play again</Body>
            </Pressable>
          </View>
        ) : phase === "lose" ? (
          <View style={{ alignItems: "center", gap: space.lg }}>
            <Body style={st.done}>You win - I could not guess it!</Body>
            <Pressable style={st.againBtn} onPress={toIntro} accessibilityRole="button">
              <Body style={st.againT}>Play again</Body>
            </Pressable>
          </View>
        ) : phase === "guess" && guess ? (
          <>
            <Body muted style={st.left}>
              {candidates.length} possibilit{candidates.length === 1 ? "y" : "ies"} left
            </Body>
            <Body style={st.prompt}>Is it {article(guess.name)} {guess.name}?</Body>
            <View style={st.btnRow}>
              <Pressable style={[st.btn, st.yes]} onPress={() => confirmGuess(true)} accessibilityRole="button">
                <Body style={st.btnT}>Correct!</Body>
              </Pressable>
              <Pressable style={[st.btn, st.no]} onPress={() => confirmGuess(false)} accessibilityRole="button">
                <Body style={st.btnT}>Nope</Body>
              </Pressable>
            </View>
          </>
        ) : phase === "ask" && curKey ? (
          <>
            <Body muted style={st.left}>
              {candidates.length} possibilit{candidates.length === 1 ? "y" : "ies"} left
            </Body>
            <Body style={st.prompt}>{qText(curKey)}</Body>
            <View style={st.btnRow}>
              <Pressable style={[st.btn, st.yes]} onPress={() => answer("yes")} accessibilityRole="button">
                <Body style={st.btnT}>Yes</Body>
              </Pressable>
              <Pressable style={[st.btn, st.no]} onPress={() => answer("no")} accessibilityRole="button">
                <Body style={st.btnT}>No</Body>
              </Pressable>
              <Pressable style={[st.btn, st.maybe]} onPress={() => answer("skip")} accessibilityRole="button">
                <Body style={st.btnT}>Maybe</Body>
              </Pressable>
            </View>
          </>
        ) : null}
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
  introInner: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xl, gap: space.lg },
  lead: { fontSize: 16, color: color.text, lineHeight: 24 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chipWrap: { marginRight: space.xs, marginBottom: space.xs },
  examples: { fontSize: 14 },
  log: { flex: 1, marginTop: space.md },
  logInner: { paddingHorizontal: space.lg, paddingBottom: space.md },
  row: { marginBottom: space.md },
  qText: { fontSize: 15, color: color.text },
  aText: { fontSize: 14, color: color.success, fontWeight: "700", marginTop: 2 },
  panel: {
    margin: space.lg,
    minHeight: 150,
    justifyContent: "center",
  },
  left: { color: color.textMuted, fontSize: 12, fontWeight: "700", textAlign: "center", marginBottom: space.sm },
  prompt: { color: color.text, fontSize: 19, fontWeight: "700", marginBottom: space.lg, textAlign: "center", lineHeight: 26 },
  done: { color: color.amber, fontSize: 19, fontWeight: "800", textAlign: "center" },
  btnRow: { flexDirection: "row", justifyContent: "center", gap: space.sm, flexWrap: "wrap" },
  btn: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    minWidth: 84,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
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
    minHeight: 48,
    justifyContent: "center",
  },
  againT: { color: color.onAmber, fontWeight: "800", fontSize: 15 },
});

export const twentyQuestionsGame: GameModule = {
  id: "twenty-questions",
  title: "Twenty Questions",
  kind: "turn-based",
  Screen,
};
