// Measurements — Tools niche #9. Body metrics over time; the change vs the previous
// reading is a deterministic delta, never the model. Offline, data layer.
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, Input, Button, IconButton, ToolIntro } from "../design/ui";
import { L, useLang } from "../i18n";
import { createCollection, type Entity } from "../data/store";

const METRICS = [
  { key: "Weight", unit: "kg" },
  { key: "Waist", unit: "cm" },
  { key: "Body fat", unit: "%" },
] as const;

type Reading = Entity & { kind: string; value: number; day: string };
export const measureLog = createCollection<Reading>("measure_log");

function todayKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function fmtDay(day: string) { const [y, m, d] = day.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short" }); }

export default function Measurements({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  useLang();
  const all = measureLog.use();
  const [metric, setMetric] = useState<string>("Weight");
  const [val, setVal] = useState("");
  const unit = METRICS.find((m) => m.key === metric)!.unit;

  const add = () => {
    const v = parseFloat(val.replace(",", "."));
    if (!isFinite(v) || v <= 0) return;
    measureLog.create({ kind: metric, value: Math.round(v * 10) / 10, day: todayKey() });
    setVal("");
  };

  // Deterministic: newest-first series for the metric + delta vs previous.
  const series = useMemo(() => all.filter((r) => r.kind === metric).sort((a, b) => b.createdAt - a.createdAt), [all, metric]);
  const latest = series[0];
  const prev = series[1];
  const delta = latest && prev ? Math.round((latest.value - prev.value) * 10) / 10 : null;

  return (
    <View style={[st.fill, { paddingTop: Math.max(insets.top, 24) }]}>
      <View style={st.head}>
        <IconButton label="Back" glyph="‹" onPress={onBack} />
        <PixelText size="h2" style={{ color: color.amber, flex: 1, textAlign: "center" }}>{L("MEASURE")}</PixelText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <ToolIntro
          what={L("Track body measurements — weight, waist and body fat — over time, with the change since your last reading worked out for you. Stored on-device.")}
          setup={L("Pick a metric tab, type the value and tap Log. Add a reading whenever you want to update the trend.")}
        />
        <View style={st.tabs}>
          {METRICS.map((m) => (
            <Pressable key={m.key} onPress={() => setMetric(m.key)} style={[st.tab, metric === m.key && st.tabOn]}>
              <Text style={[st.tabT, metric === m.key && { color: color.amber }]}>{L(m.key)}</Text>
            </Pressable>
          ))}
        </View>

        <View style={st.card}>
          {latest ? (
            <>
              <Text style={st.big}>{latest.value}<Text style={st.unit}> {unit}</Text></Text>
              {delta !== null && (
                <Text style={[st.delta, { color: delta === 0 ? color.textMuted : delta < 0 ? color.success : color.danger }]}>
                  {delta > 0 ? "▲ +" : delta < 0 ? "▼ " : "● "}{Math.abs(delta)} {unit} {L("vs previous")}
                </Text>
              )}
            </>
          ) : (
            <Body muted>{L("No readings yet.")}</Body>
          )}
        </View>

        <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm }}>
          <View style={[st.inputBox, { flex: 1 }]}>
            <Input value={val} onChangeText={setVal} placeholder={`0 ${unit}`} placeholderTextColor={color.textFaint} keyboardType="decimal-pad" style={st.input} onSubmitEditing={add} />
            <Text style={st.inUnit}>{unit}</Text>
          </View>
          <Button title={L("Log")} onPress={add} disabled={!val.trim()} />
        </View>

        <Text style={st.sectionH}>{L("HISTORY")}</Text>
        {series.length === 0 ? (
          <Body muted style={{ marginTop: 4 }}>{L("Nothing logged for this metric yet.")}</Body>
        ) : series.map((r) => (
          <View key={r.id} style={st.row}>
            <Text style={st.rDay}>{fmtDay(r.day)}</Text>
            <Text style={st.rVal}>{r.value} {unit}</Text>
            <Pressable onPress={() => measureLog.remove(r.id)} hitSlop={10} style={st.del}><Text style={{ color: color.textFaint, fontSize: 15 }}>✕</Text></Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingBottom: space.sm },
  tabs: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
  tab: { flex: 1, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, paddingVertical: 9, alignItems: "center", backgroundColor: color.surface },
  tabOn: { borderColor: color.amber, backgroundColor: color.amberGlowBg },
  tabT: { color: color.textMuted, fontSize: 13, fontWeight: "800" },
  card: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.lg, padding: space.md, marginTop: space.sm, alignItems: "center" },
  big: { color: color.text, fontSize: 44, fontWeight: "900" },
  unit: { color: color.textMuted, fontSize: 20, fontWeight: "700" },
  delta: { fontSize: 14, fontWeight: "700", marginTop: 4 },
  inputBox: { flexDirection: "row", alignItems: "center", backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, paddingHorizontal: 12 },
  input: { flex: 1, color: color.text, fontSize: 17, fontWeight: "700", paddingVertical: 11, backgroundColor: "transparent", borderWidth: 0 },
  inUnit: { color: color.textMuted, fontSize: 14, fontWeight: "700" },
  sectionH: { color: color.cyan, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: space.lg, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6 },
  rDay: { flex: 1, color: color.textMuted, fontSize: 14 },
  rVal: { color: color.text, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  del: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
});
