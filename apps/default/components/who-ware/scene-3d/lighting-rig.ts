import * as THREE from "three";

import type { SceneLighting } from "@/components/who-ware/panorama-scene";

/**
 * Era-aware lighting rig.
 *
 * Per CLEAN, this module is a pure builder: it takes the AI's
 * SceneLighting (or a fallback) and returns a Group containing the
 * configured lights. The SceneCanvas owns the scene graph; we
 * don't mutate global state.
 *
 * Defaults when the AI doesn't supply a lighting block: warm key +
 * cool fill at modest intensities. These values come from the
 * standard "cinematic" three-point setup referenced in the
 * threejs-aaa-graphics-builder skill.
 */

const DEFAULT_LIGHTING: Required<Omit<SceneLighting, "fillColor" | "fillIntensity">> & {
  fillColor: string;
  fillIntensity: number;
} = {
  ambient: 0.4,
  keyColor: "#FFE4B5",
  keyIntensity: 1.2,
  fillColor: "#7DA3C4",
  fillIntensity: 0.5,
};

export interface LightingRig {
  group: THREE.Group;
  /** Update ambient/key/fill on the existing rig without re-creating it. */
  apply: (lighting?: SceneLighting) => void;
  dispose: () => void;
}

export function buildLightingRig(initial?: SceneLighting): LightingRig {
  const group = new THREE.Group();
  group.name = "LightingRig";

  const ambient = new THREE.AmbientLight(0xffffff, DEFAULT_LIGHTING.ambient);
  group.add(ambient);

  const key = new THREE.DirectionalLight(
    new THREE.Color(DEFAULT_LIGHTING.keyColor),
    DEFAULT_LIGHTING.keyIntensity,
  );
  key.position.set(5, 6, 4);
  key.name = "KeyLight";
  group.add(key);

  const fill = new THREE.DirectionalLight(
    new THREE.Color(DEFAULT_LIGHTING.fillColor),
    DEFAULT_LIGHTING.fillIntensity,
  );
  fill.position.set(-5, 3, -2);
  fill.name = "FillLight";
  group.add(fill);

  const apply = (lighting?: SceneLighting) => {
    const next = lighting
      ? { ...DEFAULT_LIGHTING, ...lighting }
      : DEFAULT_LIGHTING;
    ambient.intensity = next.ambient;
    key.color.set(next.keyColor);
    key.intensity = next.keyIntensity;
    if (next.fillColor) fill.color.set(next.fillColor);
    if (typeof next.fillIntensity === "number") fill.intensity = next.fillIntensity;
  };

  apply(initial);

  return {
    group,
    apply,
    dispose: () => {
      group.removeFromParent();
    },
  };
}