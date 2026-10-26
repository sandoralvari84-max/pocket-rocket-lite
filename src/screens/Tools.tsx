import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Image, ImageSourcePropType } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, space, radius, type as T } from "../design/tokens";
import { PixelText, Body, ScreenHeader } from "../design/ui";

const TOOLS_ICON = require("../../assets/ui/nav/tools.png");

// Monochrome line icons (tools/art/gen_tool_icons.py), tinted by section accent.
const TOOL_ICON: Partial<Record<FeatureRoute, ImageSourcePropType>> = {
  notes: require("../../assets/ui/tools/notes.png"),
  memory: require("../../assets/ui/tools/memory.png"),
  experts: require("../../assets/ui/tools/experts.png"),
  notifs: require("../../assets/ui/tools/notifs.png"),
  diet: require("../../assets/ui/tools/diet.png"),
  fitness: require("../../assets/ui/tools/fitness.png"),
  water: require("../../assets/ui/tools/water.png"),
  sleep: require("../../assets/ui/tools/sleep.png"),
  measure: require("../../assets/ui/tools/measure.png"),
  budget: require("../../assets/ui/tools/budget.png"),
  grocery: require("../../assets/ui/tools/grocery.png"),
  meals: require("../../assets/ui/tools/meals.png"),
  recipes: require("../../assets/ui/tools/recipes.png"),
  calendar: require("../../assets/ui/tools/calendar.png"),
  habits: require("../../assets/ui/tools/habits.png"),
  timer: require("../../assets/ui/tools/timer.png"),
  convert: require("../../assets/ui/tools/convert.png"),
  travel: require("../../assets/ui/tools/travel.png"),
  translate: require("../../assets/ui/tools/translate.png"),
};
import { L, useLang } from "../i18n";

export type FeatureRoute = "notes" | "memory" | "grocery" | "diet" | "fitness" | "experts" | "budget" | "habits"
  | "water" | "sleep" | "measure" | "timer" | "convert" | "calendar" | "recipes" | "meals" | "notifs" | "travel" | "translate";

type Feat = { route: FeatureRoute; glyph: string; title: string };
type Section = { label: string; accent: "amber" | "cyan"; items: Feat[] };

// Features grouped so a 16-tool screen reads as a tidy launcher, not a flat wall.
const SECTIONS: Section[] = [
  { label: "Assistant", accent: "cyan", items: [
    { route: "notes", glyph: "🎙", title: "Dictaphone & Notes" },
    { route: "memory", glyph: "🧠", title: "Memory" },
    { route: "experts", glyph: "📚", title: "Experts" },
    { route: "notifs", glyph: "🔔", title: "Reader" },
    { route: "translate", glyph: "🌐", title: "Translate" },
  ] },
  { label: "Health & body", accent: "amber", items: [
    { route: "diet", glyph: "🥗", title: "Diet" },
    { route: "fitness", glyph: "🏋", title: "Fitness" },
    { route: "water", glyph: "💧", title: "Water" },
    { route: "sleep", glyph: "😴", title: "Sleep" },
    { route: "measure", glyph: "📏", title: "Measurements" },
  ] },
  { label: "Money & home", accent: "cyan", items: [
    { route: "budget", glyph: "💶", title: "Budget" },
    { route: "grocery", glyph: "🛒", title: "Grocery" },
    { route: "meals", glyph: "🍽", title: "Meal planner" },
    { route: "recipes", glyph: "👩‍🍳", title: "Recipes" },
    { route: "calendar", glyph: "📅", title: "Calendar" },
  ] },
  { label: "Utilities", accent: "amber", items: [
    { route: "habits", glyph: "🔥", title: "Habits" },
    { route: "timer", glyph: "⏱", title: "Timer" },
    { route: "convert", glyph: "🔁", title: "Converter" },
    { route: "travel", glyph: "🧭", title: "Travel" },
  ] },
];

// "Quick chat" tiles seed the composer (a head-start into the on-device model).
const CHAT: { glyph: string; title: string; seed: string }[] = [
  { glyph: "▤", title: "Paste & Ask", seed: "Here's some text I'd like help with:\n\n" },
  { glyph: "✓", title: "Fact-check", seed: "Help me reason through whether this claim holds up: " },
  { glyph: "≡", title: "Summarise", seed: "Summarise this clearly:\n\n" },
  { glyph: "☼", title: "Explain simply", seed: "Explain this simply, like I'm five: " },
  { glyph: "✎", title: "Rephrase / draft", seed: "Rephrase this more clearly: " },
  { glyph: "✦", title: "Brainstorm", seed: "Give me a few ideas for: " },
];

function SectionHeader({ label, accent }: { label: string; accent: string }) {
  return (
    <View style={st.secRow}>
      <View style={[st.secTick, { backgroundColor: accent }]} />
      <PixelText size="label" style={{ color: accent, letterSpacing: 1 }}>{L(label)}</PixelText>
      <View style={st.secRule} />
    </View>
  );
}

function Tile({ glyph, icon, title, accent, bg, onPress }: { glyph?: string; icon?: ImageSourcePropType; title: string; accent: string; bg: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}
      style={({ pressed }) => [st.tile, pressed && { borderColor: accent, backgroundColor: color.surface2 }]}>
      <View style={[st.iconBox, { borderColor: accent }]}>
        {icon ? (
          <Image source={icon} style={[st.iconImg, { tintColor: accent }]} resizeMode="contain" />
        ) : (
          <Text style={[st.glyph, { color: accent }]}>{glyph}</Text>
        )}
        <View style={[st.tileLed, { backgroundColor: accent }]} pointerEvents="none" />
      </View>
      <Text style={st.title} numberOfLines={1}>{L(title)}</Text>
    </Pressable>
  );
}

export default function Tools({ onPick, onOpen }: { onPick: (seed: string) => void; onOpen: (screen: FeatureRoute) => void }) {
  const insets = useSafeAreaInsets();
  useLang();
  return (
    <ScrollView contentContainerStyle={[st.pad, { paddingTop: Math.max(insets.top, 24) + 8 }]} showsVerticalScrollIndicator={false}>
      <ScreenHeader icon={TOOLS_ICON} title={L("Tools")} subtitle={L("on-device toolkit · offline")} />

      {SECTIONS.map((sec) => {
        const accent = sec.accent === "amber" ? color.amber : color.cyan;
        const bg = sec.accent === "amber" ? color.amberGlowBg : color.cyanGlowBg;
        return (
          <View key={sec.label} style={st.section}>
            <SectionHeader label={sec.label} accent={accent} />
            <View style={st.grid}>
              {sec.items.map((f) => (
                <Tile key={f.route} icon={TOOL_ICON[f.route]} glyph={f.glyph} title={f.title} accent={accent} bg={bg} onPress={() => onOpen(f.route)} />
              ))}
            </View>
          </View>
        );
      })}

      <View style={st.section}>
        <SectionHeader label="Quick chat" accent={color.amber} />
        <View style={st.grid}>
          {CHAT.map((c) => (
            <Tile key={c.title} glyph={c.glyph} title={c.title} accent={color.amber} bg={color.amberGlowBg} onPress={() => onPick(c.seed)} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  pad: { padding: space.lg, paddingBottom: space.xxl },
  head: { marginBottom: space.md },
  section: { marginTop: space.lg },
  secRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.sm },
  secTick: { width: 14, height: 4, borderRadius: 2 },
  secRule: { flex: 1, height: 1, backgroundColor: color.surfaceLine },
  // Cabinet grid — same style as the Arcade games (dark glyph well on top, title below).
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: space.md },
  tile: {
    width: "48%",
    backgroundColor: color.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: color.surfaceLine, padding: space.sm,
  },
  iconBox: { width: "100%", height: 64, borderRadius: radius.md, borderWidth: 2, alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: space.sm, backgroundColor: "#0A0E13" },
  iconImg: { width: 34, height: 34 },
  glyph: { fontSize: 28, fontWeight: "900" },
  tileLed: { position: "absolute", right: 6, bottom: 6, width: 5, height: 5, borderRadius: 3, opacity: 0.9 },
  title: { ...T.h2, fontSize: 14 },
});
