import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, BackHandler, Image, ImageBackground } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VoiceChat from "./VoiceChat";
import { ask } from "./model";
import { GAMES } from "./games";
import type { GameModule } from "./games/contract";
import { color, space, radius, type as T, HIT, consoleUI } from "./design/tokens";
import { PixelText, Chip, GameErrorBoundary, Sprite } from "./design/ui";
import { appMeta } from "./appMeta";
import { L, useLang } from "./i18n";
import Settings from "./screens/Settings";
import About from "./screens/About";
import Tools from "./screens/Tools";
import Notes from "./screens/Notes";
import Memory from "./screens/Memory";
import Grocery from "./screens/Grocery";
import Diet from "./screens/Diet";
import Fitness from "./screens/Fitness";
import Experts from "./screens/Experts";
import Budget from "./screens/Budget";
import Habits from "./screens/Habits";
import Water from "./screens/Water";
import Sleep from "./screens/Sleep";
import Measurements from "./screens/Measurements";
import Timers from "./screens/Timers";
import Converter from "./screens/Converter";
import Calendar from "./screens/Calendar";
import Recipes from "./screens/Recipes";
import MealPlanner from "./screens/MealPlanner";
import Notifications from "./screens/Notifications";

type Tab = "chat" | "games" | "tools" | "settings";
type FeatureScreen = "notes" | "memory" | "grocery" | "diet" | "fitness" | "experts" | "budget" | "habits"
  | "water" | "sleep" | "measure" | "timer" | "convert" | "calendar" | "recipes" | "meals" | "notifs";

// Shared CRT display treatment (tools/art/gen_crt.py) — subtle scanlines + edge vignette
// over the content "screen". The control deck below stays bare (it's the hardware).
const CRT_SCANLINES = require("../assets/crt/scanlines.png");
const CRT_VIGNETTE = require("../assets/crt/vignette.png");

// Nav-bar icons (tools/art/gen_nav_icons.py) — same filled-gloss grammar as the
// game icons, replacing the old Unicode glyph placeholders.
const NAV_ICON = {
  chat: require("../assets/ui/nav/chat.png"),
  games: require("../assets/ui/nav/games.png"),
  tools: require("../assets/ui/nav/tools.png"),
  settings: require("../assets/ui/nav/settings.png"),
};

// Honest one-line descriptions, keyed by frozen game id.
const BLURB: Record<string, string> = {
  "catch": "Fly the lower half, auto-fire, blast the enemy craft — grab orbs to power up.",
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

// Original per-game icons (tools/art/gen_game_icons.py) — the game's own motif,
// not the monogram. Replaces the 2-letter tile.
const ICON: Record<string, ReturnType<typeof require>> = {
  "catch": require("../assets/arcade/icons/catch.png"),
  "maze-muncher": require("../assets/arcade/icons/maze-muncher.png"),
  "nibbler": require("../assets/arcade/icons/nibbler.png"),
  "road-hopper": require("../assets/arcade/icons/road-hopper.png"),
  "block-drop": require("../assets/arcade/icons/block-drop.png"),
  "flipper-frenzy": require("../assets/arcade/icons/flipper-frenzy.png"),
  "putt-pal": require("../assets/arcade/icons/putt-pal.png"),
  "three-in-a-row": require("../assets/arcade/icons/three-in-a-row.png"),
  "rock-paper-scissors": require("../assets/arcade/icons/rock-paper-scissors.png"),
  "four-up": require("../assets/arcade/icons/four-up.png"),
  "draughts": require("../assets/arcade/icons/draughts.png"),
  "fleet-hunt": require("../assets/arcade/icons/fleet-hunt.png"),
  "word-gallows": require("../assets/arcade/icons/word-gallows.png"),
};

// Punchy one-line taglines (brand board). Shown on the cabinet card.
const TAGLINE: Record<string, string> = {
  "catch": "Space shooter — fly & fire.",
  "maze-muncher": "Eat. Explore. Survive.",
  "nibbler": "Grow. Avoid. Get bigger.",
  "road-hopper": "Cross. Dodge. Keep going.",
  "block-drop": "Fit. Clear. Score.",
  "flipper-frenzy": "Keep it in play.",
  "putt-pal": "Aim. Tap. Hole it.",
  "three-in-a-row": "Line up three.",
  "rock-paper-scissors": "Choose. Beat. Win.",
  "four-up": "Stack. Connect. Win.",
  "draughts": "Plan. Move. Capture.",
  "fleet-hunt": "Find. Hit. Sink.",
  "word-gallows": "Think. Guess. Save him.",
};

// Short monogram for the cabinet tile (pixel font, tinted by category).
function monogram(title: string): string {
  const w = title.split(/\s+/).filter(Boolean);
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[1][0]).toUpperCase();
}

export default function Home({ onModelSetup }: { onModelSetup: () => void }) {
  const [tab, setTab] = useState<Tab>("chat");
  const [game, setGame] = useState<GameModule | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [screen, setScreen] = useState<FeatureScreen | null>(null);
  const [seed, setSeed] = useState<{ text: string; n: number } | null>(null);
  const insets = useSafeAreaInsets();
  useLang(); // re-render on language change

  // Android hardware back: game -> library, feature screen/About -> back, tab root -> default.
  useEffect(() => {
    const onBack = () => {
      if (game) { setGame(null); return true; }
      if (screen) { setScreen(null); return true; }
      if (showAbout) { setShowAbout(false); return true; }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [game, screen, showAbout]);

  // A launched game owns the whole screen; preserve the frozen { ask, onExit } wiring.
  if (game) {
    const GameScreen = game.Screen;
    return (
      <GameErrorBoundary key={game.id} onExit={() => setGame(null)}>
        <GameScreen ask={ask} onExit={() => setGame(null)} />
      </GameErrorBoundary>
    );
  }

  // Feature screens (Dictaphone, …) own the whole screen, reached from Tools.
  if (screen === "notes") {
    return <Notes onBack={() => setScreen(null)} />;
  }
  if (screen === "memory") {
    return <Memory onBack={() => setScreen(null)} />;
  }
  if (screen === "grocery") {
    return <Grocery onBack={() => setScreen(null)} />;
  }
  if (screen === "diet") {
    return <Diet onBack={() => setScreen(null)} />;
  }
  if (screen === "fitness") {
    return <Fitness onBack={() => setScreen(null)} />;
  }
  if (screen === "experts") {
    return <Experts onBack={() => setScreen(null)} />;
  }
  if (screen === "budget") {
    return <Budget onBack={() => setScreen(null)} />;
  }
  if (screen === "habits") {
    return <Habits onBack={() => setScreen(null)} />;
  }
  if (screen === "water") {
    return <Water onBack={() => setScreen(null)} />;
  }
  if (screen === "sleep") {
    return <Sleep onBack={() => setScreen(null)} />;
  }
  if (screen === "measure") {
    return <Measurements onBack={() => setScreen(null)} />;
  }
  if (screen === "timer") {
    return <Timers onBack={() => setScreen(null)} />;
  }
  if (screen === "convert") {
    return <Converter onBack={() => setScreen(null)} />;
  }
  if (screen === "calendar") {
    return <Calendar onBack={() => setScreen(null)} />;
  }
  if (screen === "recipes") {
    return <Recipes onBack={() => setScreen(null)} />;
  }
  if (screen === "meals") {
    return <MealPlanner onBack={() => setScreen(null)} />;
  }
  if (screen === "notifs") {
    return <Notifications onBack={() => setScreen(null)} />;
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
        {tab === "chat" && (
          <VoiceChat
            seed={seed?.text} seedNonce={seed?.n}
            onOpenGames={() => setTab("games")}
            onOpenTools={() => setTab("tools")}
            onOpenNotes={() => setScreen("notes")}
          />
        )}

        {tab === "games" && (
          <ScrollView contentContainerStyle={s.libPad} showsVerticalScrollIndicator={false}>
            <View style={s.marquee}>
              <PixelText size="title" style={s.marqueeT}>{L("ARCADE")}</PixelText>
              <Text style={s.marqueeSub}>{L("Select a cabinet")}</Text>
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

        {tab === "tools" && (
          <Tools
            onPick={(text) => { setSeed({ text, n: Date.now() }); setTab("chat"); }}
            onOpen={(s) => setScreen(s)}
          />
        )}

        {tab === "settings" && <Settings onAbout={() => setShowAbout(true)} onModelSetup={onModelSetup} />}

        {/* CRT display overlay (decorative; never intercepts touch) */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <ImageBackground source={CRT_SCANLINES} resizeMode="repeat"
            style={StyleSheet.absoluteFill} imageStyle={{ opacity: 0.6 }} />
          <Image source={CRT_VIGNETTE} resizeMode="stretch" style={StyleSheet.absoluteFill} />
        </View>
      </View>

      <Text style={s.ver}>{appMeta.name} · {appMeta.build}</Text>

      {/* Console control deck: tactile illuminated hardware keys on a housing rail. */}
      <View style={[s.deck, { paddingBottom: Math.max(insets.bottom, 56) }]}>
        <View style={s.deckRail} pointerEvents="none" />
        <NavKey icon={NAV_ICON.chat} label="Chat" active={tab === "chat"} onPress={() => setTab("chat")} />
        <NavKey icon={NAV_ICON.games} label="Games" active={tab === "games"} onPress={() => setTab("games")} />
        <NavKey icon={NAV_ICON.tools} label="Tools" active={tab === "tools"} onPress={() => setTab("tools")} />
        <NavKey icon={NAV_ICON.settings} label="Settings" active={tab === "settings"} onPress={() => setTab("settings")} />
      </View>
    </View>
  );
}

function NavKey({ icon, label, active, onPress }: {
  icon: ReturnType<typeof require>; label: string; active: boolean; onPress: () => void;
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
        pressed && s.keyPressed,
      ]}
    >
      <View style={[s.led, active && s.ledOn]} />
      <Image source={icon} style={[s.navImg, !active && { opacity: 0.5 }]} resizeMode="contain" />
      <Text style={[s.keyLabel, active && s.keyLabelOn]}>{L(label)}</Text>
    </Pressable>
  );
}

function SectionHeader({ label, count, tone }: { label: string; count: number; tone: "amber" | "cyan" }) {
  const c = tone === "amber" ? color.amber : color.cyan;
  return (
    <View style={s.sectionRow}>
      <View style={[s.sectionTick, { backgroundColor: c }]} />
      <PixelText size="label" style={{ letterSpacing: 1, color: c }}>{L(label)}</PixelText>
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
      {/* Cabinet marquee tile — same monogram, richer treatment */}
      <View style={[s.tile, { backgroundColor: tileBg, borderColor: c }]}>
        <View style={s.tileGloss} pointerEvents="none" />
        {ICON[game.id] ? (
          <Sprite source={ICON[game.id]} size={42} />
        ) : (
          <PixelText style={{ fontSize: 15, letterSpacing: 1, color: c }}>{monogram(game.title)}</PixelText>
        )}
        <View style={[s.tileLed, { backgroundColor: c }]} pointerEvents="none" />
      </View>
      <View style={s.cardBody}>
        <View style={s.cardTop}>
          <Text style={s.cardTitle} numberOfLines={1}>{game.title}</Text>
          <Chip label={arcade ? "Arcade" : "Turn-based"} tone={arcade ? "amber" : "cyan"} />
        </View>
        <Text style={s.cardDesc} numberOfLines={1}>{TAGLINE[game.id] ?? BLURB[game.id] ?? ""}</Text>
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
    width: 58,
    height: 58,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tileGloss: { position: "absolute", left: 0, right: 0, top: 0, height: "46%", backgroundColor: "rgba(255,255,255,0.07)" },
  tileLed: { position: "absolute", right: 5, bottom: 5, width: 5, height: 5, borderRadius: 3, opacity: 0.9 },
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

  // Console control deck (bottom navigation) — a tactile illuminated hardware panel.
  deck: {
    flexDirection: "row",
    backgroundColor: consoleUI.deckBg,
    borderTopWidth: 1,
    borderColor: consoleUI.deckRail,
    paddingTop: space.md,
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  deckRail: { position: "absolute", left: 0, right: 0, top: 1, height: 1, backgroundColor: consoleUI.deckHi, opacity: 0.6 },
  key: {
    flex: 1,
    minHeight: HIT + 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: consoleUI.keyBorder,
    backgroundColor: consoleUI.keyBg,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space.sm,
    gap: 3,
  },
  keyPressed: { backgroundColor: consoleUI.keyPressed, transform: [{ translateY: 1 }] },
  keyOn: { borderColor: color.amber, backgroundColor: color.amberGlowBg },
  led: { width: 6, height: 6, borderRadius: 3, backgroundColor: consoleUI.ledOff },
  ledOn: { backgroundColor: color.amber, shadowColor: color.amber, shadowOpacity: 0.9, shadowRadius: 5, elevation: 3 },
  keyIcon: { fontSize: 18, color: color.textMuted, lineHeight: 22 },
  keyIconOn: { color: color.amber },
  navImg: { width: 26, height: 26 },
  keyLabel: { ...T.small, color: color.textMuted, fontSize: 11 },
  keyLabelOn: { color: color.amber, fontWeight: "700" },
});
