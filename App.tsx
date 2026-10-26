import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { useFonts, PressStart2P_400Regular } from "@expo-google-fonts/press-start-2p";
import { VT323_400Regular } from "@expo-google-fonts/vt323";
import { JetBrainsMono_400Regular, JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono";
import { ChakraPetch_400Regular, ChakraPetch_500Medium, ChakraPetch_700Bold } from "@expo-google-fonts/chakra-petch";
import { DISCLAIMER } from "./src/preset";
import { modelExists, downloadModel, importModel, loadModel, activeProfile } from "./src/model";
import Home from "./src/Home";
import { ErrorBoundary } from "./src/ErrorBoundary";
import { color, space, radius, type as T } from "./src/design/tokens";
import { Screen, Title, H2, Body, PixelText, Button, Spinner, Card, ProgressBar, Sprite } from "./src/design/ui";
import { appMeta } from "./src/appMeta";
import { getSettings, loadSettings, setSetting } from "./src/settings";
import { L, useLang, LANGS } from "./src/i18n";

const EMBLEM = require("./assets/brand/emblem.png");

type Phase = "onboard" | "need-model" | "downloading" | "loading" | "ready" | "ready-no-model" | "error";

export default function App() {
  const [fontsLoaded] = useFonts({ PressStart2P_400Regular, VT323_400Regular, JetBrainsMono_400Regular, JetBrainsMono_700Bold, ChakraPetch_400Regular, ChakraPetch_500Medium, ChakraPetch_700Bold });
  // TEMP design-iteration switch — boots straight to Home (no onboarding/model gate).
  // MUST be false for shipping builds.
  const DEV_HOME = false;
  const [phase, setPhase] = useState<Phase>(DEV_HOME ? "ready-no-model" : "onboard");
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
      <ErrorBoundary>
        {ready ? <Home onModelSetup={() => setPhase("need-model")} /> : <SetupGate
          phase={phase} progress={progress} err={err}
          onContinue={begin} onContinueOffline={continueOffline} onImport={importFromFile} onGetModel={getModel} fontsLoaded={fontsLoaded} />}
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

function SetupGate({ phase, progress, err, onContinue, onContinueOffline, onImport, onGetModel, fontsLoaded }: {
  phase: Phase; progress: number; err: string; onContinue: () => void; onContinueOffline: () => void; onImport: () => void; onGetModel: () => void; fontsLoaded: boolean;
}) {
  useLang(); // re-render on language change
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
              <Body muted style={{ textAlign: "center" }}>{L("A pocket AI buddy that runs entirely on your phone.")}</Body>
            </View>
            <Card>
              <OnboardRow glyph="📶" title={L("Works fully offline")} text={L("No account, no internet needed at runtime. The model lives on your device.")} />
              <OnboardRow glyph="💬" title={L("Chat, tools & arcade")} text={L("Ask it things, fact-check a note, or play the built-in retro games.")} />
              <OnboardRow glyph="🧪" title={L("It pushes back on bad info")} text={L("On a specific false-fact test it followed a planted lie far less often — down from 97% to 23% (and it held when the lie was reworded). That's one test, not a general accuracy promise.")} last />
            </Card>
            <Body muted style={{ fontSize: 12, textAlign: "center" }}>{L(DISCLAIMER)}</Body>
            <LangSelect />
            <Button title={L("I understand — continue")} onPress={onContinue} full />
          </>
        )}
        {phase === "need-model" && (
          <View style={{ gap: space.lg }}>
            <View style={{ alignItems: "center", gap: space.xs }}>
              <Sprite source={EMBLEM} size={72} />
              <PixelText size="h2" style={{ color: color.amber, textAlign: "center" }}>{L("CHOOSE A START")}</PixelText>
              <Body muted style={{ textAlign: "center" }}>
                {L("Add the on-device AI once") + " (~" + (activeProfile().bytes / 1e9).toFixed(1) + " GB · " + activeProfile().label + ") — " + L("or jump straight into the games and add it later.")}
              </Body>
            </View>
            <View style={{ gap: space.md }}>
              <SetupOption glyph="📁" tint={color.amber} title={L("Import model file")}
                sub={L("Pick the qwen…q4_k_m.gguf shared to your phone.")} onPress={onImport} />
              <SetupOption glyph="⬇" tint={color.cyan} title={L("Download over Wi-Fi")}
                sub={"~" + (activeProfile().bytes / 1e9).toFixed(1) + " GB over Wi-Fi, once — then offline forever."} onPress={onGetModel} />
              <SetupOption glyph="▶" tint={color.textMuted} title={L("Continue without AI")}
                sub={L("Play games & tools now; add the AI later in Settings.")} onPress={onContinueOffline} />
            </View>
          </View>
        )}
        {phase === "downloading" && (
          <View style={{ gap: space.lg, alignItems: "center", paddingHorizontal: space.lg }}>
            <Title>{L("Getting ready")}</Title>
            <ProgressBar progress={progress} label={L("Downloading the on-device model…")} />
            <Body muted style={{ textAlign: "center", fontSize: 12 }}>{L("Over Wi-Fi, once. Keep the app open.")}</Body>
          </View>
        )}
        {phase === "loading" && <Spinner label={L("Loading model…")} />}
        {phase === "error" && (
          <View style={{ gap: space.lg, alignItems: "center" }}>
            <H2 style={{ color: color.warn }}>{L("Something went wrong")}</H2>
            <Body muted style={{ textAlign: "center" }}>{err}</Body>
            <Button title={L("Retry")} variant="secondary" onPress={onContinue} />
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

// Pre-launch language selector on the onboarding screen (English / Español / Deutsch).
function LangSelect() {
  useLang(); // re-render + re-localize the onboarding on change
  const cur = getSettings().language ?? "en";
  return (
    <View style={ls.row}>
      {LANGS.map((l) => {
        const on = cur === l.key;
        return (
          <Pressable key={l.key} onPress={() => setSetting("language", l.key)}
            accessibilityRole="button" accessibilityLabel={l.label}
            style={({ pressed }) => [ls.pill, on && ls.pillOn, pressed && !on && { backgroundColor: color.surface2 }]}>
            <Text style={[ls.pillT, on && ls.pillTOn]}>{l.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const ls = StyleSheet.create({
  row: { flexDirection: "row", gap: space.sm, justifyContent: "center" },
  pill: { flex: 1, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: color.surfaceLine, backgroundColor: color.surface, alignItems: "center", justifyContent: "center" },
  pillOn: { borderColor: color.amber, backgroundColor: color.amberGlowBg },
  pillT: { ...T.small, color: color.textMuted, fontWeight: "700" },
  pillTOn: { color: color.amber },
});

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
