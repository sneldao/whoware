import { describe, expect, test } from "vitest";
import { seedCatalogData } from "./figures";
import { pickRole } from "./figureVoice";

/**
 * The seed catalog's tags drive the v0.3/v0.4 voice engine via `pickRole`.
 * Six figures were tagged in prose vocabulary ("wartime", "prime minister")
 * that appears nowhere in the engine's taxonomy, so all six silently fell
 * through to the `commoner` voice — including Winston Churchill, who is
 * quoted as a nobody in the Witness Chamber.
 *
 * This test is the contract between the two files.
 */
describe("seed catalog tags map to a real voice role", () => {
  test("no figure falls through to commoner", () => {
    const strays = seedCatalogData
      .filter((f) => pickRole(f.tags) === "commoner")
      .map((f) => f.canonicalName);
    expect(strays).toEqual([]);
  });

  test("well-known figures get the right role", () => {
    const roleOf = (name: string) => {
      const f = seedCatalogData.find((x) => x.canonicalName === name);
      expect(f, `missing from seed catalog: ${name}`).toBeDefined();
      return pickRole(f!.tags);
    };
    expect(roleOf("Winston Churchill")).toBe("ruler");
    expect(roleOf("Mahatma Gandhi")).toBe("religious");
    expect(roleOf("Harriet Tubman")).toBe("warrior");
    expect(roleOf("Ibn Battuta")).toBe("explorer");
    expect(roleOf("Simón Bolívar")).toBe("ruler");
    expect(roleOf("Grace Hopper")).toBe("scholar");
  });
});
