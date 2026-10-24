// Owner Memory — the buddy's memory of YOU. Everything here is owner-controlled:
// a short profile (name, pronouns, about, reply preferences) plus a list of facts
// you've asked it to remember. It's fed to the on-device model as plain context
// (deterministic, never invented), persists on-device, and you can edit or clear it
// at any time. The model never writes here.
import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, space, radius, type as T } from "../design/tokens";
import { PixelText, Body, Input, Button, IconButton } from "../design/ui";
import { L, useLang } from "../i18n";
import {
  useProfile, setProfileField, clearProfile, facts, type OwnerProfile,
} from "../data/profile";

function Field({ label, hint, value, onChange, multiline }: {
  label: string; hint: string; value: string;
  onChange: (t: string) => void; multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={st.label}>{L(label)}</Text>
      <Input
        value={value}
        onChangeText={onChange}
        placeholder={L(hint)}
        placeholderTextColor={color.textFaint}
        multiline={multiline}
        style={[st.input, multiline && { minHeight: 64 }]}
      />
    </View>
  );
}

export default function Memory({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  useLang();
  const profile = useProfile();
  const items = facts.use();
  const [draft, setDraft] = useState("");

  const set = <K extends keyof OwnerProfile>(k: K) => (t: string) => setProfileField(k, t);
  const addFact = () => {
    const t = draft.trim();
    if (!t) return;
    facts.create({ text: t });
    setDraft("");
  };

  return (
    <View style={[st.fill, { paddingTop: Math.max(insets.top, 24) }]}>
      <View style={st.head}>
        <IconButton label="Back" glyph="‹" onPress={onBack} />
        <PixelText size="h2" style={{ color: color.amber, flex: 1, textAlign: "center" }}>{L("MEMORY")}</PixelText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Body muted style={{ marginBottom: space.md }}>
          {L("What your buddy remembers about you. Stored only on this phone, sent to the on-device model as context. Edit or clear it anytime.")}
        </Body>

        <Field label="Name" hint="What should it call you?" value={profile.name} onChange={set("name")} />
        <Field label="Pronouns" hint="e.g. they/them" value={profile.pronouns} onChange={set("pronouns")} />
        <Field label="About you" hint="A sentence or two of context" value={profile.about} onChange={set("about")} multiline />
        <Field label="Reply preferences" hint="Tone, length, language notes…" value={profile.prefs} onChange={set("prefs")} multiline />

        <View style={st.divider} />

        <Text style={st.label}>{L("Remembered facts")}</Text>
        <View style={{ flexDirection: "row", gap: space.sm, marginBottom: space.sm }}>
          <Input
            value={draft}
            onChangeText={setDraft}
            placeholder={L("Something to remember…")}
            placeholderTextColor={color.textFaint}
            style={[st.input, { flex: 1 }]}
            onSubmitEditing={addFact}
          />
          <Button title={L("Add")} onPress={addFact} disabled={!draft.trim()} />
        </View>

        {items.length === 0 ? (
          <Body muted style={{ marginTop: space.xs }}>{L("No remembered facts yet.")}</Body>
        ) : (
          items.map((f) => (
            <View key={f.id} style={st.factRow}>
              <Text style={st.factText}>{f.text}</Text>
              <Pressable
                onPress={() => facts.remove(f.id)}
                accessibilityRole="button"
                accessibilityLabel={L("Forget")}
                hitSlop={10}
                style={st.forget}
              >
                <Text style={{ color: color.textFaint, fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>
          ))
        )}

        <View style={st.divider} />
        <Button
          title={L("Clear all memory")}
          variant="destructive"
          onPress={() => { clearProfile(); facts.clear(); }}
          full
        />
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingBottom: space.sm },
  label: { color: color.text, fontWeight: "700", fontSize: 13, marginBottom: 6, letterSpacing: 0.3 },
  input: {
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine,
    borderRadius: radius.md, color: color.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  divider: { height: 1, backgroundColor: color.surfaceLine, marginVertical: space.lg },
  factRow: {
    flexDirection: "row", alignItems: "center", gap: space.sm,
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine,
    borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, marginBottom: space.sm,
  },
  factText: { flex: 1, color: color.text, fontSize: 15 },
  forget: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
});
