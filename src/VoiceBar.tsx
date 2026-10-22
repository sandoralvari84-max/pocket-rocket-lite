import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Easing } from "react-native";

// KITT-style scanner: a horizontal strip of red segments with a bright band sweeping across
// while `active`. Generic sci-fi voice visual (no branded assets). Dim/idle when inactive.
const N = 14;

export default function VoiceBar({ active }: { active: boolean }) {
  const pos = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) { pos.stopAnimation(); Animated.timing(pos, { toValue: 0.5, duration: 300, useNativeDriver: false }).start(); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pos, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(pos, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  return (
    <View style={s.wrap}>
      <View style={s.strip}>
        {[...Array(N)].map((_, i) => {
          const x = i / (N - 1);
          const opacity = pos.interpolate({
            inputRange: [x - 0.22, x, x + 0.22],
            outputRange: [0.12, 1, 0.12],
            extrapolate: "clamp",
          });
          return <Animated.View key={i} style={[s.seg, { opacity: active ? opacity : 0.18 }]} />;
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { height: 140, alignItems: "center", justifyContent: "center", width: "100%" },
  strip: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 22, paddingHorizontal: 18, borderRadius: 16,
    backgroundColor: "#140202", borderWidth: 1, borderColor: "#3a0a0a",
  },
  seg: {
    width: 10, height: 64, borderRadius: 4, backgroundColor: "#ff2a2a",
    shadowColor: "#ff2a2a", shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
});
