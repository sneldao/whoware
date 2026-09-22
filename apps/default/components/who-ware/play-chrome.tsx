import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { ClueLedger } from "@/components/who-ware/clue-ledger";
import { DeductionBoard } from "@/components/who-ware/deduction-board";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { GuessPanel } from "@/components/who-ware/guess-panel";
import { IdentityHintButton } from "@/components/who-ware/identity-hint-button";
import { Leaderboard } from "@/components/who-ware/leaderboard";
import { TappableMetric } from "@/components/shared/tappable-metric";
import { MEMORY_PENALTY } from "@/convex/scoring";
import { theme } from "@/lib/theme";
import type { ActionState, ExtrasState, GuessState, SceneState } from "@/components/who-ware/views/props";
import styles from "@/app/index.styles";

export interface PlayChromeMetrics {
  scoreDisplay: string;
  /** True while the score is the live projected ceiling (pre-solve). */
  scoreIsLive: boolean;
  hotspotsOpened: number;
  hintsUsed: number;
  guessesLeft: number;
  guessCap: number;
  onShowScoreTooltip: () => void;
  onShowCluesTooltip: () => void;
  onShowHintsTooltip: () => void;
  onShowGuessesTooltip: () => void;
}

interface PlayChromeProps {
  scene: SceneState;
  actions: ActionState;
  guess: GuessState;
  extras: ExtrasState;
  metrics: PlayChromeMetrics;
  /** Overlay: glass HUD over the room. Stacked: classic below-scene layout. */
  layout?: "overlay" | "stacked";
  onOpenHowTo?: () => void;
}

/**
 * Scene-less play chrome: metrics, actions, rail, ledger, guess, leaderboard.
 * ImmersionSession owns MemoryScene; this is the unlockable HUD.
 */
export function PlayChrome({
  scene,
  actions,
  guess,
  extras,
  metrics,
  layout = "stacked",
  onOpenHowTo,
}: PlayChromeProps) {
  const {
    isGuessPanelOpen, isSolved, isExhausted,
    moreMemoriesAvailable, isBusy,
    onToggleGuessPanel, onUnlockNextMemory,
    pulseNextMemory = false,
  } = actions;
  const {
    figureOptions, guessesLeft, playerName, onPlayerNameChange, onSubmitGuess,
  } = guess;
  const {
    episodeId, runId, memoriesViewed, currentStreak,
    leaderboardEntries, playerRank, rankedCount,
  } = extras;

  const insets = useSafeAreaInsets();
  const [cluesSheetOpen, setCluesSheetOpen] = useState(false);
  /** The standings stay one tap away but never shout over the accusation. */
  const [boardOpen, setBoardOpen] = useState(false);
  const showLeaderboard = isGuessPanelOpen;
  /** Dense panel only when guessing or reviewing clues — keep the room dominant. */
  const sheetExpanded = isGuessPanelOpen || cluesSheetOpen;

  useEffect(() => {
    if (isGuessPanelOpen) setCluesSheetOpen(false);
  }, [isGuessPanelOpen]);

  const pulseScale = useSharedValue(1);
  useEffect(() => {
    if (!pulseNextMemory || !moreMemoriesAvailable) {
      pulseScale.value = 1;
      return;
    }
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 420 }),
        withTiming(1, { duration: 420 }),
      ),
      3,
      false,
    );
  }, [pulseNextMemory, moreMemoriesAvailable, pulseScale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const rail = (
    <View style={layout === "overlay" ? overlayStyles.railRow : styles.sceneRail}>
      {scene.visibleSceneIndices.map((epiIdx, railIndex) => (
        <Pressable
          key={epiIdx}
          accessibilityRole="button"
          onPress={() => scene.onSelectScene(epiIdx)}
          style={[styles.scenePill, scene.currentSceneIndex === epiIdx && styles.scenePillActive]}
        >
          <Text style={[styles.scenePillText, scene.currentSceneIndex === epiIdx && styles.scenePillTextActive]}>
            {railIndex + 1}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const denseSheet = (
    <>
      {(cluesSheetOpen || isGuessPanelOpen) && (
        <ClueLedger clues={scene.discoveredClues} totalCluesAvailable={scene.totalAccessibleScenes * 3} />
      )}
      {isGuessPanelOpen && episodeId && !isSolved && !isExhausted && (
        <IdentityHintButton
          episodeId={episodeId}
          runId={runId}
          scenesRevealed={memoriesViewed}
          streak={currentStreak}
          isRunActive={!isSolved && !isExhausted}
        />
      )}
      {guess.guessAttempts && guess.guessAttempts.length > 0 && (
        <DeductionBoard attempts={guess.guessAttempts} maxGuesses={metrics.guessCap} />
      )}
      {(isGuessPanelOpen || isSolved || isExhausted || guessesLeft <= 0) && (
        <GuessPanel
          figures={figureOptions}
          guessesLeft={guessesLeft}
          isSolved={isSolved || isExhausted}
          playerName={playerName}
          onPlayerNameChange={onPlayerNameChange}
          onSubmit={onSubmitGuess}
        />
      )}
      {showLeaderboard ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: boardOpen }}
            onPress={() => setBoardOpen((open) => !open)}
            style={({ pressed }) => [overlayStyles.boardToggle, pressed && overlayStyles.pressed]}
          >
            <Ionicons name={boardOpen ? "chevron-up" : "podium-outline"} size={12} color={theme.inkAlpha50} />
            <Text style={overlayStyles.boardToggleText}>
              {boardOpen ? "Hide the case board" : "Case board — today's standings"}
            </Text>
          </Pressable>
          {boardOpen ? (
            <ErrorBoundary label="Leaderboard">
              <Leaderboard
                entries={leaderboardEntries}
                playerRank={playerRank}
                rankedCount={rankedCount}
              />
            </ErrorBoundary>
          ) : null}
        </>
      ) : null}
    </>
  );

  if (layout === "stacked") {
    return (
      <>
        <View style={styles.actionBar}>
          <Pressable
            accessibilityRole="button"
            onPress={onToggleGuessPanel}
            style={({ pressed }) => [styles.actionButton, styles.guessButton, pressed && styles.pressed]}
          >
            <Ionicons name="finger-print" size={18} color={theme.inkOnAccent} />
            <Text style={styles.guessButtonText}>
              {isGuessPanelOpen ? "Back to the room" : "Guess"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!moreMemoriesAvailable || isSolved || isBusy}
            onPress={onUnlockNextMemory}
            style={({ pressed }) => [
              styles.actionButton,
              styles.secondaryButton,
              (!moreMemoriesAvailable || isSolved) && styles.disabledButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {moreMemoriesAvailable ? `Next scene · −${MEMORY_PENALTY.toLocaleString()}` : "Every scene open"}
            </Text>
          </Pressable>
        </View>
        {rail}
        {denseSheet}
      </>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(400)} style={overlayStyles.root} pointerEvents="box-none">
      <View
        style={[overlayStyles.topStrip, { paddingTop: Math.max(12, insets.top + 8) }]}
        pointerEvents="box-none"
      >
        <View style={overlayStyles.topRow}>
          {/* Three pills, three jobs: stakes, evidence, accusation. The
              whisper count folds into the ceiling tooltip — one less voice. */}
          <View style={overlayStyles.metrics}>
            <TappableMetric
              label={metrics.scoreIsLive ? "Ceiling · live" : "Score"}
              value={`${metrics.scoreDisplay} pts`}
              onPress={metrics.onShowScoreTooltip}
            />
            <TappableMetric
              label="Evidence"
              value={`${metrics.hotspotsOpened}${metrics.hintsUsed > 0 ? ` · ${metrics.hintsUsed}✦` : ""}`}
              onPress={() => setCluesSheetOpen((open) => !open)}
            />
            <TappableMetric
              label="Guesses"
              value={`${"●".repeat(metrics.guessesLeft)}${"○".repeat(Math.max(0, metrics.guessCap - metrics.guessesLeft))}`}
              onPress={onToggleGuessPanel}
            />
          </View>
          {onOpenHowTo ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="How to play"
              onPress={onOpenHowTo}
              style={({ pressed }) => [overlayStyles.howTo, pressed && overlayStyles.pressed]}
            >
              <Ionicons name="help-circle-outline" size={18} color={theme.inkAlpha70} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View
        style={[overlayStyles.bottomDock, { paddingBottom: Math.max(14, insets.bottom + 10) }]}
        pointerEvents="box-none"
      >
        {rail}
        <View style={overlayStyles.actionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={onToggleGuessPanel}
            style={({ pressed }) => [overlayStyles.primaryBtn, pressed && overlayStyles.pressed]}
          >
            <Ionicons name="finger-print" size={16} color={theme.inkOnAccent} />
            <Text style={overlayStyles.primaryBtnText}>
              {isGuessPanelOpen ? "Back to the room" : "Guess"}
            </Text>
          </Pressable>
          <Animated.View
            style={[
              overlayStyles.secondaryWrap,
              pulseNextMemory && moreMemoriesAvailable ? pulseStyle : undefined,
            ]}
          >
            <Pressable
              accessibilityRole="button"
              disabled={!moreMemoriesAvailable || isSolved || isBusy}
              onPress={onUnlockNextMemory}
              style={({ pressed }) => [
                overlayStyles.secondaryBtn,
                pulseNextMemory && moreMemoriesAvailable && overlayStyles.secondaryBtnPulse,
                (!moreMemoriesAvailable || isSolved || isBusy) && overlayStyles.disabled,
                pressed && overlayStyles.pressed,
              ]}
            >
              <Text style={overlayStyles.secondaryBtnText}>
                {moreMemoriesAvailable ? `Next scene · −${MEMORY_PENALTY.toLocaleString()}` : "Every scene open"}
              </Text>
            </Pressable>
          </Animated.View>
        </View>

        {sheetExpanded ? (
          <Animated.View entering={FadeIn.duration(280)} style={overlayStyles.sheet}>
            <ScrollView
              style={overlayStyles.sheetScroll}
              contentContainerStyle={overlayStyles.sheetContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {denseSheet}
            </ScrollView>
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const overlayStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  topStrip: {
    paddingTop: 16,
    paddingHorizontal: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  metrics: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 10,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(8, 5, 2, 0.62)",
    borderWidth: 1,
    borderColor: "rgba(255, 240, 214, 0.12)",
  },
  howTo: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8, 5, 2, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 240, 214, 0.12)",
  },
  bottomDock: {
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  railRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryBtn: {
    flex: 1.2,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: theme.accent,
  },
  primaryBtnText: {
    color: theme.inkOnAccent,
    fontSize: 14,
    fontWeight: "900",
  },
  secondaryWrap: {
    flex: 1,
  },
  secondaryBtn: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: theme.inkAlpha25,
    backgroundColor: "rgba(12, 8, 4, 0.55)",
  },
  secondaryBtnPulse: {
    borderColor: theme.accentAlpha28,
    backgroundColor: "rgba(217, 119, 6, 0.18)",
  },
  secondaryBtnText: {
    color: theme.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.75,
  },
  boardToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 12,
    borderCurve: "continuous",
    backgroundColor: theme.inkAlpha04,
    borderWidth: 1,
    borderColor: theme.inkAlpha8,
  },
  boardToggleText: {
    color: theme.inkAlpha55,
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  sheet: {
    maxHeight: 280,
    borderRadius: 22,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: "rgba(8, 5, 2, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(255, 240, 214, 0.12)",
  },
  sheetScroll: {
    maxHeight: 280,
  },
  sheetContent: {
    padding: 14,
    gap: 12,
  },
});
