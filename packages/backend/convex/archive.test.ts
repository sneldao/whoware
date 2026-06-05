import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

function setup() {
  return convexTest(schema, modules);
}

async function seedFigure(t: ReturnType<typeof setup>) {
  return await t.run(async (ctx) => {
    const figureId = await ctx.db.insert("figures", {
      canonicalName: "Winston Churchill",
      aliases: ["Churchill"],
      era: "1940s",
      region: "Europe",
      tier: "iconic",
      difficulty: "iconic",
      tags: ["war", "politics"],
      searchIndex: "winston churchill",
    });
    return figureId;
  });
}

async function insertEpisode(
  t: ReturnType<typeof setup>,
  opts: {
    slug: string;
    figureId: Id<"figures">;
    status: "staging" | "review" | "draft" | "live" | "closed";
    dropsAt?: number;
  },
): Promise<Id<"episodes">> {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("episodes", {
      slug: opts.slug,
      figureId: opts.figureId,
      figureName: "Winston Churchill",
      activeAt: opts.dropsAt ?? Date.now() - 86_400_000,
      dropsAt: opts.dropsAt ?? Date.now() - 86_400_000,
      closesAt: opts.status === "closed" ? Date.now() - 3600_000 : undefined,
      status: opts.status,
      difficulty: "iconic",
      scenes: [
        {
          title: "A room",
          location: "Room",
          era: "1940s",
          palette: ["#000"],
          panoramaPrompt: "p",
          ambientText: "a",
          clues: [{ label: "c", detail: "d", x: 1, y: 1 }],
          isMercy: false,
        },
      ],
    });
  });
}

describe("archive.listClosed", () => {
  test("returns only closed episodes", async () => {
    const t = setup();
    const figureId = await seedFigure(t);
    await insertEpisode(t, { slug: "live", figureId, status: "live" });
    await insertEpisode(t, { slug: "closed-1", figureId, status: "closed" });
    await insertEpisode(t, { slug: "closed-2", figureId, status: "closed" });
    await insertEpisode(t, { slug: "draft", figureId, status: "draft" });

    const list = await t.query(api.archive.listClosed, {});
    expect(list).toHaveLength(2);
    expect(list.map((e) => e.slug).sort()).toEqual(["closed-1", "closed-2"]);
  });

  test("returns empty array when nothing is closed", async () => {
    const t = setup();
    const list = await t.query(api.archive.listClosed, {});
    expect(list).toEqual([]);
  });
});

describe("archive.getEpisode", () => {
  test("returns episode with figure profile when closed", async () => {
    const t = setup();
    const figureId = await seedFigure(t);
    const episodeId = await insertEpisode(t, { slug: "closed", figureId, status: "closed" });

    const episode = await t.query(api.archive.getEpisode, { episodeId });
    expect(episode).not.toBeNull();
    expect(episode?.slug).toBe("closed");
    expect(episode?.figure.canonicalName).toBe("Winston Churchill");
    expect(episode?.figure.era).toBe("1940s");
    expect(episode?.figure.region).toBe("Europe");
    expect(episode?.scenes).toHaveLength(1);
  });

  test("returns null for live episodes", async () => {
    const t = setup();
    const figureId = await seedFigure(t);
    const episodeId = await insertEpisode(t, { slug: "live", figureId, status: "live" });

    const episode = await t.query(api.archive.getEpisode, { episodeId });
    expect(episode).toBeNull();
  });

  test("returns null for unknown id", async () => {
    const t = setup();
    const figureId = await seedFigure(t);
    const someEpisode = await insertEpisode(t, { slug: "seed", figureId, status: "closed" });
    const episode = await t.query(api.archive.getEpisode, { episodeId: someEpisode });
    expect(episode).not.toBeNull();
  });
});

describe("archive.getLeaderboard", () => {
  test("returns ranked correct guesses for closed episode", async () => {
    const t = setup();
    const figureId = await seedFigure(t);
    const episodeId = await insertEpisode(t, { slug: "closed", figureId, status: "closed" });

    await t.run(async (ctx) => {
      await ctx.db.insert("guesses", {
        episodeId,
        playerName: "alice",
        guess: "Winston Churchill",
        isCorrect: true,
        scenesRevealed: 2,
        guessesUsed: 1,
        elapsedMs: 30_000,
        score: 8000,
        guessedAt: Date.now(),
      });
      await ctx.db.insert("guesses", {
        episodeId,
        playerName: "bob",
        guess: "Winston Churchill",
        isCorrect: true,
        scenesRevealed: 4,
        guessesUsed: 3,
        elapsedMs: 60_000,
        score: 5000,
        guessedAt: Date.now(),
      });
      await ctx.db.insert("guesses", {
        episodeId,
        playerName: "carol",
        guess: "wrong",
        isCorrect: false,
        scenesRevealed: 5,
        guessedAt: Date.now(),
      });
    });

    const leaderboard = await t.query(api.archive.getLeaderboard, { episodeId });
    expect(leaderboard.rankedCount).toBe(2);
    expect(leaderboard.entries[0].playerName).toBe("alice");
    expect(leaderboard.entries[1].playerName).toBe("bob");
  });

  test("returns empty leaderboard for live episodes", async () => {
    const t = setup();
    const figureId = await seedFigure(t);
    const episodeId = await insertEpisode(t, { slug: "live", figureId, status: "live" });
    const leaderboard = await t.query(api.archive.getLeaderboard, { episodeId });
    expect(leaderboard.entries).toEqual([]);
    expect(leaderboard.rankedCount).toBe(0);
  });
});

describe("archive.getRun", () => {
  test("returns the player's historical run on a closed episode", async () => {
    const t = setup();
    const figureId = await seedFigure(t);
    const episodeId = await insertEpisode(t, { slug: "closed", figureId, status: "closed" });

    await t.run(async (ctx) => {
      await ctx.db.insert("playerRuns", {
        episodeId,
        identityId: "player-1",
        playerName: "Alice",
        status: "solved",
        startedAt: Date.now() - 60_000,
        solvedAt: Date.now() - 30_000,
        currentSceneIndex: 0,
        memoriesViewed: 3,
        hotspotsOpened: 2,
        guessesUsed: 1,
        score: 7500,
      });
    });

    const run = await t.query(api.archive.getRun, { episodeId, identityId: "player-1" });
    expect(run).not.toBeNull();
    expect(run?.status).toBe("solved");
    expect(run?.score).toBe(7500);
  });

  test("returns null when player did not play", async () => {
    const t = setup();
    const figureId = await seedFigure(t);
    const episodeId = await insertEpisode(t, { slug: "closed", figureId, status: "closed" });
    const run = await t.query(api.archive.getRun, { episodeId, identityId: "nobody" });
    expect(run).toBeNull();
  });

  test("returns null for live episodes", async () => {
    const t = setup();
    const figureId = await seedFigure(t);
    const episodeId = await insertEpisode(t, { slug: "live", figureId, status: "live" });
    const run = await t.query(api.archive.getRun, { episodeId, identityId: "player-1" });
    expect(run).toBeNull();
  });
});
