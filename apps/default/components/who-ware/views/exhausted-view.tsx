import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FigureRevealCard } from "@/components/who-ware/figure-reveal-card";
import { theme } from "@/lib/theme";
import styles from "@/app/index.styles";

const exStyles = StyleSheet.create({
  nearMissRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderCurve: "continuous",
    backgroundColor: theme.accentAlpha8,
    borderWidth: 1,
    borderColor: theme.accentAlpha18,
  },
  nearMissText: {
    flex: 1,
    color: theme.inkAlpha78,
    fontSize: 13,
    fontWeight: "700",
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  streakText: {
    flex: 1,
    color: theme.inkAlpha55,
    fontSize: 12.5,
    fontWeight: "600",
    lineHeight: 17,
  },
});

export interface ExhaustedViewProps {
  episodeId: string;
  figureName: string;
  figureEra?: string;
  figureRegion?: string;
  figureTags?: string[];
  identityId?: string;
  /** The player's nearest miss, e.g. "Closest call: Ada Lovelace — right era." */
  nearMiss?: string | null;
  /** Honest streak fate: freeze-absorbed or ended. */
  streakNote?: string | null;
  onLearnMoreArchive: () => void;
  onTomorrow: () => void;
}

/**
 * The exhausted-guesses view: figure reveal card (who they were) and
 * two next actions (open the archive, or wait for tomorrow's drop).
 */
export function ExhaustedView({
  episodeId,
  figureName,
  figureEra,
  figureRegion,
  figureTags,
  identityId,
  nearMiss,
  streakNote,
  onLearnMoreArchive,
  onTomorrow,
}: ExhaustedViewProps) {
  return (
    <>
      <FigureRevealCard
        episodeId={episodeId}
        figureName={figureName}
        figureEra={figureEra}
        figureRegion={figureRegion}
        figureTags={figureTags}
        identityId={identityId}
      />
      <View style={styles.exhaustedCard}>
        <Text style={styles.exhaustedTitle}>Case exhausted</Text>
        <Text style={styles.exhaustedSub}>
          The archive closes around the wrong name — but the circle was narrowing.
        </Text>
        {nearMiss ? (
          <View style={exStyles.nearMissRow}>
            <Ionicons name="locate-outline" size={13} color={theme.accent} />
            <Text style={exStyles.nearMissText}>{nearMiss}</Text>
          </View>
        ) : null}
        {streakNote ? (
          <View style={exStyles.streakRow}>
            <Ionicons name="flame-outline" size={13} color={theme.goldGradientEnd} />
            <Text style={exStyles.streakText}>{streakNote}</Text>
          </View>
        ) : null}
        <View style={styles.nextActionsRow}>
          <Pressable style={styles.nextActionButton} href="/archive" onPress={onLearnMoreArchive}>
            <Ionicons name="archive-outline" size={14} color={theme.ink} />
            <Text style={styles.nextActionText}>Learn more in archive</Text>
          </Pressable>
          <Pressable style={styles.nextActionButton} onPress={onTomorrow}>
            <Ionicons name="calendar-outline" size={14} color={theme.ink} />
            <Text style={styles.nextActionText}>Try again tomorrow</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}
