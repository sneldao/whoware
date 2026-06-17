import { describe, expect, test } from "vitest";

import { ALL_PROP_KINDS, isKnownPropKind, lookupProp } from "./props";

describe("prop-registry", () => {
  test("ALL_PROP_KINDS is non-empty and has no duplicates", () => {
    expect(ALL_PROP_KINDS.length).toBeGreaterThan(20);
    expect(new Set(ALL_PROP_KINDS).size).toBe(ALL_PROP_KINDS.length);
  });

  test("lookupProp returns metadata for known kinds", () => {
    const desk = lookupProp("desk");
    expect(desk?.category).toBe("furniture");
    expect(desk?.label).toBe("Desk");
  });

  test("lookupProp returns null for unknown kinds", () => {
    expect(lookupProp("rocket_ship")).toBeNull();
  });

  test("isKnownPropKind narrows correctly", () => {
    expect(isKnownPropKind("candle")).toBe(true);
    expect(isKnownPropKind("rocket_ship")).toBe(false);
  });

  test("every kind has a label and a category", () => {
    for (const kind of ALL_PROP_KINDS) {
      const meta = lookupProp(kind);
      expect(meta).not.toBeNull();
      expect(meta?.label.length).toBeGreaterThan(0);
      expect(["room", "furniture", "era", "doc", "object"]).toContain(meta?.category);
    }
  });
});