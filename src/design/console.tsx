// Shared console primitives (CRT_CONSOLE_DESIGN.md). The one-machine look: a display
// bezel that houses each screen's content, so Home's voice meter and Arcade's catalogue
// read as the same device's screen. Reuses tokens; does not duplicate ui.tsx's Panel/Button.
import React from "react";
import { View, ImageBackground, StyleSheet, ViewStyle } from "react-native";
import { color, radius, space, consoleUI, crt, glow } from "./tokens";

const SCANLINES = require("../../assets/crt/scanlines.png");

/**
 * CrtDisplay — the shared console screen bezel. Accent (persona) drives the rim glow and
 * corner ticks. CRT treatment stays LOW intensity so it never hurts contrast or touch.
 */
export function CrtDisplay({
  accent = color.amber,
  glowOn = true,
  scanlines = true,
  style,
  screenStyle,
  children,
}: {
  accent?: string;
  glowOn?: boolean;
  scanlines?: boolean;
  style?: ViewStyle;
  screenStyle?: ViewStyle;
  children?: React.ReactNode;
}) {
  const rimGlow = accent === color.cyan ? glow.cyanSoft : glow.amberSoft;
  return (
    <View style={[ds.frame, glowOn && ({ boxShadow: rimGlow } as ViewStyle), style]}>
      <View style={[ds.screen, screenStyle]}>
        {children}
        {scanlines && (
          <ImageBackground
            source={SCANLINES}
            resizeMode="repeat"
            style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
            imageStyle={{ opacity: crt.scanlineOpacity * 5, borderRadius: radius.md }}
          />
        )}
        {/* top phosphor gloss — a faint highlight, no gradient dep needed */}
        <View pointerEvents="none" style={ds.gloss} />
      </View>
      {/* corner registration ticks in the active persona colour */}
      <View pointerEvents="none" style={[ds.tick, ds.tickTL, { borderColor: accent }]} />
      <View pointerEvents="none" style={[ds.tick, ds.tickTR, { borderColor: accent }]} />
    </View>
  );
}

const ds = StyleSheet.create({
  frame: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: consoleUI.frameLine,
    borderTopColor: consoleUI.deckHi,
    backgroundColor: consoleUI.frame,
    padding: space.sm,
  },
  screen: {
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: "#090D11",
    position: "relative",
  },
  gloss: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: "26%",
    backgroundColor: crt.phosphorHi,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  tick: { position: "absolute", width: 12, height: 12, borderWidth: 1.5, opacity: 0.6 },
  tickTL: { top: 6, left: 6, borderRightWidth: 0, borderBottomWidth: 0 },
  tickTR: { top: 6, right: 6, borderLeftWidth: 0, borderBottomWidth: 0 },
});
