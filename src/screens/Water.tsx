// Water / hydration — Tools niche #7. Today's count vs goal is a deterministic tally
// over per-cup log entries. Offline, persists on the data layer.
import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, IconButton, ToolIntro } from "../design/ui";
import { L, useLang } from "../i18n";
import { createCollection, type Entity } from "../data/store";

type Cup = Entity & { day: string };
type Goal = Entity & { cups: number };
export const waterCup = createCollection<Cup>("water_cup");
export const waterGoal = createCollection<Goal>("water_goal");

function todayKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

export default function Water({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  useLang();
  const cups = waterCup.use();
  const goals = waterGoal.use();
  const today = todayKey();

  const todays = useMemo(() => cups.filter((c) => c.day === today), [cups, today]);
  const count = todays.length;
  const goal = goals[0]?.cups ?? 8;
  const setGoal = (n: number) => { const v = Math.max(1, Math.min(20, n)); if (goals[0]) waterGoal.update(goals[0].id, { cups: v }); else waterGoal.create({ cups: v }); };
  const addCup = () => waterCup.create({ day: today });
  const removeCup = () => { const last = todays[0]; if (last) waterCup.remove(last.id); };
  const pct = Math.min(100, Math.round((count / goal) * 100));

  return (
    <View style={[st.fill, { paddingTop: Math.max(insets.top, 24) }]}>
      <View style={st.head}>
        <IconButton label="Back" glyph="‹" onPress={onBack} />
        <PixelText size="h2" style={{ color: color.cyan, flex: 1, textAlign: "center" }}>{L("WATER")}</PixelText>
        <View style={{ width: 44 }} />
      </View>

      <View style={{ paddingHorizontal: space.md }}>
        <ToolIntro
          what={L("A quick daily water tracker — tap to count the cups you drink and see how close you are to your goal. The count resets each day.")}
          setup={L("Tap ＋ for each cup (− to undo). Use the − / + by 'daily goal' to set how many cups you're aiming for.")}
        />
      </View>

      <View style={st.center}>
        <Text style={st.big}>{count}<Text style={st.of}> / {goal}</Text></Text>
        <Text style={st.unit}>{L("cups today")}</Text>

        <View style={st.dots}>
          {Array.from({ length: goal }).map((_, i) => (
            <View key={i} style={[st.dot, i < count && st.dotOn]} />
          ))}
        </View>
        <View style={st.track}><View style={[st.trackFill, { width: `${pct}%` }]} /></View>

        <View style={st.btnRow}>
          <Pressable onPress={removeCup} disabled={count === 0} style={[st.cBtn, count === 0 && { opacity: 0.4 }]}><Text style={st.cBtnT}>−</Text></Pressable>
          <Pressable onPress={addCup} style={[st.cBtn, st.cBtnMain]}><Text style={[st.cBtnT, { color: color.onAmber }]}>＋</Text></Pressable>
        </View>

        <View style={st.goalRow}>
          <Pressable onPress={() => setGoal(goal - 1)} hitSlop={8} style={st.gBtn}><Text style={st.gT}>−</Text></Pressable>
          <Body muted>{L("daily goal")} · {goal} {L("cups")}</Body>
          <Pressable onPress={() => setGoal(goal + 1)} hitSlop={8} style={st.gBtn}><Text style={st.gT}>+</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingBottom: space.sm },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.lg, gap: space.md },
  big: { color: color.cyan, fontSize: 72, fontWeight: "900" },
  of: { color: color.textMuted, fontSize: 32, fontWeight: "700" },
  unit: { color: color.textMuted, fontSize: 15, marginTop: -8 },
  dots: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, maxWidth: 300, marginTop: space.sm },
  dot: { width: 22, height: 28, borderRadius: 6, borderWidth: 2, borderColor: color.surfaceLine, backgroundColor: color.surface },
  dotOn: { backgroundColor: color.cyan, borderColor: color.cyan },
  track: { width: "80%", maxWidth: 320, height: 8, borderRadius: 4, backgroundColor: color.surface2, overflow: "hidden" },
  trackFill: { height: 8, borderRadius: 4, backgroundColor: color.cyan },
  btnRow: { flexDirection: "row", gap: space.lg, marginTop: space.sm },
  cBtn: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: color.surfaceLine, alignItems: "center", justifyContent: "center", backgroundColor: color.surface },
  cBtnMain: { backgroundColor: color.cyan, borderColor: color.cyan, width: 80, height: 80, borderRadius: 40 },
  cBtnT: { color: color.text, fontSize: 30, fontWeight: "800" },
  goalRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.md },
  gBtn: { width: 34, height: 34, borderRadius: radius.md, borderWidth: 1, borderColor: color.surfaceLine, alignItems: "center", justifyContent: "center", backgroundColor: color.surface2 },
  gT: { color: color.cyan, fontSize: 18, fontWeight: "800" },
});
