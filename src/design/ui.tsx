// Pocket Rocket Lite — shared UI component library (brief §B).
// Reusable, token-driven. Screens compose these instead of one-off styles.
import React from "react";
import {
  View, Text, Pressable, TextInput, ActivityIndicator, Modal,
  StyleSheet, ViewStyle, TextStyle, ImageStyle, StyleProp, Image, ImageSourcePropType, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { color, space, radius, type as T, HIT } from "./tokens";
import { L, useLang } from "../i18n";

/* ---------- Screen shell ---------- */
export function Screen({ children, scroll, pad = true, style }: {
  children: React.ReactNode; scroll?: boolean; pad?: boolean; style?: ViewStyle;
}) {
  const inner = (
    <View style={[{ flex: 1, backgroundColor: color.bg }, pad && { padding: space.lg }, style]}>
      {children}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top", "left", "right"]}>
      {scroll ? <ScrollView contentContainerStyle={{ flexGrow: 1 }}>{inner}</ScrollView> : inner}
    </SafeAreaView>
  );
}

/* ---------- Text ---------- */
export function PixelText({ children, style, size }: { children: React.ReactNode; style?: StyleProp<TextStyle>; size?: "title" | "h2" | "label" | "score"; }) {
  const base = size === "title" ? T.pixelTitle : size === "score" ? T.pixelScore : size === "label" ? T.pixelLabel : T.pixelH2;
  return <Text style={[base, style]}>{children}</Text>;
}
export function Title({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) { return <Text style={[T.title, style]}>{children}</Text>; }
export function H2({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) { return <Text style={[T.h2, style]}>{children}</Text>; }
export function Body({ children, style, muted }: { children: React.ReactNode; style?: StyleProp<TextStyle>; muted?: boolean }) { return <Text style={[muted ? T.bodyMuted : T.body, style]}>{children}</Text>; }

/* ---------- Buttons ---------- */
type BtnVariant = "primary" | "secondary" | "tertiary" | "destructive";
export function Button({ title, onPress, variant = "primary", disabled, style, full }: {
  title: string; onPress: () => void; variant?: BtnVariant; disabled?: boolean; style?: ViewStyle; full?: boolean;
}) {
  const v = BTN[variant];
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={title}
      style={({ pressed }) => [
        bs.btn, { backgroundColor: v.bg, borderColor: v.border },
        full && { alignSelf: "stretch" },
        pressed && !disabled && { backgroundColor: v.pressed, transform: [{ scale: 0.98 }] },
        disabled && { opacity: 0.4 }, style,
      ]}>
      <Text style={[bs.btnT, { color: v.fg }]}>{title}</Text>
    </Pressable>
  );
}
const BTN: Record<BtnVariant, { bg: string; fg: string; border: string; pressed: string }> = {
  primary:     { bg: color.amber, fg: color.onAmber, border: color.amber, pressed: color.amberDim },
  secondary:   { bg: "transparent", fg: color.cyan, border: color.cyan, pressed: color.cyanGlowBg },
  tertiary:    { bg: "transparent", fg: color.textMuted, border: "transparent", pressed: color.surface2 },
  destructive: { bg: "transparent", fg: color.danger, border: color.danger, pressed: "rgba(255,82,71,0.15)" },
};
export function IconButton({ label, glyph, onPress, active, disabled }: {
  label: string; glyph: string; onPress: () => void; active?: boolean; disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [bs.icon, active && { borderColor: color.amber, backgroundColor: color.amberGlowBg }, pressed && { backgroundColor: color.surface2 }, disabled && { opacity: 0.4 }]}>
      <Text style={{ fontSize: 20, color: active ? color.amber : color.text }}>{glyph}</Text>
    </Pressable>
  );
}

/* ---------- Containers ---------- */
export function Card({ children, style, onPress }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const inner = <View style={[cs.card, style]}>{children}</View>;
  if (!onPress) return inner;
  return <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}>{inner}</Pressable>;
}
export function Chip({ label, tone = "muted" }: { label: string; tone?: "amber" | "cyan" | "muted" }) {
  const c = tone === "amber" ? color.amber : tone === "cyan" ? color.cyan : color.textMuted;
  return <View style={[cs.chip, { borderColor: c }]}><Text style={[cs.chipT, { color: c }]}>{label}</Text></View>;
}

/* ---------- Input ---------- */
export function Input(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={color.textFaint} {...props} style={[cs.input, props.style]} />;
}

/* ---------- Segmented control ---------- */
export function Segmented<T extends string>({ options, value, onChange }: {
  options: { key: T; label: string }[]; value: T; onChange: (k: T) => void;
}) {
  return (
    <View style={cs.seg}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[cs.segItem, on && { backgroundColor: color.amber }]}>
            <Text style={{ color: on ? color.onAmber : color.textMuted, fontWeight: "700", fontSize: 13 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- Overlays: dialog, pause/gameover, toast ---------- */
export function Dialog({ visible, title, message, confirmLabel = "OK", cancelLabel, onConfirm, onCancel, destructive }: {
  visible: boolean; title: string; message?: string; confirmLabel?: string; cancelLabel?: string;
  onConfirm: () => void; onCancel?: () => void; destructive?: boolean;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={os.scrim}>
        <View style={os.sheet}>
          <H2>{title}</H2>
          {!!message && <Body muted style={{ marginTop: space.sm }}>{message}</Body>}
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.lg, justifyContent: "flex-end" }}>
            {!!cancelLabel && <Button title={cancelLabel} variant="tertiary" onPress={onCancel ?? (() => {})} />}
            <Button title={confirmLabel} variant={destructive ? "destructive" : "primary"} onPress={onConfirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Full-screen game overlay (pause / game-over / win). Non-destructive, retro.
export function GameOverlay({ visible, kind, title, score, children, onPrimary, primaryLabel, onExit }: {
  visible: boolean; kind?: "pause" | "over" | "win"; title: string; score?: string;
  children?: React.ReactNode; onPrimary: () => void; primaryLabel: string; onExit?: () => void;
}) {
  useLang(); // re-render on language change
  if (!visible) return null;
  const accent = kind === "win" ? color.success : kind === "over" ? color.danger : color.amber;
  return (
    <View style={os.gameScrim} pointerEvents="auto">
      <View style={[os.gamePanel, { borderColor: accent }]}>
        <PixelText size="h2" style={{ color: accent, textAlign: "center" }}>{L(title)}</PixelText>
        {!!score && <PixelText size="score" style={{ textAlign: "center", marginTop: space.md }}>{score}</PixelText>}
        {children}
        <View style={{ gap: space.sm, marginTop: space.xl }}>
          <Button title={L(primaryLabel)} onPress={onPrimary} full />
          {!!onExit && <Button title={L("Exit to menu")} variant="tertiary" onPress={onExit} full />}
        </View>
      </View>
    </View>
  );
}

/* ---------- States ---------- */
export function Spinner({ label }: { label?: string }) {
  return <View style={{ alignItems: "center", gap: space.md, padding: space.xl }}>
    <ActivityIndicator color={color.amber} size="large" />
    {!!label && <Body muted>{label}</Body>}
  </View>;
}
export function EmptyState({ glyph = "✦", title, hint }: { glyph?: string; title: string; hint?: string }) {
  return <View style={{ alignItems: "center", gap: space.sm, padding: space.xxl }}>
    <Text style={{ fontSize: 40, color: color.textFaint }}>{glyph}</Text>
    <H2 style={{ textAlign: "center" }}>{title}</H2>
    {!!hint && <Body muted style={{ textAlign: "center" }}>{hint}</Body>}
  </View>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <View style={{ alignItems: "center", gap: space.md, padding: space.xl }}>
    <Text style={{ fontSize: 32 }}>⚠️</Text>
    <Body style={{ textAlign: "center", color: color.warn }}>{message}</Body>
    {!!onRetry && <Button title="Try again" variant="secondary" onPress={onRetry} />}
  </View>;
}

/* ---------- Pixel sprite helper (nearest-neighbour-ish; keep integer scales) ---------- */
export function Sprite({ source, size, style }: { source: ImageSourcePropType; size: number; style?: ImageStyle }) {
  return <Image source={source} style={[{ width: size, height: size }, style]} resizeMode="contain" fadeDuration={0} />;
}

const bs = StyleSheet.create({
  btn: { minHeight: HIT, paddingHorizontal: space.lg, borderRadius: radius.md, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  btnT: { fontSize: 15, fontWeight: "800", letterSpacing: 0.3 },
  icon: { width: HIT, height: HIT, borderRadius: radius.md, borderWidth: 1, borderColor: color.surfaceLine, backgroundColor: color.surface, alignItems: "center", justifyContent: "center" },
});
const cs = StyleSheet.create({
  card: { backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: color.surfaceLine, padding: space.lg },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 3, alignSelf: "flex-start" },
  chipT: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  input: { minHeight: HIT, backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, paddingHorizontal: space.md, color: color.text, fontSize: 15 },
  seg: { flexDirection: "row", backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.surfaceLine, padding: 3, gap: 3 },
  segItem: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: "center" },
});
const os = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: space.xl },
  sheet: { width: "100%", maxWidth: 420, backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: color.surfaceLine, padding: space.xl },
  gameScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(6,9,13,0.82)", alignItems: "center", justifyContent: "center", padding: space.xl, zIndex: 50 },
  gamePanel: { width: "100%", maxWidth: 360, backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 2, padding: space.xl },
});

/* ---------- Titled console panel (shared by Settings / About) ---------- */
export function Panel({ label, tone = "amber", children, style }: {
  label: string; tone?: "amber" | "cyan"; children: React.ReactNode; style?: ViewStyle;
}) {
  const c = tone === "cyan" ? color.cyan : color.amber;
  return (
    <View style={[ps.panel, style]}>
      <View style={ps.panelHead}>
        <View style={[ps.panelTick, { backgroundColor: c }]} />
        <PixelText size="label" style={{ letterSpacing: 1, color: c }}>{label}</PixelText>
      </View>
      <View style={ps.panelBody}>{children}</View>
    </View>
  );
}

/* ---------- Determinate progress bar ---------- */
export function ProgressBar({ progress, label }: { progress: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ gap: space.sm, alignSelf: "stretch" }}>
      {!!label && <Body muted style={{ textAlign: "center" }}>{label}</Body>}
      <View
        style={ps.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      >
        <View style={{ backgroundColor: color.amber, flexGrow: pct, flexBasis: 0 }} />
        <View style={{ flexGrow: 1 - pct, flexBasis: 0 }} />
      </View>
      <Body muted style={{ textAlign: "center" }}>{Math.round(pct * 100)}%</Body>
    </View>
  );
}

/* ---------- Inline persistent banner (permissions / offline / notices) ---------- */
export function Banner({ tone = "warn", title, message, actionLabel, onAction }: {
  tone?: "warn" | "danger" | "info"; title: string; message?: string; actionLabel?: string; onAction?: () => void;
}) {
  const c = tone === "danger" ? color.danger : tone === "info" ? color.cyan : color.warn;
  return (
    <View style={[ps.banner, { borderColor: c }]}>
      <View style={{ flex: 1 }}>
        <Text style={[ps.bannerTitle, { color: c }]}>{title}</Text>
        {!!message && <Body muted style={{ marginTop: 2 }}>{message}</Body>}
      </View>
      {!!actionLabel && !!onAction && (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [ps.bannerBtn, { borderColor: c }, pressed && { backgroundColor: color.surface2 }]}
        >
          <Text style={{ color: c, fontWeight: "700", fontSize: 13 }}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const ps = StyleSheet.create({
  panel: { backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: color.surfaceLine, overflow: "hidden" },
  panelHead: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm, borderBottomWidth: 1, borderColor: color.surfaceLine, backgroundColor: color.surface2 },
  panelTick: { width: 4, height: 12, borderRadius: 1 },
  panelBody: { padding: space.lg, gap: space.sm },
  track: { flexDirection: "row", height: 12, borderRadius: radius.pill, backgroundColor: color.surface2, borderWidth: 1, borderColor: color.surfaceLine, overflow: "hidden" },
  banner: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: color.surface, borderWidth: 1, borderRadius: radius.md, padding: space.md },
  bannerTitle: { fontSize: 14, fontWeight: "800", letterSpacing: 0.3 },
  bannerBtn: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: 8 },
});

/* ---------- Game error boundary: a crashing game returns to menu, not out of the app ---------- */
export class GameErrorBoundary extends React.Component<
  { children: React.ReactNode; onExit: () => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { try { console.warn("[game crash]", error?.message); } catch {} }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: color.bg, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.lg }}>
          <Text style={{ fontSize: 40 }}>⚠️</Text>
          <H2 style={{ textAlign: "center" }}>This game hit a snag</H2>
          <Body muted style={{ textAlign: "center" }}>It stopped so the app wouldn’t. Back to the menu.</Body>
          <Button title="Back to menu" onPress={this.props.onExit} />
        </View>
      );
    }
    return this.props.children as React.ReactElement;
  }
}
