import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";

interface Dilemma {
  a: string;
  b: string;
}

function clean(s: string): string {
  return s
    .replace(/^[\s"'*\-•]+/, "")
    .replace(/[\s"'*]+$/, "")
    .replace(/[?.]+$/, "")
    .trim();
}

function parseDilemma(raw: string): Dilemma | null {
  let text = (raw || "").trim();
  if (!text) return null;
  // Drop a leading "Would you rather" lead-in.
  text = text.replace(/^.*would you rather\s*/i, "");

  // Try "A" ... "or" ... "B"
  const orSplit = text.split(/\bor\b/i);
  if (orSplit.length >= 2) {
    const a = clean(orSplit[0]!);
    const b = clean(orSplit.slice(1).join(" or "));
    if (a && b && a.length <= 120 && b.length <= 120) return { a, b };
  }

  // Try explicit "A:" / "B:" labels.
  const am = raw.match(/\bA\s*[:\-.)]\s*(.+)/i);
  const bm = raw.match(/\bB\s*[:\-.)]\s*(.+)/i);
  if (am && bm) {
    const a = clean(am[1]!.split("\n")[0]!);
    const b = clean(bm[1]!.split("\n")[0]!);
    if (a && b) return { a, b };
  }
  return null;
}

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [dilemma, setDilemma] = useState<Dilemma | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<"a" | "b" | null>(null);
  const [quip, setQuip] = useState<string | null>(null);
  const [quipBusy, setQuipBusy] = useState(false);
  const [round, setRound] = useState(0);

  const newDilemma = useCallback(async () => {
    setBusy(true);
    setError(null);
    setDilemma(null);
    setPicked(null);
    setQuip(null);
    try {
      const reply = await ask(
        `Give me ONE fun, light "would you rather" dilemma with exactly two options. ` +
          `Reply EXACTLY as:\nA: <first option>\nB: <second option>`,
        "would you rather"
      );
      const parsed = parseDilemma(reply);
      if (!parsed) setError("Couldn't read that one. Tap for another.");
      else {
        setDilemma(parsed);
        setRound((r) => r + 1);
      }
    } catch {
      setError("Nothing came back. Tap to retry.");
    } finally {
      setBusy(false);
    }
  }, [ask]);

  useEffect(() => {
    void newDilemma();
  }, [newDilemma]);

  const choose = useCallback(
    async (side: "a" | "b") => {
      if (!dilemma || picked) return;
      setPicked(side);
      const chosen = side === "a" ? dilemma.a : dilemma.b;
      setQuipBusy(true);
      try {
        const reply = await ask(
          `In a "would you rather" game the player chose: "${chosen}". ` +
            `React with ONE short, playful one-line quip (no more than 20 words).`,
          "quip"
        );
        const line = (reply || "").trim().split("\n")[0]!.trim();
        setQuip(line || "Bold choice!");
      } catch {
        setQuip("Interesting pick!");
      } finally {
        setQuipBusy(false);
      }
    },
    [dilemma, picked, ask]
  );

  const sideStyle = (side: "a" | "b") => {
    if (!picked) return st.card;
    if (picked === side) return [st.card, st.cardPicked];
    return [st.card, st.cardDim];
  };

  return (
    <View style={st.fill}>
      <View style={[st.bar, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <Pressable style={st.exit} onPress={onExit} hitSlop={8}>
          <Text style={st.exitT}>← Menu</Text>
        </Pressable>
        <Text style={st.counter}>Round {round}</Text>
      </View>

      <Text style={st.title}>Would You Rather</Text>

      <View style={st.body}>
        {busy ? (
          <ActivityIndicator color="#ffd24d" size="large" />
        ) : error ? (
          <View style={st.center}>
            <Text style={st.err}>{error}</Text>
            <Pressable style={st.nextBtn} onPress={() => void newDilemma()}>
              <Text style={st.nextT}>Try again</Text>
            </Pressable>
          </View>
        ) : dilemma ? (
          <>
            <Pressable style={sideStyle("a")} onPress={() => void choose("a")} disabled={picked !== null}>
              <Text style={st.cardLabel}>A</Text>
              <Text style={st.cardText}>{dilemma.a}</Text>
            </Pressable>

            <Text style={st.or}>— or —</Text>

            <Pressable style={sideStyle("b")} onPress={() => void choose("b")} disabled={picked !== null}>
              <Text style={st.cardLabel}>B</Text>
              <Text style={st.cardText}>{dilemma.b}</Text>
            </Pressable>

            {picked && (
              <View style={st.center}>
                {quipBusy ? (
                  <ActivityIndicator color="#ffd24d" />
                ) : (
                  <Text style={st.quip}>{quip}</Text>
                )}
                <Pressable style={st.nextBtn} onPress={() => void newDilemma()}>
                  <Text style={st.nextT}>Next →</Text>
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
  body: { flex: 1, paddingHorizontal: 16, justifyContent: "center" },
  center: { alignItems: "center", marginTop: 20 },
  card: { backgroundColor: "#1b2342", borderRadius: 16, padding: 20, borderWidth: 2, borderColor: "transparent" },
  cardPicked: { borderColor: "#7fe0a0", backgroundColor: "#213a2b" },
  cardDim: { opacity: 0.4 },
  cardLabel: { color: "#ffd24d", fontSize: 14, fontWeight: "800", marginBottom: 6 },
  cardText: { color: "#fff", fontSize: 19, lineHeight: 25 },
  or: { color: "#9fb0d0", fontSize: 15, textAlign: "center", marginVertical: 14, fontWeight: "600" },
  quip: { color: "#ffd24d", fontSize: 17, fontStyle: "italic", textAlign: "center", marginBottom: 16 },
  err: { color: "#ff9d93", fontSize: 16, textAlign: "center", marginBottom: 14 },
  nextBtn: { backgroundColor: "#4da3ff", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  nextT: { color: "#fff", fontWeight: "700", fontSize: 16 },
});

export const wouldYouRatherGame: GameModule = {
  id: "would-you-rather",
  title: "Would You Rather",
  kind: "turn-based",
  Screen,
};
