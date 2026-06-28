import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { GuessPanel } from "@/components/who-ware/guess-panel";
import { theme } from "@/lib/theme";
import type { FigureOption } from "@/components/who-ware/guess-panel";
import styles from "@/app/index.styles";

export interface IntroViewProps {
  isGuessPanelOpen: boolean;
  figureOptions: FigureOption[];
  guessesLeft: number;
  isSolved: boolean;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  onSubmitGuess: (text: string, figureId: string, playerName: string) => Promise<void>;
}

/**
 * The pre-memory view: a guess panel (if open) and the "Score by restraint"
 * ritual card. Shown until the player enters their first memory.
 */
export function IntroView({
  isGuessPanelOpen,
  figureOptions,
  guessesLeft,
  isSolved,
  playerName,
  onPlayerNameChange,
  onSubmitGuess,
}: IntroViewProps) {
  return (
    <>
      {isGuessPanelOpen && (
        <GuessPanel
          figures={figureOptions}
          guessesLeft={guessesLeft}
          isSolved={isSolved}
          playerName={playerName}
          onPlayerNameChange={onPlayerNameChange}
          onSubmit={onSubmitGuess}
        />
      )}
      <View style={styles.ritualCard}>
        <View style={styles.ritualHeader}>
          <Ionicons name="sparkles" size={18} color={theme.accent} />
          <Text style={styles.ritualTitle}>Score by restraint</Text>
        </View>
        <Text style={styles.ritualText}>
          Guess before opening a memory for the highest possible score. Each
          visual memory, inspected detail, wrong guess, and extra second lowers
          the final leaderboard ceiling.
        </Text>
      </View>
    </>
  );
}
