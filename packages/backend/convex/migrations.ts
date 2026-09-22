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

    // v0.4 — when the episode has a roomFigureId different from the
    // target, the room-figure speaks about the target (relational voice).
    // Without this, quotes render in self-voice, which contradicts the
    // Witness Chamber reveal.
    const roomFigure = ep.roomFigureId ? await ctx.db.get(ep.roomFigureId) : null;
    const speakerFigure =
      roomFigure && roomFigure._id !== ep.figureId ? roomFigure : figure;
    const targetForVoice =
      roomFigure && roomFigure._id !== ep.figureId
        ? figure
        : undefined;

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
              canonicalName: speakerFigure.canonicalName,
              era: speakerFigure.era,
              region: speakerFigure.region,
              tags: speakerFigure.tags,
            },
            targetFigure: targetForVoice
              ? { canonicalName: targetForVoice.canonicalName }
              : undefined,
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

/**
 * v0.4 — backfill `roomFigureId` on every episode.
 *
 * For each episode, picks the first related figure from the target's
 * `relatedFigures` list and stores its id as the room-figure. Episodes
 * without a relatedFigure (or whose related figure is the same as the
 * target) get `roomFigureId: null` and behave like v0.3.
 *
 * Idempotent: episodes that already have a roomFigureId are skipped.
 *
 *   npx convex run --prod migrations:runBackfillRoomFigures '{"dryRun": true}'
 *   npx convex run --prod migrations:runBackfillRoomFigures
 */
export const backfillRoomFigures = migrations.define({
  table: "episodes",
  migrateOne: async (ctx, doc) => {
    const ep = doc as DataModel["episodes"]["documentType"];
    if (ep.roomFigureId) return;
    if (!ep.figureId) return;
    const target = await ctx.db.get(ep.figureId);
    if (!target) return;

    const firstRelatedName = target.relatedFigures?.[0];
    if (!firstRelatedName || firstRelatedName === target.canonicalName) return;

    const roomRow = await ctx.db
      .query("figures")
      .withIndex("by_canonicalName", (q: any) => q.eq("canonicalName", firstRelatedName))
      .first();
    if (!roomRow) return;
    if (roomRow._id === ep.figureId) return;

    return { roomFigureId: roomRow._id };
  },
});

export const runBackfillRoomFigures = mutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    if (dryRun) {
      return await migrations.runOne(ctx, internal.migrations.backfillRoomFigures, {
        dryRun: true,
        reset: true,
      });
    }
    let status = await migrations.runOne(ctx, internal.migrations.backfillRoomFigures, {
      reset: true,
    });
    let batches = 1;
    while (!status.isDone && !status.error && batches < 200) {
      status = await migrations.runOne(ctx, internal.migrations.backfillRoomFigures);
      batches++;
    }
    return { ...status, batchesRan: batches };
  },
});
