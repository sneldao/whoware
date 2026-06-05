import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInRight, SlideInRight, SlideOutLeft } from "react-native-reanimated";

const mysteryFigure = require("../../../../assets/images/whoware-mystery-figure.png");

interface OnboardingFlowProps {
  onComplete: () => void;
}

const STEPS = [
  {
    title: "Someone changed history\nfrom this room.",
    narration: "Each day, a figure from the past leaves behind fragments of their life. Your job is to piece them together.",
    icon: "eye" as const,
    demo: null,
  },
  {
    title: "Step into panoramic\nmemories.",
    narration: "Explore atmospheric scenes from their life. The environment holds secrets — look closely at every detail.",
    icon: "globe" as const,
    demo: "panorama",
  },
  {
    title: "Inspect clues hidden\nin each scene.",
    narration: "Each clue narrows the identity. But every clue you open lowers your score ceiling. Choose wisely.",
    icon: "search" as const,
    demo: "clue",
  },
  {
    title: "Guess the identity\nwhen you're ready.",
    narration: "When you think you know who they are, make your guess. Fewer memories viewed means a higher score.",
    icon: "help-circle" as const,
    demo: "guess",
  },
  {
    title: "Build your streak.\nOwn your score.",
    narration: "Solve daily to build your streak. Your score lives on-chain as a soul-bound token — tamper-proof, earned, yours.",
    icon: "flame" as const,
    demo: "streak",
  },
];

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [interacted, setInteracted] = useState(false);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function handleNext() {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (isLast) {
      onComplete();
      return;
    }
    setInteracted(false);
    setStep((s) => s + 1);
  }

  function handleSkip() {
    onComplete();
  }

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.root}>
      <LinearGradient colors={["#0A0604", "#1A0F06", "#0A0604"]} style={StyleSheet.absoluteFill} />

      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Ionicons name="eye" size={14} color="#1C1106" />
          </View>
          <Text style={styles.brandName}>WhoWare</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.figureSection}>
        <Image source={mysteryFigure} style={styles.figureImage} contentFit="contain" />
        <View style={styles.figureGlow} />
      </View>

      <View style={styles.contentSection}>
        <Animated.View key={`step-${step}`} entering={SlideInRight.duration(350)} exiting={SlideOutLeft.duration(250)} style={styles.stepContent}>
          <View style={styles.iconRow}>
            <View style={styles.iconBadge}>
              <Ionicons name={current.icon} size={20} color="#FBBF24" />
            </View>
            <Text style={styles.stepCounter}>
              {step + 1} / {STEPS.length}
            </Text>
          </View>

          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.narration}>{current.narration}</Text>

          <StepDemo demo={current.demo} interacted={interacted} onInteract={() => setInteracted(true)} />
        </Animated.View>
      </View>

      <View style={styles.bottomSection}>
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]} />
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={handleNext}
          style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}
        >
          <Text style={styles.nextButtonText}>{isLast ? "Start Playing" : "Continue"}</Text>
          <Ionicons name="chevron-forward" size={18} color="#1C1106" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

function StepDemo({ demo, interacted, onInteract }: { demo: string | null; interacted: boolean; onInteract: () => void }) {
  if (!demo) return null;

  if (demo === "panorama") {
    return (
      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.demoBox}>
        <View style={styles.demoPanorama}>
          <Text style={styles.demoSceneLabel}>1940s · London</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onInteract}
            style={[styles.demoHotspot, interacted && styles.demoHotspotActive]}
          >
            <View style={styles.demoHotspotDot} />
          </Pressable>
          <Text style={styles.demoTapHint}>{interacted ? "Clue revealed!" : "Tap the glowing dot"}</Text>
        </View>
      </Animated.View>
    );
  }

  if (demo === "clue") {
    return (
      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.demoBox}>
        <Pressable accessibilityRole="button" onPress={onInteract} style={styles.demoClueCard}>
          <View style={styles.demoClueHeader}>
            <Ionicons name="search" size={16} color="#F8E7C9" />
            <Text style={styles.demoClueTitle}>Signed Treaty</Text>
          </View>
          <Text style={styles.demoClueDetail}>
            {interacted ? "A wax-sealed document bearing the date June 28, 1919…" : "Tap to inspect the clue detail"}
          </Text>
        </Pressable>
      </Animated.View>
    );
  }

  if (demo === "guess") {
    return (
      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.demoBox}>
        <View style={styles.demoGuessRow}>
          {["Winston Churchill", "Franklin D. Roosevelt", "Mahatma Gandhi"].map((name) => (
            <Pressable
              key={name}
              accessibilityRole="button"
              onPress={onInteract}
              style={[styles.demoGuessOption, interacted && name === "Winston Churchill" && styles.demoGuessCorrect]}
            >
              <Text style={[styles.demoGuessText, interacted && name === "Winston Churchill" && styles.demoGuessTextCorrect]}>{name}</Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>
    );
  }

  if (demo === "streak") {
    return (
      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.demoBox}>
        <View style={styles.demoStreakRow}>
          <View style={styles.demoFlameGlow}>
            <Ionicons name="flame" size={28} color="#FB923C" />
          </View>
          <View>
            <Text style={styles.demoStreakCount}>7-day streak</Text>
            <Text style={styles.demoStreakLabel}>Spark → Flame → Inferno → Eternal</Text>
          </View>
          <View style={styles.demoScorePill}>
            <Text style={styles.demoScoreValue}>2,450</Text>
            <Text style={styles.demoScoreLabel}>pts</Text>
          </View>
        </View>
      </Animated.View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 60,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandMark: {
    width: 26,
    height: 26,
    borderRadius: 9,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FBBF24",
  },
  brandName: {
    color: "#FFF7ED",
    fontSize: 17,
    fontWeight: "900",
  },
  skipButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skipText: {
    color: "rgba(255, 247, 237, 0.5)",
    fontSize: 14,
    fontWeight: "800",
  },
  figureSection: {
    alignItems: "center",
    justifyContent: "center",
    height: 180,
  },
  figureImage: {
    width: 120,
    height: 160,
    opacity: 0.7,
  },
  figureGlow: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(251, 191, 36, 0.08)",
  },
  contentSection: {
    flex: 1,
    justifyContent: "center",
    overflow: "hidden",
  },
  stepContent: {
    gap: 14,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.3)",
  },
  stepCounter: {
    color: "rgba(255, 247, 237, 0.4)",
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  title: {
    color: "#FFF7ED",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: -1,
  },
  narration: {
    color: "rgba(255, 247, 237, 0.65)",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
  },
  demoBox: {
    marginTop: 8,
    borderRadius: 18,
    borderCurve: "continuous",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.15)",
  },
  demoPanorama: {
    padding: 20,
    backgroundColor: "rgba(255, 247, 237, 0.04)",
    alignItems: "center",
    gap: 12,
  },
  demoSceneLabel: {
    color: "rgba(255, 247, 237, 0.5)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  demoHotspot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(251, 191, 36, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.7)",
  },
  demoHotspotActive: {
    backgroundColor: "rgba(251, 191, 36, 0.35)",
    borderColor: "#FBBF24",
  },
  demoHotspotDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FBBF24",
  },
  demoTapHint: {
    color: "rgba(255, 247, 237, 0.5)",
    fontSize: 12,
    fontWeight: "800",
  },
  demoClueCard: {
    padding: 16,
    gap: 8,
    backgroundColor: "rgba(120, 53, 15, 0.35)",
  },
  demoClueHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  demoClueTitle: {
    color: "#F8E7C9",
    fontSize: 15,
    fontWeight: "900",
  },
  demoClueDetail: {
    color: "rgba(255, 247, 237, 0.7)",
    fontSize: 14,
    lineHeight: 20,
  },
  demoGuessRow: {
    padding: 12,
    gap: 8,
    backgroundColor: "rgba(255, 247, 237, 0.04)",
  },
  demoGuessOption: {
    padding: 12,
    borderRadius: 12,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.1)",
  },
  demoGuessCorrect: {
    backgroundColor: "rgba(134, 239, 172, 0.15)",
    borderColor: "rgba(134, 239, 172, 0.5)",
  },
  demoGuessText: {
    color: "#FFF7ED",
    fontSize: 14,
    fontWeight: "800",
  },
  demoGuessTextCorrect: {
    color: "#86EFAC",
  },
  demoStreakRow: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(251, 146, 60, 0.08)",
  },
  demoFlameGlow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(251, 146, 60, 0.2)",
  },
  demoStreakCount: {
    color: "#FB923C",
    fontSize: 15,
    fontWeight: "900",
  },
  demoStreakLabel: {
    color: "rgba(255, 247, 237, 0.45)",
    fontSize: 11,
    fontWeight: "800",
  },
  demoScorePill: {
    marginLeft: "auto",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    alignItems: "center",
  },
  demoScoreValue: {
    color: "#FBBF24",
    fontSize: 16,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  demoScoreLabel: {
    color: "rgba(251, 191, 36, 0.6)",
    fontSize: 10,
    fontWeight: "800",
  },
  bottomSection: {
    gap: 16,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 247, 237, 0.15)",
  },
  dotActive: {
    width: 24,
    backgroundColor: "#FBBF24",
  },
  dotDone: {
    backgroundColor: "rgba(251, 191, 36, 0.4)",
  },
  nextButton: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "#FBBF24",
  },
  nextButtonText: {
    color: "#1C1106",
    fontSize: 16,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.8,
  },
});
