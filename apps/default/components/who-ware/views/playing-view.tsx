import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { ClueLedger } from "@/components/who-ware/clue-ledger";
import { EnhancedSceneTransition } from "@/components/who-ware/enhanced-scene-transition";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { GuessPanel } from "@/components/who-ware/guess-panel";
import { IdentityHintButton } from "@/components/who-ware/identity-hint-button";
import { Leaderboard } from "@/components/who-ware/leaderboard";
import { MemoryScene } from "@/components/who-ware/memory-scene";
import { theme } from "@/lib/theme";
import type { PlayingViewProps } from "./props";
import styles from "@/app/index.styles";

function StepBadge({ icon, label, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }) {
  return (
    <View style={styles.stepBadge}>
      <Ionicons name={icon} size={10} color={color} />
      <Text style={[styles.stepBadgeLabel, { color }]}>{label}</Text>
    </View>
  );
}

/**
 * The during-memory view: scene, action bar, scene rail, clue ledger,
 * identity hint button, guess panel, leaderboard, and the curator/analytics
 * footer block. Shown while the player is exploring memories and neither
 * solved nor exhausted.
 */
export function PlayingView(props: PlayingViewProps) {
  const { scene, actions, guess, extras } = props;
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
    archiveCount, isPushOptedIn, isPushBusy, onTogglePush,
  } = extras;

  return (
    <>
      <ErrorBoundary label="Scene3D" fallback={(reset) => (
        <View style={styles.actionBar}>
          <Pressable onPress={reset} style={({ pressed }) => [styles.actionButton, styles.guessButton, pressed && styles.pressed]}>
            <Ionicons name="refresh" size={18} color={theme.inkOnAccent} />
            <Text style={styles.guessButtonText}>Reload scene</Text>
          </Pressable>
        </View>
      )}>
        <EnhancedSceneTransition
          sceneIndex={scene.sceneIndex}
          title={scene.scene.title}
          location={scene.scene.location}
          era={scene.scene.era}
          palette={scene.scene.palette}
        >
          <MemoryScene
            scene={scene.scene as unknown as Parameters<typeof MemoryScene>[0]["scene"]}
            sceneIndex={scene.sceneIndex}
            totalScenes={scene.totalAccessibleScenes}
            onHotspotOpen={scene.onHotspotOpen}
            onGenerateHint={scene.onGenerateHint}
            activeHint={scene.activeHint}
            isHintGenerating={scene.isHintGenerating}
          />
        </EnhancedSceneTransition>
      </ErrorBoundary>
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
      <View style={styles.sceneRail}>
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
      <ClueLedger clues={scene.discoveredClues} totalCluesAvailable={scene.totalAccessibleScenes * 3} />
      {episodeId && !isSolved && !isExhausted && (
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
      <ErrorBoundary label="Leaderboard">
        <Leaderboard
          entries={leaderboardEntries}
          playerRank={playerRank}
          rankedCount={rankedCount}
        />
      </ErrorBoundary>
      {archiveCount > 0 && (
        <Pressable style={styles.curatorLink} href="/archive">
          <Ionicons name="archive-outline" size={14} color={theme.neutralDark} />
          <Text style={styles.curatorLinkText}>Archive · {archiveCount}</Text>
        </Pressable>
      )}
      <View style={styles.venicePipelineCard}>
        <View style={styles.venicePipelineHeader}>
          <View style={styles.venicePipelineIcon}>
            <Ionicons name="layers" size={16} color={theme.violet} />
          </View>
          <View style={styles.venicePipelineInfo}>
            <Text style={styles.venicePipelineTitle}>Autonomous Agent Pipeline</Text>
            <Text style={styles.venicePipelineSub}>
              Scenes · Images · Hints · Calibration — all generated by Venice AI
            </Text>
          </View>
        </View>
        <View style={styles.venicePipelineSteps}>
          <StepBadge icon="search" label="Select" color={theme.violet} />
          <Ionicons name="arrow-forward" size={10} color={theme.inkAlpha20} />
          <StepBadge icon="sparkles" label="Write" color={theme.violet} />
          <Ionicons name="arrow-forward" size={10} color={theme.inkAlpha20} />
          <StepBadge icon="shield-checkmark" label="Verify" color={theme.success} />
          <Ionicons name="arrow-forward" size={10} color={theme.inkAlpha20} />
          <StepBadge icon="trending-up" label="Calibrate" color={theme.accent} />
          <Ionicons name="arrow-forward" size={10} color={theme.inkAlpha20} />
          <StepBadge icon="image" label="Render" color={theme.violet} />
        </View>
        <Pressable href="/curator" style={({ pressed }) => [styles.venicePipelineAction, pressed && styles.pressed]}>
          <Text style={styles.venicePipelineActionText}>Open AI Curator Studio</Text>
          <Ionicons name="arrow-forward" size={14} color={theme.inkOnAccent} />
        </Pressable>
      </View>
      <Pressable style={styles.curatorLink} href="/analytics">
        <Ionicons name="pulse-outline" size={14} color={theme.neutralDark} />
        <Text style={styles.curatorLinkText}>Pulse</Text>
      </Pressable>
      <Pressable style={styles.curatorLink} onPress={onTogglePush} disabled={isPushBusy}>
        <Ionicons
          name={isPushOptedIn ? "notifications" : "notifications-off-outline"}
          size={14}
          color={isPushOptedIn ? theme.accent : theme.neutralDark}
        />
        <Text style={styles.curatorLinkText}>
          {isPushBusy ? "Updating…" : isPushOptedIn ? "Drop alerts on" : "Drop alerts off"}
        </Text>
      </Pressable>
    </>
  );
}
