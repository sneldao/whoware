import { action, query } from "./_generated/server";
import { v } from "convex/values";

const VENICE_API_URL = "https://api.venice.ai/api/v1/chat/completions";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const IDENTITY_HINT_PROMPT = `You are a mystery game hint generator for WhoWare, a daily history guessing game.
You will receive a historical figure's era, region, tags, and aliases. Produce a two-sentence "identity nudge" that narrows the player's guess toward this person WITHOUT naming them.
Rules:
- NEVER output the person's canonical name or any alias verbatim.
- Use era, region, domain, and recognizable contextual details.
- Sound like a whispered memory, not a biography.
- Keep hints under 2 sentences.`;

export const getEpisodeFigure = query({
  args: { episodeId: v.id("episodes") },
  returns: v.union(
    v.object({
      era: v.string(),
      region: v.string(),
      tier: v.string(),
      tags: v.array(v.string()),
      aliases: v.array(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const episode = await ctx.db.get(args.episodeId);
    if (!episode?.figureId) return null;
    const figure = await ctx.db.get(episode.figureId);
    if (!figure) return null;
    return {
      era: figure.era,
      region: figure.region,
      tier: figure.tier,
      tags: figure.tags,
      aliases: figure.aliases,
    };
  },
});

export const generateHint = action({
  args: {
    sceneAmbientText: v.string(),
    clueLabel: v.string(),
    sceneLocation: v.string(),
    sceneEra: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const cacheKey = `${args.clueLabel}:${args.sceneLocation}`;
    const sceneSystemPrompt = `You are a mystery game hint generator for WhoWare, a daily history guessing game.
Given a historical scene description and a clue label, provide a subtle, atmospheric hint that guides the player toward identifying the historical figure WITHOUT naming them directly.
Rules:
- Never name the person or use their full name
- Be period-accurate and atmospheric
- Keep hints under 2 sentences
- Reference era, location, and contextual details that narrow the identity
- Sound like a whispered memory, not a Wikipedia article`;

    const existing = await ctx.db
      .query("veniceHints")
      .withIndex("by_cacheKey", (q) => q.eq("cacheKey", cacheKey))
      .first();

    if (existing && Date.now() - existing.cachedAt < CACHE_TTL_MS) {
      return existing.hint;
    }

    const apiKey = process.env.VENICE_API_KEY;
    if (!apiKey) {
      return "The memory is too faint — hints are unavailable right now.";
    }

    const userMessage = `Scene location: ${args.sceneLocation}\nScene era: ${args.sceneEra}\nScene atmosphere: ${args.sceneAmbientText}\nClue the player is inspecting: ${args.clueLabel}\n\nGenerate a subtle hint.`;

    const response = await fetch(VENICE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "venice-uncensored",
        messages: [
          { role: "system", content: sceneSystemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error("Venice API error:", response.status, await response.text());
      return "The signal is jammed — try again later.";
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const hint = data.choices?.[0]?.message?.content?.trim();

    if (!hint) {
      return "The memory yields nothing yet.";
    }

    if (existing) {
      await ctx.db.patch(existing._id, { hint, cachedAt: Date.now() });
    } else {
      await ctx.db.insert("veniceHints", {
        cacheKey,
        hint,
        cachedAt: Date.now(),
      });
    }

    return hint;
  },
});

export const generateIdentityHint = action({
  args: { episodeId: v.id("episodes") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const cacheKey = `identity:${args.episodeId}`;

    const existing = await ctx.db
      .query("veniceHints")
      .withIndex("by_cacheKey", (q) => q.eq("cacheKey", cacheKey))
      .first();

    if (existing && Date.now() - existing.cachedAt < CACHE_TTL_MS) {
      return existing.hint;
    }

    const episode = await ctx.db.get(args.episodeId);
    if (!episode?.figureId) {
      return "The identity is still hidden.";
    }
    const figure = await ctx.db.get(episode.figureId);
    if (!figure) {
      return "The identity is still hidden.";
    }

    const apiKey = process.env.VENICE_API_KEY;
    if (!apiKey) {
      return "The memory is too faint — hints are unavailable right now.";
    }

    const userMessage = [
      `Era: ${figure.era}`,
      `Region: ${figure.region}`,
      `Tier: ${figure.tier}`,
      `Tags: ${figure.tags.join(", ")}`,
      `Aliases (you must NOT use any of these words): ${figure.aliases.join(", ")}`,
      "",
      "Generate a two-sentence identity nudge that narrows the guess without naming the person or any alias.",
    ].join("\n");

    const response = await fetch(VENICE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "venice-uncensored",
        messages: [
          { role: "system", content: IDENTITY_HINT_PROMPT },
          { role: "user", content: userMessage },
        ],
        max_tokens: 180,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error("Venice API error:", response.status, await response.text());
      return "The signal is jammed — try again later.";
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const rawHint = data.choices?.[0]?.message?.content?.trim();

    if (!rawHint) {
      return "The memory yields nothing yet.";
    }

    const forbidden = [figure.canonicalName, ...figure.aliases].map((n) => n.toLowerCase());
    const hint = forbidden.some((name) => name && rawHint.toLowerCase().includes(name))
      ? "The memory whispers in riddles."
      : rawHint;

    if (existing) {
      await ctx.db.patch(existing._id, { hint, cachedAt: Date.now() });
    } else {
      await ctx.db.insert("veniceHints", {
        cacheKey,
        hint,
        cachedAt: Date.now(),
      });
    }

    return hint;
  },
});

export const getIdentityHint = query({
  args: { episodeId: v.id("episodes") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const cacheKey = `identity:${args.episodeId}`;
    const existing = await ctx.db
      .query("veniceHints")
      .withIndex("by_cacheKey", (q) => q.eq("cacheKey", cacheKey))
      .first();
    if (!existing) return null;
    if (Date.now() - existing.cachedAt >= CACHE_TTL_MS) return null;
    return existing.hint;
  },
});

export const getVeniceStats = query({
  args: {},
  returns: v.object({
    totalEpisodesGenerated: v.number(),
    totalHintsProvided: v.number(),
    totalImagesRendered: v.number(),
    cachedHintsAvailable: v.number(),
  }),
  handler: async (ctx) => {
    const allEpisodes = await ctx.db.query("episodes").collect();

    let totalEpisodesGenerated = 0;
    let totalImagesRendered = 0;

    for (const ep of allEpisodes) {
      const hasVeniceImage = ep.scenes.some((s) => Boolean(s.imageKey || s.imageUrl));
      if (hasVeniceImage) {
        totalEpisodesGenerated++;
      }
      totalImagesRendered += ep.scenes.filter((s) => Boolean(s.imageKey || s.imageUrl)).length;
    }

    const allHints = await ctx.db.query("veniceHints").collect();
    const now = Date.now();
    const cachedHintsAvailable = allHints.filter((h) => now - h.cachedAt < CACHE_TTL_MS).length;

    return {
      totalEpisodesGenerated,
      totalHintsProvided: allHints.length,
      totalImagesRendered,
      cachedHintsAvailable,
    };
  },
});

const DAY_ENTRY = v.object({
  dayLabel: v.string(),
  fullDate: v.string(),
  episodes: v.number(),
  hints: v.number(),
  images: v.number(),
  total: v.number(),
});

export const getVeniceWeeklyStats = query({
  args: {},
  returns: v.object({
    days: v.array(DAY_ENTRY),
    maxDaily: v.number(),
    weeklyEpisodes: v.number(),
    weeklyHints: v.number(),
    weeklyImages: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();

    // Build 7 day buckets, today through 6 days ago
    const dayBuckets: Array<{
      start: number;
      end: number;
      label: string;
      fullDate: string;
    }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86_400_000);
      d.setHours(0, 0, 0, 0);
      const start = d.getTime();
      d.setHours(23, 59, 59, 999);
      const end = d.getTime();
      dayBuckets.push({
        start,
        end,
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        fullDate: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      });
    }

    const allEpisodes = await ctx.db.query("episodes").collect();
    const allHints = await ctx.db.query("veniceHints").collect();

    const days = dayBuckets.map((bucket) => {
      let episodes = 0;
      let images = 0;

      for (const ep of allEpisodes) {
        if (ep._creationTime >= bucket.start && ep._creationTime <= bucket.end) {
          const hasVeniceImage = ep.scenes.some((s) => Boolean(s.imageKey || s.imageUrl));
          if (hasVeniceImage) {
            episodes++;
            images += ep.scenes.filter((s) => Boolean(s.imageKey || s.imageUrl)).length;
          }
        }
      }

      const hints = allHints.filter(
        (h) => h.cachedAt >= bucket.start && h.cachedAt <= bucket.end,
      ).length;

      return {
        dayLabel: bucket.label,
        fullDate: bucket.fullDate,
        episodes,
        hints,
        images,
        total: episodes + hints + images,
      };
    });

    const maxDaily = Math.max(...days.map((d) => d.total), 1);
    const weeklyEpisodes = days.reduce((s, d) => s + d.episodes, 0);
    const weeklyHints = days.reduce((s, d) => s + d.hints, 0);
    const weeklyImages = days.reduce((s, d) => s + d.images, 0);

    return { days, maxDaily, weeklyEpisodes, weeklyHints, weeklyImages };
  },
});
