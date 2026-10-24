// Budget / money — Tools niche #4. Every sum (monthly income, expenses, balance,
// per-category totals) is DETERMINISTIC code, never the model. Single currency for v1
// (€); multi-currency FX is a later add (needs the validated Open ER-API). Offline.
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, space, radius } from "../design/tokens";
import { PixelText, Body, Input, Button, IconButton } from "../design/ui";
import { L, useLang } from "../i18n";
import { createCollection, type Entity } from "../data/store";

const EXPENSE_CATS = ["Food", "Transport", "Bills", "Shopping", "Health", "Fun", "Other"] as const;
const INCOME_CATS = ["Salary", "Gift", "Other"] as const;
type Kind = "expense" | "income";

type Tx = Entity & { amount: number; category: string; kind: Kind; note: string; month: string; day: string };
export const budgetTx = createCollection<Tx>("budget_tx");

const CUR = "€";
const money = (n: number) => CUR + n.toFixed(2);
function monthKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function dayKey() { const d = new Date(); return `${monthKey()}-${String(d.getDate()).padStart(2, "0")}`; }

export default function Budget({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  useLang();
  const txs = budgetTx.use();
  const [kind, setKind] = useState<Kind>("expense");
  const [amountStr, setAmountStr] = useState("");
  const [cat, setCat] = useState<string>("Food");

  const cats = kind === "expense" ? EXPENSE_CATS : INCOME_CATS;
  const add = () => {
    const amount = parseFloat(amountStr.replace(",", "."));
    if (!isFinite(amount) || amount <= 0) return;
    budgetTx.create({ amount: Math.round(amount * 100) / 100, category: cat, kind, note: "", month: monthKey(), day: dayKey() });
    setAmountStr("");
  };

  // Deterministic monthly rollups.
  const month = monthKey();
  const { income, expense, byCat, list } = useMemo(() => {
    const m = txs.filter((t) => t.month === month);
    let income = 0, expense = 0;
    const byCat: Record<string, number> = {};
    for (const t of m) {
      if (t.kind === "income") income += t.amount;
      else { expense += t.amount; byCat[t.category] = (byCat[t.category] ?? 0) + t.amount; }
    }
    const list = [...m].sort((a, b) => b.createdAt - a.createdAt);
    return { income, expense, byCat, list };
  }, [txs, month]);
  const balance = income - expense;
  const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  return (
    <View style={[st.fill, { paddingTop: Math.max(insets.top, 24) }]}>
      <View style={st.head}>
        <IconButton label="Back" glyph="‹" onPress={onBack} />
        <PixelText size="h2" style={{ color: color.amber, flex: 1, textAlign: "center" }}>{L("BUDGET")}</PixelText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Month summary */}
        <View style={st.card}>
          <Text style={st.monthLabel}>{L("THIS MONTH")}</Text>
          <Text style={[st.balance, { color: balance >= 0 ? color.success : color.danger }]}>{money(balance)}</Text>
          <View style={st.sumRow}>
            <Text style={st.sumIn}>↑ {money(income)} {L("in")}</Text>
            <Text style={st.sumOut}>↓ {money(expense)} {L("out")}</Text>
          </View>
        </View>

        {/* Add transaction */}
        <View style={[st.card, { marginTop: space.sm }]}>
          <View style={st.toggleRow}>
            {(["expense", "income"] as const).map((k) => (
              <Pressable key={k} onPress={() => { setKind(k); setCat(k === "expense" ? "Food" : "Salary"); }}
                style={[st.toggle, kind === k && (k === "expense" ? st.toggleExp : st.toggleInc)]}>
                <Text style={[st.toggleT, kind === k && { color: k === "expense" ? color.danger : color.success }]}>{L(k === "expense" ? "Expense" : "Income")}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm }}>
            <View style={[st.amountBox, { flex: 1 }]}>
              <Text style={st.cur}>{CUR}</Text>
              <Input value={amountStr} onChangeText={setAmountStr} placeholder="0.00" placeholderTextColor={color.textFaint}
                keyboardType="decimal-pad" style={st.amountInput} onSubmitEditing={add} />
            </View>
            <Button title={L("Add")} onPress={add} disabled={!amountStr.trim()} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 10 }}>
            {cats.map((c) => (
              <Pressable key={c} onPress={() => setCat(c)} style={[st.catPill, cat === c && { borderColor: color.amber, backgroundColor: color.amberGlowBg }]}>
                <Text style={[st.catT, cat === c && { color: color.amber }]}>{L(c)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Category breakdown */}
        {catRows.length > 0 && (
          <>
            <Text style={st.sectionH}>{L("SPENDING BY CATEGORY")}</Text>
            {catRows.map(([c, amt]) => {
              const pct = expense > 0 ? Math.round((amt / expense) * 100) : 0;
              return (
                <View key={c} style={st.catRow}>
                  <Text style={st.catName}>{L(c)}</Text>
                  <View style={st.catBarTrack}><View style={[st.catBarFill, { width: `${pct}%` }]} /></View>
                  <Text style={st.catAmt}>{money(amt)}</Text>
                </View>
              );
            })}
          </>
        )}

        {/* Recent */}
        <Text style={st.sectionH}>{L("TRANSACTIONS")}</Text>
        {list.length === 0 ? (
          <Body muted style={{ marginTop: 4 }}>{L("No transactions this month yet.")}</Body>
        ) : (
          list.map((t) => (
            <View key={t.id} style={st.txRow}>
              <Text style={st.txCat}>{L(t.category)}</Text>
              <Text style={[st.txAmt, { color: t.kind === "income" ? color.success : color.text }]}>
                {t.kind === "income" ? "+" : "−"}{money(t.amount)}
              </Text>
              <Pressable onPress={() => budgetTx.remove(t.id)} hitSlop={10} style={st.del}><Text style={{ color: color.textFaint, fontSize: 16 }}>✕</Text></Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingBottom: space.sm },
  card: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.lg, padding: space.md, marginTop: space.sm },
  monthLabel: { color: color.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  balance: { fontSize: 32, fontWeight: "800", marginTop: 4 },
  sumRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  sumIn: { color: color.success, fontSize: 14, fontWeight: "700" },
  sumOut: { color: color.danger, fontSize: 14, fontWeight: "700" },
  toggleRow: { flexDirection: "row", gap: space.sm },
  toggle: { flex: 1, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, paddingVertical: 9, alignItems: "center" },
  toggleExp: { borderColor: color.danger, backgroundColor: "rgba(255,82,71,0.12)" },
  toggleInc: { borderColor: color.success, backgroundColor: "rgba(80,220,120,0.12)" },
  toggleT: { color: color.textMuted, fontSize: 13, fontWeight: "800" },
  amountBox: { flexDirection: "row", alignItems: "center", backgroundColor: color.surface2, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, paddingHorizontal: 12 },
  cur: { color: color.textMuted, fontSize: 18, fontWeight: "700" },
  amountInput: { flex: 1, color: color.text, fontSize: 18, fontWeight: "700", paddingVertical: 10, paddingHorizontal: 6, backgroundColor: "transparent", borderWidth: 0 },
  catPill: { borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.pill, paddingHorizontal: 12, height: 32, justifyContent: "center" },
  catT: { color: color.textMuted, fontSize: 12, fontWeight: "700" },
  sectionH: { color: color.cyan, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: space.lg, marginBottom: 6 },
  catRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: 8 },
  catName: { color: color.text, fontSize: 13, width: 84 },
  catBarTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: color.surface2, overflow: "hidden" },
  catBarFill: { height: 8, borderRadius: 4, backgroundColor: color.amber },
  catAmt: { color: color.textMuted, fontSize: 13, fontWeight: "700", width: 72, textAlign: "right" },
  txRow: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: color.surface, borderWidth: 1, borderColor: color.surfaceLine, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6 },
  txCat: { flex: 1, color: color.text, fontSize: 15 },
  txAmt: { fontSize: 15, fontWeight: "800" },
  del: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
});
