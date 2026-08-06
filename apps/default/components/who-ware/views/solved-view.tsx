import { useState, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/lib/theme";
import { FigureRevealCard } from "@/components/who-ware/figure-reveal-card";
import { OnChainBadge } from "@/components/who-ware/on-chain-badge";
import { ResultShareCard } from "@/components/who-ware/result-share-card";
import { SmartAccountBadge } from "@/components/who-ware/smart-account-badge";
import { TodaysRoomStats } from "@/components/who-ware/todays-room-stats";
import type { SolvedViewProps } from "./props";
import styles from "@/app/index.styles";

export type { SolvedViewProps } from "./props";

type Tab = "story" | "score" | "room" | "chain";

const TABS: Array<{ key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: "story", label: "Story", icon: "book" },
  { key: "score", label: "Score", icon: "trophy" },
  { key: "room", label: "Room", icon: "people" },
  { key: "chain", label: "Chain", icon: "link" },
];

/**
 * Post-solve view with a tabbed layout. Instead of stacking 5 cards
 * vertically (bio → score → community → on-chain → actions), the view
 * shows a compact tab bar. The story tab is default (figure bio + share),
 * with the other tabs collapsing the remaining content.
 *
 * This keeps the post-solve moment focused and reduces scroll fatigue
 * on mobile, while keeping all information one tap away.
 */
export function SolvedView(props: SolvedViewProps) {
  const { result, onchain, figureReveal, nextActions } = props;
  const {
    isSmartAccountUpgraded, delegationTxHash, isDelegating,
    mintTxHash, isMinting, streakTxHash, isStreakUpdating,
    onShowDelegationTooltip, onShowMintTooltip, onShowStreakTooltip,
  } = onchain;

  const [activeTab, setActiveTab] = useState<Tab>("story");

  const switchTab = useCallback((tab: Tab) => setActiveTab(tab), []);

  return (
    <>
      <FigureRevealCard
        episodeId={figureReveal.episodeId}
        figureName={figureReveal.figureName}
        figureEra={figureReveal.figureEra}
        figureRegion={figureReveal.figureRegion}
        figureTags={figureReveal.figureTags}
      />

      {/* Tab bar */}
      <View style={tabStyles.tabBar}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => switchTab(tab.key)}
              style={({ pressed }) => [
                tabStyles.tab,
                active && tabStyles.tabActive,
                pressed && tabStyles.pressed,
              ]}
            >
              <Ionicons
                name={tab.icon}
                size={13}
                color={active ? theme.accent : theme.inkAlpha50}
              />
              <Text style={[tabStyles.tabLabel, active && tabStyles.tabLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Tab content */}
      {activeTab === "story" && (
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
        </>
      )}

      {activeTab === "score" && (
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
        </>
      )}

      {activeTab === "room" && (
        <TodaysRoomStats episodeId={figureReveal.episodeId} />
      )}

      {activeTab === "chain" && (
        <>
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
        </>
      )}

      {/* Always-visible next actions */}
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
        <Pressable style={styles.nextActionButton} href="/weekly">
          <Ionicons name="calendar-outline" size={14} color={theme.ink} />
          <Text style={styles.nextActionText}>Recap</Text>
        </Pressable>
      </View>
    </>
  );
}

const tabStyles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 18,
    backgroundColor: theme.inkAlpha4,
    borderWidth: 1,
    borderColor: theme.inkAlpha8,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderRadius: 14,
  },
  tabActive: {
    backgroundColor: theme.accentAlpha12,
    borderWidth: 1,
    borderColor: theme.accentAlpha25,
  },
  tabLabel: {
    color: theme.inkAlpha50,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: theme.accent,
  },
  pressed: {
    opacity: 0.7,
  },
});
