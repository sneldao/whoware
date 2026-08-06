import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

function setup() {
  return convexTest(schema, modules);
}

async function seedFigure(t: ReturnType<typeof setup>) {
  await t.mutation(api.figures.seedCatalog, {});
  const figures = await t.query(api.figures.search, { query: "Churchill" });
  const churchill = figures.find((f) => f.canonicalName === "Winston Churchill");
  if (!churchill) throw new Error("Churchill figure missing after seed");
  return churchill;
}

async function seedClosedEpisode(t: ReturnType<typeof setup>) {
  const churchill = await seedFigure(t);
  return await t.run(async (ctx) => {
    return await ctx.db.insert("episodes", {
      slug: "closed-churchill",
      figureId: churchill._id,
      figureName: churchill.canonicalName,
      activeAt: Date.now() - 86_400_000,
      dropsAt: Date.now() - 86_400_000,
      closesAt: Date.now() - 3_600_000,
      status: "closed",
      difficulty: "iconic",
      scenes: [
        {
          title: "A quiet room",
          location: "Bedroom",
          era: "1940s",
          palette: ["#1E293B"],
          panoramaPrompt: "bedroom",
          ambientText: "Silence.",
          clues: [{ label: "Note", detail: "A note.", x: 50, y: 50 }],
          isMercy: false,
        },
      ],
    });
  });
}

describe("practice mode", () => {
  test("startPracticeRun creates a run for a closed episode", async () => {
    const t = setup();
    const episodeId = await seedClosedEpisode(t);

    const run = await t.mutation(api.practice.startPracticeRun, {
      episodeId,
      identityId: "practice-player",
    });

    expect(run.status).toBe("active");
    expect(run.memoriesViewed).toBe(0);
    expect(run.guessesUsed).toBe(0);
  });

  test("startPracticeRun is idempotent — reuses active run", async () => {
    const t = setup();
    const episodeId = await seedClosedEpisode(t);

    const first = await t.mutation(api.practice.startPracticeRun, {
      episodeId,
      identityId: "practice-player",
    });
    const second = await t.mutation(api.practice.startPracticeRun, {
      episodeId,
      identityId: "practice-player",
    });

    expect(first._id).toBe(second._id);
  });

  test("startPracticeRun rejects live (non-closed) episodes", async () => {
    const t = setup();
    const churchill = await seedFigure(t);
    const episodeId = await t.run(async (ctx) => {
      return await ctx.db.insert("episodes", {
        slug: "live-ep",
        figureId: churchill._id,
        figureName: churchill.canonicalName,
        activeAt: Date.now(),
        dropsAt: Date.now(),
        status: "live",
        difficulty: "iconic",
        scenes: [
          {
            title: "Scene",
            location: "Room",
            era: "1940s",
            palette: ["#000"],
            panoramaPrompt: "room",
            ambientText: "Test",
            clues: [{ label: "Clue", detail: "Detail", x: 50, y: 50 }],
            isMercy: false,
          },
        ],
      });
    });

    await expect(
      t.mutation(api.practice.startPracticeRun, { episodeId, identityId: "player" }),
    ).rejects.toThrow(/closed/);
  });

  test("practiceSubmitGuess solves on correct figure", async () => {
    const t = setup();
    const episodeId = await seedClosedEpisode(t);
    const churchill = await t.query(api.figures.search, { query: "Churchill" }).then((r) => r[0]);

    const run = await t.mutation(api.practice.startPracticeRun, {
      episodeId,
      identityId: "practice-player",
    });

    const result = await t.mutation(api.practice.practiceSubmitGuess, {
      runId: run._id,
      figureId: churchill._id,
    });

    expect(result.isCorrect).toBe(true);
    expect(result.status).toBe("solved");
    expect(result.answer).toBe("Winston Churchill");
  });

  test("practiceSubmitGuess allows unlimited wrong guesses", async () => {
    const t = setup();
    const episodeId = await seedClosedEpisode(t);
    const ada = await t.query(api.figures.search, { query: "Ada" }).then((r) => r[0]);

    const run = await t.mutation(api.practice.startPracticeRun, {
      episodeId,
      identityId: "practice-player",
    });

    // Make 10 wrong guesses — should still be active
    for (let i = 0; i < 10; i++) {
      const result = await t.mutation(api.practice.practiceSubmitGuess, {
        runId: run._id,
        figureId: ada._id,
      });
      expect(result.isCorrect).toBe(false);
      expect(result.status).toBe("active");
    }
  });

  test("practiceSubmitGuess does not record a score or streak", async () => {
    const t = setup();
    const episodeId = await seedClosedEpisode(t);
    const churchill = await t.query(api.figures.search, { query: "Churchill" }).then((r) => r[0]);

    const run = await t.mutation(api.practice.startPracticeRun, {
      episodeId,
      identityId: "practice-player",
    });

    await t.mutation(api.practice.practiceSubmitGuess, {
      runId: run._id,
      figureId: churchill._id,
    });

    // Verify no guess record was created in the guesses table
    const guesses = await t.run(async (ctx) => {
      return await ctx.db.query("guesses").collect();
    });
    expect(guesses).toHaveLength(0);

    // Verify no playerRun was created
    const playerRuns = await t.run(async (ctx) => {
      return await ctx.db.query("playerRuns").collect();
    });
    expect(playerRuns).toHaveLength(0);
  });

  test("practiceEnterScene updates scene index and memories viewed", async () => {
    const t = setup();
    const episodeId = await seedClosedEpisode(t);

    const run = await t.mutation(api.practice.startPracticeRun, {
      episodeId,
      identityId: "practice-player",
    });

    const result = await t.mutation(api.practice.practiceEnterScene, {
      runId: run._id,
      sceneIndex: 0,
    });

    expect(result.memoriesViewed).toBeGreaterThanOrEqual(1);
  });
});
