import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform,
} from "react-native";
import * as Speech from "expo-speech";
import { useAudioRecorder, useAudioPlayer, RecordingPresets, AudioModule } from "expo-audio";
import { ask } from "./model";
import { ensureWhisper, transcribe } from "./stt";
import VoiceBar from "./VoiceBar";

type Msg = { role: "user" | "assistant"; text: string };

// Clean model text for TTS: drop markdown/symbols, collapse whitespace so the engine reads words, not glyphs.
function speakable(t: string): string {
  return t
    .replace(/[*_`#>|~]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

export default function VoiceChat() {
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const [last, setLast] = useState("");
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [voiceIdx, setVoiceIdx] = useState(0);
  const voiceId = voices[voiceIdx]?.identifier;
  const latestVoice = useRef<string | undefined>(undefined);
  latestVoice.current = voiceId;
  // KITT-style startup greeting, once.
  useEffect(() => {
    const id = setTimeout(() => {
      try { Speech.speak("I am online and ready.", { language: "en-US", voice: latestVoice.current, rate: 0.96, pitch: 0.75 }); } catch {}
    }, 900);
    return () => clearTimeout(id);
  }, []);
  const [recording, setRecording] = useState(false);
  const [sttStatus, setSttStatus] = useState("");
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const radar = useAudioPlayer(require("../assets/radar.wav"));

  // English voices, best (en-US / enhanced / male-ish) first. Gender isn't exposed reliably, so the
  // user can tap to CYCLE voices and land on a male/KITT one that's installed on their device.
  useEffect(() => {
    (async () => {
      try {
        const all = await Speech.getAvailableVoicesAsync();
        const en = all.filter((v) => (v.language || "").toLowerCase().startsWith("en"));
        const score = (v: Speech.Voice) =>
          ((v.language || "").toLowerCase().startsWith("en-us") ? 3 : 0) +
          (v.quality === Speech.VoiceQuality.Enhanced ? 2 : 0) +
          (/male|#male|-iom-|-iol-|_m_|us-x/i.test(v.name || "") ? 2 : 0) +
          (/female|#female|-tpf-|_f_/i.test(v.name || "") ? -3 : 0);
        en.sort((a, b) => score(b) - score(a));
        setVoices(en);
      } catch {}
    })();
  }, []);

  // KITT radar sweep loops softly only while the model is thinking.
  useEffect(() => {
    try {
      if (busy) { radar.loop = true; radar.volume = 0.5; radar.seekTo(0); radar.play(); }
      else { radar.pause(); }
    } catch {}
  }, [busy]);

  function cycleVoice() {
    if (voices.length === 0) return;
    const ni = (voiceIdx + 1) % voices.length;
    setVoiceIdx(ni);
    Speech.stop();
    Speech.speak("Voice check. This is how I sound.", { language: "en-US", voice: voices[ni]?.identifier, rate: 0.96, pitch: 0.75 });
  }

  async function send(text?: string) {
    const q = (text ?? input).trim(); if (!q || busy) return;
    setInput(""); setMsgs((m) => [...m, { role: "user", text: q }]); setBusy(true);
    try {
      const a = await ask(q);
      setMsgs((m) => [...m, { role: "assistant", text: a }]); setLast(a); setBusy(false);
      setSpeaking(true);
      Speech.speak(speakable(a), { language: "en-US", voice: voiceId, rate: 0.96, pitch: 0.75, onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false), onError: () => setSpeaking(false) });
    } catch (e: any) {
      setMsgs((m) => [...m, { role: "assistant", text: "[error] " + String(e?.message ?? e) }]); setBusy(false);
    }
  }
  function stopSpeak() { Speech.stop(); setSpeaking(false); }

  async function micPress() {
    if (busy) return;
    if (!recording) {
      try {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) { setSttStatus("Mic permission denied"); return; }
        setSttStatus("Loading speech model…");
        await ensureWhisper(() => {});
        setSttStatus("");
        await recorder.prepareToRecordAsync();
        recorder.record();
        setRecording(true);
      } catch (e: any) { setSttStatus("Mic error: " + String(e?.message ?? e)); }
    } else {
      try {
        setRecording(false); setSttStatus("Transcribing…");
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) { setSttStatus("No audio captured"); return; }
        const text = await transcribe(uri);
        setSttStatus("");
        if (text) send(text); else setSttStatus("Didn't catch that");
      } catch (e: any) { setSttStatus("STT error: " + String(e?.message ?? e)); }
    }
  }

  return (
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.stage}>
        <VoiceBar active={busy || speaking || recording} />
        <Text style={s.status}>
          {recording ? "Listening…" : busy ? "Thinking…" : speaking ? "Speaking…" : sttStatus || "Ask me something"}
        </Text>
        {voices.length > 0 && (
          <Pressable style={s.voiceBtn} onPress={cycleVoice}>
            <Text style={s.voiceBtnT}>🔊 {voices[voiceIdx]?.name?.slice(0, 24) || "voice"} · tap to change</Text>
          </Pressable>
        )}
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
              <Text style={{ color: m.role === "user" ? "#fff" : "#eee" }}>{m.text}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={s.inputRow}>
        <Pressable style={[s.mic, recording && s.micOn]} onPress={micPress} disabled={busy}>
          <Text style={s.micT}>{recording ? "■" : "🎤"}</Text>
        </Pressable>
        <TextInput style={s.input} value={input} onChangeText={setInput}
          placeholder="Ask or tap the mic…" placeholderTextColor="#8a6a6a" editable={!busy} onSubmitEditing={() => send()} returnKeyType="send" />
        <Pressable style={s.send} onPress={() => send()} disabled={busy}><Text style={s.sendT}>Send</Text></Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#0d0607" },
  stage: { alignItems: "center", justifyContent: "center", paddingVertical: 24, paddingHorizontal: 16 },
  status: { marginTop: 12, fontSize: 16, color: "#f0d8d8", fontWeight: "600" },
  voiceBtn: { marginTop: 10, borderWidth: 1, borderColor: "#5a1a1a", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  voiceBtnT: { color: "#ff8a8a", fontSize: 12, fontWeight: "600" },
  last: { marginTop: 12, fontSize: 14, color: "#cbbaba", textAlign: "center" },
  stop: { marginTop: 12, backgroundColor: "#2a1414", paddingVertical: 6, paddingHorizontal: 16, borderRadius: 8 },
  stopT: { color: "#eee", fontWeight: "600" },
  toggle: { alignItems: "center", paddingVertical: 6 },
  toggleT: { color: "#ff6b6b", fontWeight: "600", fontSize: 13 },
  transcript: { flex: 1, borderTopWidth: 1, borderColor: "#2a1414" },
  bubble: { maxWidth: "85%", padding: 10, borderRadius: 12 },
  user: { alignSelf: "flex-end", backgroundColor: "#b01820" },
  asst: { alignSelf: "flex-start", backgroundColor: "#1c1414" },
  inputRow: { flexDirection: "row", padding: 8, gap: 8, borderTopWidth: 1, borderColor: "#2a1414", alignItems: "center" },
  mic: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#2a1414", alignItems: "center", justifyContent: "center" },
  micOn: { backgroundColor: "#f3b0b0" },
  micT: { fontSize: 18 },
  input: { flex: 1, borderWidth: 1, borderColor: "#3a1e1e", backgroundColor: "#1a1010", color: "#eee", borderRadius: 10, paddingHorizontal: 12, height: 44 },
  send: { backgroundColor: "#b01820", borderRadius: 10, paddingHorizontal: 16, justifyContent: "center", height: 44 },
  sendT: { color: "#fff", fontWeight: "600" },
});
