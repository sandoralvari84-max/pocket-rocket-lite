import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { color, space, radius, type as T, HIT } from "../design/tokens";
import { PixelText, Body, Chip } from "../design/ui";
import { useSettings, setSetting } from "../settings";

const RATE_MIN = 0.5;
const RATE_MAX = 1.3;
const RATE_STEP = 0.05;

export default function Settings({ onAbout }: { onAbout: () => void }) {
  const st = useSettings();

  const setRate = (next: number) => {
    const clamped = Math.round(Math.min(RATE_MAX, Math.max(RATE_MIN, next)) * 100) / 100;
    setSetting("speechRate", clamped);
  };

  return (
    <ScrollView contentContainerStyle={cs.pad} showsVerticalScrollIndicator={false}>
      <PixelText size="title" style={cs.screenTitle}>SETTINGS</PixelText>

      {/* ---- VOICE ---- */}
      <Panel label="VOICE" tone="amber">
        <Label>Assistant persona</Label>
        <Persona
          value={st.voice}
          onChange={(v) => setSetting("voice", v)}
        />
        <Note>Your choice is saved now. Spoken voices arrive with the voice update.</Note>

        <Divider />

        <Row>
          <View style={{ flex: 1 }}>
            <Label>Speech rate</Label>
            <Body muted style={cs.rowHint}>How fast replies are spoken.</Body>
          </View>
          <View style={cs.stepper}>
            <StepKey glyph="−" label="Slower" onPress={() => setRate(st.speechRate - RATE_STEP)} disabled={st.speechRate <= RATE_MIN + 0.001} />
            <Text style={cs.stepVal}>{st.speechRate.toFixed(2)}×</Text>
            <StepKey glyph="+" label="Faster" onPress={() => setRate(st.speechRate + RATE_STEP)} disabled={st.speechRate >= RATE_MAX - 0.001} />
          </View>
        </Row>
      </Panel>

      {/* ---- GAME & MOTION ---- */}
      <Panel label="GAME & MOTION" tone="amber">
        <Toggle
          title="Reduced motion"
          hint="Calms animations and screen shake across the app."
          value={st.reducedMotion}
          onChange={(v) => setSetting("reducedMotion", v)}
        />
        <Divider />
        <Toggle
          title="Game sound"
          hint="Blips and effects during arcade games."
          value={st.gameSound}
          onChange={(v) => setSetting("gameSound", v)}
        />
      </Panel>

      {/* ---- PRIVACY & OFFLINE ---- */}
      <Panel label="PRIVACY & OFFLINE" tone="cyan">
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
      <Panel label="MODEL" tone="cyan">
        <Row>
          <View style={{ flex: 1 }}>
            <Label>On-device model</Label>
            <Body muted style={cs.rowHint}>Qwen2.5-1.5B Instruct, quantized, running locally via llama.rn.</Body>
          </View>
          <Chip label="On-device" tone="cyan" />
        </Row>
      </Panel>

      {/* ---- ABOUT ---- */}
      <Pressable
        onPress={onAbout}
        accessibilityRole="button"
        accessibilityLabel="About this app"
        style={({ pressed }) => [cs.aboutRow, pressed && cs.aboutPressed]}
      >
        <View style={{ flex: 1 }}>
          <Label>About</Label>
          <Body muted style={cs.rowHint}>Model details, credits and licenses.</Body>
        </View>
        <Text style={cs.chevron}>›</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ---------- local building blocks (console look, token-driven) ---------- */

function Panel({ label, tone, children }: { label: string; tone: "amber" | "cyan"; children: React.ReactNode }) {
  const c = tone === "amber" ? color.amber : color.cyan;
  return (
    <View style={cs.panel}>
      <View style={cs.panelHead}>
        <View style={[cs.panelTick, { backgroundColor: c }]} />
        <PixelText size="label" style={{ letterSpacing: 1, color: c }}>{label}</PixelText>
      </View>
      <View style={cs.panelBody}>{children}</View>
    </View>
  );
}

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

function Persona({ value, onChange }: { value: "sentinel" | "nova"; onChange: (v: "sentinel" | "nova") => void }) {
  const opts: { key: "sentinel" | "nova"; label: string }[] = [
    { key: "sentinel", label: "Sentinel" },
    { key: "nova", label: "Nova" },
  ];
  return (
    <View style={cs.seg}>
      {opts.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            style={[cs.segItem, on && cs.segItemOn]}
          >
            <Text style={[cs.segText, on && cs.segTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
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
      <View style={[cs.track, value && cs.trackOn]}>
        <View style={[cs.knob, value && cs.knobOn]} />
      </View>
    </Pressable>
  );
}

const cs = StyleSheet.create({
  pad: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  screenTitle: { color: color.amber, letterSpacing: 2, marginBottom: space.xs },

  panel: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.surfaceLine,
    overflow: "hidden",
  },
  panelHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderColor: color.surfaceLine,
    backgroundColor: color.surface2,
  },
  panelTick: { width: 4, height: 12, borderRadius: 1 },
  panelLabel: { letterSpacing: 1 },
  panelBody: { padding: space.lg, gap: space.sm },

  label: { ...T.body, fontWeight: "700" },
  note: { ...T.small, color: color.textFaint, fontStyle: "italic" },
  rowHint: { marginTop: 2 },
  para: { marginBottom: space.sm },

  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: HIT },
  divider: { height: 1, backgroundColor: color.surfaceLine, marginVertical: space.xs },

  // Persona selector (physical segmented keys)
  seg: {
    flexDirection: "row",
    backgroundColor: color.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.surfaceLine,
    padding: 3,
    gap: 3,
    marginTop: space.xs,
  },
  segItem: { flex: 1, minHeight: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  segItemOn: { backgroundColor: color.amber },
  segText: { color: color.textMuted, fontWeight: "700", fontSize: 14 },
  segTextOn: { color: color.onAmber },

  // Speech-rate stepper
  stepper: { flexDirection: "row", alignItems: "center", gap: space.sm },
  stepKey: {
    width: 44, height: 44, borderRadius: radius.md,
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
