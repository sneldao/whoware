import { useCallback, useEffect, useState } from "react";

/**
 * Tracks per-run client-side discoveries that haven't yet been
 * mirrored to the server: hotspots the player opened and the clues
 * they revealed. Used to populate the ClueLedger before the next
 * server sync.
 */
export interface DiscoveredClue {
  sceneIndex: number;
  sceneTitle: string;
  label: string;
  detail: string;
}

export interface UseLocalDiscoveryReturn {
  localHotspots: string[];
  discoveredClues: DiscoveredClue[];
  recordHotspot: (key: string) => void;
  recordClue: (clue: DiscoveredClue) => boolean;
  reset: () => void;
}

export function useLocalDiscovery(episodeId: string | undefined, identityId: string | undefined): UseLocalDiscoveryReturn {
  const [localHotspots, setLocalHotspots] = useState<string[]>([]);
  const [discoveredClues, setDiscoveredClues] = useState<DiscoveredClue[]>([]);

  useEffect(() => {
    setLocalHotspots([]);
    setDiscoveredClues([]);
  }, [episodeId, identityId]);

  const recordHotspot = useCallback((key: string) => {
    setLocalHotspots((current) => (current.includes(key) ? current : [...current, key]));
  }, []);

  const recordClue = useCallback((clue: DiscoveredClue): boolean => {
    let added = false;
    setDiscoveredClues((current) => {
      if (current.some((d) => d.sceneIndex === clue.sceneIndex && d.label === clue.label)) {
        return current;
      }
      added = true;
      return [...current, clue];
    });
    return added;
  }, []);

  const reset = useCallback(() => {
    setLocalHotspots([]);
    setDiscoveredClues([]);
  }, []);

  return { localHotspots, discoveredClues, recordHotspot, recordClue, reset };
}
