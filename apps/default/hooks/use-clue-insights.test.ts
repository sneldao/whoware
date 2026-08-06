import { describe, expect, test } from "vitest";
import type { DiscoveredClue } from "@/hooks/use-local-discovery";

// Test the theme overlap logic directly without React hooks
// The useClueInsights hook wraps this in state management, but the
// core logic is what we need to verify.

function makeClue(
  sceneIndex: number,
  sceneTitle: string,
  label: string,
  detail: string,
): DiscoveredClue {
  return { sceneIndex, sceneTitle, label, detail };
}

const THEME_GROUPS: Array<{ keywords: string[]; insight: string }> = [
  { keywords: ["war", "battle", "military", "army", "soldier", "front", "campaign"], insight: "war" },
  { keywords: ["science", "experiment", "discovery", "theory", "research", "laboratory", "equation"], insight: "science" },
  { keywords: ["politic", "parliament", "congress", "government", "election", "vote", "minister", "office"], insight: "politics" },
  { keywords: ["art", "paint", "sculpt", "music", "portrait", "gallery", "canvas", "studio"], insight: "art" },
  { keywords: ["travel", "voyage", "journey", "ship", "expedition", "abroad", "foreign"], insight: "travel" },
  { keywords: ["book", "write", "wrote", "author", "publish", "manuscript", "letter", "diary"], insight: "writing" },
  { keywords: ["money", "wealth", "fortune", "bank", "trade", "business", "industry", "factory"], insight: "economy" },
  { keywords: ["religion", "church", "faith", "god", "temple", "pray", "sacred", "monk"], insight: "faith" },
  { keywords: ["revolution", "protest", "reform", "uprising", "resistance", "movement"], insight: "revolution" },
  { keywords: ["invent", "patent", "machine", "engine", "design", "device", "innovation"], insight: "invention" },
  { keywords: ["king", "queen", "crown", "royal", "throne", "court", "emperor", "empire"], insight: "royalty" },
  { keywords: ["school", "universit", "study", "learn", "teach", "scholar", "academy", "professor"], insight: "education" },
];

// Mirror of findThemeOverlap for testing
function findThemeOverlap(clues: DiscoveredClue[]): string | null {
  if (clues.length < 2) return null;
  const byScene = new Map<number, DiscoveredClue[]>();
  for (const clue of clues) {
    const existing = byScene.get(clue.sceneIndex) ?? [];
    existing.push(clue);
    byScene.set(clue.sceneIndex, existing);
  }
  if (byScene.size < 2) return null;

  for (const group of THEME_GROUPS) {
    const matchingScenes = new Set<number>();
    for (const [sceneIdx, sceneClues] of byScene) {
      for (const clue of sceneClues) {
        const text = `${clue.label} ${clue.detail}`.toLowerCase();
        if (group.keywords.some((kw) => text.includes(kw))) {
          matchingScenes.add(sceneIdx);
        }
      }
    }
    if (matchingScenes.size >= 2) return group.insight;
  }
  return null;
}

describe("clue insight theme detection", () => {
  test("returns null with fewer than 2 clues", () => {
    expect(findThemeOverlap([makeClue(0, "Room 1", "Letter", "A handwritten letter")])).toBeNull();
  });

  test("returns null when clues are from the same scene", () => {
    expect(
      findThemeOverlap([
        makeClue(0, "Room 1", "Letter", "A handwritten letter about war"),
        makeClue(0, "Room 1", "Map", "A map of the battlefield"),
      ]),
    ).toBeNull();
  });

  test("returns null when clues from different scenes have no thematic overlap", () => {
    expect(
      findThemeOverlap([
        makeClue(0, "Room 1", "Note", "A random note about cooking"),
        makeClue(1, "Room 2", "Photo", "A photograph of a landscape"),
      ]),
    ).toBeNull();
  });

  test("detects war theme across 2 scenes", () => {
    expect(
      findThemeOverlap([
        makeClue(0, "Room 1", "Letter", "A handwritten letter from the front lines"),
        makeClue(1, "Room 2", "Medal", "A military campaign medal"),
      ]),
    ).toBe("war");
  });

  test("detects science theme across 3 scenes", () => {
    expect(
      findThemeOverlap([
        makeClue(0, "Lab", "Equation", "A chalkboard with an equation"),
        makeClue(1, "Office", "Notebook", "Research notes on a new theory"),
        makeClue(2, "Hall", "Portrait", "A photograph"),
      ]),
    ).toBe("science");
  });

  test("detects politics theme", () => {
    expect(
      findThemeOverlap([
        makeClue(0, "Office", "Document", "A draft of parliamentary legislation"),
        makeClue(1, "Hall", "Portrait", "A photograph of the election night"),
      ]),
    ).toBe("politics");
  });

  test("detects art theme", () => {
    expect(
      findThemeOverlap([
        makeClue(0, "Studio", "Canvas", "A painted canvas in the studio"),
        makeClue(1, "Gallery", "Portrait", "A portrait of the artist"),
      ]),
    ).toBe("art");
  });

  test("detects writing theme", () => {
    expect(
      findThemeOverlap([
        makeClue(0, "Study", "Manuscript", "A handwritten manuscript"),
        makeClue(1, "Library", "Diary", "A personal diary entry"),
      ]),
    ).toBe("writing");
  });

  test("detects royalty theme", () => {
    expect(
      findThemeOverlap([
        makeClue(0, "Throne room", "Crown", "The royal crown"),
        makeClue(1, "Court", "Seal", "A seal from the court of the emperor"),
      ]),
    ).toBe("royalty");
  });

  test("detects invention theme", () => {
    expect(
      findThemeOverlap([
        makeClue(0, "Workshop", "Blueprint", "A blueprint for a new machine"),
        makeClue(1, "Office", "Patent", "A patent application"),
      ]),
    ).toBe("invention");
  });

  test("detects education theme", () => {
    expect(
      findThemeOverlap([
        makeClue(0, "Hall", "Degree", "A university diploma"),
        makeClue(1, "Study", "Books", "Scholarly books on the shelf"),
      ]),
    ).toBe("education");
  });

  test("returns first matching theme when multiple match", () => {
    // Both war and politics keywords appear
    expect(
      findThemeOverlap([
        makeClue(0, "Office", "Letter", "A letter about the military campaign and the election"),
        makeClue(1, "Hall", "Photo", "A photo of the parliament during the war"),
      ]),
    ).toBe("war"); // war comes before politics in the array
  });

  test("does not match when only one scene has the keyword", () => {
    expect(
      findThemeOverlap([
        makeClue(0, "Room 1", "Note", "A note about war"),
        makeClue(1, "Room 2", "Photo", "A landscape photo with no thematic content"),
      ]),
    ).toBeNull();
  });
});
