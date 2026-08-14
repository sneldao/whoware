import { api } from "@/convex/_generated/api";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useAction, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { theme } from "@/lib/theme";

interface FigureRevealCardProps {
  episodeId: string;
  figureName: string;
  figureEra?: string;
  figureRegion?: string;
  figureTags?: string[];
  /** Caller identity — required for the bio/relationship reveal gate. */
  identityId?: string;
}

interface FigureBio {
  summary: string;
  whatTheyChanged: string;
  whyThisRoom: string;
  didYouKnow: string;
}

interface RelatedFigure {
  canonicalName: string;
  era: string;
  region: string;
  tier: string;
  tags: string[];
  hasBeenFeatured: boolean;
}

/**
 * Post-solve narrative reveal card. Fetches an AI-generated biographical
 * card from Venice after solve (or exhausted) to pay off the mystery:
 * who they were, what they changed, why this room, and a surprise fact.
 */
export function FigureRevealCard({
  episodeId,
  figureName,
  figureEra,
  figureRegion,
  figureTags = [],
  identityId,
}: FigureRevealCardProps) {
  const cached = useQuery(api.venice.getFigureBio, { episodeId: episodeId as never, identityId });
  const generateBio = useAction(api.venice.generateFigureBio);
  const relationships = useQuery(api.figures.getFigureRelationships, { episodeId: episodeId as never, identityId });
  const [bio, setBio] = useState<FigureBio | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasTried, setHasTried] = useState(false);
  const [copiedFact, setCopiedFact] = useState(false);

  // Use cached bio if available
  useEffect(() => {
    if (cached && !bio) setBio(cached);
  }, [cached, bio]);

  // Auto-generate on mount if no cached bio
  useEffect(() => {
    if (bio || isGenerating || hasTried) return;
    if (cached !== undefined) return; // wait for cache query to resolve
    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cached, bio, isGenerating, hasTried]);

  // If cache returned null, trigger generation
  useEffect(() => {
    if (cached === null && !bio && !isGenerating && !hasTried) {
      void generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cached, bio, isGenerating, hasTried]);

  async function generate() {
    if (isGenerating || hasTried) return;
    setIsGenerating(true);
    setHasTried(true);
    try {
      const result = await generateBio({ episodeId: episodeId as never, identityId });
      if (result) setBio(result);
    } catch {
      // silent — the card shows a fallback
    } finally {
      setIsGenerating(false);
    }
  }

  if (isGenerating && !bio) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator color={theme.accent} size="small" />
        <Text style={styles.loadingText}>Revealing who they were…</Text>
      </View>
    );
  }

  if (!bio) {
    // Fallback: still show the figure's metadata even if bio generation failed
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="person-circle-outline" size={24} color={theme.accent} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>The body remembers</Text>
            <Text style={styles.figureName}>{figureName}</Text>
          </View>
        </View>
        {figureEra || figureRegion ? (
          <View style={styles.metaRow}>
            {figureEra ? <Text style={styles.metaChip}>{figureEra}</Text> : null}
            {figureRegion ? <Text style={styles.metaChip}>{figureRegion}</Text> : null}
          </View>
        ) : null}
        {figureTags.length > 0 ? (
          <View style={styles.tagRow}>
            {figureTags.slice(0, 5).map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  async function handleCopyFact() {
    if (!bio?.didYouKnow || copiedFact) return;
    await Clipboard.setStringAsync(`Did you know? ${bio.didYouKnow} — WhoWare`);
    setCopiedFact(true);
    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setTimeout(() => setCopiedFact(false), 2000);
  }

  return (
    <Animated.View entering={FadeInDown.duration(600).springify().damping(16)} style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="person-circle" size={24} color={theme.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>The body remembers</Text>
          <Text style={styles.figureName}>{figureName}</Text>
        </View>
      </View>

      {figureEra || figureRegion ? (
        <View style={styles.metaRow}>
          {figureEra ? <Text style={styles.metaChip}>{figureEra}</Text> : null}
          {figureRegion ? <Text style={styles.metaChip}>{figureRegion}</Text> : null}
        </View>
      ) : null}

      <BioSection label="Who they were" text={bio.summary} icon="book-outline" />
      <BioSection label="What they changed" text={bio.whatTheyChanged} icon="trending-up-outline" />
      <BioSection label="Why this room" text={bio.whyThisRoom} icon="home-outline" />

      <Pressable
        onPress={handleCopyFact}
        style={({ pressed }) => [
          styles.didYouKnow,
          copiedFact && styles.didYouKnowCopied,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.didYouKnowHeader}>
          <Ionicons name="bulb-outline" size={14} color={theme.accent} />
          <Text style={styles.didYouKnowLabel}>Did you know?</Text>
          <View style={styles.copyFactBadge}>
            <Ionicons name={copiedFact ? "checkmark" : "copy-outline"} size={11} color={theme.accent} />
            <Text style={styles.copyFactBadgeText}>{copiedFact ? "Copied" : "Copy fact"}</Text>
          </View>
        </View>
        <Text style={styles.didYouKnowText}>{bio.didYouKnow}</Text>
      </Pressable>

      {figureTags.length > 0 ? (
        <View style={styles.tagRow}>
          {figureTags.slice(0, 5).map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {relationships && relationships.length > 0 ? (
        <View style={styles.relationshipsSection}>
          <View style={styles.relationshipsHeader}>
            <Ionicons name="git-network-outline" size={13} color={theme.inkAlpha55} />
            <Text style={styles.relationshipsLabel}>Connected figures</Text>
          </View>
          {relationships.map((rf) => (
            <View key={rf.canonicalName} style={styles.relationshipRow}>
              <Text style={styles.relationshipName}>{rf.canonicalName}</Text>
              <Text style={styles.relationshipMeta}>{rf.era} · {rf.region}</Text>
              {rf.hasBeenFeatured ? (
                <View style={styles.featuredBadge}>
                  <Text style={styles.featuredBadgeText}>Encountered</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

function BioSection({ label, text, icon }: { label: string; text: string; icon: string }) {
  if (!text) return null;
  return (
    <View style={styles.bioSection}>
      <View style={styles.bioHeader}>
        <Ionicons name={icon as "book-outline"} size={13} color={theme.inkAlpha55} />
        <Text style={styles.bioLabel}>{label}</Text>
      </View>
      <Text style={styles.bioText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    gap: 14,
    borderRadius: 28,
    borderCurve: "continuous",
    backgroundColor: theme.slateDeep,
    borderWidth: 1,
    borderColor: theme.parchmentLight,
  },
  loadingCard: {
    padding: 32,
    gap: 12,
    borderRadius: 28,
    borderCurve: "continuous",
    backgroundColor: theme.slateDeep,
    borderWidth: 1,
    borderColor: theme.parchmentLight,
    alignItems: "center",
  },
  loadingText: {
    color: theme.inkAlpha55,
    fontSize: 14,
    fontWeight: "700",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.accentAlpha15,
    borderWidth: 1,
    borderColor: theme.accentAlpha30,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    color: theme.accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  figureName: {
    color: theme.ink,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  metaChip: {
    color: theme.inkAlpha70,
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.inkAlpha8,
  },
  bioSection: {
    gap: 4,
  },
  bioHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bioLabel: {
    color: theme.inkAlpha55,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  bioText: {
    color: theme.inkAlpha84,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  didYouKnow: {
    padding: 14,
    gap: 6,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: theme.accentAlpha8,
    borderWidth: 1,
    borderColor: theme.accentAlpha22,
  },
  didYouKnowCopied: {
    backgroundColor: "rgba(134, 239, 172, 0.12)",
    borderColor: "rgba(134, 239, 172, 0.35)",
  },
  pressed: {
    opacity: 0.82,
  },
  didYouKnowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  didYouKnowLabel: {
    flex: 1,
    color: theme.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  copyFactBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(255, 240, 214, 0.08)",
  },
  copyFactBadgeText: {
    color: theme.accent,
    fontSize: 10,
    fontWeight: "800",
  },
  didYouKnowText: {
    color: theme.inkAlpha84,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.accentAlpha12,
    borderWidth: 1,
    borderColor: theme.accentAlpha25,
  },
  tagText: {
    color: theme.accent,
    fontSize: 11,
    fontWeight: "800",
  },
  relationshipsSection: {
    gap: 8,
    padding: 14,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: theme.inkAlpha4,
    borderWidth: 1,
    borderColor: theme.inkAlpha8,
  },
  relationshipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  relationshipsLabel: {
    color: theme.inkAlpha55,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  relationshipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  relationshipName: {
    color: theme.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  relationshipMeta: {
    color: theme.inkAlpha50,
    fontSize: 11,
    fontWeight: "600",
  },
  featuredBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: theme.accentAlpha12,
    borderWidth: 1,
    borderColor: theme.accentAlpha25,
  },
  featuredBadgeText: {
    color: theme.accent,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
});
