import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { logger } from "@/lib/logger";
import { getSoundEnabled } from "@/lib/onboarding";

type ToneFn = () => void;

// Minimal audio surface — avoid depending on DOM lib in RN tsconfig.
type GainNodeLike = {
  gain: {
    value: number;
    setValueAtTime: (v: number, t: number) => void;
    linearRampToValueAtTime: (v: number, t: number) => void;
    exponentialRampToValueAtTime: (v: number, t: number) => void;
    cancelScheduledValues?: (t: number) => void;
  };
  connect: (n: unknown) => void;
};

type OscillatorLike = {
  type: string;
  frequency: { value: number };
  connect: (n: unknown) => void;
  start: (when?: number) => void;
  stop: (when?: number) => void;
};

type BufferSourceLike = {
  buffer: unknown;
  loop: boolean;
  connect: (n: unknown) => void;
  start: (when?: number) => void;
  stop: (when?: number) => void;
};

type FilterLike = {
  type: string;
  frequency: { value: number };
  connect: (n: unknown) => void;
};

type MinimalAudioCtx = {
  state: string;
  currentTime: number;
  sampleRate: number;
  resume: () => Promise<void>;
  createOscillator: () => OscillatorLike;
  createGain: () => GainNodeLike;
  createBuffer: (channels: number, length: number, sampleRate: number) => {
    getChannelData: (channel: number) => Float32Array;
  };
  createBufferSource: () => BufferSourceLike;
  createBiquadFilter: () => FilterLike;
  destination: unknown;
};

const AMBIENT_GAIN = 0.045;
const AMBIENT_DUCKED = 0.012;

let sharedCtx: MinimalAudioCtx | null = null;
let soundMuted = false;
let ambientGain: GainNodeLike | null = null;
let ambientNodes: Array<{ stop: (when?: number) => void }> = [];
let ambientRunning = false;
let duckTimer: ReturnType<typeof setTimeout> | null = null;

function createAudioContext(): MinimalAudioCtx | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: new () => MinimalAudioCtx;
    webkitAudioContext?: new () => MinimalAudioCtx;
  };
  const AC = w.AudioContext ?? w.webkitAudioContext;
  if (!AC) return null;
  try {
    return new AC();
  } catch {
    return null;
  }
}

function getCtx(): MinimalAudioCtx | null {
  if (!sharedCtx) sharedCtx = createAudioContext();
  return sharedCtx;
}

export function setGameSoundsMuted(muted: boolean) {
  soundMuted = muted;
  if (muted) {
    stopAmbientBed();
  }
}

/** Unlock / prime AudioContext inside a user gesture (Enter with sound). */
export function unlockGameAudio(): void {
  try {
    if (!sharedCtx) sharedCtx = createAudioContext();
    if (sharedCtx?.state === "suspended") {
      void sharedCtx.resume();
    }
  } catch (e) {
    logger.warn("useGameSounds.unlock", e);
  }
}

function setAmbientLevel(level: number, rampSec = 0.35) {
  if (!ambientGain) return;
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  try {
    ambientGain.gain.cancelScheduledValues?.(now);
  } catch {
    // cancelScheduledValues may be missing on stub
  }
  ambientGain.gain.setValueAtTime(ambientGain.gain.value, now);
  ambientGain.gain.linearRampToValueAtTime(level, now + rampSec);
}

/** Duck ambient under a short SFX, then restore. */
export function duckAmbient(ms = 420): void {
  if (soundMuted || !ambientRunning || !ambientGain) return;
  setAmbientLevel(AMBIENT_DUCKED, 0.08);
  if (duckTimer) clearTimeout(duckTimer);
  duckTimer = setTimeout(() => {
    if (!soundMuted && ambientRunning) setAmbientLevel(AMBIENT_GAIN, 0.55);
  }, ms);
}

/** Soft room tone — procedural drone + filtered noise. Web only. */
export function startAmbientBed(): void {
  if (soundMuted || Platform.OS !== "web") return;
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  if (ambientRunning) {
    setAmbientLevel(AMBIENT_GAIN, 0.4);
    return;
  }

  try {
    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);
    ambientGain = master;

    const makeDrone = (freq: number, type: string, gain: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.value = gain;
      osc.connect(g);
      g.connect(master);
      osc.start();
      ambientNodes.push(osc);
    };

    makeDrone(55, "sine", 0.55);
    makeDrone(82.5, "triangle", 0.22);
    makeDrone(110, "sine", 0.12);

    // Soft noise bed through a low-pass.
    const seconds = 2;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.35;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.18;
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start();
    ambientNodes.push(noise);

    ambientRunning = true;
    setAmbientLevel(AMBIENT_GAIN, 1.2);
  } catch (e) {
    logger.warn("useGameSounds.startAmbient", e);
    stopAmbientBed();
  }
}

export function stopAmbientBed(): void {
  if (duckTimer) {
    clearTimeout(duckTimer);
    duckTimer = null;
  }
  const ctx = getCtx();
  try {
    if (ambientGain && ctx) {
      ambientGain.gain.setValueAtTime(ambientGain.gain.value, ctx.currentTime);
      ambientGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    }
  } catch {
    // ignore
  }
  const nodes = ambientNodes;
  ambientNodes = [];
  ambientRunning = false;
  ambientGain = null;
  // Stop sources after fade.
  setTimeout(() => {
    for (const n of nodes) {
      try {
        n.stop();
      } catch {
        // already stopped
      }
    }
  }, 300);
}

function createTone(frequency: number, duration: number, type: string = "sine", gain = 0.12): ToneFn {
  return () => {
    if (soundMuted) return;
    duckAmbient(Math.round(duration * 1000) + 280);
    const ctx = getCtx();
    if (!ctx) return;
    try {
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
    } catch (e) {
      logger.warn("useGameSounds.tone", e);
    }
  };
}

export interface GameSounds {
  playClueFound: ToneFn;
  playCorrectGuess: ToneFn;
  playWrongGuess: ToneFn;
  playSceneEnter: ToneFn;
  startAmbient: () => void;
  stopAmbient: () => void;
  muted: boolean;
}

export function useGameSounds(): GameSounds {
  const [muted, setMuted] = useState(soundMuted);
  const soundsRef = useRef<Omit<GameSounds, "muted"> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSoundEnabled().then((enabled) => {
      if (cancelled) return;
      soundMuted = !enabled;
      setMuted(!enabled);
      if (!enabled) stopAmbientBed();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!soundsRef.current) {
    soundsRef.current = {
      playClueFound: createTone(880, 0.15, "sine", 0.08),
      playCorrectGuess: () => {
        if (soundMuted) return;
        duckAmbient(700);
        const ctx = getCtx();
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
        } catch (e) {
          logger.warn("useGameSounds.playCorrectGuess", e);
        }
      },
      playWrongGuess: createTone(220, 0.3, "sawtooth", 0.06),
      playSceneEnter: createTone(440, 0.2, "triangle", 0.06),
      startAmbient: startAmbientBed,
      stopAmbient: stopAmbientBed,
    };
  }

  return {
    playClueFound: useCallback(() => soundsRef.current?.playClueFound(), []),
    playCorrectGuess: useCallback(() => soundsRef.current?.playCorrectGuess(), []),
    playWrongGuess: useCallback(() => soundsRef.current?.playWrongGuess(), []),
    playSceneEnter: useCallback(() => soundsRef.current?.playSceneEnter(), []),
    startAmbient: useCallback(() => soundsRef.current?.startAmbient(), []),
    stopAmbient: useCallback(() => soundsRef.current?.stopAmbient(), []),
    muted,
  };
}
