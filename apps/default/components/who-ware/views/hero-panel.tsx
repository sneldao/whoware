import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { CinematicHero } from "@/components/who-ware/cinematic-hero";
import { IdentityCountdown } from "@/components/who-ware/identity-countdown";
import { IdentitySection } from "@/components/who-ware/identity-section";
import { ScoreTrajectory } from "@/components/who-ware/score-trajectory";
import { StreakBanner } from "@/components/who-ware/streak-banner";
import { TappableMetric } from "@/components/shared/tappable-metric";
import { theme } from "@/lib/theme";
import styles from "@/app/index.styles";

export interface HeroPanelProps {
  walletAddress: string | undefined;
  isWalletConnected: boolean;
  isCorrectChain: boolean;
  isSmartAccountUpgraded: boolean;
  isSmartAccountUpgrading: boolean;
  isMinting: boolean;
  isMinted: boolean;
  isStreakUpdating: boolean;
  hasStreakTx: boolean;
  archiveCount: number;
  imageKey: string | undefined;
  imageUrl: string | undefined;
  solvedImageKey: string | undefined;
  solvedImageUrl: string | undefined;
  revealProgress: number;
  isSolved: boolean;
  statusText: string;
  countdownTarget: number | null;
  countdownLabel: string;
  runFinished: boolean;
  currentStreak: number;
  bestStreak: number;
  solvedToday: boolean;
  hasEnteredMemory: boolean;
  isBusy: boolean;
  scoreDisplay: string;
  hotspotsOpened: number;
  guessesLeft: number;
  guessCap: number;
  rawScore: number | null;
  maxPotential: number;
  onConnect: () => void;
  onUpgrade: () => Promise<boolean>;
  onSwitchChain: () => void;
  onGuessNow: () => void;
  onEnterMemory: () => void;
  isGuessPanelOpen: boolean;
  onShowScoreTooltip: () => void;
  onShowCluesTooltip: () => void;
  onShowGuessesTooltip: () => void;
}

/**
 * The fixed hero block at the top of the game screen: brand row,
 * identity section, headline, status, countdown, streak, and the
 * primary call-to-action (either intro buttons or score strip).
 */
export function HeroPanel(props: HeroPanelProps) {
  const {
    walletAddress, isWalletConnected, isCorrectChain,
    isSmartAccountUpgraded, isSmartAccountUpgrading,
    isMinting, isMinted, isStreakUpdating, hasStreakTx,
    archiveCount, imageKey, imageUrl, solvedImageKey, solvedImageUrl,
    revealProgress, isSolved, statusText,
    countdownTarget, countdownLabel, runFinished,
    currentStreak, bestStreak, solvedToday,
    hasEnteredMemory, isBusy, scoreDisplay, hotspotsOpened, guessesLeft, guessCap,
    rawScore, maxPotential,
    onConnect, onUpgrade, onSwitchChain,
    onGuessNow, onEnterMemory, isGuessPanelOpen,
    onShowScoreTooltip, onShowCluesTooltip, onShowGuessesTooltip,
  } = props;

  return (
    <View style={styles.hero}>
      <CinematicHero
        imageKey={imageKey}
        revealProgress={revealProgress}
        isSolved={isSolved}
        solvedImageKey={solvedImageKey}
        imageUrl={imageUrl}
        solvedImageUrl={solvedImageUrl}
      />
      <View style={styles.heroContent}>
        <View style={styles.brandRow}>
          <View style={styles.logoMark}>
            <Ionicons name="eye" size={22} color={theme.inkOnAccent} />
          </View>
          <View style={styles.brandTextCol}>
            <Text style={styles.brand}>WhoWare</Text>
            <Text style={styles.drop}>Daily embodied history ritual</Text>
          </View>
          {archiveCount > 0 && (
            <Pressable style={styles.archiveBadge} href="/archive">
              <Ionicons name="archive-outline" size={11} color={theme.ink} />
              <Text style={styles.archiveBadgeText}>{archiveCount}</Text>
            </Pressable>
          )}
        </View>
        <IdentitySection
          walletAddress={walletAddress}
          isWalletConnected={isWalletConnected}
          isCorrectChain={isCorrectChain}
          isSmartAccountUpgraded={isSmartAccountUpgraded}
          isSmartAccountUpgrading={isSmartAccountUpgrading}
          isMinting={isMinting}
          isMinted={isMinted}
          isStreakUpdating={isStreakUpdating}
          hasStreakTx={hasStreakTx}
          type={hasEnteredMemory ? "during" : "start"}
          onConnect={onConnect}
          onUpgrade={onUpgrade}
          onSwitchChain={onSwitchChain}
        />
        <Text style={styles.headline}>Someone changed history{"\n"}from this room.</Text>
        <Text style={styles.subhead}>{statusText}</Text>
        <IdentityCountdown
          isSolved={isSolved}
          dropsAt={countdownTarget}
          statusLabel={countdownLabel}
        />
        {runFinished && archiveCount > 0 && (
          <View style={styles.suggestionsCard}>
            <Pressable style={styles.suggestionRow} href="/archive">
              <Ionicons name="archive-outline" size={14} color={theme.violet} />
              <Text style={styles.suggestionText}>
                {archiveCount} past episode{archiveCount !== 1 ? "s" : ""} to explore
              </Text>
            </Pressable>
            <Pressable style={styles.suggestionRow} href="/curator">
              <Ionicons name="layers" size={14} color={theme.violet} />
              <Text style={styles.suggestionText}>How episodes are made</Text>
            </Pressable>
          </View>
        )}
        <StreakBanner current={currentStreak} best={bestStreak} solvedToday={solvedToday} />
        {!hasEnteredMemory ? (
          <View style={styles.introActions}>
            <Pressable
              accessibilityRole="button"
              onPress={onGuessNow}
              disabled={isBusy}
              style={({ pressed }) => [styles.secondaryIntroButton, pressed && styles.pressed, isBusy && styles.disabledButton]}
            >
              <Ionicons name="finger-print" size={18} color={theme.ink} />
              <Text style={styles.secondaryIntroButtonText}>
                {isGuessPanelOpen ? "Hide guess" : "Guess without a memory"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onEnterMemory}
              disabled={isBusy}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, isBusy && styles.disabledButton]}
            >
              <Text style={styles.primaryButtonText}>
                {isBusy ? "Entering memory…" : "Enter first memory"}
              </Text>
              <Ionicons name="arrow-forward" size={18} color={theme.inkOnAccent} />
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.scoreStrip}>
              <TappableMetric label="Score" value={`${scoreDisplay} pts`} onPress={onShowScoreTooltip} />
              <TappableMetric label="Clues opened" value={`${hotspotsOpened}`} onPress={onShowCluesTooltip} />
              <TappableMetric label="Guesses" value={`${guessesLeft}/${guessCap}`} onPress={onShowGuessesTooltip} />
            </View>
            {rawScore != null && (
              <ScoreTrajectory currentScore={rawScore} maxPotential={maxPotential} label="Score trajectory" />
            )}
          </>
        )}
      </View>
    </View>
  );
}
