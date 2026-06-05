import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

function setup() {
  return convexTest(schema, modules);
}

describe("notifications.registerToken", () => {
  test("creates a new subscription for a fresh identity", async () => {
    const t = setup();
    await t.mutation(api.notifications.registerToken, {
      identityId: "player-1",
      expoPushToken: "ExponentPushToken[abc]",
      platform: "ios",
    });

    const sub = await t.query(api.notifications.getSubscription, { identityId: "player-1" });
    expect(sub).not.toBeNull();
    expect(sub?.expoPushToken).toBe("ExponentPushToken[abc]");
    expect(sub?.platform).toBe("ios");
    expect(sub?.isOptedIn).toBe(true);
  });

  test("upserts: updates token + clears unsubscribe on re-register", async () => {
    const t = setup();
    await t.mutation(api.notifications.registerToken, {
      identityId: "player-1",
      expoPushToken: "old-token",
      platform: "ios",
    });
    await t.mutation(api.notifications.unregisterToken, { identityId: "player-1" });
    await t.mutation(api.notifications.registerToken, {
      identityId: "player-1",
      expoPushToken: "new-token",
      platform: "android",
    });

    const sub = await t.query(api.notifications.getSubscription, { identityId: "player-1" });
    expect(sub?.expoPushToken).toBe("new-token");
    expect(sub?.platform).toBe("android");
    expect(sub?.isOptedIn).toBe(true);
  });

  test("rejects invalid identityId", async () => {
    const t = setup();
    await expect(
      t.mutation(api.notifications.registerToken, {
        identityId: "",
        expoPushToken: "x",
        platform: "ios",
      }),
    ).rejects.toThrow(/Invalid identity/);
  });
});

describe("notifications.unregisterToken", () => {
  test("marks the subscription as opted-out without deleting it", async () => {
    const t = setup();
    await t.mutation(api.notifications.registerToken, {
      identityId: "player-1",
      expoPushToken: "tok",
      platform: "ios",
    });
    await t.mutation(api.notifications.unregisterToken, { identityId: "player-1" });

    const sub = await t.query(api.notifications.getSubscription, { identityId: "player-1" });
    expect(sub).not.toBeNull();
    expect(sub?.isOptedIn).toBe(false);
  });

  test("is idempotent for unknown identities", async () => {
    const t = setup();
    const result = await t.mutation(api.notifications.unregisterToken, { identityId: "ghost" });
    expect(result).toBeNull();
  });
});
