import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

export interface TooltipDefinition {
  title: string;
  description: string;
}

/**
 * Hook that manages the active tooltip badge state with an auto-dismiss timer.
 *
 * @param autoDismissMs - Milliseconds before the tooltip auto-dismisses (default 3000)
 * @returns `activeBadge`, `show(badge)`, and `hide()`
 */
export function useTooltip(autoDismissMs = 3000) {
  const [activeBadge, setActiveBadge] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (badge: string) => {
    if (timer.current) clearTimeout(timer.current);
    setActiveBadge(badge);
    timer.current = setTimeout(() => setActiveBadge(null), autoDismissMs);
  };

  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setActiveBadge(null);
  };

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { activeBadge, show, hide };
}

interface TooltipOverlayProps {
  activeBadge: string | null;
  onDismiss: () => void;
  definitions: Record<string, TooltipDefinition>;
  accentColor: string;
}

/**
 * Renders the tooltip overlay inline with a fade + slide animation.
 * Returns null when no badge is active (after the fade-out completes).
 * Designed to be placed inside the parent component's layout wherever the tooltip should appear.
 */
export function TooltipOverlay({
  activeBadge,
  onDismiss,
  definitions,
  accentColor,
}: TooltipOverlayProps) {
  const [displayedBadge, setDisplayedBadge] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;
  const scale = useRef(new Animated.Value(0.95)).current;
  const definitionsRef = useRef(definitions);
  definitionsRef.current = definitions;

  useEffect(() => {
    if (activeBadge && definitionsRef.current[activeBadge]) {
      setDisplayedBadge(activeBadge);
      opacity.setValue(0);
      translateY.setValue(6);
      scale.setValue(0.95);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 6,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.95,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setDisplayedBadge(null);
      });
    }
  }, [activeBadge]);

  if (!displayedBadge || !definitions[displayedBadge]) return null;

  const def = definitions[displayedBadge];

  return (
    <Animated.View
      style={[
        styles.tooltip,
        {
          opacity,
          transform: [{ scale }, { translateY }],
          borderColor: `${accentColor}30`,
          backgroundColor: `${accentColor}08`,
        },
      ]}
    >
      <View style={[styles.tooltipArrow, { backgroundColor: accentColor }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.tooltipTitle, { color: accentColor }]}>
          {def.title}
        </Text>
        <Text style={styles.tooltipDesc}>{def.description}</Text>
      </View>
      <Pressable style={styles.tooltipDismiss} onPress={onDismiss}>
        <Ionicons name="close" size={10} color="rgba(255, 247, 237, 0.4)" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 14,
    padding: 12,
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(244, 114, 182, 0.2)",
    backgroundColor: "rgba(244, 114, 182, 0.08)",
  },
  tooltipArrow: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: "#F472B6",
    marginTop: 3,
  },
  tooltipTitle: {
    color: "#F472B6",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tooltipDesc: {
    flex: 1,
    color: "rgba(255, 247, 237, 0.65)",
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 15,
    marginTop: 2,
  },
  tooltipDismiss: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
});
