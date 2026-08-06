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

type PannerLike = {
  panningModel: string;
  positionX: { value: number };
  positionY: { value: number };
  positionZ: { value: number };
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
  createPanner?: () => PannerLike;
  createStereoPanner?: () => { pan: { value: number }; connect: (n: unknown) => void };
  listener?: {
    positionX?: { value: number };
    positionY?: { value: number };
    positionZ?: { value: number };
    forwardX?: { value: number };
    forwardY?: { value: number };
    forwardZ?: { value: number };
  };
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

/** Era-specific ambient bed configurations. */
interface EraProfile {
  drones: Array<{ freq: number; type: string; gain: number }>;
  noiseFilter: number;
  noiseGain: number;
  foley?: { freq: number; type: string; gain: number; intervalMs: number };
}

const ERA_PROFILES: Record<string, EraProfile> = {
  ancient: {
    drones: [
      { freq: 41, type: "sine", gain: 0.6 },
      { freq: 62, type: "triangle", gain: 0.2 },
      { freq: 82, type: "sine", gain: 0.15 },
    ],
    noiseFilter: 320,
    noiseGain: 0.14,
    foley: { freq: 120, type: "sine", gain: 0.06, intervalMs: 4000 },
  },
  medieval: {
    drones: [
      { freq: 48, type: "sine", gain: 0.55 },
      { freq: 73, type: "triangle", gain: 0.22 },
      { freq: 98, type: "sine", gain: 0.14 },
    ],
    noiseFilter: 380,
    noiseGain: 0.16,
    foley: { freq: 200, type: "triangle", gain: 0.05, intervalMs: 3500 },
  },
  industrial: {
    drones: [
      { freq: 55, type: "sawtooth", gain: 0.35 },
      { freq: 82, type: "square", gain: 0.12 },
      { freq: 110, type: "sine", gain: 0.1 },
    ],
    noiseFilter: 600,
    noiseGain: 0.22,
    foley: { freq: 80, type: "square", gain: 0.08, intervalMs: 2500 },
  },
  modern: {
    drones: [
      { freq: 60, type: "sine", gain: 0.5 },
      { freq: 90, type: "triangle", gain: 0.18 },
      { freq: 120, type: "sine", gain: 0.1 },
    ],
    noiseFilter: 500,
    noiseGain: 0.18,
    foley: { freq: 150, type: "sine", gain: 0.04, intervalMs: 5000 },
  },
};

const DEFAULT_PROFILE: EraProfile = ERA_PROFILES.modern;

function resolveEraProfile(era: string): EraProfile {
  const e = era.toLowerCase();
  if (e.includes("ancient") || e.includes("bce") || e.includes("egypt") || e.includes("greek") || e.includes("roman")) {
    return ERA_PROFILES.ancient;
  }
  if (e.includes("medieval") || e.includes("century") && (e.includes("5") || e.includes("6") || e.includes("7") || e.includes("8") || e.includes("9") || e.includes("10") || e.includes("11") || e.includes("12") || e.includes("13") || e.includes("14") || e.includes("15"))) {
    return ERA_PROFILES.medieval;
  }
  if (e.includes("industrial") || e.includes("18") || e.includes("19") || e.includes("revolution")) {
    return ERA_PROFILES.industrial;
  }
  if (e.includes("modern") || e.includes("20") || e.includes("21")) {
    return ERA_PROFILES.modern;
  }
  return DEFAULT_PROFILE;
}

let foleyTimer: ReturnType<typeof setInterval> | null = null;

/** Soft room tone — procedural drone + filtered noise + era-specific Foley. Web only. */
export function startAmbientBed(era?: string): void {
  if (soundMuted || Platform.OS !== "web") return;
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  if (ambientRunning) {
    setAmbientLevel(AMBIENT_GAIN, 0.4);
    return;
  }

  const profile = era ? resolveEraProfile(era) : DEFAULT_PROFILE;

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

    for (const d of profile.drones) {
      makeDrone(d.freq, d.type, d.gain);
    }

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
    filter.frequency.value = profile.noiseFilter;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = profile.noiseGain;
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start();
    ambientNodes.push(noise);

    // Era-specific Foley layer — subtle periodic detail (wind chime, clock tick, engine hum)
    if (profile.foley) {
      foleyTimer = setInterval(() => {
        if (soundMuted || !ambientRunning) return;
        try {
          const f = profile.foley!;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = f.type;
          osc.frequency.value = f.freq;
          g.gain.value = f.gain;
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.connect(g);
          g.connect(master);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.5);
        } catch {
          // non-fatal
        }
      }, profile.foley.intervalMs);
    }

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
  if (foleyTimer) {
    clearInterval(foleyTimer);
    foleyTimer = null;
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

/** Play a clue-found tone with positional stereo panning based on the hotspot's x coordinate. */
function playClueFoundAt(xPercent: number): void {
  if (soundMuted) return;
  duckAmbient(450);
  const ctx = getCtx();
  if (!ctx) return;
  try {
    // Map x [0, 100] to pan [-1, 1]
    const pan = Math.max(-1, Math.min(1, (xPercent / 100) * 2 - 1));
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    vol.gain.value = 0.08;
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      osc.connect(vol);
      vol.connect(panner);
      panner.connect(ctx.destination);
    } else {
      osc.connect(vol);
      vol.connect(ctx.destination);
    }
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);

    // Add a second harmonic for richness
    const osc2 = ctx.createOscillator();
    const vol2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.value = 1320;
    vol2.gain.value = 0.04;
    vol2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    if (ctx.createStereoPanner) {
      const panner2 = ctx.createStereoPanner();
      panner2.pan.value = pan;
      osc2.connect(vol2);
      vol2.connect(panner2);
      panner2.connect(ctx.destination);
    } else {
      osc2.connect(vol2);
      vol2.connect(ctx.destination);
    }
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 0.15);
  } catch (e) {
    logger.warn("useGameSounds.clueAt", e);
  }
}

/** Play an episode-specific solve motif — a short ascending arpeggio with a shimmer. */
function playSolveMotif(era: string): void {
  if (soundMuted) return;
  duckAmbient(900);
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const profile = resolveEraProfile(era);
    const baseFreq = profile.drones[0]?.freq ?? 55;
    // Build a pentatonic-ish arpeggio from the base frequency
    const ratios = [1, 1.25, 1.5, 2];
    const notes = ratios.map((r) => baseFreq * r * 4); // shift up for audibility
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      vol.gain.value = 0.09;
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2 * (i + 1) + 0.3);
      osc.connect(vol);
      vol.connect(ctx.destination);
      osc.start(ctx.currentTime + 0.12 * i);
      osc.stop(ctx.currentTime + 0.2 * (i + 1) + 0.3);
    });
    // Shimmer — high frequency tail
    const shimmer = ctx.createOscillator();
    const shimmerVol = ctx.createGain();
    shimmer.type = "triangle";
    shimmer.frequency.value = notes[notes.length - 1] * 2;
    shimmerVol.gain.value = 0.05;
    shimmerVol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    shimmer.connect(shimmerVol);
    shimmerVol.connect(ctx.destination);
    shimmer.start(ctx.currentTime + 0.6);
    shimmer.stop(ctx.currentTime + 1.3);
  } catch (e) {
    logger.warn("useGameSounds.solveMotif", e);
  }
}

export interface GameSounds {
  playClueFound: ToneFn;
  playClueFoundAt: (xPercent: number) => void;
  playCorrectGuess: ToneFn;
  playSolveMotif: (era: string) => void;
  playWrongGuess: ToneFn;
  playSceneEnter: ToneFn;
  startAmbient: (era?: string) => void;
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
      playClueFoundAt,
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
      playSolveMotif,
      playWrongGuess: createTone(220, 0.3, "sawtooth", 0.06),
      playSceneEnter: createTone(440, 0.2, "triangle", 0.06),
      startAmbient: startAmbientBed,
      stopAmbient: stopAmbientBed,
    };
  }

  return {
    playClueFound: useCallback(() => soundsRef.current?.playClueFound(), []),
    playClueFoundAt: useCallback((x: number) => soundsRef.current?.playClueFoundAt(x), []),
    playCorrectGuess: useCallback(() => soundsRef.current?.playCorrectGuess(), []),
    playSolveMotif: useCallback((era: string) => soundsRef.current?.playSolveMotif(era), []),
    playWrongGuess: useCallback(() => soundsRef.current?.playWrongGuess(), []),
    playSceneEnter: useCallback(() => soundsRef.current?.playSceneEnter(), []),
    startAmbient: useCallback((era?: string) => soundsRef.current?.startAmbient(era), []),
    stopAmbient: useCallback(() => soundsRef.current?.stopAmbient(), []),
    muted,
  };
}
