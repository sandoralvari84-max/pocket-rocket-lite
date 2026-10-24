import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { useFonts, PressStart2P_400Regular } from "@expo-google-fonts/press-start-2p";
import { DISCLAIMER } from "./src/preset";
import { modelExists, downloadModel, importModel, loadModel } from "./src/model";
import Home from "./src/Home";
import { color, space, radius, type as T } from "./src/design/tokens";
import { Screen, Title, H2, Body, PixelText, Button, Spinner, Card, ProgressBar, Sprite } from "./src/design/ui";
import { appMeta } from "./src/appMeta";
import { getSettings, loadSettings, setSetting } from "./src/settings";

const EMBLEM = require("./assets/brand/emblem.png");

type Phase = "onboard" | "need-model" | "downloading" | "loading" | "ready" | "ready-no-model" | "error";

export default function App() {
  const [fontsLoaded] = useFonts({ PressStart2P_400Regular });
  const [phase, setPhase] = useState<Phase>("onboard");
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState("");

  async function begin() {
    try {
      await loadSettings();
      // If the model is already in app storage, load it; otherwise honor the optional setup choice.
      if (await modelExists()) { setPhase("loading"); await loadModel(); setSetting("modelSetupSkipped", false); setPhase("ready"); }
      else if (getSettings().modelSetupSkipped) { setPhase("ready-no-model"); }
      else { setPhase("need-model"); }
    } catch (e: any) { setErr(String(e?.message ?? e)); setPhase("error"); }
  }
  // Let the user into the core app (games, tools) without installing the ~1 GB model.
  function continueOffline() {
    setSetting("modelSetupSkipped", true);
    setPhase("ready-no-model");
  }
  // Import the model from the .gguf shared alongside the app (QuickShare folder).
  async function importFromFile() {
    try {
      setPhase("loading"); // system picker is modal; show the spinner behind it
      const ok = await importModel();
      if (!ok) { setPhase("need-model"); return; } // user cancelled the picker
      await loadModel(); setSetting("modelSetupSkipped", false); setPhase("ready");
    } catch (e: any) { setErr(String(e?.message ?? e)); setPhase("error"); }
  }
  async function getModel() {
    try {
      setPhase("downloading"); setProgress(0);
      await downloadModel(setProgress);
      setPhase("loading"); await loadModel(); setSetting("modelSetupSkipped", false); setPhase("ready");
    } catch (e: any) { setErr(String(e?.message ?? e)); setPhase("error"); }
  }

  const ready = (phase === "ready" || phase === "ready-no-model") && fontsLoaded;

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="light" />
      {ready ? <Home onModelSetup={() => setPhase("need-model")} /> : <SetupGate
        phase={phase} progress={progress} err={err}
        onContinue={begin} onContinueOffline={continueOffline} onImport={importFromFile} onGetModel={getModel} fontsLoaded={fontsLoaded} />}
    </SafeAreaProvider>
  );
}

function SetupGate({ phase, progress, err, onContinue, onContinueOffline, onImport, onGetModel, fontsLoaded }: {
  phase: Phase; progress: number; err: string; onContinue: () => void; onContinueOffline: () => void; onImport: () => void; onGetModel: () => void; fontsLoaded: boolean;
}) {
  // Hold on the splash until fonts are ready so the pixel title never flashes unstyled.
  if (!fontsLoaded) return <Screen><View style={{ flex: 1, justifyContent: "center" }}><Spinner /></View></Screen>;

  return (
    <Screen scroll>
      <View style={{ flex: 1, justifyContent: "center", gap: space.lg, paddingVertical: space.xxl }}>
        {phase === "onboard" && (
          <>
            <View style={{ alignItems: "center", gap: space.sm }}>
              <Sprite source={EMBLEM} size={120} />
              <PixelText size="title" style={{ color: color.amber, textAlign: "center" }}>{appMeta.name.toUpperCase().split(" ").join("\n")}</PixelText>
              <Body muted style={{ textAlign: "center" }}>A pocket AI buddy that runs entirely on your phone.</Body>
            </View>
            <Card>
              <OnboardRow glyph="📶" title="Works fully offline" text="No account, no internet needed at runtime. The model lives on your device." />
              <OnboardRow glyph="💬" title="Chat, tools & arcade" text="Ask it things, fact-check a note, or play the built-in retro games." />
              <OnboardRow glyph="🧪" title="It pushes back on bad info" text="On a specific false-fact test it followed a planted lie far less often — down from 97% to 23% (and it held when the lie was reworded). That's one test, not a general accuracy promise." last />
            </Card>
            <Body muted style={{ fontSize: 12, textAlign: "center" }}>{DISCLAIMER}</Body>
            <Button title="I understand — continue" onPress={onContinue} full />
          </>
        )}
        {phase === "need-model" && (
          <View style={{ gap: space.lg }}>
            <View style={{ alignItems: "center", gap: space.xs }}>
              <Sprite source={EMBLEM} size={72} />
              <PixelText size="h2" style={{ color: color.amber, textAlign: "center" }}>CHOOSE A START</PixelText>
              <Body muted style={{ textAlign: "center" }}>
                Add the on-device AI once (~1 GB) — or jump straight into the games and add it later.
              </Body>
            </View>
            <View style={{ gap: space.md }}>
              <SetupOption glyph="📁" tint={color.amber} title="Import model file"
                sub="Pick the qwen…q4_k_m.gguf shared to your phone." onPress={onImport} />
              <SetupOption glyph="⬇" tint={color.cyan} title="Download over Wi-Fi"
                sub="About 1 GB, once — then fully offline forever." onPress={onGetModel} />
              <SetupOption glyph="▶" tint={color.textMuted} title="Continue without AI"
                sub="Play games & tools now; add the AI later in Settings." onPress={onContinueOffline} />
            </View>
          </View>
        )}
        {phase === "downloading" && (
          <View style={{ gap: space.lg, alignItems: "center", paddingHorizontal: space.lg }}>
            <Title>Getting ready</Title>
            <ProgressBar progress={progress} label="Downloading the on-device model…" />
            <Body muted style={{ textAlign: "center", fontSize: 12 }}>Over Wi-Fi, once. Keep the app open.</Body>
          </View>
        )}
        {phase === "loading" && <Spinner label="Loading model…" />}
        {phase === "error" && (
          <View style={{ gap: space.lg, alignItems: "center" }}>
            <H2 style={{ color: color.warn }}>Something went wrong</H2>
            <Body muted style={{ textAlign: "center" }}>{err}</Body>
            <Button title="Retry" variant="secondary" onPress={onContinue} />
          </View>
        )}
      </View>
    </Screen>
  );
}

function OnboardRow({ glyph, title, text, last }: { glyph: string; title: string; text: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: "row", gap: space.md, paddingBottom: last ? 0 : space.lg, marginBottom: last ? 0 : space.lg,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: color.surfaceLine }}>
      <Body style={{ fontSize: 22 }}>{glyph}</Body>
      <View style={{ flex: 1 }}>
        <H2 style={{ fontSize: 15 }}>{title}</H2>
        <Body muted style={{ marginTop: 2 }}>{text}</Body>
      </View>
    </View>
  );
}

// A tappable setup choice, styled as a menu card (icon tile + title + sub + chevron).
function SetupOption({ glyph, title, sub, tint, onPress }: {
  glyph: string; title: string; sub: string; tint: string; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}
      style={({ pressed }) => [og.card, pressed && { borderColor: tint, backgroundColor: color.surface2 }]}>
      <View style={[og.tile, { borderColor: tint, backgroundColor: color.surface2 }]}>
        <Text style={[og.glyph, { color: tint }]}>{glyph}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={og.title}>{title}</Text>
        <Text style={og.sub}>{sub}</Text>
      </View>
      <Text style={og.chev}>›</Text>
    </Pressable>
  );
}

const og = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: color.surfaceLine, padding: space.md },
  tile: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  glyph: { fontSize: 22, fontWeight: "900" },
  title: { ...T.h2, fontSize: 16, color: color.text },
  sub: { ...T.small, color: color.textMuted, marginTop: 2 },
  chev: { color: color.textFaint, fontSize: 24, fontWeight: "800" },
});
