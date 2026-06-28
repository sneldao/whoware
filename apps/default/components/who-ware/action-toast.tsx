import { theme } from "@/lib/theme";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";

interface ActionToastProps {
  visible: boolean;
  message: string;
  type?: "info" | "warning" | "success" | "error";
  duration?: number;
  onDismiss: () => void;
}

const TYPE_STYLES = {
  info: { bg: "rgba(96, 165, 250, 0.15)", border: "rgba(96, 165, 250, 0.3)", icon: "ℹ️" },
  warning: { bg: theme.accentAlpha15, border: theme.accentAlpha30, icon: "⚠️" },
  success: { bg: "rgba(34, 197, 94, 0.15)", border: "rgba(34, 197, 94, 0.3)", icon: "✅" },
  error: { bg: "rgba(248, 113, 113, 0.15)", border: "rgba(248, 113, 113, 0.3)", icon: "❌" },
};

export function ActionToast({ visible, message, type = "info", duration = 2500, onDismiss }: ActionToastProps) {
  const progress = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      progress.value = 1;
      progress.value = withTiming(0, {
        duration,
        easing: Easing.linear,
      });
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onDismiss, progress]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  if (!visible) return null;

  const style = TYPE_STYLES[type];

  return (
    <Animated.View
      entering={FadeInDown.duration(250).springify()}
      exiting={FadeOutUp.duration(200)}
      style={[styles.container, { backgroundColor: style.bg, borderColor: style.border }]}
    >
      <View style={styles.row}>
        <Text style={styles.message}>{message}</Text>
        <View style={[styles.iconCircle, { backgroundColor: style.border }]}>
          <Text style={styles.iconText}>{style.icon}</Text>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { backgroundColor: style.border.replace("0.3", "0.6") }, progressBarStyle]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: 1,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  message: {
    flex: 1,
    color: theme.ink,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 14,
  },
  progressTrack: {
    height: 2,
    borderRadius: 1,
    backgroundColor: theme.inkAlpha8,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 1,
  },
});
