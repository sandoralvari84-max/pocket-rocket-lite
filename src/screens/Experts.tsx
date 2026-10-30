// Experts / Knowledge — RAG over the 13 bundled knowledge-base niches. Deterministic
// retrieval (searchKB); the model only phrases retrieved passages (grounded, cited).
// With no model installed it shows the source passages directly — still fully factual.
import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, space, radius, accentFor } from "../design/tokens";
import { PixelText, Body, Input, Button, IconButton, ToolIntro } from "../design/ui";
import { L, useLang } from "../i18n";
import { listNiches } from "../data/kb";
import { askExpert, type ExpertResult } from "../model";
import { useSettings, setSetting } from "../settings";

const NICHES = listNiches();

export default function Experts({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  useLang();
  const acc = accentFor(useSettings().voice).c;
  const settings = useSettings();
  // One persisted active pack (packs don't stack — a single lens reads sharper). null = All.
  const niche = settings.activeNiche ?? undefined;
  const pickNiche = (id: string | undefined) => setSetting("activeNiche", id ?? null);
  const activeTitle = NICHES.find((n) => n.id === niche)?.title ?? "";
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
        <PixelText size="h2" style={{ color: acc, flex: 1, textAlign: "center" }}>{L("EXPERTS")}</PixelText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <ToolIntro
          what={L("Ask questions and get answers drawn only from curated, bundled knowledge packs, with the sources shown. If no on-device model is installed, it shows the matching source passages directly.")}
          setup={L("Pick a pack (or 'All'), type your question, and tap Ask.")}
        />
        {/* The one active pack stays shown so you always know which lens is answering. */}
        {niche ? (
          <View style={st.activeBadge}>
            <View style={st.activeDot} />
            <Text style={st.activeBadgeT}>{L("ACTIVE PACK")} · {L(activeTitle)}</Text>
          </View>
        ) : (
          <Text style={st.allNote}>{L("ALL PACKS — mixed. Pick one for sharper, on-topic answers.")}</Text>
        )}

        {/* niche filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 6 }}>
          <Pressable onPress={() => pickNiche(undefined)} style={[st.pill, niche === undefined && st.pillOn]}>
            <Text style={[st.pillT, niche === undefined && { color: color.amber }]}>{L("All")}</Text>
          </Pressable>
          {NICHES.map((n) => (
            <Pressable key={n.id} onPress={() => pickNiche(n.id)} style={[st.pill, niche === n.id && st.pillOn]}>
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
                <View style={st.answerTop}>
                  <Text style={st.answerLabel}>{L("ANSWER")}</Text>
                  {res.grounded && <Text style={st.grounded}>⬡ {L("GROUNDED")} · {niche ? L(activeTitle) : L("ALL PACKS")}</Text>}
                </View>
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
  answerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  answerLabel: { color: color.amber, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  grounded: { color: color.cyan, fontSize: 9.5, fontWeight: "800", letterSpacing: 1 },
  activeBadge: { flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start", backgroundColor: color.cyanGlowBg, borderWidth: 1, borderColor: color.cyan, borderRadius: radius.pill, paddingHorizontal: 12, height: 30, marginBottom: space.sm },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: color.cyan },
  activeBadgeT: { color: color.cyan, fontSize: 11.5, fontWeight: "800", letterSpacing: 0.5 },
  allNote: { color: color.textFaint, fontSize: 11.5, marginBottom: space.sm },
  srcHead: { color: color.cyan, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: space.lg, marginBottom: 6 },
  srcCard: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, padding: space.md, marginBottom: 8 },
  srcMeta: { color: color.text, fontSize: 13, fontWeight: "700", marginBottom: 4 },
  srcText: { color: color.textMuted, fontSize: 13, lineHeight: 19 },
  srcFile: { color: color.textFaint, fontSize: 11, marginTop: 6 },
  hint: { color: color.textFaint, fontSize: 13, marginTop: space.xl, textAlign: "center", lineHeight: 19 },
});
