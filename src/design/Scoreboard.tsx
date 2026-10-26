// Arcade high-score overlay — classic "enter your initials" tag + top-10 table.
// Drop-in replacement for the game-over GameOverlay in score-based games:
//   <ScoreboardOverlay visible={phase==="over"} gameId="road-hopper" score={score}
//       scoreLabel={`SCORE ${score}`} onPlayAgain={fullRestart} onExit={onExit} />
// If the score makes the board it shows a 3-slot initials entry (▲/▼ per slot, like
// a cabinet), otherwise it goes straight to the table. After submit it highlights the
// new row. Pure presentational + the file-backed highscores store; no new native deps.
//
// Typography folds into the formalized design system: VT323 (font.crt) for the big
// GAME OVER title + score numerals (amber, with the home-phrase glow), JetBrains Mono
// for the NAME/SCORE table, ranks and small labels, and the shared Button for actions.
// Dark surface panel with a hairline border + soft amber glow, like the app's panels.
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { color, space, radius, font, glow } from "./tokens";
import { Button, Body } from "./ui";
import { L, useLang } from "../i18n";
import {
  type Ordering, type ScoreEntry, MAX_SCORES,
  topScores, qualifies, addScore, lastTag,
} from "../games/highscores";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ ".split(""); // trailing space = blank slot

function tagToIdx(tag: string): number[] {
  const t = (tag || "AAA").toUpperCase().padEnd(3, " ").slice(0, 3);
  return [0, 1, 2].map((i) => {
    const k = ALPHABET.indexOf(t[i]);
    return k < 0 ? 0 : k;
  });
}

export function ScoreboardOverlay({
  visible, gameId, score, ordering = "high", title = "GAME OVER",
  scoreLabel, children, onPlayAgain, onExit,
}: {
  visible: boolean;
  gameId: string;
  score: number;
  ordering?: Ordering;
  title?: string;
  scoreLabel?: string;
  children?: React.ReactNode;
  onPlayAgain: () => void;
  onExit?: () => void;
}) {
  const [idx, setIdx] = useState<number[]>(() => tagToIdx(lastTag()));
  const [submitted, setSubmitted] = useState(false);
  const [board, setBoard] = useState<ScoreEntry[]>([]);
  const [isHigh, setIsHigh] = useState(false);
  const newAtRef = useRef<number | null>(null);
  useLang(); // re-render on language change

  // Snapshot qualification the moment the overlay opens (before we mutate the board).
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      setSubmitted(false);
      newAtRef.current = null;
      setIdx(tagToIdx(lastTag()));
      setIsHigh(qualifies(gameId, score, ordering));
      setBoard(topScores(gameId));
    }
    wasVisible.current = visible;
  }, [visible, gameId, score, ordering]);

  if (!visible) return null;

  const cycle = (slot: number, dir: 1 | -1) =>
    setIdx((prev) => {
      const next = [...prev];
      next[slot] = (next[slot] + dir + ALPHABET.length) % ALPHABET.length;
      return next;
    });

  function submit() {
    const initials = idx.map((i) => ALPHABET[i]).join("").trimEnd() || "AAA";
    const res = addScore(gameId, initials, score, ordering);
    newAtRef.current = res.entry.at;
    setBoard(res.board);
    setSubmitted(true);
  }

  const showEntry = isHigh && !submitted;

  return (
    <View style={st.scrim} pointerEvents="auto">
      <View style={st.panel}>
        <Text style={st.title}>{L(title)}</Text>
        {!!scoreLabel && <Text style={st.score}>{scoreLabel}</Text>}
        {children}

        {showEntry ? (
          <View style={{ marginTop: space.lg, alignItems: "center", gap: space.md }}>
            <Text style={st.entryLabel}>{L("NEW HIGH SCORE — TAG IT")}</Text>
            <View style={{ flexDirection: "row", gap: space.md }}>
              {idx.map((ci, slot) => (
                <View key={slot} style={st.slot}>
                  <Pressable hitSlop={8} onPress={() => cycle(slot, 1)} style={st.arrow}>
                    <Text style={st.arrowT}>▲</Text>
                  </Pressable>
                  <View style={st.slotBox}>
                    <Text style={st.slotCh}>
                      {ALPHABET[ci] === " " ? "_" : ALPHABET[ci]}
                    </Text>
                  </View>
                  <Pressable hitSlop={8} onPress={() => cycle(slot, -1)} style={st.arrow}>
                    <Text style={st.arrowT}>▼</Text>
                  </Pressable>
                </View>
              ))}
            </View>
            <Button title={L("Save score")} onPress={submit} full />
          </View>
        ) : (
          <View style={{ marginTop: space.lg }}>
            <View style={st.headRow}>
              <Text style={[st.head, st.cRank]}>#</Text>
              <Text style={[st.head, st.cName]}>{L("NAME")}</Text>
              <Text style={[st.head, st.cScore]}>{L("SCORE")}</Text>
            </View>
            {board.length === 0 && (
              <Body muted style={{ textAlign: "center", paddingVertical: space.md }}>
                {L("No scores yet — be the first.")}
              </Body>
            )}
            {board.map((e, i) => {
              const mine = newAtRef.current != null && e.at === newAtRef.current;
              return (
                <View key={e.at + "-" + i} style={[st.row, mine && st.rowMine]}>
                  <Text style={[st.cell, st.cRank, mine && st.hi]}>{i + 1}</Text>
                  <Text style={[st.cell, st.cName, mine && st.hi]}>{e.initials.padEnd(3, " ")}</Text>
                  <Text style={[st.cell, st.cScore, st.cScoreV, mine && st.hi]}>{e.score}</Text>
                </View>
              );
            })}
          </View>
        )}

        {!showEntry && (
          <View style={{ gap: space.sm, marginTop: space.xl }}>
            <Button title={L("Play again")} onPress={onPlayAgain} full />
            {!!onExit && <Button title={L("Exit to menu")} variant="tertiary" onPress={onExit} full />}
          </View>
        )}
      </View>
    </View>
  );
}

// Compact "HI 1200" chip for a game HUD. Returns null when the board is empty.
export { topScores, bestScore } from "../games/highscores";

const st = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(6,9,13,0.86)", alignItems: "center", justifyContent: "center", padding: space.xl, zIndex: 60 },
  panel: {
    width: "100%", maxWidth: 360, backgroundColor: color.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: color.surfaceLine, padding: space.xl, boxShadow: glow.amberSoft,
  },
  // Big CRT title + score, matching the home phrase (VT323 + soft amber glow).
  title: {
    fontFamily: font.crt, fontSize: 44, lineHeight: 46, color: color.amber, textAlign: "center",
    letterSpacing: 2, includeFontPadding: false,
    textShadowColor: "rgba(255,152,0,0.28)", textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 },
  },
  score: {
    fontFamily: font.crt, fontSize: 34, lineHeight: 36, color: color.amber, textAlign: "center",
    marginTop: space.sm, includeFontPadding: false,
    textShadowColor: "rgba(255,152,0,0.18)", textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 },
  },
  entryLabel: { fontFamily: font.monoBold, fontSize: 11, letterSpacing: 1, color: color.cyan },
  // Initials slots — cabinet wells with VT323 characters.
  slot: { alignItems: "center", gap: space.xs },
  arrow: { paddingVertical: space.xs, paddingHorizontal: space.md },
  arrowT: { fontFamily: font.mono, fontSize: 16, color: color.amber, lineHeight: 18 },
  slotBox: {
    width: 44, height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: color.amber,
    backgroundColor: color.amberGlowBg, alignItems: "center", justifyContent: "center",
  },
  slotCh: { fontFamily: font.crt, fontSize: 38, lineHeight: 40, color: color.amber, includeFontPadding: false },
  // Top-10 table — JetBrains Mono, hairline-separated, mono-aligned numbers.
  headRow: { flexDirection: "row", paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: color.surfaceLine, marginBottom: space.xs },
  head: { fontFamily: font.monoBold, fontSize: 10, letterSpacing: 1, color: color.textMuted },
  row: { flexDirection: "row", paddingVertical: 5, alignItems: "center", borderRadius: radius.sm, paddingHorizontal: 4 },
  rowMine: { backgroundColor: color.amberGlowBg },
  cell: { fontFamily: font.mono, fontSize: 15, color: color.text },
  cRank: { width: 28, color: color.textMuted },
  cName: { flex: 1, letterSpacing: 2 },
  cScore: { width: 90, textAlign: "right" },
  cScoreV: { fontFamily: font.monoBold, color: color.amber },
  hi: { color: color.cyan },
});
