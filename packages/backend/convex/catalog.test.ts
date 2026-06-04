import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

function setup() {
  return convexTest(schema, modules);
}

async function seedCatalog(t: ReturnType<typeof setup>) {
  await t.mutation(api.figures.seedCatalog, {});
}

describe("catalog.stageFigure", () => {
  test("creates a new figure and is idempotent on canonicalName", async () => {
    const t = setup();
    const first = await t.mutation(api.catalog.stageFigure, {
      canonicalName: "Test Figure",
      aliases: ["TF"],
      era: "19th century",
      region: "Europe",
      tier: "field",
      tags: ["test"],
      difficulty: "field",
    });
    expect(first.isNew).toBe(true);

    const second = await t.mutation(api.catalog.stageFigure, {
      canonicalName: "Test Figure",
      era: "19th century",
      region: "Europe",
      tier: "field",
      difficulty: "field",
    });
    expect(second.isNew).toBe(false);
    expect(second.figureId).toBe(first.figureId);
  });

  test("staged figure appears in search", async () => {
    const t = setup();
    await t.mutation(api.catalog.stageFigure, {
      canonicalName: "Rosa Parks",
      aliases: ["Mother of the Civil Rights Movement"],
      era: "20th century",
      region: "United States",
      tier: "iconic",
      tags: ["civil rights", "activist"],
      difficulty: "iconic",
    });

    const results = await t.query(api.figures.search, { query: "Rosa" });
    expect(results.length).toBe(1);
    expect(results[0].canonicalName).toBe("Rosa Parks");
  });
});

describe("catalog.createDraftEpisode", () => {
  test("creates a staging episode linked to the figure", async () => {
    const t = setup();
    await seedCatalog(t);
    const churchill = await t.query(api.figures.search, { query: "Churchill" }).then((rows) => rows[0]);

    const { episodeId } = await t.mutation(api.catalog.createDraftEpisode, {
      figureId: churchill._id,
      slug: "test-churchill-staging",
    });
    expect(episodeId).toBeDefined();

    const queue = await t.query(api.catalog.getStagingQueue, {});
    expect(queue.length).toBeGreaterThanOrEqual(1);
    const staged = queue.find((ep) => ep.slug === "test-churchill-staging");
    expect(staged).toBeDefined();
    expect(staged?.status).toBe("staging");
    expect(staged?.figureName).toBe("Winston Churchill");
  });
});

describe("catalog.approveEpisode", () => {
  test("rejects approval when episode is not in review status", async () => {
    const t = setup();
    await seedCatalog(t);
    const churchill = await t.query(api.figures.search, { query: "Churchill" }).then((rows) => rows[0]);

    const { episodeId } = await t.mutation(api.catalog.createDraftEpisode, {
      figureId: churchill._id,
      slug: "test-approve-reject",
    });

    await expect(
      t.mutation(api.catalog.approveEpisode, { episodeId }),
    ).rejects.toThrow(/must be in review/);
  });

  test("approves a reviewed episode with complete images", async () => {
    const t = setup();
    const episodeId = await t.run(async (ctx) => {
      return await ctx.db.insert("episodes", {
        slug: "test-approved",
        activeAt: Date.now(),
        isActive: false,
        dropsAt: Date.now() + 86_400_000,
        status: "review",
        difficulty: "iconic",
        scenes: [
          {
            title: "Test scene",
            location: "Test",
            era: "1940s",
            palette: ["#000"],
            panoramaPrompt: "test",
            ambientText: "test",
            clues: [{ label: "c", detail: "d", x: 50, y: 50 }],
            isMercy: false,
            imageUrl: "https://storage.example.com/test.webp",
          },
        ],
      });
    });

    await t.mutation(api.catalog.approveEpisode, { episodeId });

    const queue = await t.query(api.catalog.getStagingQueue, {});
    const approved = queue.find((ep) => ep.slug === "test-approved");
    expect(approved).toBeUndefined();
  });

  test("rejects approval when investigation scenes lack images", async () => {
    const t = setup();
    const episodeId = await t.run(async (ctx) => {
      return await ctx.db.insert("episodes", {
        slug: "test-no-images",
        activeAt: Date.now(),
        isActive: false,
        dropsAt: Date.now() + 86_400_000,
        status: "review",
        difficulty: "iconic",
        scenes: [
          {
            title: "Missing image",
            location: "Test",
            era: "1940s",
            palette: ["#000"],
            panoramaPrompt: "test",
            ambientText: "test",
            clues: [{ label: "c", detail: "d", x: 50, y: 50 }],
            isMercy: false,
          },
        ],
      });
    });

    await expect(
      t.mutation(api.catalog.approveEpisode, { episodeId }),
    ).rejects.toThrow(/missing images/);
  });
});

describe("catalog.getStagingQueue", () => {
  test("returns staging and review episodes ordered by creation time", async () => {
    const t = setup();
    await seedCatalog(t);
    const churchill = await t.query(api.figures.search, { query: "Churchill" }).then((rows) => rows[0]);

    await t.mutation(api.catalog.createDraftEpisode, {
      figureId: churchill._id,
      slug: "queue-first",
    });
    await t.mutation(api.catalog.createDraftEpisode, {
      figureId: churchill._id,
      slug: "queue-second",
    });

    const queue = await t.query(api.catalog.getStagingQueue, {});
    const staged = queue.filter((ep) => ep.slug.startsWith("queue-"));
    expect(staged.length).toBe(2);
    expect(staged[0].slug).toBe("queue-first");
    expect(staged[1].slug).toBe("queue-second");
  });

  test("excludes live and closed episodes", async () => {
    const t = setup();
    await seedCatalog(t);
    await t.mutation(api.episodes.ensureDemoEpisode, {});

    const queue = await t.query(api.catalog.getStagingQueue, {});
    const demoInQueue = queue.find((ep) => ep.slug === "demo-churchill");
    expect(demoInQueue).toBeUndefined();
  });
});
