import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Easing } from "react-native";
import { color, radius, space } from "./design/tokens";

// KITT / HAL-style voice meter — the AI's "face" (no avatar). A horizontal strip of
// segments that scans/breathes. It is PERSONA-AWARE: Sentinel reads amber and idly
// scans (cold, watchful); Nova reads cyan and idly breathes (warm). It reacts during
// voice (listening = cyan sweep, thinking = scan, speaking = VU breathe) and goes
// fully static under reduced motion. Compact by default — not a half-screen element.
export type VoiceBarState = "idle" | "listening" | "thinking" | "speaking" | "error";
export type Persona = "sentinel" | "nova";

const N = 16;

export default function VoiceBar({ state, persona = "sentinel", reducedMotion = false, height = 84 }: {
  state: VoiceBarState;
  persona?: Persona;
  reducedMotion?: boolean;
  height?: number;
}) {
  const anim = useRef(new Animated.Value(0.5)).current;

  const col = state === "error" ? color.danger
    : state === "listening" ? color.cyan
    : persona === "nova" ? color.cyan : color.amber;

  const idle = state === "idle";
  const sweep = state === "listening" || state === "thinking" || (idle && persona === "sentinel");
  const breathe = state === "speaking" || (idle && persona === "nova");
  const voiceActive = state === "listening" || state === "thinking" || state === "speaking";
  const animated = !reducedMotion && (sweep || breathe);

  useEffect(() => {
    anim.stopAnimation();
    if (!animated) { Animated.timing(anim, { toValue: 0.5, duration: 200, useNativeDriver: false }).start(); return; }
    const dur = voiceActive ? (sweep ? 780 : 560) : 1700; // idle = slow + calm
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      Animated.timing(anim, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, persona, reducedMotion]);

  const glow = voiceActive && !reducedMotion;
  const segMax = height - 38;

  return (
    <View style={[s.wrap, { height }]}>
      <View style={[s.strip, { borderColor: col + "44" }]}>
        {[...Array(N)].map((_, i) => {
          const x = i / (N - 1);
          let opacity: Animated.Value | Animated.AnimatedInterpolation<number> | number;
          if (!animated) {
            opacity = idle ? 0.22 : 0.5;
          } else if (sweep) {
            opacity = anim.interpolate({
              inputRange: [x - 0.2, x, x + 0.2],
              outputRange: [idle ? 0.1 : 0.12, idle ? 0.55 : 1, idle ? 0.1 : 0.12],
              extrapolate: "clamp",
            });
          } else {
            opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [idle ? 0.18 : 0.3, idle ? 0.5 : 1] });
          }
          // a gentle symmetric height curve gives the strip a voice-meter silhouette
          const hMul = 0.55 + 0.45 * Math.sin((i / (N - 1)) * Math.PI);
          return (
            <Animated.View
              key={i}
              style={[s.seg, {
                height: segMax * hMul,
                backgroundColor: col,
                opacity,
                shadowColor: col,
                shadowOpacity: glow ? 0.7 : 0,
                shadowRadius: glow ? 6 : 0,
                elevation: glow ? 4 : 0,
              }]}
            />
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", width: "100%" },
  strip: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.lg,
    backgroundColor: "#0A0E13", borderWidth: 1,
  },
  seg: { width: 7, borderRadius: 3, shadowOffset: { width: 0, height: 0 } },
});
