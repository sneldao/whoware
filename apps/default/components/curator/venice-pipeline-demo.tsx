import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";
// =============================================================================
// Pipeline step definitions
// =============================================================================

export interface PipelineStep {
  id: string;
  icon: string;
  title: string;
  description: string;
  details: string[];
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "select",
    icon: "search",
    title: "Figure Selection",
    description: "Venice AI autonomously curates from the catalog to maximize variety across eras, regions, and difficulty tiers.",
    details: [
      "Evaluates recent episodes for diversity",
      "Considers geographic & temporal balance",
      "Selects iconic / field / research tier",
    ],
  },
  {
    id: "generate",
    icon: "sparkles",
    title: "Scene Generation",
    description: "Venice AI writes 7 first-person memory scenes with period-accurate atmospheric detail and 3 visual clues each.",
    details: [
      "5 investigation scenes (subtle → specific)",
      "2 mercy scenes (revealing — post-exhaustion)",
      "3 inspectable clues per scene with coordinates",
    ],
  },
  {
    id: "evaluate",
    icon: "shield-checkmark",
    title: "Self-Evaluation",
    description: "Venice judges its own image prompts for era accuracy, anachronisms, and identity leakage before rendering.",
    details: [
      "Checks era accuracy of objects & architecture",
      "Scans for modern anachronisms",
      "Verifies no figure names or aliases leaked",
    ],
  },
  {
    id: "calibrate",
    icon: "trending-up",
    title: "Difficulty Calibration",
    description: "An adversarial Venice agent attempts to solve the episode. If too easy or too hard, clues are rewritten.",
    details: [
      "Solver agent guesses from raw clues",
      "Subtle rewrite if solved in ≤2 scenes",
      "Sharpen rewrite if unsolved after all scenes",
    ],
  },
  {
    id: "render",
    icon: "image",
    title: "Image Generation",
    description: "Venice AI renders each scene as a 1792×1024 equirectangular panorama with photorealistic lighting.",
    details: [
      "Panoramic first-person perspective",
      "No faces, no readable text",
      "Cinematic lighting & atmospheric depth",
    ],
  },
  {
    id: "deliver",
    icon: "checkmark-circle",
    title: "Ready for Review",
    description: "Episode enters the curator staging queue for human approval before going live.",
    details: [
      "Status: review pending",
      "Regenerate individual scenes if needed",
      "Approve to promote to draft",
    ],
  },
];

// =============================================================================
// Props
// =============================================================================

interface VenicePipelineDemoProps {
  isRunning: boolean;
  currentStepIndex: number;
  result: {
    figureName?: string;
    reasoning?: string;
    scenesGenerated?: number;
  } | null;
  error: string | null;
  onStart: () => void;
  onStep: (stepIndex: number) => void;
}

// =============================================================================
// Component
// =============================================================================

export function VenicePipelineDemo({
  isRunning,
  currentStepIndex,
  result,
  error,
  onStart,
  onStep,
}: VenicePipelineDemoProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="layers" size={16} color="#FBBF24" />
          </View>
          <View>
            <Text style={styles.title}>Autonomous Agent Pipeline</Text>
            <Text style={styles.subtitle}>
              Venice AI generates, evaluates, and calibrates each episode autonomously
            </Text>
          </View>
        </View>
      </View>

      {/* Pipeline Flow */}
      <View style={styles.pipeline}>
        {PIPELINE_STEPS.map((step, index) => {
          const isActive = currentStepIndex === index && isRunning;
          const isCompleted = index < currentStepIndex || (index === currentStepIndex && !isRunning && !error && index > 0);
          const isUpcoming = index > currentStepIndex;
          const isError = error && index === currentStepIndex;

          return (
            <View key={step.id}>
              {/* Connector line */}
              {index > 0 ? (
                <View style={styles.connectorWrap}>
                  <View
                    style={[
                      styles.connector,
                      isCompleted || (index <= currentStepIndex && !isRunning && !error)
                        ? styles.connectorActive
                        : styles.connectorInactive,
                    ]}
                  />
                  {isActive ? (
                    <Animated.View
                      entering={FadeIn.duration(200)}
                      style={styles.connectorPulse}
                    >
                      <Ionicons name="arrow-down" size={14} color="#A78BFA" />
                    </Animated.View>
                  ) : null}
                </View>
              ) : null}

              {/* Step card */}
              <Pressable
                onPress={() => setExpandedStep(expandedStep === index ? null : index)}
                style={({ pressed }) => [
                  styles.stepCard,
                  isActive && styles.stepActive,
                  isCompleted && styles.stepCompleted,
                  isError && styles.stepError,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.stepHeader}>
                  <View style={styles.stepLeft}>
                    {/* Status indicator */}
                    <View
                      style={[
                        styles.stepDot,
                        isActive && styles.stepDotActive,
                        isCompleted && styles.stepDotCompleted,
                        isError && styles.stepDotError,
                        isUpcoming && styles.stepDotUpcoming,
                      ]}
                    >
                      {isActive ? (
                        <ActivityIndicator size="small" color="#111827" />
                      ) : isCompleted ? (
                        <Ionicons name="checkmark" size={12} color="#111827" />
                      ) : isError ? (
                        <Ionicons name="close" size={12} color="#111827" />
                      ) : (
                        <Text style={styles.stepNumber}>{index + 1}</Text>
                      )}
                    </View>

                    {/* Step info */}
                    <View style={styles.stepInfo}>
                      <View style={styles.stepTitleRow}>
                        <Ionicons
                          name={step.icon as any}
                          size={14}
                          color={
                            isActive ? "#A78BFA" : isCompleted ? "#22C55E" : "rgba(255, 247, 237, 0.5)"
                          }
                        />
                        <Text
                          style={[
                            styles.stepTitle,
                            isActive && styles.stepTitleActive,
                            isCompleted && styles.stepTitleCompleted,
                          ]}
                        >
                          {step.title}
                        </Text>
                      </View>
                      <Text style={styles.stepDescription}>{step.description}</Text>
                    </View>
                  </View>

                  {/* Right side */}
                  <View style={styles.stepRight}>
                    {isActive ? (
                      <View style={styles.pulsingTag}>
                        <Text style={styles.pulsingTagText}>In progress</Text>
                      </View>
                    ) : isCompleted ? (
                      <View style={styles.doneTag}>
                        <Text style={styles.doneTagText}>Complete</Text>
                      </View>
                    ) : isError ? (
                      <View style={styles.errorTag}>
                        <Text style={styles.errorTagText}>Failed</Text>
                      </View>
                    ) : null}
                    {isUpcoming && !isRunning ? (
                      <Ionicons name="chevron-down" size={14} color="rgba(255,247,237,0.2)" />
                    ) : null}
                  </View>
                </View>

                {/* Expanded details */}
                {expandedStep === index ? (
                  <Animated.View entering={FadeInDown.duration(200)} style={styles.detailSection}>
                    <View style={styles.detailList}>
                      {step.details.map((detail, i) => (
                        <View key={i} style={styles.detailRow}>
                          <Text style={styles.detailBullet}>•</Text>
                          <Text style={styles.detailText}>{detail}</Text>
                        </View>
                      ))}
                    </View>
                    {index === 0 && result?.figureName ? (
                      <View style={styles.resultPreview}>
                        <Text style={styles.resultLabel}>Selected figure:</Text>
                        <Text style={styles.resultValue}>{result.figureName}</Text>
                        <Text style={styles.resultReason}>{result.reasoning}</Text>
                      </View>
                    ) : null}
                    {index === PIPELINE_STEPS.length - 1 && result?.scenesGenerated ? (
                      <View style={styles.resultPreview}>
                        <Text style={styles.resultLabel}>Generated:</Text>
                        <Text style={styles.resultValue}>
                          {result.scenesGenerated} scenes
                        </Text>
                      </View>
                    ) : null}
                  </Animated.View>
                ) : null}
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* Error state */}
      {error ? (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color="#EF4444" />
          <Text style={styles.errorBannerText}>{error}</Text>
        </Animated.View>
      ) : null}

      {/* Action button */}
      <Pressable
        onPress={onStart}
        disabled={isRunning}
        style={({ pressed }) => [
          styles.startButton,
          isRunning && styles.startButtonRunning,
          pressed && styles.pressed,
        ]}
      >
        {isRunning ? (
          <>
            <ActivityIndicator size="small" color="#FFF7ED" />
            <Text style={styles.startButtonText}>
              Pipeline running — step {currentStepIndex + 1} of {PIPELINE_STEPS.length}…
            </Text>
          </>
        ) : (
          <>
            <Ionicons name="play" size={16} color="#111827" />
            <Text style={styles.startButtonText}>
              Auto-Generate Episode
            </Text>
          </>
        )}
      </Pressable>

      {/* Summary */}
      {result && !isRunning ? (
        <Animated.View entering={FadeInDown.duration(400)} style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
            <Text style={styles.summaryTitle}>Episode Generated</Text>
          </View>
          <View style={styles.summaryBody}>
            <SummaryRow label="Figure" value={result.figureName ?? "—"} />
            <SummaryRow label="Scenes" value={`${result.scenesGenerated ?? 0}`} />
            <SummaryRow label="Selection rationale" value={result.reasoning ?? "—"} />
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(248, 231, 201, 0.13)",
    backgroundColor: "#1C1106",
    overflow: "hidden",
    gap: 20,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    gap: 12,
    flex: 1,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(251, 191, 36, 0.15)",
  },
  title: {
    color: "#FFF7ED",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  subtitle: {
    color: "rgba(255, 247, 237, 0.5)",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  pipeline: {
    gap: 0,
  },
  connectorWrap: {
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  connector: {
    width: 2,
    flex: 1,
    borderRadius: 1,
  },
  connectorActive: {
    backgroundColor: "rgba(167, 139, 250, 0.4)",
  },
  connectorInactive: {
    backgroundColor: "rgba(255, 247, 237, 0.06)",
  },
  connectorPulse: {
    position: "absolute",
  },
  stepCard: {
    padding: 14,
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.06)",
    backgroundColor: "rgba(255, 247, 237, 0.03)",
    gap: 10,
  },
  stepActive: {
    borderColor: "rgba(167, 139, 250, 0.3)",
    backgroundColor: "rgba(167, 139, 250, 0.06)",
  },
  stepCompleted: {
    borderColor: "rgba(34, 197, 94, 0.15)",
    backgroundColor: "rgba(34, 197, 94, 0.04)",
  },
  stepError: {
    borderColor: "rgba(239, 68, 68, 0.3)",
    backgroundColor: "rgba(239, 68, 68, 0.06)",
  },
  pressed: {
    opacity: 0.72,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  stepLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    flex: 1,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  stepDotActive: {
    backgroundColor: "#A78BFA",
  },
  stepDotCompleted: {
    backgroundColor: "#22C55E",
  },
  stepDotError: {
    backgroundColor: "#EF4444",
  },
  stepDotUpcoming: {
    backgroundColor: "rgba(255, 247, 237, 0.08)",
  },
  stepNumber: {
    color: "rgba(255, 247, 237, 0.4)",
    fontSize: 11,
    fontWeight: "900",
  },
  stepInfo: {
    flex: 1,
    gap: 4,
  },
  stepTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stepTitle: {
    color: "rgba(255, 247, 237, 0.6)",
    fontSize: 14,
    fontWeight: "800",
  },
  stepTitleActive: {
    color: "#A78BFA",
  },
  stepTitleCompleted: {
    color: "#22C55E",
  },
  stepDescription: {
    color: "rgba(255, 247, 237, 0.45)",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
  },
  stepRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  pulsingTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(167, 139, 250, 0.15)",
  },
  pulsingTagText: {
    color: "#A78BFA",
    fontSize: 9,
    fontWeight: "900",
  },
  doneTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
  },
  doneTagText: {
    color: "#22C55E",
    fontSize: 9,
    fontWeight: "900",
  },
  errorTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  errorTagText: {
    color: "#EF4444",
    fontSize: 9,
    fontWeight: "900",
  },
  detailSection: {
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 247, 237, 0.06)",
  },
  detailList: {
    gap: 4,
  },
  detailRow: {
    flexDirection: "row",
    gap: 6,
    paddingLeft: 2,
  },
  detailBullet: {
    color: "rgba(251, 191, 36, 0.6)",
    fontSize: 13,
  },
  detailText: {
    color: "rgba(255, 247, 237, 0.6)",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    lineHeight: 17,
  },
  resultPreview: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(34, 197, 94, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.12)",
    gap: 4,
  },
  resultLabel: {
    color: "rgba(255, 247, 237, 0.4)",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  resultValue: {
    color: "#22C55E",
    fontSize: 15,
    fontWeight: "900",
  },
  resultReason: {
    color: "rgba(255, 247, 237, 0.5)",
    fontSize: 11,
    fontWeight: "600",
    fontStyle: "italic",
    lineHeight: 16,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  errorBannerText: {
    flex: 1,
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "700",
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 52,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "#FBBF24",
  },
  startButtonRunning: {
    backgroundColor: "rgba(167, 139, 250, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.3)",
  },
  startButtonText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
  },
  summaryCard: {
    padding: 14,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: "rgba(34, 197, 94, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.15)",
    gap: 10,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryTitle: {
    color: "#22C55E",
    fontSize: 15,
    fontWeight: "900",
  },
  summaryBody: {
    gap: 6,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  summaryLabel: {
    color: "rgba(255, 247, 237, 0.4)",
    fontSize: 12,
    fontWeight: "700",
  },
  summaryValue: {
    color: "#FFF7ED",
    fontSize: 12,
    fontWeight: "800",
    flex: 1,
    textAlign: "right",
  },
});
