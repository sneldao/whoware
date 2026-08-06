import { describe, expect, test } from "vitest";
import { computeProximity, proximityMessage } from "./scoring";

describe("computeProximity", () => {
  test("returns 'same_era_and_region' when guessed and correct are the same figure (identical data)", () => {
    const figure = { era: "20th century", region: "Britain", tags: ["wartime"] };
    // Same figure object → same era and same region → same_era_and_region
    // (computeProximity doesn't know it's "the same figure" — it compares attributes)
    expect(computeProximity({ guessed: figure, correct: figure })).toBe("same_era_and_region");
  });

  test("returns 'same_era_and_region' for a contemporary in the same region", () => {
    expect(
      computeProximity({
        guessed: { era: "20th century", region: "Britain", tags: [] },
        correct: { era: "20th century", region: "Britain", tags: [] },
      }),
    ).toBe("same_era_and_region");
  });

  test("returns 'same_era' for matching era but different region", () => {
    expect(
      computeProximity({
        guessed: { era: "20th century", region: "Britain", tags: [] },
        correct: { era: "20th century", region: "Germany / USA", tags: [] },
      }),
    ).toBe("same_era");
  });

  test("returns 'same_region' for matching region but clearly different era", () => {
    expect(
      computeProximity({
        guessed: { era: "15th century", region: "Britain", tags: [] },
        correct: { era: "20th century", region: "Britain", tags: [] },
      }),
    ).toBe("same_region");
  });

  test("returns 'same_era_and_region' when centuries overlap and region overlaps", () => {
    expect(
      computeProximity({
        guessed: { era: "19th century", region: "France", tags: [] },
        correct: { era: "19th–20th century", region: "Poland / France", tags: [] },
      }),
    ).toBe("same_era_and_region"); // region overlaps (France) and centuries overlap
  });

  test("returns 'off' for completely different figures", () => {
    expect(
      computeProximity({
        guessed: { era: "20th century", region: "Britain", tags: [] },
        correct: { era: "15th century", region: "China", tags: [] },
      }),
    ).toBe("off");
  });

  test("handles compound regions like 'Germany / USA' vs 'Germany' with different era", () => {
    expect(
      computeProximity({
        guessed: { era: "19th century", region: "Germany / USA", tags: [] },
        correct: { era: "15th century", region: "Germany", tags: [] },
      }),
    ).toBe("same_region");
  });

  test("handles era keyword overlap (Renaissance)", () => {
    expect(
      computeProximity({
        guessed: { era: "Renaissance", region: "Italy", tags: [] },
        correct: { era: "Renaissance", region: "Britain", tags: [] },
      }),
    ).toBe("same_era");
  });
});

describe("proximityMessage", () => {
  test("returns the guessed name in every message", () => {
    const name = "Ada Lovelace";
    const tiers = ["correct", "same_era", "same_region", "same_era_and_region", "same_century", "off"] as const;
    for (const tier of tiers) {
      const msg = proximityMessage(tier, name);
      expect(msg).toContain(name);
    }
  });

  test("same_era_and_region mentions 'contemporary'", () => {
    expect(proximityMessage("same_era_and_region", "Einstein")).toContain("contemporary");
  });

  test("off mentions 'not the one'", () => {
    expect(proximityMessage("off", "Tesla")).toContain("not the one");
  });
});
