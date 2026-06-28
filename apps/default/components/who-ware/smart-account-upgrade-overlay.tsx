import { theme } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

interface SmartAccountUpgradeOverlayProps {
  isVisible: boolean;
  isUpgrading: boolean;
  isUpgraded: boolean;
  error: string | null;
  onDismiss: () => void;
}

type UpgradeStep = "connecting" | "authorizing" | "deploying" | "verifying" | "ready" | "error";

const STEPS: { key: UpgradeStep; label: string; icon: string }[] = [
  { key: "connecting", label: "Connecting to MetaMask", icon: "wallet" },
  { key: "authorizing", label: "Signing EIP-7702 authorization", icon: "create" },
  { key: "deploying", label: "Configuring smart account", icon: "hardware-chip" },
  { key: "verifying", label: "Verifying ERC-7710 delegation framework", icon: "shield-checkmark" },
  { key: "ready", label: "Smart Account active", icon: "checkmark-circle" },
];

export function SmartAccountUpgradeOverlay({
  isVisible,
  isUpgrading,
  isUpgraded,
  error,
  onDismiss,
}: SmartAccountUpgradeOverlayProps) {
  const [currentStep, setCurrentStep] = useState<number>(0);

  const pulse = useSharedValue(1);
  const rotate = useSharedValue(0);

  useEffect(() => {
    if (!isVisible) {
      setCurrentStep(0);
      return;
    }

    if (isUpgrading) {
      // Animate through steps
      const timers: ReturnType<typeof setTimeout>[] = [];
      STEPS.slice(0, -1).forEach((_, i) => {
        timers.push(
          setTimeout(() => {
            setCurrentStep(i + 1);
            if (Platform.OS !== "web") {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }, (i + 1) * 1200),
        );
      });
      return () => timers.forEach(clearTimeout);
    }

    if (isUpgraded) {
      setCurrentStep(STEPS.length - 1); // "ready"
      const t = setTimeout(() => {
        if (Platform.OS !== "web") {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }, 300);
      return () => clearTimeout(t);
    }

    if (error) {
      setCurrentStep(STEPS.length - 1);
    }
  }, [isVisible, isUpgrading, isUpgraded, error]);

  useEffect(() => {
    if (!isVisible) return;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [isVisible, pulse]);

  useEffect(() => {
    if (!isVisible || !isUpgrading) return;
    rotate.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
    );
  }, [isVisible, isUpgrading, rotate]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  if (!isVisible) return null;

  const isReady = isUpgraded;
  const hasError = !!error && !isUpgrading && !isUpgraded;
  const showSpinner = isUpgrading && currentStep < STEPS.length - 1;

  return (
    <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.overlay}>
      <LinearGradient colors={["#0A0604", "#1A0F06", "#0A0604"]} style={StyleSheet.absoluteFill} />

      <View style={styles.content}>
        <View style={styles.iconSection}>
          {showSpinner ? (
            <Animated.View style={[styles.spinnerContainer, spinnerStyle]}>
              <Ionicons name="shield-outline" size={52} color={theme.violet} />
            </Animated.View>
          ) : isReady ? (
            <Animated.View style={[styles.iconCircle, styles.successCircle, pulseStyle]}>
              <Ionicons name="shield-checkmark" size={44} color={theme.success} />
            </Animated.View>
          ) : (
            <View style={[styles.iconCircle, styles.errorCircle]}>
              <Ionicons name="alert-circle" size={44} color={theme.danger} />
            </View>
          )}
        </View>

        <Text style={styles.title}>
          {isReady
            ? "Smart Account Active"
            : hasError
              ? "Upgrade Failed"
              : "Upgrading to Smart Account"}
        </Text>

        <Text style={styles.subtitle}>
          {isReady
            ? "Your EOA has been upgraded to a MetaMask Smart Account with ERC-7710 delegation support."
            : hasError
              ? error
              : "This one-time upgrade enables gas abstraction, delegation, and programmable account behavior."}
        </Text>

        <View style={styles.stepsContainer}>
          {STEPS.map((step, i) => {
            const isCompleted = i < currentStep;
            const isCurrent = i === currentStep;
            const isActiveStep = isCompleted || isCurrent;

            return (
              <View key={step.key} style={[styles.stepRow, !isActiveStep && styles.stepInactive]}>
                <View style={[styles.stepDot, isCompleted && styles.stepDotCompleted, isCurrent && styles.stepDotCurrent]}>
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={12} color={theme.inkOnAccent} />
                  ) : isCurrent && showSpinner ? (
                    <View style={styles.stepLoadingDot} />
                  ) : (
                    <Text style={[styles.stepNumber, isCurrent && styles.stepNumberCurrent]}>{i + 1}</Text>
                  )}
                </View>
                <Text style={[styles.stepLabel, isActiveStep && styles.stepLabelActive]}>
                  {step.label}
                </Text>
                {isCompleted ? (
                  <Ionicons name="checkmark-circle" size={16} color={theme.success} style={styles.stepStatus} />
                ) : null}
              </View>
            );
          })}
        </View>

        {isReady ? (
          <View style={styles.techDetails}>
            <View style={styles.techRow}>
              <Text style={styles.techLabel}>Standard</Text>
              <Text style={styles.techValue}>EIP-7702 + ERC-7710</Text>
            </View>
            <View style={styles.techRow}>
              <Text style={styles.techLabel}>Implementation</Text>
              <Text style={styles.techValue}>Stateless7702</Text>
            </View>
            <View style={styles.techRow}>
              <Text style={styles.techLabel}>Delegation</Text>
              <Text style={styles.techValue}>ERC-7710 Framework</Text>
            </View>
          </View>
        ) : null}

        {isReady ? (
          <View style={styles.actionsRow}>
            <Pressable
              onPress={onDismiss}
              style={({ pressed }) => [styles.dismissButton, pressed && styles.pressed]}
            >
              <Text style={styles.dismissButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color={theme.inkInverted} />
            </Pressable>
          </View>
        ) : null}

        {hasError ? (
          <View style={styles.actionsRow}>
            <Pressable
              onPress={onDismiss}
              style={({ pressed }) => [styles.dismissButton, pressed && styles.pressed]}
            >
              <Text style={styles.dismissButtonText}>Dismiss</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  content: {
    width: "100%",
    maxWidth: 400,
    gap: 20,
    alignItems: "center",
  },
  iconSection: {
    marginBottom: 8,
  },
  spinnerContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.violetIconBg,
    borderWidth: 2,
    borderColor: "rgba(167, 139, 250, 0.3)",
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  successCircle: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderWidth: 2,
    borderColor: "rgba(34, 197, 94, 0.4)",
  },
  errorCircle: {
    backgroundColor: "rgba(248, 113, 113, 0.12)",
    borderWidth: 2,
    borderColor: "rgba(248, 113, 113, 0.4)",
  },
  title: {
    color: theme.ink,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: theme.inkAlpha60,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    textAlign: "center",
  },
  stepsContainer: {
    width: "100%",
    gap: 10,
    marginTop: 8,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: theme.inkAlpha4,
  },
  stepInactive: {
    opacity: 0.35,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.inkAlpha10,
  },
  stepDotCompleted: {
    backgroundColor: theme.success,
  },
  stepDotCurrent: {
    backgroundColor: "rgba(167, 139, 250, 0.3)",
    borderWidth: 1,
    borderColor: theme.violet,
  },
  stepLoadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.violet,
  },
  stepNumber: {
    color: theme.inkAlpha50,
    fontSize: 11,
    fontWeight: "900",
  },
  stepNumberCurrent: {
    color: theme.violet,
  },
  stepLabel: {
    flex: 1,
    color: theme.inkAlpha50,
    fontSize: 13,
    fontWeight: "700",
  },
  stepLabelActive: {
    color: theme.ink,
  },
  stepStatus: {
    marginLeft: "auto",
  },
  techDetails: {
    width: "100%",
    gap: 6,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(34, 197, 94, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.15)",
  },
  techRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  techLabel: {
    color: theme.inkAlpha50,
    fontSize: 12,
    fontWeight: "700",
  },
  techValue: {
    color: theme.success,
    fontSize: 12,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  actionsRow: {
    width: "100%",
    marginTop: 8,
  },
  dismissButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 54,
    borderRadius: 20,
    backgroundColor: theme.accent,
  },
  dismissButtonText: {
    color: theme.inkInverted,
    fontSize: 16,
    fontWeight: "900",
  },
});
