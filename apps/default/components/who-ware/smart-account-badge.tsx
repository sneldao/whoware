import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

interface SmartAccountBadgeProps {
  isUpgraded: boolean;
  isUpgrading: boolean;
  onUpgrade: () => Promise<boolean>;
}

export function SmartAccountBadge({
  isUpgraded,
  isUpgrading,
  onUpgrade,
}: SmartAccountBadgeProps) {
  if (isUpgrading) {
    return (
      <View style={[styles.badge, styles.upgrading]}>
        <ActivityIndicator size="small" color="#A78BFA" />
        <Text style={[styles.label, styles.upgradingLabel]}>Upgrading…</Text>
      </View>
    );
  }

  if (isUpgraded) {
    return (
      <View style={[styles.badge, styles.upgraded]}>
        <Ionicons name="shield-checkmark" size={14} color="#22C55E" />
        <Text style={[styles.label, styles.upgradedLabel]}>Smart Account</Text>
        <View style={styles.techBadge}>
          <Text style={styles.techBadgeText}>ERC-7710</Text>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onUpgrade as any}
      style={({ pressed }) => [styles.badge, styles.promptBadge, pressed && styles.pressed]}
    >
      <Ionicons name="shield-outline" size={14} color="#A78BFA" />
      <Text style={[styles.label, styles.promptLabel]}>Upgrade to Smart Account</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderCurve: "continuous",
  },
  upgraded: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.25)",
  },
  upgrading: {
    backgroundColor: "rgba(167, 139, 250, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.25)",
  },
  promptBadge: {
    backgroundColor: "rgba(167, 139, 250, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.15)",
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
  },
  upgradedLabel: {
    color: "#22C55E",
  },
  upgradingLabel: {
    color: "#A78BFA",
  },
  promptLabel: {
    color: "#A78BFA",
  },
  techBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  techBadgeText: {
    color: "#22C55E",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  pressed: {
    opacity: 0.72,
  },
});
