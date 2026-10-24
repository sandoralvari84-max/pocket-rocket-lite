// Fitness / workout log — Tools niche #3. Training volume (sets×reps×weight) and
// best-weight progress are DETERMINISTIC code over a bundled exercise list (never
// the model). Persists on the data layer, fully offline.
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, Input, Button, IconButton } from "../design/ui";
import { L, useLang } from "../i18n";
import { createCollection, type Entity } from "../data/store";
import { EXERCISES, type Exercise } from "../data/exercises";

type Entry = Entity & { exercise: string; group: string; sets: number; reps: number; weight: number; day: string };
export const workoutLog = createCollection<Entry>("workout_log");

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Step({ label, value, onDown, onUp }: { label: string; value: string; onDown: () => void; onUp: () => void }) {
  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <Text style={st.stepLabel}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Pressable onPress={onDown} hitSlop={8} style={st.gBtn}><Text style={st.gT}>−</Text></Pressable>
        <Text style={st.stepVal}>{value}</Text>
        <Pressable onPress={onUp} hitSlop={8} style={st.gBtn}><Text style={st.gT}>+</Text></Pressable>
      </View>
    </View>
  );
}

export default function Fitness({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  useLang();
  const entries = workoutLog.use();
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState<Exercise | null>(null);
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [weight, setWeight] = useState(20);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return EXERCISES.slice(0, 8);
    return EXERCISES.filter((e) => e.name.toLowerCase().includes(q) || e.group.toLowerCase().includes(q)).slice(0, 10);
  }, [query]);

  const add = () => {
    if (!sel) return;
    workoutLog.create({ exercise: sel.name, group: sel.group, sets, reps, weight, day: todayKey() });
    setSel(null); setQuery("");
  };

  // Deterministic: today's total volume + best weight for the selected exercise.
  const today = todayKey();
  const todays = entries.filter((e) => e.day === today);
  const volume = todays.reduce((a, e) => a + e.sets * e.reps * e.weight, 0);
  const best = sel ? entries.filter((e) => e.exercise === sel.name).reduce((m, e) => Math.max(m, e.weight), 0) : 0;

  return (
    <View style={[st.fill, { paddingTop: Math.max(insets.top, 24) }]}>
      <View style={st.head}>
        <IconButton label="Back" glyph="‹" onPress={onBack} />
        <PixelText size="h2" style={{ color: color.amber, flex: 1, textAlign: "center" }}>{L("FITNESS")}</PixelText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={st.card}>
          <Text style={st.volBig}>{volume.toLocaleString()}<Text style={st.volUnit}> {L("kg · today's volume")}</Text></Text>
          <Text style={st.volSub}>{todays.length} {L("sets logged")}</Text>
        </View>

        <Input value={query} onChangeText={(t) => { setQuery(t); setSel(null); }} placeholder={L("Search an exercise…")}
          placeholderTextColor={color.textFaint} style={st.input} />
        {!sel ? (
          <View style={{ marginTop: 6 }}>
            {matches.map((e) => (
              <Pressable key={e.name} onPress={() => setSel(e)} style={st.exRow}>
                <Text style={st.exName}>{e.name}</Text>
                <Text style={st.exGroup}>{L(e.group)}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={[st.card, { marginTop: 6 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={st.selName}>{sel.name}</Text>
              {best > 0 && <Text style={st.best}>{L("best")} {best} kg</Text>}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 12 }}>
              <Step label={L("sets")} value={String(sets)} onDown={() => setSets((v) => Math.max(1, v - 1))} onUp={() => setSets((v) => Math.min(20, v + 1))} />
              <Step label={L("reps")} value={String(reps)} onDown={() => setReps((v) => Math.max(1, v - 1))} onUp={() => setReps((v) => Math.min(100, v + 1))} />
              <Step label={L("kg")} value={String(weight)} onDown={() => setWeight((v) => Math.max(0, v - 2.5))} onUp={() => setWeight((v) => v + 2.5)} />
            </View>
            <View style={{ flexDirection: "row", gap: space.sm, marginTop: 12 }}>
              <Button title={L("Log set")} onPress={add} style={{ flex: 1 }} />
              <Button title={L("Cancel")} variant="tertiary" onPress={() => { setSel(null); setQuery(""); }} />
            </View>
          </View>
        )}

        <Text style={st.sectionH}>{L("TODAY")}</Text>
        {todays.length === 0 ? (
          <Body muted style={{ marginTop: 4 }}>{L("No sets logged yet today.")}</Body>
        ) : (
          todays.map((e) => (
            <View key={e.id} style={st.logRow}>
              <Text style={st.logName}>{e.exercise}</Text>
              <Text style={st.logDetail}>{e.sets}×{e.reps} · {e.weight}kg</Text>
              <Pressable onPress={() => workoutLog.remove(e.id)} hitSlop={10} style={st.del}><Text style={{ color: color.textFaint, fontSize: 16 }}>✕</Text></Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingBottom: space.sm },
  card: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.lg, padding: space.md, marginTop: space.sm },
  volBig: { color: color.text, fontSize: 28, fontWeight: "800" },
  volUnit: { color: color.textMuted, fontSize: 13, fontWeight: "600" },
  volSub: { color: color.textMuted, fontSize: 13, marginTop: 4 },
  input: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, color: color.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginTop: space.md },
  exRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: color.surfaceLine },
  exName: { color: color.text, fontSize: 15 },
  exGroup: { color: color.textMuted, fontSize: 12 },
  selName: { color: color.text, fontSize: 16, fontWeight: "700" },
  best: { color: color.cyan, fontSize: 13, fontWeight: "800" },
  stepLabel: { color: color.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  stepVal: { color: color.text, fontSize: 16, fontWeight: "800", minWidth: 44, textAlign: "center" },
  gBtn: { width: 34, height: 34, borderRadius: radius.md, borderWidth: 1, borderColor: color.surfaceLine, alignItems: "center", justifyContent: "center", backgroundColor: color.surface2 },
  gT: { color: color.amber, fontSize: 18, fontWeight: "800" },
  sectionH: { color: color.cyan, fontSize: 12, fontWeight: "800", letterSpacing: 1, marginTop: space.lg, marginBottom: 6 },
  logRow: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6 },
  logName: { flex: 1, color: color.text, fontSize: 15 },
  logDetail: { color: color.amber, fontSize: 14, fontWeight: "700" },
  del: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
});
