import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body } from "../design/ui";
import { L, useLang } from "../i18n";

export type FeatureRoute = "notes" | "memory" | "grocery" | "diet" | "fitness" | "experts" | "budget" | "habits"
  | "water" | "sleep" | "measure" | "timer" | "convert" | "calendar" | "recipes" | "meals";

type Feat = { route: FeatureRoute; glyph: string; title: string };
type Section = { label: string; accent: "amber" | "cyan"; items: Feat[] };

// Features grouped so a 16-tool screen reads as a tidy launcher, not a flat wall.
const SECTIONS: Section[] = [
  { label: "Assistant", accent: "cyan", items: [
    { route: "notes", glyph: "🎙", title: "Dictaphone & Notes" },
    { route: "memory", glyph: "🧠", title: "Memory" },
    { route: "experts", glyph: "📚", title: "Experts" },
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

function Tile({ glyph, title, accent, bg, onPress }: { glyph: string; title: string; accent: string; bg: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}
      style={({ pressed }) => [st.tile, pressed && { borderColor: accent, backgroundColor: color.surface2 }]}>
      <View style={[st.iconBox, { backgroundColor: bg, borderColor: accent }]}>
        <Text style={[st.glyph, { color: accent }]}>{glyph}</Text>
      </View>
      <Text style={st.title} numberOfLines={2}>{L(title)}</Text>
    </Pressable>
  );
}

export default function Tools({ onPick, onOpen }: { onPick: (seed: string) => void; onOpen: (screen: FeatureRoute) => void }) {
  const insets = useSafeAreaInsets();
  useLang();
  return (
    <ScrollView contentContainerStyle={[st.pad, { paddingTop: Math.max(insets.top, 24) + 8 }]} showsVerticalScrollIndicator={false}>
      <View style={st.head}>
        <PixelText size="title" style={{ color: color.amber }}>{L("TOOLS")}</PixelText>
        <Body muted style={{ marginTop: space.xs }}>{L("Your on-device toolkit — everything here runs offline, nothing leaves the phone.")}</Body>
      </View>

      {SECTIONS.map((sec) => {
        const accent = sec.accent === "amber" ? color.amber : color.cyan;
        const bg = sec.accent === "amber" ? color.amberGlowBg : color.cyanGlowBg;
        return (
          <View key={sec.label} style={st.section}>
            <SectionHeader label={sec.label} accent={accent} />
            <View style={st.grid}>
              {sec.items.map((f) => (
                <Tile key={f.route} glyph={f.glyph} title={f.title} accent={accent} bg={bg} onPress={() => onOpen(f.route)} />
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tile: {
    flexGrow: 1, flexBasis: "45%", minWidth: 150,
    flexDirection: "row", alignItems: "center", gap: space.sm,
    backgroundColor: color.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: color.surfaceLine, padding: space.sm,
  },
  iconBox: { width: 42, height: 42, borderRadius: radius.md, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  glyph: { fontSize: 20, fontWeight: "900" },
  title: { flex: 1, color: color.text, fontSize: 14, fontWeight: "700" },
});
