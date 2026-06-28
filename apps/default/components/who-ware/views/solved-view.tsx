import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { OnChainBadge } from "@/components/who-ware/on-chain-badge";
import { ResultShareCard } from "@/components/who-ware/result-share-card";
import { SmartAccountBadge } from "@/components/who-ware/smart-account-badge";
import { theme } from "@/lib/theme";
import styles from "@/app/index.styles";

export interface SolvedViewProps {
  // Result share card
  episodeNumber: number;
  memoriesViewed: number;
  cluesOpened: number;
  elapsedMs: number;
  score: number;
  rank: number | null;
  rankedCount: number;
  streak: number;
  guessesUsed: number;
  hotspotsOpened: number;
  difficulty: string;
  figureEra?: string;
  figureRegion?: string;
  // On-chain row
  isSmartAccountUpgraded: boolean;
  delegationTxHash: string | null;
  isDelegating: boolean;
  mintTxHash: string | null;
  isMinting: boolean;
  streakTxHash: string | null;
  isStreakUpdating: boolean;
  onShowDelegationTooltip: () => void;
  onShowMintTooltip: () => void;
  onShowStreakTooltip: () => void;
  // Next actions
  onShowHistory: () => void;
  onShare: () => void;
}

/**
 * The post-solve view: result share card, on-chain badge row, smart-account
 * badge, and the next-actions row. Shown after the player solves the episode.
 */
export function SolvedView(props: SolvedViewProps) {
  const {
    episodeNumber, memoriesViewed, cluesOpened, elapsedMs, score, rank, rankedCount,
    streak, guessesUsed, hotspotsOpened, difficulty, figureEra, figureRegion,
    isSmartAccountUpgraded, delegationTxHash, isDelegating,
    mintTxHash, isMinting, streakTxHash, isStreakUpdating,
    onShowDelegationTooltip, onShowMintTooltip, onShowStreakTooltip,
    onShowHistory, onShare,
  } = props;

  return (
    <>
      <ResultShareCard
        episodeNumber={episodeNumber}
        memoriesViewed={memoriesViewed}
        cluesOpened={cluesOpened}
        elapsedMs={elapsedMs}
        score={score}
        rank={rank}
        rankedCount={rankedCount}
        streak={streak}
        guessesUsed={guessesUsed}
        hotspotsOpened={hotspotsOpened}
        difficulty={difficulty}
        figureEra={figureEra}
        figureRegion={figureRegion}
      />
      <View style={styles.onChainRow}>
        {isSmartAccountUpgraded && (
          <OnChainBadge
            txHash={delegationTxHash}
            isMinting={isDelegating}
            mintingLabel="Granting ERC-7710 delegation…"
            verifiedLabel="ERC-7710 delegation live"
            onTooltipPress={onShowDelegationTooltip}
          />
        )}
        <OnChainBadge
          txHash={mintTxHash}
          isMinting={isMinting}
          mintingLabel="Minting score…"
          verifiedLabel="Score on Mantle"
          onTooltipPress={onShowMintTooltip}
        />
        <OnChainBadge
          txHash={streakTxHash}
          isMinting={isStreakUpdating}
          mintingLabel="Updating streak…"
          verifiedLabel="Streak on Mantle"
          onTooltipPress={onShowStreakTooltip}
        />
      </View>
      {isSmartAccountUpgraded && <SmartAccountBadge isUpgraded isUpgrading={false} onUpgrade={async () => true} />}
      <View style={styles.nextActionsRow}>
        <Pressable style={styles.nextActionButton} href="/archive">
          <Ionicons name="archive-outline" size={14} color={theme.ink} />
          <Text style={styles.nextActionText}>Archive</Text>
        </Pressable>
        <Pressable style={styles.nextActionButton} onPress={onShare}>
          <Ionicons name="share-outline" size={14} color={theme.ink} />
          <Text style={styles.nextActionText}>Share</Text>
        </Pressable>
        <Pressable style={styles.nextActionButton} onPress={onShowHistory}>
          <Ionicons name="list-outline" size={14} color={theme.ink} />
          <Text style={styles.nextActionText}>History</Text>
        </Pressable>
        <Pressable style={styles.nextActionButton}>
          <Ionicons name="calendar-outline" size={14} color={theme.ink} />
          <Text style={styles.nextActionText}>Tomorrow</Text>
        </Pressable>
      </View>
    </>
  );
}
