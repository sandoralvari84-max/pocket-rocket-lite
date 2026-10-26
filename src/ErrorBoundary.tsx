import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { color, space } from "./design/tokens";

// App-wide safety net. A render-time crash anywhere below (e.g. expo-audio's
// AudioRecorder constructor throwing "the current activity is no longer available"
// during a background/resume race) would otherwise kill the whole app — the user is
// "kicked out". Here we catch it, auto-remount the subtree after a short delay (by the
// time the activity is back the mount succeeds), and offer a manual retry. The app
// recovers instead of closing.
type Props = { children: React.ReactNode };
type State = { crashed: boolean; nonce: number };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { crashed: false, nonce: 0 };
  private timer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(): Partial<State> {
    return { crashed: true };
  }

  componentDidCatch(err: Error) {
    // Log for adb logcat; auto-remount shortly (transient native/activity races clear).
    // eslint-disable-next-line no-console
    console.warn("[ErrorBoundary] recovered from:", err?.message ?? err);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.setState((s) => ({ crashed: false, nonce: s.nonce + 1 })), 650);
  }

  componentWillUnmount() {
    if (this.timer) clearTimeout(this.timer);
  }

  retry = () => {
    if (this.timer) clearTimeout(this.timer);
    this.setState((s) => ({ crashed: false, nonce: s.nonce + 1 }));
  };

  render() {
    if (this.state.crashed) {
      return (
        <View style={st.fill}>
          <Text style={st.title}>Reconnecting…</Text>
          <Text style={st.sub}>A hiccup — getting you back in.</Text>
          <Pressable onPress={this.retry} style={st.btn} accessibilityRole="button" accessibilityLabel="Retry">
            <Text style={st.btnT}>Tap to retry</Text>
          </Pressable>
        </View>
      );
    }
    // Changing the key forces a clean remount of the whole subtree on recovery.
    return <View key={this.state.nonce} style={{ flex: 1 }}>{this.props.children}</View>;
  }
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.md },
  title: { color: color.amber, fontSize: 20, fontWeight: "800" },
  sub: { color: color.textMuted, textAlign: "center" },
  btn: { marginTop: space.md, borderWidth: 1, borderColor: color.amber, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 22 },
  btnT: { color: color.amber, fontWeight: "800" },
});
