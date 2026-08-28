import { ActionToast } from "@/components/who-ware/action-toast";
import { EnhancedIdentityReveal } from "@/components/who-ware/enhanced-identity-reveal";
import { SmartAccountUpgradeOverlay } from "@/components/who-ware/smart-account-upgrade-overlay";
import { TooltipOverlay } from "@/components/curator/tooltip";
import {
  BASE_SCORE, GUESS_PENALTY, HINT_PENALTY, HOTSPOT_PENALTY, MAX_GUESSES_PER_RUN,
  MEMORY_PENALTY, TIME_BUCKET_MS, TIME_BUCKET_PENALTY,
} from "@/convex/scoring";
import { theme } from "@/lib/theme";

export interface TooltipLayerProps {
  activeBadge: string | null;
  onDismiss: () => void;
}

/**
 * Top-level tooltip layer with the score breakdown whose numbers are
 * interpolated from the scoring constants — never re-typed as prose.
 */
export function TooltipLayer({ activeBadge, onDismiss }: TooltipLayerProps) {
  return (
    <TooltipOverlay
      activeBadge={activeBadge}
      onDismiss={onDismiss}
      definitions={{
        score: {
          title: "Your score ceiling — live",
          description: `This is what a correct accusation right now would earn — it only falls. Every solve starts at ${BASE_SCORE.toLocaleString()} points. Each memory opened costs ${MEMORY_PENALTY.toLocaleString()}, each clue inspected ${HOTSPOT_PENALTY.toLocaleString()}, each hint ${HINT_PENALTY.toLocaleString()}, each wrong accusation ${GUESS_PENALTY.toLocaleString()}, and every ${TIME_BUCKET_MS / 1_000} seconds ${TIME_BUCKET_PENALTY}. Restraint and speed maximize your score.`,
        },
        clues: {
          title: "Clues opened",
          description: `Clues are hidden details embedded in each scene's imagery. Opening a clue reveals information about the figure but reduces your max score by ${HOTSPOT_PENALTY.toLocaleString()} points per clue.`,
        },
        hints: {
          title: "Memory whispers used",
          description: `Each whisper reduces your ceiling by ${HINT_PENALTY.toLocaleString()} points. One whisper per tier per scene — higher tiers cost the same but reveal more.`,
        },
        guesses: {
          title: "Accusations remaining",
          description: `You have ${MAX_GUESSES_PER_RUN} accusations per episode. Each wrong one costs ${GUESS_PENALTY.toLocaleString()} points from your ceiling. Spend them when the room feels right.`,
        },
        mint: {
          title: "Score minted on Mantle",
          description: "Your solve score is recorded as a permanent on-chain credential on the Mantle blockchain. Each mint requires a small gas fee and creates an immutable record tied to your wallet. Tap to view the transaction on the explorer.",
        },
        streak: {
          title: "Streak recorded on Mantle",
          description: "Your current and best streak are recorded on-chain alongside your score. Streaks track consecutive daily solves and reset if you miss a day. Tap to view the transaction on the explorer.",
        },
      }}
      accentColor={theme.accent}
    />
  );
}

export interface ToastLayerProps {
  visible: boolean;
  message: string;
  type: "info" | "warning" | "success" | "error";
  onDismiss: () => void;
}

export function ToastLayer({ visible, message, type, onDismiss }: ToastLayerProps) {
  return <ActionToast visible={visible} message={message} type={type} onDismiss={onDismiss} />;
}

export interface RevealLayerProps {
  visible: boolean;
  figureName: string;
  era: string;
  region: string;
  tags: string[];
  summary?: string;
  /** Episode whose AI bio powers the story-first reveal. */
  episodeId?: string;
  /** Caller identity — gates the bio reveal. */
  identityId?: string;
  imageUrl?: string;
  /** Register: a solved run names the body; an exhausted run closes the file. */
  variant?: "solved" | "exhausted";
  onContinue: () => void;
}

export function RevealLayer({ visible, figureName, era, region, tags, summary, episodeId, identityId, imageUrl, variant, onContinue }: RevealLayerProps) {
  if (!visible) return null;
  return (
    <EnhancedIdentityReveal
      figureName={figureName}
      era={era}
      region={region}
      tags={tags}
      summary={summary}
      episodeId={episodeId}
      identityId={identityId}
      imageUrl={imageUrl}
      variant={variant}
      onContinue={onContinue}
    />
  );
}

export interface UpgradeOverlayLayerProps {
  isVisible: boolean;
  isUpgrading: boolean;
  isUpgraded: boolean;
  error: string | null;
  onDismiss: () => void;
}

export function UpgradeOverlayLayer({ isVisible, isUpgrading, isUpgraded, error, onDismiss }: UpgradeOverlayLayerProps) {
  return (
    <SmartAccountUpgradeOverlay
      isVisible={isVisible}
      isUpgrading={isUpgrading}
      isUpgraded={isUpgraded}
      error={error}
      onDismiss={onDismiss}
    />
  );
}
