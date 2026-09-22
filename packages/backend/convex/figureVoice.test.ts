import { describe, expect, test } from "vitest";
import {
  bucketEra,
  pickObjectKind,
  pickPronoun,
  pickRelationalLabel,
  pickRole,
  quoteForClue,
} from "./figureVoice";

describe("pickRole", () => {
  test("scholar tags route to scholar", () => {
    expect(pickRole(["mathematician", "astronomer"])).toBe("scholar");
    expect(pickRole(["scientist"])).toBe("scholar");
    expect(pickRole(["philosopher"])).toBe("scholar");
  });

  test("warrior tags route to warrior", () => {
    expect(pickRole(["warrior"])).toBe("warrior");
    expect(pickRole(["knight"])).toBe("warrior");
    expect(pickRole(["pirate"])).toBe("warrior");
  });

  test("artist tags route to artist", () => {
    expect(pickRole(["painter"])).toBe("artist");
    expect(pickRole(["composer"])).toBe("artist");
    expect(pickRole(["sculptor"])).toBe("artist");
  });

  test("ruler tags route to ruler", () => {
    expect(pickRole(["monarch"])).toBe("ruler");
    expect(pickRole(["empress"])).toBe("ruler");
  });

  test("religious tags route to religious", () => {
    expect(pickRole(["saint", "monk"])).toBe("religious");
  });

  test("unknown / empty tags fall through to commoner", () => {
    expect(pickRole([])).toBe("commoner");
    expect(pickRole(["unknown-tag"])).toBe("commoner");
  });

  test("scholar beats warrior when both tags present", () => {
    expect(pickRole(["warrior", "astronomer"])).toBe("scholar");
  });
});

describe("pickObjectKind", () => {
  test("instruments", () => {
    expect(pickObjectKind("A bronze astrolabe")).toBe("instrument");
    expect(pickObjectKind("A polished telescope")).toBe("instrument");
    expect(pickObjectKind("An orrery of brass planets")).toBe("instrument");
  });

  test("weapons", () => {
    expect(pickObjectKind("A bloodied sword")).toBe("weapon");
    expect(pickObjectKind("An ornate dagger")).toBe("weapon");
  });

  test("documents", () => {
    expect(pickObjectKind("A wax-sealed scroll")).toBe("document");
    expect(pickObjectKind("A torn parchment")).toBe("document");
  });

  test("letters vs documents", () => {
    expect(pickObjectKind("A handwritten letter")).toBe("letter");
    expect(pickObjectKind("A manuscript ledger")).toBe("document");
  });

  test("garments", () => {
    expect(pickObjectKind("A silk cloak")).toBe("garment");
    expect(pickObjectKind("A royal crown")).toBe("garment");
  });

  test("buildings", () => {
    expect(pickObjectKind("A temple ruin")).toBe("building");
    expect(pickObjectKind("The cathedral spire")).toBe("building");
  });

  test("unknown falls back to generic", () => {
    expect(pickObjectKind("A thing")).toBe("generic");
  });
});

describe("bucketEra", () => {
  test("BCE buckets to ancient", () => {
    expect(bucketEra("4th century BCE")).toBe("ancient");
    expect(bucketEra("1st century BCE")).toBe("ancient");
  });

  test("low CE centuries bucket to ancient", () => {
    expect(bucketEra("3rd century")).toBe("ancient");
    expect(bucketEra("4th century")).toBe("ancient");
  });

  test("5th–14th century is classical", () => {
    expect(bucketEra("5th century")).toBe("classical");
    expect(bucketEra("12th century")).toBe("classical");
    expect(bucketEra("15th century")).toBe("classical");
  });

  test("16th–17th century is renaissance", () => {
    expect(bucketEra("16th century")).toBe("renaissance");
    expect(bucketEra("17th century")).toBe("renaissance");
  });

  test("18th–19th century is early-modern", () => {
    expect(bucketEra("18th century")).toBe("early-modern");
    expect(bucketEra("19th century")).toBe("early-modern");
  });

  test("20th century onward is modern", () => {
    expect(bucketEra("20th century")).toBe("modern");
    expect(bucketEra("1920")).toBe("modern");
  });

  test("year ranges handled", () => {
    expect(bucketEra("4th–5th century")).toBe("ancient");
    expect(bucketEra("1500s")).toBe("renaissance");
  });

  test("empty era falls back to early-modern", () => {
    expect(bucketEra("")).toBe("early-modern");
  });
});

describe("quoteForClue", () => {
  const baseFigure = {
    canonicalName: "Hypatia",
    era: "4th century",
    region: "Alexandria",
    tags: ["mathematician", "astronomer", "philosopher"],
  };

  const baseScene = {
    title: "The Observatory",
    location: "Alexandria",
    era: "4th century",
  };

  test("returns a non-empty quote", () => {
    const q = quoteForClue({
      figure: baseFigure,
      scene: baseScene,
      clue: { label: "A bronze astrolabe", detail: "Greek inscriptions cover its surface." },
    });
    expect(q.length).toBeGreaterThan(20);
    expect(q).toMatch(/[.!?]$/);
  });

  test("different clue labels produce different quotes", () => {
    const a = quoteForClue({
      figure: baseFigure,
      scene: baseScene,
      clue: { label: "A bronze astrolabe", detail: "Greek inscriptions." },
    });
    const b = quoteForClue({
      figure: baseFigure,
      scene: baseScene,
      clue: { label: "A bloodied sword", detail: "Old blade, recently used." },
    });
    expect(a).not.toBe(b);
  });

  test("different figure roles shift the voice", () => {
    const scholar = quoteForClue({
      figure: { ...baseFigure, tags: ["mathematician"] },
      scene: baseScene,
      clue: { label: "An astrolabe", detail: "Old." },
    });
    const warrior = quoteForClue({
      figure: { ...baseFigure, tags: ["warrior"] },
      scene: baseScene,
      clue: { label: "An astrolabe", detail: "Old." },
    });
    expect(scholar).not.toBe(warrior);
  });

  test("is deterministic across calls", () => {
    const args = {
      figure: baseFigure,
      scene: baseScene,
      clue: { label: "A bronze astrolabe", detail: "Greek inscriptions." },
    };
    const a = quoteForClue(args);
    const b = quoteForClue(args);
    const c = quoteForClue(args);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  test("returns a quote that mentions the figure's region", () => {
    const q = quoteForClue({
      figure: baseFigure,
      scene: baseScene,
      clue: { label: "A bronze astrolabe", detail: "Greek inscriptions." },
    });
    expect(q.toLowerCase()).toContain("alexandria");
  });

  test("handles an empty tags array (commoner voice)", () => {
    const q = quoteForClue({
      figure: { ...baseFigure, tags: [] },
      scene: baseScene,
      clue: { label: "A bronze astrolabe", detail: "Greek inscriptions." },
    });
    expect(q.length).toBeGreaterThan(20);
  });

  test("handles ancient figure (Hypatia-like)", () => {
    const q = quoteForClue({
      figure: { ...baseFigure, era: "4th century", region: "Alexandria" },
      scene: { ...baseScene, era: "4th century" },
      clue: { label: "An astrolabe of bronze", detail: "Greek inscriptions." },
    });
    expect(q).toBeTruthy();
    expect(q.length).toBeGreaterThan(20);
  });

  test("handles modern figure (20th century)", () => {
    const q = quoteForClue({
      figure: { ...baseFigure, era: "20th century", region: "Vienna", tags: ["scientist"] },
      scene: { ...baseScene, location: "Vienna", era: "20th century" },
      clue: { label: "A worn notebook", detail: "Equations fill every page." },
    });
    expect(q).toBeTruthy();
    expect(q.toLowerCase()).toContain("vienna");
  });

  test("Joan of Arc quote has warrior cadence", () => {
    const q = quoteForClue({
      figure: {
        canonicalName: "Joan of Arc",
        era: "15th century",
        region: "France",
        tags: ["warrior", "religious"],
      },
      scene: { title: "The Field", location: "Orléans", era: "15th century" },
      clue: { label: "A bloodied banner", detail: "Three stars embroidered." },
    });
    expect(q).toBeTruthy();
    // Warrior voice should not be excessively long
    expect(q.split(".").length).toBeLessThanOrEqual(4);
  });
});

describe("v0.4 — pickPronoun", () => {
  test("Hypatia is she", () => expect(pickPronoun("Hypatia of Alexandria")).toBe("she"));
  test("Marcus Aurelius is he", () => expect(pickPronoun("Marcus Aurelius")).toBe("he"));
  test("Joan of Arc is she", () => expect(pickPronoun("Joan of Arc")).toBe("she"));
  test("Ada Lovelace is she", () => expect(pickPronoun("Ada Lovelace")).toBe("she"));
  test("Frida Kahlo is she", () => expect(pickPronoun("Frida Kahlo")).toBe("she"));
  test("Unknown names default to they", () => expect(pickPronoun("Xylo the Strange")).toBe("they"));
  test("Title prefixes are stripped before lookup", () => {
    expect(pickPronoun("Queen Victoria")).toBe("she");
    expect(pickPronoun("Pope Julius II")).toBe("he");
    expect(pickPronoun("Saint Teresa")).toBe("she");
  });
});

describe("v0.4 — pickRelationalLabel", () => {
  test("teacher-tags produce student-leaning labels", () => {
    const label = pickRelationalLabel(["teacher", "rhetorician"]);
    expect(["my student", "the one I taught", "the one I trained"]).toContain(label);
  });
  test("student-tags produce teacher-leaning labels", () => {
    const label = pickRelationalLabel(["student", "philosopher"]);
    expect(["my teacher", "my mentor", "the one who taught me"]).toContain(label);
  });
  test("rival tags produce my rival", () => {
    expect(pickRelationalLabel(["rival"])).toBe("my rival");
  });
  test("empty / unrelated tags produce neutral labels", () => {
    const label = pickRelationalLabel(["astronomer"]);
    expect([
      "the one I worked beside",
      "the person I learned from",
      "the one I followed",
      "the one I kept company with",
    ]).toContain(label);
  });
});

describe("v0.4 — quoteForClue in relational mode", () => {
  const speaker = {
    canonicalName: "Synesius of Cyrene",
    era: "4th century",
    region: "Cyrene",
    tags: ["philosopher", "student"],
  };
  const scene = { title: "The Observatory", location: "Alexandria", era: "4th century" };

  test("targetFigure triggers relational voice", () => {
    const q = quoteForClue({
      figure: speaker,
      targetFigure: { canonicalName: "Hypatia" },
      scene,
      clue: { label: "A bronze astrolabe", detail: "Greek inscriptions." },
    });
    // Should use she-pronoun for Hypatia (female target)
    expect(q.toLowerCase()).toContain("she");
    // Should NOT use self-pronoun for "I learned" (which would be self-mode)
    expect(q).not.toMatch(/^I /);
  });

  test("same name as figure falls back to self-voice", () => {
    const q = quoteForClue({
      figure: speaker,
      targetFigure: { canonicalName: speaker.canonicalName },
      scene,
      clue: { label: "A bronze astrolabe", detail: "Greek inscriptions." },
    });
    // Self-mode starts with "I"
    expect(q).toMatch(/^I /);
  });

  test("target pronoun is consistent across the quote (no they/her drift)", () => {
    const q = quoteForClue({
      figure: speaker,
      targetFigure: { canonicalName: "Hypatia" },
      scene,
      clue: { label: "A worn journal", detail: "Old leather." },
    });
    // No "them" should leak through (the engine normalizes).
    expect(q.toLowerCase()).not.toContain("them");
    expect(q.toLowerCase()).not.toContain("their");
  });

  test("he-target pronoun for male figures", () => {
    const q = quoteForClue({
      figure: { ...speaker, tags: ["rhetorician"] },
      targetFigure: { canonicalName: "Marcus Aurelius" },
      scene,
      clue: { label: "A bronze helm", detail: "Laurel-wreathed." },
    });
    expect(q.toLowerCase()).toContain("he ");
  });

  test("relational follow phrases use pronoun, not 'them/their/they'", () => {
    const q = quoteForClue({
      figure: speaker,
      targetFigure: { canonicalName: "Hypatia" },
      scene,
      clue: { label: "A bronze astrolabe", detail: "Greek inscriptions." },
    });
    // After normalizePronouns, no stray neutral pronouns referencing the target
    const occurrences = (q.toLowerCase().match(/\bthey\b/g) || []).length;
    expect(occurrences).toBe(0);
  });

  test("is deterministic in relational mode too", () => {
    const args = {
      figure: speaker,
      targetFigure: { canonicalName: "Hypatia" },
      scene,
      clue: { label: "A bronze astrolabe", detail: "Greek inscriptions." },
    };
    expect(quoteForClue(args)).toBe(quoteForClue(args));
  });
});