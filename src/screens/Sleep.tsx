// Sleep log — Tools niche #8. Nightly hours; the 7-night average is a deterministic
// mean over the log, never the model. One entry per night (re-logging updates it).
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, Button, IconButton } from "../design/ui";
import { L, useLang } from "../i18n";
import { createCollection, type Entity } from "../data/store";

type Night = Entity & { day: string; hours: number };
export const sleepLog = createCollection<Night>("sleep_log");

function dayKey(offset = 0) { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function label(day: string) {
  if (day === dayKey(0)) return "Today";
  if (day === dayKey(-1)) return "Yesterday";
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export default function Sleep({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  useLang();
  const nights = sleepLog.use();
  const [hours, setHours] = useState(8);

  const log = (forDay: string) => {
    const existing = nights.find((n) => n.day === forDay);
    if (existing) sleepLog.update(existing.id, { hours });
    else sleepLog.create({ day: forDay, hours });
  };

  // Deterministic: last 7 nights + their mean.
  const sorted = useMemo(() => [...nights].sort((a, b) => (a.day < b.day ? 1 : -1)), [nights]);
  const recent = sorted.slice(0, 7);
  const avg = recent.length ? recent.reduce((a, n) => a + n.hours, 0) / recent.length : 0;

  return (
    <View style={[st.fill, { paddingTop: Math.max(insets.top, 24) }]}>
      <View style={st.head}>
        <IconButton label="Back" glyph="‹" onPress={onBack} />
        <PixelText size="h2" style={{ color: color.cyan, flex: 1, textAlign: "center" }}>{L("SLEEP")}</PixelText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <View style={st.card}>
          <Text style={st.avgBig}>{avg ? avg.toFixed(1) : "—"}<Text style={st.avgUnit}> h {L("avg")}</Text></Text>
          <Text style={st.avgSub}>{L("over the last")} {recent.length} {L("nights")}</Text>
        </View>

        <View style={[st.card, { marginTop: space.sm, alignItems: "center" }]}>
          <Text style={st.hoursLabel}>{L("Hours slept")}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg, marginTop: 8 }}>
            <Pressable onPress={() => setHours((h) => Math.max(0, h - 0.25))} hitSlop={8} style={st.gBtn}><Text style={st.gT}>−</Text></Pressable>
            <Text style={st.hoursVal}>{hours.toFixed(2)}</Text>
            <Pressable onPress={() => setHours((h) => Math.min(14, h + 0.25))} hitSlop={8} style={st.gBtn}><Text style={st.gT}>+</Text></Pressable>
          </View>
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: 14, alignSelf: "stretch" }}>
            <Button title={L("Last night")} onPress={() => log(dayKey(0))} style={{ flex: 1 }} />
            <Button title={L("Night before")} variant="secondary" onPress={() => log(dayKey(-1))} style={{ flex: 1 }} />
          </View>
        </View>

        <Text style={st.sectionH}>{L("RECENT NIGHTS")}</Text>
        {recent.length === 0 ? (
          <Body muted style={{ marginTop: 4 }}>{L("No nights logged yet.")}</Body>
        ) : recent.map((n) => (
          <View key={n.id} style={st.row}>
            <Text style={st.day}>{L(label(n.day))}</Text>
            <View style={st.bar}><View style={[st.barFill, { width: `${Math.min(100, (n.hours / 10) * 100)}%` }]} /></View>
            <Text style={st.hrs}>{n.hours.toFixed(2)} h</Text>
            <Pressable onPress={() => sleepLog.remove(n.id)} hitSlop={10} style={st.del}><Text style={{ color: color.textFaint, fontSize: 15 }}>✕</Text></Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingBottom: space.sm },
  card: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.lg, padding: space.md, marginTop: space.sm },
  avgBig: { color: color.cyan, fontSize: 40, fontWeight: "900" },
  avgUnit: { color: color.textMuted, fontSize: 18, fontWeight: "700" },
  avgSub: { color: color.textMuted, fontSize: 13, marginTop: 2 },
  hoursLabel: { color: color.textMuted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  hoursVal: { color: color.text, fontSize: 34, fontWeight: "800", minWidth: 110, textAlign: "center", fontVariant: ["tabular-nums"] },
  gBtn: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: color.surfaceLine, alignItems: "center", justifyContent: "center", backgroundColor: color.surface2 },
  gT: { color: color.cyan, fontSize: 20, fontWeight: "800" },
  sectionH: { color: color.amber, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: space.lg, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6 },
  day: { color: color.text, fontSize: 13, width: 92 },
  bar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: color.surface2, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4, backgroundColor: color.cyan },
  hrs: { color: color.textMuted, fontSize: 13, fontWeight: "700", width: 54, textAlign: "right", fontVariant: ["tabular-nums"] },
  del: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
});
