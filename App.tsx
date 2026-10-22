import React, { useState } from "react";
import { View, ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { useFonts, PressStart2P_400Regular } from "@expo-google-fonts/press-start-2p";
import { DISCLAIMER } from "./src/preset";
import { modelExists, downloadModel, loadModel } from "./src/model";
import Home from "./src/Home";
import { color, space } from "./src/design/tokens";
import { Screen, Title, H2, Body, PixelText, Button, Spinner, Card } from "./src/design/ui";

type Phase = "onboard" | "need-model" | "downloading" | "loading" | "ready" | "error";

export default function App() {
  const [fontsLoaded] = useFonts({ PressStart2P_400Regular });
  const [phase, setPhase] = useState<Phase>("onboard");
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState("");

  async function begin() {
    try {
      if (await modelExists()) { setPhase("loading"); await loadModel(); setPhase("ready"); }
      else setPhase("need-model");
    } catch (e: any) { setErr(String(e?.message ?? e)); setPhase("error"); }
  }
  async function getModel() {
    try {
      setPhase("downloading"); setProgress(0);
      await downloadModel(setProgress);
      setPhase("loading"); await loadModel(); setPhase("ready");
    } catch (e: any) { setErr(String(e?.message ?? e)); setPhase("error"); }
  }

  const ready = phase === "ready" && fontsLoaded;

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="light" />
      {ready ? <Home /> : <SetupGate
        phase={phase} progress={progress} err={err}
        onContinue={begin} onGetModel={getModel} fontsLoaded={fontsLoaded} />}
    </SafeAreaProvider>
  );
}

function SetupGate({ phase, progress, err, onContinue, onGetModel, fontsLoaded }: {
  phase: Phase; progress: number; err: string; onContinue: () => void; onGetModel: () => void; fontsLoaded: boolean;
}) {
  // Hold on the splash until fonts are ready so the pixel title never flashes unstyled.
  if (!fontsLoaded) return <Screen><View style={{ flex: 1, justifyContent: "center" }}><Spinner /></View></Screen>;

  return (
    <Screen scroll>
      <View style={{ flex: 1, justifyContent: "center", gap: space.lg, paddingVertical: space.xxl }}>
        {phase === "onboard" && (
          <>
            <View style={{ alignItems: "center", gap: space.sm }}>
              <PixelText size="title" style={{ color: color.amber, textAlign: "center" }}>SKEPTIC{"\n"}LITE</PixelText>
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
          <View style={{ gap: space.lg, alignItems: "center" }}>
            <Title>One-time setup</Title>
            <Body muted style={{ textAlign: "center" }}>The on-device model (~1 GB) downloads once over Wi-Fi, then runs fully offline forever.</Body>
            <Button title="Download model" onPress={onGetModel} full />
          </View>
        )}
        {phase === "downloading" && <Spinner label={`Downloading model… ${Math.round(progress * 100)}%`} />}
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
