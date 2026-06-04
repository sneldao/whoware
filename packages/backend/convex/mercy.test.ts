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
  const { episodeId } = await t.mutation(api.episodes.ensureDemoEpisode, {});
  return episodeId;
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
