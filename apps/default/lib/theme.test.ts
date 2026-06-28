import { describe, expect, it } from "vitest";
import { theme } from "./theme";

describe("theme tokens", () => {
  it("exposes the canonical accent and its alpha ladder", () => {
    expect(theme.accent).toBe("#FBBF24");
    expect(theme.accentAlpha10).toBe("rgba(251, 191, 36, 0.1)");
    expect(theme.accentAlpha25).toBe("rgba(251, 191, 36, 0.25)");
    expect(theme.accentAlpha90).toBe("rgba(251, 191, 36, 0.9)");
  });

  it("keeps the ink and canvas palette as the single source of truth", () => {
    expect(theme.ink).toBe("#FFF7ED");
    expect(theme.canvas).toBe("#070A12");
    expect(theme.inkOnAccent).toBe("#111827");
  });

  it("is fully readonly — values cannot be mutated at runtime", () => {
    // @ts-expect-error - the const assertion prevents this at compile time,
    // but we double-check at runtime.
    expect(() => { theme.accent = "#000000"; }).toThrow();
  });
});
