// Notification reader — Tier-2 "lives with the phone". With your granted permission,
// the app reads incoming notifications aloud on-device. Nothing leaves the phone.
// Wake it from here: turn on "Read new aloud" and it speaks notifications as they arrive
// while this screen is open; or tap a notification to hear it.
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Speech from "expo-speech";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, Button, IconButton, ToolIntro } from "../design/ui";
import { L, useLang } from "../i18n";
import { notif, type NotifItem } from "../notif";
import { getSettings } from "../settings";

function speakItem(it: NotifItem) {
  const st = getSettings();
  const locale = st.language === "de" ? "de-DE" : st.language === "es" ? "es-ES" : "en-US";
  const body = [it.app, it.title && `— ${it.title}`, it.text && `. ${it.text}`].filter(Boolean).join(" ");
  Speech.stop();
  Speech.speak(body.replace(/\s+/g, " ").slice(0, 300), {
    language: locale,
    rate: st.speechRate ?? 0.96,
    pitch: st.voice === "nova" ? 1.0 : 0.75,
  });
}

function when(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Notifications({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  useLang();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [autoRead, setAutoRead] = useState(false);
  const spokenRef = useRef<Set<string>>(new Set());
  const sinceRef = useRef<number>(Date.now());

  const refresh = async () => {
    const on = await notif.isEnabled();
    setEnabled(on);
    if (on) setItems(await notif.getRecent());
  };

  useEffect(() => { refresh(); }, []);

  // Poll while the screen is open; read genuinely-new arrivals aloud when autoRead is on.
  useEffect(() => {
    const id = setInterval(async () => {
      if (!(await notif.isEnabled())) { setEnabled(false); return; }
      const list = await notif.getRecent();
      setItems(list);
      if (autoRead) {
        const fresh = list.filter((n) => n.time > sinceRef.current && !spokenRef.current.has(n.key)).sort((a, b) => a.time - b.time);
        for (const n of fresh) { spokenRef.current.add(n.key); speakItem(n); }
      }
    }, 3000);
    return () => clearInterval(id);
  }, [autoRead]);

  return (
    <View style={[st.fill, { paddingTop: Math.max(insets.top, 24) }]}>
      <View style={st.head}>
        <IconButton label="Back" glyph="‹" onPress={onBack} />
        <PixelText size="h2" style={{ color: color.cyan, flex: 1, textAlign: "center" }}>{L("READER")}</PixelText>
        <IconButton label="Refresh" glyph="↻" onPress={refresh} />
      </View>

      {enabled === false ? (
        <View style={st.grant}>
          <Text style={st.grantIcon}>🔔</Text>
          <Text style={st.grantTitle}>{L("Let it read your notifications")}</Text>
          <Body muted style={{ textAlign: "center", marginVertical: space.md }}>
            {L("Grant notification access, then Pocket Rocket can read incoming messages & alerts aloud — entirely on your phone, nothing leaves the device.")}
          </Body>
          <Button title={L("Grant notification access")} onPress={() => notif.openSettings()} full />
          <Pressable onPress={refresh} style={{ marginTop: space.md }}><Text style={st.again}>{L("I've granted it — check again")}</Text></Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
          <ToolIntro
            what={L("Reads your incoming notifications aloud on-device — new alerts are spoken while this screen is open, or tap any captured one to hear it. Nothing leaves your phone.")}
            setup={L("Grant notification access when asked, then turn on 'Read new aloud' — or tap Read latest to hear the most recent one.")}
          />
          <Pressable onPress={() => { sinceRef.current = Date.now(); setAutoRead((v) => !v); }}
            style={[st.toggle, autoRead && { borderColor: color.cyan, backgroundColor: color.cyanGlowBg }]}>
            <View style={[st.knob, autoRead && st.knobOn]} />
            <View style={{ flex: 1 }}>
              <Text style={st.toggleT}>{L("Read new aloud")}</Text>
              <Text style={st.toggleSub}>{autoRead ? L("Listening — new notifications will be spoken") : L("Off — tap to have arrivals read to you")}</Text>
            </View>
          </Pressable>

          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm }}>
            <Button title={L("Read latest")} onPress={() => { if (items[0]) { spokenRef.current.add(items[0].key); speakItem(items[0]); } }} disabled={items.length === 0} style={{ flex: 1 }} />
            <Button title={L("Stop")} variant="secondary" onPress={() => Speech.stop()} />
          </View>

          <Text style={st.sectionH}>{L("RECENT")}</Text>
          {items.length === 0 ? (
            <Body muted style={{ marginTop: 4 }}>{L("Nothing captured yet. New notifications will appear here.")}</Body>
          ) : items.map((n) => (
            <Pressable key={n.key} onPress={() => { spokenRef.current.add(n.key); speakItem(n); }} style={st.row}>
              <View style={{ flex: 1 }}>
                <Text style={st.rApp}>{n.app} <Text style={st.rTime}>· {when(n.time)}</Text></Text>
                {!!n.title && <Text style={st.rTitle} numberOfLines={1}>{n.title}</Text>}
                {!!n.text && <Text style={st.rText} numberOfLines={2}>{n.text}</Text>}
              </View>
              <Text style={st.play}>▶</Text>
            </Pressable>
          ))}
          {items.length > 0 && (
            <Pressable onPress={() => { notif.clear(); setItems([]); }} style={{ marginTop: space.md }}>
              <Text style={st.again}>{L("Clear captured")}</Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingBottom: space.sm },
  grant: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xl },
  grantIcon: { fontSize: 46, marginBottom: space.sm },
  grantTitle: { color: color.text, fontSize: 20, fontWeight: "800", textAlign: "center" },
  again: { color: color.cyan, fontSize: 14, fontWeight: "700", textAlign: "center" },
  toggle: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.lg, padding: space.md, marginTop: space.md },
  knob: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: color.surfaceLine, backgroundColor: color.surface2 },
  knobOn: { backgroundColor: color.cyan, borderColor: color.cyan },
  toggleT: { color: color.text, fontSize: 16, fontWeight: "700" },
  toggleSub: { color: color.textMuted, fontSize: 12, marginTop: 2 },
  sectionH: { color: color.amber, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: space.lg, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, padding: space.md, marginBottom: 6 },
  rApp: { color: color.cyan, fontSize: 12, fontWeight: "800" },
  rTime: { color: color.textFaint, fontWeight: "600" },
  rTitle: { color: color.text, fontSize: 15, fontWeight: "600", marginTop: 2 },
  rText: { color: color.textMuted, fontSize: 13, marginTop: 1 },
  play: { color: color.cyan, fontSize: 16 },
});
