import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { GUESS_PENALTY, MAX_GUESSES_PER_RUN } from "@/convex/scoring";
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

/**
 * The guess panel. Naming a figure is the game's one irreversible
 * commitment, so a name row never submits on first touch: the first tap
 * *arms* the row (with the cost of being wrong stated in place), the
 * second tap commits the guess.
 */
export function GuessPanel({ figures, guessesLeft, isSolved, playerName, onPlayerNameChange, onSubmit }: GuessPanelProps) {
  const [query, setQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);

  const canAccuse = !isSolved && guessesLeft > 0 && !isSubmitting;

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return figures.slice(0, 5);
    return figures.filter((figure) => figure.displayName.toLowerCase().includes(normalized)).slice(0, 5);
  }, [figures, query]);

  // A stale arming must never survive a change of search context.
  useEffect(() => {
    setArmedId(null);
  }, [query]);

  async function handlePress(figure: FigureOption) {
    if (!canAccuse) return;
    if (armedId !== figure.figureId) {
      setArmedId(figure.figureId);
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(figure.displayName, figure.figureId, playerName);
      setQuery("");
    } finally {
      setIsSubmitting(false);
      setArmedId(null);
    }
  }

  const noMatches = query.trim().length > 0 && filteredOptions.length === 0;
  // Practice rooms pass a large guessesLeft — guesses carry no cost there.
  const isPractice = guessesLeft > MAX_GUESSES_PER_RUN;

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>The guess</Text>
          <Text style={styles.title}>
            {isSolved
              ? "Identity anchored"
              : isPractice
                ? "Practice room — guesses are free"
                : `${guessesLeft} ${guessesLeft === 1 ? "guess" : "guesses"} left`}
          </Text>
          {!isSolved ? (
            <Text style={styles.hintLine}>
              {isPractice
                ? "Revisit a closed case — nothing here touches your score."
                : "Name them when the room feels right. Restraint scores higher."}
            </Text>
          ) : null}
        </View>
        <Ionicons name={isSolved ? "checkmark-circle" : "finger-print"} size={28} color={theme.accent} />
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Whose body are you inside?"
        placeholderTextColor={theme.inkAlpha38}
        style={styles.input}
        editable={!isSolved && guessesLeft > 0}
        autoFocus
      />

      <View style={styles.options}>
        {filteredOptions.map((figure) => {
          const armed = armedId === figure.figureId;
          return (
            <Pressable
              key={figure.figureId}
              accessibilityRole="button"
              accessibilityLabel={armed ? `Confirm guess: ${figure.displayName}` : `Guess ${figure.displayName}`}
              disabled={!canAccuse}
              onPress={() => handlePress(figure)}
              style={({ pressed }) => [
                styles.option,
                armed && styles.optionArmed,
                !canAccuse && styles.optionDisabled,
                pressed && canAccuse && styles.pressed,
              ]}
            >
              {armed ? (
                <View style={styles.armCol}>
                  <Text style={styles.armTitle}>Guess {figure.displayName}?</Text>
                  <Text style={styles.armSub}>
                    {isPractice
                      ? "No score at stake — tap again to commit."
                      : `A wrong guess costs ${GUESS_PENALTY.toLocaleString()} pts — tap again to commit.`}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.optionText, !canAccuse && styles.optionTextDisabled]} numberOfLines={1}>
                  {figure.displayName}
                </Text>
              )}
              {isSubmitting && armed ? (
                <ActivityIndicator size="small" color={theme.inkOnAccent} />
              ) : (
                <Ionicons
                  name={armed ? "finger-print" : "chevron-forward"}
                  size={16}
                  color={armed ? theme.inkOnAccent : theme.inkAlpha58}
                />
              )}
            </Pressable>
          );
        })}
        {noMatches ? (
          <View style={styles.noMatch}>
            <Ionicons name="search-outline" size={14} color={theme.inkAlpha45} />
            <Text style={styles.noMatchText}>
              No one in today's circle answers to that name — check the spelling.
            </Text>
          </View>
        ) : null}
      </View>

      {/* Leaderboard signature — out of the commitment path, one tap away. */}
      {editingName ? (
        <TextInput
          value={playerName}
          onChangeText={onPlayerNameChange}
          placeholder="Your detective name"
          placeholderTextColor={theme.inkAlpha38}
          style={styles.input}
          maxLength={32}
          editable={!isSolved}
          onBlur={() => setEditingName(false)}
          autoFocus
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => setEditingName(true)}
          style={({ pressed }) => [styles.signatureRow, pressed && styles.pressed]}
        >
          <Ionicons name="pencil-outline" size={12} color={theme.inkAlpha45} />
          <Text style={styles.signatureText}>
            Signing the case board as <Text style={styles.signatureName}>{playerName}</Text>
          </Text>
        </Pressable>
      )}
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
  hintLine: {
    marginTop: 4,
    color: theme.inkAlpha55,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    paddingRight: 8,
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
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 15,
    borderCurve: "continuous",
    backgroundColor: theme.inkAlpha6,
    borderWidth: 1,
    borderColor: "transparent",
  },
  optionArmed: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  optionDisabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.72,
  },
  optionText: {
    color: theme.ink,
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },
  optionTextDisabled: {
    color: theme.inkAlpha45,
  },
  armCol: {
    flex: 1,
    gap: 2,
  },
  armTitle: {
    color: theme.inkOnAccent,
    fontSize: 15,
    fontWeight: "900",
  },
  armSub: {
    color: "rgba(17, 24, 39, 0.75)",
    fontSize: 11.5,
    fontWeight: "700",
  },
  noMatch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderCurve: "continuous",
    backgroundColor: theme.inkAlpha4,
    borderWidth: 1,
    borderColor: theme.inkAlpha8,
  },
  noMatchText: {
    flex: 1,
    color: theme.inkAlpha55,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  signatureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
  },
  signatureText: {
    color: theme.inkAlpha45,
    fontSize: 12,
    fontWeight: "600",
  },
  signatureName: {
    color: theme.inkAlpha72,
    fontWeight: "800",
  },
});
