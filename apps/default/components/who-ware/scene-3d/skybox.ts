import * as THREE from "three";

/**
 * Equirectangular skybox — a sphere mesh with the panorama image mapped
 * onto the inside surface. The camera sits at the center (origin), so
 * the player feels like they're inside the scene.
 *
 * The panorama image is the same one the 2D renderer uses (no extra
 * generation cost). ENHANCEMENT FIRST: the existing AI pipeline stays
 * unchanged; we just consume its output through a new lens.
 */

export interface SkyboxOptions {
  /** Radius of the inner sphere. Large enough to feel like infinite distance. */
  radius?: number;
  /** Width / height segments. Lower = cheaper. */
  segments?: number;
}

export function buildSkybox(
  texture: THREE.Texture,
  options: SkyboxOptions = {},
): THREE.Mesh {
  const radius = options.radius ?? 500;
  const segments = options.segments ?? 60;

  const geometry = new THREE.SphereGeometry(radius, segments, segments);

  // Render the inside of the sphere so the player sees the image from within.
  geometry.scale(-1, 1, 1);

  // Equirectangular projection: the default UV layout of a Three.js
  // SphereGeometry matches the equirectangular layout used by the AI
  // image generator, so no UV remapping is required here.
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    depthWrite: false,
    depthTest: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "Skybox";
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}

/**
 * Load a panorama image URL into a Three.js Texture.
 *
 * Uses a one-shot loader so the texture is ready before the first frame
 * is rendered — no flash of un-textured sphere. CORS must allow the
 * origin (Convex storage URLs do; S3 / arbitrary CDN may need headers).
 */
export function loadPanoramaTexture(
  url: string,
  loader: THREE.TextureLoader = new THREE.TextureLoader(),
): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
        resolve(texture);
      },
      undefined,
      (err) => reject(err instanceof Error ? err : new Error(String(err))),
    );
  });
}

/**
 * Convert a hotspot's screen-space (x, y) — as a percentage of the
 * equirectangular image — into a world-space position on the inner
 * surface of the skybox.
 *
 * x in [0, 100] → longitude in [-π, π]
 * y in [0, 100] → latitude   in [ π/2, -π/2]  (top-to-bottom)
 *
 * This is the same math used by any 360° panorama viewer; the scene
 * stays aligned with the 2D renderer's hotspot positions.
 */
export function hotspotWorldPosition(
  xPct: number,
  yPct: number,
  radius: number,
): THREE.Vector3 {
  const longitude = (xPct / 100) * Math.PI * 2;
  const latitude = (0.5 - yPct / 100) * Math.PI;
  const x = -radius * Math.cos(latitude) * Math.sin(longitude);
  const y = radius * Math.sin(latitude);
  const z = -radius * Math.cos(latitude) * Math.cos(longitude);
  return new THREE.Vector3(x, y, z);
}