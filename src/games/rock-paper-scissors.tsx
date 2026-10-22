import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";

type Hand = "rock" | "paper" | "scissors";
const HANDS: readonly Hand[] = ["rock", "paper", "scissors"];
const EMOJI: Record<Hand, string> = { rock: "🪨", paper: "📄", scissors: "✂️" };
const BEATS: Record<Hand, Hand> = { rock: "scissors", paper: "rock", scissors: "paper" };

const randomHand = (): Hand => HANDS[Math.floor(Math.random() * HANDS.length)]!;

// Find the first hand word the model mentions; otherwise null.
function parseHand(reply: string): Hand | null {
  const lower = reply.toLowerCase();
  let best: Hand | null = null;
  let bestIdx = Infinity;
  for (const h of HANDS) {
    const idx = lower.indexOf(h);
    if (idx !== -1 && idx < bestIdx) { bestIdx = idx; best = h; }
  }
  return best;
}

type Outcome = "win" | "lose" | "tie";
function resolve(player: Hand, model: Hand): Outcome {
  if (player === model) return "tie";
  return BEATS[player] === model ? "win" : "lose";
}

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [ties, setTies] = useState(0);
  const [playerHand, setPlayerHand] = useState<Hand | null>(null);
  const [modelHand, setModelHand] = useState<Hand | null>(null);
  const [result, setResult] = useState("Pick your throw.");
  const [taunt, setTaunt] = useState("");
  const [busy, setBusy] = useState(false);

  const play = async (hand: Hand): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setPlayerHand(hand);
    setModelHand(null);
    setResult("Opponent throwing…");
    setTaunt("");

    let mHand = randomHand();
    try {
      const reply = await ask(
        `Rock-paper-scissors. Choose your throw: rock, paper, or scissors. ` +
          `Reply with ONLY your choice word, then a short taunt.`,
        "Say one of rock/paper/scissors and add a one-line taunt."
      );
      const parsed = parseHand(reply);
      if (parsed) mHand = parsed;
      const t = reply
        .replace(/rock|paper|scissors/gi, "")
        .replace(/[^\p{L}\p{N}\s!?'.,-]/gu, "")
        .trim()
        .slice(0, 80);
      if (t) setTaunt(t);
    } catch {
      /* keep random throw, no taunt */
    }

    setModelHand(mHand);
    const outcome = resolve(hand, mHand);
    if (outcome === "win") { setWins((w) => w + 1); setResult("You win the round!"); }
    else if (outcome === "lose") { setLosses((l) => l + 1); setResult("You lose the round."); }
    else { setTies((t) => t + 1); setResult("A tie."); }
    setBusy(false);
  };

  return (
    <View style={st.fill}>
      <View style={[st.top, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <Pressable style={st.exit} onPress={onExit}>
          <Text style={st.exitT}>← Menu</Text>
        </Pressable>
        <Text style={st.title}>Rock Paper Scissors</Text>
      </View>
      <View style={st.body}>
        <Text style={st.score}>
          Won {wins}  ·  Lost {losses}  ·  Tied {ties}
        </Text>
        <View style={st.throws}>
          <View style={st.throwBox}>
            <Text style={st.throwLabel}>You</Text>
            <Text style={st.throwEmoji}>{playerHand ? EMOJI[playerHand] : "❔"}</Text>
          </View>
          <Text style={st.vs}>vs</Text>
          <View style={st.throwBox}>
            <Text style={st.throwLabel}>Machine</Text>
            <Text style={st.throwEmoji}>{modelHand ? EMOJI[modelHand] : "❔"}</Text>
          </View>
        </View>
        <Text style={st.result}>{result}</Text>
        {taunt ? <Text style={st.quip}>“{taunt}”</Text> : null}
        <View style={st.pickRow}>
          {HANDS.map((h) => (
            <Pressable key={h} style={[st.pick, busy && st.pickOff]} disabled={busy} onPress={() => void play(h)}>
              <Text style={st.pickEmoji}>{EMOJI[h]}</Text>
              <Text style={st.pickLabel}>{h}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0b1021" },
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 12 },
  exit: { backgroundColor: "rgba(255,255,255,0.15)", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  exitT: { color: "#fff", fontWeight: "600" },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: 22 },
  score: { color: "#cdd6ff", fontSize: 16, fontWeight: "600" },
  throws: { flexDirection: "row", alignItems: "center", gap: 24 },
  throwBox: { alignItems: "center", gap: 8 },
  throwLabel: { color: "#9aa7e0", fontSize: 14, fontWeight: "600" },
  throwEmoji: { fontSize: 64 },
  vs: { color: "#9aa7e0", fontSize: 18, fontWeight: "700" },
  result: { color: "#fff", fontSize: 18, fontWeight: "700" },
  quip: { color: "#9aa7e0", fontStyle: "italic", fontSize: 15, paddingHorizontal: 24, textAlign: "center" },
  pickRow: { flexDirection: "row", gap: 16 },
  pick: { backgroundColor: "#1b2550", paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, alignItems: "center", gap: 6, minWidth: 92 },
  pickOff: { opacity: 0.5 },
  pickEmoji: { fontSize: 36 },
  pickLabel: { color: "#cdd6ff", fontSize: 13, fontWeight: "600", textTransform: "capitalize" },
});

export const rockPaperScissorsGame: GameModule = {
  id: "rock-paper-scissors",
  title: "Rock Paper Scissors",
  kind: "turn-based",
  Screen,
};
