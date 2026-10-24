// Timer — Tools niche #12. Countdown driven by a target timestamp (drift-free),
// deterministic time math. Haptic buzz at zero (sound is a later pass). Offline.
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Vibration } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, space, radius } from "../design/tokens";
import { PixelText, IconButton } from "../design/ui";
import { L, useLang } from "../i18n";

const PRESETS = [60, 180, 300, 600, 1200]; // seconds
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function Timers({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  useLang();
  const [remaining, setRemaining] = useState(300);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const endRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const r = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setRemaining(r);
      if (r <= 0) { setRunning(false); setDone(true); Vibration.vibrate([0, 400, 150, 400]); }
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  const start = () => { if (remaining <= 0) return; endRef.current = Date.now() + remaining * 1000; setDone(false); setRunning(true); };
  const pause = () => { setRemaining(Math.max(0, Math.round((endRef.current - Date.now()) / 1000))); setRunning(false); };
  const reset = (sec: number) => { setRunning(false); setDone(false); setRemaining(sec); };
  const bump = (delta: number) => { if (running) return; setRemaining((r) => Math.max(0, Math.min(5999, r + delta))); setDone(false); };

  return (
    <View style={[st.fill, { paddingTop: Math.max(insets.top, 24) }]}>
      <View style={st.head}>
        <IconButton label="Back" glyph="‹" onPress={onBack} />
        <PixelText size="h2" style={{ color: color.amber, flex: 1, textAlign: "center" }}>{L("TIMER")}</PixelText>
        <View style={{ width: 44 }} />
      </View>

      <View style={st.center}>
        <View style={[st.dial, done && { borderColor: color.amber }, running && { borderColor: color.cyan }]}>
          <Text style={[st.time, done && { color: color.amber }]}>{fmt(remaining)}</Text>
          <Text style={st.state}>{done ? L("DONE") : running ? L("running") : L("ready")}</Text>
        </View>

        {!running && (
          <View style={st.adjRow}>
            <Pressable onPress={() => bump(-60)} style={st.adj}><Text style={st.adjT}>−1m</Text></Pressable>
            <Pressable onPress={() => bump(-10)} style={st.adj}><Text style={st.adjT}>−10s</Text></Pressable>
            <Pressable onPress={() => bump(10)} style={st.adj}><Text style={st.adjT}>+10s</Text></Pressable>
            <Pressable onPress={() => bump(60)} style={st.adj}><Text style={st.adjT}>+1m</Text></Pressable>
          </View>
        )}

        <View style={st.ctrlRow}>
          {!running ? (
            <Pressable onPress={start} disabled={remaining <= 0} style={[st.ctrl, st.ctrlMain, remaining <= 0 && { opacity: 0.4 }]}>
              <Text style={[st.ctrlT, { color: color.onAmber }]}>▶ {L("Start")}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={pause} style={[st.ctrl, st.ctrlMain]}><Text style={[st.ctrlT, { color: color.onAmber }]}>❚❚ {L("Pause")}</Text></Pressable>
          )}
          <Pressable onPress={() => reset(remaining > 0 || done ? (endRef.current ? remaining : 300) : 300)} style={st.ctrl}>
            <Text style={st.ctrlT}>↺ {L("Reset")}</Text>
          </Pressable>
        </View>

        <View style={st.presets}>
          {PRESETS.map((p) => (
            <Pressable key={p} onPress={() => reset(p)} style={st.preset}>
              <Text style={st.presetT}>{p < 60 ? `${p}s` : `${p / 60}m`}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingBottom: space.sm },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.lg, paddingHorizontal: space.lg },
  dial: { width: 240, height: 240, borderRadius: 120, borderWidth: 4, borderColor: color.surfaceLine, alignItems: "center", justifyContent: "center", backgroundColor: color.surface },
  time: { color: color.text, fontSize: 56, fontWeight: "900", fontVariant: ["tabular-nums"] },
  state: { color: color.textMuted, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginTop: 4 },
  adjRow: { flexDirection: "row", gap: space.sm },
  adj: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: color.surfaceLine, backgroundColor: color.surface2 },
  adjT: { color: color.cyan, fontSize: 13, fontWeight: "800" },
  ctrlRow: { flexDirection: "row", gap: space.sm },
  ctrl: { paddingHorizontal: 22, paddingVertical: 14, borderRadius: radius.md, borderWidth: 1, borderColor: color.surfaceLine, backgroundColor: color.surface },
  ctrlMain: { backgroundColor: color.amber, borderColor: color.amber },
  ctrlT: { color: color.text, fontSize: 15, fontWeight: "800" },
  presets: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.sm },
  preset: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: color.surfaceLine, backgroundColor: color.surface },
  presetT: { color: color.textMuted, fontSize: 13, fontWeight: "700" },
});
