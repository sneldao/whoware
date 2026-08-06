import { useEffect, useState, useCallback } from "react";
import { Animated } from "react-native";
import type { DiscoveredClue } from "@/hooks/use-local-discovery";

export interface ClueInsight {
  id: string;
  clueLabels: string[];
  insight: string;
  sceneIndices: number[];
}

/**
 * The "aha" moment: when the player discovers clues across 2+ different
 * scenes that share a thematic keyword, we surface a synthesized insight
 * that connects them. This transforms clue-finding from passive
 * collection into active cross-referencing — the player starts looking
 * for patterns across memories, not just within them.
 *
 * Insights fire once per unique combination and never repeat.
 */

// Thematic keyword groups — clues from different scenes sharing one of
// these keywords trigger a synthesized insight.
const THEME_GROUPS: Array<{ keywords: string[]; insight: string }> = [
  {
    keywords: ["war", "battle", "military", "army", "soldier", "front", "campaign"],
    insight: "Two memories reference the same conflict. The figure was shaped by war.",
  },
  {
    keywords: ["book", "write", "wrote", "author", "publish", "manuscript", "letter", "diary"],
    insight: "Words appear in multiple rooms. This figure left a written legacy.",
  },
  {
    keywords: ["science", "experiment", "discovery", "theory", "research", "laboratory", "equation"],
    insight: "Scientific threads connect across scenes. The figure changed how we understand the world.",
  },
  {
    keywords: ["politic", "parliament", "congress", "government", "election", "vote", "minister", "office"],
    insight: "Political power surfaces in multiple memories. This figure moved in the halls of governance.",
  },
  {
    keywords: ["art", "paint", "sculpt", "music", "portrait", "gallery", "canvas", "studio"],
    insight: "Artistic references recur across rooms. The figure lived among creators.",
  },
  {
    keywords: ["travel", "voyage", "journey", "ship", "expedition", "abroad", "foreign"],
    insight: "Movement between places links these memories. The figure crossed boundaries.",
  },
  {
    keywords: ["money", "wealth", "fortune", "bank", "trade", "business", "industry", "factory"],
    insight: "Economic threads connect these scenes. The figure operated in commerce or industry.",
  },
  {
    keywords: ["religion", "church", "faith", "god", "temple", "pray", "sacred", "monk"],
    insight: "Spiritual references echo across memories. The figure's path was shaped by faith.",
  },
  {
    keywords: ["revolution", "protest", "reform", "uprising", "resistance", "movement"],
    insight: "Revolutionary currents connect these rooms. The figure stood at a turning point.",
  },
  {
    keywords: ["invent", "patent", "machine", "engine", "design", "device", "innovation"],
    insight: "Invention threads across scenes. The figure built something new.",
  },
  {
    keywords: ["king", "queen", "crown", "royal", "throne", "court", "emperor", "empire"],
    insight: "Royal presence in multiple memories. The figure moved in the circles of power.",
  },
  {
    keywords: ["school", "universit", "study", "learn", "teach", "scholar", "academy", "professor"],
    insight: "Education links these scenes. The figure's ideas were shaped by institutions of learning.",
  },
];

function findThemeOverlap(clues: DiscoveredClue[]): ClueInsight | null {
  if (clues.length < 2) return null;

  // Group clues by scene
  const byScene = new Map<number, DiscoveredClue[]>();
  for (const clue of clues) {
    const existing = byScene.get(clue.sceneIndex) ?? [];
    existing.push(clue);
    byScene.set(clue.sceneIndex, existing);
  }

  // Need at least 2 different scenes
  if (byScene.size < 2) return null;

  // For each theme group, check if clues from 2+ different scenes match
  for (const group of THEME_GROUPS) {
    const matchingScenes = new Set<number>();
    const matchingLabels: string[] = [];
    const matchingSceneIndices: number[] = [];

    for (const [sceneIdx, sceneClues] of byScene) {
      for (const clue of sceneClues) {
        const text = `${clue.label} ${clue.detail}`.toLowerCase();
        const matches = group.keywords.some((kw) => text.includes(kw));
        if (matches) {
          matchingScenes.add(sceneIdx);
          matchingLabels.push(clue.label);
          if (!matchingSceneIndices.includes(sceneIdx)) {
            matchingSceneIndices.push(sceneIdx);
          }
        }
      }
    }

    if (matchingScenes.size >= 2) {
      return {
        id: `${group.insight.slice(0, 20)}-${matchingSceneIndices.join(",")}`,
        clueLabels: Array.from(new Set(matchingLabels)),
        insight: group.insight,
        sceneIndices: matchingSceneIndices,
      };
    }
  }

  return null;
}

export interface UseClueInsightsReturn {
  currentInsight: ClueInsight | null;
  firedInsights: ClueInsight[];
  dismissInsight: () => void;
}

export function useClueInsights(
  discoveredClues: DiscoveredClue[],
): UseClueInsightsReturn {
  const [firedInsights, setFiredInsights] = useState<ClueInsight[]>([]);
  const [currentInsight, setCurrentInsight] = useState<ClueInsight | null>(null);
  const [lastClueCount, setLastClueCount] = useState(0);

  useEffect(() => {
    // Only check when a new clue was added
    if (discoveredClues.length <= lastClueCount) return;
    setLastClueCount(discoveredClues.length);

    const insight = findThemeOverlap(discoveredClues);
    if (!insight) return;

    // Don't fire the same insight twice
    if (firedInsights.some((f) => f.id === insight.id)) return;

    setFiredInsights((prev) => [...prev, insight]);
    setCurrentInsight(insight);
  }, [discoveredClues, lastClueCount, firedInsights]);

  const dismissInsight = useCallback(() => {
    setCurrentInsight(null);
  }, []);

  return { currentInsight, firedInsights, dismissInsight };
}
