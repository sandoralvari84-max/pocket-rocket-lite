import React from "react";
import { View, Animated, StyleSheet, Easing, Image } from "react-native";
import { color } from "./design/tokens";

// The companion's "face" — no avatar, a living voice instrument. Three seamless wave
// strips scroll at different speeds (parallax depth) behind the CRT glass; the motion
// carries the feeling, not a static picture:
//   idle      → slow, low, breathing    (calm, waiting)
//   listening → lifts and steadies       (leaning in, hearing you)
//   thinking  → quick flutter            (working)
//   speaking  → full surge + talk-pulse  (alive, talking)
//   error     → flat, red, slow          (stalled)
// Two personalities share one engine, distinct waveform + palette + tempo:
//   Sentinel → crisp oscilloscope, amber, a touch faster (the analyst)
//   Nova     → soft flowing swell, cyan, slower + deeper breath (the companion)
// Everything animates on the native thread (translateX / scaleY / opacity) so it stays
// smooth on low-end phones. Hue shifts with the task; tintColor recolours one white asset.
export type VoiceBarState = "idle" | "listening" | "thinking" | "speaking" | "error";
export type Persona = "sentinel" | "nova";

const SCOPE_BG = require("../assets/ui/scope_bg.png");
const DEPTH = require("../assets/ui/wv_depth.png");
const MAIN: Record<Persona, any> = {
  sentinel: require("../assets/ui/wv_main_sentinel.png"),
  nova: require("../assets/ui/wv_main_nova.png"),
};
const CORE: Record<Persona, any> = {
  sentinel: require("../assets/ui/wv_core_sentinel.png"),
  nova: require("../assets/ui/wv_core_nova.png"),
};

const COPY_W = 560; // rendered width of one strip copy (two scroll seamlessly)

const PALETTE: Record<Persona, { base: string; tempo: number }> = {
  sentinel: { base: color.amber, tempo: 0.82 }, // amber, a little quicker
  nova: { base: color.cyan, tempo: 1.12 }, //       cyan, calmer / slower
};

// The dominant hue reads the task at a glance.
function stateColor(persona: Persona, state: VoiceBarState): string {
  switch (state) {
    case "error": return "#FF5A5A";
    case "listening": return "#2BD4FF"; // bright cyan — "I hear you"
    case "thinking": return "#B98CF0"; //  violet — "working"
    case "speaking": return persona === "sentinel" ? "#FFC14D" : "#38E6FF"; // gold / bright cyan
    default: return PALETTE[persona].base; // idle — persona's own colour
  }
}

// Scroll speed (ms per cycle), amplitude breathe range, and glow strength per state.
function profile(state: VoiceBarState) {
  switch (state) {
    case "listening": return { scroll: 3600, amp: [0.72, 0.98] as const, ampDur: 1300 };
    case "thinking": return { scroll: 2300, amp: [0.50, 1.06] as const, ampDur: 440 };
    case "speaking": return { scroll: 2800, amp: [0.56, 1.20] as const, ampDur: 370 }; // full surge
    case "error": return { scroll: 8200, amp: [0.40, 0.46] as const, ampDur: 1300 };
    default: return { scroll: 6000, amp: [0.50, 0.72] as const, ampDur: 2400 }; // idle
  }
}

export default function VoiceBar({ state, persona = "sentinel", reducedMotion = false, height = 84 }:
  { state: VoiceBarState; persona?: Persona; reducedMotion?: boolean; height?: number }) {
  const scroll = React.useRef(new Animated.Value(0)).current;  // main + core (shared → aligned)
  const dscroll = React.useRef(new Animated.Value(0)).current; // depth layer (parallax, slower)
  const amp = React.useRef(new Animated.Value(0.6)).current;   // live amplitude (scaleY)

  const pal = PALETTE[persona];
  const prof = profile(state);
  const col = stateColor(persona, state);

  // Horizontal scroll — two continuous native loops at different speeds for depth.
  React.useEffect(() => {
    scroll.setValue(0); dscroll.setValue(0);
    if (reducedMotion) return;
    const main = Animated.loop(Animated.timing(scroll, { toValue: 1, duration: prof.scroll * pal.tempo, easing: Easing.linear, useNativeDriver: true }));
    const deep = Animated.loop(Animated.timing(dscroll, { toValue: 1, duration: prof.scroll * pal.tempo * 1.9, easing: Easing.linear, useNativeDriver: true }));
    main.start(); deep.start();
    return () => { main.stop(); deep.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, persona, reducedMotion]);

  // Amplitude — the breath/pulse. Its range + speed is the emotion of each state.
  React.useEffect(() => {
    const [lo, hi] = prof.amp;
    if (reducedMotion) { amp.setValue((lo + hi) / 2); return; }
    amp.setValue(lo);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(amp, { toValue: hi, duration: prof.ampDur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(amp, { toValue: lo, duration: prof.ampDur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, reducedMotion]);

  const inner = height - 14;
  const tx = scroll.interpolate({ inputRange: [0, 1], outputRange: [0, -COPY_W] });
  const dtx = dscroll.interpolate({ inputRange: [0, 1], outputRange: [0, -COPY_W] });
  const depthScale = amp.interpolate({ inputRange: [0.4, 1.08], outputRange: [0.92, 1.06] });
  // Reactive light tied to the live amplitude: a wave-hugging glow that pulses with the
  // breath, and a core that blazes brighter at the peaks → the screen feels alive.
  const glowOpacity = amp.interpolate({ inputRange: [0.4, 1.2], outputRange: [0.04, 0.14], extrapolate: "clamp" });
  const coreOpacity = amp.interpolate({ inputRange: [0.4, 1.2], outputRange: [0.6, 0.98], extrapolate: "clamp" });

  return (
    <View style={[s.wrap, { height }]}>
      <View style={[s.scope, { borderColor: col + "40" }]}>
        <Image source={SCOPE_BG} resizeMode="stretch" fadeDuration={0} style={StyleSheet.absoluteFill} />
        <Animated.View pointerEvents="none" style={[s.glow, { backgroundColor: col, opacity: glowOpacity }]} />
        <WaveLayer img={DEPTH} tint={pal.base} opacity={0.34} tx={dtx} scaleY={depthScale} inner={inner} />
        <WaveLayer img={MAIN[persona]} tint={col} opacity={0.97} tx={tx} scaleY={amp} inner={inner} />
        <WaveLayer img={CORE[persona]} tint="#EAF6FF" opacity={coreOpacity} tx={tx} scaleY={amp} inner={inner} />
        <View pointerEvents="none" style={s.gloss} />
      </View>
    </View>
  );
}

// One scrolling strip = two copies LEFT-ALIGNED (never centered) so the loop is truly
// seamless: translateX runs 0 → -COPY_W and resets; with copies at [0..W] and [W..2W]
// the visible scope ([t .. t+scopeWidth], scopeWidth ≤ COPY_W) is always fully covered —
// no empty gap sweeping across. Vertically centered; scaleY = live amplitude.
function WaveLayer({ img, tint, opacity, tx, scaleY, inner }:
  { img: any; tint: string; opacity: any; tx: any; scaleY: any; inner: number }) {
  return (
    <Animated.View pointerEvents="none"
      style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: COPY_W * 2, justifyContent: "center", opacity, transform: [{ translateX: tx }, { scaleY }] }}>
      <View style={{ width: COPY_W * 2, height: inner }}>
        <Image source={img} resizeMode="stretch" fadeDuration={0} style={{ position: "absolute", left: 0, width: COPY_W + 1, height: inner, tintColor: tint }} />
        <Image source={img} resizeMode="stretch" fadeDuration={0} style={{ position: "absolute", left: COPY_W, width: COPY_W + 1, height: inner, tintColor: tint }} />
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", width: "100%" },
  // Rounded-rect monitor (radius 12), near-black screen, hairline border — the mockup look.
  scope: { width: "100%", maxWidth: 420, flex: 1, backgroundColor: "#090D11", borderWidth: 1, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  // Reactive wave-hugging glow — a thin central phosphor halo, NOT a solid pill.
  glow: { position: "absolute", left: "7%", right: "7%", top: "32%", bottom: "32%", borderRadius: 999 },
  gloss: { position: "absolute", left: 12, right: 12, top: 6, height: 10, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.05)" },
});
