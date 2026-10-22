import React, { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { DISCLAIMER } from "./src/preset";
import { modelExists, downloadModel, loadModel } from "./src/model";
import Home from "./src/Home";

type Phase = "disclaimer" | "need-model" | "downloading" | "loading" | "ready" | "error";

export default function App() {
  const [phase, setPhase] = useState<Phase>("disclaimer");
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

  let content: React.ReactNode;
  if (phase === "ready") content = <Home />;
  else {
    let body: React.ReactNode;
    if (phase === "disclaimer")
      body = (<>
        <Text style={s.title}>Skeptic Lite</Text>
        <Text style={s.disc}>{DISCLAIMER}</Text>
        <Pressable style={s.btn} onPress={begin}><Text style={s.btnT}>I understand — continue</Text></Pressable>
      </>);
    else if (phase === "need-model")
      body = (<>
        <Text style={s.title}>One-time setup</Text>
        <Text style={s.body}>The on-device model (~1 GB) downloads once, then runs fully offline.</Text>
        <Pressable style={s.btn} onPress={getModel}><Text style={s.btnT}>Download model</Text></Pressable>
      </>);
    else if (phase === "downloading")
      body = (<><ActivityIndicator /><Text style={s.body}>Downloading… {Math.round(progress * 100)}%</Text></>);
    else if (phase === "loading")
      body = (<><ActivityIndicator /><Text style={s.body}>Loading model…</Text></>);
    else
      body = (<>
        <Text style={s.title}>Something went wrong</Text>
        <Text style={s.body}>{err}</Text>
        <Pressable style={s.btn} onPress={begin}><Text style={s.btnT}>Retry</Text></Pressable>
      </>);
    content = <View style={s.center}>{body}</View>;
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="dark" />
      {content}
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 12, color: "#111" },
  disc: { fontSize: 14, color: "#444", lineHeight: 20, marginBottom: 24, textAlign: "center" },
  body: { fontSize: 15, color: "#333", textAlign: "center", marginVertical: 12 },
  btn: { backgroundColor: "#111", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  btnT: { color: "#fff", fontWeight: "600" },
});
