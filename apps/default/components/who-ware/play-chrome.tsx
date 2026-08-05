import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { ClueLedger } from "@/components/who-ware/clue-ledger";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { GuessPanel } from "@/components/who-ware/guess-panel";
import { IdentityHintButton } from "@/components/who-ware/identity-hint-button";
import { Leaderboard } from "@/components/who-ware/leaderboard";
import { TappableMetric } from "@/components/shared/tappable-metric";
import { theme } from "@/lib/theme";
import type { ActionState, ExtrasState, GuessState, SceneState } from "@/components/who-ware/views/props";
import styles from "@/app/index.styles";

export interface PlayChromeMetrics {
  scoreDisplay: string;
  hotspotsOpened: number;
  guessesLeft: number;
  guessCap: number;
  onShowScoreTooltip: () => void;
  onShowCluesTooltip: () => void;
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
}: PlayChromeProps) {
  const {
    isGuessPanelOpen, isSolved, isExhausted,
    moreMemoriesAvailable, isBusy,
    onToggleGuessPanel, onUnlockNextMemory,
  } = actions;
  const {
    figureOptions, guessesLeft, playerName, onPlayerNameChange, onSubmitGuess,
  } = guess;
  const {
    episodeId, memoriesViewed, currentStreak,
    leaderboardEntries, playerRank, rankedCount,
  } = extras;

  const insets = useSafeAreaInsets();
  const [cluesSheetOpen, setCluesSheetOpen] = useState(false);
  const showLeaderboard = isGuessPanelOpen;
  /** Dense panel only when guessing or reviewing clues — keep the room dominant. */
  const sheetExpanded = isGuessPanelOpen || cluesSheetOpen;

  useEffect(() => {
    if (isGuessPanelOpen) setCluesSheetOpen(false);
  }, [isGuessPanelOpen]);

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
          scenesRevealed={memoriesViewed}
          streak={currentStreak}
          isRunActive={!isSolved && !isExhausted}
        />
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
        <ErrorBoundary label="Leaderboard">
          <Leaderboard
            entries={leaderboardEntries}
            playerRank={playerRank}
            rankedCount={rankedCount}
          />
        </ErrorBoundary>
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
              {isGuessPanelOpen ? "Hide guesses" : "Name identity"}
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
              {moreMemoriesAvailable ? "Unlock next memory" : "All memories open"}
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
        <View style={overlayStyles.metrics}>
          <TappableMetric
            label="Score"
            value={`${metrics.scoreDisplay} pts`}
            onPress={metrics.onShowScoreTooltip}
          />
          <TappableMetric
            label="Clues"
            value={`${metrics.hotspotsOpened}`}
            onPress={() => setCluesSheetOpen((open) => !open)}
          />
          <TappableMetric
            label="Guesses"
            value={`${metrics.guessesLeft}/${metrics.guessCap}`}
            onPress={metrics.onShowGuessesTooltip}
          />
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
              {isGuessPanelOpen ? "Hide guesses" : "Name identity"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!moreMemoriesAvailable || isSolved || isBusy}
            onPress={onUnlockNextMemory}
            style={({ pressed }) => [
              overlayStyles.secondaryBtn,
              (!moreMemoriesAvailable || isSolved || isBusy) && overlayStyles.disabled,
              pressed && overlayStyles.pressed,
            ]}
          >
            <Text style={overlayStyles.secondaryBtnText}>
              {moreMemoriesAvailable ? "Next memory" : "All open"}
            </Text>
          </Pressable>
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
  metrics: {
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
  secondaryBtn: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: theme.inkAlpha25,
    backgroundColor: "rgba(12, 8, 4, 0.55)",
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
