import { action } from "./_generated/server";
import { v } from "convex/values";

const VENICE_API_URL = "https://api.venice.ai/api/v1/chat/completions";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const SYSTEM_PROMPT = `You are a mystery game hint generator for WhoWare, a daily history guessing game.
Given a historical scene description and a clue label, provide a subtle, atmospheric hint that guides the player toward identifying the historical figure WITHOUT naming them directly.
Rules:
- Never name the person or use their full name
- Be period-accurate and atmospheric
- Keep hints under 2 sentences
- Reference era, location, and contextual details that narrow the identity
- Sound like a whispered memory, not a Wikipedia article`;

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
          { role: "system", content: SYSTEM_PROMPT },
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
