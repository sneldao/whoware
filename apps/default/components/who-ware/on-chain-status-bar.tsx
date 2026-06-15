import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

interface OnChainStatusBarProps {
  isWalletConnected: boolean;
  isSmartAccountUpgraded: boolean;
  isMinting: boolean;
  isMinted: boolean;
  isCorrectChain: boolean;
  isArchivePayEnabled?: boolean;
}

export function OnChainStatusBar({
  isWalletConnected,
  isSmartAccountUpgraded,
  isMinting,
  isMinted,
  isCorrectChain,
  isArchivePayEnabled,
}: OnChainStatusBarProps) {
  if (!isWalletConnected) return null;

  return (
    <View style={styles.bar}>
      <StatusItem
        icon={isSmartAccountUpgraded ? "shield-checkmark" : "shield-outline"}
        label={isSmartAccountUpgraded ? "Smart Account (ERC-7710)" : "EOA"}
        active={isSmartAccountUpgraded}
        color={isSmartAccountUpgraded ? "#22C55E" : "#64748B"}
      />
      <View style={styles.divider} />
      <StatusItem
        icon={isCorrectChain ? "checkmark-circle" : "alert-circle"}
        label={isCorrectChain ? "Mantle Sepolia" : "Wrong chain"}
        active={isCorrectChain}
        color={isCorrectChain ? "#22C55E" : "#F87171"}
      />
      <View style={styles.divider} />
      <StatusItem
        icon={isMinting ? "hourglass" : isMinted ? "checkmark-circle" : "ellipse-outline"}
        label={isMinting ? "Minting…" : isMinted ? "Score minted" : "Not minted"}
        active={isMinted || isMinting}
        color={isMinting ? "#A78BFA" : isMinted ? "#22C55E" : "#64748B"}
      />
      {isArchivePayEnabled ? (
        <>
          <View style={styles.divider} />
          <StatusItem
            icon="flash"
            label="1Shot"
            active={true}
            color="#22C55E"
            compact
          />
        </>
      ) : null}
    </View>
  );
}

interface StatusItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  color: string;
  compact?: boolean;
}

function StatusItem({ icon, label, active, color, compact }: StatusItemProps) {
  return (
    <View style={[styles.item, compact && styles.itemCompact]}>
      <Ionicons name={icon} size={compact ? 10 : 12} color={color} />
      {compact ? null : (
        <Text style={[styles.label, { color: active ? color : "#64748B" }]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.08)",
    flexWrap: "wrap",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  itemCompact: {
    gap: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    maxWidth: 140,
  },
  divider: {
    width: 1,
    height: 12,
    backgroundColor: "rgba(255, 247, 237, 0.1)",
  },
});
