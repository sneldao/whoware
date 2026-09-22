import { theme } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";

export const DIFFICULTY_PALETTE: Record<string, { bg: string; fg: string; label: string }> = {
  iconic: { bg: theme.accentAlpha22, fg: theme.accent, label: "Iconic" },
  field: { bg: "rgba(134, 239, 172, 0.22)", fg: "#86EFAC", label: "Field" },
  research: { bg: "rgba(147, 197, 253, 0.22)", fg: "#93C5FD", label: "Research" },
};

interface ResultShareCardProps {
  episodeNumber: number;
  figureName: string;
  outcome: "solved" | "exhausted";
  score: number;
  guessesUsed?: number;
  maxGuesses?: number;
  difficulty?: "iconic" | "field" | "research";
  figureEra?: string;
  figureRegion?: string;
  /** Optional app/site URL appended to the share text. */
  siteUrl?: string;
}

const FILLED = "🟧";
const EMPTY = "⬜";

function buildEmojiRow(filled: number, total: number): string {
  const safeTotal = Math.max(0, total);
  const safeFilled = Math.max(0, Math.min(filled, safeTotal));
  return FILLED.repeat(safeFilled) + EMPTY.repeat(Math.max(0, safeTotal - safeFilled));
}

function buildShareText(args: {
  episodeNumber: number;
  figureName: string;
  outcome: "solved" | "exhausted";
  score: number;
  guessesUsed: number;
  maxGuesses: number;
  difficulty?: "iconic" | "field" | "research";
  figureEra?: string;
  figureRegion?: string;
  siteUrl?: string;
}): string {
  const outcomeLabel = args.outcome === "solved" ? "Solved" : "Missed";
  const diff = args.difficulty ? ` · ${args.difficulty}` : "";
  const era = args.figureEra ? ` · ${args.figureEra}` : "";
  const region = args.figureRegion ? ` · ${args.figureRegion}` : "";
  const row = buildEmojiRow(args.guessesUsed, args.maxGuesses);
  const tail = args.siteUrl ? `\n${args.siteUrl}` : "";
  return [
    `WhoWare #${String(args.episodeNumber).padStart(3, "0")}${diff}`,
    `${outcomeLabel}: ${args.figureName}${era}${region}`,
    `${row}  ${args.score.toLocaleString()} pts`,
    tail,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Compact result card. Copy-button and native share — that's the whole job.
 * Heavy rank/grade/streak chrome and the image-capture pipeline moved out
 * to keep this lean (v0.2 cut #6).
 */
export function ResultShareCard({
  episodeNumber,
  figureName,
  outcome,
  score,
  guessesUsed = 1,
  maxGuesses = 8,
  difficulty,
  figureEra,
  figureRegion,
  siteUrl,
}: ResultShareCardProps) {
  const [copied, setCopied] = useState(false);

  const shareText = buildShareText({
    episodeNumber,
    figureName,
    outcome,
    score,
    guessesUsed,
    maxGuesses,
    difficulty,
    figureEra,
    figureRegion,
    siteUrl,
  });

  const difficultyStyle = difficulty ? DIFFICULTY_PALETTE[difficulty] ?? DIFFICULTY_PALETTE.iconic : null;

  async function handleCopy() {
    await Clipboard.setStringAsync(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function handleShare() {
    try {
      await Share.share({ message: shareText });
    } catch {
      /* user cancelled */
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.episode}>WhoWare #{String(episodeNumber).padStart(3, "0")}</Text>
        {difficultyStyle ? (
          <View style={[styles.pill, { backgroundColor: difficultyStyle.bg }]}>
            <Text style={[styles.pillText, { color: difficultyStyle.fg }]}>{difficultyStyle.label}</Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.figureName, outcome === "exhausted" && styles.figureNameMissed]}>
        {outcome === "exhausted" ? "Missed: " : "Solved: "}
        {figureName}
      </Text>

      {(figureEra || figureRegion) ? (
        <Text style={styles.meta}>
          {[figureEra, figureRegion].filter(Boolean).join(" · ")}
        </Text>
      ) : null}

      <View style={styles.row}>
        <Text style={styles.rowEmoji}>{buildEmojiRow(guessesUsed, maxGuesses)}</Text>
        <Text style={styles.rowScore}>{score.toLocaleString()} pts</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copy result"
          onPress={handleCopy}
          style={({ pressed }) => [styles.action, pressed && styles.pressed, copied && styles.actionDone]}
        >
          <Ionicons name={copied ? "checkmark" : "copy-outline"} size={15} color={copied ? "#86EFAC" : theme.accent} />
          <Text style={[styles.actionText, copied && styles.actionTextDone]}>
            {copied ? "Copied" : "Copy"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share result"
          onPress={handleShare}
          style={({ pressed }) => [styles.action, styles.actionPrimary, pressed && styles.pressed]}
        >
          <Ionicons name="share-outline" size={15} color={theme.inkInverted} />
          <Text style={[styles.actionText, styles.actionTextPrimary]}>Share</Text>
        </Pressable>
      </View>

      {Platform.OS === "web" ? (
        <Text style={styles.webHint}>Tap Share to post to any platform.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    gap: 10,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: "rgba(8, 5, 2, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255, 240, 214, 0.12)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  episode: {
    flex: 1,
    color: theme.inkAlpha70,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pillText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  figureName: {
    color: theme.ink,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  figureNameMissed: {
    color: theme.dangerText,
  },
  meta: {
    color: theme.inkAlpha60,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  rowEmoji: {
    fontSize: 18,
    letterSpacing: 1,
  },
  rowScore: {
    color: theme.accent,
    fontSize: 14,
    fontWeight: "900",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  action: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 14,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: theme.accentAlpha35,
    backgroundColor: theme.accentAlpha10,
  },
  actionPrimary: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  actionDone: {
    backgroundColor: "rgba(134, 239, 172, 0.14)",
    borderColor: "rgba(134, 239, 172, 0.5)",
  },
  actionText: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: "900",
  },
  actionTextDone: {
    color: "#86EFAC",
  },
  actionTextPrimary: {
    color: theme.inkInverted,
  },
  pressed: {
    opacity: 0.75,
  },
  webHint: {
    color: theme.inkAlpha40,
    fontSize: 10,
    fontWeight: "700",
  },
});