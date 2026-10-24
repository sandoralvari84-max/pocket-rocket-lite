import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Animated, Easing, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Speech from "expo-speech";
import { useAudioRecorder, useAudioPlayer, RecordingPresets, AudioModule } from "expo-audio";
import { chat } from "./model";
import { ensureWhisper, transcribe } from "./stt";
import { useSettings, getSettings, setSetting } from "./settings";
import { L, useLang } from "./i18n";
import { color, space, radius, type as T, HIT } from "./design/tokens";
import { Body, PixelText, Input, Banner, Sprite } from "./design/ui";
import VoiceBar, { VoiceBarState } from "./VoiceBar";
import { appMeta } from "./appMeta";

const EMBLEM = require("../assets/brand/emblem.png");

const { width: SW, height: SH } = Dimensions.get("window");
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Restrained starfield for the home hero depth (static; a handful of dots).
const HERO_STARS = Array.from({ length: 16 }, () => ({
  x: Math.random(), y: Math.random(), sz: 1 + Math.random() * 1.6, op: 0.18 + Math.random() * 0.4,
}));

// Persona is a whole CHARACTER, not a colour swap: different ambient backdrop,
// card shape, idle motion, greeting voice. Sentinel = sharp, angular, dry/cynical;
// Nova = soft, organic, warm. The locked amber/charcoal/cyan shell stays the base.
const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
const PERSONA = {
  sentinel: {
    accent: "#FF9800", cardRadius: 5, tileRadius: 4,
    greet: [
      "Let's get this over with.",
      "Online. Unfortunately.",
      "Go on — impress me.",
      "State your business.",
      "Back already? Fine.",
      "Ready. Try not to break anything.",
    ],
  },
  nova: {
    accent: "#00E5FF", cardRadius: 22, tileRadius: 15,
    greet: [
      "Hey — good to see you.",
      "I'm right here whenever you need me.",
      "Take your time. I've got you.",
      "Whatever you need, I'm listening.",
      "Hi you. Where shall we start?",
      "Ready when you are. ♥",
    ],
  },
} as const;

// Home's first action is NOT a duplicate of the bottom nav (Games/Tools/Settings) —
// it's one-tap head-starts into a task, in each persona's voice. Tapping seeds the
// composer; the user adds the detail and sends.
const CHIPS = {
  sentinel: [
    { label: "Sanity-check this", seed: "Sanity-check this for me: " },
    { label: "Draft a reply", seed: "Draft a short, sharp reply to: " },
    { label: "Explain simply", seed: "Explain this simply: " },
  ],
  nova: [
    { label: "Think it through", seed: "Help me think this through: " },
    { label: "Reword kindly", seed: "Reword this more kindly: " },
    { label: "Explain simply", seed: "Explain this gently and simply: " },
  ],
} as const;

// Ambient backdrop geometry (built once).
const GRID_STEP = 54;
const GRID_V = Array.from({ length: Math.ceil(SW / GRID_STEP) + 1 }, (_, i) => i * GRID_STEP);
const GRID_H = Array.from({ length: Math.ceil(SH / GRID_STEP) + 1 }, (_, i) => i * GRID_STEP);
const SENTINEL_STARS = Array.from({ length: 48 }, () => ({ x: Math.random() * SW, y: Math.random() * SH, s: 1 + Math.random() * 1.4 }));
const NOVA_STARS = Array.from({ length: 22 }, () => ({ x: Math.random() * SW, y: Math.random() * SH, s: 2 + Math.random() * 2.4 }));

// The persona-driven ambient field behind the whole screen. Two layers crossfaded by
// `np` (0 = Sentinel, 1 = Nova); each has its own slow, subtle motion.
function PersonaBackdrop({ np, breathe, scan, reduced }: {
  np: Animated.Value; breathe: Animated.Value; scan: Animated.Value; reduced: boolean;
}) {
  const sentinelOp = np.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* SENTINEL — angular grid, sharp star-points, a slow scanline sweep */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: sentinelOp }]}>
        {GRID_V.map((x) => (
          <View key={`v${x}`} style={{ position: "absolute", left: x, top: 0, bottom: 0, width: 1, backgroundColor: "rgba(255,152,0,0.045)" }} />
        ))}
        {GRID_H.map((y) => (
          <View key={`h${y}`} style={{ position: "absolute", top: y, left: 0, right: 0, height: 1, backgroundColor: "rgba(255,152,0,0.04)" }} />
        ))}
        {SENTINEL_STARS.map((st, i) => (
          <View key={i} style={{ position: "absolute", left: st.x, top: st.y, width: st.s, height: st.s, backgroundColor: "#FFD9A6", opacity: 0.5 }} />
        ))}
        {!reduced && (
          <Animated.View style={{ position: "absolute", left: 0, right: 0, height: 2, backgroundColor: "rgba(255,152,0,0.16)", transform: [{ translateY: scan.interpolate({ inputRange: [0, 1], outputRange: [-30, SH] }) }] }} />
        )}
      </Animated.View>
      {/* NOVA — soft aurora glow blobs that breathe, sparse round stars */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: np }]}>
        <Animated.View style={{ position: "absolute", left: -SW * 0.25, top: SH * 0.04, width: SW * 0.9, height: SW * 0.9, borderRadius: SW, backgroundColor: "#00E5FF", opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.10, 0.17] }), transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) }] }} />
        <Animated.View style={{ position: "absolute", right: -SW * 0.3, top: SH * 0.3, width: SW, height: SW, borderRadius: SW, backgroundColor: "#8A63FF", opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.08] }), transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1.1, 0.96] }) }] }} />
        <Animated.View style={{ position: "absolute", left: SW * 0.1, bottom: SH * 0.06, width: SW * 0.7, height: SW * 0.7, borderRadius: SW, backgroundColor: "#00E5FF", opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.12] }), transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.1] }) }] }} />
        {NOVA_STARS.map((st, i) => (
          <View key={i} style={{ position: "absolute", left: st.x, top: st.y, width: st.s, height: st.s, borderRadius: st.s / 2, backgroundColor: "#BBF0FF", opacity: 0.45 }} />
        ))}
      </Animated.View>
    </View>
  );
}

type Msg = { role: "user" | "assistant"; text: string };

// Scripted intro — stated honestly, never generated by the model (which rambled about
// being Qwen). States what it's good at AND its limits.
const INTRO =
  "I’m Pocket Rocket — a little buddy that runs entirely on your phone, offline. I’m a small " +
  "model, so I’m best at everyday things: thinking a decision through, sanity-checking a dodgy " +
  "“fact” or a forwarded message, rephrasing or drafting text, and brainstorming. I’m not " +
  "reliable for hard facts, maths, or anything recent — so verify anything that matters. If a " +
  "question is too big for me, I’ll say I can’t answer it rather than make something up. Ask " +
  "away, or tap Games for the arcade.";

// Tappable starter prompts for the empty state. Neutral copy — no accuracy promises.
const STARTERS: { label: string; prompt?: string; reply?: string }[] = [
  { label: "What can you do?", reply: INTRO },
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

export default function VoiceChat({ seed, seedNonce, onOpenGames, onOpenTools, onOpenNotes }: {
  seed?: string; seedNonce?: number;
  onOpenGames?: () => void; onOpenTools?: () => void; onOpenNotes?: () => void;
} = {}) {
  const settings = useSettings();
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);          // model answering (ask)
  const [speaking, setSpeaking] = useState(false);  // TTS playing
  const [recording, setRecording] = useState(false); // mic actively capturing
  const [sttBusy, setSttBusy] = useState(false);     // whisper loading / transcribing
  const [sttStatus, setSttStatus] = useState("");    // transient non-error notice
  const [error, setError] = useState("");            // transient error flag for bar + status
  const [permDenied, setPermDenied] = useState(false); // persistent mic-permission notice

  useLang(); // re-render on language change
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const radar = useAudioPlayer(require("../assets/radar.wav"));
  const scrollRef = useRef<ScrollView>(null);
  const errTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendLock = useRef(false);
  const micTransitionLock = useRef(false);
  const speechGeneration = useRef(0);

  // --- Persona as a living character: morphing backdrop, card shape, idle motion, copy ---
  const persona = settings.voice;
  const np = useRef(new Animated.Value(persona === "nova" ? 1 : 0)).current;  // 0 Sentinel .. 1 Nova
  const sweepAnim = useRef(new Animated.Value(0)).current;                     // whole-screen switch sweep
  const pulse = useRef(new Animated.Value(0)).current;                         // emblem idle
  const breathe = useRef(new Animated.Value(0)).current;                       // Nova aurora
  const scan = useRef(new Animated.Value(0)).current;                          // Sentinel scanline
  const prevPersona = useRef(persona);
  const [greeting, setGreeting] = useState(() => pick(PERSONA[persona].greet));

  // Switching persona morphs background + cards together, sweeps the screen once, and
  // speaks + shows a fresh greeting in the new voice — the whole app changes character.
  useEffect(() => {
    setGreeting(pick(PERSONA[persona].greet));
    if (settings.reducedMotion) { np.setValue(persona === "nova" ? 1 : 0); prevPersona.current = persona; return; }
    Animated.timing(np, { toValue: persona === "nova" ? 1 : 0, duration: 580, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start();
    if (prevPersona.current !== persona) {
      sweepAnim.setValue(0);
      Animated.timing(sweepAnim, { toValue: 1, duration: 640, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
    prevPersona.current = persona;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, settings.reducedMotion]);

  // Idle motion differs by character: Sentinel = sharp, quick emblem pulse; Nova = slow,
  // soft breathing of both the emblem and the aurora. Scanline drifts for Sentinel.
  useEffect(() => {
    pulse.stopAnimation(); breathe.stopAnimation(); scan.stopAnimation();
    if (settings.reducedMotion) return;
    const pDur = persona === "nova" ? 2600 : 1150;
    const pl = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: pDur, easing: persona === "nova" ? Easing.inOut(Easing.sin) : Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: pDur, easing: persona === "nova" ? Easing.inOut(Easing.sin) : Easing.in(Easing.quad), useNativeDriver: true }),
    ]));
    // Slow aurora drift (reference: 8–20s loops read as "alive" not busy).
    const bl = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const sl = Animated.loop(Animated.timing(scan, { toValue: 1, duration: 5200, easing: Easing.linear, useNativeDriver: true }));
    pl.start(); bl.start(); sl.start();
    return () => { pl.stop(); bl.stop(); sl.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, settings.reducedMotion]);

  // Speech options sourced from settings: speechRate drives rate; the persona biases pitch
  // (sentinel = low KITT-like, nova = natural). The device voice itself comes from the voice list.
  function speakOpts() {
    const st = getSettings();
    // Spoken locale follows the saved interface language so TTS is pronounced correctly.
    const locale = st.language === "de" ? "de-DE" : st.language === "es" ? "es-ES" : "en-US";
    return {
      language: locale,
      rate: st.speechRate ?? 0.96,
      pitch: st.voice === "nova" ? 1.0 : 0.75,  // persona: nova = natural, sentinel = low
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

  // One controlled utterance at a time; stale completion callbacks cannot clear a newer state.
  function speakText(text: string) {
    const generation = ++speechGeneration.current;
    Speech.stop();
    setSpeaking(true);
    try {
      Speech.speak(speakable(text), {
        ...speakOpts(),
        onDone: () => { if (speechGeneration.current === generation) setSpeaking(false); },
        onStopped: () => { if (speechGeneration.current === generation) setSpeaking(false); },
        onError: () => { if (speechGeneration.current === generation) setSpeaking(false); },
      });
    } catch {
      if (speechGeneration.current === generation) setSpeaking(false);
    }
  }

  // A Tools shortcut seeds the composer with a starter prompt (the nonce makes a
  // repeated tap re-apply). Prefilled locally only — nothing sends until you do.
  useEffect(() => {
    if (seed != null && seedNonce != null) setInput(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedNonce]);

  // Onboard-computer startup greeting, once. Reads live settings at speak time.
  useEffect(() => {
    const id = setTimeout(() => {
      speakText(L("I am online and ready."));
    }, 900);
    return () => clearTimeout(id);
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

  async function send(text?: string) {
    const q = (text ?? input).trim(); if (!q || busy || sendLock.current) return;
    sendLock.current = true;
    clearError();
    setInput(""); setBusy(true);
    // Pass the running conversation so the buddy follows context (owner memory is
    // injected by the model layer). Captured before we append the new user turn.
    const history = msgs.map((m) => ({ role: m.role, content: m.text }));
    setMsgs((m) => [...m, { role: "user", text: q }]);
    try {
      const a = await chat(q, settings.voice, history);
      setMsgs((m) => [...m, { role: "assistant", text: a }]); setBusy(false);
      speakText(a);
      sendLock.current = false;
    } catch (e: any) {
      setBusy(false);
      const detail = String(e?.message ?? e);
      const modelMissing = detail.toLowerCase().includes("model not loaded");
      setMsgs((m) => [...m, {
        role: "assistant",
        text: modelMissing
          ? "The local AI model is not installed yet. Open Settings and choose Set up local AI to import or download it. The games are still available."
          : "[error] " + detail,
      }]);
      if (!modelMissing) flagError("Something went wrong answering that. Try again.");
      sendLock.current = false;
    }
  }

  function stopSpeak() { speechGeneration.current += 1; Speech.stop(); setSpeaking(false); }

  async function micPress() {
    if (busy || micTransitionLock.current) return;
    clearError();
    if (!recording) {
      micTransitionLock.current = true;
      try {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) { setPermDenied(true); flagError("Microphone permission denied. Enable it in system settings to use voice."); return; }
        setPermDenied(false);
        setSttBusy(true); setSttStatus("Loading speech model…");
        await ensureWhisper(() => {});
        setSttStatus(""); setSttBusy(false);
        await recorder.prepareToRecordAsync();
        recorder.record();
        setRecording(true);
      } catch (e: any) {
        setSttBusy(false); setSttStatus("");
        flagError("Mic error: " + String(e?.message ?? e));
      } finally {
        micTransitionLock.current = false;
      }
    } else {
      micTransitionLock.current = true;
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
      } finally {
        micTransitionLock.current = false;
      }
    }
  }

  const canSend = input.trim().length > 0 && !busy;
  const statusText =
    error ? error :
    recording ? L("Listening…") :
    busy ? L("Thinking…") :
    sttBusy ? (sttStatus || L("Working…")) :
    speaking ? L("Speaking…") :
    sttStatus ? sttStatus :
    L("Ready");
  const statusColor =
    error ? color.danger :
    recording ? color.cyan :
    (busy || sttBusy) ? color.amber :
    speaking ? color.amber : color.textMuted;

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <PersonaBackdrop np={np} breathe={breathe} scan={scan} reduced={settings.reducedMotion} />
      {!settings.reducedMotion && (
        <Animated.View pointerEvents="none" style={[s.sweep, {
          backgroundColor: PERSONA[persona].accent,
          opacity: sweepAnim.interpolate({ inputRange: [0, 0.08, 0.6, 1], outputRange: [0, 0.6, 0.35, 0] }),
          transform: [{ translateY: sweepAnim.interpolate({ inputRange: [0, 1], outputRange: [-40, SH] }) }],
        }]} />
      )}
      <KeyboardAvoidingView
        style={[s.fill, { backgroundColor: "transparent" }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Masthead: brand + persona swap */}
        <View style={s.header}>
          <Animated.View style={{
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, persona === "nova" ? 1.05 : 1.09] }) }],
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: persona === "nova" ? [0.9, 1] : [0.8, 1] }),
          }}>
            <Sprite source={EMBLEM} size={34} />
          </Animated.View>
          <View style={{ flex: 1, marginLeft: space.sm }}>
            <PixelText size="label" style={{ color: PERSONA[persona].accent, fontSize: 11 }}>{appMeta.name.toUpperCase()}</PixelText>
            <Text style={s.sub}>{L("On-device assistant · offline")}</Text>
          </View>
          <View style={s.personaWrap}>
            {(["sentinel", "nova"] as const).map((p) => {
              const on = settings.voice === p;
              const c = p === "nova" ? color.cyan : color.amber;
              return (
                <Pressable key={p} onPress={() => { if (settings.voice !== p) { setSetting("voice", p); speakText(L("I am online and ready.")); } }}
                  accessibilityRole="button" accessibilityLabel={`${p} persona`}
                  style={[s.personaBtn, on && { backgroundColor: c + "22", borderColor: c }]}>
                  <Text style={[s.personaT, { color: on ? c : color.textFaint }]}>{p === "nova" ? "NOVA" : "SENTINEL"}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* KITT / HAL voice meter — the AI's face (compact, persona-aware) */}
        <View style={s.meterWrap}>
          <VoiceBar state={voiceState} persona={settings.voice} reducedMotion={settings.reducedMotion} height={82} />
          <View style={s.statusRow}>
            <View style={[s.dot, { backgroundColor: statusColor }]} />
            <Text style={[s.status, { color: statusColor }]}>{statusText}</Text>
            {speaking && (
              <Pressable onPress={stopSpeak} accessibilityRole="button" accessibilityLabel="Stop speaking"
                style={({ pressed }) => [s.stopBtn, pressed && { backgroundColor: "rgba(255,82,71,0.15)" }]}>
                <Text style={s.stopT}>■ Stop</Text>
              </Pressable>
            )}
            {msgs.length > 0 && (
              <Pressable onPress={() => { Speech.stop(); setSpeaking(false); clearError(); setMsgs([]); }}
                accessibilityRole="button" accessibilityLabel="Clear conversation"
                style={({ pressed }) => [s.clearBtn, pressed && { backgroundColor: color.surface2 }]}>
                <Text style={s.clearT}>Clear</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Home hero (empty) vs transcript (conversation) */}
        {msgs.length === 0 ? (
          <ScrollView
            style={[s.fill, { backgroundColor: "transparent" }]}
            contentContainerStyle={s.heroWrap}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Greeting carries the persona's voice AND type: Sentinel = sharp, uppercase,
                tight tracking; Nova = soft, airy, lighter weight. */}
            <Text style={[s.greeting, persona === "nova" ? s.greetNova : s.greetSentinel]}>{greeting}</Text>
            <Text style={s.heroSub}>{L("On-device · private · fully offline")}</Text>

            <View style={s.composerHero}>
              <Pressable onPress={micPress} disabled={busy} accessibilityRole="button"
                accessibilityLabel={recording ? "Stop recording" : "Record voice"}
                style={({ pressed }) => [s.mic, recording && { borderColor: color.cyan, backgroundColor: color.cyanGlowBg }, pressed && { backgroundColor: color.surface2 }, busy && { opacity: 0.4 }]}>
                <Text style={{ fontSize: 20, color: recording ? color.cyan : color.text }}>{recording ? "■" : "🎤"}</Text>
              </Pressable>
              <Input style={s.input} value={input} onChangeText={setInput} placeholder={L("Ask or tap the mic…")}
                editable={!busy} onSubmitEditing={() => send()} returnKeyType="send" multiline={false} />
              <Pressable onPress={() => send()} disabled={!canSend} accessibilityRole="button" accessibilityLabel="Send message"
                style={({ pressed }) => [s.send, !canSend && { opacity: 0.4 }, pressed && canSend && { backgroundColor: color.amberDim }]}>
                <Text style={s.sendT}>{L("Send")}</Text>
              </Pressable>
            </View>

            <Text style={[s.chipHint, { color: PERSONA[persona].accent }]}>
              {persona === "nova" ? "try one — I'll take it from there" : "QUICK START"}
            </Text>
            <View style={s.chipRow}>
              {CHIPS[persona].map((c) => (
                <SuggestChip key={c.label} label={c.label} np={np} accent={PERSONA[persona].accent}
                  onPress={() => setInput(c.seed)} />
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

        {permDenied && (
          <View style={{ paddingHorizontal: space.md, paddingBottom: space.sm }}>
            <Banner
              tone="warn"
              title="Microphone blocked"
              message="Enable mic access in system settings to use voice input."
            />
          </View>
        )}

        {/* Composer (conversation view — the empty home has its own in the hero) */}
        {msgs.length > 0 && (
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
              placeholder={L("Ask or tap the mic…")}
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
              <Text style={s.sendT}>{L("Send")}</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Persona suggestion chip. Its corner radius morphs with `np` — sharp/squared under
// Sentinel, soft/pill under Nova — so the shape itself carries the persona (the ruled
// card-shape split, moved onto the element that actually belongs on the home screen).
function SuggestChip({ label, np, accent, onPress }: {
  label: string; np: Animated.Value; accent: string; onPress: () => void;
}) {
  const r = np.interpolate({ inputRange: [0, 1], outputRange: [5, 22] });
  return (
    <AnimatedPressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [s.chip, { borderRadius: r as unknown as number, borderColor: accent, backgroundColor: accent + (pressed ? "2A" : "16") }]}>
      <Text style={[s.chipT, { color: accent }]}>{label}</Text>
    </AnimatedPressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  fill: { flex: 1, backgroundColor: color.bg },

  // Mission Bay home
  personaWrap: { flexDirection: "row", gap: 6 },
  personaBtn: { borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.pill, paddingHorizontal: 10, height: 30, justifyContent: "center" },
  personaT: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  meterWrap: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xs, alignItems: "center" },
  heroWrap: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.sm },
  star: { position: "absolute", backgroundColor: "#E8F0FF" },
  greeting: { fontSize: 30, fontWeight: "800", color: color.text, textAlign: "center", letterSpacing: 0.2, paddingHorizontal: space.md },
  greetSentinel: { fontSize: 23, fontWeight: "800", letterSpacing: 1.3, textTransform: "uppercase" },
  greetNova: { fontSize: 31, fontWeight: "500", letterSpacing: 0.2, lineHeight: 40 },
  heroSub: { ...T.small, color: color.textMuted, textAlign: "center", marginBottom: space.md },
  composerHero: { flexDirection: "row", gap: space.sm, alignItems: "center", alignSelf: "stretch", maxWidth: 440, width: "100%", backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.lg, padding: space.sm },
  chipHint: { fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: space.lg, opacity: 0.85 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.sm, marginTop: space.sm, alignSelf: "stretch", maxWidth: 440, width: "100%" },
  chip: { borderWidth: 1.5, borderColor: color.surfaceLine, backgroundColor: "rgba(20,26,34,0.55)", paddingHorizontal: 16, paddingVertical: 11 },
  chipT: { fontSize: 13, fontWeight: "700" },
  sweep: { position: "absolute", left: 0, right: 0, height: 3, zIndex: 20, shadowColor: "#FFFFFF", shadowOpacity: 0.6, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm,
    borderBottomWidth: 1, borderBottomColor: color.surfaceLine,
  },
  sub: { ...T.small, color: color.textMuted, marginTop: 4 },
  clearBtn: {
    borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md,
    paddingHorizontal: space.md, height: 44, justifyContent: "center",
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
