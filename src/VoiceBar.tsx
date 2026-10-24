import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Easing, Image } from "react-native";
import { color, radius, space } from "./design/tokens";

// KITT / HAL voice meter — the AI's "face" (no avatar). Two instruments by persona:
//   Sentinel → the segment scanner (amber, a tight bright beam sweeps) — the original.
//   Nova     → a smooth EKG heartbeat in a round scope (cyan), scrolling continuously.
// Persona-aware, reacts to voice, static under reduced motion. Compact.
export type VoiceBarState = "idle" | "listening" | "thinking" | "speaking" | "error";
export type Persona = "sentinel" | "nova";

const EKG = require("../assets/ui/ekg_cyan.png");
const COPY_W = 520; // rendered width of one strip copy (two scroll seamlessly)
const N = 22;

export default function VoiceBar(props: { state: VoiceBarState; persona?: Persona; reducedMotion?: boolean; height?: number }) {
  return props.persona === "nova" ? <EkgBar {...props} /> : <SegmentBar {...props} />;
}

// ---- Nova: smooth EKG heartbeat, round scope, continuous scroll ----
function EkgBar({ state, reducedMotion = false, height = 84 }: { state: VoiceBarState; reducedMotion?: boolean; height?: number }) {
  const scroll = useRef(new Animated.Value(0)).current;
  const amp = useRef(new Animated.Value(0.6)).current;
  const voiceActive = state === "listening" || state === "thinking" || state === "speaking";
  const col = color.cyan;

  useEffect(() => {
    scroll.setValue(0);
    if (reducedMotion) return;
    const dur = voiceActive ? 2600 : 6200;
    const loop = Animated.loop(Animated.timing(scroll, { toValue: 1, duration: dur, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, reducedMotion]);

  useEffect(() => {
    Animated.timing(amp, { toValue: voiceActive ? 1 : 0.6, duration: 340, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const inner = height - 16;
  const translateX = scroll.interpolate({ inputRange: [0, 1], outputRange: [0, -COPY_W] });
  const scaleY = amp.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  const glow = voiceActive && !reducedMotion;

  return (
    <View style={[s.wrap, { height }]}>
      <View style={[s.scope, { borderColor: col + "66", borderRadius: height / 2 }]}>
        <View pointerEvents="none" style={[s.scopeBloom, { backgroundColor: col, opacity: glow ? 0.16 : 0.07 }]} />
        <Animated.View style={{ flexDirection: "row", height: inner, transform: [{ translateX }, { scaleY }] }}>
          <Image source={EKG} resizeMode="stretch" fadeDuration={0} style={{ width: COPY_W, height: inner }} />
          <Image source={EKG} resizeMode="stretch" fadeDuration={0} style={{ width: COPY_W, height: inner }} />
        </Animated.View>
        <View pointerEvents="none" style={s.gloss} />
      </View>
    </View>
  );
}

// ---- Sentinel (and error/default): the original segment scanner ----
function SegmentBar({ state, persona = "sentinel", reducedMotion = false, height = 84 }: { state: VoiceBarState; persona?: Persona; reducedMotion?: boolean; height?: number }) {
  const anim = useRef(new Animated.Value(0.5)).current;
  const col = state === "error" ? color.danger : state === "listening" ? color.cyan : color.amber;
  const idle = state === "idle";
  const bw = 0.12;
  const baseIdle = 0.2;
  const segW = 5, cap = 1, gapW = 3;
  const sweep = state === "listening" || state === "thinking" || idle;
  const voiceActive = state === "listening" || state === "thinking" || state === "speaking";
  const breathe = state === "speaking";
  const animated = !reducedMotion && (sweep || breathe);

  useEffect(() => {
    anim.stopAnimation();
    if (!animated) { Animated.timing(anim, { toValue: 0.5, duration: 220, useNativeDriver: false }).start(); return; }
    const dur = voiceActive ? (sweep ? 600 : 540) : 1400;
    const ease = sweep ? Easing.inOut(Easing.quad) : Easing.inOut(Easing.sin);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: dur, easing: ease, useNativeDriver: false }),
      Animated.timing(anim, { toValue: 0, duration: dur, easing: ease, useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, persona, reducedMotion]);

  const glow = voiceActive && !reducedMotion;
  const segMax = height - 34;

  return (
    <View style={[s.wrap, { height }]}>
      <View style={[s.housing, { borderColor: col + "4D" }]}>
        <View pointerEvents="none" style={[s.bloom, { backgroundColor: col, opacity: glow ? 0.15 : idle ? 0.06 : 0.1 }]} />
        <View style={[s.segs, { gap: gapW }]}>
          {[...Array(N)].map((_, i) => {
            const x = i / (N - 1);
            const hMul = 0.42 + 0.58 * Math.sin(x * Math.PI);
            let opacity: Animated.Value | Animated.AnimatedInterpolation<number> | number;
            let coreOp: Animated.AnimatedInterpolation<number> | number = 0;
            if (!animated) {
              opacity = idle ? baseIdle : 0.55;
            } else if (sweep) {
              opacity = anim.interpolate({ inputRange: [x - bw, x, x + bw], outputRange: [idle ? 0.08 : 0.1, idle ? 0.62 : 1, idle ? 0.08 : 0.1], extrapolate: "clamp" });
              coreOp = anim.interpolate({ inputRange: [x - 0.05, x, x + 0.05], outputRange: [0, idle ? 0.5 : 0.95, 0], extrapolate: "clamp" });
            } else {
              opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [idle ? 0.2 : 0.32, idle ? 0.52 : 1] });
              coreOp = anim.interpolate({ inputRange: [0, 1], outputRange: [0, idle ? 0.25 : 0.7 * hMul] });
            }
            return (
              <View key={i} style={[s.segWrap, { height: segMax, width: segW }]}>
                <Animated.View style={[s.seg, { width: segW, borderRadius: cap, height: segMax * hMul, backgroundColor: col, opacity, shadowColor: col, shadowOpacity: glow ? 0.8 : 0, shadowRadius: glow ? 7 : 0, elevation: glow ? 4 : 0 }]} />
                <Animated.View pointerEvents="none" style={[s.core, { height: segMax * hMul * 0.5, opacity: coreOp }]} />
              </View>
            );
          })}
        </View>
        <View pointerEvents="none" style={s.gloss} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", width: "100%" },
  // Sentinel segment housing
  housing: { width: "100%", maxWidth: 420, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.lg, backgroundColor: "#070A0F", borderWidth: 1, overflow: "hidden" },
  bloom: { position: "absolute", left: "12%", right: "12%", top: "26%", bottom: "26%", borderRadius: 999 },
  segs: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  segWrap: { width: 6, alignItems: "center", justifyContent: "center" },
  seg: { width: 6, borderRadius: 3, shadowOffset: { width: 0, height: 0 } },
  core: { position: "absolute", width: 2, borderRadius: 0, backgroundColor: "#FFFFFF" },
  // Nova EKG scope
  scope: { width: "100%", maxWidth: 420, flex: 1, backgroundColor: "#070A0F", borderWidth: 1, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  scopeBloom: { position: "absolute", left: "6%", right: "6%", top: "22%", bottom: "22%", borderRadius: 999 },
  gloss: { position: "absolute", left: 12, right: 12, top: 6, height: 10, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.05)" },
});
