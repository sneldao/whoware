import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
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
    await t.run(async (ctx) => {
      await ctx.db.insert("episodes", {
        slug: "live-churchill",
        activeAt: Date.now(),
        dropsAt: Date.now(),
        status: "live",
        difficulty: "iconic",
        scenes: [],
      });
    });

    const queue = await t.query(api.catalog.getStagingQueue, {});
    const liveInQueue = queue.find((ep) => ep.slug === "live-churchill");
    expect(liveInQueue).toBeUndefined();
  });
});

describe("catalog.saveRecalibratedScenes", () => {
  test("updates clues and ambientText while preserving other scene fields", async () => {
    const t = setup();
    const episodeId = await t.run(async (ctx) => {
      return await ctx.db.insert("episodes", {
        slug: "test-recalibrated",
        activeAt: Date.now(),
        dropsAt: Date.now() + 86_400_000,
        status: "staging",
        difficulty: "field",
        scenes: [
          {
            title: "Original scene",
            location: "Paris",
            era: "1790s",
            palette: ["#000", "#111", "#222", "#333"],
            panoramaPrompt: "original panorama",
            imageAspectRatio: "16:9",
            ambientText: "original ambient",
            clues: [
              { label: "Clue A", detail: "obvious detail", x: 10, y: 20 },
              { label: "Clue B", detail: "another detail", x: 30, y: 40 },
              { label: "Clue C", detail: "third detail", x: 50, y: 60 },
            ],
            isMercy: false,
            imageUrl: "https://storage.example.com/original.webp",
          },
          {
            title: "Second scene",
            location: "London",
            era: "1800s",
            palette: ["#444", "#555", "#666", "#777"],
            panoramaPrompt: "second panorama",
            imageAspectRatio: "16:9",
            ambientText: "second ambient",
            clues: [
              { label: "D1", detail: "d1", x: 10, y: 10 },
              { label: "D2", detail: "d2", x: 20, y: 20 },
              { label: "D3", detail: "d3", x: 30, y: 30 },
            ],
            isMercy: false,
          },
        ],
      });
    });

    await t.mutation(internal.catalog.saveRecalibratedScenes, {
      episodeId,
      scenes: [
        {
          title: "Ignored",
          location: "Ignored",
          era: "Ignored",
          palette: [],
          panoramaPrompt: "Ignored",
          ambientText: "rewritten ambient text",
          clues: [
            { label: "Subtle Clue", detail: "more ambiguous", x: 10, y: 20 },
            { label: "Vague Object", detail: "less specific", x: 30, y: 40 },
            { label: "Mystery", detail: "cryptic", x: 50, y: 60 },
          ],
        },
        {
          title: "Also ignored",
          location: "Ignored",
          era: "Ignored",
          palette: [],
          panoramaPrompt: "Ignored",
          ambientText: "second rewritten ambient",
          clues: [
            { label: "R1", detail: "rewritten r1", x: 15, y: 15 },
            { label: "R2", detail: "rewritten r2", x: 25, y: 25 },
            { label: "R3", detail: "rewritten r3", x: 35, y: 35 },
          ],
        },
      ],
    });

    const episode = await t.run(async (ctx) => {
      return await ctx.db.get(episodeId);
    });

    expect(episode?.scenes[0]?.title).toBe("Original scene");
    expect(episode?.scenes[0]?.location).toBe("Paris");
    expect(episode?.scenes[0]?.imageUrl).toBe("https://storage.example.com/original.webp");
    expect(episode?.scenes[0]?.ambientText).toBe("rewritten ambient text");
    expect(episode?.scenes[0]?.clues[0]?.label).toBe("Subtle Clue");
    expect(episode?.scenes[0]?.clues[0]?.detail).toBe("more ambiguous");

    expect(episode?.scenes[1]?.title).toBe("Second scene");
    expect(episode?.scenes[1]?.ambientText).toBe("second rewritten ambient");
    expect(episode?.scenes[1]?.clues[0]?.label).toBe("R1");
  });

  test("handles scenes array shorter than episode scenes gracefully", async () => {
    const t = setup();
    const episodeId = await t.run(async (ctx) => {
      return await ctx.db.insert("episodes", {
        slug: "test-partial-recalibrate",
        activeAt: Date.now(),
        dropsAt: Date.now() + 86_400_000,
        status: "staging",
        difficulty: "iconic",
        scenes: [
          {
            title: "Scene 1",
            location: "Rome",
            era: "44 BC",
            palette: ["#000"],
            panoramaPrompt: "test",
            ambientText: "original 1",
            clues: [{ label: "A", detail: "a", x: 10, y: 10 }],
          },
          {
            title: "Scene 2",
            location: "Egypt",
            era: "48 BC",
            palette: ["#111"],
            panoramaPrompt: "test 2",
            ambientText: "original 2",
            clues: [{ label: "B", detail: "b", x: 20, y: 20 }],
          },
        ],
      });
    });

    await t.mutation(internal.catalog.saveRecalibratedScenes, {
      episodeId,
      scenes: [
        {
          title: "Ignored",
          location: "Ignored",
          era: "Ignored",
          palette: [],
          panoramaPrompt: "Ignored",
          ambientText: "updated 1",
          clues: [{ label: "NewA", detail: "new a", x: 15, y: 15 }],
        },
      ],
    });

    const episode = await t.run(async (ctx) => ctx.db.get(episodeId));
    expect(episode?.scenes[0]?.clues[0]?.label).toBe("NewA");
    expect(episode?.scenes[0]?.ambientText).toBe("updated 1");
    expect(episode?.scenes[1]?.ambientText).toBe("original 2");
    expect(episode?.scenes[1]?.clues[0]?.label).toBe("B");
  });
});

describe("catalog.getRecentEpisodeSummary", () => {
  test("returns empty array when no episodes exist", async () => {
    const t = setup();
    const result = await t.query(internal.catalog.getRecentEpisodeSummary, {});
    expect(result).toEqual([]);
  });

  test("returns up to 7 recent episodes with era and difficulty", async () => {
    const t = setup();
    const now = Date.now();

    for (let i = 0; i < 10; i++) {
      await t.run(async (ctx) => {
        const figureId = await ctx.db.insert("figures", {
          canonicalName: `Figure ${i}`,
          aliases: [],
          era: i % 2 === 0 ? "19th century" : "20th century",
          region: i % 3 === 0 ? "Europe" : "Asia",
          tier: "iconic",
          tags: [],
          difficulty: i % 2 === 0 ? "iconic" : "field",
          searchIndex: `figure ${i}`,
        });

        await ctx.db.insert("episodes", {
          slug: `ep-${i}`,
          figureId,
          figureName: `Figure ${i}`,
          activeAt: now - (10 - i) * 86_400_000,
          dropsAt: now - (10 - i) * 86_400_000,
          status: "closed",
          difficulty: i % 2 === 0 ? "iconic" : "field",
          scenes: [
            {
              title: `Scene for ep ${i}`,
              location: "Somewhere",
              era: i % 2 === 0 ? "19th century" : "20th century",
              palette: [],
              panoramaPrompt: "test",
              ambientText: "test",
              clues: [{ label: "c", detail: "d", x: 0, y: 0 }],
            },
          ],
        });
      });
    }

    const result = await t.query(internal.catalog.getRecentEpisodeSummary, {});
    expect(result.length).toBeLessThanOrEqual(7);
    expect(result.length).toBeGreaterThanOrEqual(1);

    for (const ep of result) {
      expect(ep).toHaveProperty("slug");
      expect(ep).toHaveProperty("era");
      expect(ep).toHaveProperty("difficulty");
    }
  });

  test("excludes episodes without figureId", async () => {
    const t = setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("episodes", {
        slug: "no-figure-ep",
        activeAt: Date.now(),
        dropsAt: Date.now(),
        status: "live",
        difficulty: "iconic",
        scenes: [],
      });
    });

    const result = await t.query(internal.catalog.getRecentEpisodeSummary, {});
    const found = result.find((ep) => ep.slug === "no-figure-ep");
    expect(found).toBeUndefined();
  });
});

describe("catalog.getFullCatalog", () => {
  test("returns empty array when no figures exist", async () => {
    const t = setup();
    const result = await t.query(internal.catalog.getFullCatalog, {});
    expect(result).toEqual([]);
  });

  test("returns all seeded figures with metadata", async () => {
    const t = setup();
    await seedCatalog(t);

    const result = await t.query(internal.catalog.getFullCatalog, {});
    expect(result.length).toBeGreaterThan(0);

    for (const figure of result) {
      expect(figure).toHaveProperty("_id");
      expect(figure).toHaveProperty("canonicalName");
      expect(figure).toHaveProperty("era");
      expect(figure).toHaveProperty("region");
      expect(figure).toHaveProperty("tier");
      expect(figure).toHaveProperty("difficulty");
      expect(figure).toHaveProperty("tags");
      expect(Array.isArray(figure.tags)).toBe(true);
    }
  });

  test("includes manually staged figures", async () => {
    const t = setup();
    await t.mutation(api.catalog.stageFigure, {
      canonicalName: "Ada Lovelace",
      aliases: ["First Programmer"],
      era: "19th century",
      region: "Europe",
      tier: "field",
      tags: ["mathematics", "computing"],
      difficulty: "field",
    });

    const result = await t.query(internal.catalog.getFullCatalog, {});
    const ada = result.find((f) => f.canonicalName === "Ada Lovelace");
    expect(ada).toBeDefined();
    expect(ada?.era).toBe("19th century");
    expect(ada?.region).toBe("Europe");
    expect(ada?.tags).toContain("computing");
  });
});
