import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Easing, Image } from "react-native";
import { color, radius, space } from "./design/tokens";

// KITT / HAL voice meter — the AI's "face" (no avatar), now TWO distinct instruments:
//   Sentinel → an angular 4-point wave in a rectangular scope (amber, sharp, quicker)
//   Nova     → a gentle EKG heartbeat in a round (pill) scope (cyan, soft, slower)
// Each is a seamless tileable strip scrolled continuously (fluid, no stepping). Amplitude
// and scroll speed react to voice state; fully static under reduced motion.
export type VoiceBarState = "idle" | "listening" | "thinking" | "speaking" | "error";
export type Persona = "sentinel" | "nova";

const WAVE = require("../assets/ui/wave4_amber.png");  // Sentinel
const EKG = require("../assets/ui/ekg_cyan.png");      // Nova
const COPY_W = 520; // rendered width of one strip copy (two scroll seamlessly)

export default function VoiceBar({ state, persona = "sentinel", reducedMotion = false, height = 84 }: {
  state: VoiceBarState;
  persona?: Persona;
  reducedMotion?: boolean;
  height?: number;
}) {
  const scroll = useRef(new Animated.Value(0)).current;  // 0..1 continuous scroll
  const amp = useRef(new Animated.Value(0.5)).current;    // waveform amplitude (scaleY)

  const nova = persona === "nova";
  const strip = nova ? EKG : WAVE;
  const col = state === "error" ? color.danger : nova ? color.cyan : color.amber;
  const voiceActive = state === "listening" || state === "thinking" || state === "speaking";
  const round = nova;

  // Continuous horizontal scroll — linear loop, speed by state (Sentinel quicker).
  useEffect(() => {
    scroll.setValue(0);
    if (reducedMotion) return;
    const dur = voiceActive ? (nova ? 2600 : 2000) : (nova ? 6200 : 5000);
    const loop = Animated.loop(Animated.timing(scroll, { toValue: 1, duration: dur, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, state, reducedMotion]);

  // Amplitude: rests low, rises when the voice is active.
  useEffect(() => {
    Animated.timing(amp, { toValue: voiceActive ? 1 : 0.5, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const inner = height - 16;
  const translateX = scroll.interpolate({ inputRange: [0, 1], outputRange: [0, -COPY_W] });
  const scaleY = amp.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  const glow = voiceActive && !reducedMotion;

  return (
    <View style={[s.wrap, { height }]}>
      <View style={[s.scope, { borderColor: col + "66", borderRadius: round ? height / 2 : 7 }]}>
        {/* soft bloom behind the trace */}
        <View pointerEvents="none" style={[s.bloom, { backgroundColor: col, opacity: glow ? 0.16 : 0.07 }]} />
        {/* scrolling waveform: two seamless copies */}
        <Animated.View style={{ flexDirection: "row", height: inner, transform: [{ translateX }, { scaleY }] }}>
          <Image source={strip} resizeMode="stretch" fadeDuration={0} style={{ width: COPY_W, height: inner }} />
          <Image source={strip} resizeMode="stretch" fadeDuration={0} style={{ width: COPY_W, height: inner }} />
        </Animated.View>
        {/* glass gloss across the top */}
        <View pointerEvents="none" style={s.gloss} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", width: "100%" },
  scope: {
    width: "100%", maxWidth: 420, flex: 1,
    backgroundColor: "#070A0F", borderWidth: 1, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
  },
  bloom: { position: "absolute", left: "6%", right: "6%", top: "22%", bottom: "22%", borderRadius: 999 },
  gloss: { position: "absolute", left: 12, right: 12, top: 6, height: 10, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.05)" },
});
