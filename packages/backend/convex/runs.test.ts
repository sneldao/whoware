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

async function seedEpisode(t: ReturnType<typeof setup>) {
  const churchill = await seedFigure(t);
  return await t.run(async (ctx) => {
    return await ctx.db.insert("episodes", {
      slug: "demo-churchill",
      figureId: churchill._id,
      figureName: churchill.canonicalName,
      activeAt: Date.now(),
      dropsAt: Date.now(),
      status: "live",
      difficulty: "iconic",
      scenes: [
        {
          title: "A quiet room before the world notices",
          location: "Upstairs bedroom",
          era: "Early 1940s",
          palette: ["#1E293B", "#7C2D12", "#F8E7C9"],
          panoramaPrompt: "wartime bedroom",
          imageKey: "bedroom",
          imageAspectRatio: "16:9",
          ambientText: "A wireless set murmurs beneath blackout curtains.",
          clues: [
            { label: "Blackout notice", detail: "A London civil-defense placard.", x: 18, y: 34 },
            { label: "Half-written page", detail: "The draft repeats 'we shall'.", x: 68, y: 42 },
            { label: "Tiny bulldog", detail: "A porcelain bulldog beside dispatches.", x: 45, y: 69 },
          ],
          isMercy: false,
        },
        {
          title: "The underground workplace",
          location: "Cabinet rooms below the street",
          era: "Second World War",
          palette: ["#111827", "#92400E", "#FDE68A"],
          panoramaPrompt: "underground war rooms",
          imageKey: "warRooms",
          imageAspectRatio: "16:9",
          ambientText: "Telephones ring in a low ceilinged room.",
          clues: [
            { label: "Map pins", detail: "Convoy routes converge on Britain.", x: 28, y: 46 },
            { label: "Telephone label", detail: "Switchboard tag reads 'Admiralty'.", x: 59, y: 38 },
            { label: "Hat and cane", detail: "A homburg hat beside a walking stick.", x: 74, y: 72 },
          ],
          isMercy: false,
        },
        {
          title: "A garden where the brush waits",
          location: "Country house garden",
          era: "1930s",
          palette: ["#064E3B", "#92400E", "#FDE68A"],
          panoramaPrompt: "country house garden",
          imageKey: "broadcast",
          imageAspectRatio: "16:9",
          ambientText: "An easel stands beside a koi pond.",
          clues: [
            { label: "Easel canvas", detail: "Half-finished oils.", x: 32, y: 48 },
            { label: "Brick wall", detail: "English bond bricks under ivy.", x: 64, y: 70 },
            { label: "Garden chair", detail: "A canvas deck chair.", x: 82, y: 55 },
          ],
          isMercy: true,
        },
      ],
    });
  });
}

describe("figures.catalog", () => {
  test("seedCatalog is idempotent", async () => {
    const t = setup();
    const first = await t.mutation(api.figures.seedCatalog, {});
    const second = await t.mutation(api.figures.seedCatalog, {});
    expect(first.upserted).toBeGreaterThan(0);
    expect(second.upserted).toBe(first.upserted);

    const churchillResults = await t.query(api.figures.search, { query: "Churchill" });
    expect(churchillResults).toHaveLength(1);
    expect(churchillResults[0].canonicalName).toBe("Winston Churchill");
  });

  test("search falls back to a bounded listing on empty query", async () => {
    const t = setup();
    await t.mutation(api.figures.seedCatalog, {});
    const all = await t.query(api.figures.search, { query: "", limit: 5 });
    expect(all.length).toBeLessThanOrEqual(5);
    expect(all.length).toBeGreaterThan(0);
  });
});

describe("runs lifecycle", () => {
  test("startRun creates a fresh run and is idempotent per (episode, identity)", async () => {
    const t = setup();
    const episodeId = await seedEpisode(t);
    const first = await t.mutation(api.runs.startRun, {
      episodeId,
      identityId: "player-a",
      playerName: "Alice",
    });
    const second = await t.mutation(api.runs.startRun, {
      episodeId,
      identityId: "player-a",
      playerName: "Alice",
    });
    expect(first._id).toBe(second._id);
    expect(first.status).toBe("active");
    expect(first.guessesUsed).toBe(0);
    expect(first.memoriesViewed).toBe(0);
    expect(first.hotspotsOpened).toBe(0);
  });

  test("enterScene increments memoriesViewed once per unique scene", async () => {
    const t = setup();
    const episodeId = await seedEpisode(t);
    const run = await t.mutation(api.runs.startRun, {
      episodeId,
      identityId: "player-b",
      playerName: "Bob",
    });

    const first = await t.mutation(api.runs.enterScene, { runId: run._id, sceneIndex: 0 });
    expect(first.memoriesViewed).toBe(1);

    const repeated = await t.mutation(api.runs.enterScene, { runId: run._id, sceneIndex: 0 });
    expect(repeated.memoriesViewed).toBe(1);

    const next = await t.mutation(api.runs.enterScene, { runId: run._id, sceneIndex: 1 });
    expect(next.memoriesViewed).toBe(2);
  });

  test("openHotspot increments hotspotsOpened once per unique (scene, label)", async () => {
    const t = setup();
    const episodeId = await seedEpisode(t);
    const run = await t.mutation(api.runs.startRun, {
      episodeId,
      identityId: "player-c",
      playerName: "Carol",
    });

    const first = await t.mutation(api.runs.openHotspot, {
      runId: run._id,
      sceneIndex: 0,
      hotspotLabel: "Blackout notice",
    });
    expect(first.hotspotsOpened).toBe(1);

    const repeated = await t.mutation(api.runs.openHotspot, {
      runId: run._id,
      sceneIndex: 0,
      hotspotLabel: "Blackout notice",
    });
    expect(repeated.hotspotsOpened).toBe(1);

    const differentLabel = await t.mutation(api.runs.openHotspot, {
      runId: run._id,
      sceneIndex: 0,
      hotspotLabel: "Tiny bulldog",
    });
    expect(differentLabel.hotspotsOpened).toBe(2);

    const differentScene = await t.mutation(api.runs.openHotspot, {
      runId: run._id,
      sceneIndex: 1,
      hotspotLabel: "Blackout notice",
    });
    expect(differentScene.hotspotsOpened).toBe(3);
  });

  test("submitGuess with correct figureId solves the run and computes a score", async () => {
    const t = setup();
    const episodeId = await seedEpisode(t);
    const churchill = await t.query(api.figures.search, { query: "Churchill" }).then((rows) => rows[0]);
    const run = await t.mutation(api.runs.startRun, {
      episodeId,
      identityId: "player-d",
      playerName: "Dan",
    });
    await t.mutation(api.runs.enterScene, { runId: run._id, sceneIndex: 0 });

    const result = await t.mutation(api.runs.submitGuess, {
      runId: run._id,
      figureId: churchill._id,
      playerName: "Dan",
    });

    expect(result.isCorrect).toBe(true);
    expect(result.answer).toBe("Winston Churchill");
    expect(result.status).toBe("solved");
    expect(typeof result.score).toBe("number");
    expect((result.score as number)).toBeGreaterThan(0);
    expect(result.guessesUsed).toBe(1);
    expect(result.guessesRemaining).toBe(4);

    const stored = await t.query(api.runs.getActiveRun, { episodeId, identityId: "player-d" });
    expect(stored?.status).toBe("solved");
    expect(stored?.score).toBe(result.score);
  });

  test("submitGuess rejects further guesses once the run is solved", async () => {
    const t = setup();
    const episodeId = await seedEpisode(t);
    const churchill = await t.query(api.figures.search, { query: "Churchill" }).then((rows) => rows[0]);
    const run = await t.mutation(api.runs.startRun, {
      episodeId,
      identityId: "player-e",
      playerName: "Eve",
    });
    await t.mutation(api.runs.enterScene, { runId: run._id, sceneIndex: 0 });
    await t.mutation(api.runs.submitGuess, { runId: run._id, figureId: churchill._id });

    await expect(
      t.mutation(api.runs.submitGuess, { runId: run._id, figureId: churchill._id }),
    ).rejects.toThrow(/resolved or exhausted/);
  });

  test("submitGuess exhausts the run after five wrong guesses and never reveals the answer", async () => {
    const t = setup();
    const episodeId = await seedEpisode(t);
    const ada = await t.query(api.figures.search, { query: "Ada" }).then((rows) => rows[0]);
    const run = await t.mutation(api.runs.startRun, {
      episodeId,
      identityId: "player-f",
      playerName: "Fay",
    });
    await t.mutation(api.runs.enterScene, { runId: run._id, sceneIndex: 0 });

    let lastResult: { status: string; guessesRemaining: number; answer?: string } | null = null;
    for (let i = 0; i < 5; i += 1) {
      lastResult = await t.mutation(api.runs.submitGuess, {
        runId: run._id,
        figureId: ada._id,
      });
    }

    expect(lastResult?.status).toBe("exhausted");
    expect(lastResult?.guessesRemaining).toBe(0);
    expect(lastResult?.answer).toBeUndefined();

    const stored = await t.query(api.runs.getActiveRun, { episodeId, identityId: "player-f" });
    expect(stored?.status).toBe("exhausted");
    expect(stored?.guessesUsed).toBe(5);
  });

  test("submitGuess enforces the five-guess cap even if the client tries to keep going", async () => {
    const t = setup();
    const episodeId = await seedEpisode(t);
    const ada = await t.query(api.figures.search, { query: "Ada" }).then((rows) => rows[0]);
    const run = await t.mutation(api.runs.startRun, {
      episodeId,
      identityId: "player-g",
      playerName: "Gia",
    });
    await t.mutation(api.runs.enterScene, { runId: run._id, sceneIndex: 0 });

    for (let i = 0; i < 5; i += 1) {
      await t.mutation(api.runs.submitGuess, { runId: run._id, figureId: ada._id });
    }

    await expect(
      t.mutation(api.runs.submitGuess, { runId: run._id, figureId: ada._id }),
    ).rejects.toThrow(/resolved or exhausted/);
  });
});

describe("public episode surface", () => {
  test("getActive does not leak the figure name or answer options", async () => {
    const t = setup();
    await seedEpisode(t);
    const episode = await t.query(api.episodes.getActive, {});
    expect(episode).not.toBeNull();
    expect((episode as Record<string, unknown>).figureName).toBeUndefined();
    expect((episode as Record<string, unknown>).answerOptions).toBeUndefined();
    expect((episode as Record<string, unknown>).figureId).toBeUndefined();
  });

  test("getActive returns at least one mercy-flagged scene on the Churchill demo", async () => {
    const t = setup();
    await seedEpisode(t);
    const episode = await t.query(api.episodes.getActive, {});
    expect(episode).not.toBeNull();
    const mercyCount = (episode!.scenes as Array<{ isMercy?: boolean }>).filter((scene) => scene.isMercy).length;
    expect(mercyCount).toBeGreaterThanOrEqual(1);
  });
});

describe("leaderboard", () => {
  test("player rank resolves by identityId when provided", async () => {
    const t = setup();
    const episodeId = await seedEpisode(t);
    const churchill = await t.query(api.figures.search, { query: "Churchill" }).then((rows) => rows[0]);

    const runA = await t.mutation(api.runs.startRun, {
      episodeId,
      identityId: "player-h",
      playerName: "Hana",
    });
    await t.mutation(api.runs.enterScene, { runId: runA._id, sceneIndex: 0 });
    await t.mutation(api.runs.submitGuess, {
      runId: runA._id,
      figureId: churchill._id,
      playerName: "Hana",
    });

    const leaderboard = await t.query(api.episodes.leaderboard, {
      episodeId,
      identityId: "player-h",
      playerName: "Hana",
    });

    expect(leaderboard.rankedCount).toBeGreaterThanOrEqual(1);
    expect(leaderboard.playerRank).not.toBeNull();
    expect(leaderboard.playerRank?.rank).toBe(1);
  });
});
