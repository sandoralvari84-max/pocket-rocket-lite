// Calendar / agenda — Tools niche #5. Events + deterministic date grouping (today /
// tomorrow / this week / later). Pure on-device & offline. Reminder NOTIFICATIONS need
// a native rebuild (expo-notifications) and are flagged separately — not in this build.
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, Input, Button, IconButton } from "../design/ui";
import { L, useLang } from "../i18n";
import { createCollection, type Entity } from "../data/store";

type Ev = Entity & { title: string; date: string; time: string };
export const events = createCollection<Ev>("events");

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
const addDays = (base: Date, n: number) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
const fromKey = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };

function groupLabel(dateKey: string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = fromKey(dateKey);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff <= 7) return "This week";
  return "Later";
}

export default function Calendar({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  useLang();
  const all = events.use();
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [pick, setPick] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });

  const add = () => {
    const t = title.trim();
    if (!t) return;
    events.create({ title: t, date: keyOf(pick), time: time.trim() });
    setTitle(""); setTime("");
  };

  const todayKey = keyOf(new Date());
  const upcoming = useMemo(() =>
    all.filter((e) => e.date >= todayKey).sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date < b.date ? -1 : 1)),
    [all, todayKey]);

  // deterministic grouping preserving order
  const groups: { label: string; items: Ev[] }[] = [];
  for (const e of upcoming) {
    const lab = groupLabel(e.date);
    let g = groups.find((x) => x.label === lab);
    if (!g) { g = { label: lab, items: [] }; groups.push(g); }
    g.items.push(e);
  }

  const dateLabel = pick.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

  return (
    <View style={[st.fill, { paddingTop: Math.max(insets.top, 24) }]}>
      <View style={st.head}>
        <IconButton label="Back" glyph="‹" onPress={onBack} />
        <PixelText size="h2" style={{ color: color.amber, flex: 1, textAlign: "center" }}>{L("CALENDAR")}</PixelText>
        <View style={{ width: 44 }} />
      </View>

      <View style={st.composer}>
        <Input value={title} onChangeText={setTitle} placeholder={L("Event…")} placeholderTextColor={color.textFaint} style={st.input} onSubmitEditing={add} />
        <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm, alignItems: "center" }}>
          <Pressable onPress={() => setPick((d) => addDays(d, -1))} hitSlop={8} style={st.dBtn}><Text style={st.dT}>‹</Text></Pressable>
          <View style={st.dateBox}><Text style={st.dateT}>{dateLabel}</Text></View>
          <Pressable onPress={() => setPick((d) => addDays(d, 1))} hitSlop={8} style={st.dBtn}><Text style={st.dT}>›</Text></Pressable>
          <Input value={time} onChangeText={setTime} placeholder={L("time")} placeholderTextColor={color.textFaint} style={[st.input, { width: 86 }]} />
          <Button title={L("Add")} onPress={add} disabled={!title.trim()} />
        </View>
        <View style={st.quickRow}>
          {[0, 1, 7].map((n) => (
            <Pressable key={n} onPress={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setPick(addDays(d, n)); }} style={st.quick}>
              <Text style={st.quickT}>{n === 0 ? L("Today") : n === 1 ? L("Tomorrow") : L("+1 week")}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {upcoming.length === 0 ? (
          <Body muted style={{ textAlign: "center", marginTop: space.xl }}>{L("No upcoming events.")}</Body>
        ) : groups.map((g) => (
          <View key={g.label} style={{ marginTop: space.md }}>
            <Text style={st.groupH}>{L(g.label)}</Text>
            {g.items.map((e) => (
              <View key={e.id} style={st.row}>
                <View style={st.datePill}><Text style={st.datePillT}>{fromKey(e.date).getDate()}</Text><Text style={st.datePillM}>{fromKey(e.date).toLocaleDateString(undefined, { month: "short" })}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={st.evTitle}>{e.title}</Text>
                  {!!e.time && <Text style={st.evTime}>{e.time}</Text>}
                </View>
                <Pressable onPress={() => events.remove(e.id)} hitSlop={10} style={st.del}><Text style={{ color: color.textFaint, fontSize: 15 }}>✕</Text></Pressable>
              </View>
            ))}
          </View>
        ))}
        <Text style={st.note}>{L("Reminders (notifications) are coming in a later update.")}</Text>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingBottom: space.sm },
  composer: { paddingHorizontal: space.md, paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: color.surfaceLine },
  input: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, color: color.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  dBtn: { width: 34, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: color.surfaceLine, alignItems: "center", justifyContent: "center", backgroundColor: color.surface2 },
  dT: { color: color.amber, fontSize: 20, fontWeight: "800" },
  dateBox: { flex: 1, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: color.surfaceLine, alignItems: "center", justifyContent: "center", backgroundColor: color.surface },
  dateT: { color: color.text, fontSize: 14, fontWeight: "700" },
  quickRow: { flexDirection: "row", gap: 6, marginTop: space.sm },
  quick: { paddingHorizontal: 12, height: 30, borderRadius: radius.pill, borderWidth: 1, borderColor: color.surfaceLine, backgroundColor: color.surface2, justifyContent: "center" },
  quickT: { color: color.textMuted, fontSize: 12, fontWeight: "700" },
  groupH: { color: color.cyan, fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 6 },
  datePill: { width: 44, alignItems: "center", backgroundColor: color.surface2, borderRadius: 8, paddingVertical: 4 },
  datePillT: { color: color.amber, fontSize: 18, fontWeight: "900" },
  datePillM: { color: color.textMuted, fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  evTitle: { color: color.text, fontSize: 15, fontWeight: "600" },
  evTime: { color: color.textMuted, fontSize: 13, marginTop: 2 },
  del: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  note: { color: color.textFaint, fontSize: 12, marginTop: space.xl, textAlign: "center" },
});
