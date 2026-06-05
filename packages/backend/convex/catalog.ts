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

export const saveRecalibratedScenes = internalMutation({
  args: {
    episodeId: v.id("episodes"),
    scenes: v.array(sceneBriefShape),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const episode = await ctx.db.get(args.episodeId);
    if (!episode) throw new Error("Episode not found");

    const updated = episode.scenes.map((existing, i) => {
      const recalibrated = args.scenes[i];
      if (!recalibrated) return existing;
      return {
        ...existing,
        clues: recalibrated.clues,
        ambientText: recalibrated.ambientText,
      };
    });

    await ctx.db.patch(args.episodeId, { scenes: updated });
    return null;
  },
});

// =============================================================================
// SELF-EVALUATION (image prompt judge)
// =============================================================================

const EVALUATE_SCENE_SYSTEM_PROMPT = `You are a quality-assurance judge for WhoWare, a historical guessing game.
Evaluate whether an image generation prompt is suitable for a panoramic memory scene.

Check for:
1. Era accuracy — does the prompt describe objects, architecture, and atmosphere consistent with the stated era?
2. Anachronisms — are there any modern objects, technology, or concepts that don't belong?
3. Identity leakage — does the prompt name the historical figure or include readable text with their name?
4. Visual quality — is the prompt detailed enough for image generation?

Respond with a JSON object:
{
  "pass": true or false,
  "issues": ["issue 1", "issue 2"]
}

If the prompt is good, return {"pass": true, "issues": []}.
If there are problems, return {"pass": false, "issues": ["specific problem description"]}.`;

async function evaluateScenePrompt(
  apiKey: string,
  scene: { title: string; location: string; era: string },
  imagePrompt: string,
): Promise<{ pass: boolean; issues: string[] }> {
  const userMessage = `Scene: "${scene.title}"\nLocation: ${scene.location}\nEra: ${scene.era}\n\nImage prompt:\n${imagePrompt}\n\nEvaluate this prompt.`;

  try {
    const raw = await callVeniceChat(apiKey, EVALUATE_SCENE_SYSTEM_PROMPT, userMessage);
    const parsed = parseJsonFromResponse(raw) as { pass?: boolean; issues?: string[] };
    return {
      pass: parsed.pass ?? true,
      issues: Array.isArray(parsed.issues) ? parsed.issues.map(String) : [],
    };
  } catch {
    console.log("Scene evaluation failed — proceeding without quality gate");
    return { pass: true, issues: [] };
  }
}

// =============================================================================
// ADVERSARIAL DIFFICULTY CALIBRATION
// =============================================================================

const CALIBRATION_SOLVER_SYSTEM_PROMPT = `You are a skilled historical detective playing WhoWare.
You will receive a series of memory scenes with clues. WITHOUT knowing the answer, try to identify the historical figure.

For each scene, describe what the clues suggest and how confident you are.
After reviewing all scenes, give your final guess and estimate how many scenes you needed to narrow it down.

Respond with a JSON object:
{
  "guess": "your best guess for the historical figure",
  "confidence": "high" | "medium" | "low",
  "scenesNeeded": 1-7,
  "reasoning": "brief explanation of how the clues led to your guess"
}

Important: you are evaluating clue DIFFICULTY, not trying to win. Be honest about whether the clues are too obvious or too vague.`;

const SUBTLE_REWRITE_SYSTEM_PROMPT = `You are a scene writer for WhoWare, a historical guessing game.
The clues in the current scenes are TOO OBVIOUS — players can guess the figure too quickly.

Rewrite the clues to be more subtle and ambiguous while remaining period-accurate.
Rules:
- NEVER name the figure or use their full name in any clue.
- Clues should hint at the identity, not state it.
- Replace specific names with contextual descriptions (e.g., "a signed treaty" instead of "the Treaty of Versailles").
- Keep clues visually inspectable — they must be things a player could notice in a panoramic scene.

Output a JSON object with the same structure as the input scenes, with updated clue details.`;

const SHARPEN_REWRITE_SYSTEM_PROMPT = `You are a scene writer for WhoWare, a historical guessing game.
The clues in the current scenes are TOO VAGUE — players cannot narrow down the identity even with all clues.

Rewrite the clues to add more specific, identifying contextual detail.
Rules:
- NEVER name the figure or use their full name in any clue.
- Add era-specific objects, documents, or environmental details that narrow the identity.
- Clues should be visually inspectable in a panoramic scene.
- Later scenes should progressively add more identifying context.

Output a JSON object with the same structure as the input scenes, with updated clue details.`;

async function calibrateDifficulty(
  apiKey: string,
  scenes: Array<{ title: string; location: string; era: string; clues: Array<{ label: string; detail: string; x: number; y: number }> }>,
  investigationCount: number,
): Promise<{ guess: string; confidence: string; scenesNeeded: number }> {
  const scenesDescription = scenes
    .filter((_, i) => i < investigationCount)
    .map((s, i) => `Scene ${i + 1}: "${s.title}" (${s.location}, ${s.era})\n  Clues: ${s.clues.map((c) => `${c.label} — ${c.detail}`).join("; ")}`)
    .join("\n\n");

  const userMessage = `Here are the investigation scenes with their clues:\n\n${scenesDescription}\n\nTry to identify the historical figure. How many scenes did you need?`;

  try {
    const raw = await callVeniceChat(apiKey, CALIBRATION_SOLVER_SYSTEM_PROMPT, userMessage);
    const parsed = parseJsonFromResponse(raw) as { guess?: string; confidence?: string; scenesNeeded?: number };
    return {
      guess: String(parsed.guess ?? "Unknown"),
      confidence: String(parsed.confidence ?? "medium"),
      scenesNeeded: Math.max(1, Math.min(investigationCount, Number(parsed.scenesNeeded ?? investigationCount))),
    };
  } catch {
    console.log("Calibration solver failed — proceeding without difficulty adjustment");
    return { guess: "Unknown", confidence: "medium", scenesNeeded: Math.ceil(investigationCount / 2) };
  }
}

async function subtleRewrite(
  apiKey: string,
  scenes: Array<Record<string, unknown>>,
  figure: { canonicalName: string; era: string; region: string },
): Promise<Array<Record<string, unknown>>> {
  const userMessage = `Figure: ${figure.canonicalName} (${figure.era}, ${figure.region})\n\nCurrent scenes:\n${JSON.stringify(scenes, null, 2)}\n\nRewrite the clues to be more subtle.`;

  try {
    const raw = await callVeniceChat(apiKey, SUBTLE_REWRITE_SYSTEM_PROMPT, userMessage);
    const parsed = parseJsonFromResponse(raw) as { scenes?: Array<Record<string, unknown>> };
    return parsed.scenes ?? scenes;
  } catch {
    console.log("Subtle rewrite failed — keeping original clues");
    return scenes;
  }
}

async function sharpenRewrite(
  apiKey: string,
  scenes: Array<Record<string, unknown>>,
  figure: { canonicalName: string; era: string; region: string },
): Promise<Array<Record<string, unknown>>> {
  const userMessage = `Figure: ${figure.canonicalName} (${figure.era}, ${figure.region})\n\nCurrent scenes:\n${JSON.stringify(scenes, null, 2)}\n\nRewrite the clues to be more specific and identifying.`;

  try {
    const raw = await callVeniceChat(apiKey, SHARPEN_REWRITE_SYSTEM_PROMPT, userMessage);
    const parsed = parseJsonFromResponse(raw) as { scenes?: Array<Record<string, unknown>> };
    return parsed.scenes ?? scenes;
  } catch {
    console.log("Sharpen rewrite failed — keeping original clues");
    return scenes;
  }
}

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

    // --- Adversarial difficulty calibration ---
    const MAX_CALIBRATION_ROUNDS = 2;
    let currentScenes = scenes;
    for (let round = 0; round < MAX_CALIBRATION_ROUNDS; round++) {
      const result = await calibrateDifficulty(apiKey, currentScenes, investigationCount);
      console.log(`Calibration round ${round + 1}: guess="${result.guess}", confidence=${result.confidence}, scenesNeeded=${result.scenesNeeded}`);

      if (result.scenesNeeded <= 2 && result.confidence === "high") {
        console.log("Clues too obvious — rewriting to be more subtle");
        const rewritten = await subtleRewrite(
          apiKey,
          currentScenes.map((s) => ({ ...s })),
          figure,
        );
        currentScenes = rewritten.map((s, i) => ({
          ...currentScenes[i],
          clues: Array.isArray(s.clues) ? s.clues as typeof currentScenes[0]["clues"] : currentScenes[i].clues,
          ambientText: typeof s.ambientText === "string" ? s.ambientText : currentScenes[i].ambientText,
        }));
        await ctx.runMutation(internal.catalog.saveRecalibratedScenes, { episodeId, scenes: currentScenes });
      } else if (result.scenesNeeded >= investigationCount && result.confidence !== "high") {
        console.log("Clues too vague — rewriting to be more specific");
        const rewritten = await sharpenRewrite(
          apiKey,
          currentScenes.map((s) => ({ ...s })),
          figure,
        );
        currentScenes = rewritten.map((s, i) => ({
          ...currentScenes[i],
          clues: Array.isArray(s.clues) ? s.clues as typeof currentScenes[0]["clues"] : currentScenes[i].clues,
          ambientText: typeof s.ambientText === "string" ? s.ambientText : currentScenes[i].ambientText,
        }));
        await ctx.runMutation(internal.catalog.saveRecalibratedScenes, { episodeId, scenes: currentScenes });
      } else {
        console.log("Difficulty calibrated — proceeding to image generation");
        break;
      }
    }

    // --- Image generation with self-evaluation ---
    const MAX_EVAL_RETRIES = 2;
    for (let i = 0; i < currentScenes.length; i++) {
      let prompt = buildImagePrompt(currentScenes[i]);

      for (let attempt = 0; attempt <= MAX_EVAL_RETRIES; attempt++) {
        const evaluation = await evaluateScenePrompt(apiKey, currentScenes[i], prompt);
        console.log(`Scene ${i} evaluation (attempt ${attempt + 1}): pass=${evaluation.pass}${evaluation.issues.length ? ", issues: " + evaluation.issues.join("; ") : ""}`);

        if (evaluation.pass || attempt === MAX_EVAL_RETRIES) break;

        prompt = `${prompt} IMPORTANT: Avoid these issues: ${evaluation.issues.join(". ")}.`;
      }

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

    return { episodeId, scenesGenerated: currentScenes.length };
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

export const getRecentEpisodeSummary = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      slug: v.string(),
      era: v.string(),
      region: v.string(),
      difficulty: figureTier,
      figureName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const episodes = await ctx.db
      .query("episodes")
      .withIndex("by_status_and_dropsAt")
      .order("desc")
      .take(7);

    return episodes
      .filter((ep) => ep.figureId)
      .map((ep) => {
        const era = ep.scenes[0]?.era ?? "Unknown";
        const region = "Unknown";
        return {
          slug: ep.slug,
          era,
          region,
          difficulty: ep.difficulty,
          figureName: ep.figureName,
        };
      });
  },
});

export const getFullCatalog = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("figures"),
      canonicalName: v.string(),
      era: v.string(),
      region: v.string(),
      tier: figureTier,
      difficulty: figureTier,
      tags: v.array(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const figures = await ctx.db.query("figures").collect();
    return figures.map((f) => ({
      _id: f._id,
      canonicalName: f.canonicalName,
      era: f.era,
      region: f.region,
      tier: f.tier,
      difficulty: f.difficulty,
      tags: f.tags,
    }));
  },
});

// =============================================================================
// AUTONOMOUS FIGURE SELECTION
// =============================================================================

const CURATOR_SYSTEM_PROMPT = `You are the autonomous curator for WhoWare, a daily history guessing game.
Your job is to select the next historical figure to feature, maximizing variety for players.

Consider:
- Recent episodes (avoid repeating eras, regions, or difficulty tiers in quick succession)
- Balance across iconic (well-known), field (moderately known), and research (obscure) tiers
- Geographic and temporal diversity

Respond with a JSON object:
{
  "figureName": "exact canonical name from the catalog",
  "reasoning": "brief explanation of why this figure maximizes variety"
}

You MUST pick a figure from the provided catalog. Do not invent new figures.`;

export const autonomousGenerateEpisode = action({
  args: {
    slug: v.string(),
    sceneCount: v.optional(v.number()),
  },
  returns: v.object({
    episodeId: v.id("episodes"),
    figureName: v.string(),
    reasoning: v.string(),
    scenesGenerated: v.number(),
  }),
  handler: async (ctx, args) => {
    const apiKey = process.env.VENICE_API_KEY;
    if (!apiKey) throw new Error("VENICE_API_KEY is not configured");

    const recentEpisodes = await ctx.runQuery(internal.catalog.getRecentEpisodeSummary, {});
    const catalog = await ctx.runQuery(internal.catalog.getFullCatalog, {});

    if (catalog.length === 0) {
      throw new Error("Figure catalog is empty — seed the catalog first");
    }

    const recentSummary = recentEpisodes.length > 0
      ? recentEpisodes.map((ep) => `- ${ep.figureName ?? ep.slug} (${ep.era}, ${ep.difficulty})`).join("\n")
      : "No recent episodes.";

    const catalogList = catalog
      .map((f) => `${f.canonicalName} (${f.era}, ${f.region}, ${f.difficulty})`)
      .join("\n");

    const userMessage = `Recent episodes (last ${recentEpisodes.length}):\n${recentSummary}\n\nAvailable figures:\n${catalogList}\n\nSelect the next figure to maximize variety.`;

    let selectedFigureName: string;
    let reasoning: string;

    try {
      const raw = await callVeniceChat(apiKey, CURATOR_SYSTEM_PROMPT, userMessage);
      const parsed = parseJsonFromResponse(raw) as { figureName?: string; reasoning?: string };
      selectedFigureName = String(parsed.figureName ?? "");
      reasoning = String(parsed.reasoning ?? "Autonomous selection");
    } catch {
      console.log("Autonomous figure selection failed — falling back to random");
      const random = catalog[Math.floor(Math.random() * catalog.length)];
      selectedFigureName = random.canonicalName;
      reasoning = "Random fallback (Venice unavailable)";
    }

    const selectedFigure = catalog.find(
      (f) => f.canonicalName.toLowerCase() === selectedFigureName.toLowerCase(),
    );

    if (!selectedFigure) {
      console.log(`Venice selected "${selectedFigureName}" which is not in catalog — falling back to random`);
      const random = catalog[Math.floor(Math.random() * catalog.length)];
      selectedFigureName = random.canonicalName;
      reasoning = "Random fallback (selected figure not found)";
    }

    const figure = catalog.find(
      (f) => f.canonicalName.toLowerCase() === selectedFigureName.toLowerCase(),
    )!;

    console.log(`Autonomous selection: ${figure.canonicalName} — ${reasoning}`);

    const result = await ctx.runAction(api.catalog.generateEpisode, {
      figureId: figure._id,
      slug: args.slug,
      sceneCount: args.sceneCount,
    });

    return {
      episodeId: result.episodeId,
      figureName: figure.canonicalName,
      reasoning,
      scenesGenerated: result.scenesGenerated,
    };
  },
});
