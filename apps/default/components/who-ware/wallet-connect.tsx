import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { isMetaMaskAvailable, shortenAddress } from "@/lib/wallet";

interface WalletConnectProps {
  address: string | null;
  isConnected: boolean;
  isCorrectChain: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  onSwitchChain: () => void;
}

export function WalletConnect({
  address,
  isConnected,
  isCorrectChain,
  isConnecting,
  onConnect,
  onSwitchChain,
}: WalletConnectProps) {
  if (isConnected && isCorrectChain) {
    return (
      <View style={styles.connected}>
        <View style={styles.dot} />
        <Text style={styles.address}>{shortenAddress(address!)}</Text>
        <Text style={styles.chainTag}>Mantle Sepolia</Text>
      </View>
    );
  }

  if (isConnected && !isCorrectChain) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onSwitchChain}
        style={({ pressed }) => [styles.button, styles.warningButton, pressed && styles.pressed]}
      >
        <Ionicons name="alert-circle" size={16} color="#FBBF24" />
        <Text style={styles.warningText}>Switch to Mantle Sepolia</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onConnect}
      disabled={isConnecting}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, isConnecting && styles.disabledButton]}
    >
      <Ionicons name="wallet" size={16} color="#111827" />
      <Text style={styles.buttonText}>
        {isConnecting ? "Connecting…" : isMetaMaskAvailable() ? "Connect Wallet" : "Install MetaMask"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: "#FBBF24",
  },
  warningButton: {
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.4)",
  },
  connected: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.1)",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4ADE80",
  },
  address: {
    color: "#FFF7ED",
    fontSize: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  chainTag: {
    color: "rgba(255, 247, 237, 0.44)",
    fontSize: 11,
    fontWeight: "800",
  },
  buttonText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
  },
  warningText: {
    color: "#FBBF24",
    fontSize: 14,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.72,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
