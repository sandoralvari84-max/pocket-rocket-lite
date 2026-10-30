// Converter — Tools niche #13. Unit conversion is DETERMINISTIC math over exact
// factors (temperature handled with its offsets), never the model. Fully offline.
// Currency (Money) uses live FX via Open ER-API (keyless), fetched once and cached to disk for offline reuse.
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, space, radius, accentFor } from "../design/tokens";
import { useSettings } from "../settings";
import { PixelText, Input, IconButton, ToolIntro } from "../design/ui";
import { L, useLang } from "../i18n";
import { getRates, fxConvert, CURRENCIES, type FxData } from "../data/fx";

// factors are "how many base units in 1 of this unit" (base: m / kg / L).
const CATS: Record<string, { units: Record<string, number> }> = {
  Length: { units: { m: 1, km: 1000, cm: 0.01, mi: 1609.344, ft: 0.3048, in: 0.0254 } },
  Weight: { units: { kg: 1, g: 0.001, lb: 0.453592, oz: 0.0283495 } },
  Volume: { units: { L: 1, ml: 0.001, gal: 3.78541, cup: 0.236588 } },
};
const CAT_KEYS = ["Length", "Weight", "Volume", "Temp", "Money"] as const;
const TEMP_UNITS = ["C", "F", "K"] as const;

function toC(v: number, from: string) { return from === "C" ? v : from === "F" ? (v - 32) * 5 / 9 : v - 273.15; }
function fromC(c: number, to: string) { return to === "C" ? c : to === "F" ? c * 9 / 5 + 32 : c + 273.15; }

function convert(cat: string, from: string, to: string, v: number): number {
  if (cat === "Temp") return fromC(toC(v, from), to);
  const u = CATS[cat].units;
  return (v * u[from]) / u[to];
}

const round = (n: number) => {
  if (!isFinite(n)) return "—";
  const a = Math.abs(n);
  const d = a >= 100 ? 2 : a >= 1 ? 3 : 5;
  return parseFloat(n.toFixed(d)).toString();
};

export default function Converter({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  useLang();
  const acc = accentFor(useSettings().voice).c;
  const [cat, setCat] = useState<string>("Length");
  const [from, setFrom] = useState("m");
  const [to, setTo] = useState("ft");
  const [val, setVal] = useState("1");
  const [fx, setFx] = useState<FxData | null>(null);
  const [fxState, setFxState] = useState<"idle" | "loading" | "ok" | "offline">("idle");

  // Load live FX rates the first time Money is opened; cached to disk for offline reuse.
  useEffect(() => {
    if (cat !== "Money" || fx) return;
    let alive = true;
    setFxState("loading");
    getRates().then((d) => {
      if (!alive) return;
      if (d) { setFx(d); setFxState("ok"); } else { setFxState("offline"); }
    });
    return () => { alive = false; };
  }, [cat, fx]);

  const units = cat === "Temp" ? [...TEMP_UNITS] : cat === "Money" ? [...CURRENCIES] : Object.keys(CATS[cat].units);
  const switchCat = (c: string) => {
    setCat(c);
    const us = c === "Temp" ? TEMP_UNITS : c === "Money" ? CURRENCIES : Object.keys(CATS[c].units);
    setFrom(us[0]); setTo(us[1] ?? us[0]);
  };

  const result = useMemo(() => {
    const v = parseFloat(val.replace(",", "."));
    if (!isFinite(v)) return "—";
    if (cat === "Money") return fx ? round(fxConvert(fx.rates, from, to, v)) : "—";
    return round(convert(cat, from, to, v));
  }, [cat, from, to, val, fx]);

  const UnitRow = ({ sel, onPick }: { sel: string; onPick: (u: string) => void }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {units.map((u) => (
        <Pressable key={u} onPress={() => onPick(u)} style={[st.unit, sel === u && st.unitOn]}>
          <Text style={[st.unitT, sel === u && { color: color.amber }]}>{u}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  return (
    <View style={[st.fill, { paddingTop: Math.max(insets.top, 24) }]}>
      <View style={st.head}>
        <IconButton label="Back" glyph="‹" onPress={onBack} />
        <PixelText size="h2" style={{ color: acc, flex: 1, textAlign: "center" }}>{L("CONVERT")}</PixelText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <ToolIntro
          what={L("Convert length, weight, volume, temperature and currency. Units use exact offline factors; currency uses live rates, cached on your phone for offline use.")}
          setup={L("Choose a category, type a value, and pick the From and To units. Tap ⇅ to swap them.")}
        />
        <View style={st.tabs}>
          {CAT_KEYS.map((c) => (
            <Pressable key={c} onPress={() => switchCat(c)} style={[st.tab, cat === c && st.tabOn]}>
              <Text style={[st.tabT, cat === c && { color: color.amber }]}>{L(c)}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[st.card, { marginTop: space.md }]}>
          <Text style={st.lbl}>{L("From")}</Text>
          <Input value={val} onChangeText={setVal} keyboardType="numbers-and-punctuation" style={st.valInput} placeholder="0" placeholderTextColor={color.textFaint} />
          <View style={{ marginTop: 8 }}><UnitRow sel={from} onPick={setFrom} /></View>
        </View>

        <View style={st.swapWrap}>
          <Pressable onPress={() => { setFrom(to); setTo(from); }} style={st.swap}><Text style={st.swapT}>⇅</Text></Pressable>
        </View>

        <View style={st.card}>
          <Text style={st.lbl}>{L("To")}</Text>
          <Text style={st.result}>{result}</Text>
          <View style={{ marginTop: 8 }}><UnitRow sel={to} onPick={setTo} /></View>
        </View>

        <Text style={st.note}>
          {cat === "Money"
            ? fxState === "loading" ? L("Fetching today's exchange rates…")
            : !fx ? L("No rates yet — connect to the internet once to fetch them, then it works offline.")
            : `${L("Rates as of")} ${new Date(fx.asOf).toLocaleDateString()} · ${L("cached offline")}`
            : L("Exact unit math, offline.")}
        </Text>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingBottom: space.sm },
  tabs: { flexDirection: "row", gap: 6, marginTop: space.sm },
  tab: { flex: 1, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, paddingVertical: 9, alignItems: "center", backgroundColor: color.surface },
  tabOn: { borderColor: color.amber, backgroundColor: color.amberGlowBg },
  tabT: { color: color.textMuted, fontSize: 13, fontWeight: "800" },
  card: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.lg, padding: space.md },
  lbl: { color: color.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 },
  valInput: { color: color.text, fontSize: 30, fontWeight: "800", backgroundColor: "transparent", borderWidth: 0, paddingVertical: 2, fontVariant: ["tabular-nums"] },
  result: { color: color.amber, fontSize: 30, fontWeight: "900", fontVariant: ["tabular-nums"] },
  swapWrap: { alignItems: "center", marginVertical: -8, zIndex: 2 },
  swap: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: color.surfaceLine, backgroundColor: color.surface2, alignItems: "center", justifyContent: "center" },
  swapT: { color: color.cyan, fontSize: 20, fontWeight: "800" },
  unit: { paddingHorizontal: 14, height: 34, borderRadius: radius.pill, borderWidth: 1, borderColor: color.surfaceLine, backgroundColor: color.surface2, alignItems: "center", justifyContent: "center" },
  unitOn: { borderColor: color.amber, backgroundColor: color.amberGlowBg },
  unitT: { color: color.textMuted, fontSize: 14, fontWeight: "800" },
  note: { color: color.textFaint, fontSize: 12, marginTop: space.lg, textAlign: "center" },
});
