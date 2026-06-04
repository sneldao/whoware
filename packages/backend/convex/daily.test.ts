import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

function setup() {
  return convexTest(schema, modules);
}

async function seedChurchillEpisode(t: ReturnType<typeof setup>): Promise<Id<"episodes">> {
  await t.mutation(api.figures.seedCatalog, {});
  const { episodeId } = await t.mutation(api.episodes.ensureDemoEpisode, {});
  return episodeId;
}

async function insertDraftEpisode(
  t: ReturnType<typeof setup>,
  dropsAt: number,
  closesAt?: number,
): Promise<Id<"episodes">> {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("episodes", {
      slug: `test-draft-${dropsAt}`,
      activeAt: dropsAt,
      isActive: false,
      dropsAt,
      closesAt,
      status: "draft",
      difficulty: "iconic",
      scenes: [],
    });
  });
}

async function insertLiveEpisode(
  t: ReturnType<typeof setup>,
  dropsAt: number,
  closesAt?: number,
): Promise<Id<"episodes">> {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("episodes", {
      slug: `test-live-${dropsAt}`,
      activeAt: dropsAt,
      isActive: true,
      dropsAt,
      closesAt,
      status: "live",
      difficulty: "iconic",
      scenes: [],
    });
  });
}

describe("daily.getCurrentDrop", () => {
  test("returns the live demo episode", async () => {
    const t = setup();
    await seedChurchillEpisode(t);
    const drop = await t.query(api.daily.getCurrentDrop, {});
    expect(drop).not.toBeNull();
    expect(drop?.slug).toBe("demo-churchill");
    expect(drop?.status).toBe("live");
    expect(typeof drop?.dropsAt).toBe("number");
    expect(drop?.scenes.length).toBeGreaterThan(0);
  });

  test("returns null when no live episodes exist", async () => {
    const t = setup();
    await insertDraftEpisode(t, Date.now() + 86_400_000);
    const drop = await t.query(api.daily.getCurrentDrop, {});
    expect(drop).toBeNull();
  });
});

describe("daily.getNextDrop", () => {
  test("returns null when no episodes exist", async () => {
    const t = setup();
    const next = await t.query(api.daily.getNextDrop, {});
    expect(next).toBeNull();
  });

  test("returns closesAt for a live episode with a future close window", async () => {
    const t = setup();
    const futureClose = Date.now() + 86_400_000;
    await insertLiveEpisode(t, Date.now() - 60_000, futureClose);
    const next = await t.query(api.daily.getNextDrop, {});
    expect(next).not.toBeNull();
    expect(next?.closesAt).toBe(futureClose);
  });

  test("returns upcoming draft dropsAt", async () => {
    const t = setup();
    const futureDrop = Date.now() + 86_400_000;
    await insertDraftEpisode(t, futureDrop);
    const next = await t.query(api.daily.getNextDrop, {});
    expect(next).not.toBeNull();
    expect(next?.dropsAt).toBe(futureDrop);
  });
});

describe("daily.openExpired", () => {
  test("transitions a past-dropsAt draft to live", async () => {
    const t = setup();
    await insertDraftEpisode(t, Date.now() - 60_000);

    const result = await t.mutation(api.daily.openExpired, {});
    expect(result.opened).toBe(1);

    const drop = await t.query(api.daily.getCurrentDrop, {});
    expect(drop).not.toBeNull();
    expect(drop?.status).toBe("live");
  });

  test("does not transition future-dropsAt drafts", async () => {
    const t = setup();
    await insertDraftEpisode(t, Date.now() + 86_400_000);
    const result = await t.mutation(api.daily.openExpired, {});
    expect(result.opened).toBe(0);
  });
});

describe("daily.closeExpired", () => {
  test("transitions a live episode with past closesAt to closed", async () => {
    const t = setup();
    await insertLiveEpisode(t, Date.now() - 120_000, Date.now() - 60_000);

    const result = await t.mutation(api.daily.closeExpired, {});
    expect(result.closed).toBe(1);

    const drop = await t.query(api.daily.getCurrentDrop, {});
    expect(drop).toBeNull();
  });

  test("does not close a live episode whose closesAt is in the future", async () => {
    const t = setup();
    await insertLiveEpisode(t, Date.now() - 60_000, Date.now() + 86_400_000);
    const result = await t.mutation(api.daily.closeExpired, {});
    expect(result.closed).toBe(0);
  });

  test("does not close a live episode with no closesAt", async () => {
    const t = setup();
    await seedChurchillEpisode(t);
    const result = await t.mutation(api.daily.closeExpired, {});
    expect(result.closed).toBe(0);
  });
});

describe("daily.scheduleEpisode", () => {
  test("rejects dropsAt less than one minute in the future", async () => {
    const t = setup();
    const episodeId = await seedChurchillEpisode(t);
    await expect(
      t.mutation(api.daily.scheduleEpisode, {
        episodeId,
        dropsAt: Date.now() + 1000,
      }),
    ).rejects.toThrow(/at least one minute/);
  });

  test("rejects closesAt before dropsAt", async () => {
    const t = setup();
    const episodeId = await seedChurchillEpisode(t);
    const dropsAt = Date.now() + 86_400_000;
    await expect(
      t.mutation(api.daily.scheduleEpisode, {
        episodeId,
        dropsAt,
        closesAt: dropsAt - 1000,
      }),
    ).rejects.toThrow(/closesAt must be after dropsAt/);
  });

  test("rejects rescheduling a closed episode", async () => {
    const t = setup();
    await insertLiveEpisode(t, Date.now() - 120_000, Date.now() - 60_000);
    await t.mutation(api.daily.closeExpired, {});

    const episodeId = await t.run(async (ctx) => {
      const closed = await ctx.db
        .query("episodes")
        .withIndex("by_status_and_dropsAt", (q) => q.eq("status", "closed"))
        .first();
      if (!closed) throw new Error("No closed episode found");
      return closed._id;
    });

    await expect(
      t.mutation(api.daily.scheduleEpisode, {
        episodeId,
        dropsAt: Date.now() + 86_400_000,
      }),
    ).rejects.toThrow(/Closed episodes/);
  });
});
