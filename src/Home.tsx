import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, BackHandler } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VoiceChat from "./VoiceChat";
import { ask } from "./model";
import { GAMES } from "./games";
import type { GameModule } from "./games/contract";
import { color, space, radius, type as T, HIT } from "./design/tokens";
import { PixelText, Chip } from "./design/ui";
import Settings from "./screens/Settings";
import About from "./screens/About";

type Tab = "chat" | "games" | "settings";

// Honest one-line descriptions, keyed by frozen game id.
const BLURB: Record<string, string> = {
  "catch": "Catch the falling dots before they hit the floor.",
  "maze-muncher": "Clear the maze of pellets while the chasers close in.",
  "nibbler": "Grow your tail and try not to bite yourself.",
  "road-hopper": "Cross the busy lanes without getting clipped.",
  "block-drop": "Stack the falling blocks and clear full rows.",
  "flipper-frenzy": "Keep the ball in play and run up the score.",
  "putt-pal": "Sink the putt in as few strokes as you can.",
  "three-in-a-row": "Line up three against the on-device model.",
  "rock-paper-scissors": "Best the model in a quick battle of hands.",
  "four-up": "Drop discs and connect four in a row.",
  "draughts": "Jump and capture across the checkerboard.",
  "fleet-hunt": "Hunt the hidden fleet one grid square at a time.",
  "word-gallows": "Guess the word one letter at a time.",
  "twenty-questions": "Think of something; the model guesses in twenty.",
  "trivia-time": "Answer the questions the model puts to you.",
  "word-hunt": "Crack the hidden word from a clue, with hot/cold hints.",
  "riddle-me": "Solve the riddles the model poses.",
};

// Short monogram for the cabinet tile (pixel font, tinted by category).
function monogram(title: string): string {
  const w = title.split(/\s+/).filter(Boolean);
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[1][0]).toUpperCase();
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("chat");
  const [game, setGame] = useState<GameModule | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const insets = useSafeAreaInsets();

  // Android hardware back: game -> library, About -> Settings, tab root -> default.
  useEffect(() => {
    const onBack = () => {
      if (game) { setGame(null); return true; }
      if (showAbout) { setShowAbout(false); return true; }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [game, showAbout]);

  // A launched game owns the whole screen; preserve the frozen { ask, onExit } wiring.
  if (game) {
    const GameScreen = game.Screen;
    return <GameScreen ask={ask} onExit={() => setGame(null)} />;
  }

  // About lives off the main screens — reached from Settings, dismissed back to it.
  if (showAbout) {
    return <About onBack={() => setShowAbout(false)} />;
  }

  const arcade = GAMES.filter((g) => g.kind === "arcade");
  const turn = GAMES.filter((g) => g.kind === "turn-based");

  return (
    <View style={s.fill}>
      <View style={[s.body, { paddingTop: Math.max(insets.top, 24) }]}>
        {tab === "chat" && <VoiceChat />}

        {tab === "games" && (
          <ScrollView contentContainerStyle={s.libPad} showsVerticalScrollIndicator={false}>
            <View style={s.marquee}>
              <PixelText size="title" style={s.marqueeT}>ARCADE</PixelText>
              <Text style={s.marqueeSub}>Select a cabinet</Text>
            </View>

            <SectionHeader label="ARCADE" count={arcade.length} tone="amber" />
            <View style={s.grid}>
              {arcade.map((g) => (
                <GameCard key={g.id} game={g} onPress={() => setGame(g)} />
              ))}
            </View>

            <SectionHeader label="TURN-BASED" count={turn.length} tone="cyan" />
            <View style={s.grid}>
              {turn.map((g) => (
                <GameCard key={g.id} game={g} onPress={() => setGame(g)} />
              ))}
            </View>
          </ScrollView>
        )}

        {tab === "settings" && <Settings onAbout={() => setShowAbout(true)} />}
      </View>

      {/* Console deck: chunky physical keys, restrained amber glow on the active one. */}
      <View style={[s.deck, { paddingBottom: Math.max(insets.bottom, 56) }]}>
        <NavKey icon="▭" label="Chat" active={tab === "chat"} onPress={() => setTab("chat")} />
        <NavKey icon="◉" label="Games" active={tab === "games"} onPress={() => setTab("games")} />
        <NavKey icon="▦" label="Settings" active={tab === "settings"} onPress={() => setTab("settings")} />
      </View>
    </View>
  );
}

function NavKey({ icon, label, active, onPress }: {
  icon: string; label: string; active: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        s.key,
        active && s.keyOn,
        pressed && !active && s.keyPressed,
      ]}
    >
      <Text style={[s.keyIcon, active && s.keyIconOn]}>{icon}</Text>
      <Text style={[s.keyLabel, active && s.keyLabelOn]}>{label}</Text>
    </Pressable>
  );
}

function SectionHeader({ label, count, tone }: { label: string; count: number; tone: "amber" | "cyan" }) {
  const c = tone === "amber" ? color.amber : color.cyan;
  return (
    <View style={s.sectionRow}>
      <View style={[s.sectionTick, { backgroundColor: c }]} />
      <PixelText size="label" style={{ letterSpacing: 1, color: c }}>{label}</PixelText>
      <View style={[s.sectionRule, { borderColor: color.surfaceLine }]} />
      <Text style={s.sectionCount}>{count}</Text>
    </View>
  );
}

function GameCard({ game, onPress }: { game: GameModule; onPress: () => void }) {
  const arcade = game.kind === "arcade";
  const c = arcade ? color.amber : color.cyan;
  const tileBg = arcade ? color.amberGlowBg : color.cyanGlowBg;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Play ${game.title}`}
      style={({ pressed }) => [s.card, pressed && s.cardPressed]}
    >
      {/* Cabinet marquee tile */}
      <View style={[s.tile, { backgroundColor: tileBg, borderColor: c }]}>
        <PixelText style={{ fontSize: 15, letterSpacing: 1, color: c }}>{monogram(game.title)}</PixelText>
      </View>
      <View style={s.cardBody}>
        <View style={s.cardTop}>
          <Text style={s.cardTitle} numberOfLines={1}>{game.title}</Text>
          <Chip label={arcade ? "Arcade" : "Turn-based"} tone={arcade ? "amber" : "cyan"} />
        </View>
        <Text style={s.cardDesc} numberOfLines={2}>{BLURB[game.id] ?? ""}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  body: { flex: 1 },

  // Games library
  libPad: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  marquee: {
    borderWidth: 2,
    borderColor: color.surfaceLine,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    alignItems: "center",
    marginBottom: space.sm,
  },
  marqueeT: { color: color.amber, letterSpacing: 2 },
  marqueeSub: { ...T.small, color: color.textMuted, marginTop: space.xs, letterSpacing: 1 },

  sectionRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm },
  sectionTick: { width: 4, height: 14, borderRadius: 1 },
  sectionLabel: { letterSpacing: 1 },
  sectionRule: { flex: 1, borderBottomWidth: 1, marginHorizontal: space.xs, opacity: 0.8 },
  sectionCount: { ...T.small, color: color.textFaint },

  grid: { gap: space.md },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.surfaceLine,
    padding: space.md,
  },
  cardPressed: { backgroundColor: color.surface2, borderColor: color.amber, transform: [{ scale: 0.99 }] },
  tile: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  tileMono: { fontSize: 15, letterSpacing: 1 },
  cardBody: { flex: 1, gap: 6 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  cardTitle: { ...T.h2, flexShrink: 1 },
  cardDesc: { ...T.bodyMuted },

  // Version tag
  ver: {
    textAlign: "center",
    ...T.small,
    color: color.textFaint,
    paddingVertical: 3,
    backgroundColor: color.bg,
  },

  // Console deck (bottom navigation)
  deck: {
    flexDirection: "row",
    backgroundColor: color.surface,
    borderTopWidth: 2,
    borderColor: color.surfaceLine,
    paddingTop: space.sm,
    paddingHorizontal: space.sm,
    gap: space.sm,
  },
  key: {
    flex: 1,
    minHeight: HIT,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.surfaceLine,
    backgroundColor: color.surface2,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space.sm,
    gap: 2,
  },
  keyPressed: { backgroundColor: color.surfaceLine },
  keyOn: { borderColor: color.amber, backgroundColor: color.amberGlowBg },
  keyIcon: { fontSize: 18, color: color.textMuted, lineHeight: 22 },
  keyIconOn: { color: color.amber },
  keyLabel: { ...T.small, color: color.textMuted },
  keyLabelOn: { color: color.amber, fontWeight: "700" },
});
