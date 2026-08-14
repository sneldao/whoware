import * as THREE from "three";
import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { theme } from "@/lib/theme";
import { logger } from "@/lib/logger";
import { Ionicons } from "@expo/vector-icons";

import type { Clue, Scene } from "@/components/who-ware/panorama-scene";
import { ClueDetailPanel } from "@/components/who-ware/clue-detail-panel";
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

/** Props that emit light and should flicker/pulse in the render loop. */
const FLICKER_PROP_KINDS = new Set([
  "candle", "lantern", "oil_lamp", "fireplace", "gramophone",
  "vintage_radio", "telegraph",
]);

interface SceneCanvasProps {
  scene: Scene;
  sceneIndex: number;
  totalScenes: number;
  height: number;
  onHotspotOpen?: (label: string) => void;
  onGenerateHint?: (clueLabel: string, tier?: "socratic" | "era" | "proximity") => void;
  activeHint?: string | null;
  activeHintTier?: "socratic" | "era" | "proximity" | null;
  hintUsedForScene?: (sceneIndex: number) => boolean;
  hasHintTierForScene?: (sceneIndex: number, tier: "socratic" | "era" | "proximity") => boolean;
  canRequestHintForClue?: (clueLabel: string) => boolean;
  isHintGenerating?: boolean;
  onDismissHint?: () => void;
  /** Edge-to-edge immersion — no card chrome or below-fold hint. */
  fill?: boolean;
}

/**
 * Three.js scene canvas — skybox + procedural props on web.
 * Native keeps a placeholder until expo-gl lands.
 */
export function SceneCanvas({
  scene,
  sceneIndex,
  totalScenes,
  height,
  onHotspotOpen,
  onGenerateHint,
  activeHint,
  activeHintTier,
  hintUsedForScene,
  hasHintTierForScene,
  canRequestHintForClue,
  isHintGenerating,
  onDismissHint,
  fill = false,
}: SceneCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeClue, setActiveClue] = useState<Clue | null>(null);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const onHotspotOpenRef = useRef(onHotspotOpen);
  onHotspotOpenRef.current = onHotspotOpen;

  useEffect(() => {
    setActiveClue(null);
    setHoverLabel(null);
    onDismissHint?.(); // Clear the hint when navigating to a different scene
  }, [scene.title, sceneIndex, onDismissHint]);

  if (Platform.OS !== "web") {
    return (
      <Placeholder
        height={height}
        message="3D scene is web-only in this build."
      />
    );
  }

  function handleHotspot(label: string) {
    const clue = scene.clues.find((c) => c.label === label) ?? null;
    if (clue && activeClue?.label !== clue.label) {
      onDismissHint?.(); // Fresh slate when switching to a different clue
    }
    if (clue) setActiveClue(clue);
    onHotspotOpenRef.current?.(label);
  }

  const imageUrl = resolveSceneImageUrl(scene, sceneIndex);

  return (
    <View style={fill ? styles.fillRoot : styles.card}>
      <View style={[styles.frame, { height }, fill && styles.frameFill]}>
        {!fill ? (
          <View style={styles.headerOverlay}>
            <Text style={styles.counter}>
              Memory {sceneIndex + 1} / {totalScenes}
            </Text>
            <Text style={styles.title}>{scene.title}</Text>
            <Text style={styles.location}>
              {scene.location} · {scene.era}
            </Text>
          </View>
        ) : null}
        <CanvasMount
          hostRef={containerRef}
          imageUrl={imageUrl}
          clues={scene.clues}
          props={scene.props}
          lighting={scene.lighting}
          onHotspotOpen={handleHotspot}
          onHoverProp={setHoverLabel}
        />
        {hoverLabel ? (
          <View style={styles.inspectTooltip}>
            <Ionicons name="search-outline" size={13} color={theme.accent} />
            <Text style={styles.inspectTooltipText}>Inspect: {hoverLabel}</Text>
          </View>
        ) : !fill ? (
          <View style={styles.helpOverlay}>
            <Text style={styles.help}>Drag to look · tap glowing objects</Text>
          </View>
        ) : null}
        {fill && activeClue ? (
          <View style={styles.fillClue}>
            <ClueDetailPanel
              clue={activeClue}
              hintLabel="Ask the memory (AI hint)"
              onGenerateHint={onGenerateHint}
              activeHint={activeHint}
              activeHintTier={activeHintTier}
              isHintGenerating={isHintGenerating}
              hintUsedForScene={hintUsedForScene ? hintUsedForScene(sceneIndex) : undefined}
              hasHintTier={hasHintTierForScene ? (tier) => hasHintTierForScene(sceneIndex, tier) : undefined}
              canRequestHint={canRequestHintForClue ? canRequestHintForClue(activeClue.label) : undefined}
              onDismissHint={onDismissHint}
            />
          </View>
        ) : null}
      </View>

      {!fill ? (
        activeClue ? (
          <ClueDetailPanel
            clue={activeClue}
            hintLabel="Ask the memory (AI hint)"
            onGenerateHint={onGenerateHint}
            activeHint={activeHint}
            activeHintTier={activeHintTier}
            isHintGenerating={isHintGenerating}
            hintUsedForScene={hintUsedForScene ? hintUsedForScene(sceneIndex) : undefined}
            hasHintTier={hasHintTierForScene ? (tier) => hasHintTierForScene(sceneIndex, tier) : undefined}
            canRequestHint={canRequestHintForClue ? canRequestHintForClue(activeClue.label) : undefined}
            onDismissHint={onDismissHint}
          />
        ) : (
          <View style={styles.hintRow}>
            <Ionicons name="radio-button-on" size={16} color="#D97706" />
            <Text style={styles.hint}>
              Drag to look, then tap a glow for a clue — each one costs score.
            </Text>
          </View>
        )
      ) : null}
    </View>
  );
}

function resolveSceneImageUrl(scene: Scene, sceneIndex: number): string | null {
  const imageSource = getSceneImageSource(scene.imageKey, sceneIndex, scene.imageUrl);
  if (typeof imageSource === "object" && imageSource && "uri" in imageSource) {
    return imageSource.uri as string;
  }
  return null;
}

function CanvasMount({
  hostRef,
  imageUrl,
  clues,
  props: sceneProps,
  lighting: sceneLighting,
  onHotspotOpen,
  onHoverProp,
}: {
  hostRef: React.MutableRefObject<HTMLDivElement | null>;
  imageUrl: string | null;
  clues: Clue[];
  props?: Scene["props"];
  lighting?: Scene["lighting"];
  onHotspotOpen: (label: string) => void;
  onHoverProp?: (label: string | null) => void;
}) {
  const onHotspotOpenRef = useRef(onHotspotOpen);
  onHotspotOpenRef.current = onHotspotOpen;
  const onHoverPropRef = useRef(onHoverProp);
  onHoverPropRef.current = onHoverProp;

  // Stabilize rebuilds: identity keys, not parent callback identity.
  const clueKey = clues.map((c) => `${c.label}:${c.x}:${c.y}`).join("|");
  const propKey = (sceneProps ?? [])
    .map((p) => `${p.id}:${p.kind}:${p.clueLabel ?? ""}:${p.position.join(",")}`)
    .join("|");
  const lightingKey = sceneLighting
    ? `${sceneLighting.ambient}:${sceneLighting.keyColor}:${sceneLighting.keyIntensity}`
    : "default";

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Snapshot scene content for this mount — keyed by clueKey/propKey/lightingKey.
    const cluesSnapshot = clues;
    const propsSnapshot = sceneProps;
    const lightingSnapshot = sceneLighting;

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    canvas.style.cursor = "grab";
    host.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    const dprCap = window.matchMedia("(max-width: 768px)").matches ? 1 : 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
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
    let dirty = true;
    let looping = false;
    let raf = 0;
    let dragging = false;
    const animClueMarkers: THREE.Object3D[] = [];
    const animFlickerProps: { mesh: THREE.Mesh; baseIntensity: number; phase: number }[] = [];
    let dustPoints: THREE.Points | null = null;
    // Base positions for the dust cloud — we oscillate around these instead
    // of integrating velocity, so motes never drift out of the room.
    let dustBase: Float32Array | null = null;
    const animStart = performance.now();

    const kick = () => {
      dirty = true;
      if (looping) return;
      looping = true;
      const tick = () => {
        if (document.visibilityState === "hidden") {
          looping = false;
          return;
        }
        const now = performance.now();
        const elapsed = (now - animStart) / 1000;

        // Animate clue markers — pulse halo opacity + rotate ring
        for (const obj of animClueMarkers) {
          const halo = (obj as THREE.Group).getObjectByName("HotspotHalo");
          const ring = (obj as THREE.Group).getObjectByName("HotspotRing");
          if (halo) {
            const mat = halo.material as THREE.MeshBasicMaterial;
            mat.opacity = 0.12 + Math.sin(elapsed * 2.2) * 0.1;
            const scale = 1 + Math.sin(elapsed * 2.2) * 0.15;
            halo.scale.setScalar(scale);
          }
          if (ring) {
            ring.rotation.z = elapsed * 0.6;
            ring.lookAt(camera.position);
            const rMat = ring.material as THREE.MeshBasicMaterial;
            rMat.opacity = 0.25 + Math.sin(elapsed * 2.2 + Math.PI) * 0.2;
          }
        }

        // Animate flickering props (candles, fireplaces, lamps)
        for (const fp of animFlickerProps) {
          const mat = fp.mesh.material as THREE.MeshStandardMaterial;
          if (mat.emissive) {
            const flicker = 1 + Math.sin(elapsed * 8 + fp.phase) * 0.25 + Math.sin(elapsed * 17 + fp.phase) * 0.12;
            mat.emissiveIntensity = fp.baseIntensity * flicker;
          }
        }

        // Animate atmospheric dust motes — oscillate around base positions
        if (dustPoints && dustBase) {
          const positions = dustPoints.geometry.attributes.position.array as Float32Array;
          for (let i = 0; i < positions.length; i += 3) {
            const phase = i * 0.7;
            positions[i] = dustBase[i] + Math.cos(elapsed * 0.3 + phase) * 0.8;
            positions[i + 1] = dustBase[i + 1] + Math.sin(elapsed * 0.5 + phase) * 1.2;
            positions[i + 2] = dustBase[i + 2] + Math.sin(elapsed * 0.25 + phase) * 0.8;
          }
          dustPoints.geometry.attributes.position.needsUpdate = true;
        }

        applyLook(camera, lookState);
        renderer.render(scene3d, camera);
        // Keep looping while there are animated objects, or dragging, or dirty
        if (dragging || dirty || animClueMarkers.length > 0 || animFlickerProps.length > 0 || dustPoints) {
          dirty = false;
          raf = requestAnimationFrame(tick);
        } else {
          looping = false;
        }
      };
      raf = requestAnimationFrame(tick);
    };

    const controls = attachLookControls({
      canvas,
      onChange: (next) => {
        lookState.yaw = next.yaw;
        lookState.pitch = next.pitch;
        kick();
      },
      onActiveChange: (active) => {
        dragging = active;
        kick();
      },
    });

    const lighting = buildLightingRig(lightingSnapshot);
    scene3d.add(lighting.group);

    // Build atmospheric dust particle cloud
    const dustCount = 180;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount * 3; i += 3) {
      dustPos[i] = (Math.random() - 0.5) * 80;
      dustPos[i + 1] = (Math.random() - 0.5) * 40;
      dustPos[i + 2] = (Math.random() - 0.5) * 80;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    dustBase = dustPos.slice();
    const dustMat = new THREE.PointsMaterial({
      color: 0xfef3c7,
      size: 1.5,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    dustPoints = new THREE.Points(dustGeo, dustMat);
    scene3d.add(dustPoints);

    let skybox: THREE.Mesh | null = null;
    let cancelled = false;
    const propGroups: THREE.Group[] = [];

    if (!imageUrl) {
      scene3d.background = new THREE.Color(0x111827);
      kick();
    } else {
      loadPanoramaTexture(imageUrl)
        .then((texture) => {
          if (cancelled) return;
          skybox = buildSkybox(texture, {
            radius: SKYBOX_RADIUS,
            segments: SKYBOX_SEGMENTS,
          });
          scene3d.add(skybox);

          for (const clue of cluesSnapshot) {
            const world = hotspotWorldPosition(clue.x, clue.y, SKYBOX_RADIUS);
            const marker = makeClueMarker(clue.label);
            marker.position.copy(world);
            scene3d.add(marker);
            animClueMarkers.push(marker);
          }
          kick();
        })
        .catch((err) => {
          logger.warn("scene3d.panoramaTextureFailed", err);
          scene3d.background = new THREE.Color(0x111827);
          kick();
        });
    }

    for (const prop of propsSnapshot ?? []) {
      const { group } = buildPropShape({
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

      // Track light-emitting props for flicker animation
      if (FLICKER_PROP_KINDS.has(prop.kind)) {
        group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mat = child.material as THREE.MeshStandardMaterial;
            if (mat.emissive && mat.emissiveIntensity > 0) {
              animFlickerProps.push({
                mesh: child,
                baseIntensity: mat.emissiveIntensity,
                phase: Math.random() * Math.PI * 2,
              });
            }
          }
        });
      }
    }

    kick();

    const handleResize = () => {
      const next = host.getBoundingClientRect();
      renderer.setSize(next.width, next.height, false);
      camera.aspect = next.width / next.height;
      camera.updateProjectionMatrix();
      kick();
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(host);

    const onVisibility = () => {
      if (document.visibilityState === "visible") kick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    let downX = 0;
    let downY = 0;
    let downAt = 0;
    // Shared raycast scratch objects — hover fires on every pointermove.
    const hoverRay = new THREE.Raycaster();
    const hoverNdc = new THREE.Vector2();
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
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          const label = obj.userData?.clueLabel;
          if (typeof label === "string") {
            onHotspotOpenRef.current(label);
            kick();
            return;
          }
          obj = obj.parent;
        }
      }
    };
    const onMove = (ev: PointerEvent) => {
      if (dragging) {
        onHoverPropRef.current?.(null);
        return;
      }
      // Hover only fires on precise pointers (mouse/pen); a touch
      // pointermove is part of a drag or tap, not an inspection intent.
      if (ev.pointerType === "touch") return;
      const rect2 = canvas.getBoundingClientRect();
      hoverNdc.set(
        ((ev.clientX - rect2.left) / rect2.width) * 2 - 1,
        -((ev.clientY - rect2.top) / rect2.height) * 2 + 1,
      );
      hoverRay.setFromCamera(hoverNdc, camera);
      // Raycast only interactive objects (props + clue markers), not the skybox.
      const hits = hoverRay.intersectObjects([...propGroups, ...animClueMarkers], true);
      let found: string | null = null;
      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          const label = obj.userData?.clueLabel;
          if (typeof label === "string") {
            found = label;
            break;
          }
          obj = obj.parent;
        }
        if (found) break;
      }
      onHoverPropRef.current?.(found);
    };

    const onLeave = () => {
      onHoverPropRef.current?.(null);
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      looping = false;
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      controls.dispose();
      lighting.dispose();
      if (dustPoints) {
        scene3d.remove(dustPoints);
        dustPoints.geometry.dispose();
        (dustPoints.material as THREE.Material).dispose();
      }
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
    // clueKey / propKey / lightingKey capture content identity for rebuilds.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional key-based deps
  }, [hostRef, imageUrl, clueKey, propKey, lightingKey]);

  return <div ref={hostRef} style={styles.canvasHost} />;
}

function makeClueMarker(label: string): THREE.Group {
  const group = new THREE.Group();
  group.name = `Hotspot:${label}`;
  group.userData.clueLabel = label;
  group.userData.isClueMarker = true;

  // Inner solid sphere
  const coreGeo = new THREE.SphereGeometry(6, 12, 12);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.9,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.name = "HotspotCore";
  group.add(core);

  // Outer glow halo (pulsates via animation in render loop)
  const haloGeo = new THREE.SphereGeometry(12, 16, 16);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.name = "HotspotHalo";
  group.add(halo);

  // Ring marker at the sphere surface (slow rotation)
  const ringGeo = new THREE.RingGeometry(14, 15.5, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.4,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.name = "HotspotRing";
  group.add(ring);

  return group;
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
  card: {
    gap: 14,
  },
  fillRoot: {
    flex: 1,
  },
  frame: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 32,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(248, 231, 201, 0.18)",
    backgroundColor: "#0B1020",
  },
  frameFill: {
    borderRadius: 0,
    borderWidth: 0,
  },
  fillClue: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 120,
    zIndex: 3,
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
    color: theme.inkAlpha78,
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
  inspectTooltip: {
    position: "absolute",
    top: 16,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(12, 8, 4, 0.84)",
    borderWidth: 1,
    borderColor: theme.accentAlpha35,
    zIndex: 10,
    pointerEvents: "none",
  },
  inspectTooltipText: {
    color: theme.ink,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
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
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  hint: {
    flex: 1,
    color: theme.inkAlpha58,
    fontSize: 14,
    fontWeight: "700",
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
