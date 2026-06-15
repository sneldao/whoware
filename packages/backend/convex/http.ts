import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  pathPrefix: "/api/archive/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const episodeId = pathParts[pathParts.length - 1];
    const identityId = url.searchParams.get("identityId");

    if (!identityId || !episodeId) {
      return new Response(JSON.stringify({ error: "Missing identityId or episodeId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const run = await ctx.runQuery(api.archive.getRun, {
      episodeId: episodeId as any,
      identityId,
    });

    const isUnlocked = await ctx.runQuery(api.paywall.isUnlocked, {
      identityId,
      episodeId: episodeId as any,
    });

    if (run || isUnlocked) {
      return new Response(JSON.stringify({ access: true, episodeId }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        access: false,
        episodeId,
        payment: {
          required: true,
          amount: "1",
          token: "0x41E94EB019C0762f9Bfcf9FB1E58725BfB0e7582",
          chainId: 80002,
          treasury: process.env.PAYWALL_TREASURY_ADDRESS ?? "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
          label: "USDC",
        },
      }),
      {
        status: 402,
        headers: {
          "Content-Type": "application/json",
          "X-Payment-Required": "true",
        },
      },
    );
  }),
});

const AGENTS_CARD = {
  name: "WhoWare Autonomous Studio",
  version: "1.0.0",
  description:
    "Autonomous daily puzzle generation and game management for WhoWare historical guessing game. Orchestrates figure curation, scene writing, difficulty calibration, and on-chain minting.",
  url: "https://whoware.vercel.app/api/agents/card",
  capabilities: [
    {
      name: "pipeline",
      description: "End-to-end autonomous episode generation: curator selects figure → scene writer generates scenes → difficulty calibrator adjusts clues → image generator creates panoramas → marks for review",
      input: { slug: "string", sceneCount: "number (optional, default 5)" },
      output: { episodeId: "string", figureName: "string", scenesGenerated: "number" },
    },
    {
      name: "curator",
      description: "Selects the next historical figure from the catalog based on recency, geographic/temporal diversity, and difficulty tier balance",
      input: {}, output: { figureName: "string", reasoning: "string" },
    },
    {
      name: "scene-writer",
      description: "Generates first-person memory scenes (investigation + mercy) for a specific historical figure using Venice AI",
      input: { figureId: "string", slug: "string", sceneCount: "number (optional)" },
      output: { episodeId: "string", scenesGenerated: "number" },
    },
  ],
};

http.route({
  path: "/api/agents/card",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(JSON.stringify(AGENTS_CARD), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }),
});

http.route({
  path: "/api/agents/pipeline",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authHeader = request.headers.get("Authorization");
    const apiKey = process.env.AGENTS_API_KEY;
    if (apiKey && authHeader !== `Bearer ${apiKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: { slug?: string; sceneCount?: number };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!body.slug) {
      return new Response(JSON.stringify({ error: "Missing slug" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const result = await ctx.runAction(api.catalog.autonomousGenerateEpisode, {
        slug: body.slug,
        sceneCount: body.sceneCount,
      });

      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          result,
          id: "1",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32000, message },
          id: "1",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }),
});

http.route({
  path: "/api/agents/curator",
  method: "POST",
  handler: httpAction(async (ctx) => {
    const apiKey = process.env.VENICE_API_KEY;
    const recent = await ctx.runQuery(api.catalog.getRecentEpisodeSummary, {});
    const catalog = await ctx.runQuery(api.catalog.getFullCatalog, {});

    if (catalog.length === 0) {
      return new Response(
        JSON.stringify({ error: "Catalog is empty" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const recentSummary =
      recent.length > 0
        ? recent.map((ep: any) => `- ${ep.figureName ?? ep.slug} (${ep.era}, ${ep.difficulty})`).join("\n")
        : "No recent episodes.";
    const catalogList = catalog
      .map((f: any) => `${f.canonicalName} (${f.era}, ${f.region}, ${f.difficulty})`)
      .join("\n");

    const response = await fetch("https://api.venice.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "venice-uncensored",
        messages: [
          {
            role: "system",
            content:
              "You select historical figures for a guessing game. Respond with JSON: {\"figureName\":\"\",\"reasoning\":\"\"}",
          },
          {
            role: "user",
            content: `Recent:\n${recentSummary}\n\nCatalog:\n${catalogList}\n\nPick the next figure for variety.`,
          },
        ],
        max_tokens: 1000,
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Venice API error" }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? "";
    const match = content.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : { figureName: "", reasoning: "" };

    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        result: { figureName: parsed.figureName, reasoning: parsed.reasoning },
        id: "1",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }),
});

export default http;
