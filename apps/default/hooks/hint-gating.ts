// Pure hint-gating logic extracted from use-guessing.ts for unit testing.
// These functions take plain data (no React, no Convex) so they can be tested
// standalone without the full hook runtime.

export type HintTier = "socratic" | "era" | "proximity";

export type HintAction = {
  action: "generate";
} | {
  action: "reshow";
} | {
  action: "blocked";
  reason: "no-clue" | "tier-unlocked-by-prior";
};

/**
 * Decide what happens when the player taps a hint tier for a scene.
 *
 * - `reshow` — tier already generated for this scene; no new charge.
 * - `generate` — tier is unlocked (lower tier done + clue open).
 * - `blocked` — either the clue gate isn't satisfied (`no-clue`) or the
 *   prior tier is missing (`tier-unlocked-by-prior`).
 */
export function evaluateHintRequest(
  input: {
    tiersGenerated: ReadonlySet<HintTier>;
    sceneHasOpenedClue: boolean;
  },
  tier: HintTier,
): HintAction {
  if (!input.sceneHasOpenedClue) return { action: "blocked", reason: "no-clue" };
  if (input.tiersGenerated.has(tier)) return { action: "reshow" };
  if (tier === "era" && !input.tiersGenerated.has("socratic")) {
    return { action: "blocked", reason: "tier-unlocked-by-prior" };
  }
  if (tier === "proximity" && !input.tiersGenerated.has("era")) {
    return { action: "blocked", reason: "tier-unlocked-by-prior" };
  }
  return { action: "generate" };
}
