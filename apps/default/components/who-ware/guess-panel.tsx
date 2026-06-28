import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { theme } from "@/lib/theme";

export interface FigureOption {
  figureId: string;
  displayName: string;
}

interface GuessPanelProps {
  figures: FigureOption[];
  guessesLeft: number;
  isSolved: boolean;
  playerName: string;
  onPlayerNameChange: (playerName: string) => void;
  onSubmit: (optionText: string, figureId: string, playerName: string) => Promise<void>;
}

export function GuessPanel({ figures, guessesLeft, isSolved, playerName, onPlayerNameChange, onSubmit }: GuessPanelProps) {
  const [query, setQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return figures.slice(0, 5);
    return figures.filter((figure) => figure.displayName.toLowerCase().includes(normalized)).slice(0, 5);
  }, [figures, query]);

  async function handleSubmit(figure: FigureOption) {
    if (isSubmitting || isSolved || guessesLeft <= 0) return;
    setIsSubmitting(true);
    try {
      await onSubmit(figure.displayName, figure.figureId, playerName);
      setQuery("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>Identity search</Text>
          <Text style={styles.title}>{isSolved ? "Identity anchored" : `${guessesLeft} guesses left`}</Text>
        </View>
        <Ionicons name={isSolved ? "checkmark-circle" : "finger-print"} size={28} color={theme.accent} />
      </View>

      <TextInput
        value={playerName}
        onChangeText={onPlayerNameChange}
        placeholder="Leaderboard name"
        placeholderTextColor={theme.inkAlpha38}
        style={styles.input}
        maxLength={32}
      />

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Whose body are you inside?"
        placeholderTextColor={theme.inkAlpha38}
        style={styles.input}
        editable={!isSolved && guessesLeft > 0}
      />

      <View style={styles.options}>
        {filteredOptions.map((figure) => (
          <Pressable
            key={figure.figureId}
            accessibilityRole="button"
            onPress={() => handleSubmit(figure)}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
          >
            <Text style={styles.optionText}>{figure.displayName}</Text>
            <Ionicons name="arrow-forward" size={16} color={theme.inkAlpha58} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: 18,
    gap: 12,
    borderRadius: 28,
    borderCurve: "continuous",
    backgroundColor: theme.slateDeep,
    borderWidth: 1,
    borderColor: theme.parchmentLight,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eyebrow: {
    color: theme.accent,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: theme.ink,
    fontSize: 22,
    fontWeight: "900",
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: theme.inkAlpha8,
    color: theme.ink,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.inkAlpha10,
  },
  options: {
    gap: 8,
  },
  option: {
    minHeight: 44,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 15,
    borderCurve: "continuous",
    backgroundColor: theme.inkAlpha6,
  },
  pressed: {
    opacity: 0.72,
  },
  optionText: {
    color: theme.ink,
    fontSize: 15,
    fontWeight: "800",
  },
});
