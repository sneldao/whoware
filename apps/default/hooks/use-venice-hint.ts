import { useAction, useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { logger } from "@/lib/logger";

export type HintTier = "socratic" | "era" | "proximity";

interface HintRequest {
  sceneAmbientText: string;
  clueLabel: string;
  sceneLocation: string;
  sceneEra: string;
  episodeId?: Id<"episodes">;
  tier?: HintTier;
}

const hintCache = new Map<string, string>();

export function useVeniceHint() {
  const generateHint = useAction(api.venice.generateHint);
  const useHintMutation = useMutation(api.runs.useHint);
  const [isGenerating, setIsGenerating] = useState(false);

  const getHint = useCallback(
    async (request: HintRequest): Promise<string> => {
      const tier = request.tier ?? "socratic";
      const cacheKey = `${request.clueLabel}:${request.sceneLocation}:${tier}`;

      const cached = hintCache.get(cacheKey);
      if (cached) return cached;

      setIsGenerating(true);
      try {
        const hint = await generateHint({
          sceneAmbientText: request.sceneAmbientText,
          clueLabel: request.clueLabel,
          sceneLocation: request.sceneLocation,
          sceneEra: request.sceneEra,
          episodeId: request.episodeId,
          tier: request.tier,
        });
        hintCache.set(cacheKey, hint);
        return hint;
      } catch (e) {
        logger.warn("useVeniceHint.getHint", e);
        return "The memory resists probing.";
      } finally {
        setIsGenerating(false);
      }
    },
    [generateHint],
  );

  /** Record hint usage on the backend so the score penalty is applied. */
  const recordHintUsage = useCallback(
    async (runId: Id<"playerRuns"> | undefined) => {
      if (!runId) return;
      try {
        await useHintMutation({ runId });
      } catch (e) {
        logger.warn("useVeniceHint.recordHintUsage", e);
      }
    },
    [useHintMutation],
  );

  return { getHint, isGenerating, recordHintUsage };
}
