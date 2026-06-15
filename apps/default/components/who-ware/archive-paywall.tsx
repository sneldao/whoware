import { Ionicons } from "@expo/vector-icons";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { sendArchivePayment, POLYGON_AMOY_CHAIN } from "@/lib/paywall";
import type { Address } from "viem";

interface ArchivePaywallProps {
  episodeId: Id<"episodes">;
  figureName: string;
  identityId: string;
  walletAddress: string | null;
  onUnlockComplete: () => void;
}

type PaywallState = "idle" | "paying" | "verifying" | "error";

const POLYGON_EXPLORER_BASE = "https://amoy.polygonscan.com/tx";

export function ArchivePaywall({
  episodeId,
  figureName,
  identityId,
  walletAddress,
  onUnlockComplete,
}: ArchivePaywallProps) {
  const [state, setState] = useState<PaywallState>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verifyAndUnlock = useAction(api.paywall.verifyAndUnlock);

  async function handlePay() {
    if (!walletAddress) {
      setError("Connect your wallet to unlock this episode.");
      return;
    }

    setState("paying");
    setError(null);

    const hash = await sendArchivePayment(walletAddress as Address);
    if (!hash) {
      setState("error");
      setError("Payment failed. Make sure you have USDC on Polygon Amoy.");
      return;
    }

    setTxHash(hash);
    setState("verifying");

    try {
      const success = await verifyAndUnlock({
        identityId,
        episodeId,
        txHash: hash,
      });

      if (success) {
        onUnlockComplete();
      } else {
        setState("error");
        setError("Payment verification failed. The transaction may still be pending.");
      }
    } catch (err) {
      setState("error");
      setError("Verification error. Please try again.");
    }
  }

  async function openExplorer() {
    if (txHash) {
      await Linking.openURL(`${POLYGON_EXPLORER_BASE}/${txHash}`);
    }
  }

  return (
    <View style={styles.paywall}>
      <View style={styles.iconContainer}>
        <Ionicons name="lock-closed" size={40} color="rgba(251, 191, 36, 0.7)" />
      </View>

      <Text style={styles.title}>Archive Locked</Text>
      <Text style={styles.subtitle}>
        This closed case is sealed. Pay 1 USDC on Polygon Amoy to unlock the full
        investigation — scenes, leaderboard, and identity reveal.
      </Text>

      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>Price</Text>
        <Text style={styles.priceValue}>1 USDC</Text>
        <View style={styles.chainBadge}>
          <Text style={styles.chainBadgeText}>Polygon Amoy</Text>
        </View>
      </View>

      <View style={styles.featureRow}>
        <Ionicons name="flash" size={14} color="#22C55E" />
        <Text style={styles.featureText}>Gas paid in USDC via 1Shot Permissionless Relayer</Text>
      </View>

      {state === "idle" || state === "error" ? (
        <Pressable
          onPress={handlePay}
          disabled={!walletAddress}
          style={({ pressed }) => [
            styles.payButton,
            pressed && styles.pressed,
            !walletAddress && styles.disabledButton,
          ]}
        >
          <Ionicons name="wallet" size={18} color="#111827" />
          <Text style={styles.payButtonText}>
            {walletAddress ? "Unlock for 1 USDC" : "Connect wallet first"}
          </Text>
        </Pressable>
      ) : null}

      {state === "paying" ? (
        <View style={styles.statusRow}>
          <Ionicons name="hourglass" size={16} color="#A78BFA" />
          <Text style={styles.statusText}>Confirm payment in your wallet…</Text>
        </View>
      ) : null}

      {state === "verifying" ? (
        <View style={styles.statusRow}>
          <Ionicons name="hourglass" size={16} color="#A78BFA" />
          <Text style={styles.statusText}>Verifying payment on Polygon…</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="warning" size={14} color="#F87171" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {txHash ? (
        <Pressable onPress={openExplorer} style={styles.explorerLink}>
          <Ionicons name="open-outline" size={12} color="rgba(255, 247, 237, 0.5)" />
          <Text style={styles.explorerText}>View transaction</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  paywall: {
    padding: 24,
    gap: 14,
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: "rgba(251, 191, 36, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.18)",
    alignItems: "center",
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(251, 191, 36, 0.1)",
  },
  title: {
    color: "#FFF7ED",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  subtitle: {
    color: "rgba(255, 247, 237, 0.65)",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    textAlign: "center",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "rgba(255, 247, 237, 0.06)",
  },
  priceLabel: {
    color: "rgba(255, 247, 237, 0.5)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  priceValue: {
    color: "#FBBF24",
    fontSize: 18,
    fontWeight: "900",
  },
  chainBadge: {
    color: "rgba(255, 247, 237, 0.6)",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255, 247, 237, 0.08)",
  },  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(34, 197, 94, 0.08)",
  },
  featureText: {
    color: "rgba(255, 247, 237, 0.65)",
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  chainBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255, 247, 237, 0.08)",
  },
  chainBadgeText: {
    color: "rgba(255, 247, 237, 0.6)",
    fontSize: 11,
    fontWeight: "800",
  },
  payButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "#FBBF24",
    width: "100%",
  },
  payButtonText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.72,
  },
  disabledButton: {
    opacity: 0.45,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
  },
  statusText: {
    color: "#A78BFA",
    fontSize: 14,
    fontWeight: "800",
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(248, 113, 113, 0.1)",
  },
  errorText: {
    color: "#F87171",
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  explorerLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
  },
  explorerText: {
    color: "rgba(255, 247, 237, 0.5)",
    fontSize: 12,
    fontWeight: "700",
  },
});
