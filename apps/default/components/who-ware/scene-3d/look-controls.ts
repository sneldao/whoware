import * as THREE from "three";

/**
 * Look controls — drag to rotate the camera.
 *
 * Pointer-driven (works for mouse, touch, pen) so RN-Web's
 * `onPointerDown` / `onPointerMove` route through cleanly without
 * pulling in the full gesture-handler stack. Per CONSOLIDATION we
 * avoid OrbitControls (which would add another ~10kb of three/addons
 * code we don't need — first-person look doesn't want orbit math).
 */

export interface LookState {
  yaw: number;
  pitch: number;
}

export interface LookBounds {
  /** Pitch clamp in radians. Default: ±70° so the player can't look straight up/down. */
  maxPitch: number;
}

export function clampPitch(pitch: number, maxPitch: number): number {
  return Math.max(-maxPitch, Math.min(maxPitch, pitch));
}

export function applyLook(camera: THREE.PerspectiveCamera, state: LookState): void {
  camera.rotation.order = "YXZ";
  camera.rotation.y = state.yaw;
  camera.rotation.x = state.pitch;
  camera.rotation.z = 0;
}

export interface LookInput {
  canvas: HTMLCanvasElement;
  /** Pixels per radian. Higher = slower look. Default 600. */
  sensitivity?: number;
  bounds?: LookBounds;
  onChange?: (state: LookState) => void;
}

export interface LookControlsHandle {
  state: () => LookState;
  dispose: () => void;
}

/**
 * Attach pointer drag handlers that translate pixel deltas into yaw/pitch
 * deltas. Returns a handle the caller can read or dispose.
 */
export function attachLookControls(input: LookInput): LookControlsHandle {
  const sensitivity = input.sensitivity ?? 600;
  const bounds = input.bounds ?? { maxPitch: Math.PI / 2.6 };

  const state: LookState = { yaw: 0, pitch: 0 };
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const onDown = (ev: PointerEvent) => {
    dragging = true;
    lastX = ev.clientX;
    lastY = ev.clientY;
    input.canvas.setPointerCapture(ev.pointerId);
  };

  const onMove = (ev: PointerEvent) => {
    if (!dragging) return;
    const dx = ev.clientX - lastX;
    const dy = ev.clientY - lastY;
    lastX = ev.clientX;
    lastY = ev.clientY;

    state.yaw -= dx / sensitivity;
    state.pitch = clampPitch(state.pitch - dy / sensitivity, bounds.maxPitch);
    input.onChange?.(state);
  };

  const onUp = (ev: PointerEvent) => {
    dragging = false;
    try {
      input.canvas.releasePointerCapture(ev.pointerId);
    } catch {
      // Pointer may already be released; ignore.
    }
  };

  input.canvas.addEventListener("pointerdown", onDown);
  input.canvas.addEventListener("pointermove", onMove);
  input.canvas.addEventListener("pointerup", onUp);
  input.canvas.addEventListener("pointercancel", onUp);
  input.canvas.addEventListener("pointerleave", onUp);

  return {
    state: () => ({ ...state }),
    dispose: () => {
      input.canvas.removeEventListener("pointerdown", onDown);
      input.canvas.removeEventListener("pointermove", onMove);
      input.canvas.removeEventListener("pointerup", onUp);
      input.canvas.removeEventListener("pointercancel", onUp);
      input.canvas.removeEventListener("pointerleave", onUp);
    },
  };
}