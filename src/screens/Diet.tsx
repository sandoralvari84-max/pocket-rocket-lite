// Diet / nutrition log — Tools niche #2. Calorie + macro totals are DETERMINISTIC
// code over a bundled food reference table (never the model). Today's intake vs a
// goal you set. Persists on the data layer, fully offline.
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, space, radius, accentFor } from "../design/tokens";
import { useSettings } from "../settings";
import { PixelText, Body, Input, Button, IconButton, ToolIntro } from "../design/ui";
import { L, useLang } from "../i18n";
import { createCollection, type Entity } from "../data/store";
import { FOODS, type Food } from "../data/foods";

type Entry = Entity & { name: string; grams: number; kcal: number; p: number; c: number; f: number; day: string };
type Goal = Entity & { kcal: number };
export const dietLog = createCollection<Entry>("diet_log");
export const dietGoal = createCollection<Goal>("diet_goal");

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Diet({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  useLang();
  const acc = accentFor(useSettings().voice).c;
  const entries = dietLog.use();
  const goals = dietGoal.use();
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState<Food | null>(null);
  const [grams, setGrams] = useState(100);

  const goalKcal = goals[0]?.kcal ?? 2000;
  const setGoal = (next: number) => {
    const v = Math.max(800, Math.min(6000, next));
    if (goals[0]) dietGoal.update(goals[0].id, { kcal: v });
    else dietGoal.create({ kcal: v });
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FOODS.slice(0, 8);
    return FOODS.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 10);
  }, [query]);

  const add = () => {
    if (!sel) return;
    const k = (v: number) => Math.round((v * grams) / 100);
    dietLog.create({ name: sel.name, grams, kcal: k(sel.kcal), p: k(sel.p), c: k(sel.c), f: k(sel.f), day: todayKey() });
    setSel(null); setQuery(""); setGrams(100);
  };

  // Deterministic daily totals.
  const today = todayKey();
  const todays = entries.filter((e) => e.day === today);
  const tot = todays.reduce((a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.p, c: a.c + e.c, f: a.f + e.f }), { kcal: 0, p: 0, c: 0, f: 0 });
  const pct = Math.min(100, Math.round((tot.kcal / goalKcal) * 100));
  const over = tot.kcal > goalKcal;

  return (
    <View style={[st.fill, { paddingTop: Math.max(insets.top, 24) }]}>
      <View style={st.head}>
        <IconButton label="Back" glyph="‹" onPress={onBack} />
        <PixelText size="h2" style={{ color: acc, flex: 1, textAlign: "center" }}>{L("DIET")}</PixelText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ToolIntro
          what={L("Logs what you eat from a built-in food table and tallies today's calories and macros against a goal you set. The totals are plain math, not AI guesses.")}
          setup={L("Search a food, set the grams, and tap Log it. Use the − / + buttons by 'goal' to set your daily calorie target.")}
        />
        {/* Today's totals vs goal */}
        <View style={st.card}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
            <Text style={st.kcalBig}>{tot.kcal}<Text style={st.kcalUnit}> / {goalKcal} kcal</Text></Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable onPress={() => setGoal(goalKcal - 50)} hitSlop={8} style={st.gBtn}><Text style={st.gT}>−</Text></Pressable>
              <Text style={st.gLabel}>{L("goal")}</Text>
              <Pressable onPress={() => setGoal(goalKcal + 50)} hitSlop={8} style={st.gBtn}><Text style={st.gT}>+</Text></Pressable>
            </View>
          </View>
          <View style={st.barTrack}><View style={[st.barFill, { width: `${pct}%`, backgroundColor: over ? color.danger : color.amber }]} /></View>
          <Text style={st.macros}>{L("Protein")} {tot.p}g · {L("Carbs")} {tot.c}g · {L("Fat")} {tot.f}g</Text>
        </View>

        {/* Add food */}
        <Input value={query} onChangeText={(t) => { setQuery(t); setSel(null); }} placeholder={L("Search a food…")}
          placeholderTextColor={color.textFaint} style={st.input} />
        {!sel ? (
          <View style={{ marginTop: 6 }}>
            {matches.map((f) => (
              <Pressable key={f.name} onPress={() => setSel(f)} style={st.foodRow}>
                <Text style={st.foodName}>{f.name}</Text>
                <Text style={st.foodKcal}>{f.kcal} {L("kcal/100g")}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={[st.card, { marginTop: 6 }]}>
            <Text style={st.selName}>{sel.name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: 8 }}>
              <Pressable onPress={() => setGrams((g) => Math.max(10, g - 10))} hitSlop={8} style={st.gBtn}><Text style={st.gT}>−</Text></Pressable>
              <Text style={st.grams}>{grams} g</Text>
              <Pressable onPress={() => setGrams((g) => Math.min(2000, g + 10))} hitSlop={8} style={st.gBtn}><Text style={st.gT}>+</Text></Pressable>
              <Text style={st.selKcal}>= {Math.round((sel.kcal * grams) / 100)} kcal</Text>
            </View>
            <View style={{ flexDirection: "row", gap: space.sm, marginTop: 10 }}>
              <Button title={L("Log it")} onPress={add} style={{ flex: 1 }} />
              <Button title={L("Cancel")} variant="tertiary" onPress={() => { setSel(null); setQuery(""); }} />
            </View>
          </View>
        )}

        {/* Today's log */}
        <Text style={st.sectionH}>{L("TODAY")}</Text>
        {todays.length === 0 ? (
          <Body muted style={{ marginTop: 4 }}>{L("Nothing logged yet today.")}</Body>
        ) : (
          todays.map((e) => (
            <View key={e.id} style={st.logRow}>
              <Text style={st.logName}>{e.name} <Text style={st.logGrams}>{e.grams}g</Text></Text>
              <Text style={st.logKcal}>{e.kcal} kcal</Text>
              <Pressable onPress={() => dietLog.remove(e.id)} hitSlop={10} style={st.del}><Text style={{ color: color.textFaint, fontSize: 16 }}>✕</Text></Pressable>
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
  kcalBig: { color: color.text, fontSize: 28, fontWeight: "800" },
  kcalUnit: { color: color.textMuted, fontSize: 14, fontWeight: "600" },
  gBtn: { width: 34, height: 34, borderRadius: radius.md, borderWidth: 1, borderColor: color.surfaceLine, alignItems: "center", justifyContent: "center", backgroundColor: color.surface2 },
  gT: { color: color.amber, fontSize: 18, fontWeight: "800" },
  gLabel: { color: color.textMuted, fontSize: 11, fontWeight: "700" },
  barTrack: { height: 10, borderRadius: 5, backgroundColor: color.surface2, marginTop: 12, overflow: "hidden" },
  barFill: { height: 10, borderRadius: 5 },
  macros: { color: color.textMuted, fontSize: 13, marginTop: 10, fontWeight: "600" },
  input: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, color: color.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginTop: space.md },
  foodRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: color.surfaceLine },
  foodName: { color: color.text, fontSize: 15 },
  foodKcal: { color: color.textMuted, fontSize: 12 },
  selName: { color: color.text, fontSize: 16, fontWeight: "700" },
  grams: { color: color.text, fontSize: 16, fontWeight: "700", minWidth: 56, textAlign: "center" },
  selKcal: { color: color.amber, fontSize: 15, fontWeight: "800", marginLeft: "auto" },
  sectionH: { color: color.cyan, fontSize: 12, fontWeight: "800", letterSpacing: 1, marginTop: space.lg, marginBottom: 6 },
  logRow: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6 },
  logName: { flex: 1, color: color.text, fontSize: 15 },
  logGrams: { color: color.textFaint, fontSize: 13 },
  logKcal: { color: color.amber, fontSize: 14, fontWeight: "700" },
  del: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
});
