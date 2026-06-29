import { Component, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/lib/theme";
import { logger } from "@/lib/logger";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Short label for logs: "Scene3D", "OnChain", "Leaderboard" */
  label: string;
  /** Custom fallback UI shown on error. Receives the `reset` callback. */
  fallback?: (reset: () => void, error: Error) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render-phase exceptions inside the wrapped subtree. Designed for
 * the crash-prone sections of the game screen (3D scene, on-chain overlay,
 * leaderboard) where a single bug would otherwise take down the entire app
 * and the player's streak.
 *
 * Does NOT catch:
 *   - event handler exceptions (wrap those in try/catch)
 *   - async code (use proper await + catch)
 *   - server-side rendering (skip SSR until needed)
 *
 * Default fallback is a compact, retryable card. Pass `fallback` for a
 * section-specific UX.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error): void {
    logger.error(`ErrorBoundary.${this.props.label}`, error);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.reset, this.state.error);
      }
      return <DefaultErrorCard label={this.props.label} reset={this.reset} />;
    }
    return this.props.children;
  }
}

function DefaultErrorCard({ label, reset }: { label: string; reset: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.icon}>
        <Ionicons name="alert-circle" size={18} color={theme.danger} />
      </View>
      <Text style={styles.title}>{label} failed to load</Text>
      <Text style={styles.body}>This section will retry when you tap below.</Text>
      <Pressable onPress={reset} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: theme.dangerBg,
    borderWidth: 1,
    borderColor: theme.dangerBorder,
    alignItems: "center",
    gap: 6,
    marginVertical: 8,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.dangerBg,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: theme.danger,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  body: {
    color: theme.dangerText,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  retry: {
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.dangerBg,
    borderWidth: 1,
    borderColor: theme.dangerBorder,
  },
  retryText: {
    color: theme.danger,
    fontSize: 12,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.72,
  },
});
