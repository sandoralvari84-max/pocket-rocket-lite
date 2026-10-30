// Meal planner — Tools niche #10. Plan breakfast / lunch / dinner across the week.
// Pure storage on the data layer (the deterministic bit is the day keys), offline.
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, space, radius, accentFor } from "../design/tokens";
import { useSettings } from "../settings";
import { PixelText, Input, IconButton, ToolIntro } from "../design/ui";
import { L, useLang } from "../i18n";
import { createCollection, type Entity } from "../data/store";

type Meal = Entity & { day: string; slot: number; text: string };
export const mealPlan = createCollection<Meal>("meal_plan");

const SLOTS = ["Breakfast", "Lunch", "Dinner"] as const;
const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function MealPlanner({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  useLang();
  const acc = accentFor(useSettings().voice).c;
  const meals = mealPlan.use();
  const [sel, setSel] = useState(0); // 0..6 day offset from today

  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; }), []);
  const day = keyOf(week[sel]);

  const valueFor = (slot: number) => meals.find((m) => m.day === day && m.slot === slot)?.text ?? "";
  const setSlot = (slot: number, text: string) => {
    const existing = meals.find((m) => m.day === day && m.slot === slot);
    if (existing) {
      if (text.trim()) mealPlan.update(existing.id, { text });
      else mealPlan.remove(existing.id);
    } else if (text.trim()) {
      mealPlan.create({ day, slot, text });
    }
  };
  const plannedCount = (d: string) => meals.filter((m) => m.day === d && m.text.trim()).length;

  return (
    <View style={[st.fill, { paddingTop: Math.max(insets.top, 24) }]}>
      <View style={st.head}>
        <IconButton label="Back" glyph="‹" onPress={onBack} />
        <PixelText size="h2" style={{ color: acc, flex: 1, textAlign: "center" }}>{L("MEALS")}</PixelText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.weekRow}>
        {week.map((d, i) => {
          const on = i === sel;
          const n = plannedCount(keyOf(d));
          return (
            <Pressable key={i} onPress={() => setSel(i)} style={[st.dayCol, on && st.dayColOn]}>
              <Text style={[st.dayName, on && { color: color.amber }]}>{i === 0 ? L("Today") : d.toLocaleDateString(undefined, { weekday: "short" })}</Text>
              <Text style={[st.dayNum, on && { color: color.text }]}>{d.getDate()}</Text>
              <View style={st.dots}>{Array.from({ length: 3 }).map((_, k) => <View key={k} style={[st.pdot, k < n && st.pdotOn]} />)}</View>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <ToolIntro
          what={L("Plan breakfast, lunch and dinner for each day of the coming week. Saved on-device.")}
          setup={L("Pick a day along the top, then type into each meal slot — it saves as you type.")}
        />
        {SLOTS.map((slot, i) => (
          <View key={slot} style={st.slotCard}>
            <Text style={st.slotLabel}>{L(slot)}</Text>
            <Input value={valueFor(i)} onChangeText={(t) => setSlot(i, t)} placeholder={L("Plan a meal…")} placeholderTextColor={color.textFaint} style={st.input} multiline />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingBottom: space.sm },
  weekRow: { gap: 8, paddingHorizontal: space.md, paddingBottom: space.sm },
  dayCol: { width: 58, alignItems: "center", paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: color.surfaceLine, backgroundColor: color.surface, gap: 4 },
  dayColOn: { borderColor: color.amber, backgroundColor: color.amberGlowBg },
  dayName: { color: color.textMuted, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  dayNum: { color: color.textMuted, fontSize: 18, fontWeight: "900" },
  dots: { flexDirection: "row", gap: 3 },
  pdot: { width: 5, height: 5, borderRadius: 3, backgroundColor: color.surfaceLine },
  pdotOn: { backgroundColor: color.amber },
  slotCard: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.lg, padding: space.md, marginTop: space.sm },
  slotLabel: { color: color.cyan, fontSize: 12, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 },
  input: { backgroundColor: color.surface2, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, color: color.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, minHeight: 44, textAlignVertical: "top" },
});
