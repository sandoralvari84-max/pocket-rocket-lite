import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, ScrollView, Pressable, ActivityIndicator,
  StyleSheet, KeyboardAvoidingView, Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { DISCLAIMER } from "./src/preset";
import { modelExists, downloadModel, loadModel, ask } from "./src/model";

type Phase = "disclaimer" | "need-model" | "downloading" | "loading" | "ready" | "error";
type Msg = { role: "user" | "assistant"; text: string };

export default function App() {
  const [phase, setPhase] = useState<Phase>("disclaimer");
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState("");
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);

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

  async function send() {
    const q = input.trim(); if (!q || busy) return;
    setInput(""); setMsgs((m) => [...m, { role: "user", text: q }]); setBusy(true);
    try { const a = await ask(q); setMsgs((m) => [...m, { role: "assistant", text: a }]); }
    catch (e: any) { setMsgs((m) => [...m, { role: "assistant", text: "[error] " + String(e?.message ?? e) }]); }
    finally { setBusy(false); }
  }

  if (phase === "disclaimer")
    return (
      <View style={s.center}>
        <StatusBar style="dark" />
        <Text style={s.title}>Skeptic Lite</Text>
        <Text style={s.disc}>{DISCLAIMER}</Text>
        <Pressable style={s.btn} onPress={begin}><Text style={s.btnT}>I understand — continue</Text></Pressable>
      </View>
    );
  if (phase === "need-model")
    return (
      <View style={s.center}>
        <Text style={s.title}>One-time setup</Text>
        <Text style={s.body}>The on-device model (~1 GB) downloads once, then runs fully offline.</Text>
        <Pressable style={s.btn} onPress={getModel}><Text style={s.btnT}>Download model</Text></Pressable>
      </View>
    );
  if (phase === "downloading")
    return (<View style={s.center}><ActivityIndicator /><Text style={s.body}>Downloading… {Math.round(progress * 100)}%</Text></View>);
  if (phase === "loading")
    return (<View style={s.center}><ActivityIndicator /><Text style={s.body}>Loading model…</Text></View>);
  if (phase === "error")
    return (<View style={s.center}><Text style={s.title}>Something went wrong</Text><Text style={s.body}>{err}</Text><Pressable style={s.btn} onPress={begin}><Text style={s.btnT}>Retry</Text></Pressable></View>);

  return (
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="dark" />
      <ScrollView style={s.fill} contentContainerStyle={s.chat}>
        {msgs.map((m, i) => (
          <View key={i} style={[s.bubble, m.role === "user" ? s.user : s.asst]}>
            <Text style={{ color: m.role === "user" ? "#fff" : "#111" }}>{m.text}</Text>
          </View>
        ))}
        {busy && <ActivityIndicator style={{ marginTop: 8 }} />}
      </ScrollView>
      <View style={s.inputRow}>
        <TextInput style={s.input} value={input} onChangeText={setInput}
          placeholder="Ask something…" editable={!busy} onSubmitEditing={send} returnKeyType="send" />
        <Pressable style={s.send} onPress={send} disabled={busy}><Text style={s.btnT}>Send</Text></Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 12, color: "#111" },
  disc: { fontSize: 14, color: "#444", lineHeight: 20, marginBottom: 24, textAlign: "center" },
  body: { fontSize: 15, color: "#333", textAlign: "center", marginVertical: 12 },
  btn: { backgroundColor: "#111", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  btnT: { color: "#fff", fontWeight: "600" },
  chat: { padding: 12, gap: 8 },
  bubble: { maxWidth: "85%", padding: 10, borderRadius: 12 },
  user: { alignSelf: "flex-end", backgroundColor: "#111" },
  asst: { alignSelf: "flex-start", backgroundColor: "#eee" },
  bubbleT: { color: undefined as any },
  inputRow: { flexDirection: "row", padding: 8, gap: 8, borderTopWidth: 1, borderColor: "#eee" },
  input: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 10, paddingHorizontal: 12, height: 44 },
  send: { backgroundColor: "#111", borderRadius: 10, paddingHorizontal: 16, justifyContent: "center" },
});
