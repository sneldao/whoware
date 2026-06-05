import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

function setup() {
  return convexTest(schema, modules);
}

async function seedChurchillEpisode(t: ReturnType<typeof setup>) {
  await t.mutation(api.figures.seedCatalog, {});
  return await t.run(async (ctx) => {
    const churchill = await ctx.db
      .query("figures")
      .withIndex("by_canonicalName", (q) => q.eq("canonicalName", "Winston Churchill"))
      .first();
    if (!churchill) throw new Error("Churchill not seeded");
    return await ctx.db.insert("episodes", {
      slug: "demo-churchill",
      figureId: churchill._id,
      figureName: churchill.canonicalName,
      activeAt: Date.now(),
      dropsAt: Date.now(),
      status: "live",
      difficulty: "iconic",
      scenes: [
        { title: "Scene 1", location: "Bedroom", era: "1940s", palette: ["#1E293B"], panoramaPrompt: "bedroom", ambientText: "A room.", clues: [{ label: "A", detail: "d", x: 10, y: 10 }], isMercy: false },
        { title: "Scene 2", location: "Office", era: "1940s", palette: ["#1E293B"], panoramaPrompt: "office", ambientText: "An office.", clues: [{ label: "B", detail: "d", x: 20, y: 20 }], isMercy: false },
        { title: "Scene 3", location: "Street", era: "1940s", palette: ["#1E293B"], panoramaPrompt: "street", ambientText: "A street.", clues: [{ label: "C", detail: "d", x: 30, y: 30 }], isMercy: false },
        { title: "Scene 4", location: "Park", era: "1940s", palette: ["#1E293B"], panoramaPrompt: "park", ambientText: "A park.", clues: [{ label: "D", detail: "d", x: 40, y: 40 }], isMercy: false },
        { title: "Scene 5", location: "Hall", era: "1940s", palette: ["#1E293B"], panoramaPrompt: "hall", ambientText: "A hall.", clues: [{ label: "E", detail: "d", x: 50, y: 50 }], isMercy: false },
        { title: "Mercy 1", location: "Garden", era: "1930s", palette: ["#064E3B"], panoramaPrompt: "garden", ambientText: "A garden.", clues: [{ label: "F", detail: "d", x: 60, y: 60 }], isMercy: true },
        { title: "Mercy 2", location: "Annexe", era: "1945", palette: ["#111827"], panoramaPrompt: "annexe", ambientText: "An annexe.", clues: [{ label: "G", detail: "d", x: 70, y: 70 }], isMercy: true },
      ],
    });
  });
}

describe("mercy scenes", () => {
  test("Churchill demo has exactly 2 mercy scenes at the end", async () => {
    const t = setup();
    await seedChurchillEpisode(t);
    const episode = await t.query(api.episodes.getActive, {});
    expect(episode).not.toBeNull();
    const scenes = episode!.scenes as Array<{ title: string; isMercy?: boolean }>;
    const mercyIndices = scenes
      .map((s, i) => (s.isMercy ? i : -1))
      .filter((i) => i >= 0);
    expect(mercyIndices).toHaveLength(2);
    expect(mercyIndices).toEqual([scenes.length - 2, scenes.length - 1]);
  });

  test("investigation scenes are not flagged as mercy", async () => {
    const t = setup();
    await seedChurchillEpisode(t);
    const episode = await t.query(api.episodes.getActive, {});
    const investigationScenes = (episode!.scenes as Array<{ isMercy?: boolean }>).slice(0, 5);
    for (const scene of investigationScenes) {
      expect(scene.isMercy).toBeFalsy();
    }
  });

  test("runs.enterScene works for mercy scenes (no backend gating)", async () => {
    const t = setup();
    const episodeId = await seedChurchillEpisode(t);
    const episode = await t.query(api.episodes.getActive, {});
    const lastMercyIndex = episode!.scenes.length - 1;

    const run = await t.mutation(api.runs.startRun, {
      episodeId,
      identityId: "mercy-test-player",
      playerName: "Mercy",
    });

    const result = await t.mutation(api.runs.enterScene, {
      runId: run._id,
      sceneIndex: lastMercyIndex,
    });
    expect(result.memoriesViewed).toBe(1);
  });
});
