import { describe, expect, test } from "vitest";
import { computeDetailedProximity, computeProximity, computeScore, proximityMessage } from "./scoring";

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

describe("computeDetailedProximity", () => {
  test("reports era/region/field booleans for a same-era wrong-region guess", () => {
    const r = computeDetailedProximity({
      guessed: { era: "20th century", region: "Germany / USA", tags: ["physicist", "nobel"] },
      correct: { era: "20th century", region: "Britain", tags: ["wartime", "prime minister"] },
    }, "Albert Einstein");
    expect(r.proximity).toBe("same_era");
    expect(r.eraMatch).toBe(true);
    expect(r.regionMatch).toBe(false);
    expect(r.fieldMatch).toBe(false);
    expect(r.message).toContain("Albert Einstein");
  });

  test("fieldMatch fires on shared tags even when era and region differ", () => {
    const r = computeDetailedProximity({
      guessed: { era: "19th century", region: "England", tags: ["mathematician", "computing"] },
      correct: { era: "20th century", region: "Britain", tags: ["mathematician", "cryptanalyst"] },
    }, "Ada Lovelace");
    // 19th vs 20th century overlap within the era tolerance window
    expect(r.eraMatch).toBe(true);
    expect(r.regionMatch).toBe(false);
    expect(r.fieldMatch).toBe(true);
  });

  test("fieldMatch is case- and whitespace-insensitive", () => {
    const r = computeDetailedProximity({
      guessed: { era: "15th century", region: "China", tags: [" Painter "] },
      correct: { era: "20th century", region: "Mexico", tags: ["painter", "surrealism"] },
    }, "Guess");
    expect(r.fieldMatch).toBe(true);
  });

  test("fieldMatch is false when either side has no tags", () => {
    expect(
      computeDetailedProximity({
        guessed: { era: "20th century", region: "Britain", tags: [] },
        correct: { era: "20th century", region: "Britain", tags: ["wartime"] },
      }, "X").fieldMatch,
    ).toBe(false);
  });

  test("tier and booleans stay consistent for same-era-and-region", () => {
    const r = computeDetailedProximity({
      guessed: { era: "20th century", region: "Britain", tags: [] },
      correct: { era: "20th century", region: "Britain", tags: [] },
    }, "Alan Turing");
    expect(r.proximity).toBe("same_era_and_region");
    expect(r.eraMatch).toBe(true);
    expect(r.regionMatch).toBe(true);
  });

  test("delegation keeps computeProximity tiers identical", () => {
    const cases = [
      { guessed: { era: "20th century", region: "Britain", tags: [] }, correct: { era: "20th century", region: "Britain", tags: [] } },
      { guessed: { era: "20th century", region: "Germany / USA", tags: [] }, correct: { era: "20th century", region: "Britain", tags: [] } },
      { guessed: { era: "15th century", region: "Britain", tags: [] }, correct: { era: "20th century", region: "Britain", tags: [] } },
      { guessed: { era: "20th century", region: "Britain", tags: [] }, correct: { era: "15th century", region: "China", tags: [] } },
      { guessed: { era: "Renaissance", region: "Italy", tags: [] }, correct: { era: "Renaissance", region: "Britain", tags: [] } },
    ];
    for (const input of cases) {
      expect(computeProximity(input)).toBe(computeDetailedProximity(input, "X").proximity);
    }
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

describe("computeScore", () => {
  test("deducts hintsUsed from the final score", () => {
    const base = computeScore({
      memoriesViewed: 2,
      hotspotsOpened: 3,
      hintsUsed: 0,
      guessesUsed: 1,
      elapsedMs: 0,
    });
    const withHints = computeScore({
      memoriesViewed: 2,
      hotspotsOpened: 3,
      hintsUsed: 1,
      guessesUsed: 1,
      elapsedMs: 0,
    });
    expect(base - withHints).toBe(150);
  });

  test("clamps to zero", () => {
    const score = computeScore({
      memoriesViewed: 5,
      hotspotsOpened: 20,
      hintsUsed: 10,
      guessesUsed: 1,
      elapsedMs: 0,
    });
    expect(score).toBe(0);
  });
});
