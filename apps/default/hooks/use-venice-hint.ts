import { useAction } from "convex/react";
import { useCallback, useState } from "react";
import { api } from "@/convex/_generated/api";
import { logger } from "@/lib/logger";

interface HintRequest {
  sceneAmbientText: string;
  clueLabel: string;
  sceneLocation: string;
  sceneEra: string;
}

const hintCache = new Map<string, string>();

export function useVeniceHint() {
  const generateHint = useAction(api.venice.generateHint);
  const [isGenerating, setIsGenerating] = useState(false);

  const getHint = useCallback(
    async (request: HintRequest): Promise<string> => {
      const cacheKey = `${request.clueLabel}:${request.sceneLocation}`;

      const cached = hintCache.get(cacheKey);
      if (cached) return cached;

      setIsGenerating(true);
      try {
        const hint = await generateHint(request);
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

  return { getHint, isGenerating };
}
