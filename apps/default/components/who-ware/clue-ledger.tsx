import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

interface DiscoveredClue {
  sceneIndex: number;
  sceneTitle: string;
  label: string;
  detail: string;
}

interface ClueLedgerProps {
  clues: DiscoveredClue[];
  totalCluesAvailable: number;
}

export function ClueLedger({ clues, totalCluesAvailable }: ClueLedgerProps) {
  const [expanded, setExpanded] = useState(false);

  if (clues.length === 0) return null;

  const cluesByScene = clues.reduce<Record<number, DiscoveredClue[]>>((acc, clue) => {
    if (!acc[clue.sceneIndex]) acc[clue.sceneIndex] = [];
    acc[clue.sceneIndex].push(clue);
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="search" size={16} color="#FBBF24" />
          <Text style={styles.title}>Clues discovered</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.count}>
            {clues.length}/{totalCluesAvailable}
          </Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color="#94a3b8"
          />
        </View>
      </Pressable>

      {expanded && (
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {Object.entries(cluesByScene).map(([sceneIdx, sceneClues]) => (
            <View key={sceneIdx} style={styles.sceneGroup}>
              <Text style={styles.sceneTitle}>
                {sceneClues[0].sceneTitle}
              </Text>
              {sceneClues.map((clue, i) => (
                <View key={i} style={styles.clueItem}>
                  <View style={styles.clueHeader}>
                    <View style={styles.clueDot} />
                    <Text style={styles.clueLabel}>{clue.label}</Text>
                  </View>
                  <Text style={styles.clueDetail}>{clue.detail}</Text>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.15)",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "600",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  count: {
    color: "#FBBF24",
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  list: {
    maxHeight: 240,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  sceneGroup: {
    marginBottom: 12,
  },
  sceneTitle: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  clueItem: {
    marginLeft: 4,
    marginBottom: 8,
  },
  clueHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  clueDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#FBBF24",
  },
  clueLabel: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "500",
  },
  clueDetail: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 17,
    marginLeft: 11,
  },
});
