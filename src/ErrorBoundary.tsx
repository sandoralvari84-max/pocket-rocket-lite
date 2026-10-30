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
type State = { crashed: boolean; nonce: number; autoRetries: number; fatal: boolean };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { crashed: false, nonce: 0, autoRetries: 0, fatal: false };
  private timer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(): Partial<State> {
    return { crashed: true };
  }

  componentDidCatch(err: Error) {
    // eslint-disable-next-line no-console
    console.warn("[ErrorBoundary] caught:", err?.message ?? err);
    if (this.timer) clearTimeout(this.timer);
    // Auto-remount a few times (transient native/activity races clear). But CAP it: a persistent
    // crash must not loop forever flashing "Reconnecting…" — after the cap, fall through to a real
    // error state the user can act on. A manual retry resets the counter.
    if (this.state.autoRetries >= 3) { this.setState({ fatal: true }); return; }
    this.setState((s) => ({ autoRetries: s.autoRetries + 1 }));
    this.timer = setTimeout(() => this.setState((s) => ({ crashed: false, nonce: s.nonce + 1 })), 650);
  }

  componentWillUnmount() {
    if (this.timer) clearTimeout(this.timer);
  }

  retry = () => {
    if (this.timer) clearTimeout(this.timer);
    this.setState((s) => ({ crashed: false, fatal: false, autoRetries: 0, nonce: s.nonce + 1 }));
  };

  render() {
    if (this.state.crashed) {
      return (
        <View style={st.fill}>
          <Text style={st.title}>{this.state.fatal ? "Something went wrong" : "Reconnecting…"}</Text>
          <Text style={st.sub}>{this.state.fatal ? "The app hit a snag it couldn't shake off on its own." : "A hiccup — getting you back in."}</Text>
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
