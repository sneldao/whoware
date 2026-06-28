import { Ionicons } from "@expo/vector-icons";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { sendArchivePayment } from "@/lib/paywall";
import type { Address } from "viem";
import { theme } from "@/lib/theme";

const CONVEX_API_BASE = process.env.EXPO_PUBLIC_CONVEX_SITE_URL ?? "https://colorless-seal-981.convex.site";

interface PaymentMetadata {
  required: boolean;
  amount: string;
  token: string;
  chainId: number;
  treasury: string;
  label: string;
}

interface ArchivePaywallProps {
  episodeId: Id<"episodes">;
  figureName: string;
  identityId: string;
  walletAddress: string | null;
  onUnlockComplete: () => void;
  onConnectWallet: () => void;
}

type PaywallState = "idle" | "checking" | "switching_network" | "paying" | "verifying" | "confirmed" | "error";

const POLYGON_EXPLORER_BASE = "https://amoy.polygonscan.com/tx";

export function ArchivePaywall({
  episodeId,
  figureName,
  identityId,
  walletAddress,
  onUnlockComplete,
  onConnectWallet,
}: ArchivePaywallProps) {
  const [state, setState] = useState<PaywallState>("checking");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentMeta, setPaymentMeta] = useState<PaymentMetadata | null>(null);
  const [had402, setHad402] = useState(false);

  const verifyAndUnlock = useAction(api.paywall.verifyAndUnlock);

  useEffect(() => {
    if (Platform.OS !== "web") {
      setState("idle");
      return;
    }
    let cancelled = false;
    async function checkAccess() {
      try {
        const res = await fetch(
          `${CONVEX_API_BASE}/api/archive/${episodeId}?identityId=${encodeURIComponent(identityId)}`,
        );
        if (cancelled) return;
        if (res.status === 402) {
          const body = await res.json();
          setPaymentMeta(body.payment);
          setHad402(true);
          setState("idle");
        } else if (res.ok) {
          onUnlockComplete();
          return;
        } else {
          setState("idle");
        }
      } catch {
        if (!cancelled) setState("idle");
      }
    }
    checkAccess();
    return () => { cancelled = true; };
  }, [episodeId, identityId, onUnlockComplete]);

  async function handlePay() {
    if (!walletAddress) {
      setError("Connect your wallet to unlock this episode.");
      return;
    }

    setError(null);

    // Step 1: Ensure correct network
    setState("switching_network");
    const { ensureCorrectNetwork } = await import("@/lib/paywall");
    const onNetwork = await ensureCorrectNetwork();
    if (!onNetwork) {
      setState("error");
      setError("Could not switch to Polygon Amoy. Add the network in your wallet and try again.");
      return;
    }

    // Step 2: Send payment
    setState("paying");
    const treasuryOverride = paymentMeta?.treasury as Address | undefined;
    const amountOverride = paymentMeta?.amount
      ? BigInt(Math.floor(parseFloat(paymentMeta.amount) * 1_000_000))
      : undefined;
    const hash = await sendArchivePayment(walletAddress as Address, {
      treasuryOverride,
      amountOverride,
    });
    if (!hash) {
      setState("error");
      setError("Payment failed. Make sure you have USDC on Polygon Amoy.");
      return;
    }

    setTxHash(hash);
    setState("verifying");

    // Step 3: Verify on-chain
    try {
      const success = await verifyAndUnlock({
        identityId,
        episodeId,
        txHash: hash,
      });

      if (success) {
        setState("confirmed");
        // Auto-dismiss after showing success state
        setTimeout(() => onUnlockComplete(), 2000);
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

  const amount = paymentMeta?.amount ?? "1";
  const label = paymentMeta?.label ?? "USDC";

  return (
    <View style={styles.paywall}>
      {state === "checking" ? (
        <View style={styles.statusRow}>
          <Ionicons name="hourglass" size={16} color={theme.violet} />
          <Text style={styles.statusText}>Checking archive access…</Text>
        </View>
      ) : (
        <>
          <View style={styles.iconContainer}>
            <Ionicons name={state === "confirmed" ? "lock-open" : "lock-closed"} size={40} color={state === "confirmed" ? theme.success : theme.accentAlpha70} />
          </View>

          {state === "confirmed" ? (
            <>
              <Text style={[styles.title, { color: theme.success }]}>Archive Unlocked</Text>
              <Text style={styles.subtitle}>
                Payment confirmed. Opening the case file…
              </Text>
              <View style={styles.statusRow}>
                <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                <Text style={[styles.statusText, { color: theme.success }]}>1 USDC paid · verified on Polygon</Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>Archive Locked</Text>
              <Text style={styles.subtitle}>
                This closed case is sealed. Pay {amount} {label} to unlock the full
                investigation — scenes, leaderboard, and identity reveal.
              </Text>

              {had402 && (
                <View style={styles.x402Tag}>
                  <Ionicons name="flash" size={12} color={theme.success} />
                  <Text style={styles.x402Text}>HTTP 402 Payment Required</Text>
                </View>
              )}

              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Price</Text>
                <Text style={styles.priceValue}>{amount} {label}</Text>
                <View style={styles.chainBadge}>
                  <Text style={styles.chainBadgeText}>Polygon Amoy</Text>
                </View>
              </View>

              {state === "idle" || state === "error" ? (
                walletAddress ? (
                  <Pressable
                    onPress={handlePay}
                    style={({ pressed }) => [
                      styles.payButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons name="wallet" size={18} color={theme.inkOnAccent} />
                    <Text style={styles.payButtonText}>Unlock for {amount} {label}</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={onConnectWallet}
                    style={({ pressed }) => [
                      styles.payButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons name="wallet" size={18} color={theme.inkOnAccent} />
                    <Text style={styles.payButtonText}>Connect wallet</Text>
                  </Pressable>
                )
              ) : null}
            </>
          )}

          {state === "switching_network" ? (
            <View style={styles.statusRow}>
              <Ionicons name="hourglass" size={16} color={theme.violet} />
              <Text style={styles.statusText}>Switching to Polygon Amoy…</Text>
            </View>
          ) : null}

          {state === "paying" ? (
            <View style={styles.statusRow}>
              <Ionicons name="hourglass" size={16} color={theme.accent} />
              <Text style={styles.statusText}>Confirm payment in your wallet…</Text>
            </View>
          ) : null}

          {state === "verifying" ? (
            <View style={styles.statusRow}>
              <Ionicons name="sync" size={16} color={theme.violet} />
              <Text style={styles.statusText}>Verifying payment on Polygon…</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="warning" size={14} color={theme.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {state === "error" && txHash ? (
            <Pressable onPress={openExplorer} style={styles.explorerLink}>
              <Ionicons name="open-outline" size={12} color={theme.inkAlpha50} />
              <Text style={styles.explorerText}>View transaction on explorer</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  x402Tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.25)",
  },
  x402Text: {
    color: theme.success,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  paywall: {
    padding: 24,
    gap: 14,
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: theme.accentAlpha6,
    borderWidth: 1,
    borderColor: theme.accentAlpha18,
    alignItems: "center",
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.accentAlpha10,
  },
  title: {
    color: theme.ink,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  subtitle: {
    color: theme.inkAlpha65,
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
    backgroundColor: theme.inkAlpha6,
  },
  priceLabel: {
    color: theme.inkAlpha50,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  priceValue: {
    color: theme.accent,
    fontSize: 18,
    fontWeight: "900",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(34, 197, 94, 0.08)",
  },
  featureText: {
    color: theme.inkAlpha65,
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  chainBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: theme.inkAlpha8,
  },
  chainBadgeText: {
    color: theme.inkAlpha60,
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
    backgroundColor: theme.accent,
    width: "100%",
  },
  payButtonText: {
    color: theme.inkOnAccent,
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
    color: theme.violet,
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
    color: theme.danger,
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
    color: theme.inkAlpha50,
    fontSize: 12,
    fontWeight: "700",
  },
});
