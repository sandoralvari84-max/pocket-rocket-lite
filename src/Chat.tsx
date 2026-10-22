import React, { useState } from "react";
import {
  View, Text, TextInput, ScrollView, Pressable, ActivityIndicator,
  StyleSheet, KeyboardAvoidingView, Platform,
} from "react-native";
import { ask } from "./model";

type Msg = { role: "user" | "assistant"; text: string };

export default function Chat() {
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);

  async function send() {
    const q = input.trim(); if (!q || busy) return;
    setInput(""); setMsgs((m) => [...m, { role: "user", text: q }]); setBusy(true);
    try { const a = await ask(q); setMsgs((m) => [...m, { role: "assistant", text: a }]); }
    catch (e: any) { setMsgs((m) => [...m, { role: "assistant", text: "[error] " + String(e?.message ?? e) }]); }
    finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={s.fill} contentContainerStyle={s.chat}>
        {msgs.length === 0 && <Text style={s.hint}>Ask a factual question. It will push back on wrong "facts" — but it's a lite model, so verify anything that matters.</Text>}
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
        <Pressable style={s.send} onPress={send} disabled={busy}><Text style={s.sendT}>Send</Text></Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#fff" },
  chat: { padding: 12, gap: 8 },
  hint: { color: "#888", fontSize: 13, textAlign: "center", marginTop: 24, paddingHorizontal: 16 },
  bubble: { maxWidth: "85%", padding: 10, borderRadius: 12 },
  user: { alignSelf: "flex-end", backgroundColor: "#111" },
  asst: { alignSelf: "flex-start", backgroundColor: "#eee" },
  inputRow: { flexDirection: "row", padding: 8, gap: 8, borderTopWidth: 1, borderColor: "#eee" },
  input: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 10, paddingHorizontal: 12, height: 44 },
  send: { backgroundColor: "#111", borderRadius: 10, paddingHorizontal: 16, justifyContent: "center" },
  sendT: { color: "#fff", fontWeight: "600" },
});
