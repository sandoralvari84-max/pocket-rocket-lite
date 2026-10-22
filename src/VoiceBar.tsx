import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Easing } from "react-native";

// Animated equalizer bar — pulses while `active`, flat when idle.
export default function VoiceBar({ active }: { active: boolean }) {
  const bars = useRef([...Array(7)].map(() => new Animated.Value(0.2))).current;

  useEffect(() => {
    if (!active) {
      bars.forEach((b) => Animated.timing(b, { toValue: 0.2, duration: 200, useNativeDriver: false }).start());
      return;
    }
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, { toValue: 0.4 + Math.random() * 0.6, duration: 280 + i * 40, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(b, { toValue: 0.2 + Math.random() * 0.3, duration: 260 + i * 40, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active]);

  return (
    <View style={s.row}>
      {bars.map((b, i) => (
        <Animated.View
          key={i}
          style={[s.bar, { height: b.interpolate({ inputRange: [0, 1], outputRange: [8, 120] }), opacity: active ? 1 : 0.4 }]}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: 140, gap: 8 },
  bar: { width: 12, borderRadius: 6, backgroundColor: "#4da3ff" },
});
