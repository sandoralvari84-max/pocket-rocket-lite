// Travel / Routes — save frequent trips and open them in Google Maps with one tap.
// Routes are stored on-device; tapping launches Maps directions in the chosen mode
// (transit shows buses + live times from Maps). No API key, no account.
import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, Input, Button, IconButton } from "../design/ui";
import { L, useLang } from "../i18n";
import { createCollection, type Entity } from "../data/store";

const MODES = [
  { key: "transit", label: "Bus / train", glyph: "🚌" },
  { key: "driving", label: "Drive", glyph: "🚗" },
  { key: "walking", label: "Walk", glyph: "🚶" },
  { key: "bicycling", label: "Cycle", glyph: "🚲" },
] as const;
type Mode = typeof MODES[number]["key"];

type Route = Entity & { label: string; from: string; to: string; mode: Mode };
export const travelRoutes = createCollection<Route>("travel_routes");

function openMaps(r: Route) {
  const q = (s: string) => encodeURIComponent(s.trim());
  const origin = r.from.trim() ? `&origin=${q(r.from)}` : ""; // empty = Maps uses current location
  const url = `https://www.google.com/maps/dir/?api=1${origin}&destination=${q(r.to)}&travelmode=${r.mode}`;
  Linking.openURL(url).catch(() => {});
}

export default function TravelRoutes({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  useLang();
  const routes = travelRoutes.use();
  const [label, setLabel] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [mode, setMode] = useState<Mode>("transit");

  const add = () => {
    const t = to.trim();
    if (!t) return;
    travelRoutes.create({ label: label.trim() || t, from: from.trim(), to: t, mode });
    setLabel(""); setFrom(""); setTo("");
  };
  const glyphFor = (m: Mode) => MODES.find((x) => x.key === m)!.glyph;

  return (
    <View style={[st.fill, { paddingTop: Math.max(insets.top, 24) }]}>
      <View style={st.head}>
        <IconButton label="Back" glyph="‹" onPress={onBack} />
        <PixelText size="h2" style={{ color: color.cyan, flex: 1, textAlign: "center" }}>{L("TRAVEL")}</PixelText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={st.card}>
          <Input value={label} onChangeText={setLabel} placeholder={L("Name (e.g. To work)")} placeholderTextColor={color.textFaint} style={st.input} />
          <Input value={from} onChangeText={setFrom} placeholder={L("From (blank = my location)")} placeholderTextColor={color.textFaint} style={[st.input, { marginTop: space.sm }]} />
          <Input value={to} onChangeText={setTo} placeholder={L("To (address or place)")} placeholderTextColor={color.textFaint} style={[st.input, { marginTop: space.sm }]} onSubmitEditing={add} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 10 }}>
            {MODES.map((m) => (
              <Pressable key={m.key} onPress={() => setMode(m.key)} style={[st.modePill, mode === m.key && { borderColor: color.cyan, backgroundColor: color.cyanGlowBg }]}>
                <Text style={[st.modeT, mode === m.key && { color: color.cyan }]}>{m.glyph} {L(m.label)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Button title={L("Save route")} onPress={add} disabled={!to.trim()} full style={{ marginTop: space.md }} />
        </View>

        <Text style={st.sectionH}>{L("MY ROUTES")}</Text>
        {routes.length === 0 ? (
          <Body muted style={{ marginTop: 4 }}>{L("Save a frequent trip — one tap opens it in Maps.")}</Body>
        ) : routes.map((r) => (
          <View key={r.id} style={st.row}>
            <Text style={st.rGlyph}>{glyphFor(r.mode)}</Text>
            <Pressable style={{ flex: 1 }} onPress={() => openMaps(r)}>
              <Text style={st.rLabel}>{r.label}</Text>
              <Text style={st.rSub} numberOfLines={1}>{r.from ? `${r.from} → ` : ""}{r.to}</Text>
            </Pressable>
            <Pressable onPress={() => openMaps(r)} style={st.go}><Text style={st.goT}>{L("Go")}</Text></Pressable>
            <Pressable onPress={() => travelRoutes.remove(r.id)} hitSlop={8} style={st.del}><Text style={{ color: color.textFaint, fontSize: 15 }}>✕</Text></Pressable>
          </View>
        ))}
        <Text style={st.note}>{L("Transit mode shows live buses & times from Maps.")}</Text>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingBottom: space.sm },
  card: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.lg, padding: space.md, marginTop: space.sm },
  input: { backgroundColor: color.surface2, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, color: color.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  modePill: { borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.pill, paddingHorizontal: 12, height: 34, justifyContent: "center" },
  modeT: { color: color.textMuted, fontSize: 13, fontWeight: "700" },
  sectionH: { color: color.amber, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: space.lg, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 6 },
  rGlyph: { fontSize: 22 },
  rLabel: { color: color.text, fontSize: 15, fontWeight: "700" },
  rSub: { color: color.textMuted, fontSize: 13, marginTop: 1 },
  go: { backgroundColor: color.cyan, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 8 },
  goT: { color: color.onAmber, fontSize: 13, fontWeight: "800" },
  del: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  note: { color: color.textFaint, fontSize: 12, marginTop: space.lg, textAlign: "center" },
});
