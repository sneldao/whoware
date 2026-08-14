import { internalQuery, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * Answer-reveal gate for live episodes.
 *
 * A figure's identity (bio, name, relationships) may be served only once
 * the episode's secret is no longer exploitable:
 * - the episode is closed (archive/practice surface), or
 * - the caller's run for that episode is solved or exhausted.
 *
 * Without a resolved run, these payloads are a trivial answer oracle —
 * the identity can be read from devtools instead of guessed.
 */
export async function canRevealAnswerFor(
  ctx: QueryCtx,
  episodeId: Id<"episodes">,
  identityId: string | undefined,
): Promise<boolean> {
  const episode = await ctx.db.get(episodeId);
  if (!episode) return false;
  if (episode.status === "closed") return true;

  const clean = identityId?.trim();
  if (!clean || clean.length > 64) return false;

  const run = await ctx.db
    .query("playerRuns")
    .withIndex("by_episodeId_and_identityId", (q) =>
      q.eq("episodeId", episodeId).eq("identityId", clean),
    )
    .first();
  return run?.status === "solved" || run?.status === "exhausted";
}

/** Callable from actions via ctx.runQuery — actions share no query ctx. */
export const canRevealAnswer = internalQuery({
  args: {
    episodeId: v.id("episodes"),
    identityId: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => canRevealAnswerFor(ctx, args.episodeId, args.identityId),
});
