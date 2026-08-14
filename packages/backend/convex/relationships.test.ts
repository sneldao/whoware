import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

function setup() {
  return convexTest(schema, modules);
}

async function seedEpisode(t: ReturnType<typeof setup>, status: "live" | "closed" = "closed") {
  await t.mutation(api.figures.seedCatalog, {});
  const churchill = await t.query(api.figures.search, { query: "Churchill" }).then((r) => r[0]);
  return await t.run(async (ctx) => {
    return await ctx.db.insert("episodes", {
      slug: "rel-churchill",
      figureId: churchill._id,
      figureName: churchill.canonicalName,
      activeAt: Date.now() - (status === "closed" ? 86_400_000 : 0),
      dropsAt: Date.now() - (status === "closed" ? 86_400_000 : 0),
      status,
      difficulty: "iconic",
      scenes: [
        {
          title: "Room",
          location: "London",
          era: "1940s",
          palette: ["#000"],
          panoramaPrompt: "room",
          ambientText: "Quiet.",
          clues: [{ label: "Clue", detail: "Detail", x: 50, y: 50 }],
          isMercy: false,
        },
      ],
    });
  });
}

describe("figure relationships", () => {
  test("getFigureRelationships returns related figures for a closed episode", async () => {
    const t = setup();
    const episodeId = await seedEpisode(t);

    const relationships = await t.query(api.figures.getFigureRelationships, { episodeId });

    expect(relationships).not.toBeNull();
    expect(relationships!.length).toBeGreaterThan(0);

    // Churchill should be related to Alan Turing, Mahatma Gandhi, Napoleon
    const names = relationships!.map((r) => r.canonicalName);
    expect(names).toContain("Alan Turing");
    expect(names).toContain("Mahatma Gandhi");
    expect(names).toContain("Napoleon Bonaparte");
  });

  test("getFigureRelationships includes era and region for each related figure", async () => {
    const t = setup();
    const episodeId = await seedEpisode(t);

    const relationships = await t.query(api.figures.getFigureRelationships, { episodeId });

    expect(relationships).not.toBeNull();
    for (const rf of relationships!) {
      expect(typeof rf.era).toBe("string");
      expect(rf.era.length).toBeGreaterThan(0);
      expect(typeof rf.region).toBe("string");
      expect(rf.region.length).toBeGreaterThan(0);
      expect(typeof rf.tier).toBe("string");
      expect(Array.isArray(rf.tags)).toBe(true);
    }
  });

  test("getFigureRelationships marks featured figures as hasBeenFeatured", async () => {
    const t = setup();
    const episodeId = await seedEpisode(t);

    // Create a second episode featuring Alan Turing (a related figure)
    const turing = await t.query(api.figures.search, { query: "Turing" }).then((r) => r[0]);
    await t.run(async (ctx) => {
      await ctx.db.insert("episodes", {
        slug: "rel-turing",
        figureId: turing._id,
        figureName: turing.canonicalName,
        activeAt: Date.now() - 86_400_000,
        dropsAt: Date.now() - 86_400_000,
        status: "closed",
        difficulty: "iconic",
        scenes: [
          {
            title: "Bletchley",
            location: "Bletchley Park",
            era: "1940s",
            palette: ["#000"],
            panoramaPrompt: "room",
            ambientText: "Typewriters.",
            clues: [{ label: "Enigma", detail: "A machine.", x: 50, y: 50 }],
            isMercy: false,
          },
        ],
      });
    });

    const relationships = await t.query(api.figures.getFigureRelationships, { episodeId });
    expect(relationships).not.toBeNull();

    const turingEntry = relationships!.find((r) => r.canonicalName === "Alan Turing");
    expect(turingEntry).toBeDefined();
    expect(turingEntry!.hasBeenFeatured).toBe(true);

    // Gandhi has not been featured
    const gandhiEntry = relationships!.find((r) => r.canonicalName === "Mahatma Gandhi");
    expect(gandhiEntry).toBeDefined();
    expect(gandhiEntry!.hasBeenFeatured).toBe(false);
  });

  test("getFigureRelationships returns null for episode without figureId", async () => {
    const t = setup();
    await t.mutation(api.figures.seedCatalog, {});
    const episodeId = await t.run(async (ctx) => {
      return await ctx.db.insert("episodes", {
        slug: "no-figure",
        activeAt: Date.now(),
        dropsAt: Date.now(),
        status: "live",
        difficulty: "iconic",
        scenes: [
          {
            title: "Room",
            location: "Nowhere",
            era: "Unknown",
            palette: ["#000"],
            panoramaPrompt: "room",
            ambientText: "Empty.",
            clues: [{ label: "Clue", detail: "Detail", x: 50, y: 50 }],
            isMercy: false,
          },
        ],
      });
    });

    const relationships = await t.query(api.figures.getFigureRelationships, { episodeId });
    expect(relationships).toBeNull();
  });

  test("answer-leak guard: a live episode without a resolved run returns null", async () => {
    const t = setup();
    const episodeId = await seedEpisode(t, "live");

    const relationships = await t.query(api.figures.getFigureRelationships, { episodeId });
    expect(relationships).toBeNull();
  });

  test("answer-leak guard: a live episode serves the network once the caller's run is resolved", async () => {
    const t = setup();
    const episodeId = await seedEpisode(t, "live");

    await t.run(async (ctx) => {
      await ctx.db.insert("playerRuns", {
        episodeId,
        identityId: "player-solved",
        playerName: "Solve",
        status: "solved",
        startedAt: Date.now(),
        solvedAt: Date.now(),
        currentSceneIndex: 0,
        memoriesViewed: 1,
        hotspotsOpened: 0,
        hintsUsed: 0,
        guessesUsed: 1,
      });
    });

    // With a resolved run…
    const revealed = await t.query(api.figures.getFigureRelationships, {
      episodeId,
      identityId: "player-solved",
    });
    expect(revealed).not.toBeNull();

    // …but not with a stranger's identity.
    const hidden = await t.query(api.figures.getFigureRelationships, {
      episodeId,
      identityId: "someone-else",
    });
    expect(hidden).toBeNull();
  });

  test("seedCatalog persists relatedFigures", async () => {
    const t = setup();
    await t.mutation(api.figures.seedCatalog, {});
    const churchill = await t.query(api.figures.search, { query: "Churchill" }).then((r) => r[0]);
    expect(churchill.relatedFigures).toBeDefined();
    expect(churchill.relatedFigures!.length).toBeGreaterThan(0);
    expect(churchill.relatedFigures).toContain("Alan Turing");
  });
});
