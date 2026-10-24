// Arcade high-score overlay — classic "enter your initials" tag + top-10 table.
// Drop-in replacement for the game-over GameOverlay in score-based games:
//   <ScoreboardOverlay visible={phase==="over"} gameId="road-hopper" score={score}
//       scoreLabel={`SCORE ${score}`} onPlayAgain={fullRestart} onExit={onExit} />
// If the score makes the board it shows a 3-slot initials entry (▲/▼ per slot, like
// a cabinet), otherwise it goes straight to the table. After submit it highlights the
// new row. Pure presentational + the file-backed highscores store; no new native deps.
import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { color, space, radius } from "./tokens";
import { PixelText, Button, Body } from "./ui";
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
  scoreLabel, onPlayAgain, onExit,
}: {
  visible: boolean;
  gameId: string;
  score: number;
  ordering?: Ordering;
  title?: string;
  scoreLabel?: string;
  onPlayAgain: () => void;
  onExit?: () => void;
}) {
  const [idx, setIdx] = useState<number[]>(() => tagToIdx(lastTag()));
  const [submitted, setSubmitted] = useState(false);
  const [board, setBoard] = useState<ScoreEntry[]>([]);
  const [isHigh, setIsHigh] = useState(false);
  const newAtRef = useRef<number | null>(null);

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

  const accent = color.danger;
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
      <View style={[st.panel, { borderColor: accent }]}>
        <PixelText size="h2" style={{ color: accent, textAlign: "center" }}>{title}</PixelText>
        {!!scoreLabel && (
          <PixelText size="score" style={{ textAlign: "center", marginTop: space.sm }}>{scoreLabel}</PixelText>
        )}

        {showEntry ? (
          <View style={{ marginTop: space.lg, alignItems: "center", gap: space.md }}>
            <PixelText size="label" style={{ color: color.cyan }}>NEW HIGH SCORE — TAG IT</PixelText>
            <View style={{ flexDirection: "row", gap: space.md }}>
              {idx.map((ci, slot) => (
                <View key={slot} style={st.slot}>
                  <Pressable hitSlop={8} onPress={() => cycle(slot, 1)} style={st.arrow}>
                    <PixelText size="label" style={{ color: color.amber }}>▲</PixelText>
                  </Pressable>
                  <View style={st.slotBox}>
                    <PixelText size="h2" style={{ color: color.amber }}>
                      {ALPHABET[ci] === " " ? "_" : ALPHABET[ci]}
                    </PixelText>
                  </View>
                  <Pressable hitSlop={8} onPress={() => cycle(slot, -1)} style={st.arrow}>
                    <PixelText size="label" style={{ color: color.amber }}>▼</PixelText>
                  </Pressable>
                </View>
              ))}
            </View>
            <Button title="Save score" onPress={submit} full />
          </View>
        ) : (
          <View style={{ marginTop: space.lg }}>
            <View style={st.headRow}>
              <PixelText size="label" style={st.cRank}>#</PixelText>
              <PixelText size="label" style={st.cName}>NAME</PixelText>
              <PixelText size="label" style={st.cScore}>SCORE</PixelText>
            </View>
            {board.length === 0 && (
              <Body muted style={{ textAlign: "center", paddingVertical: space.md }}>
                No scores yet — be the first.
              </Body>
            )}
            {board.map((e, i) => {
              const mine = newAtRef.current != null && e.at === newAtRef.current;
              return (
                <View key={e.at + "-" + i} style={[st.row, mine && st.rowMine]}>
                  <PixelText size="label" style={[st.cRank, mine && st.hi]}>{i + 1}</PixelText>
                  <PixelText size="label" style={[st.cName, mine && st.hi]}>{e.initials.padEnd(3, " ")}</PixelText>
                  <PixelText size="label" style={[st.cScore, mine && st.hi]}>{e.score}</PixelText>
                </View>
              );
            })}
          </View>
        )}

        {!showEntry && (
          <View style={{ gap: space.sm, marginTop: space.xl }}>
            <Button title="Play again" onPress={onPlayAgain} full />
            {!!onExit && <Button title="Exit to menu" variant="tertiary" onPress={onExit} full />}
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
  panel: { width: "100%", maxWidth: 360, backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 2, padding: space.xl },
  slot: { alignItems: "center", gap: space.xs },
  arrow: { paddingVertical: space.xs, paddingHorizontal: space.md },
  slotBox: {
    width: 44, height: 52, borderRadius: radius.md, borderWidth: 2, borderColor: color.amber,
    backgroundColor: color.amberGlowBg, alignItems: "center", justifyContent: "center",
  },
  headRow: { flexDirection: "row", paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: color.surfaceLine, marginBottom: space.xs },
  row: { flexDirection: "row", paddingVertical: 5, alignItems: "center", borderRadius: radius.sm, paddingHorizontal: 4 },
  rowMine: { backgroundColor: color.amberGlowBg },
  cRank: { width: 28 },
  cName: { flex: 1, letterSpacing: 2 },
  cScore: { width: 90, textAlign: "right", color: color.amber },
  hi: { color: color.cyan },
});
