// Translate — on-device translation (ML Kit, offline after a one-time per-pair model).
// Two modes:
//   TEXT  — type text, translate between two languages.
//   TALK  — a two-way live interpreter: tap a side's mic, speak; it transcribes (whisper),
//           translates, and SPEAKS the other language (expo-speech). Fully on-device.
import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Speech from "expo-speech";
import { useAudioRecorder, RecordingPresets, AudioModule } from "expo-audio";
import { color, space, radius } from "../design/tokens";
import { Body, Input, Button, ScreenHeader, ToolIntro } from "../design/ui";
import { L, useLang } from "../i18n";
import { ensureWhisper, transcribe, startRecording, stopRecording } from "../stt";
import TranslateText, { TranslateLanguage } from "@react-native-ml-kit/translate-text";

const ICON = require("../../assets/ui/tools/translate.png");

const LANGS: { code: TranslateLanguage; label: string; locale: string }[] = [
  { code: TranslateLanguage.HUNGARIAN, label: "Magyar", locale: "hu-HU" },
  { code: TranslateLanguage.ENGLISH, label: "English", locale: "en-US" },
  { code: TranslateLanguage.SPANISH, label: "Español", locale: "es-ES" },
  { code: TranslateLanguage.GERMAN, label: "Deutsch", locale: "de-DE" },
  { code: TranslateLanguage.FRENCH, label: "Français", locale: "fr-FR" },
  { code: TranslateLanguage.ITALIAN, label: "Italiano", locale: "it-IT" },
  { code: TranslateLanguage.PORTUGUESE, label: "Português", locale: "pt-PT" },
  { code: TranslateLanguage.DUTCH, label: "Nederlands", locale: "nl-NL" },
  { code: TranslateLanguage.RUSSIAN, label: "Русский", locale: "ru-RU" },
  { code: TranslateLanguage.POLISH, label: "Polski", locale: "pl-PL" },
  { code: TranslateLanguage.TURKISH, label: "Türkçe", locale: "tr-TR" },
  { code: TranslateLanguage.ARABIC, label: "العربية", locale: "ar" },
  { code: TranslateLanguage.HINDI, label: "हिन्दी", locale: "hi-IN" },
  { code: TranslateLanguage.CHINESE, label: "中文", locale: "zh-CN" },
  { code: TranslateLanguage.JAPANESE, label: "日本語", locale: "ja-JP" },
];
const meta = (c: TranslateLanguage) => LANGS.find((l) => l.code === c)!;

type Turn = { side: "A" | "B"; src: string; dst: string };

export default function Translate({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  useLang();
  const [mode, setMode] = useState<"text" | "talk">("text");
  const [from, setFrom] = useState<TranslateLanguage>(TranslateLanguage.HUNGARIAN);
  const [to, setTo] = useState<TranslateLanguage>(TranslateLanguage.SPANISH);

  // ---- text mode ----
  const [text, setText] = useState("");
  const [out, setOut] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const lock = React.useRef(false);

  const swap = () => { setFrom(to); setTo(from); setOut(null); };

  const translate = async (q: string, src: TranslateLanguage, dst: TranslateLanguage): Promise<string> =>
    (((await TranslateText.translate({ text: q, sourceLanguage: src, targetLanguage: dst, downloadModelIfNeeded: true })) as unknown as string) ?? "").toString();

  const run = async () => {
    const q = text.trim();
    if (!q || lock.current || from === to) return;
    lock.current = true; setBusy(true); setErr(""); setOut(null);
    try { setOut(await translate(q, from, to)); }
    catch (e: any) { setErr(L("Couldn't translate: ") + String(e?.message ?? e)); }
    finally { setBusy(false); lock.current = false; }
  };

  // ---- talk (interpreter) mode ----
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recSide, setRecSide] = useState<null | "A" | "B">(null);
  const [talkBusy, setTalkBusy] = useState(false);
  const [talkStatus, setTalkStatus] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const micLock = React.useRef(false);

  // side A speaks `from`, side B speaks `to`; each is translated+spoken into the other.
  async function micTap(side: "A" | "B") {
    if (micLock.current || talkBusy) return;
    micLock.current = true;
    try {
      if (recSide === null) {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) { setTalkStatus(L("Microphone permission needed.")); return; }
        setTalkStatus(L("Getting ready…"));
        await ensureWhisper(() => {});
        startRecording();
        setRecSide(side);
        setTalkStatus(L("Listening…"));
      } else if (recSide === side) {
        setRecSide(null); setTalkBusy(true); setTalkStatus(L("Transcribing…"));
        const uri = await stopRecording();
        if (!uri) { setTalkStatus(L("No audio — try again.")); return; }
        const src = side === "A" ? from : to;
        const dst = side === "A" ? to : from;
        const heard = await transcribe(uri, (src as unknown as string));
        if (!heard) { setTalkStatus(L("Didn't catch that — try again.")); return; }
        setTalkStatus(L("Translating…"));
        const said = await translate(heard, src, dst);
        setTurns((t) => [...t, { side, src: heard, dst: said }]);
        setTalkStatus("");
        try { Speech.stop(); Speech.speak(said, { language: meta(dst).locale }); } catch {}
      }
    } catch (e: any) {
      setRecSide(null); setTalkStatus(L("Error: ") + String(e?.message ?? e));
    } finally { setTalkBusy(false); micLock.current = false; }
  }

  const Picker = ({ value, onPick }: { value: TranslateLanguage; onPick: (c: TranslateLanguage) => void }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
      {LANGS.map((l) => (
        <Pressable key={l.code} onPress={() => { onPick(l.code); setOut(null); }} style={[st.pill, value === l.code && st.pillOn]}>
          <Text style={[st.pillT, value === l.code && { color: color.amber }]}>{l.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  return (
    <View style={[st.fill, { paddingTop: Math.max(insets.top, 24) }]}>
      <View style={{ paddingHorizontal: space.md }}>
        <ScreenHeader back={onBack} icon={ICON} title={L("Translate")} subtitle={L("on-device · offline")} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <ToolIntro
          what={L("Translate between languages on your phone. TEXT types it out; TALK is a live two-way interpreter — you speak, it speaks the other language back.")}
          setup={L("Pick the two languages. Each language pair downloads a small model once (ideally on Wi-Fi), then works offline. Spoken translation also uses your phone's voices for those languages.")}
        />

        {/* mode toggle */}
        <View style={st.modeRow}>
          {(["text", "talk"] as const).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} style={[st.modeBtn, mode === m && st.modeOn]}>
              <Text style={[st.modeT, mode === m && { color: color.amber }]}>{m === "text" ? L("TEXT") : L("TALK")}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={st.lbl}>{L("FROM")} (A)</Text>
        <Picker value={from} onPick={setFrom} />
        <View style={st.swapRow}>
          <Pressable onPress={swap} accessibilityRole="button" accessibilityLabel={L("Swap languages")} style={st.swapBtn}>
            <Text style={st.swapT}>⇅  {L("Swap")}</Text>
          </Pressable>
        </View>
        <Text style={st.lbl}>{L("TO")} (B)</Text>
        <Picker value={to} onPick={setTo} />

        {mode === "text" ? (
          <>
            <Input value={text} onChangeText={setText} placeholder={L("Type text to translate…")} placeholderTextColor={color.textFaint}
              style={st.input} multiline editable={!busy} />
            <Button title={busy ? L("Translating…") : L("Translate")} onPress={run} disabled={!text.trim() || busy || from === to} full />
            {busy && <View style={st.busyRow}><ActivityIndicator color={color.amber} /><Body muted>{L("Working (first use may download a model)…")}</Body></View>}
            {err ? <Body style={{ color: color.danger, marginTop: space.md }}>{err}</Body> : null}
            {out != null && !busy && (
              <View style={st.outCard}>
                <Text style={st.outLabel}>{L("TRANSLATION")}</Text>
                <Body>{out}</Body>
              </View>
            )}
          </>
        ) : (
          <>
            {/* two-way interpreter */}
            <View style={st.micRow}>
              {(["A", "B"] as const).map((side) => {
                const lang = side === "A" ? meta(from) : meta(to);
                const active = recSide === side;
                const dim = (recSide !== null && !active) || talkBusy;
                return (
                  <Pressable key={side} onPress={() => micTap(side)} disabled={dim}
                    accessibilityRole="button" accessibilityLabel={`Speak ${lang.label}`}
                    style={({ pressed }) => [st.micBtn, active && st.micOn, dim && { opacity: 0.4 }, pressed && { backgroundColor: color.surface2 }]}>
                    <Text style={[st.micGlyph, active && { color: color.danger }]}>{active ? "■" : "🎤"}</Text>
                    <Text style={st.micLang}>{active ? L("Stop") : lang.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={st.talkStatus}>
              {talkBusy ? <ActivityIndicator color={color.amber} /> : null} {talkStatus || L("Tap a side, speak, tap again to stop.")}
            </Text>

            {turns.length > 0 && (
              <View style={{ marginTop: space.md }}>
                {turns.map((t, i) => (
                  <View key={i} style={[st.turn, { borderLeftColor: t.side === "A" ? color.amber : color.cyan }]}>
                    <Text style={st.turnSrc}>{t.src}</Text>
                    <Text style={[st.turnDst, { color: t.side === "A" ? color.cyan : color.amber }]}>{t.dst}</Text>
                  </View>
                ))}
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
  modeRow: { flexDirection: "row", gap: 6, marginTop: space.md, alignSelf: "center" },
  modeBtn: { borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.pill, paddingHorizontal: 22, height: 34, justifyContent: "center" },
  modeOn: { borderColor: color.amber, backgroundColor: color.amberGlowBg },
  modeT: { color: color.textMuted, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  lbl: { color: color.textMuted, fontSize: 10, letterSpacing: 2, marginTop: space.md, marginBottom: 2, fontWeight: "800" },
  pill: { borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.pill, paddingHorizontal: 12, height: 32, justifyContent: "center" },
  pillOn: { borderColor: color.amber, backgroundColor: color.amberGlowBg },
  pillT: { color: color.textMuted, fontSize: 12, fontWeight: "700" },
  swapRow: { alignItems: "center", marginVertical: 6 },
  swapBtn: { borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.pill, paddingHorizontal: 14, height: 30, justifyContent: "center" },
  swapT: { color: color.cyan, fontSize: 12, fontWeight: "800" },
  input: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, color: color.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, minHeight: 80, textAlignVertical: "top", marginTop: space.md, marginBottom: space.sm },
  busyRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.lg },
  outCard: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.cyan, borderRadius: radius.lg, padding: space.md, marginTop: space.lg },
  outLabel: { color: color.cyan, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 6 },
  micRow: { flexDirection: "row", gap: space.md, marginTop: space.lg },
  micBtn: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: color.surface, borderWidth: 2, borderColor: color.surfaceLine, borderRadius: radius.lg, paddingVertical: space.lg },
  micOn: { borderColor: color.danger, backgroundColor: "rgba(255,82,71,0.10)" },
  micGlyph: { fontSize: 26, color: color.text },
  micLang: { color: color.text, fontSize: 14, fontWeight: "800" },
  talkStatus: { color: color.textMuted, fontSize: 13, textAlign: "center", marginTop: space.md, minHeight: 20 },
  turn: { backgroundColor: color.surface, borderLeftWidth: 3, borderRadius: radius.md, padding: space.md, marginBottom: 8 },
  turnSrc: { color: color.textMuted, fontSize: 13, marginBottom: 4 },
  turnDst: { fontSize: 16, fontWeight: "700" },
});
