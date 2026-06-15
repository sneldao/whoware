import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

interface IdentitySectionProps {
  walletAddress: string | null;
  isWalletConnected: boolean;
  isCorrectChain: boolean;
  isSmartAccountUpgraded: boolean;
  isSmartAccountUpgrading: boolean;
  isMinting: boolean;
  isMinted: boolean;
  isStreakUpdating: boolean;
  hasStreakTx: boolean;
  type?: "start" | "during";
  onConnect: () => void;
  onUpgrade: () => Promise<boolean>;
  onSwitchChain: () => void;
}

export function IdentitySection({
  walletAddress,
  isWalletConnected,
  isCorrectChain,
  isSmartAccountUpgraded,
  isSmartAccountUpgrading,
  isMinting,
  isMinted,
  isStreakUpdating,
  hasStreakTx,
  type = "during",
  onConnect,
  onUpgrade,
  onSwitchChain,
}: IdentitySectionProps) {
  const [expanded, setExpanded] = useState(false);
  const chevronRotate = useSharedValue(0);

  function toggle() {
    chevronRotate.value = withTiming(expanded ? 0 : 180, { duration: 200 });
    setExpanded(!expanded);
  }

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotate.value}deg` }],
  }));

  const showUpgradePrompt = isWalletConnected && !isSmartAccountUpgraded && !isSmartAccountUpgrading;

  return (
    <View style={styles.container}>
      {/* Collapsed state: single row showing wallet + status */}
      <Pressable onPress={toggle} style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
        <View style={styles.headerLeft}>
          <View style={[styles.statusDot, { backgroundColor: isWalletConnected ? (isCorrectChain ? "#22C55E" : "#FBBF24") : "#64748B" }]} />
          <Ionicons name="shield" size={16} color={isSmartAccountUpgraded ? "#22C55E" : "#64748B"} />
          <Text style={[styles.headerText, isSmartAccountUpgraded && styles.headerTextActive]}>
            {isSmartAccountUpgraded ? "Smart Account" : isWalletConnected ? "Wallet" : "Identity"}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {isSmartAccountUpgraded ? (
            <View style={styles.miniBadge}>
              <Text style={styles.miniBadgeText}>ERC-7710</Text>
            </View>
          ) : null}
          {isMinted ? (
            <View style={[styles.miniBadge, styles.mintedBadge]}>
              <Text style={styles.miniBadgeText}>Score ✓</Text>
            </View>
          ) : null}
          <Animated.View style={chevronStyle}>
            <Ionicons name="chevron-down" size={16} color="rgba(255, 247, 237, 0.4)" />
          </Animated.View>
        </View>
      </Pressable>

      {/* Expanded details */}
      {expanded && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.body}>
          {/* Wallet */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="wallet" size={14} color={isWalletConnected ? "#22C55E" : "#64748B"} />
              <Text style={styles.rowLabel}>Wallet</Text>
            </View>
            {isWalletConnected ? (
              <View style={styles.rowRight}>
                <Text style={styles.rowValue}>
                  {walletAddress?.slice(0, 6)}…{walletAddress?.slice(-4)}
                </Text>
                {isCorrectChain ? (
                  <View style={styles.statusTag}>
                    <Text style={styles.statusTagText}>Mantle</Text>
                  </View>
                ) : (
                  <Pressable onPress={onSwitchChain} style={styles.actionTag}>
                    <Text style={styles.actionTagText}>Switch chain</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <Pressable onPress={onConnect} style={styles.actionTag}>
                <Text style={styles.actionTagText}>Connect</Text>
              </Pressable>
            )}
          </View>

          {/* Smart Account */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons
                name={isSmartAccountUpgraded ? "shield-checkmark" : "shield-outline"}
                size={14}
                color={isSmartAccountUpgraded ? "#22C55E" : "#64748B"}
              />
              <Text style={styles.rowLabel}>Smart Account</Text>
            </View>
            {isSmartAccountUpgraded ? (
              <View style={styles.rowRight}>
                <View style={styles.statusTag}>
                  <Text style={styles.statusTagText}>Active</Text>
                </View>
                <View style={styles.techTag}>
                  <Text style={styles.techTagText}>ERC-7710</Text>
                </View>
              </View>
            ) : isSmartAccountUpgrading ? (
              <View style={styles.rowRight}>
                <Text style={styles.rowValueDim}>Upgrading…</Text>
              </View>
            ) : isWalletConnected ? (
              <Pressable onPress={onUpgrade as any} style={styles.actionTag}>
                <Text style={styles.actionTagText}>Upgrade</Text>
              </Pressable>
            ) : (
              <Text style={styles.rowValueDim}>Connect wallet</Text>
            )}
          </View>

          {/* Score minting */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons
                name={isMinted ? "checkmark-circle" : isMinting ? "hourglass" : "ellipse-outline"}
                size={14}
                color={isMinted ? "#22C55E" : isMinting ? "#A78BFA" : "#64748B"}
              />
              <Text style={styles.rowLabel}>Score</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>
                {isMinted ? "Minted on Mantle" : isMinting ? "Minting…" : "Not minted"}
              </Text>
            </View>
          </View>

          {/* Streak */}
          {hasStreakTx || isStreakUpdating ? (
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons
                  name={hasStreakTx ? "checkmark-circle" : "hourglass"}
                  size={14}
                  color={hasStreakTx ? "#22C55E" : "#A78BFA"}
                />
                <Text style={styles.rowLabel}>Streak</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.rowValue}>
                  {hasStreakTx ? "On-chain" : isStreakUpdating ? "Updating…" : "—"}
                </Text>
              </View>
            </View>
          ) : null}

          {/* 1Shot (if wallet connected) */}
          {isWalletConnected ? (
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="flash" size={14} color="#22C55E" />
                <Text style={styles.rowLabel}>Payments</Text>
              </View>
              <View style={styles.rowRight}>
                <View style={styles.statusTag}>
                  <Text style={styles.statusTagText}>1Shot gasless</Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* Upgrade prompt */}
          {showUpgradePrompt && type === "start" ? (
            <View style={styles.upgradePrompt}>
              <Ionicons name="shield-outline" size={14} color="#A78BFA" />
              <Text style={styles.upgradePromptText}>
                Upgrade to a Smart Account for gas abstraction and ERC-7710 delegation
              </Text>
              <Pressable onPress={onUpgrade as any} style={styles.upgradeAction}>
                <Text style={styles.upgradeActionText}>Upgrade</Text>
              </Pressable>
            </View>
          ) : null}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.08)",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerText: {
    color: "rgba(255, 247, 237, 0.6)",
    fontSize: 13,
    fontWeight: "800",
  },
  headerTextActive: {
    color: "#22C55E",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  miniBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
  },
  miniBadgeText: {
    color: "#22C55E",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  mintedBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
  },
  body: {
    gap: 1,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowLabel: {
    color: "rgba(255, 247, 237, 0.7)",
    fontSize: 12,
    fontWeight: "700",
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rowValue: {
    color: "rgba(255, 247, 237, 0.8)",
    fontSize: 12,
    fontWeight: "700",
  },
  rowValueDim: {
    color: "rgba(255, 247, 237, 0.4)",
    fontSize: 12,
    fontWeight: "700",
    fontStyle: "italic",
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
  },
  statusTagText: {
    color: "#22C55E",
    fontSize: 10,
    fontWeight: "800",
  },
  techTag: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(34, 197, 94, 0.08)",
  },
  techTagText: {
    color: "#22C55E",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  actionTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(251, 191, 36, 0.12)",
  },
  actionTagText: {
    color: "#FBBF24",
    fontSize: 10,
    fontWeight: "800",
  },
  upgradePrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: "rgba(167, 139, 250, 0.08)",
    flexWrap: "wrap",
  },
  upgradePromptText: {
    flex: 1,
    color: "rgba(255, 247, 237, 0.6)",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
    minWidth: 150,
  },
  upgradeAction: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(167, 139, 250, 0.2)",
  },
  upgradeActionText: {
    color: "#A78BFA",
    fontSize: 11,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.72,
  },
});
