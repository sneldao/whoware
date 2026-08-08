import { describe, expect, test } from "vitest";

import { evaluateHintRequest, type HintTier } from "../hooks/hint-gating";

function tiers(...ts: HintTier[]): ReadonlySet<HintTier> {
  return new Set<HintTier>(ts);
}

describe("evaluateHintRequest", () => {
  test("blocks when no clue is opened in the current scene", () => {
    const r = evaluateHintRequest({ tiersGenerated: tiers(), sceneHasOpenedClue: false }, "socratic");
    expect(r).toEqual({ action: "blocked", reason: "no-clue" });
  });

  test("generates a socratic hint once a clue is opened", () => {
    const r = evaluateHintRequest({ tiersGenerated: tiers(), sceneHasOpenedClue: true }, "socratic");
    expect(r).toEqual({ action: "generate" });
  });

  test("reshow a tier already generated for this scene", () => {
    const gen = tiers("socratic");
    const r = evaluateHintRequest({ tiersGenerated: gen, sceneHasOpenedClue: true }, "socratic");
    expect(r).toEqual({ action: "reshow" });
  });

  test("era tier requires the socratic tier first", () => {
    const r = evaluateHintRequest({ tiersGenerated: tiers(), sceneHasOpenedClue: true }, "era");
    expect(r).toEqual({ action: "blocked", reason: "tier-unlocked-by-prior" });
  });

  test("era tier generates after socratic exists", () => {
    const r = evaluateHintRequest({ tiersGenerated: tiers("socratic"), sceneHasOpenedClue: true }, "era");
    expect(r).toEqual({ action: "generate" });
  });

  test("proximity requires both socratic and era", () => {
    expect(
      evaluateHintRequest({ tiersGenerated: tiers(), sceneHasOpenedClue: true }, "proximity"),
    ).toEqual({ action: "blocked", reason: "tier-unlocked-by-prior" });
    expect(
      evaluateHintRequest({ tiersGenerated: tiers("socratic"), sceneHasOpenedClue: true }, "proximity"),
    ).toEqual({ action: "blocked", reason: "tier-unlocked-by-prior" });
    expect(
      evaluateHintRequest({ tiersGenerated: tiers("socratic", "era"), sceneHasOpenedClue: true }, "proximity"),
    ).toEqual({ action: "generate" });
  });

  test("skipping levels is not possible", () => {
    const r = evaluateHintRequest({ tiersGenerated: tiers("socratic"), sceneHasOpenedClue: true }, "proximity");
    expect(r).toEqual({ action: "blocked", reason: "tier-unlocked-by-prior" });
  });
});
