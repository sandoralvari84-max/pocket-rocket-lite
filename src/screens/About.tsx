import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { color, space, radius, type as T, HIT } from "../design/tokens";
import { PixelText, Body, Panel } from "../design/ui";
import { appMeta } from "../appMeta";

type Credit = { name: string; detail: string; license: string };

const CREDITS: Credit[] = [
  { name: "Game art — Kenney", detail: "Pixel Platformer, Pixel Shmup & Pixel UI packs (kenney.nl)", license: "CC0 1.0" },
  { name: "Press Start 2P", detail: "Pixel display typeface by CodeMan38", license: "SIL Open Font License 1.1" },
  { name: "llama.rn", detail: "On-device LLM inference (llama.cpp bindings)", license: "MIT" },
  { name: "whisper.rn", detail: "On-device speech recognition (whisper.cpp bindings)", license: "MIT" },
  { name: "Expo & React Native", detail: "Application framework and runtime", license: "MIT" },
];

export default function About({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView style={cs.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={cs.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to settings"
          style={({ pressed }) => [cs.back, pressed && cs.backPressed]}
        >
          <Text style={cs.backGlyph}>‹</Text>
        </Pressable>
        <PixelText size="h2" style={cs.headerTitle}>ABOUT</PixelText>
        <View style={cs.back} />
      </View>

      <ScrollView contentContainerStyle={cs.pad} showsVerticalScrollIndicator={false}>
        <PixelText size="title" style={cs.appName}>{appMeta.name.toUpperCase()}</PixelText>
        <Body muted style={cs.version}>Version {appMeta.version}</Body>
        <Body muted style={cs.tagline}>A self-contained voice assistant and arcade that runs on your device.</Body>

        <Panel label="MODEL" tone="cyan">
          <Body style={cs.para}>
            Conversations are handled by Qwen2.5-1.5B Instruct, a compact instruction-tuned language
            model. It is quantized and runs on-device through llama.rn — no cloud service answers for it.
          </Body>
          <Body muted style={cs.para}>
            Speech recognition runs on-device through whisper.rn. Game art is rendered from bundled
            pixel sprites.
          </Body>
        </Panel>

        <Panel label="CREDITS & LICENSES" tone="cyan">
          {CREDITS.map((c) => (
            <View key={c.name} style={cs.credit}>
              <Text style={cs.creditName}>{c.name}</Text>
              <Text style={cs.creditDetail}>{c.detail}</Text>
              <Text style={cs.creditLicense}>{c.license}</Text>
            </View>
          ))}
          <Body muted style={cs.foot}>
            Kenney art is public domain (CC0); attribution here is voluntary. Each pack's original
            License.txt is bundled with the app as license evidence.
          </Body>
        </Panel>
      </ScrollView>
    </SafeAreaView>
  );
}

const cs = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: 2,
    borderColor: color.surfaceLine,
    backgroundColor: color.surface,
  },
  back: {
    width: HIT, height: HIT, borderRadius: radius.md,
    alignItems: "center", justifyContent: "center",
  },
  backPressed: { backgroundColor: color.surface2 },
  backGlyph: { color: color.amber, fontSize: 30, fontWeight: "800", lineHeight: 32 },
  headerTitle: { color: color.text, letterSpacing: 1 },

  pad: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  appName: { color: color.amber, letterSpacing: 1.5, marginTop: space.sm },
  version: { ...T.small, color: color.textFaint, marginTop: 2 },
  tagline: { marginBottom: space.sm },

  para: { marginBottom: space.xs },

  credit: {
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderColor: color.surfaceLine,
    gap: 2,
  },
  creditName: { ...T.body, fontWeight: "700" },
  creditDetail: { ...T.bodyMuted },
  creditLicense: { ...T.small, color: color.cyan, letterSpacing: 0.5, marginTop: 2 },
  foot: { marginTop: space.md, fontStyle: "italic" },
});
