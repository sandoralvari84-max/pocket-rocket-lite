import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import Chat from "./Chat";
import { ask } from "./model";
import { GAMES } from "./games";
import type { GameModule } from "./games/contract";

export default function Home() {
  const [tab, setTab] = useState<"chat" | "games">("chat");
  const [game, setGame] = useState<GameModule | null>(null);

  if (game) {
    const Screen = game.Screen;
    return <Screen ask={ask} onExit={() => setGame(null)} />;
  }

  return (
    <View style={s.fill}>
      <View style={s.body}>
        {tab === "chat" ? (
          <Chat />
        ) : (
          <ScrollView contentContainerStyle={s.list}>
            <Text style={s.lead}>Mini games</Text>
            {GAMES.map((g) => (
              <Pressable key={g.id} style={s.card} onPress={() => setGame(g)}>
                <Text style={s.cardT}>{g.title}</Text>
                <Text style={s.cardK}>{g.kind}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
      <View style={s.tabs}>
        <Pressable style={[s.tab, tab === "chat" && s.on]} onPress={() => setTab("chat")}>
          <Text style={[s.tabT, tab === "chat" && s.onT]}>Chat</Text>
        </Pressable>
        <Pressable style={[s.tab, tab === "games" && s.on]} onPress={() => setTab("games")}>
          <Text style={[s.tabT, tab === "games" && s.onT]}>Games</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#fff" },
  body: { flex: 1 },
  list: { padding: 16, gap: 12 },
  lead: { fontSize: 20, fontWeight: "700", color: "#111", marginBottom: 4 },
  card: { padding: 16, borderRadius: 12, backgroundColor: "#f3f4f6", borderWidth: 1, borderColor: "#e5e7eb" },
  cardT: { fontSize: 16, fontWeight: "600", color: "#111" },
  cardK: { fontSize: 12, color: "#888", marginTop: 2 },
  tabs: { flexDirection: "row", borderTopWidth: 1, borderColor: "#eee" },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  on: { borderTopWidth: 2, borderColor: "#111" },
  tabT: { color: "#888", fontWeight: "600" },
  onT: { color: "#111" },
});
