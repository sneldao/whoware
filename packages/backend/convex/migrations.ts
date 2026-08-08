import { v } from "convex/values";

import { Migrations } from "@convex-dev/migrations";
import { DataModel } from "./_generated/dataModel";
import { components, internal } from "./_generated/api";
import { internalMutation, mutation } from "./_generated/server";

const migrations = new Migrations<DataModel>(components.migrations, { internalMutation });

// =============================================================================
// DEFINING MIGRATIONS
// =============================================================================

/** Backfill `hintsUsed` on existing player runs so the scoring field is always present. */
export const backfillHintsUsed = migrations.define({
  table: "playerRuns",
  migrateOne: async (_ctx, doc) => {
    if ((doc as Record<string, unknown>).hintsUsed === undefined) {
      return { hintsUsed: 0 };
    }
  },
});

// Public wrapper so the backfill can be run from the CLI/dashboard.
// migrations.define() creates an *internal* mutation (only callable from within
// Convex), so we wrap it with runOne. Loops batch-by-batch until done.
//
//   npx convex run --prod migrations:runBackfillHintsUsed '{"dryRun": true}'
//   npx convex run --prod migrations:runBackfillHintsUsed
export const runBackfillHintsUsed = mutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    if (dryRun) {
      // One batch, then rollback — verify it would patch the right docs.
      return await migrations.runOne(ctx, internal.migrations.backfillHintsUsed, {
        dryRun: true,
        reset: true,
      });
    }
    let status = await migrations.runOne(ctx, internal.migrations.backfillHintsUsed, {
      reset: true,
    });
    let batches = 1;
    while (!status.isDone && !status.error && batches < 100) {
      status = await migrations.runOne(ctx, internal.migrations.backfillHintsUsed);
      batches++;
    }
    return { ...status, batchesRan: batches };
  },
});
