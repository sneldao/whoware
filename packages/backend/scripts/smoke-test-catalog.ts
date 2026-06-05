import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

const CONVEX_URL = process.env.CONVEX_URL;
if (!CONVEX_URL) {
  console.error("Error: CONVEX_URL environment variable is required");
  console.error("Example: CONVEX_URL=https://your-deployment.convex.cloud bun run smoke:test");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

async function smokeTest() {
  console.log("🔬 WhoWare Catalog Pipeline Smoke Test\n");
  console.log(`Convex URL: ${CONVEX_URL}\n`);

  try {
    // Step 1: Stage a test figure
    console.log("1️⃣  Staging test figure...");
    const figureResult = await client.mutation(api.catalog.stageFigure, {
      canonicalName: "Smoke Test Figure",
      aliases: ["STF", "Test Figure"],
      era: "20th century",
      region: "Test Region",
      tier: "iconic",
      tags: ["test", "smoke"],
      difficulty: "iconic",
    });
    console.log(`   ✓ Figure staged (id: ${figureResult.figureId}, new: ${figureResult.isNew})\n`);

    // Step 2: Check staging queue
    console.log("2️⃣  Checking staging queue...");
    const queue = await client.query(api.catalog.getStagingQueue, {});
    console.log(`   ✓ Staging queue has ${queue.length} episode(s)\n`);

    // Step 3: Generate episode (this will call Venice AI)
    console.log("3️⃣  Generating episode with Venice AI (this may take 2-3 minutes)...");
    const startTime = Date.now();
    const episodeResult = await client.action(api.catalog.generateEpisode, {
      figureId: figureResult.figureId,
      slug: `smoke-test-${Date.now()}`,
      sceneCount: 3, // Fewer scenes for faster testing
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   ✓ Episode generated (id: ${episodeResult.episodeId}, scenes: ${episodeResult.scenesGenerated})`);
    console.log(`   ✓ Time: ${elapsed}s\n`);

    // Step 4: Verify episode is in review status
    console.log("4️⃣  Verifying episode status...");
    const updatedQueue = await client.query(api.catalog.getStagingQueue, {});
    const episode = updatedQueue.find(ep => ep._id === episodeResult.episodeId);
    if (!episode) {
      throw new Error("Generated episode not found in staging queue");
    }
    console.log(`   ✓ Episode status: ${episode.status}`);
    console.log(`   ✓ Scenes: ${episode.sceneCount}, Images ready: ${episode.imagesReady}\n`);

    // Step 5: Approve episode
    console.log("5️⃣  Approving episode...");
    await client.mutation(api.catalog.approveEpisode, {
      episodeId: episodeResult.episodeId,
    });
    console.log("   ✓ Episode approved and moved to draft\n");

    // Step 6: Verify episode is no longer in staging queue
    console.log("6️⃣  Verifying episode moved out of staging...");
    const finalQueue = await client.query(api.catalog.getStagingQueue, {});
    const stillInQueue = finalQueue.find(ep => ep._id === episodeResult.episodeId);
    if (stillInQueue) {
      throw new Error("Episode still in staging queue after approval");
    }
    console.log("   ✓ Episode removed from staging queue\n");

    console.log("✅ Smoke test passed!\n");
    console.log("Summary:");
    console.log(`  - Figure: ${figureResult.figureId}`);
    console.log(`  - Episode: ${episodeResult.episodeId}`);
    console.log(`  - Scenes: ${episodeResult.scenesGenerated}`);
    console.log(`  - Status: draft (approved)`);

  } catch (error) {
    console.error("\n❌ Smoke test failed:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

smokeTest();
