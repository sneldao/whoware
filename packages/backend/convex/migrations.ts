import { v } from "convex/values";

import { Migrations } from "@convex-dev/migrations";
import { DataModel } from "./_generated/dataModel";
import { components, internal } from "./_generated/api";
import { internalMutation, mutation } from "./_generated/server";
import { quoteForClue } from "./figureVoice";

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

/**
 * v0.3 — backfill `figureQuote` on every clue across every episode.
 *
 * Idempotent: clues that already have one are left alone. Quotes come
 * from the deterministic template engine in `figureVoice.ts`, not from
 * any LLM call — this backfill runs at zero inference cost.
 *
 * The migration walks episodes (not clues directly) because each clue
 * needs its episode's figure for the voice template. Episodes are
 * patched in place; the patch returns the updated `scenes` array only
 * when at least one scene's clue got a new quote.
 */
export const backfillFigureQuotes = migrations.define({
  table: "episodes",
  migrateOne: async (ctx, doc) => {
    const ep = doc as DataModel["episodes"]["documentType"];
    const figure = ep.figureId ? await ctx.db.get(ep.figureId) : null;
    if (!figure) return;

    let episodeTouched = false;
    const updatedScenes = ep.scenes.map((scene) => {
      let sceneTouched = false;
      const updatedClues = scene.clues.map((clue) => {
        if (clue.figureQuote) return clue;
        sceneTouched = true;
        episodeTouched = true;
        return {
          ...clue,
          figureQuote: quoteForClue({
            figure: {
              canonicalName: figure.canonicalName,
              era: figure.era,
              region: figure.region,
              tags: figure.tags,
            },
            scene: {
              title: scene.title,
              location: scene.location,
              era: scene.era,
            },
            clue: { label: clue.label, detail: clue.detail },
          }),
        };
      });
      return sceneTouched ? { ...scene, clues: updatedClues } : scene;
    });
    if (!episodeTouched) return;
    return { scenes: updatedScenes };
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

/**
 * v0.3 — public wrapper to trigger the figureQuote backfill.
 *
 *   npx convex run --prod migrations:runBackfillFigureQuotes '{"dryRun": true}'
 *   npx convex run --prod migrations:runBackfillFigureQuotes
 */
export const runBackfillFigureQuotes = mutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    if (dryRun) {
      return await migrations.runOne(ctx, internal.migrations.backfillFigureQuotes, {
        dryRun: true,
        reset: true,
      });
    }
    let status = await migrations.runOne(ctx, internal.migrations.backfillFigureQuotes, {
      reset: true,
    });
    let batches = 1;
    while (!status.isDone && !status.error && batches < 200) {
      status = await migrations.runOne(ctx, internal.migrations.backfillFigureQuotes);
      batches++;
    }
    return { ...status, batchesRan: batches };
  },
});
