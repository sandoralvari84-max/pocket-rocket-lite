import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform,
} from "react-native";
import * as Speech from "expo-speech";
import { ask } from "./model";
import VoiceBar from "./VoiceBar";

type Msg = { role: "user" | "assistant"; text: string };

export default function VoiceChat() {
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const [last, setLast] = useState("");

  async function send() {
    const q = input.trim(); if (!q || busy) return;
    setInput(""); setMsgs((m) => [...m, { role: "user", text: q }]); setBusy(true);
    try {
      const a = await ask(q);
      setMsgs((m) => [...m, { role: "assistant", text: a }]);
      setLast(a);
      setBusy(false);
      setSpeaking(true);
      Speech.speak(a, { onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false), onError: () => setSpeaking(false) });
    } catch (e: any) {
      setMsgs((m) => [...m, { role: "assistant", text: "[error] " + String(e?.message ?? e) }]);
      setBusy(false);
    }
  }
  function stopSpeak() { Speech.stop(); setSpeaking(false); }

  return (
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.stage}>
        <VoiceBar active={busy || speaking} />
        <Text style={s.status}>{busy ? "Thinking…" : speaking ? "Speaking…" : "Ask me something"}</Text>
        {!!last && !showTranscript && <Text style={s.last} numberOfLines={4}>{last}</Text>}
        {speaking && <Pressable style={s.stop} onPress={stopSpeak}><Text style={s.stopT}>Stop</Text></Pressable>}
      </View>

      <Pressable onPress={() => setShowTranscript((v) => !v)} style={s.toggle}>
        <Text style={s.toggleT}>{showTranscript ? "Hide transcript" : "Show transcript"}</Text>
      </Pressable>
      {showTranscript && (
        <ScrollView style={s.transcript} contentContainerStyle={{ padding: 12, gap: 8 }}>
          {msgs.map((m, i) => (
            <View key={i} style={[s.bubble, m.role === "user" ? s.user : s.asst]}>
              <Text style={{ color: m.role === "user" ? "#fff" : "#111" }}>{m.text}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={s.inputRow}>
        <TextInput style={s.input} value={input} onChangeText={setInput}
          placeholder="Ask something…" editable={!busy} onSubmitEditing={send} returnKeyType="send" />
        <Pressable style={s.send} onPress={send} disabled={busy}><Text style={s.sendT}>Send</Text></Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#fff" },
  stage: { alignItems: "center", justifyContent: "center", paddingVertical: 24, paddingHorizontal: 16 },
  status: { marginTop: 12, fontSize: 16, color: "#555", fontWeight: "600" },
  last: { marginTop: 12, fontSize: 14, color: "#333", textAlign: "center" },
  stop: { marginTop: 12, backgroundColor: "#eee", paddingVertical: 6, paddingHorizontal: 16, borderRadius: 8 },
  stopT: { color: "#111", fontWeight: "600" },
  toggle: { alignItems: "center", paddingVertical: 6 },
  toggleT: { color: "#4da3ff", fontWeight: "600", fontSize: 13 },
  transcript: { flex: 1, borderTopWidth: 1, borderColor: "#eee" },
  bubble: { maxWidth: "85%", padding: 10, borderRadius: 12 },
  user: { alignSelf: "flex-end", backgroundColor: "#111" },
  asst: { alignSelf: "flex-start", backgroundColor: "#eee" },
  inputRow: { flexDirection: "row", padding: 8, gap: 8, borderTopWidth: 1, borderColor: "#eee" },
  input: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 10, paddingHorizontal: 12, height: 44 },
  send: { backgroundColor: "#111", borderRadius: 10, paddingHorizontal: 16, justifyContent: "center" },
  sendT: { color: "#fff", fontWeight: "600" },
});
