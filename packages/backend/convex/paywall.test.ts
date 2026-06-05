import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

function setup() {
  return convexTest(schema, modules);
}

async function insertEpisode(
  t: ReturnType<typeof setup>,
  slug: string,
): Promise<Id<"episodes">> {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("episodes", {
      slug,
      figureName: "Test Figure",
      activeAt: Date.now() - 86_400_000,
      dropsAt: Date.now() - 86_400_000,
      closesAt: Date.now() - 3600_000,
      status: "closed",
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

describe("paywall.isUnlocked", () => {
  test("returns false when no unlock record exists", async () => {
    const t = setup();
    const episodeId = await insertEpisode(t, "ep-001");

    const unlocked = await t.query(api.paywall.isUnlocked, {
      identityId: "player-1",
      episodeId,
    });

    expect(unlocked).toBe(false);
  });

  test("returns true after an unlock record is inserted", async () => {
    const t = setup();
    const episodeId = await insertEpisode(t, "ep-002");

    await t.mutation(internal.paywall.recordUnlock, {
      identityId: "player-1",
      episodeId,
      txHash: "0xabc123",
    });

    const unlocked = await t.query(api.paywall.isUnlocked, {
      identityId: "player-1",
      episodeId,
    });

    expect(unlocked).toBe(true);
  });

  test("returns false for a different identity", async () => {
    const t = setup();
    const episodeId = await insertEpisode(t, "ep-003");

    await t.mutation(internal.paywall.recordUnlock, {
      identityId: "player-1",
      episodeId,
      txHash: "0xabc123",
    });

    const unlocked = await t.query(api.paywall.isUnlocked, {
      identityId: "player-2",
      episodeId,
    });

    expect(unlocked).toBe(false);
  });

  test("returns false for a different episode", async () => {
    const t = setup();
    const episode1 = await insertEpisode(t, "ep-004");
    const episode2 = await insertEpisode(t, "ep-005");

    await t.mutation(internal.paywall.recordUnlock, {
      identityId: "player-1",
      episodeId: episode1,
      txHash: "0xabc123",
    });

    const unlocked = await t.query(api.paywall.isUnlocked, {
      identityId: "player-1",
      episodeId: episode2,
    });

    expect(unlocked).toBe(false);
  });
});

describe("paywall.getUnlock", () => {
  test("returns null when no unlock exists", async () => {
    const t = setup();
    const episodeId = await insertEpisode(t, "ep-006");

    const unlock = await t.query(api.paywall.getUnlock, {
      identityId: "player-1",
      episodeId,
    });

    expect(unlock).toBeNull();
  });

  test("returns txHash and paidAt after unlock", async () => {
    const t = setup();
    const episodeId = await insertEpisode(t, "ep-007");

    await t.mutation(internal.paywall.recordUnlock, {
      identityId: "player-1",
      episodeId,
      txHash: "0xdef456",
    });

    const unlock = await t.query(api.paywall.getUnlock, {
      identityId: "player-1",
      episodeId,
    });

    expect(unlock).not.toBeNull();
    expect(unlock?.txHash).toBe("0xdef456");
    expect(unlock?.paidAt).toBeGreaterThan(0);
  });
});

describe("paywall.recordUnlock", () => {
  test("upserts — second call does not duplicate", async () => {
    const t = setup();
    const episodeId = await insertEpisode(t, "ep-008");

    await t.mutation(internal.paywall.recordUnlock, {
      identityId: "player-1",
      episodeId,
      txHash: "0xfirst",
    });

    await t.mutation(internal.paywall.recordUnlock, {
      identityId: "player-1",
      episodeId,
      txHash: "0xsecond",
    });

    const unlock = await t.query(api.paywall.getUnlock, {
      identityId: "player-1",
      episodeId,
    });

    expect(unlock?.txHash).toBe("0xfirst");
  });
});
