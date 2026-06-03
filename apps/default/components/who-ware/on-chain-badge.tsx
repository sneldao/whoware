import { Ionicons } from "@expo/vector-icons";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

interface OnChainBadgeProps {
  txHash: string | null;
  isMinting: boolean;
}

const MANTLE_EXPLORER_BASE = "https://sepolia.mantlescan.xyz/tx";

export function OnChainBadge({ txHash, isMinting }: OnChainBadgeProps) {
  if (isMinting) {
    return (
      <View style={styles.badge}>
        <Ionicons name="hourglass" size={12} color="#A78BFA" />
        <Text style={styles.mintingText}>Minting on Mantle…</Text>
      </View>
    );
  }

  if (!txHash) return null;

  async function handlePress() {
    await Linking.openURL(`${MANTLE_EXPLORER_BASE}/${txHash}`);
  }

  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [styles.badge, styles.linked, pressed && styles.pressed]}>
      <Ionicons name="checkmark-circle" size={12} color="#4ADE80" />
      <Text style={styles.verifiedText}>Verified on Mantle</Text>
      <Ionicons name="open-outline" size={10} color="rgba(74, 222, 128, 0.6)" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderCurve: "continuous",
    backgroundColor: "rgba(74, 222, 128, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.2)",
    alignSelf: "flex-start",
  },
  linked: {
    backgroundColor: "rgba(74, 222, 128, 0.12)",
  },
  mintingText: {
    color: "#A78BFA",
    fontSize: 11,
    fontWeight: "800",
  },
  verifiedText: {
    color: "#4ADE80",
    fontSize: 11,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.72,
  },
});
