import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, space, radius, type as T } from "../design/tokens";
import { PixelText, Body } from "../design/ui";
import { L, useLang } from "../i18n";

// Real shortcuts only — each opens Chat with a head-start prompt and routes to the
// on-device model. No placeholder tiles for features that don't exist yet.
type Tool = { glyph: string; title: string; sub: string; seed: string; tint: "amber" | "cyan" };
const TOOLS: Tool[] = [
  { glyph: "▤", title: "Paste & Ask", sub: "Drop in text and ask about it", seed: "Here's some text I'd like help with:\n\n", tint: "amber" },
  { glyph: "✓", title: "Fact-check a claim", sub: "Reason through whether it holds up", seed: "Help me reason through whether this claim holds up: ", tint: "cyan" },
  { glyph: "≡", title: "Summarise", sub: "Shorten a note or message", seed: "Summarise this clearly:\n\n", tint: "amber" },
  { glyph: "☼", title: "Explain simply", sub: "Plain-language explanation", seed: "Explain this simply, like I'm five: ", tint: "cyan" },
  { glyph: "✎", title: "Rephrase / draft", sub: "Reword or draft some text", seed: "Rephrase this more clearly: ", tint: "amber" },
  { glyph: "✦", title: "Brainstorm", sub: "A few quick ideas", seed: "Give me a few ideas for: ", tint: "cyan" },
];

type FeatureRoute = "notes" | "memory" | "grocery" | "diet" | "fitness" | "experts" | "budget";
export default function Tools({ onPick, onOpen }: { onPick: (seed: string) => void; onOpen: (screen: FeatureRoute) => void }) {
  const insets = useSafeAreaInsets();
  useLang(); // re-render on language change
  return (
    <ScrollView
      contentContainerStyle={[st.pad, { paddingTop: Math.max(insets.top, 24) + 8 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={st.head}>
        <PixelText size="title" style={{ color: color.amber }}>{L("TOOLS")}</PixelText>
        <Body muted style={{ marginTop: space.xs }}>
          {L("Shortcuts into your on-device buddy. Each opens Chat with a head start — your text never leaves the phone.")}
        </Body>
      </View>

      {/* Feature apps (not chat shortcuts) */}
      <Pressable
        onPress={() => onOpen("notes")}
        accessibilityRole="button"
        accessibilityLabel="Dictaphone and notes"
        style={({ pressed }) => [st.card, pressed && { borderColor: color.amber, backgroundColor: color.surface2 }]}
      >
        <View style={[st.tile, { backgroundColor: color.amberGlowBg, borderColor: color.amber }]}>
          <Text style={[st.glyph, { color: color.amber }]}>🎙</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>{L("Dictaphone & Notes")}</Text>
          <Text style={st.sub}>{L("Record voice notes (transcribed) or jot text — saved on-device")}</Text>
        </View>
        <Text style={st.chev}>›</Text>
      </Pressable>

      <Pressable
        onPress={() => onOpen("memory")}
        accessibilityRole="button"
        accessibilityLabel="Buddy memory"
        style={({ pressed }) => [st.card, pressed && { borderColor: color.cyan, backgroundColor: color.surface2 }]}
      >
        <View style={[st.tile, { backgroundColor: color.cyanGlowBg, borderColor: color.cyan }]}>
          <Text style={[st.glyph, { color: color.cyan }]}>🧠</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>{L("Memory")}</Text>
          <Text style={st.sub}>{L("What your buddy remembers about you — on-device, you control it")}</Text>
        </View>
        <Text style={st.chev}>›</Text>
      </Pressable>

      {([
        { route: "experts" as const, glyph: "📚", tint: color.cyan, bg: color.cyanGlowBg, title: "Experts", sub: "Ask across 13 curated knowledge packs — answers cite their source" },
        { route: "grocery" as const, glyph: "🛒", tint: color.amber, bg: color.amberGlowBg, title: "Grocery", sub: "Shopping list by category — check it off as you shop" },
        { route: "diet" as const, glyph: "🥗", tint: color.cyan, bg: color.cyanGlowBg, title: "Diet", sub: "Log food, track calories & macros vs a daily goal" },
        { route: "fitness" as const, glyph: "🏋", tint: color.amber, bg: color.amberGlowBg, title: "Fitness", sub: "Log workouts, track training volume & progress" },
        { route: "budget" as const, glyph: "💶", tint: color.cyan, bg: color.cyanGlowBg, title: "Budget", sub: "Track income & expenses, monthly balance by category" },
      ]).map((f) => (
        <Pressable key={f.route} onPress={() => onOpen(f.route)} accessibilityRole="button" accessibilityLabel={f.title}
          style={({ pressed }) => [st.card, pressed && { borderColor: f.tint, backgroundColor: color.surface2 }]}>
          <View style={[st.tile, { backgroundColor: f.bg, borderColor: f.tint }]}>
            <Text style={[st.glyph, { color: f.tint }]}>{f.glyph}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.title}>{L(f.title)}</Text>
            <Text style={st.sub}>{L(f.sub)}</Text>
          </View>
          <Text style={st.chev}>›</Text>
        </Pressable>
      ))}

      <View style={st.grid}>
        {TOOLS.map((t) => {
          const c = t.tint === "amber" ? color.amber : color.cyan;
          const bg = t.tint === "amber" ? color.amberGlowBg : color.cyanGlowBg;
          return (
            <Pressable
              key={t.title}
              onPress={() => onPick(t.seed)}
              accessibilityRole="button"
              accessibilityLabel={t.title}
              style={({ pressed }) => [st.card, pressed && { borderColor: c, backgroundColor: color.surface2 }]}
            >
              <View style={[st.tile, { backgroundColor: bg, borderColor: c }]}>
                <Text style={[st.glyph, { color: c }]}>{t.glyph}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.title}>{L(t.title)}</Text>
                <Text style={st.sub}>{L(t.sub)}</Text>
              </View>
              <Text style={st.chev}>›</Text>
            </Pressable>
          );
        })}
      </View>

      <Body muted style={st.note}>
        {L("More tools (reminders, recipes, training) are on the roadmap — these are the ones that genuinely work today.")}
      </Body>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  pad: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  head: { marginBottom: space.sm },
  grid: { gap: space.md },
  card: {
    flexDirection: "row", alignItems: "center", gap: space.md,
    backgroundColor: color.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: color.surfaceLine, padding: space.md,
  },
  tile: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  glyph: { fontSize: 22, fontWeight: "900" },
  title: { ...T.h2, fontSize: 16 },
  sub: { ...T.small, color: color.textMuted, marginTop: 2 },
  chev: { color: color.textFaint, fontSize: 24, fontWeight: "800" },
  note: { textAlign: "center", marginTop: space.md, fontSize: 12 },
});
