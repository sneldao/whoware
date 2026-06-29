import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { OnChainBadge } from "@/components/who-ware/on-chain-badge";
import { ResultShareCard } from "@/components/who-ware/result-share-card";
import { SmartAccountBadge } from "@/components/who-ware/smart-account-badge";
import { theme } from "@/lib/theme";
import type { SolvedViewProps } from "./props";
import styles from "@/app/index.styles";

export type { SolvedViewProps } from "./props";

/**
 * The post-solve view: result share card, on-chain badge row, smart-account
 * badge, and the next-actions row. Shown after the player solves the episode.
 */
export function SolvedView(props: SolvedViewProps) {
  const { result, onchain, nextActions } = props;
  const {
    isSmartAccountUpgraded, delegationTxHash, isDelegating,
    mintTxHash, isMinting, streakTxHash, isStreakUpdating,
    onShowDelegationTooltip, onShowMintTooltip, onShowStreakTooltip,
  } = onchain;

  return (
    <>
      <ResultShareCard
        episodeNumber={result.episodeNumber}
        memoriesViewed={result.memoriesViewed}
        cluesOpened={result.cluesOpened}
        elapsedMs={result.elapsedMs}
        score={result.score}
        rank={result.rank}
        rankedCount={result.rankedCount}
        streak={result.streak}
        guessesUsed={result.guessesUsed}
        hotspotsOpened={result.hotspotsOpened}
        difficulty={result.difficulty}
        figureEra={result.figureEra}
        figureRegion={result.figureRegion}
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
        <Pressable style={styles.nextActionButton} onPress={nextActions.onShare}>
          <Ionicons name="share-outline" size={14} color={theme.ink} />
          <Text style={styles.nextActionText}>Share</Text>
        </Pressable>
        <Pressable style={styles.nextActionButton} onPress={nextActions.onShowHistory}>
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
