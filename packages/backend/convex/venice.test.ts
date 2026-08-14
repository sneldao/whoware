import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

function setup() {
  return convexTest(schema, modules);
}

async function seedChurchillFigure(t: ReturnType<typeof setup>): Promise<Id<"figures">> {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("figures", {
      canonicalName: "Winston Churchill",
      aliases: ["Churchill", "Winnie"],
      era: "1940s",
      region: "Europe",
      tier: "iconic",
      difficulty: "iconic",
      tags: ["war", "politics"],
      searchIndex: "winston churchill",
    });
  });
}

async function seedEpisode(
  t: ReturnType<typeof setup>,
  figureId: Id<"figures">,
): Promise<Id<"episodes">> {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("episodes", {
      slug: "test-episode",
      figureId,
      figureName: "Winston Churchill",
      activeAt: Date.now(),
      dropsAt: Date.now(),
      status: "live",
      difficulty: "iconic",
      scenes: [],
    });
  });
}

describe("venice.getEpisodeFigure", () => {
  test("returns figure metadata without canonicalName or aliases", async () => {
    const t = setup();
    const figureId = await seedChurchillFigure(t);
    const episodeId = await seedEpisode(t, figureId);

    const figure = await t.query(api.venice.getEpisodeFigure, { episodeId });
    expect(figure).not.toBeNull();
    expect(figure?.era).toBe("1940s");
    expect(figure?.region).toBe("Europe");
    expect(figure?.tags).toContain("war");
    const raw = figure as Record<string, unknown>;
    expect("canonicalName" in raw).toBe(false);
    expect("aliases" in raw).toBe(false);
  });

  test("returns null for episode without figureId", async () => {
    const t = setup();
    const episodeId = await t.run(async (ctx) => {
      return await ctx.db.insert("episodes", {
        slug: "no-figure",
        activeAt: Date.now(),
        dropsAt: Date.now(),
        status: "live",
        difficulty: "iconic",
        scenes: [],
      });
    });

    const figure = await t.query(api.venice.getEpisodeFigure, { episodeId });
    expect(figure).toBeNull();
  });
});

describe("venice.getFigureBio", () => {
  async function seedCachedBio(t: ReturnType<typeof setup>, episodeId: Id<"episodes">) {
    await t.run(async (ctx) => {
      await ctx.db.insert("veniceHints", {
        cacheKey: `bio:${episodeId}`,
        hint: JSON.stringify({
          summary: "He led Britain through the Second World War.",
          whatTheyChanged: "Rhetoric as a weapon of state.",
          whyThisRoom: "The room remembers the man.",
          didYouKnow: "He also painted.",
        }),
        cachedAt: Date.now(),
      });
    });
  }

  test("answer-leak guard: closed episode serves the cached bio", async () => {
    const t = setup();
    const figureId = await seedChurchillFigure(t);
    const episodeId = await t.run(async (ctx) => {
      return await ctx.db.insert("episodes", {
        slug: "bio-closed",
        figureId,
        figureName: "Winston Churchill",
        activeAt: Date.now() - 86_400_000,
        dropsAt: Date.now() - 86_400_000,
        status: "closed",
        difficulty: "iconic",
        scenes: [],
      });
    });
    await seedCachedBio(t, episodeId);

    const bio = await t.query(api.venice.getFigureBio, { episodeId });
    expect(bio?.summary).toContain("Second World War");
  });

  test("answer-leak guard: live episode without a resolved run returns null", async () => {
    const t = setup();
    const figureId = await seedChurchillFigure(t);
    const episodeId = await seedEpisode(t, figureId);
    await seedCachedBio(t, episodeId);

    const bio = await t.query(api.venice.getFigureBio, { episodeId });
    expect(bio).toBeNull();
  });

  test("answer-leak guard: live episode serves the bio to the caller whose run is resolved", async () => {
    const t = setup();
    const figureId = await seedChurchillFigure(t);
    const episodeId = await seedEpisode(t, figureId);
    await seedCachedBio(t, episodeId);

    await t.run(async (ctx) => {
      await ctx.db.insert("playerRuns", {
        episodeId,
        identityId: "player-exhausted",
        playerName: "Exh",
        status: "exhausted",
        startedAt: Date.now(),
        completedAt: Date.now(),
        currentSceneIndex: 0,
        memoriesViewed: 2,
        hotspotsOpened: 0,
        hintsUsed: 0,
        guessesUsed: 5,
      });
    });

    const bio = await t.query(api.venice.getFigureBio, {
      episodeId,
      identityId: "player-exhausted",
    });
    expect(bio?.summary).toContain("Second World War");

    // A stranger's identity still gets nothing.
    const hidden = await t.query(api.venice.getFigureBio, {
      episodeId,
      identityId: "someone-else",
    });
    expect(hidden).toBeNull();
  });
});

describe("venice.generateIdentityHint", () => {
  test("cached identity hint is served without re-calling Venice", async () => {
    const t = setup();
    const figureId = await seedChurchillFigure(t);
    const episodeId = await seedEpisode(t, figureId);

    await t.run(async (ctx) => {
      await ctx.db.insert("veniceHints", {
        cacheKey: `identity:${episodeId}`,
        hint: "A rumble of rhetoric over the Channel.",
        cachedAt: Date.now(),
      });
    });

    const cached = await t.query(api.venice.getIdentityHint, { episodeId });
    expect(cached).toBe("A rumble of rhetoric over the Channel.");
  });

  test("answer-leak guard: getEpisodeFigure never returns canonicalName", async () => {
    const t = setup();
    const figureId = await seedChurchillFigure(t);
    const episodeId = await seedEpisode(t, figureId);

    const figure = await t.query(api.venice.getEpisodeFigure, { episodeId });
    expect(figure).not.toBeNull();
    expect(JSON.stringify(figure)).not.toContain("Winston Churchill");
    expect("canonicalName" in (figure as Record<string, unknown>)).toBe(false);
  });
});

describe("venice.getIdentityHint", () => {
  test("returns cached hint when present and fresh", async () => {
    const t = setup();
    const figureId = await seedChurchillFigure(t);
    const episodeId = await seedEpisode(t, figureId);

    await t.run(async (ctx) => {
      await ctx.db.insert("veniceHints", {
        cacheKey: `identity:${episodeId}`,
        hint: "A rumble of rhetoric over the Channel.",
        cachedAt: Date.now(),
      });
    });

    const cached = await t.query(api.venice.getIdentityHint, { episodeId });
    expect(cached).toBe("A rumble of rhetoric over the Channel.");
  });

  test("returns null for expired cache", async () => {
    const t = setup();
    const figureId = await seedChurchillFigure(t);
    const episodeId = await seedEpisode(t, figureId);

    await t.run(async (ctx) => {
      await ctx.db.insert("veniceHints", {
        cacheKey: `identity:${episodeId}`,
        hint: "old hint",
        cachedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
      });
    });

    const cached = await t.query(api.venice.getIdentityHint, { episodeId });
    expect(cached).toBeNull();
  });
});
