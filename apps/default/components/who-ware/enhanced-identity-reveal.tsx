import { api } from "@/convex/_generated/api";
import { theme } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { useAction, useQuery } from "convex/react";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

interface EnhancedIdentityRevealProps {
  figureName: string;
  era: string;
  region: string;
  tags: string[];
  summary?: string;
  /**
   * Episode whose cached AI bio supplies the story-first narrative when
   * `summary` is not provided. Skipped when absent.
   */
  episodeId?: string;
  /** Caller identity — gates the bio reveal. */
  identityId?: string;
  imageUrl?: string;
  imageKey?: string;
  /** Register: a solved run names the body; an exhausted run closes the file. */
  variant?: "solved" | "exhausted";
  /** v0.4 — Witness Chamber acknowledgment line. When present, renders
   * above the reveal label as the room-figure's beat before the
   * typewriter names the target. Example: "Synesius of Cyrene nods
   * slowly." — then "Hypatia" types out. */
  acknowledgment?: string;
  /** v0.4 — name of the room-figure when this is a Witness Chamber.
   * Used by the avatar/icon decoration. */
  roomFigureName?: string;
  onContinue: () => void;
}

export function EnhancedIdentityReveal({
  figureName,
  era,
  region,
  tags,
  summary,
  episodeId,
  identityId,
  imageUrl,
  variant = "solved",
  acknowledgment,
  roomFigureName,
  onContinue,
}: EnhancedIdentityRevealProps) {
  const [displayedName, setDisplayedName] = useState("");
  const [showContent, setShowContent] = useState(false);
  const [showName, setShowName] = useState(false);

  // Story-first: pull the AI bio (cached query, lazily generated action)
  // so the full-screen reveal carries the narrative, not just the name.
  const cachedBio = useQuery(api.venice.getFigureBio, episodeId ? { episodeId: episodeId as never, identityId } : "skip");
  const generateBio = useAction(api.venice.generateFigureBio);
  const [actionBio, setActionBio] = useState<{ summary?: string } | null>(null);
  const [bioTried, setBioTried] = useState(false);

  useEffect(() => {
    if (!episodeId || summary || bioTried) return;
    if (cachedBio === undefined) return; // wait for the cache query to resolve
    if (cachedBio) return; // cache hit — summary flows from cachedBio
    let cancelled = false;
    void generateBio({ episodeId: episodeId as never, identityId })
      .then((bio) => { if (!cancelled) setActionBio(bio ?? null); })
      .catch(() => { /* silent — the reveal still works without a bio */ })
      .finally(() => { if (!cancelled) setBioTried(true); });
    return () => { cancelled = true; };
  }, [episodeId, identityId, summary, cachedBio, bioTried, generateBio]);

  const resolvedSummary = summary ?? cachedBio?.summary ?? actionBio?.summary;

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  // Entrance animation sequence
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500 });
    scale.value = withSequence(
      withSpring(1.05, { damping: 12, stiffness: 100 }),
      withSpring(1, { damping: 15 }),
    );
  }, [opacity, scale]);

  // Staggered content reveal
  useEffect(() => {
    const t1 = setTimeout(() => setShowContent(true), 300);
    const t2 = setTimeout(() => setShowName(true), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Typewriter effect on name
  useEffect(() => {
    if (!showName) return;
    let i = 0;
    setDisplayedName("");
    const interval = setInterval(() => {
      if (i < figureName.length) {
        setDisplayedName(figureName.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [showName, figureName]);

  // No sparkles here. The naming moment is a verdict, not confetti — the
  // typewriter and the room behind the scrim carry the weight.
  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.overlay, containerStyle]}>
      {imageUrl && (
        <Image
          source={{ uri: imageUrl }}
          style={styles.backdrop}
          contentFit="cover"
          blurRadius={20}
        />
      )}
      <LinearGradient
        colors={["rgba(10, 6, 4, 0.7)", "rgba(10, 6, 4, 0.95)", "rgba(10, 6, 4, 1)"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        {/* Icon */}
        <Animated.View entering={FadeInDown.delay(200).duration(400).springify()} style={styles.iconWrapper}>
          <View style={styles.iconCircle}>
            <Ionicons name={roomFigureName ? "people-outline" : "eye"} size={28} color={theme.accent} />
          </View>
        </Animated.View>

        {/* v0.4 — Witness Chamber acknowledgment. The room-figure's beat
            before the typewriter names the target. */}
        {acknowledgment ? (
          <Animated.View entering={FadeIn.delay(150).duration(500)}>
            <Text style={styles.acknowledgment}>{acknowledgment}</Text>
          </Animated.View>
        ) : null}

        {/* Narrative label */}
        <Animated.View entering={FadeIn.delay(300).duration(500)}>
          <Text style={styles.revealLabel}>
            {variant === "exhausted"
              ? "The archive closes around"
              : roomFigureName
                ? "The absent one, named:"
                : "The body remembers:"}
          </Text>
        </Animated.View>

        {/* Typewriter name */}
        <Animated.View entering={FadeIn.delay(800).duration(300)}>
          <Text style={styles.figureName}>
            {displayedName}
            {showName && displayedName.length < figureName.length ? (
              <Text style={styles.cursor}>|</Text>
            ) : null}
          </Text>
        </Animated.View>

        {/* Context */}
        {showContent ? (
          <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.metaSection}>
            <View style={styles.contextRow}>
              <Ionicons name="globe-outline" size={14} color={theme.inkAlpha50} />
              <Text style={styles.contextText}>{region} · {era}</Text>
            </View>

            {resolvedSummary ? (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryText}>{resolvedSummary}</Text>
              </View>
            ) : null}

            {tags.length > 0 && (
              <View style={styles.tagRow}>
                {tags.slice(0, 5).map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        ) : null}

        {/* Continue button */}
        {showName && displayedName === figureName ? (
          <Animated.View entering={FadeInDown.delay(600).duration(400).springify()} style={styles.actionsRow}>
            <Pressable
              onPress={onContinue}
              style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}
            >
              <Text style={styles.continueText}>
                {variant === "exhausted" ? "See what remains" : "View your result"}
              </Text>
              <Ionicons name="arrow-forward" size={18} color={theme.inkInverted} />
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.2,
  },
  content: {
    alignItems: "center",
    padding: 32,
    maxWidth: 400,
    gap: 12,
  },
  iconWrapper: {},
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.accentAlpha15,
    borderWidth: 1,
    borderColor: theme.accentAlpha30,
    marginBottom: 8,
  },
  revealLabel: {
    color: theme.inkAlpha60,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  acknowledgment: {
    color: theme.accent,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
    textAlign: "center",
    fontStyle: "italic",
    paddingHorizontal: 16,
  },
  figureName: {
    color: theme.ink,
    fontSize: 38,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -1,
    lineHeight: 44,
  },
  cursor: {
    color: theme.accent,
    fontWeight: "300",
    opacity: 0.7,
  },
  metaSection: {
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  contextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  contextText: {
    color: theme.inkAlpha65,
    fontSize: 15,
    fontWeight: "700",
  },
  summaryCard: {
    padding: 14,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 240, 214, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 240, 214, 0.12)",
    maxWidth: 360,
  },
  summaryText: {
    color: theme.inkAlpha84,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    textAlign: "center",
    fontStyle: "italic",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
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
  actionsRow: {
    marginTop: 16,
    width: "100%",
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 54,
    borderRadius: 20,
    backgroundColor: theme.accent,
  },
  continueText: {
    color: theme.inkInverted,
    fontSize: 16,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.72,
  },
});
