// Dictaphone / Notes — the first feature on the local data layer.
// Text notes + voice notes: record audio (kept on-device), transcribe it with the
// existing on-device Whisper (best-effort — a note still saves if transcription
// isn't available), play it back, delete it. Everything persists via createCollection.
import React, { useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAudioRecorder, useAudioPlayer, RecordingPresets, AudioModule } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { ensureWhisper, transcribe } from "../stt";
import { color, space, radius, type as T } from "../design/tokens";
import { PixelText, Body, Input, Button, IconButton } from "../design/ui";
import { L, useLang } from "../i18n";
import { createCollection, type Entity, uid, DATA_DIR } from "../data/store";

type Note = Entity & { kind: "text" | "voice"; text: string; audioUri?: string };
export const notes = createCollection<Note>("notes");

const AUDIO_DIR = DATA_DIR + "audio/";

function when(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString() + " · " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Notes({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  useLang(); // re-render on language change
  const items = notes.use();
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer();
  const lock = useRef(false);

  async function addText() {
    const t = input.trim();
    if (!t) return;
    await notes.create({ kind: "text", text: t });
    setInput("");
  }

  async function toggleRecord() {
    if (busy || lock.current) return;
    lock.current = true;
    try {
      if (!recording) {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) { setStatus(L("Microphone permission denied.")); return; }
        setStatus("");
        await recorder.prepareToRecordAsync();
        recorder.record();
        setRecording(true);
      } else {
        setRecording(false); setBusy(true); setStatus(L("Saving…"));
        await recorder.stop();
        const tmp = recorder.uri;
        if (!tmp) { setStatus(L("No audio captured.")); setBusy(false); return; }
        // Move the clip out of the cache into permanent app storage.
        try { const d = await FileSystem.getInfoAsync(AUDIO_DIR); if (!d.exists) await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true }); } catch {}
        const dest = AUDIO_DIR + uid() + ".m4a";
        try { await FileSystem.copyAsync({ from: tmp, to: dest }); } catch {}
        // Best-effort transcription — the note saves regardless.
        let text = "";
        try { setStatus(L("Transcribing…")); await ensureWhisper(() => {}); text = (await transcribe(dest)).trim(); } catch {}
        await notes.create({ kind: "voice", text: text || L("(voice note — not transcribed)"), audioUri: dest });
        setStatus(""); setBusy(false);
      }
    } catch (e: any) {
      setRecording(false); setBusy(false);
      setStatus("Recorder error: " + String(e?.message ?? e));
    } finally {
      lock.current = false;
    }
  }

  function play(uri?: string) {
    if (!uri) return;
    try { player.replace(uri); player.seekTo(0); player.play(); } catch {}
  }

  async function del(n: Note) {
    if (n.audioUri) { try { await FileSystem.deleteAsync(n.audioUri, { idempotent: true }); } catch {} }
    await notes.remove(n.id);
  }

  return (
    <View style={[st.fill, { paddingTop: Math.max(insets.top, 24) }]}>
      <View style={st.head}>
        <IconButton label="Back" glyph="‹" onPress={onBack} />
        <PixelText size="h2" style={{ color: color.amber, flex: 1, textAlign: "center" }}>{L("DICTAPHONE")}</PixelText>
        <View style={{ width: 44 }} />
      </View>

      <View style={st.composer}>
        <Input
          value={input}
          onChangeText={setInput}
          placeholder={L("Type a note…")}
          placeholderTextColor={color.textFaint}
          multiline
          style={st.input}
        />
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button title={L("Add note")} onPress={addText} disabled={!input.trim()} style={{ flex: 1 }} />
          <Pressable
            onPress={toggleRecord}
            accessibilityRole="button"
            accessibilityLabel={recording ? "Stop recording" : "Record voice note"}
            style={[st.mic, recording && st.micOn]}
          >
            <Text style={[st.micGlyph, recording && { color: color.onAmber }]}>{recording ? "■" : "●"}</Text>
          </Pressable>
        </View>
        {!!status && <Body muted style={{ marginTop: space.xs, fontSize: 12 }}>{status}</Body>}
      </View>

      <ScrollView contentContainerStyle={st.listPad} showsVerticalScrollIndicator={false}>
        {items.length === 0 && (
          <Body muted style={{ textAlign: "center", marginTop: space.xl }}>
            {L("No notes yet. Type one above, or tap ● to record a voice note — it's saved and transcribed on your device.")}
          </Body>
        )}
        {items.map((n) => (
          <View key={n.id} style={st.note}>
            <View style={st.noteTop}>
              <Text style={st.noteMeta}>{n.kind === "voice" ? "🎙 VOICE" : "✎ NOTE"} · {when(n.createdAt)}</Text>
              <View style={{ flexDirection: "row", gap: space.xs }}>
                {n.kind === "voice" && !!n.audioUri && (
                  <Pressable onPress={() => play(n.audioUri)} accessibilityLabel="Play" style={st.act}><Text style={st.actGlyph}>▶</Text></Pressable>
                )}
                <Pressable onPress={() => del(n)} accessibilityLabel="Delete" style={st.act}><Text style={[st.actGlyph, { color: color.danger }]}>✕</Text></Pressable>
              </View>
            </View>
            <Text style={st.noteText}>{n.text}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingBottom: space.sm },
  composer: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.sm, borderBottomWidth: 1, borderBottomColor: color.surfaceLine },
  input: { minHeight: 48, maxHeight: 120 },
  mic: { width: 52, height: 48, borderRadius: radius.md, borderWidth: 2, borderColor: color.amber, backgroundColor: color.amberGlowBg, alignItems: "center", justifyContent: "center" },
  micOn: { backgroundColor: color.amber },
  micGlyph: { color: color.amber, fontSize: 20, fontWeight: "900" },
  listPad: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  note: { backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: color.surfaceLine, padding: space.md },
  noteTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: space.xs },
  noteMeta: { ...T.small, color: color.textMuted },
  act: { width: 32, height: 32, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: color.surface2 },
  actGlyph: { color: color.cyan, fontSize: 15, fontWeight: "800" },
  noteText: { ...T.body, color: color.text },
});
