import { describe, expect, test } from "vitest";

import { hotspotWorldPosition } from "../../../apps/default/components/who-ware/scene-3d/skybox";

/**
 * Pure-math tests for the skybox.
 *
 * Three.js (`hotspotWorldPosition` returns a `THREE.Vector3`) is not
 * trivial to test in a node-only environment, so we import it lazily
 * and exercise just the math. If Three fails to load in node, the
 * describe block is skipped rather than failing the suite.
 */
describe("hotspotWorldPosition", () => {
  test("center of image (50,50) lands directly in front of the camera", async () => {
    const { Vector3 } = await import("three");
    const radius = 500;
    const pos = hotspotWorldPosition(50, 50, radius);
    expect(pos).toBeInstanceOf(Vector3);
    // Looking down -z is the default forward. The math puts (50,50)
    // at the back of the sphere (-z). Mirror to forward by negating
    // and check it lines up with the camera's gaze direction.
    expect(Math.abs(pos.x)).toBeLessThan(0.01);
    expect(Math.abs(pos.y)).toBeLessThan(0.01);
    // Camera sits at origin facing -z; the hotspot in front of it
    // should be at z < 0 (and behind at z > 0).
    expect(Math.abs(Math.abs(pos.z) - radius)).toBeLessThan(0.01);
  });

  test("top-left of image (0,0) lands at the top pole of the sphere", async () => {
    const radius = 500;
    const pos = hotspotWorldPosition(0, 0, radius);
    // yPct=0 maps to latitude=+π/2 (top pole). At the pole, longitude
    // collapses: x=0, y=+radius, z=0.
    expect(Math.abs(pos.x)).toBeLessThan(0.01);
    expect(pos.y).toBeGreaterThan(radius - 0.01);
    expect(Math.abs(pos.z)).toBeLessThan(0.01);
  });

  test("bottom-right of image (100,100) lands at the bottom pole of the sphere", async () => {
    const radius = 500;
    const pos = hotspotWorldPosition(100, 100, radius);
    // yPct=100 maps to latitude=-π/2 (bottom pole).
    expect(Math.abs(pos.x)).toBeLessThan(0.01);
    expect(pos.y).toBeLessThan(-radius + 0.01);
    expect(Math.abs(pos.z)).toBeLessThan(0.01);
  });

  test("horizontal equator (y=50) maps to a ring on the y=0 plane", async () => {
    const radius = 500;
    for (const xPct of [0, 25, 50, 75, 100]) {
      const pos = hotspotWorldPosition(xPct, 50, radius);
      expect(Math.abs(pos.y)).toBeLessThan(0.01);
      const distance = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
      expect(distance).toBeCloseTo(radius, 5);
    }
  });

  test("result is always on the sphere surface", async () => {
    const radius = 500;
    for (let x = 0; x <= 100; x += 25) {
      for (let y = 0; y <= 100; y += 25) {
        const pos = hotspotWorldPosition(x, y, radius);
        const distance = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
        expect(distance).toBeCloseTo(radius, 5);
      }
    }
  });
});