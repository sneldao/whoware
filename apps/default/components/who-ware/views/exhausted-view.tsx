import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { theme } from "@/lib/theme";
import styles from "@/app/index.styles";

export interface ExhaustedViewProps {
  onLearnMoreArchive: () => void;
  onTomorrow: () => void;
}

/**
 * The exhausted-guesses view: a single card with two next actions
 * (open the archive, or wait for tomorrow's drop).
 */
export function ExhaustedView({ onLearnMoreArchive, onTomorrow }: ExhaustedViewProps) {
  return (
    <View style={styles.exhaustedCard}>
      <Text style={styles.exhaustedTitle}>Case exhausted</Text>
      <Text style={styles.exhaustedSub}>
        All guesses exhausted. The identity is revealed above — the archive holds what remains.
      </Text>
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
  );
}
