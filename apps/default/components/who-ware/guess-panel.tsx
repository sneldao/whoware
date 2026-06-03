import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

interface GuessPanelProps {
  options: string[];
  guessesLeft: number;
  isSolved: boolean;
  playerName: string;
  onPlayerNameChange: (playerName: string) => void;
  onSubmit: (guess: string, playerName: string) => Promise<void>;
}

export function GuessPanel({ options, guessesLeft, isSolved, playerName, onPlayerNameChange, onSubmit }: GuessPanelProps) {
  const [query, setQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options.slice(0, 5);
    return options.filter((option) => option.toLowerCase().includes(normalized)).slice(0, 5);
  }, [options, query]);

  async function handleSubmit(guess: string) {
    if (isSubmitting || isSolved || guessesLeft <= 0) return;
    setIsSubmitting(true);
    try {
      await onSubmit(guess, playerName);
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
        <Ionicons name={isSolved ? "checkmark-circle" : "finger-print"} size={28} color="#FBBF24" />
      </View>

      <TextInput
        value={playerName}
        onChangeText={onPlayerNameChange}
        placeholder="Leaderboard name"
        placeholderTextColor="rgba(255, 247, 237, 0.38)"
        style={styles.input}
        maxLength={32}
      />

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Whose body are you inside?"
        placeholderTextColor="rgba(255, 247, 237, 0.38)"
        style={styles.input}
        editable={!isSolved && guessesLeft > 0}
      />

      <View style={styles.options}>
        {filteredOptions.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            onPress={() => handleSubmit(option)}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
          >
            <Text style={styles.optionText}>{option}</Text>
            <Ionicons name="arrow-forward" size={16} color="rgba(255, 247, 237, 0.58)" />
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
    backgroundColor: "rgba(15, 23, 42, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(248, 231, 201, 0.13)",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eyebrow: {
    color: "#FBBF24",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: "#FFF7ED",
    fontSize: 22,
    fontWeight: "900",
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.08)",
    color: "#FFF7ED",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.1)",
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
    backgroundColor: "rgba(255, 247, 237, 0.06)",
  },
  pressed: {
    opacity: 0.72,
  },
  optionText: {
    color: "#FFF7ED",
    fontSize: 15,
    fontWeight: "800",
  },
});
