/**
 * Renderer capability detection.
 *
 * Decides whether the scene should run in 3D (WebGL2 skybox / props) or fall
 * back to the static 2D panorama. Web-only at this stage; native keeps the
 * 2D path until expo-three / expo-gl performance is verified.
 *
 * Single source of truth for "what does this client support". Used by
 * MemoryScene to pick its renderer branch.
 *
 * Hooks for the future:
 * - User explicit override (settings panel)
 * - FPS-based adaptive downgrade (Phase 5)
 * - Per-scene quality hint (Phase 2)
 */

export type SceneMode = "three-d" | "panorama";

export type SceneQualityReason =
  | "ok"
  | "no-window"
  | "no-webgl2"
  | "no-webgl"
  | "low-power-gpu"
  | "user-opted-out"
  | "mobile-platform"
  | "explicit-three-d-override"
  | "explicit-panorama-override";

export interface SceneQualityResult {
  mode: SceneMode;
  reason: SceneQualityReason;
  /** True when the renderer can attempt the 3D path. Used for telemetry. */
  attempted3D: boolean;
}

const STORAGE_KEY = "whoware.scene-mode";

/** GPU strings known to be low-power or unreliable for WebGL2 features. */
const LOW_POWER_GPU_PATTERNS = [
  /SwiftShader/i,
  /llvmpipe/i,
  /Software/i,
  /Mesa OffScreen/i,
] as const;

function readStoredOverride(): SceneMode | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === "three-d" || value === "panorama") return value;
    return null;
  } catch {
    return null;
  }
}

function detectWebGL2(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const ctx =
      canvas.getContext("webgl2") ||
      // Some browsers expose WebGL2 only via the upgrade path.
      canvas.getContext("experimental-webgl2");
    return Boolean(ctx);
  } catch {
    return false;
  }
}

function readGpuRenderer(): string {
  if (typeof window === "undefined") return "";
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") as WebGLRenderingContext | null;
    if (!gl) return "";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) return "";
    const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    return typeof renderer === "string" ? renderer : "";
  } catch {
    return "";
  }
}

function isLowPowerGpu(renderer: string): boolean {
  return LOW_POWER_GPU_PATTERNS.some((p) => p.test(renderer));
}

/**
 * Returns the renderer mode for this client. Pure function over current
 * environment — no side effects, safe to call inside React render.
 *
 * Phase 0: defaults to "panorama" so existing behaviour is preserved
 * end-to-end. Phase 1 will flip the default to "three-d" once the
 * skybox implementation lands in SceneCanvas.
 *
 * Resolution order (first match wins):
 * 1. User stored override ("three-d" / "panorama")
 * 2. Server is not web → "panorama"
 * 3. No WebGL2 support → "panorama"
 * 4. Low-power GPU detected → "panorama"
 * 5. Default → "panorama" (Phase 0)
 */
export function detectSceneQuality(): SceneQualityResult {
  if (typeof window === "undefined") {
    return { mode: "panorama", reason: "no-window", attempted3D: false };
  }

  const override = readStoredOverride();
  if (override === "three-d") {
    return { mode: "three-d", reason: "explicit-three-d-override", attempted3D: false };
  }
  if (override === "panorama") {
    return { mode: "panorama", reason: "explicit-panorama-override", attempted3D: false };
  }

  if (!detectWebGL2()) {
    return { mode: "panorama", reason: "no-webgl2", attempted3D: false };
  }

  const renderer = readGpuRenderer();
  if (isLowPowerGpu(renderer)) {
    return { mode: "panorama", reason: "low-power-gpu", attempted3D: false };
  }

  return { mode: "panorama", reason: "ok", attempted3D: false };
}

/** Persist a user-chosen renderer override. Called from a future settings UI. */
export function setStoredSceneMode(mode: SceneMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Ignore quota / privacy mode failures; setting is best-effort.
  }
}

export function clearStoredSceneMode(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}