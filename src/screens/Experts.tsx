// Experts / Knowledge — RAG over the 13 bundled knowledge-base niches. Deterministic
// retrieval (searchKB); the model only phrases retrieved passages (grounded, cited).
// With no model installed it shows the source passages directly — still fully factual.
import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, Input, Button, IconButton } from "../design/ui";
import { L, useLang } from "../i18n";
import { listNiches } from "../data/kb";
import { askExpert, type ExpertResult } from "../model";

const NICHES = listNiches();

export default function Experts({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  useLang();
  const [niche, setNiche] = useState<string | undefined>(undefined); // undefined = all
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ExpertResult | null>(null);
  const lock = React.useRef(false);

  const ask = async () => {
    const query = q.trim();
    if (!query || lock.current) return;
    lock.current = true; setBusy(true); setRes(null);
    try { setRes(await askExpert(query, niche)); }
    catch (e: any) { setRes({ answer: "[error] " + String(e?.message ?? e), sources: [], grounded: false }); }
    finally { setBusy(false); lock.current = false; }
  };

  return (
    <View style={[st.fill, { paddingTop: Math.max(insets.top, 24) }]}>
      <View style={st.head}>
        <IconButton label="Back" glyph="‹" onPress={onBack} />
        <PixelText size="h2" style={{ color: color.amber, flex: 1, textAlign: "center" }}>{L("EXPERTS")}</PixelText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Body muted style={{ marginBottom: space.sm }}>
          {L("Ask across curated knowledge packs. Answers come from the packs, not made up — sources are shown.")}
        </Body>

        {/* niche filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 6 }}>
          <Pressable onPress={() => setNiche(undefined)} style={[st.pill, niche === undefined && st.pillOn]}>
            <Text style={[st.pillT, niche === undefined && { color: color.amber }]}>{L("All")}</Text>
          </Pressable>
          {NICHES.map((n) => (
            <Pressable key={n.id} onPress={() => setNiche(n.id)} style={[st.pill, niche === n.id && st.pillOn]}>
              <Text style={[st.pillT, niche === n.id && { color: color.amber }]}>{L(n.title)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm }}>
          <Input value={q} onChangeText={setQ} placeholder={L("Ask a question…")} placeholderTextColor={color.textFaint}
            style={[st.input, { flex: 1 }]} onSubmitEditing={ask} returnKeyType="search" editable={!busy} />
          <Button title={L("Ask")} onPress={ask} disabled={!q.trim() || busy} />
        </View>

        {busy && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.lg }}>
            <ActivityIndicator color={color.amber} /><Body muted>{L("Searching the packs…")}</Body>
          </View>
        )}

        {res && !busy && (
          <View style={{ marginTop: space.lg }}>
            {res.answer ? (
              <View style={st.answerCard}>
                <Text style={st.answerLabel}>{L("ANSWER")}</Text>
                <Body>{res.answer}</Body>
              </View>
            ) : res.grounded ? (
              <Body muted>{L("No model installed — here are the matching passages from the packs:")}</Body>
            ) : (
              <Body muted>{res.answer}</Body>
            )}

            {res.sources.length > 0 && (
              <>
                <Text style={st.srcHead}>{res.answer ? L("SOURCES") : L("PASSAGES")}</Text>
                {res.sources.map((c, i) => (
                  <View key={i} style={st.srcCard}>
                    <Text style={st.srcMeta}>{c.title} › {c.heading}</Text>
                    <Text style={st.srcText}>{c.text}</Text>
                    <Text style={st.srcFile}>{c.file}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {!res && !busy && (
          <Text style={st.hint}>{L("Pick a pack or search all. Examples: “how to judge a health claim”, “what is a marketing funnel”.")}</Text>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingBottom: space.sm },
  pill: { borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.pill, paddingHorizontal: 12, height: 32, justifyContent: "center" },
  pillOn: { borderColor: color.amber, backgroundColor: color.amberGlowBg },
  pillT: { color: color.textMuted, fontSize: 12, fontWeight: "700" },
  input: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, color: color.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  answerCard: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.amber, borderRadius: radius.lg, padding: space.md },
  answerLabel: { color: color.amber, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 6 },
  srcHead: { color: color.cyan, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: space.lg, marginBottom: 6 },
  srcCard: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, padding: space.md, marginBottom: 8 },
  srcMeta: { color: color.text, fontSize: 13, fontWeight: "700", marginBottom: 4 },
  srcText: { color: color.textMuted, fontSize: 13, lineHeight: 19 },
  srcFile: { color: color.textFaint, fontSize: 11, marginTop: 6 },
  hint: { color: color.textFaint, fontSize: 13, marginTop: space.xl, textAlign: "center", lineHeight: 19 },
});
