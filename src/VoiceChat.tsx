import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet, Image,
  KeyboardAvoidingView, Platform, ActivityIndicator, Animated, Easing, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Speech from "expo-speech";
import { resolveVoices, voiceId } from "./voices";
import { useAudioRecorder, useAudioPlayer, RecordingPresets, AudioModule } from "expo-audio";
import { chat, activeModelLabel, stopGeneration } from "./model";
import { ensureWhisper, transcribe, startRecording, stopRecording } from "./stt";
import { useSettings, getSettings, setSetting } from "./settings";
import { L, useLang } from "./i18n";
import { color, space, radius, type as T, HIT, glow, font } from "./design/tokens";
import { Body, PixelText, Input, Banner, Sprite } from "./design/ui";
import { CrtDisplay } from "./design/console";
import VoiceBar, { VoiceBarState } from "./VoiceBar";
import { appMeta } from "./appMeta";
import type { FeatureRoute } from "./screens/Tools";
import { detectTool, type ToolHit } from "./toolIntent";
import { detectCapability } from "./capabilities/dispatch";
import { capabilityAction, runLink } from "./capabilities/execute";
import type { Matched } from "./capabilities/types";

const EMBLEM = require("../assets/brand/emblem.png");

// Quick-launch tools on the home, in the games-cabinet style.
const TOOL4: { route: FeatureRoute; title: string; icon: any }[] = [
  { route: "notes", title: "Dictaphone", icon: require("../assets/ui/tools/notes.png") },
  { route: "memory", title: "Memory", icon: require("../assets/ui/tools/memory.png") },
  { route: "experts", title: "Experts", icon: require("../assets/ui/tools/experts.png") },
  { route: "notifs", title: "Reader", icon: require("../assets/ui/tools/notifs.png") },
];

const { width: SW, height: SH } = Dimensions.get("window");
const HOME_BG = require("../assets/ui/home_bg.jpg");        // Sentinel (amber HUD)
const HOME_BG_NOVA = require("../assets/ui/home_bg_nova.jpg"); // Nova (cosmic / cyan)
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
    accent: color.amber, cardRadius: 5, tileRadius: 4,
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
    accent: color.cyan, cardRadius: 22, tileRadius: 15,
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
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Live art backdrop — a gentle parallax drift makes the static scene breathe. */}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [
        { scale: 1.08 },
        { translateX: breathe.interpolate({ inputRange: [0, 1], outputRange: [-7, 7] }) },
        { translateY: breathe.interpolate({ inputRange: [0, 1], outputRange: [5, -5] }) },
      ] }]}>
        <Animated.Image source={HOME_BG} resizeMode="cover" fadeDuration={0} style={[StyleSheet.absoluteFill, { opacity: np.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]} />
        <Animated.Image source={HOME_BG_NOVA} resizeMode="cover" fadeDuration={0} style={[StyleSheet.absoluteFill, { opacity: np }]} />
      </Animated.View>
      {/* soft dark scrim so UI text stays readable over the art */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(11,15,20,0.18)" }]} />
      {/* bottom scrim so the tool labels stay readable over the art */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: SH * 0.5, backgroundColor: "rgba(11,15,20,0.30)" }} />
      {/* twinkling motes for life */}
      {!reduced && SENTINEL_STARS.slice(0, 20).map((st, i) => (
        <Animated.View key={i} style={{ position: "absolute", left: st.x, top: st.y, width: st.s + 0.5, height: st.s + 0.5, borderRadius: st.s,
          backgroundColor: "#FFD9A6",
          opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [i % 2 ? 0.12 : 0.5, i % 2 ? 0.5 : 0.12] }) }} />
      ))}
      {/* slow scanline sweep */}
      {!reduced && (
        <Animated.View style={{ position: "absolute", left: 0, right: 0, height: 2, backgroundColor: "rgba(255,152,0,0.12)", transform: [{ translateY: scan.interpolate({ inputRange: [0, 1], outputRange: [-30, SH] }) }] }} />
      )}
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
    // Strip emoji / pictographs / symbols so the TTS engine reads words, not glyphs.
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}\u{2190}-\u{21FF}\u{2460}-\u{24FF}]/gu, " ")
    .replace(/[*_`#>|~]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

export default function VoiceChat({ seed, seedNonce, onOpenGames, onOpenTools, onOpenNotes, onOpenTool }: {
  seed?: string; seedNonce?: number;
  onOpenGames?: () => void; onOpenTools?: () => void; onOpenNotes?: () => void; onOpenTool?: (route: FeatureRoute) => void;
} = {}) {
  const settings = useSettings();
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [toolHint, setToolHint] = useState<ToolHit | null>(null); // main-chat tool designation
  const [capHint, setCapHint] = useState<Matched | null>(null);   // detected device capability (timer/directions/…)
  const [busy, setBusy] = useState(false);          // model answering (ask)
  const [speaking, setSpeaking] = useState(false);  // TTS playing
  const [recording, setRecording] = useState(false); // mic actively capturing
  const [sttBusy, setSttBusy] = useState(false);     // whisper loading / transcribing
  const [sttStatus, setSttStatus] = useState("");    // transient non-error notice
  const [error, setError] = useState("");            // transient error flag for bar + status
  const [permDenied, setPermDenied] = useState(false); // persistent mic-permission notice
  const [stream, setStream] = useState("");          // live partial assistant text while generating

  useLang(); // re-render on language change
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const radar = useAudioPlayer(require("../assets/radar.wav"));
  // Persona UI sounds (tools/art/gen_sounds.py): Sentinel = square blips, Nova = sine chimes.
  const sfxWakeS = useAudioPlayer(require("../assets/audio/sentinel_wake.wav"));
  const sfxWakeN = useAudioPlayer(require("../assets/audio/nova_wake.wav"));
  const sfxListenS = useAudioPlayer(require("../assets/audio/sentinel_listen.wav"));
  const sfxListenN = useAudioPlayer(require("../assets/audio/nova_listen.wav"));
  const sfxSendS = useAudioPlayer(require("../assets/audio/sentinel_send.wav"));
  const sfxSendN = useAudioPlayer(require("../assets/audio/nova_send.wav"));
  const sfxErr = useAudioPlayer(require("../assets/audio/ui_error.wav"));
  const playSfx = (p: any, vol = 0.55) => {
    if (!getSettings().gameSound) return;
    try { p.seekTo(0); p.volume = vol; p.play(); } catch {}
  };
  const uiSfx = (kind: "wake" | "listen" | "send") => {
    const nova = getSettings().voice === "nova";
    playSfx(kind === "wake" ? (nova ? sfxWakeN : sfxWakeS)
      : kind === "listen" ? (nova ? sfxListenN : sfxListenS)
      : (nova ? sfxSendN : sfxSendS));
  };
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
      uiSfx("wake");
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
    const vid = voiceId(st.voice === "nova" ? "nova" : "sentinel"); // concrete male/female device voice
    return {
      language: locale,
      ...(vid ? { voice: vid } : {}),
      // Sentinel = male, DEEP + slower = robotic/KITT (not a tincan); Nova = female, natural.
      rate: (st.speechRate ?? 0.96) * (st.voice === "nova" ? 1.0 : 0.9),
      pitch: st.voice === "nova" ? 1.0 : 0.78,
    };
  }

  function flagError(msg: string) {
    setError(msg);
    playSfx(sfxErr, 0.5);
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
    let cancelled = false;
    // Resolve the concrete male/female device voices first, then greet in-character.
    resolveVoices(getSettings().language).finally(() => {
      if (cancelled) return;
      setTimeout(() => { if (!cancelled) speakText(L("I am online and ready.")); }, 500);
    });
    return () => { cancelled = true; };
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
    uiSfx("send");
    // Detect a device capability (timer, directions, draft a text, …) deterministically from
    // the user's words; it runs without the model. Prefer it over the plain tool shortcut when
    // it maps to a real action; otherwise fall back to the tool designation.
    const cap = detectCapability(q);
    const hasCapAction = !!cap && capabilityAction(cap).kind !== "none";
    if (hasCapAction) { setCapHint(cap); setToolHint(null); }
    else { setCapHint(null); setToolHint(detectTool(q)); }
    clearError();
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: q }]);
    // Deterministic capability: the app performs it via the chip below. Do NOT run the model here
    // — it doesn't know the action fired and would phrase a contradicting reply ("I can't set
    // timers"). Acknowledge with a fixed line that points at the chip, speak it, and stop.
    if (hasCapAction && cap) {
      const line = cap.label + L(" — tap below to run it.");
      setMsgs((m) => [...m, { role: "assistant", text: line }]);
      Speech.stop();
      const gen = ++speechGeneration.current;
      setSpeaking(true);
      const say = speakable(line);
      if (say) Speech.speak(say, {
        ...speakOpts(),
        onDone: () => { if (speechGeneration.current === gen) setSpeaking(false); },
        onStopped: () => { if (speechGeneration.current === gen) setSpeaking(false); },
        onError: () => { if (speechGeneration.current === gen) setSpeaking(false); },
      });
      else setSpeaking(false);
      sendLock.current = false;
      return;
    }
    setBusy(true); setStream("");
    // Pass the running conversation so the buddy follows context (owner memory is
    // injected by the model layer). Captured before we append the new user turn.
    const history = msgs.map((m) => ({ role: m.role, content: m.text }));
    try {
      Speech.stop();
      const gen = ++speechGeneration.current;
      setSpeaking(true);
      let spokenLen = 0;
      const speakChunk = (chunk: string) => { const say = speakable(chunk); if (say) Speech.speak(say, speakOpts()); };
      const a = await chat(q, settings.voice, history, (partial) => {
        if (speechGeneration.current !== gen) return; // Stop was pressed — ignore late tokens
        setStream(partial);
        // Speak complete sentences as they stream so the voice follows the text
        // instead of waiting for the whole reply to finish generating.
        const pending = partial.slice(spokenLen);
        const b = Math.max(
          pending.lastIndexOf("."), pending.lastIndexOf("!"),
          pending.lastIndexOf("?"), pending.lastIndexOf("…"), pending.lastIndexOf("\n"),
        );
        if (b >= 0) { speakChunk(pending.slice(0, b + 1)); spokenLen += b + 1; }
      });
      setStream("");
      setMsgs((m) => [...m, { role: "assistant", text: a }]); setBusy(false);
      const tail = a.slice(spokenLen);
      if (speechGeneration.current === gen && tail.trim()) speakChunk(tail);
      // Flip the Speaking indicator off once the whole queued utterance drains.
      const drain = setInterval(async () => {
        try {
          if (!(await Speech.isSpeakingAsync())) { clearInterval(drain); if (speechGeneration.current === gen) setSpeaking(false); }
        } catch { clearInterval(drain); if (speechGeneration.current === gen) setSpeaking(false); }
      }, 400);
      sendLock.current = false;
    } catch (e: any) {
      setBusy(false); setStream(""); Speech.stop(); setSpeaking(false);
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

  function stopSpeak() {
    // Stop = stop everything: bump the generation (silences queued TTS + the drain watcher),
    // halt playback, AND abort the in-flight model generation (not just the audio).
    speechGeneration.current += 1; Speech.stop(); setSpeaking(false); setBusy(false); setStream(""); void stopGeneration();
  }

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
        startRecording();
        setRecording(true);
        uiSfx("listen");
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
        const uri = await stopRecording();
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
    <View style={s.safe}>
      <PersonaBackdrop np={np} breathe={breathe} scan={scan} reduced={settings.reducedMotion} />
      {!settings.reducedMotion && (
        <Animated.View pointerEvents="none" style={[s.sweep, {
          backgroundColor: PERSONA[persona].accent,
          opacity: sweepAnim.interpolate({ inputRange: [0, 0.08, 0.6, 1], outputRange: [0, 0.6, 0.35, 0] }),
          transform: [{ translateY: sweepAnim.interpolate({ inputRange: [0, 1], outputRange: [-40, SH] }) }],
        }]} />
      )}
      <SafeAreaView style={s.fill} edges={["top", "left", "right"]}>
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
                  style={[s.personaBtn, on && { backgroundColor: c + "22", borderColor: c, boxShadow: p === "nova" ? glow.cyanSoft : glow.amberSoft }]}>
                  <Text style={[s.personaT, { color: on ? c : color.textFaint }]}>{p === "nova" ? "NOVA" : "SENTINEL"}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* KITT / HAL voice meter — the AI's face, housed in the console CRT display
            so it reads as the machine's screen. Rim glow follows the active persona. */}
        <View style={s.meterWrap}>
          <CrtDisplay accent={PERSONA[persona].accent} glowOn style={s.meterDisplay}>
            <VoiceBar state={voiceState} persona={settings.voice} reducedMotion={settings.reducedMotion} height={108} />
          </CrtDisplay>
          <View style={s.statusRow}>
            <View style={[s.dot, { backgroundColor: statusColor }]} />
            <Text style={[s.status, { color: statusColor }]}>{statusText}</Text>
            {!speaking && msgs.length === 0 && <Text style={s.meta}>{activeModelLabel()} · LOCAL · YOURS</Text>}
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
                style={({ pressed }) => [s.mic, { borderColor: PERSONA[persona].accent }, recording && { borderColor: color.cyan, backgroundColor: color.cyanGlowBg }, pressed && { backgroundColor: color.surface2 }, busy && { opacity: 0.4 }]}>
                <Text style={{ fontSize: 20, color: recording ? color.cyan : color.text }}>{recording ? "■" : "🎤"}</Text>
              </Pressable>
              <Input style={s.input} value={input} onChangeText={setInput} placeholder={L("Ask or tap the mic…")}
                editable={!busy} onSubmitEditing={() => send()} returnKeyType="send" multiline={false} />
              <Pressable onPress={() => send()} disabled={!canSend} accessibilityRole="button" accessibilityLabel="Send message"
                style={({ pressed }) => [s.send, { backgroundColor: PERSONA[persona].accent }, !canSend && { opacity: 0.4 }, pressed && canSend && { backgroundColor: color.amberDim }]}>
                <Text style={s.sendT}>{L("Send")}</Text>
              </Pressable>
            </View>

            <Text style={[s.chipHint, { color: PERSONA[persona].accent }]}>
              {persona === "nova" ? "quick tools" : "QUICK TOOLS"}
            </Text>
            <View style={s.toolGrid}>
              {TOOL4.map((t) => (
                <Pressable key={t.route} onPress={() => onOpenTool?.(t.route)} accessibilityRole="button" accessibilityLabel={t.title}
                  style={({ pressed }) => [s.toolTile, pressed && { borderColor: PERSONA[persona].accent, backgroundColor: color.surface2 }]}>
                  <View style={[s.toolWell, { borderColor: PERSONA[persona].accent }]}>
                    <Image source={t.icon} style={{ width: 30, height: 30, tintColor: PERSONA[persona].accent }} resizeMode="contain" />
                    <View style={[s.toolLed, { backgroundColor: PERSONA[persona].accent }]} pointerEvents="none" />
                  </View>
                  <Text style={s.toolTitle} numberOfLines={1}>{t.title}</Text>
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
                {stream ? (
                  <View style={[s.bubble, s.asstBubble]}>
                    <Body>{stream}</Body>
                  </View>
                ) : (
                  <View style={[s.bubble, s.asstBubble, s.typing]}>
                    <ActivityIndicator color={color.amber} size="small" />
                    <Text style={s.typingT}>Thinking…</Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        )}

        {/* Device capability — act on what the user asked (open the tool, or hand off to maps/
            SMS/mail/browser). Side-effecting actions only run on this explicit tap. */}
        {capHint && msgs.length > 0 && (
          <View style={{ paddingHorizontal: space.md }}>
            <Pressable onPress={() => {
                const act = capabilityAction(capHint); setCapHint(null);
                if (act.kind === "route") onOpenTool?.(act.route);
                else if (act.kind === "link") runLink(act.url);
              }}
              accessibilityRole="button" accessibilityLabel={capHint.label}
              style={({ pressed }) => [s.toolDesig, { borderColor: PERSONA[persona].accent }, pressed && { backgroundColor: color.surface2 }]}>
              <Text style={[s.toolDesigT, { color: PERSONA[persona].accent }]}>⚡  {capHint.label}</Text>
              <Text style={[s.toolDesigArrow, { color: PERSONA[persona].accent }]}>→</Text>
            </Pressable>
          </View>
        )}

        {/* Tool designation — the buddy answered; here's a shortcut into the matching tool. */}
        {toolHint && onOpenTool && msgs.length > 0 && (
          <View style={{ paddingHorizontal: space.md }}>
            <Pressable onPress={() => { const r = toolHint.route; setToolHint(null); onOpenTool(r); }}
              accessibilityRole="button" accessibilityLabel={`Open ${toolHint.title}`}
              style={({ pressed }) => [s.toolDesig, { borderColor: PERSONA[persona].accent }, pressed && { backgroundColor: color.surface2 }]}>
              <Text style={[s.toolDesigT, { color: PERSONA[persona].accent }]}>⬚  {L("Open")} {toolHint.title}</Text>
              <Text style={[s.toolDesigArrow, { color: PERSONA[persona].accent }]}>→</Text>
            </Pressable>
          </View>
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
    </View>
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
  personaBtn: { borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.pill, paddingHorizontal: 13, height: 38, justifyContent: "center" },
  personaT: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  meterWrap: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xs, alignItems: "center" },
  meterDisplay: { width: "100%", maxWidth: 440 },
  heroWrap: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.sm },
  star: { position: "absolute", backgroundColor: "#E8F0FF" },
  greeting: { fontFamily: font.crt, fontSize: 20, color: color.textMuted, textAlign: "center", paddingHorizontal: space.md, textShadowColor: "rgba(255,152,0,0.18)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 0 } },
  greetSentinel: { fontSize: 20, letterSpacing: 1.2, textTransform: "uppercase" },
  greetNova: { fontSize: 21, letterSpacing: 0.5, lineHeight: 26 },
  heroSub: { ...T.small, color: color.textMuted, textAlign: "center", marginBottom: space.md },
  composerHero: { flexDirection: "row", gap: space.sm, alignItems: "center", alignSelf: "stretch", maxWidth: 440, width: "100%", backgroundColor: "#0F141B", borderWidth: 1, borderColor: "#2A333E", borderTopColor: "#3A485A", borderRadius: radius.lg, padding: space.sm, boxShadow: "0 6px 18px rgba(0,0,0,0.35)" },
  chipHint: { fontFamily: font.mono, fontSize: 10.5, letterSpacing: 2, marginTop: space.lg, opacity: 0.9 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.sm, marginTop: space.sm, alignSelf: "stretch", maxWidth: 440, width: "100%" },
  toolGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: space.sm, marginTop: space.sm, alignSelf: "stretch", maxWidth: 440, width: "100%" },
  toolTile: { width: "48%", backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: color.surfaceLine, padding: space.sm },
  toolWell: { width: "100%", height: 54, borderRadius: radius.md, borderWidth: 2, alignItems: "center", justifyContent: "center", backgroundColor: "#0A0E13", overflow: "hidden", marginBottom: space.xs },
  toolLed: { position: "absolute", right: 5, bottom: 5, width: 5, height: 5, borderRadius: 3, opacity: 0.9 },
  toolTitle: { fontFamily: font.bodyBold, fontSize: 13, color: color.text },
  toolDesig: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", backgroundColor: color.surface, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14, height: 38, marginBottom: space.sm },
  toolDesigT: { fontFamily: font.bodyBold, fontSize: 13, letterSpacing: 0.3 },
  toolDesigArrow: { fontSize: 15, fontWeight: "900" },
  chip: { borderWidth: 1.5, borderColor: color.surfaceLine, backgroundColor: "rgba(20,26,34,0.55)", paddingHorizontal: 16, paddingVertical: 11 },
  chipT: { fontSize: 13, fontWeight: "700" },
  sweep: { position: "absolute", left: 0, right: 0, height: 3, zIndex: 20, shadowColor: "#FFFFFF", shadowOpacity: 0.6, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm,
    borderBottomWidth: 1, borderBottomColor: color.surfaceLine,
  },
  sub: { ...T.small, fontFamily: font.mono, color: color.textMuted, marginTop: 4 },
  clearBtn: {
    borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md,
    paddingHorizontal: space.md, height: 44, justifyContent: "center",
  },
  clearT: { color: color.textMuted, fontSize: 13, fontWeight: "700" },

  hud: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm, alignItems: "center" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm, width: "100%", maxWidth: 440, paddingHorizontal: space.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontFamily: font.mono, fontSize: 12.5, letterSpacing: 0.5 },
  meta: { fontFamily: font.mono, fontSize: 10.5, color: color.textFaint, letterSpacing: 0.8, marginLeft: "auto" },
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
    width: HIT, height: HIT, borderRadius: HIT / 2, borderWidth: 2, borderColor: "#B86B07",
    backgroundColor: color.surface2, alignItems: "center", justifyContent: "center",
    boxShadow: glow.amberSoft,
  },
  input: { flex: 1 },
  send: {
    backgroundColor: color.amber, borderRadius: radius.md, paddingHorizontal: space.lg,
    minHeight: HIT, justifyContent: "center", alignItems: "center",
    boxShadow: glow.amberSoft,
  },
  sendT: { color: color.onAmber, fontWeight: "800", fontSize: 15, letterSpacing: 0.3 },
});
