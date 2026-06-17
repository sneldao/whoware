import { StyleSheet, Text, View } from "react-native";

/**
 * Placeholder 3D scene canvas.
 *
 * Phase 0: returns a "3D coming soon" notice. Real Three.js renderer
 * arrives in Phase 1 (skybox from existing panorama image) and Phase 2
 * (procedural props from scene brief).
 *
 * Kept in this file so the lazy-import seam in MemoryScene.tsx is
 * already in place — we just upgrade the body without touching the
 * orchestrator.
 */
export function SceneCanvas({ height }: { height: number }) {
  return (
    <View style={[styles.placeholder, { height }]}>
      <Text style={styles.title}>3D scene coming soon</Text>
      <Text style={styles.subtitle}>
        Skybox from the panorama image is wired in Phase 1.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    borderRadius: 32,
    borderCurve: "continuous",
    backgroundColor: "rgba(167, 139, 250, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.18)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
  },
  title: {
    color: "#A78BFA",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  subtitle: {
    color: "rgba(255, 247, 237, 0.55)",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
});