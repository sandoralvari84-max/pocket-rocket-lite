// Recipes — Tools niche #11. Store recipes (title, ingredients, steps) and push the
// ingredients straight to the Grocery list (deterministic line-split). Offline.
import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, Input, Button, IconButton } from "../design/ui";
import { L, useLang } from "../i18n";
import { createCollection, type Entity } from "../data/store";
import { grocery } from "./Grocery";

type Recipe = Entity & { title: string; ingredients: string; steps: string };
export const recipes = createCollection<Recipe>("recipes");

export default function Recipes({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  useLang();
  const list = recipes.use();
  const [edit, setEdit] = useState<Recipe | "new" | null>(null);
  const [title, setTitle] = useState("");
  const [ing, setIng] = useState("");
  const [steps, setSteps] = useState("");
  const [sent, setSent] = useState(0);

  const openNew = () => { setEdit("new"); setTitle(""); setIng(""); setSteps(""); setSent(0); };
  const openEdit = (r: Recipe) => { setEdit(r); setTitle(r.title); setIng(r.ingredients); setSteps(r.steps); setSent(0); };
  const save = () => {
    const t = title.trim(); if (!t) return;
    if (edit === "new") recipes.create({ title: t, ingredients: ing.trim(), steps: steps.trim() });
    else if (edit) recipes.update(edit.id, { title: t, ingredients: ing.trim(), steps: steps.trim() });
    setEdit(null);
  };
  const toGrocery = () => {
    const lines = ing.split("\n").map((l) => l.trim()).filter(Boolean);
    lines.forEach((name) => grocery.create({ name, qty: 1, category: "Other", done: false }));
    setSent(lines.length);
  };

  if (edit) {
    return (
      <View style={[st.fill, { paddingTop: Math.max(insets.top, 24) }]}>
        <View style={st.head}>
          <IconButton label="Back" glyph="‹" onPress={() => setEdit(null)} />
          <PixelText size="h2" style={{ color: color.amber, flex: 1, textAlign: "center" }}>{edit === "new" ? L("NEW RECIPE") : L("RECIPE")}</PixelText>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={st.lbl}>{L("Title")}</Text>
          <Input value={title} onChangeText={setTitle} placeholder={L("Recipe name…")} placeholderTextColor={color.textFaint} style={st.input} />
          <Text style={st.lbl}>{L("Ingredients")} <Text style={st.hint}>{L("(one per line)")}</Text></Text>
          <Input value={ing} onChangeText={setIng} placeholder={"200g flour\n2 eggs\n…"} placeholderTextColor={color.textFaint} multiline style={[st.input, st.area]} />
          <Pressable onPress={toGrocery} disabled={!ing.trim()} style={[st.ghost, !ing.trim() && { opacity: 0.4 }]}>
            <Text style={st.ghostT}>🛒 {sent ? `${sent} ${L("added to Grocery")}` : L("Add ingredients to Grocery")}</Text>
          </Pressable>
          <Text style={st.lbl}>{L("Steps")}</Text>
          <Input value={steps} onChangeText={setSteps} placeholder={L("Method…")} placeholderTextColor={color.textFaint} multiline style={[st.input, st.area, { minHeight: 140 }]} />
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md }}>
            <Button title={L("Save")} onPress={save} disabled={!title.trim()} style={{ flex: 1 }} />
            {edit !== "new" && <Button title={L("Delete")} variant="destructive" onPress={() => { recipes.remove((edit as Recipe).id); setEdit(null); }} />}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[st.fill, { paddingTop: Math.max(insets.top, 24) }]}>
      <View style={st.head}>
        <IconButton label="Back" glyph="‹" onPress={onBack} />
        <PixelText size="h2" style={{ color: color.amber, flex: 1, textAlign: "center" }}>{L("RECIPES")}</PixelText>
        <IconButton label="New recipe" glyph="＋" onPress={openNew} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {list.length === 0 ? (
          <Body muted style={{ textAlign: "center", marginTop: space.xl }}>{L("No recipes yet. Tap ＋ to add one.")}</Body>
        ) : list.map((r) => (
          <Pressable key={r.id} onPress={() => openEdit(r)} style={st.card}>
            <Text style={st.cardTitle}>{r.title}</Text>
            {!!r.ingredients && <Text style={st.cardSub} numberOfLines={1}>{r.ingredients.split("\n").filter(Boolean).length} {L("ingredients")}</Text>}
            <Text style={st.chev}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingBottom: space.sm },
  lbl: { color: color.textMuted, fontSize: 12, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase", marginTop: space.md, marginBottom: 6 },
  hint: { color: color.textFaint, fontSize: 11, fontWeight: "600", textTransform: "none" },
  input: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, color: color.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  area: { minHeight: 90, textAlignVertical: "top" },
  ghost: { marginTop: 8, borderWidth: 1, borderColor: color.cyan, borderRadius: radius.md, paddingVertical: 11, alignItems: "center", backgroundColor: color.cyanGlowBg },
  ghostT: { color: color.cyan, fontSize: 14, fontWeight: "800" },
  card: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.lg, padding: space.md, marginTop: space.sm },
  cardTitle: { color: color.text, fontSize: 16, fontWeight: "800" },
  cardSub: { color: color.textMuted, fontSize: 13, marginTop: 4 },
  chev: { position: "absolute", right: 14, top: 18, color: color.textFaint, fontSize: 22 },
});
