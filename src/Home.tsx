import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, BackHandler, Image, ImageBackground, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import VoiceChat from "./VoiceChat";
import { ask } from "./model";
import { GAMES } from "./games";
import type { GameModule } from "./games/contract";
import { color, space, radius, type as T, HIT, consoleUI, glow, motion, ease, accentFor } from "./design/tokens";
import { useSettings } from "./settings";
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
import Translate from "./screens/Translate";
import Calendar from "./screens/Calendar";
import Recipes from "./screens/Recipes";
import MealPlanner from "./screens/MealPlanner";
import Notifications from "./screens/Notifications";
import TravelRoutes from "./screens/TravelRoutes";

type Tab = "chat" | "games" | "tools" | "library" | "settings";
type FeatureScreen = "notes" | "memory" | "grocery" | "diet" | "fitness" | "experts" | "budget" | "habits"
  | "water" | "sleep" | "measure" | "timer" | "convert" | "calendar" | "recipes" | "meals" | "notifs" | "travel" | "translate";

// Shared CRT display treatment (tools/art/gen_crt.py) — subtle scanlines + edge vignette
// over the content "screen". The control deck below stays bare (it's the hardware).
const CRT_SCANLINES = require("../assets/crt/scanlines.png");
const CRT_VIGNETTE = require("../assets/crt/vignette.png");

// Nav-bar icons (tools/art/gen_nav_icons.py) — monochrome white line glyphs, tinted
// per state (amber active / faint inactive) to match the approved mockup.
const NAV_ICON = {
  chat: require("../assets/ui/nav/chat.png"),
  games: require("../assets/ui/nav/games.png"),
  tools: require("../assets/ui/nav/tools.png"),
  library: require("../assets/ui/nav/library.png"),
  settings: require("../assets/ui/nav/settings.png"),
  radio: require("../assets/ui/nav/radio.png"),
  dictaphone: require("../assets/ui/nav/dictaphone.png"),
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
  "draughts": "Line up a mill of three to take a piece — Malom (Nine Men's Morris).",
  "fleet-hunt": "Hunt the hidden fleet one grid square at a time.",
  "word-gallows": "Guess the word one letter at a time.",
};

// Original per-game icons (tools/art/gen_game_icons.py) — the game's own motif,
// not the monogram. Replaces the 2-letter tile.
const ICON: Record<string, ReturnType<typeof require>> = {
  "catch": require("../assets/arcade/catch/ship.png"),  // real in-game ship, not the old cabinet glyph
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
  "draughts": "Mill three. Take one.",
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
  const settings = useSettings();
  const acc = accentFor(settings.voice).c;

  // Shared destination-change motion (Stage 4): a subtle fade + small rise on every tab
  // switch. Reduced motion skips straight to the resting state. Native-driven.
  const navAnim = useRef(new Animated.Value(1)).current;
  // Collapsible bottom nav: a handle slides the deck down to free the screen.
  const HANDLE_H = 28;
  const [navHidden, setNavHidden] = useState(false);
  const deckHRef = useRef(0);
  const navH = useRef(new Animated.Value(0)).current;
  const [navMeasured, setNavMeasured] = useState(false);
  const onDeckLayout = (e: { nativeEvent: { layout: { height: number } } }) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - deckHRef.current) > 1) {
      deckHRef.current = h;
      if (!navHidden) navH.setValue(h);
      setNavMeasured(true);
    }
  };
  const toggleNav = () => {
    const full = deckHRef.current || 160;
    Animated.timing(navH, { toValue: navHidden ? full : HANDLE_H, duration: 240, easing: ease.out, useNativeDriver: false }).start();
    setNavHidden((v) => !v);
  };
  // Immersive Arcade motion (Stage 5): content expands (scale + fade) and the control deck
  // recedes when the Arcade tab is active; contracts on leaving. 0 = contracted, 1 = full.
  const arcadeAnim = useRef(new Animated.Value(tab === "games" ? 1 : 0)).current;

  useEffect(() => {
    if (settings.reducedMotion) { navAnim.setValue(1); return; }
    navAnim.setValue(0);
    const a = Animated.timing(navAnim, { toValue: 1, duration: motion.nav, easing: ease.out, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [tab, settings.reducedMotion, navAnim]);

  useEffect(() => {
    const entering = tab === "games";
    if (settings.reducedMotion) { arcadeAnim.setValue(entering ? 1 : 0); return; }
    const a = Animated.timing(arcadeAnim, {
      toValue: entering ? 1 : 0,
      duration: entering ? motion.immersive : motion.back,
      easing: entering ? ease.out : ease.in,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [tab, settings.reducedMotion, arcadeAnim]);

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
  if (screen === "translate") {
    return <Translate onBack={() => setScreen(null)} />;
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
  if (screen === "travel") {
    return <TravelRoutes onBack={() => setScreen(null)} />;
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
        <Animated.View style={[s.fill, {
          opacity: navAnim,
          transform: [{ translateY: navAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
        }]}>
        {tab === "chat" && (
          <View style={{ flex: 1, marginTop: -Math.max(insets.top, 24) }}>
          <VoiceChat
            seed={seed?.text} seedNonce={seed?.n}
            onOpenGames={() => setTab("games")}
            onOpenTools={() => setTab("tools")}
            onOpenNotes={() => setScreen("notes")}
            onOpenTool={(r) => setScreen(r)}
          />
          </View>
        )}

        {tab === "games" && (
          <Animated.View style={[s.fill, {
            opacity: arcadeAnim,
            transform: [{ scale: arcadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
          }]}>
          <ScrollView contentContainerStyle={s.libPad} showsVerticalScrollIndicator={false}>
            <View style={s.marquee}>
              <PixelText size="title" style={[s.marqueeT, { color: acc }]}>{L("ARCADE")}</PixelText>
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
          </Animated.View>
        )}

        {tab === "tools" && (
          <Tools
            onPick={(text) => { setSeed({ text, n: Date.now() }); setTab("chat"); }}
            onOpen={(s) => setScreen(s)}
          />
        )}

        {/* Library — the Dictaphone/Notes archive, now a top-level console destination. */}
        {tab === "library" && <Notes onBack={() => setTab("chat")} />}

        {tab === "settings" && <Settings onAbout={() => setShowAbout(true)} onModelSetup={onModelSetup} />}
        </Animated.View>

        {/* CRT display overlay (decorative; never intercepts touch) */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <ImageBackground source={CRT_SCANLINES} resizeMode="repeat"
            style={StyleSheet.absoluteFill} imageStyle={{ opacity: 0.6 }} />
          <Image source={CRT_VIGNETTE} resizeMode="stretch" style={StyleSheet.absoluteFill} />
        </View>
      </View>

      <Text style={s.ver}>{appMeta.name} · {appMeta.build}</Text>

      {/* Collapsible console deck — the handle slides the nav down to free the screen. */}
      <Animated.View style={[{ overflow: "hidden" }, navMeasured ? { height: navH } : null]}>
        <View onLayout={onDeckLayout}>
          <Pressable onPress={toggleNav} style={s.navHandle} accessibilityRole="button" accessibilityLabel={navHidden ? "Show menu" : "Hide menu"}>
            <View style={s.navHandleBar} />
          </Pressable>
          <Animated.View style={[s.deck, { paddingBottom: Math.max(insets.bottom, 16) }, {
            opacity: arcadeAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }),
            transform: [{ translateY: arcadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) }],
          }]}>
            <View style={s.deckRail} pointerEvents="none" />
        <NavKey icon={NAV_ICON.chat} label="Buddy" active={tab === "chat"} onPress={() => setTab("chat")} />
        <NavKey icon={NAV_ICON.games} label="Arcade" active={tab === "games"} onPress={() => setTab("games")} />
        <NavKey icon={NAV_ICON.tools} label="Tools" active={tab === "tools"} onPress={() => setTab("tools")} />
        <NavKey icon={NAV_ICON.library} label="Library" active={tab === "library"} onPress={() => setTab("library")} />
        <NavKey icon={NAV_ICON.settings} label="Settings" active={tab === "settings"} onPress={() => setTab("settings")} />
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

function NavKey({ icon, glyph, label, active, onPress, soon }: {
  icon?: ReturnType<typeof require>; glyph?: string; label: string; active: boolean; onPress: () => void; soon?: boolean;
}) {
  // Monochrome icon, tinted by the active persona when selected.
  const acc = accentFor(useSettings().voice).c;
  const tint = active ? acc : soon ? "#3A4650" : color.textFaint;
  return (
    <Pressable
      onPress={soon ? undefined : onPress}
      disabled={soon}
      accessibilityRole="tab"
      accessibilityState={{ selected: active, disabled: soon }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        s.key,
        active && s.keyOn,
        active && { borderColor: acc, backgroundColor: acc + "22" },
        pressed && !soon && s.keyPressed,
      ]}
    >
      <View style={[s.led, active && s.ledOn, active && { backgroundColor: acc, shadowColor: acc }]} />
      {icon ? (
        <Image source={icon} style={[s.navImg, { tintColor: tint }]} resizeMode="contain" />
      ) : (
        <Text style={[s.navGlyph, active ? s.navGlyphOn : { opacity: 0.5 }, active && { color: acc }]}>{glyph}</Text>
      )}
      <Text style={[s.keyLabel, active && s.keyLabelOn, active && { color: acc }, soon && s.keyLabelSoon]}>{soon ? L("SOON") : L(label)}</Text>
    </Pressable>
  );
}

function SectionHeader({ label, count, tone }: { label: string; count: number; tone: "amber" | "cyan" }) {
  const c = accentFor(useSettings().voice).c; void tone;
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
  const c = accentFor(useSettings().voice).c;
  const tileBg = "#0A0E13"; // dark glyph well (mockup .cab .glyph), not a coloured glow
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Play ${game.title}`}
      style={({ pressed }) => [s.card, pressed && s.cardPressed, pressed && { borderColor: c }]}
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
      <Text style={s.cardTitle} numberOfLines={1}>{game.title}</Text>
      <Text style={s.cardDesc} numberOfLines={1}>{TAGLINE[game.id] ?? BLURB[game.id] ?? ""}</Text>
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

  // Mockup cabinet grid: two columns of vertical cabinets (glyph tile on top).
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: space.md },
  card: {
    width: "48%",
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.surfaceLine,
    padding: space.sm,
  },
  cardPressed: { backgroundColor: color.surface2, borderColor: color.amber, transform: [{ scale: 0.99 }] },
  tile: {
    width: "100%",
    height: 64,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: space.sm,
  },
  tileGloss: { position: "absolute", left: 0, right: 0, top: 0, height: "46%", backgroundColor: "rgba(255,255,255,0.07)" },
  tileLed: { position: "absolute", right: 5, bottom: 5, width: 5, height: 5, borderRadius: 3, opacity: 0.9 },
  tileMono: { fontSize: 15, letterSpacing: 1 },
  cardTitle: { ...T.h2, fontSize: 14 },
  cardDesc: { ...T.small, fontSize: 9.5, color: color.textFaint, marginTop: 2 },

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
    paddingHorizontal: space.sm,
    gap: 3,
  },
  deckRail: { position: "absolute", left: 0, right: 0, top: 1, height: 1, backgroundColor: consoleUI.deckHi, opacity: 0.6 },
  navHandle: { height: 28, alignItems: "center", justifyContent: "center", backgroundColor: consoleUI.deckBg, borderTopWidth: 1, borderColor: consoleUI.deckRail },
  navHandleBar: { width: 46, height: 4, borderRadius: 2, backgroundColor: consoleUI.deckHi, opacity: 0.8 },
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
  keyOn: { borderColor: color.amber, backgroundColor: color.amberGlowBg, boxShadow: glow.amberSoft },
  led: { width: 6, height: 6, borderRadius: 3, backgroundColor: consoleUI.ledOff },
  ledOn: { backgroundColor: color.amber, shadowColor: color.amber, shadowOpacity: 0.9, shadowRadius: 5, elevation: 3 },
  keyIcon: { fontSize: 18, color: color.textMuted, lineHeight: 22 },
  keyIconOn: { color: color.amber },
  navImg: { width: 22, height: 22 },
  navGlyph: { fontSize: 22, lineHeight: 26, color: color.textMuted, textAlign: "center" },
  navGlyphOn: { color: color.amber },
  keyLabel: { ...T.small, color: color.textMuted, fontSize: 9, letterSpacing: 0.2 },
  keyLabelOn: { color: color.amber },
  keyLabelSoon: { color: "#3A4650", fontSize: 7.5, letterSpacing: 0.6 },
});
