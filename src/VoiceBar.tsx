import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Easing } from "react-native";
import { color, radius, space } from "./design/tokens";

// KITT-style scanner HUD: a horizontal strip of segments on the dark app bg.
// AMBER is the primary voice color; CYAN marks the technical "listening" (mic capture) state.
// Animates ONLY while an active state runs; idle is calm/static. Honors reducedMotion with a
// static, non-animated indicator. Restrained glow is the only heavy visual, and only when active.
export type VoiceBarState = "idle" | "listening" | "thinking" | "speaking" | "error";

const N = 14;

function stateColor(state: VoiceBarState): string {
  switch (state) {
    case "listening": return color.cyan;   // secondary / technical: capturing input
    case "thinking":  return color.amber;
    case "speaking":  return color.amber;
    case "error":     return color.danger;
    default:          return color.amber;  // idle (dimmed)
  }
}

export default function VoiceBar({ state, reducedMotion = false }: {
  state: VoiceBarState;
  reducedMotion?: boolean;
}) {
  const anim = useRef(new Animated.Value(0.5)).current;

  const sweep = state === "listening" || state === "thinking";
  const pulse = state === "speaking";
  const active = sweep || pulse;
  const col = stateColor(state);

  useEffect(() => {
    anim.stopAnimation();
    if (reducedMotion || !active) {
      // Settle to a steady mid value; nothing loops.
      Animated.timing(anim, { toValue: 0.5, duration: 200, useNativeDriver: false }).start();
      return;
    }
    const dur = sweep ? 850 : 620;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state, reducedMotion]);

  // Static opacity per state when not animating.
  const staticOpacity = state === "idle" ? 0.16 : state === "error" ? 0.55 : 0.5;
  const glow = active && !reducedMotion;

  return (
    <View style={s.wrap}>
      <View style={[s.strip, { borderColor: col + "55" }]}>
        {[...Array(N)].map((_, i) => {
          const x = i / (N - 1);
          let opacity: any;
          if (reducedMotion || !active) {
            opacity = staticOpacity;
          } else if (sweep) {
            // A bright band tracks `anim` across the strip.
            opacity = anim.interpolate({
              inputRange: [x - 0.22, x, x + 0.22],
              outputRange: [0.12, 1, 0.12],
              extrapolate: "clamp",
            });
          } else {
            // Speaking: all segments breathe together (VU-like), distinct from the sweep.
            opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
          }
          return (
            <Animated.View
              key={i}
              style={[
                s.seg,
                {
                  backgroundColor: col,
                  opacity,
                  shadowColor: col,
                  shadowOpacity: glow ? 0.8 : 0,
                  shadowRadius: glow ? 7 : 0,
                  elevation: glow ? 5 : 0,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { height: 108, alignItems: "center", justifyContent: "center", width: "100%" },
  strip: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: space.lg, paddingHorizontal: space.lg, borderRadius: radius.lg,
    backgroundColor: "#0A0E13", borderWidth: 1,
  },
  seg: {
    width: 9, height: 52, borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
});
