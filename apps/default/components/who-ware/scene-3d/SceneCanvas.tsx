import * as THREE from "three";
import { useEffect, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { theme } from "@/lib/theme";

import type { Scene } from "@/components/who-ware/panorama-scene";
import {
  attachLookControls,
  applyLook,
  type LookState,
} from "@/components/who-ware/scene-3d/look-controls";
import { buildLightingRig } from "@/components/who-ware/scene-3d/lighting-rig";
import { buildPropShape } from "@/components/who-ware/scene-3d/prop-shapes";
import {
  buildSkybox,
  hotspotWorldPosition,
  loadPanoramaTexture,
} from "@/components/who-ware/scene-3d/skybox";
import { getSceneImageSource } from "@/components/who-ware/scene-media";

const SKYBOX_RADIUS = 500;
const SKYBOX_SEGMENTS = 48;

interface SceneCanvasProps {
  scene: Scene;
  sceneIndex: number;
  totalScenes: number;
  height: number;
  onHotspotOpen?: (label: string) => void;
}

/**
 * Three.js scene canvas — renders the panorama image as a skybox
 * sphere the player can look around inside, plus procedural 3D
 * props anchored to the scene brief's prop placements.
 *
 * On web: a real <canvas> driven by a Three.js WebGLRenderer.
 * On native (iOS / Android): the placeholder notice; Phase 4 brings
 * expo-gl + expo-three for native GL.
 */
export function SceneCanvas({
  scene,
  sceneIndex,
  totalScenes,
  height,
  onHotspotOpen,
}: SceneCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  if (Platform.OS !== "web") {
    return (
      <Placeholder
        height={height}
        message="3D scene is web-only in this build."
      />
    );
  }

  return (
    <View style={[styles.frame, { height }]}>
      <View style={styles.headerOverlay}>
        <Text style={styles.counter}>
          Memory {sceneIndex + 1} / {totalScenes}
        </Text>
        <Text style={styles.title}>{scene.title}</Text>
        <Text style={styles.location}>
          {scene.location} · {scene.era}
        </Text>
      </View>
      <CanvasMount
        ref={containerRef}
        scene={scene}
        onHotspotOpen={onHotspotOpen}
      />
      <View style={styles.helpOverlay}>
        <Text style={styles.help}>Drag to look · tap glowing objects</Text>
      </View>
    </View>
  );
}

function CanvasMount({
  ref,
  scene,
  onHotspotOpen,
}: {
  ref: React.MutableRefObject<HTMLDivElement | null>;
  scene: Scene;
  onHotspotOpen?: (label: string) => void;
}) {
  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    host.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const rect = host.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);

    const scene3d = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      rect.width / rect.height,
      0.1,
      SKYBOX_RADIUS * 2,
    );

    const lookState: LookState = { yaw: 0, pitch: 0 };
    const controls = attachLookControls({
      canvas,
      onChange: (next) => {
        lookState.yaw = next.yaw;
        lookState.pitch = next.pitch;
      },
    });

    const lighting = buildLightingRig(scene.lighting);
    scene3d.add(lighting.group);

    let skybox: THREE.Mesh | null = null;
    let cancelled = false;

    const imageSource = getSceneImageSource(scene.imageKey, sceneIndex, scene.imageUrl);
    const imageUrl = typeof imageSource === "object" && "uri" in imageSource
      ? (imageSource.uri as string)
      : null;

    const propGroups: THREE.Group[] = [];
    const propByLabel: Map<string, THREE.Group> = new Map();

    if (!imageUrl) {
      scene3d.background = new THREE.Color(0x111827);
    } else {
      loadPanoramaTexture(imageUrl)
        .then((texture) => {
          if (cancelled) return;
          skybox = buildSkybox(texture, {
            radius: SKYBOX_RADIUS,
            segments: SKYBOX_SEGMENTS,
          });
          scene3d.add(skybox);

          for (const clue of scene.clues) {
            if (!skybox) continue;
            const world = hotspotWorldPosition(clue.x, clue.y, SKYBOX_RADIUS);
            const sphere = makeClueMarker(clue.label);
            sphere.position.copy(world);
            sphere.userData.clueLabel = clue.label;
            scene3d.add(sphere);
          }
        })
        .catch((err) => {
          console.warn("[scene-3d] panorama texture failed:", err);
          scene3d.background = new THREE.Color(0x111827);
        });
    }

    // Build 3D props from the scene brief. Per ENHANCEMENT FIRST, scenes
    // without props simply render the skybox; the fallback clue markers
    // on the skybox handle inspection in that case.
    for (const prop of scene.props ?? []) {
      const { group, halfExtents } = buildPropShape({
        kind: prop.kind,
        scale: prop.scale ?? 1,
      });
      const [px, py, pz] = prop.position;
      const [rx, ry, rz] = prop.rotation;
      group.position.set(px, py, pz);
      group.rotation.set(
        THREE.MathUtils.degToRad(rx),
        THREE.MathUtils.degToRad(ry),
        THREE.MathUtils.degToRad(rz),
      );
      group.userData.clueLabel = prop.clueLabel;
      scene3d.add(group);
      propGroups.push(group);
      if (prop.clueLabel) propByLabel.set(prop.clueLabel, group);

      // The first prop in a scene that carries a clueLabel is also
      // flagged as the clickable target. Other clues without a
      // dedicated prop fall back to the skybox-anchored marker.
      if (prop.clueLabel && !scene.clues.some((c) => c.label === prop.clueLabel)) {
        // No matching clue — drop silently. Per PREVENT BLOAT we
        // don't fail the scene build over a dangling prop label.
      }
    }

    let raf = 0;
    const render = () => {
      applyLook(camera, lookState);
      renderer.render(scene3d, camera);
      raf = requestAnimationFrame(render);
    };
    render();

    const handleResize = () => {
      const next = host.getBoundingClientRect();
      renderer.setSize(next.width, next.height, false);
      camera.aspect = next.width / next.height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(host);

    // Click detection: pointer-down + pointer-up within 5 pixels and
    // 600ms is a tap. Raycast against prop groups first (more
    // specific), then skybox-anchored clue markers as fallback.
    let downX = 0;
    let downY = 0;
    let downAt = 0;
    const onDown = (ev: PointerEvent) => {
      downX = ev.clientX;
      downY = ev.clientY;
      downAt = ev.timeStamp;
    };
    const onUp = (ev: PointerEvent) => {
      const dx = ev.clientX - downX;
      const dy = ev.clientY - downY;
      const moved = Math.hypot(dx, dy);
      const dt = ev.timeStamp - downAt;
      if (moved > 5 || dt > 600) return;

      const rect2 = canvas.getBoundingClientRect();
      const ndcX = ((ev.clientX - rect2.left) / rect2.width) * 2 - 1;
      const ndcY = -((ev.clientY - rect2.top) / rect2.height) * 2 + 1;
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const hits = ray.intersectObjects(scene3d.children, true);
      for (const hit of hits) {
        const label = hit.object.userData?.clueLabel;
        if (typeof label === "string") {
          onHotspotOpen?.(label);
          return;
        }
      }
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      controls.dispose();
      lighting.dispose();
      for (const g of propGroups) disposeGroup(g);
      if (skybox) {
        scene3d.remove(skybox);
        skybox.geometry.dispose();
        const mat = skybox.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
      renderer.dispose();
      const tex = skybox?.material instanceof THREE.MeshBasicMaterial
        ? skybox.material.map
        : null;
      tex?.dispose();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, [ref, scene, sceneIndex, onHotspotOpen]);

  return <div ref={ref} style={styles.canvasHost} />;
}

function makeClueMarker(label: string): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(8, 12, 12);
  const material = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.9,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `Hotspot:${label}`;
  mesh.userData.clueLabel = label;
  return mesh;
}

function disposeGroup(group: THREE.Group): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const mat = child.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
  });
  group.removeFromParent();
}

function Placeholder({ height, message }: { height: number; message: string }) {
  return (
    <View style={[styles.placeholder, { height }]}>
      <Text style={styles.placeholderText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 32,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(248, 231, 201, 0.18)",
    backgroundColor: "#0B1020",
  },
  canvasHost: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  },
  headerOverlay: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 20,
    gap: 5,
    zIndex: 2,
    pointerEvents: "none",
  },
  counter: {
    color: theme.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  title: {
    color: theme.ink,
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  location: {
    color: "rgba(255, 247, 237, 0.78)",
    fontSize: 14,
    fontWeight: "700",
  },
  helpOverlay: {
    position: "absolute",
    top: 16,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 2,
    pointerEvents: "none",
  },
  help: {
    color: theme.inkAlpha55,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.32)",
  },
  placeholder: {
    borderRadius: 32,
    borderCurve: "continuous",
    backgroundColor: "rgba(167, 139, 250, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.18)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  placeholderText: {
    color: theme.inkAlpha70,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});