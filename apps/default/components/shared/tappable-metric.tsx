import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface TappableMetricProps {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  sublabel?: string;
  disabled?: boolean;
  onPress?: () => void;
  variant?: "card" | "pill" | "badge";
}

/**
 * A tappable metric display with three variants:
 * - **card**: icon + value + label in a bordered card (used in analytics stats grid)
 * - **pill**: label + value in a compact pill (used in game score strip)
 * - **badge**: icon + accent-colored value + label + optional sublabel in a centered dark badge (used in Venice stats panel)
 *
 * When `onPress` is provided, the component is wrapped in a Pressable
 * with a pressed-state opacity feedback for triggering tooltips.
 */
export function TappableMetric({
  label,
  value,
  icon,
  iconColor,
  sublabel,
  disabled = false,
  onPress,
  variant = "pill",
}: TappableMetricProps) {
  const isCard = variant === "card";
  const isBadge = variant === "badge";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        isCard ? styles.cardOuter : isBadge ? styles.badge : styles.pill,
        isBadge && iconColor && { borderColor: `${iconColor}20` },
        disabled && { opacity: 0.5 },
        pressed && !disabled && { opacity: 0.72 },
      ]}
    >
      <View style={isCard ? styles.cardInner : undefined}>
        {isCard && icon && iconColor && (
          <View style={[styles.cardIcon, { backgroundColor: `${iconColor}20` }]}>
            <Ionicons name={icon} size={18} color={iconColor} />
          </View>
        )}
        {isBadge ? (
          <>
            {icon && iconColor && (
              <View style={[styles.badgeIcon, { backgroundColor: `${iconColor}15` }]}>
                <Ionicons name={icon} size={16} color={iconColor} />
              </View>
            )}
            <Text style={[styles.badgeValue, { color: iconColor }]}>{value}</Text>
            <Text style={styles.badgeLabel}>{label}</Text>
            {sublabel ? (
              <Text style={styles.badgeSublabel}>{sublabel}</Text>
            ) : null}
          </>
        ) : isCard ? (
          <>
            <Text style={styles.cardValue}>{value}</Text>
            <Text style={styles.cardLabel}>{label}</Text>
          </>
        ) : (
          <>
            <Text style={styles.pillLabel}>{label}</Text>
            <Text style={styles.pillValue}>{value}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /* ── Card variant ── */
  cardOuter: {
    flex: 1,
    minWidth: "45%",
  },
  cardInner: {
    padding: 14,
    gap: 8,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.08)",
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  cardValue: {
    color: "#FFF7ED",
    fontSize: 22,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  cardLabel: {
    color: "rgba(255, 247, 237, 0.45)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },

  /* ── Pill variant ── */
  pill: {
    flexGrow: 1,
    minWidth: 96,
    padding: 12,
    gap: 3,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.1)",
  },
  pillLabel: {
    color: "rgba(255, 247, 237, 0.48)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  pillValue: {
    color: "#FFF7ED",
    fontSize: 15,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },

  /* ── Badge variant ── */
  badge: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    padding: 12,
    borderRadius: 14,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.06)",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
  },
  badgeIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  badgeValue: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  badgeLabel: {
    color: "rgba(255, 247, 237, 0.55)",
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    textAlign: "center",
    lineHeight: 12,
  },
  badgeSublabel: {
    color: "rgba(255, 247, 237, 0.3)",
    fontSize: 8,
    fontWeight: "600",
  },
});
