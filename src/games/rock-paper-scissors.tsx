import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GameModule, GameContext } from "./contract";
import { color, space, radius, type as T } from "../design/tokens";
import { PixelText, Body, IconButton, Sprite } from "../design/ui";

type Hand = "rock" | "paper" | "scissors";
const HANDS: readonly Hand[] = ["rock", "paper", "scissors"];
const HAND_IMG: Record<Hand, ReturnType<typeof require>> = {
  rock: require("../../assets/arcade/rps/rock.png"),
  paper: require("../../assets/arcade/rps/paper.png"),
  scissors: require("../../assets/arcade/rps/scissors.png"),
};
const BEATS: Record<Hand, Hand> = { rock: "scissors", paper: "rock", scissors: "paper" };

const randomHand = (): Hand => HANDS[Math.floor(Math.random() * HANDS.length)]!;

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

function DuelCard({ label, accent, hand, pending }: { label: string; accent: string; hand: Hand | null; pending: boolean }) {
  return (
    <View style={[st.duel, { borderColor: accent }]}>
      <PixelText size="label" style={{ color: accent }}>{label}</PixelText>
      <View style={st.well}>
        {hand ? <Sprite source={HAND_IMG[hand]} size={84} /> : <Text style={[st.qmark, pending && { color: accent }]}>?</Text>}
      </View>
    </View>
  );
}

function Screen({ ask, onExit }: GameContext) {
  const insets = useSafeAreaInsets();
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [ties, setTies] = useState(0);
  const [playerHand, setPlayerHand] = useState<Hand | null>(null);
  const [modelHand, setModelHand] = useState<Hand | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [result, setResult] = useState("Pick your throw");
  const [taunt, setTaunt] = useState("");
  const [busy, setBusy] = useState(false);

  const play = async (hand: Hand): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setPlayerHand(hand);
    setModelHand(null);
    setOutcome(null);
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
      const t = reply.replace(/rock|paper|scissors/gi, "").replace(/[^\p{L}\p{N}\s!?'.,-]/gu, "").trim().slice(0, 80);
      if (t) setTaunt(t);
    } catch { /* keep random throw */ }

    setModelHand(mHand);
    const o = resolve(hand, mHand);
    setOutcome(o);
    if (o === "win") { setWins((w) => w + 1); setResult("You win the round!"); }
    else if (o === "lose") { setLosses((l) => l + 1); setResult("You lose the round."); }
    else { setTies((t) => t + 1); setResult("A tie."); }
    setBusy(false);
  };

  const resultColor = outcome === "win" ? color.success : outcome === "lose" ? color.danger : color.text;

  return (
    <View style={st.fill}>
      <View style={[st.top, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <PixelText size="h2" style={{ color: color.amber }}>HANDS</PixelText>
        <IconButton label="Exit to menu" glyph="✕" onPress={onExit} />
      </View>

      <View style={st.body}>
        {/* scoreboard */}
        <View style={st.scoreRow}>
          <Score label="WON" value={wins} tint={color.success} />
          <Score label="LOST" value={losses} tint={color.danger} />
          <Score label="TIED" value={ties} tint={color.textMuted} />
        </View>

        {/* duel */}
        <View style={st.arena}>
          <DuelCard label="YOU" accent={color.amber} hand={playerHand} pending={false} />
          <View style={st.vsWrap}><PixelText size="label" style={st.vs}>VS</PixelText></View>
          <DuelCard label="MACHINE" accent={color.cyan} hand={modelHand} pending={busy} />
        </View>

        <PixelText size="label" style={[st.result, { color: resultColor }]}>{result}</PixelText>
        {taunt ? <Body muted style={st.quip}>“{taunt}”</Body> : <View style={{ height: 22 }} />}

        {/* pick buttons */}
        <View style={st.pickRow}>
          {HANDS.map((h) => (
            <Pressable
              key={h}
              style={({ pressed }) => [st.pick, busy && st.pickOff, pressed && !busy && st.pickPressed]}
              disabled={busy}
              onPress={() => void play(h)}
              accessibilityRole="button"
              accessibilityLabel={`Throw ${h}`}
            >
              <Sprite source={HAND_IMG[h]} size={50} />
              <Body style={st.pickLabel}>{h}</Body>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function Score({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <View style={st.scoreBox}>
      <PixelText size="score" style={{ color: tint }}>{String(value)}</PixelText>
      <PixelText size="label" style={{ color: color.textFaint, marginTop: 2 }}>{label}</PixelText>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingBottom: space.sm },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.lg, paddingHorizontal: space.lg },
  scoreRow: { flexDirection: "row", gap: space.xl },
  scoreBox: { alignItems: "center" },

  arena: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.md },
  duel: {
    width: 128, height: 150, borderRadius: radius.lg, borderWidth: 2,
    backgroundColor: color.surface, alignItems: "center", paddingTop: space.md, gap: space.sm,
  },
  well: { flex: 1, alignItems: "center", justifyContent: "center" },
  qmark: { fontSize: 56, fontWeight: "900", color: color.textFaint },
  vsWrap: { width: 40, alignItems: "center" },
  vs: { color: color.textMuted },

  result: { textAlign: "center", marginTop: space.sm },
  quip: { fontStyle: "italic", textAlign: "center", paddingHorizontal: space.lg, minHeight: 22 },

  pickRow: { flexDirection: "row", gap: space.md },
  pick: {
    backgroundColor: color.surface2, borderRadius: radius.lg, borderWidth: 1.5, borderColor: color.surfaceLine,
    paddingVertical: space.md, paddingHorizontal: space.md, alignItems: "center", gap: 6, minWidth: 96,
  },
  pickOff: { opacity: 0.45 },
  pickPressed: { backgroundColor: color.surfaceLine, borderColor: color.amber, transform: [{ scale: 0.97 }] },
  pickLabel: { ...T.small, color: color.text, textTransform: "capitalize", fontWeight: "700" },
});

export const rockPaperScissorsGame: GameModule = {
  id: "rock-paper-scissors",
  title: "Rock Paper Scissors",
  kind: "turn-based",
  Screen,
};
