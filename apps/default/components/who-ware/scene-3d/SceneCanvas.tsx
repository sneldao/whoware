import * as THREE from "three";
import { useEffect, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import type { Scene } from "@/components/who-ware/panorama-scene";
import {
  attachLookControls,
  applyLook,
  type LookState,
} from "@/components/who-ware/scene-3d/look-controls";
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
 * Three.js scene canvas — renders the panorama image as a skybox sphere
 * the player can look around inside.
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
        <Text style={styles.help}>Drag to look around</Text>
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

    let skybox: THREE.Mesh | null = null;
    let cancelled = false;

    const imageSource = getSceneImageSource(scene.imageKey, sceneIndex, scene.imageUrl);
    const imageUrl = typeof imageSource === "object" && "uri" in imageSource
      ? (imageSource.uri as string)
      : null;

    if (!imageUrl) {
      // Fallback to a flat-color skybox so the renderer still works.
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

          // Place clue hotspots at the same x/y the 2D renderer used,
          // projected onto the inner surface of the skybox.
          for (const clue of scene.clues) {
            const world = hotspotWorldPosition(clue.x, clue.y, SKYBOX_RADIUS);
            const dot = makeHotspotMesh(clue.label);
            dot.position.copy(world);
            dot.userData.clueLabel = clue.label;
            scene3d.add(dot);
          }
        })
        .catch((err) => {
          console.warn("[scene-3d] panorama texture failed:", err);
          scene3d.background = new THREE.Color(0x111827);
        });
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

    // Pointer up anywhere on a hotspot triggers onHotspotOpen. We use
    // a simple click detector: if the pointer moved less than 5 pixels
    // between down and up, treat it as a tap and raycast.
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
    // sceneIndex is the only changing scene-level input. We rebuild
    // the skybox when it changes (PanoramaScene did the same with
    // `useEffect` keyed on `scene.title`).
  }, [ref, scene, sceneIndex, onHotspotOpen]);

  return <div ref={ref} style={styles.canvasHost} />;
}

function makeHotspotMesh(label: string): THREE.Mesh {
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
    color: "#FBBF24",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  title: {
    color: "#FFF7ED",
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
    color: "rgba(255, 247, 237, 0.55)",
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
    color: "rgba(255, 247, 237, 0.7)",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});