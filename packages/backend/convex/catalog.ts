import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

const VENICE_CHAT_URL = "https://api.venice.ai/api/v1/chat/completions";
const VENICE_IMAGE_URL = "https://api.venice.ai/api/v1/images/generations";

const figureTier = v.union(v.literal("iconic"), v.literal("field"), v.literal("research"));

const sceneClueShape = v.object({
  label: v.string(),
  detail: v.string(),
  x: v.number(),
  y: v.number(),
});

const sceneBriefShape = v.object({
  title: v.string(),
  location: v.string(),
  era: v.string(),
  palette: v.array(v.string()),
  panoramaPrompt: v.string(),
  imageAspectRatio: v.optional(v.string()),
  ambientText: v.string(),
  clues: v.array(sceneClueShape),
  isMercy: v.optional(v.boolean()),
});

// =============================================================================
// CURATOR MUTATIONS
// =============================================================================

export const stageFigure = mutation({
  args: {
    canonicalName: v.string(),
    aliases: v.optional(v.array(v.string())),
    era: v.string(),
    region: v.string(),
    tier: figureTier,
    tags: v.optional(v.array(v.string())),
    difficulty: figureTier,
  },
  returns: v.object({ figureId: v.id("figures"), isNew: v.boolean() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("figures")
      .withIndex("by_canonicalName", (q) => q.eq("canonicalName", args.canonicalName))
      .first();

    const searchIndex = [args.canonicalName, ...(args.aliases ?? [])].join(" ").toLowerCase();
    const record = {
      canonicalName: args.canonicalName,
      aliases: args.aliases ?? [],
      era: args.era,
      region: args.region,
      tier: args.tier,
      tags: args.tags ?? [],
      difficulty: args.difficulty,
      searchIndex,
    };

    if (existing) {
      await ctx.db.patch(existing._id, record);
      return { figureId: existing._id, isNew: false };
    }

    const figureId = await ctx.db.insert("figures", record);
    return { figureId, isNew: true };
  },
});

export const createDraftEpisode = mutation({
  args: {
    figureId: v.id("figures"),
    slug: v.string(),
    difficulty: v.optional(figureTier),
  },
  returns: v.object({ episodeId: v.id("episodes") }),
  handler: async (ctx, args) => {
    const figure = await ctx.db.get(args.figureId);
    if (!figure) throw new Error("Figure not found");

    const episodeId = await ctx.db.insert("episodes", {
      slug: args.slug,
      figureId: args.figureId,
      figureName: figure.canonicalName,
      activeAt: Date.now(),
      dropsAt: Date.now() + 86_400_000,
      status: "staging",
      difficulty: args.difficulty ?? figure.difficulty,
      scenes: [],
    });

    return { episodeId };
  },
});

export const approveEpisode = mutation({
  args: { episodeId: v.id("episodes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const episode = await ctx.db.get(args.episodeId);
    if (!episode) throw new Error("Episode not found");
    if (episode.status !== "review") {
      throw new Error(`Episode must be in review status, currently ${episode.status}`);
    }

    const investigationScenes = episode.scenes.filter((s) => !s.isMercy);
    if (investigationScenes.length === 0) {
      throw new Error("Episode has no investigation scenes");
    }
    const missingImages = investigationScenes.filter((s) => !s.imageUrl && !s.imageKey);
    if (missingImages.length > 0) {
      throw new Error(`${missingImages.length} investigation scene(s) are missing images`);
    }

    await ctx.db.patch(args.episodeId, { status: "draft" });
    return null;
  },
});

export const getStagingQueue = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("episodes"),
      slug: v.string(),
      status: v.union(v.literal("staging"), v.literal("review")),
      figureName: v.optional(v.string()),
      sceneCount: v.number(),
      imagesReady: v.number(),
      _creationTime: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const staging = await ctx.db
      .query("episodes")
      .withIndex("by_status_and_dropsAt", (q) => q.eq("status", "staging"))
      .collect();
    const review = await ctx.db
      .query("episodes")
      .withIndex("by_status_and_dropsAt", (q) => q.eq("status", "review"))
      .collect();

    return [...staging, ...review]
      .map((ep) => ({
        _id: ep._id,
        slug: ep.slug,
        status: ep.status as "staging" | "review",
        figureName: ep.figureName,
        sceneCount: ep.scenes.length,
        imagesReady: ep.scenes.filter((s) => Boolean(s.imageUrl || s.imageKey)).length,
        _creationTime: ep._creationTime,
      }))
      .sort((a, b) => a._creationTime - b._creationTime);
  },
});

export const getEpisodeDetail = query({
  args: { episodeId: v.id("episodes") },
  returns: v.union(
    v.object({
      _id: v.id("episodes"),
      slug: v.string(),
      status: v.union(v.literal("staging"), v.literal("review"), v.literal("draft"), v.literal("live"), v.literal("closed")),
      figureName: v.optional(v.string()),
      difficulty: v.union(v.literal("iconic"), v.literal("field"), v.literal("research")),
      scenes: v.array(
        v.object({
          title: v.string(),
          location: v.string(),
          era: v.string(),
          palette: v.array(v.string()),
          panoramaPrompt: v.string(),
          imageKey: v.optional(v.string()),
          imageAspectRatio: v.optional(v.string()),
          ambientText: v.string(),
          clues: v.array(
            v.object({
              label: v.string(),
              detail: v.string(),
              x: v.number(),
              y: v.number(),
            }),
          ),
          isMercy: v.optional(v.boolean()),
          imageUrl: v.optional(v.string()),
        }),
      ),
      _creationTime: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const episode = await ctx.db.get(args.episodeId);
    if (!episode) return null;

    return {
      _id: episode._id,
      slug: episode.slug,
      status: episode.status,
      figureName: episode.figureName,
      difficulty: episode.difficulty,
      scenes: episode.scenes.map((s) => ({
        title: s.title,
        location: s.location,
        era: s.era,
        palette: s.palette,
        panoramaPrompt: s.panoramaPrompt,
        imageKey: s.imageKey,
        imageAspectRatio: s.imageAspectRatio,
        ambientText: s.ambientText,
        clues: s.clues,
        isMercy: s.isMercy,
        imageUrl: s.imageUrl,
      })),
      _creationTime: episode._creationTime,
    };
  },
});

// =============================================================================
// INTERNAL MUTATIONS (called by actions)
// =============================================================================

export const saveSceneBriefs = internalMutation({
  args: {
    episodeId: v.id("episodes"),
    scenes: v.array(sceneBriefShape),
  },
  returns: v.object({ sceneCount: v.number() }),
  handler: async (ctx, args) => {
    const episode = await ctx.db.get(args.episodeId);
    if (!episode) throw new Error("Episode not found");

    await ctx.db.patch(args.episodeId, {
      scenes: args.scenes.map((s) => ({
        title: s.title,
        location: s.location,
        era: s.era,
        palette: s.palette,
        panoramaPrompt: s.panoramaPrompt,
        imageAspectRatio: s.imageAspectRatio ?? "16:9",
        ambientText: s.ambientText,
        clues: s.clues,
        isMercy: s.isMercy ?? false,
      })),
    });

    return { sceneCount: args.scenes.length };
  },
});

export const saveSceneImage = internalMutation({
  args: {
    episodeId: v.id("episodes"),
    sceneIndex: v.number(),
    storageId: v.string(),
    imageUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const episode = await ctx.db.get(args.episodeId);
    if (!episode) throw new Error("Episode not found");
    if (args.sceneIndex >= episode.scenes.length) {
      throw new Error("Scene index out of range");
    }

    const scenes = [...episode.scenes];
    scenes[args.sceneIndex] = {
      ...scenes[args.sceneIndex],
      imageKey: args.storageId,
      imageUrl: args.imageUrl,
      mediaKind: "image" as const,
    };

    await ctx.db.patch(args.episodeId, { scenes });
    return null;
  },
});

export const markForReview = internalMutation({
  args: { episodeId: v.id("episodes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const episode = await ctx.db.get(args.episodeId);
    if (!episode) throw new Error("Episode not found");
    await ctx.db.patch(args.episodeId, { status: "review" });
    return null;
  },
});

// =============================================================================
// GENERATION ACTIONS
// =============================================================================

const SCENE_BRIEF_SYSTEM_PROMPT = `You are a historical scene director for WhoWare, an immersive daily history guessing game. Generate structured JSON for a series of first-person memories from a historical figure's life.

Rules:
- NEVER name the figure or use their full name in any field.
- Be period-accurate and atmospheric.
- No portraits of the figure, no readable personal names, no anachronisms.
- Scenes 1-2 should be subtle and ambiguous.
- Scenes 3-4 add identifying context.
- Scene 5 is highly specific but still never names the figure.
- Scenes 6-7 (mercy) can be more revealing — they appear only after the player has exhausted guesses.
- Each clue must be inspectable visual detail, not abstract concept.

Output format: a JSON object with a "scenes" array:
{
  "scenes": [
    {
      "title": "evocative short title",
      "location": "specific historical location",
      "era": "specific year or narrow period",
      "palette": ["#hex1", "#hex2", "#hex3", "#hex4"],
      "panoramaPrompt": "detailed visual description optimized for image generation, first-person perspective, no faces, no text",
      "ambientText": "2-3 sentence atmospheric description for the player",
      "clues": [
        { "label": "short visual label", "detail": "observation that narrows identity", "x": 0-100, "y": 0-100 }
      ],
      "isMercy": false
    }
  ]
}

Each scene must have exactly 3 clues with x/y between 0-100.`;

function buildImagePrompt(scene: { panoramaPrompt: string; location: string; era: string }): string {
  return `Equirectangular cylindrical equidistant projection, seamless 360 panorama, first-person perspective, ${scene.location}, ${scene.era}. ${scene.panoramaPrompt}. No faces, no readable text, no anachronisms, no portraits of the historical figure. Photorealistic, cinematic lighting, atmospheric depth.`;
}

async function callVeniceChat(apiKey: string, systemPrompt: string, userMessage: string): Promise<string> {
  const response = await fetch(VENICE_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "venice-uncensored",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 4000,
      temperature: 0.6,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Venice chat error: ${response.status} ${body}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Venice returned empty response");
  return content;
}

async function callVeniceImage(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch(VENICE_IMAGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: prompt.slice(0, 1500),
      size: "1792x1024",
      response_format: "b64_json",
      output_format: "webp",
      n: 1,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Venice image error: ${response.status} ${body}`);
  }

  const data = (await response.json()) as {
    data?: Array<{ b64_json?: string }>;
  };

  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("Venice returned no image data");
  return b64;
}

function parseJsonFromResponse(raw: string): { scenes: Array<Record<string, unknown>> } {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : raw.trim();
  return JSON.parse(jsonStr) as { scenes: Array<Record<string, unknown>> };
}

export const generateEpisode = action({
  args: {
    figureId: v.id("figures"),
    slug: v.string(),
    sceneCount: v.optional(v.number()),
  },
  returns: v.object({ episodeId: v.id("episodes"), scenesGenerated: v.number() }),
  handler: async (ctx, args) => {
    const apiKey = process.env.VENICE_API_KEY;
    if (!apiKey) throw new Error("VENICE_API_KEY is not configured");

    const figure = await ctx.runQuery(internal.catalog.getFigure, { figureId: args.figureId });
    if (!figure) throw new Error("Figure not found");

    const { episodeId } = await ctx.runMutation(api.catalog.createDraftEpisode, {
      figureId: args.figureId,
      slug: args.slug,
      difficulty: figure.difficulty,
    });

    const investigationCount = args.sceneCount ?? 5;
    const totalScenes = investigationCount + 2;

    const userMessage = `Generate ${totalScenes} scenes (${investigationCount} investigation + 2 mercy) for the historical figure: ${figure.canonicalName} (${figure.era}, ${figure.region}). Tags: ${figure.tags.join(", ")}. Difficulty: ${figure.difficulty}.`;

    const rawBriefs = await callVeniceChat(apiKey, SCENE_BRIEF_SYSTEM_PROMPT, userMessage);
    const parsed = parseJsonFromResponse(rawBriefs);

    if (!parsed.scenes || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
      throw new Error("Failed to parse scene briefs from Venice response");
    }

    const scenes = parsed.scenes.slice(0, totalScenes).map((s, i) => ({
      title: String(s.title ?? `Scene ${i + 1}`),
      location: String(s.location ?? "Unknown"),
      era: String(s.era ?? figure.era),
      palette: Array.isArray(s.palette) ? (s.palette as string[]).slice(0, 4) : ["#1E293B", "#7C2D12", "#F8E7C9", "#FBBF24"],
      panoramaPrompt: String(s.panoramaPrompt ?? ""),
      ambientText: String(s.ambientText ?? ""),
      clues: Array.isArray(s.clues)
        ? (s.clues as Array<{ label: string; detail: string; x: number; y: number }>).slice(0, 3).map((c) => ({
            label: String(c.label ?? "Clue"),
            detail: String(c.detail ?? ""),
            x: Math.max(0, Math.min(100, Number(c.x ?? 50))),
            y: Math.max(0, Math.min(100, Number(c.y ?? 50))),
          }))
        : [],
      isMercy: i >= investigationCount,
    }));

    await ctx.runMutation(internal.catalog.saveSceneBriefs, { episodeId, scenes });

    for (let i = 0; i < scenes.length; i++) {
      const prompt = buildImagePrompt(scenes[i]);
      const b64 = await callVeniceImage(apiKey, prompt);

      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let j = 0; j < binary.length; j++) {
        bytes[j] = binary.charCodeAt(j);
      }
      const blob = new Blob([bytes], { type: "image/webp" });
      const storageId = await ctx.storage.store(blob);
      const imageUrl = await ctx.storage.getUrl(storageId);

      if (!imageUrl) {
        throw new Error(`Failed to get storage URL for scene ${i}`);
      }

      await ctx.runMutation(internal.catalog.saveSceneImage, {
        episodeId,
        sceneIndex: i,
        storageId: storageId as unknown as string,
        imageUrl,
      });
    }

    await ctx.runMutation(internal.catalog.markForReview, { episodeId });

    return { episodeId, scenesGenerated: scenes.length };
  },
});

export const regenerateScene = action({
  args: {
    episodeId: v.id("episodes"),
    sceneIndex: v.number(),
  },
  returns: v.object({ imageUrl: v.string() }),
  handler: async (ctx, args) => {
    const apiKey = process.env.VENICE_API_KEY;
    if (!apiKey) throw new Error("VENICE_API_KEY is not configured");

    const episode = await ctx.runQuery(internal.catalog.getEpisodeScenes, { episodeId: args.episodeId });
    if (!episode) throw new Error("Episode not found");
    if (args.sceneIndex >= episode.scenes.length) {
      throw new Error("Scene index out of range");
    }

    const scene = episode.scenes[args.sceneIndex];
    const prompt = buildImagePrompt({
      panoramaPrompt: scene.panoramaPrompt,
      location: scene.location,
      era: scene.era,
    });

    const b64 = await callVeniceImage(apiKey, prompt);

    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let j = 0; j < binary.length; j++) {
      bytes[j] = binary.charCodeAt(j);
    }
    const blob = new Blob([bytes], { type: "image/webp" });
    const storageId = await ctx.storage.store(blob);
    const imageUrl = await ctx.storage.getUrl(storageId);

    if (!imageUrl) throw new Error("Failed to get storage URL for regenerated scene");

    await ctx.runMutation(internal.catalog.saveSceneImage, {
      episodeId: args.episodeId,
      sceneIndex: args.sceneIndex,
      storageId: storageId as unknown as string,
      imageUrl,
    });

    return { imageUrl };
  },
});

// =============================================================================
// INTERNAL QUERIES (used by actions)
// =============================================================================

export const getFigure = internalQuery({
  args: { figureId: v.id("figures") },
  returns: v.union(
    v.object({
      canonicalName: v.string(),
      era: v.string(),
      region: v.string(),
      tier: figureTier,
      tags: v.array(v.string()),
      difficulty: figureTier,
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const figure = await ctx.db.get(args.figureId);
    if (!figure) return null;
    return {
      canonicalName: figure.canonicalName,
      era: figure.era,
      region: figure.region,
      tier: figure.tier,
      tags: figure.tags,
      difficulty: figure.difficulty,
    };
  },
});

export const getEpisodeScenes = internalQuery({
  args: { episodeId: v.id("episodes") },
  returns: v.union(
    v.object({
      scenes: v.array(
        v.object({
          title: v.string(),
          location: v.string(),
          era: v.string(),
          panoramaPrompt: v.string(),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const episode = await ctx.db.get(args.episodeId);
    if (!episode) return null;
    return {
      scenes: episode.scenes.map((s) => ({
        title: s.title,
        location: s.location,
        era: s.era,
        panoramaPrompt: s.panoramaPrompt,
      })),
    };
  },
});
