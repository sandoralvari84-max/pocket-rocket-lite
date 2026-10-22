import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Speech from "expo-speech";
import { useAudioRecorder, useAudioPlayer, RecordingPresets, AudioModule } from "expo-audio";
import { ask } from "./model";
import { ensureWhisper, transcribe } from "./stt";
import { useSettings, getSettings } from "./settings";
import { color, space, radius, type as T, HIT } from "./design/tokens";
import { Body, PixelText, Input } from "./design/ui";
import VoiceBar, { VoiceBarState } from "./VoiceBar";

type Msg = { role: "user" | "assistant"; text: string };

// Tappable starter prompts for the empty state. Neutral copy — no accuracy promises.
const STARTERS: { label: string; prompt: string }[] = [
  { label: "Ask me a question", prompt: "What kinds of things can you help me think through?" },
  { label: "Sanity-check a note", prompt: "Here's a note I'd like a second opinion on: " },
  { label: "Double-check a claim", prompt: "Help me reason through this claim: " },
];

// Clean model text for TTS: drop markdown/symbols, collapse whitespace so the engine reads words, not glyphs.
function speakable(t: string): string {
  return t
    .replace(/[*_`#>|~]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

export default function VoiceChat() {
  const settings = useSettings();
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);          // model answering (ask)
  const [speaking, setSpeaking] = useState(false);  // TTS playing
  const [recording, setRecording] = useState(false); // mic actively capturing
  const [sttBusy, setSttBusy] = useState(false);     // whisper loading / transcribing
  const [sttStatus, setSttStatus] = useState("");    // transient non-error notice
  const [error, setError] = useState("");            // transient error flag for bar + status

  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [voiceIdx, setVoiceIdx] = useState(0);
  const voiceId = voices[voiceIdx]?.identifier;
  const latestVoice = useRef<string | undefined>(undefined);
  latestVoice.current = voiceId;

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const radar = useAudioPlayer(require("../assets/radar.wav"));
  const scrollRef = useRef<ScrollView>(null);
  const errTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Speech options sourced from settings: speechRate drives rate; the persona biases pitch
  // (sentinel = low KITT-like, nova = natural). The device voice itself comes from the voice list.
  function speakOpts() {
    const st = getSettings();
    return {
      language: "en-US",
      voice: latestVoice.current,
      rate: st.speechRate ?? 0.96,
      pitch: st.voice === "nova" ? 1.0 : 0.75,
    };
  }

  function flagError(msg: string) {
    setError(msg);
    if (errTimer.current) clearTimeout(errTimer.current);
    errTimer.current = setTimeout(() => setError(""), 4500);
  }
  function clearError() {
    if (errTimer.current) clearTimeout(errTimer.current);
    setError("");
  }
  useEffect(() => () => { if (errTimer.current) clearTimeout(errTimer.current); }, []);

  // Onboard-computer startup greeting, once. Reads live settings at speak time.
  useEffect(() => {
    const id = setTimeout(() => {
      try { Speech.speak("I am online and ready.", speakOpts()); } catch {}
    }, 900);
    return () => clearTimeout(id);
  }, []);

  // English voices, best (en-US / enhanced / male-ish) first. Gender isn't exposed reliably, so the
  // user can tap to CYCLE voices and land on a male/console one that's installed on their device.
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

  // Radar sweep loops softly only while the model is thinking (preserved behavior).
  useEffect(() => {
    try {
      if (busy) { radar.loop = true; radar.volume = 0.5; radar.seekTo(0); radar.play(); }
      else { radar.pause(); }
    } catch {}
  }, [busy]);

  // Keep the transcript pinned to the newest message.
  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(id);
  }, [msgs.length, busy]);

  // Accurate state for the voice bar. "listening" ONLY when the mic is actually recording.
  const voiceState: VoiceBarState =
    error ? "error" :
    recording ? "listening" :
    (busy || sttBusy) ? "thinking" :
    speaking ? "speaking" : "idle";

  function cycleVoice() {
    if (voices.length === 0) return;
    const ni = (voiceIdx + 1) % voices.length;
    setVoiceIdx(ni);
    Speech.stop();
    Speech.speak("Voice check. This is how I sound.", { ...speakOpts(), voice: voices[ni]?.identifier });
  }

  async function send(text?: string) {
    const q = (text ?? input).trim(); if (!q || busy) return;
    clearError();
    setInput(""); setMsgs((m) => [...m, { role: "user", text: q }]); setBusy(true);
    try {
      const a = await ask(q);
      setMsgs((m) => [...m, { role: "assistant", text: a }]); setBusy(false);
      setSpeaking(true);
      Speech.speak(speakable(a), {
        ...speakOpts(),
        onDone: () => setSpeaking(false),
        onStopped: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
    } catch (e: any) {
      setBusy(false);
      setMsgs((m) => [...m, { role: "assistant", text: "[error] " + String(e?.message ?? e) }]);
      flagError("Something went wrong answering that. Try again.");
    }
  }

  function stopSpeak() { Speech.stop(); setSpeaking(false); }

  async function micPress() {
    if (busy) return;
    clearError();
    if (!recording) {
      try {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) { flagError("Microphone permission denied. Enable it in system settings to use voice."); return; }
        setSttBusy(true); setSttStatus("Loading speech model…");
        await ensureWhisper(() => {});
        setSttStatus(""); setSttBusy(false);
        await recorder.prepareToRecordAsync();
        recorder.record();
        setRecording(true);
      } catch (e: any) {
        setSttBusy(false); setSttStatus("");
        flagError("Mic error: " + String(e?.message ?? e));
      }
    } else {
      try {
        setRecording(false); setSttBusy(true); setSttStatus("Transcribing…");
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) { setSttBusy(false); setSttStatus(""); flagError("No audio captured. Try again."); return; }
        const text = await transcribe(uri);
        setSttStatus(""); setSttBusy(false);
        if (text) send(text); else setSttStatus("Didn't catch that — try again.");
      } catch (e: any) {
        setSttBusy(false); setSttStatus("");
        flagError("Transcription error: " + String(e?.message ?? e));
      }
    }
  }

  const canSend = input.trim().length > 0 && !busy;
  const statusText =
    error ? error :
    recording ? "Listening…" :
    busy ? "Thinking…" :
    sttBusy ? (sttStatus || "Working…") :
    speaking ? "Speaking…" :
    sttStatus ? sttStatus :
    "Ready";
  const statusColor =
    error ? color.danger :
    recording ? color.cyan :
    (busy || sttBusy) ? color.amber :
    speaking ? color.amber : color.textMuted;

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={s.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Console header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <PixelText size="h2" style={{ color: color.amber }}>SKEPTIC</PixelText>
            <Text style={s.sub}>On-device assistant · offline</Text>
          </View>
          {msgs.length > 0 && (
            <Pressable
              onPress={() => { Speech.stop(); setSpeaking(false); clearError(); setMsgs([]); }}
              accessibilityRole="button" accessibilityLabel="Clear conversation"
              style={({ pressed }) => [s.clearBtn, pressed && { backgroundColor: color.surface2 }]}
            >
              <Text style={s.clearT}>Clear</Text>
            </Pressable>
          )}
        </View>

        {/* Voice HUD panel */}
        <View style={s.hud}>
          <VoiceBar state={voiceState} reducedMotion={settings.reducedMotion} />
          <View style={s.statusRow}>
            <View style={[s.dot, { backgroundColor: statusColor }]} />
            <Text style={[s.status, { color: statusColor }]}>{statusText}</Text>
          </View>
          <View style={s.hudControls}>
            {voices.length > 0 && (
              <Pressable
                onPress={cycleVoice}
                accessibilityRole="button" accessibilityLabel="Change voice"
                style={({ pressed }) => [s.voiceBtn, pressed && { backgroundColor: color.cyanGlowBg }]}
              >
                <Text style={s.voiceBtnT} numberOfLines={1}>
                  Voice · {voices[voiceIdx]?.name?.slice(0, 20) || "default"}
                </Text>
              </Pressable>
            )}
            {speaking && (
              <Pressable
                onPress={stopSpeak}
                accessibilityRole="button" accessibilityLabel="Stop speaking"
                style={({ pressed }) => [s.stopBtn, pressed && { backgroundColor: "rgba(255,82,71,0.15)" }]}
              >
                <Text style={s.stopT}>■ Stop</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Transcript */}
        {msgs.length === 0 ? (
          <ScrollView
            style={s.transcript}
            contentContainerStyle={s.emptyWrap}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={s.emptyGlyph}>▮▯▮</Text>
            <Text style={s.emptyTitle}>Ask me anything</Text>
            <Body muted style={{ textAlign: "center", maxWidth: 300 }}>
              Type below or tap the mic. Everything runs on your device — nothing leaves the phone.
            </Body>
            <View style={s.starters}>
              {STARTERS.map((st) => (
                <Pressable
                  key={st.label}
                  onPress={() => { if (st.prompt.trim().endsWith(":")) { setInput(st.prompt); } else { send(st.prompt); } }}
                  accessibilityRole="button" accessibilityLabel={st.label}
                  style={({ pressed }) => [s.starter, pressed && { borderColor: color.amber, backgroundColor: color.amberGlowBg }]}
                >
                  <Text style={s.starterT}>{st.label}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={s.transcript}
            contentContainerStyle={s.transcriptInner}
            keyboardShouldPersistTaps="handled"
          >
            {msgs.map((m, i) => {
              const isUser = m.role === "user";
              const isErr = !isUser && m.text.startsWith("[error]");
              return (
                <View key={i} style={[s.row, { justifyContent: isUser ? "flex-end" : "flex-start" }]}>
                  {!isUser && <Text style={[s.tag, isErr && { color: color.danger }]}>{isErr ? "ERR" : "AI"}</Text>}
                  <View style={[
                    s.bubble,
                    isUser ? s.userBubble : s.asstBubble,
                    isErr && s.errBubble,
                  ]}>
                    <Body style={isUser ? s.userText : isErr ? s.errText : undefined}>
                      {isErr ? m.text.replace(/^\[error\]\s*/, "") : m.text}
                    </Body>
                  </View>
                  {isUser && <Text style={[s.tag, { color: color.amber }]}>YOU</Text>}
                </View>
              );
            })}
            {busy && (
              <View style={[s.row, { justifyContent: "flex-start" }]}>
                <Text style={s.tag}>AI</Text>
                <View style={[s.bubble, s.asstBubble, s.typing]}>
                  <ActivityIndicator color={color.amber} size="small" />
                  <Text style={s.typingT}>Thinking…</Text>
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {/* Composer */}
        <View style={s.composer}>
          <Pressable
            onPress={micPress}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={recording ? "Stop recording" : "Record voice"}
            style={({ pressed }) => [
              s.mic,
              recording && { borderColor: color.cyan, backgroundColor: color.cyanGlowBg },
              pressed && { backgroundColor: color.surface2 },
              busy && { opacity: 0.4 },
            ]}
          >
            <Text style={{ fontSize: 20, color: recording ? color.cyan : color.text }}>
              {recording ? "■" : "🎤"}
            </Text>
          </Pressable>

          <Input
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask or tap the mic…"
            editable={!busy}
            onSubmitEditing={() => send()}
            returnKeyType="send"
            multiline={false}
          />

          <Pressable
            onPress={() => send()}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            style={({ pressed }) => [
              s.send,
              !canSend && { opacity: 0.4 },
              pressed && canSend && { backgroundColor: color.amberDim },
            ]}
          >
            <Text style={s.sendT}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  fill: { flex: 1, backgroundColor: color.bg },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm,
    borderBottomWidth: 1, borderBottomColor: color.surfaceLine,
  },
  sub: { ...T.small, color: color.textMuted, marginTop: 4 },
  clearBtn: {
    borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md,
    paddingHorizontal: space.md, height: 36, justifyContent: "center",
  },
  clearT: { color: color.textMuted, fontSize: 13, fontWeight: "700" },

  hud: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm, alignItems: "center" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontSize: 14, fontWeight: "700", letterSpacing: 0.4 },
  hudControls: { flexDirection: "row", gap: space.sm, marginTop: space.md, alignItems: "center", justifyContent: "center", flexWrap: "wrap" },
  voiceBtn: {
    borderWidth: 1, borderColor: color.cyanDim, borderRadius: radius.md,
    paddingVertical: 6, paddingHorizontal: space.md,
  },
  voiceBtnT: { color: color.cyan, fontSize: 12, fontWeight: "600" },
  stopBtn: {
    borderWidth: 1, borderColor: color.danger, borderRadius: radius.md,
    paddingVertical: 6, paddingHorizontal: space.md,
  },
  stopT: { color: color.danger, fontSize: 12, fontWeight: "700" },

  transcript: { flex: 1, borderTopWidth: 1, borderTopColor: color.surfaceLine },
  transcriptInner: { padding: space.lg, gap: space.md },

  row: { flexDirection: "row", alignItems: "flex-end", gap: space.sm, maxWidth: "100%" },
  tag: { ...T.small, color: color.textFaint, fontSize: 10, letterSpacing: 1, marginBottom: 3 },
  bubble: { maxWidth: "80%", paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1 },
  userBubble: { backgroundColor: color.amberGlowBg, borderColor: color.amberDim },
  asstBubble: { backgroundColor: color.surface, borderColor: color.surfaceLine },
  errBubble: { backgroundColor: "rgba(255,82,71,0.10)", borderColor: color.dangerDim },
  userText: { color: color.text },
  errText: { color: color.warn },
  typing: { flexDirection: "row", alignItems: "center", gap: space.sm },
  typingT: { ...T.bodyMuted, color: color.textMuted },

  emptyWrap: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.md },
  emptyGlyph: { color: color.amberDim, fontSize: 28, letterSpacing: 4 },
  emptyTitle: { ...T.h2, color: color.text, textAlign: "center" },
  starters: { marginTop: space.md, gap: space.sm, alignSelf: "stretch", maxWidth: 360, width: "100%" },
  starter: {
    borderWidth: 1, borderColor: color.surfaceLine, backgroundColor: color.surface,
    borderRadius: radius.md, paddingVertical: space.md, paddingHorizontal: space.lg, alignItems: "center",
  },
  starterT: { color: color.text, fontSize: 14, fontWeight: "600" },

  composer: {
    flexDirection: "row", gap: space.sm, alignItems: "center",
    padding: space.sm, paddingHorizontal: space.md,
    borderTopWidth: 1, borderTopColor: color.surfaceLine, backgroundColor: color.bg,
  },
  mic: {
    width: HIT, height: HIT, borderRadius: radius.md, borderWidth: 1, borderColor: color.surfaceLine,
    backgroundColor: color.surface, alignItems: "center", justifyContent: "center",
  },
  input: { flex: 1 },
  send: {
    backgroundColor: color.amber, borderRadius: radius.md, paddingHorizontal: space.lg,
    minHeight: HIT, justifyContent: "center", alignItems: "center",
  },
  sendT: { color: color.onAmber, fontWeight: "800", fontSize: 15, letterSpacing: 0.3 },
});
