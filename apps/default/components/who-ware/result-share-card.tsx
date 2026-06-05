import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
import { Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";

// Spoiler-free result card.

interface ResultShareCardProps {
  episodeNumber: number;
  memoriesViewed: number;
  cluesOpened: number;
  elapsedMs: number;
  score: number;
  rank: number | null;
  rankedCount: number;
  streak?: number;
  guessesUsed?: number;
  hotspotsOpened?: number;
  difficulty?: "iconic" | "field" | "research";
  figureEra?: string;
  figureRegion?: string;
}

const DIFFICULTY_PALETTE: Record<string, { bg: string; fg: string; label: string }> = {
  iconic: { bg: "rgba(251, 191, 36, 0.22)", fg: "#FBBF24", label: "Iconic" },
  field: { bg: "rgba(134, 239, 172, 0.22)", fg: "#86EFAC", label: "Field" },
  research: { bg: "rgba(147, 197, 253, 0.22)", fg: "#93C5FD", label: "Research" },
};

/**
 * Spoiler-free, screenshot-ready result card. NEVER shows the identity — only
 * the player's efficiency footprint — so it is safe to post and drives the
 * curiosity-gap viral loop (Wordle-style).
 */
export function ResultShareCard({
  episodeNumber,
  memoriesViewed,
  cluesOpened,
  elapsedMs,
  score,
  rank,
  rankedCount,
  streak = 0,
  guessesUsed = 1,
  hotspotsOpened = 0,
  difficulty,
  figureEra,
  figureRegion,
}: ResultShareCardProps) {
  const cardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const memoryGrid = buildMemoryGrid(memoriesViewed, cluesOpened);
  const percentile = rank && rankedCount > 0 ? Math.max(1, Math.round((rank / rankedCount) * 100)) : null;
  const shareText = buildShareText({ episodeNumber, memoryGrid, memoriesViewed, cluesOpened, elapsedMs, percentile, streak });
  const difficultyStyle = difficulty ? DIFFICULTY_PALETTE[difficulty] ?? DIFFICULTY_PALETTE.iconic : null;

  async function handleShare() {
    if (isSharing) return;
    setIsSharing(true);
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      // Try to share the rendered card as an image first (richest payload).
      if (Platform.OS !== "web" && cardRef.current) {
        const uri = await captureRef(cardRef, { format: "png", quality: 1 });
        const canShareFile = await Sharing.isAvailableAsync();
        if (canShareFile) {
          await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share your WhoWare result" });
          return;
        }
      }
      await Share.share({ message: shareText });
    } catch {
      // Sharing dismissed or unavailable — fall back to text share quietly.
      try {
        await Share.share({ message: shareText });
      } catch {
        // no-op: user dismissed
      }
    } finally {
      setIsSharing(false);
    }
  }

  async function handleCopy() {
    if (isCopied) return;
    await Clipboard.setStringAsync(shareText);
    setIsCopied(true);
    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setTimeout(() => setIsCopied(false), 1800);
  }

  return (
    <View style={styles.container}>
      <View ref={cardRef} collapsable={false} style={styles.captureSurface}>
        <LinearGradient colors={["#2A1A09", "#140C04"]} style={StyleSheet.absoluteFill} />
        <View style={styles.cardHeader}>
          <View style={styles.brandMark}>
            <Ionicons name="eye" size={16} color="#1C1106" />
          </View>
          <Text style={styles.brandName}>WhoWare</Text>
          <View style={styles.headerChips}>
            {difficultyStyle ? (
              <View style={[styles.chip, { backgroundColor: difficultyStyle.bg }]}>
                <Text style={[styles.chipText, { color: difficultyStyle.fg }]}>{difficultyStyle.label}</Text>
              </View>
            ) : null}
            <Text style={styles.episodeTag}>#{episodeNumber}</Text>
          </View>
        </View>

        <Text style={styles.solvedLabel}>Identity anchored</Text>

        {figureEra && figureRegion ? (
          <Text style={styles.figureContext}>
            {figureEra} · {figureRegion}
          </Text>
        ) : null}

        <View style={styles.gridRow}>
          {memoryGrid.map((symbol, index) => (
            <Text key={index} style={styles.gridSymbol}>
              {symbol}
            </Text>
          ))}
        </View>

        <View style={styles.statRow}>
          <ShareStat label="Memories" value={`${memoriesViewed}`} />
          <ShareStat label="Clues" value={`${cluesOpened}`} />
          <ShareStat label="Time" value={formatElapsed(elapsedMs)} />
        </View>

        <View style={styles.statRow}>
          <ShareStat label="Guesses" value={`${guessesUsed}`} />
          <ShareStat label="Hotspots" value={`${hotspotsOpened}`} />
          <ShareStat label="Score" value={formatScore(score)} />
        </View>

        <View style={styles.scoreRow}>
          <Text style={styles.scoreValue}>{formatScore(score)} pts</Text>
          {percentile !== null ? <Text style={styles.percentile}>Top {percentile}%</Text> : null}
        </View>

        {streak > 0 ? (
          <View style={styles.streakRow}>
            <Ionicons name="flame" size={15} color="#FB923C" />
            <Text style={styles.streakText}>{streak}-day streak</Text>
          </View>
        ) : null}

        <Text style={styles.tagline}>Can you name them in fewer? · whoware.app</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={handleCopy}
          disabled={isCopied}
          style={({ pressed }) => [styles.copyButton, pressed && styles.pressed, isCopied && styles.copyButtonDone]}
        >
          <Ionicons name={isCopied ? "checkmark" : "copy-outline"} size={18} color="#FBBF24" />
          <Text style={styles.copyButtonText}>{isCopied ? "Copied" : "Copy text"}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={handleShare}
          disabled={isSharing}
          style={({ pressed }) => [styles.shareButton, pressed && styles.pressed, isSharing && styles.shareButtonBusy]}
        >
          <Ionicons name="share-outline" size={18} color="#1C1106" />
          <Text style={styles.shareButtonText}>{isSharing ? "Opening share…" : "Share (no spoilers)"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

interface ShareStatProps {
  label: string;
  value: string;
}

function ShareStat({ label, value }: ShareStatProps) {
  return (
    <View style={styles.shareStat}>
      <Text style={styles.shareStatValue}>{value}</Text>
      <Text style={styles.shareStatLabel}>{label}</Text>
    </View>
  );
}

function buildMemoryGrid(memoriesViewed: number, cluesOpened: number): string[] {
  // One tile per memory opened (🟫), plus a magnifier per clue inspected (🔍).
  // An unassisted solve shows a single gold tile (🟨) — the flex flex.
  if (memoriesViewed <= 0) return ["🟨"];
  const tiles: string[] = [];
  for (let index = 0; index < Math.min(memoriesViewed, 5); index += 1) tiles.push("🟫");
  for (let index = 0; index < Math.min(cluesOpened, 5); index += 1) tiles.push("🔍");
  return tiles;
}

function buildShareText(args: {
  episodeNumber: number;
  memoryGrid: string[];
  memoriesViewed: number;
  cluesOpened: number;
  elapsedMs: number;
  percentile: number | null;
  streak: number;
}): string {
  const { episodeNumber, memoryGrid, memoriesViewed, cluesOpened, elapsedMs, percentile, streak } = args;
  const memoryLabel = memoriesViewed === 1 ? "memory" : "memories";
  const percentileLine = percentile !== null ? ` · top ${percentile}%` : "";
  const streakLine = streak > 0 ? ` · 🔥${streak}` : "";
  return [
    `WhoWare #${episodeNumber}`,
    memoryGrid.join(""),
    `${memoriesViewed} ${memoryLabel} · ${cluesOpened} clues · ${formatElapsed(elapsedMs)}${percentileLine}${streakLine}`,
    `Can you name them in fewer? whoware.app`,
  ].join("\n");
}

function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatScore(score: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(score);
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  captureSurface: {
    overflow: "hidden",
    padding: 22,
    gap: 14,
    borderRadius: 28,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.28)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FBBF24",
  },
  brandName: {
    flex: 1,
    color: "#FFF7ED",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  episodeTag: {
    color: "rgba(251, 191, 36, 0.9)",
    fontSize: 16,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  headerChips: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  solvedLabel: {
    color: "rgba(255, 247, 237, 0.6)",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  figureContext: {
    color: "rgba(255, 247, 237, 0.7)",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  gridRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  gridSymbol: {
    fontSize: 26,
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
  },
  shareStat: {
    flex: 1,
    padding: 11,
    gap: 3,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.1)",
  },
  shareStatValue: {
    color: "#FFF7ED",
    fontSize: 17,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  shareStatLabel: {
    color: "rgba(255, 247, 237, 0.5)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  scoreValue: {
    color: "#FBBF24",
    fontSize: 24,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  streakText: {
    color: "#FB923C",
    fontSize: 13,
    fontWeight: "900",
  },
  percentile: {
    color: "#FFF7ED",
    fontSize: 15,
    fontWeight: "900",
  },
  tagline: {
    color: "rgba(255, 247, 237, 0.42)",
    fontSize: 12,
    fontWeight: "800",
  },
  shareButton: {
    flex: 1,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "#FBBF24",
  },
  shareButtonBusy: {
    opacity: 0.7,
  },
  shareButtonText: {
    color: "#1C1106",
    fontSize: 15,
    fontWeight: "900",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  copyButton: {
    minHeight: 54,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(251, 191, 36, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.4)",
  },
  copyButtonDone: {
    backgroundColor: "rgba(134, 239, 172, 0.14)",
    borderColor: "rgba(134, 239, 172, 0.5)",
  },
  copyButtonText: {
    color: "#FBBF24",
    fontSize: 14,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.72,
  },
});
