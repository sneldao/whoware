import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { logger } from "@/lib/logger";

type ToneFn = () => void;

function createTone(frequency: number, duration: number, type: OscillatorType = "sine", gain = 0.12): ToneFn {
  return () => {
    if (Platform.OS === "web" && typeof window !== "undefined" && "AudioContext" in window) {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const vol = ctx.createGain();
        osc.type = type;
        osc.frequency.value = frequency;
        vol.gain.value = gain;
        vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(vol);
        vol.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
        setTimeout(() => ctx.close(), (duration + 0.1) * 1000);
      } catch (e) {
        logger.warn("useGameSounds.tone", e);
        // AudioContext unavailable or blocked
      }
    }
  };
}

export interface GameSounds {
  playClueFound: ToneFn;
  playCorrectGuess: ToneFn;
  playWrongGuess: ToneFn;
  playSceneEnter: ToneFn;
}

export function useGameSounds(): GameSounds {
  const soundsRef = useRef<GameSounds | null>(null);

  if (!soundsRef.current) {
    soundsRef.current = {
      playClueFound: createTone(880, 0.15, "sine", 0.08),
      playCorrectGuess: () => {
        const ctx = typeof window !== "undefined" && "AudioContext" in window ? new AudioContext() : null;
        if (!ctx) return;
        try {
          const notes = [523, 659, 784];
          notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const vol = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            vol.gain.value = 0.1;
            vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15 * (i + 1) + 0.2);
            osc.connect(vol);
            vol.connect(ctx.destination);
            osc.start(ctx.currentTime + 0.15 * i);
            osc.stop(ctx.currentTime + 0.15 * (i + 1) + 0.2);
          });
          setTimeout(() => ctx.close(), 1000);
        } catch (e) {
          logger.warn("useGameSounds.playCorrectGuess", e);
          // ignored
        }
      },
      playWrongGuess: createTone(220, 0.3, "sawtooth", 0.06),
      playSceneEnter: createTone(440, 0.2, "triangle", 0.06),
    };
  }

  const cleanup = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    return () => {
      if (cleanup.current) clearTimeout(cleanup.current);
    };
  }, []);

  return {
    playClueFound: useCallback(() => soundsRef.current?.playClueFound(), []),
    playCorrectGuess: useCallback(() => soundsRef.current?.playCorrectGuess(), []),
    playWrongGuess: useCallback(() => soundsRef.current?.playWrongGuess(), []),
    playSceneEnter: useCallback(() => soundsRef.current?.playSceneEnter(), []),
  };
}
