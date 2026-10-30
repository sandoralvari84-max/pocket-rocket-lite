// Grocery / shopping list — Tools niche #1. Deterministic: item counts and
// per-category grouping are plain code (never the model). Persists on the shared
// data layer; fully offline; owner edits/clears everything.
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, space, radius, accentFor } from "../design/tokens";
import { useSettings } from "../settings";
import { PixelText, Body, Input, Button, IconButton, ToolIntro } from "../design/ui";
import { L, useLang } from "../i18n";
import { createCollection, type Entity } from "../data/store";

const CATEGORIES = ["Produce", "Dairy", "Meat", "Bakery", "Frozen", "Pantry", "Household", "Other"] as const;
type Category = typeof CATEGORIES[number];

type Item = Entity & { name: string; qty: number; category: Category; done: boolean };
export const grocery = createCollection<Item>("grocery");

export default function Grocery({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  useLang();
  const acc = accentFor(useSettings().voice).c;
  const items = grocery.use();
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [cat, setCat] = useState<Category>("Produce");

  const add = () => {
    const n = name.trim();
    if (!n) return;
    grocery.create({ name: n, qty, category: cat, done: false });
    setName(""); setQty(1);
  };

  // Deterministic grouping + counts (never inferred).
  const grouped = useMemo(() => {
    const by: Record<string, Item[]> = {};
    for (const it of items) (by[it.category] ||= []).push(it);
    return CATEGORIES.filter((c) => by[c]?.length).map((c) => ({ cat: c, list: by[c] }));
  }, [items]);
  const total = items.length;
  const toBuy = items.filter((i) => !i.done).length;
  const checked = total - toBuy;

  return (
    <View style={[st.fill, { paddingTop: Math.max(insets.top, 24) }]}>
      <View style={st.head}>
        <IconButton label="Back" glyph="‹" onPress={onBack} />
        <PixelText size="h2" style={{ color: acc, flex: 1, textAlign: "center" }}>{L("GROCERY")}</PixelText>
        <View style={{ width: 44 }} />
      </View>

      <View style={st.composer}>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Input value={name} onChangeText={setName} placeholder={L("Add an item…")}
            placeholderTextColor={color.textFaint} style={[st.input, { flex: 1 }]} onSubmitEditing={add} returnKeyType="done" />
          <View style={st.stepper}>
            <Pressable onPress={() => setQty((q) => Math.max(1, q - 1))} hitSlop={8} style={st.stepBtn}><Text style={st.stepT}>−</Text></Pressable>
            <Text style={st.stepVal}>{qty}</Text>
            <Pressable onPress={() => setQty((q) => Math.min(99, q + 1))} hitSlop={8} style={st.stepBtn}><Text style={st.stepT}>+</Text></Pressable>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 8 }}>
          {CATEGORIES.map((c) => (
            <Pressable key={c} onPress={() => setCat(c)} style={[st.catPill, cat === c && { borderColor: color.amber, backgroundColor: color.amberGlowBg }]}>
              <Text style={[st.catT, cat === c && { color: color.amber }]}>{L(c)}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Button title={L("Add to list")} onPress={add} disabled={!name.trim()} full />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <ToolIntro
          what={L("A simple shopping list that groups items by category and counts what's left to buy versus what's already in your cart. Fully offline.")}
          setup={L("Type an item, set the quantity, pick a category, then tap Add to list. Tap a row to check it off.")}
        />
        {total === 0 ? (
          <Body muted style={{ textAlign: "center", marginTop: space.xl }}>{L("Your list is empty. Add what you need to buy.")}</Body>
        ) : (
          <>
            <Text style={st.summary}>{toBuy} {L("to buy")} · {checked} {L("in cart")} · {total} {L("total")}</Text>
            {grouped.map(({ cat: c, list }) => (
              <View key={c} style={{ marginTop: space.md }}>
                <Text style={st.catHead}>{L(c)}</Text>
                {list.map((it) => (
                  <Pressable key={it.id} onPress={() => grocery.update(it.id, { done: !it.done })} style={st.row}>
                    <View style={[st.check, it.done && { backgroundColor: color.amber, borderColor: color.amber }]}>
                      {it.done && <Text style={st.checkMark}>✓</Text>}
                    </View>
                    <Text style={[st.itemT, it.done && st.itemDone]}>{it.name}</Text>
                    {it.qty > 1 && <Text style={st.qtyT}>×{it.qty}</Text>}
                    <Pressable onPress={() => grocery.remove(it.id)} hitSlop={10} style={st.del}><Text style={{ color: color.textFaint, fontSize: 16 }}>✕</Text></Pressable>
                  </Pressable>
                ))}
              </View>
            ))}
            {checked > 0 && (
              <View style={{ marginTop: space.lg }}>
                <Button title={L("Clear items in cart")} variant="destructive"
                  onPress={() => { items.filter((i) => i.done).forEach((i) => grocery.remove(i.id)); }} full />
              </View>
            )}
          </>
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
  stepper: { flexDirection: "row", alignItems: "center", backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md },
  stepBtn: { width: 38, height: 44, alignItems: "center", justifyContent: "center" },
  stepT: { color: color.amber, fontSize: 20, fontWeight: "800" },
  stepVal: { color: color.text, fontSize: 15, fontWeight: "700", minWidth: 24, textAlign: "center" },
  catPill: { borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.pill, paddingHorizontal: 12, height: 32, justifyContent: "center" },
  catT: { color: color.textMuted, fontSize: 12, fontWeight: "700" },
  summary: { color: color.textMuted, fontSize: 13, fontWeight: "700", marginTop: space.md, textAlign: "center" },
  catHead: { color: color.cyan, fontSize: 12, fontWeight: "800", letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 6 },
  check: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: color.surfaceLine, alignItems: "center", justifyContent: "center" },
  checkMark: { color: color.onAmber, fontSize: 14, fontWeight: "900" },
  itemT: { flex: 1, color: color.text, fontSize: 15 },
  itemDone: { color: color.textFaint, textDecorationLine: "line-through" },
  qtyT: { color: color.amber, fontSize: 13, fontWeight: "800" },
  del: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
});
