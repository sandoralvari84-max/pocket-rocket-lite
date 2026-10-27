import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { color, space, radius, type as T, HIT, accentFor } from "../design/tokens";
import { PixelText, Body, Chip, Panel, Segmented, ScreenHeader } from "../design/ui";

const SETTINGS_ICON = require("../../assets/ui/nav/settings.png");
import { useSettings, setSetting } from "../settings";
import { LANGS, L, useLang } from "../i18n";
import type { VoiceId } from "../settings";

const PERSONA_OPTS: { key: VoiceId; label: string }[] = [
  { key: "sentinel", label: "Sentinel" },
  { key: "nova", label: "Nova" },
];

const RATE_MIN = 0.5;
const RATE_MAX = 1.3;
const RATE_STEP = 0.05;

export default function Settings({ onAbout, onModelSetup }: { onAbout: () => void; onModelSetup: () => void }) {
  const st = useSettings();
  useLang(); // re-render on language change

  const setRate = (next: number) => {
    const clamped = Math.round(Math.min(RATE_MAX, Math.max(RATE_MIN, next)) * 100) / 100;
    setSetting("speechRate", clamped);
  };

  return (
    <ScrollView contentContainerStyle={cs.pad} showsVerticalScrollIndicator={false}>
      <ScreenHeader icon={SETTINGS_ICON} title={L("Settings")} subtitle={L("preferences · privacy · about")} />

      {/* ---- LANGUAGE ---- */}
      <Panel label={L("LANGUAGE")} tone="cyan">
        <Label>{L("App language")}</Label>
        <Segmented options={LANGS} value={st.language} onChange={(v) => setSetting("language", v)} />
        <Note>Interface language. Chat works best in English; German and Spanish are supported.</Note>
      </Panel>

      {/* ---- VOICE ---- */}
      <Panel label={L("VOICE")} tone="amber">
        <Label>{L("Assistant persona")}</Label>
        <Segmented options={PERSONA_OPTS} value={st.voice} onChange={(v) => setSetting("voice", v)} />
        <Note>Your choice is saved now. Spoken voices arrive with the voice update.</Note>

        <Divider />

        <Row>
          <View style={{ flex: 1 }}>
            <Label>{L("Speech rate")}</Label>
            <Body muted style={cs.rowHint}>{L("How fast replies are spoken.")}</Body>
          </View>
          <View style={cs.stepper}>
            <StepKey glyph="−" label="Slower" onPress={() => setRate(st.speechRate - RATE_STEP)} disabled={st.speechRate <= RATE_MIN + 0.001} />
            <Text style={cs.stepVal}>{st.speechRate.toFixed(2)}×</Text>
            <StepKey glyph="+" label="Faster" onPress={() => setRate(st.speechRate + RATE_STEP)} disabled={st.speechRate >= RATE_MAX - 0.001} />
          </View>
        </Row>
      </Panel>

      {/* ---- GAME & MOTION ---- */}
      <Panel label={L("GAME & MOTION")} tone="amber">
        <Toggle
          title={L("Reduced motion")}
          hint={L("Calms animations and screen shake across the app.")}
          value={st.reducedMotion}
          onChange={(v) => setSetting("reducedMotion", v)}
        />
        <Divider />
        <Toggle
          title={L("Game sound")}
          hint={L("Blips and effects during arcade games.")}
          value={st.gameSound}
          onChange={(v) => setSetting("gameSound", v)}
        />
      </Panel>

      {/* ---- PRIVACY & OFFLINE ---- */}
      <Panel label={L("PRIVACY & OFFLINE")} tone="cyan">
        <Body style={cs.para}>
          The language model runs entirely on this device. Once it is installed, the app needs no
          network connection to chat or to play — everything happens locally.
        </Body>
        <Body muted style={cs.para}>
          This describes the app's own design: it opens no connections of its own at runtime. It is not
          a guarantee about your whole device — the operating system, a system keyboard, or other apps
          can still behave on their own. For the strongest isolation, put the device in airplane mode.
        </Body>
      </Panel>

      {/* ---- MODEL ---- */}
      <Panel label={L("MODEL")} tone="cyan">
        <Row>
          <View style={{ flex: 1 }}>
            <Label>{L("On-device model")}</Label>
            <Body muted style={cs.rowHint}>{L("A small AI that runs entirely on your phone. Optional — add it once, then it works offline forever.")}</Body>
          </View>
          <Chip label={L("Optional")} tone="cyan" />
        </Row>
      </Panel>

      <Pressable onPress={onModelSetup} accessibilityRole="button" style={({ pressed }) => [cs.aboutRow, pressed && cs.aboutPressed]}>
        <View style={{ flex: 1 }}>
          <Label>{L("Set up local AI")}</Label>
          <Body muted style={cs.rowHint}>Import the model or download it over Wi-Fi. Games remain available without it.</Body>
        </View>
        <Text style={cs.chevron}>›</Text>
      </Pressable>

      {/* ---- ABOUT ---- */}
      <Pressable
        onPress={onAbout}
        accessibilityRole="button"
        accessibilityLabel="About this app"
        style={({ pressed }) => [cs.aboutRow, pressed && cs.aboutPressed]}
      >
        <View style={{ flex: 1 }}>
          <Label>{L("About")}</Label>
          <Body muted style={cs.rowHint}>Model details, credits and licenses.</Body>
        </View>
        <Text style={cs.chevron}>›</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ---------- local building blocks (console look, token-driven) ---------- */

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={cs.label}>{children}</Text>;
}
function Note({ children }: { children: React.ReactNode }) {
  return <Text style={cs.note}>{children}</Text>;
}
function Row({ children }: { children: React.ReactNode }) {
  return <View style={cs.row}>{children}</View>;
}
function Divider() {
  return <View style={cs.divider} />;
}

function StepKey({ glyph, label, onPress, disabled }: { glyph: string; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [cs.stepKey, pressed && !disabled && cs.stepKeyPressed, disabled && cs.stepKeyDisabled]}
    >
      <Text style={cs.stepGlyph}>{glyph}</Text>
    </Pressable>
  );
}

function Toggle({ title, hint, value, onChange }: { title: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  const acc = accentFor(useSettings().voice);
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={title}
      style={cs.row}
    >
      <View style={{ flex: 1 }}>
        <Label>{title}</Label>
        <Body muted style={cs.rowHint}>{hint}</Body>
      </View>
      <View style={[cs.track, value && cs.trackOn, value && { backgroundColor: acc.bg, borderColor: acc.c }]}>
        <View style={[cs.knob, value && cs.knobOn, value && { backgroundColor: acc.c }]} />
      </View>
    </Pressable>
  );
}

const cs = StyleSheet.create({
  pad: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  screenTitle: { color: color.amber, letterSpacing: 2, marginBottom: space.xs },

  label: { ...T.body, fontWeight: "700" },
  note: { ...T.small, color: color.textFaint, fontStyle: "italic" },
  rowHint: { marginTop: 2 },
  para: { marginBottom: space.sm },

  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: HIT },
  divider: { height: 1, backgroundColor: color.surfaceLine, marginVertical: space.xs },

  // Speech-rate stepper
  stepper: { flexDirection: "row", alignItems: "center", gap: space.sm },
  stepKey: {
    width: HIT, height: HIT, borderRadius: radius.md,
    borderWidth: 1, borderColor: color.surfaceLine, backgroundColor: color.surface2,
    alignItems: "center", justifyContent: "center",
  },
  stepKeyPressed: { backgroundColor: color.surfaceLine, borderColor: color.amber },
  stepKeyDisabled: { opacity: 0.35 },
  stepGlyph: { color: color.amber, fontSize: 22, fontWeight: "800", lineHeight: 24 },
  stepVal: { ...T.body, color: color.text, fontWeight: "700", minWidth: 52, textAlign: "center" },

  // Toggle (physical switch)
  track: {
    width: 52, height: 30, borderRadius: radius.pill,
    backgroundColor: color.surface2, borderWidth: 1, borderColor: color.surfaceLine,
    justifyContent: "center", padding: 3,
  },
  trackOn: { backgroundColor: color.amberGlowBg, borderColor: color.amber },
  knob: { width: 22, height: 22, borderRadius: radius.pill, backgroundColor: color.textFaint, alignSelf: "flex-start" },
  knobOn: { backgroundColor: color.amber, alignSelf: "flex-end" },

  // About row
  aboutRow: {
    flexDirection: "row", alignItems: "center", gap: space.md, minHeight: HIT,
    backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: color.surfaceLine,
    paddingHorizontal: space.lg, paddingVertical: space.md,
  },
  aboutPressed: { backgroundColor: color.surface2, borderColor: color.amber },
  chevron: { color: color.textMuted, fontSize: 26, fontWeight: "700" },
});
