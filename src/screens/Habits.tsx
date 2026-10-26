// Habits / streaks — Tools niche #6. Streak counts are DETERMINISTIC date math over
// the check-in log, never the model. Mark a habit done today; the streak counts
// consecutive days. Persists on the data layer, offline.
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, Input, Button, IconButton, ToolIntro } from "../design/ui";
import { L, useLang } from "../i18n";
import { createCollection, type Entity } from "../data/store";

type Habit = Entity & { name: string };
type Log = Entity & { habitId: string; day: string };
export const habits = createCollection<Habit>("habits");
export const habitLog = createCollection<Log>("habit_log");

const keyOf = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
function todayKey() { return keyOf(new Date()); }

// Consecutive-day streak ending today (or yesterday if today isn't done yet).
function streakOf(days: Set<string>): number {
  const d = new Date();
  if (!days.has(keyOf(d))) { d.setDate(d.getDate() - 1); if (!days.has(keyOf(d))) return 0; }
  let n = 0;
  while (days.has(keyOf(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export default function Habits({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  useLang();
  const list = habits.use();
  const logs = habitLog.use();
  const [name, setName] = useState("");

  const today = todayKey();
  const byHabit = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    for (const l of logs) (m[l.habitId] ||= new Set()).add(l.day);
    return m;
  }, [logs]);

  const addHabit = () => { const n = name.trim(); if (!n) return; habits.create({ name: n }); setName(""); };
  const toggleToday = (habitId: string) => {
    const existing = logs.find((l) => l.habitId === habitId && l.day === today);
    if (existing) habitLog.remove(existing.id);
    else habitLog.create({ habitId, day: today });
  };

  return (
    <View style={[st.fill, { paddingTop: Math.max(insets.top, 24) }]}>
      <View style={st.head}>
        <IconButton label="Back" glyph="‹" onPress={onBack} />
        <PixelText size="h2" style={{ color: color.amber, flex: 1, textAlign: "center" }}>{L("HABITS")}</PixelText>
        <View style={{ width: 44 }} />
      </View>

      <View style={st.composer}>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Input value={name} onChangeText={setName} placeholder={L("New habit…")} placeholderTextColor={color.textFaint}
            style={[st.input, { flex: 1 }]} onSubmitEditing={addHabit} returnKeyType="done" />
          <Button title={L("Add")} onPress={addHabit} disabled={!name.trim()} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <ToolIntro
          what={L("Track daily habits and build streaks. Each habit counts your consecutive days of check-ins using plain date math.")}
          setup={L("Type a habit name and tap Add, then tap the circle each day you do it.")}
        />
        {list.length === 0 ? (
          <Body muted style={{ textAlign: "center", marginTop: space.xl }}>{L("Add a habit to start a streak.")}</Body>
        ) : (
          list.map((h) => {
            const days = byHabit[h.id] ?? new Set<string>();
            const done = days.has(today);
            const streak = streakOf(days);
            return (
              <View key={h.id} style={st.row}>
                <Pressable onPress={() => toggleToday(h.id)} style={[st.check, done && { backgroundColor: color.success, borderColor: color.success }]}>
                  {done && <Text style={st.checkMark}>✓</Text>}
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={st.name}>{h.name}</Text>
                  <Text style={st.streak}>{streak > 0 ? `🔥 ${streak} ${L("day streak")}` : L("not started")}</Text>
                </View>
                <Pressable onPress={() => { habits.remove(h.id); days.forEach(() => {}); logs.filter((l) => l.habitId === h.id).forEach((l) => habitLog.remove(l.id)); }} hitSlop={10} style={st.del}>
                  <Text style={{ color: color.textFaint, fontSize: 16 }}>✕</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingBottom: space.sm },
  composer: { paddingHorizontal: space.md, paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: color.surfaceLine },
  input: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, color: color.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, marginTop: space.sm },
  check: { width: 30, height: 30, borderRadius: 8, borderWidth: 2, borderColor: color.surfaceLine, alignItems: "center", justifyContent: "center" },
  checkMark: { color: "#06210F", fontSize: 16, fontWeight: "900" },
  name: { color: color.text, fontSize: 16, fontWeight: "600" },
  streak: { color: color.textMuted, fontSize: 13, marginTop: 2 },
  del: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
});
