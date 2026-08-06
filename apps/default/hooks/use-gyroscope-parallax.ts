import { useEffect } from "react";
import { Platform } from "react-native";
import type { SharedValue } from "react-native-reanimated";

/**
 * Drives parallax shared values from device gyroscope/accelerometer on native.
 * On web, this is a no-op — parallax is driven by PanResponder only.
 *
 * The hook subscribes to device tilt and maps it to normalized -1..1 offsets
 * that feed the existing parallax image/glow styles. It only activates when
 * `fill` mode is on (immersive full-bleed scenes), so non-immersive panorama
 * cards keep the drag-only behavior.
 */
export function useGyroscopeParallax(
  parallaxX: SharedValue<number>,
  parallaxY: SharedValue<number>,
  active: boolean,
): void {
  useEffect(() => {
    if (Platform.OS === "web" || !active) return;

    let subscription: { remove: () => void } | null = null;
    let mounted = true;

    // Dynamic import so web bundle never touches expo-sensors
    (async () => {
      try {
        const Gyroscope = await import("expo-sensors").then((m) => m.Gyroscope).catch(() => null);
        if (! Gyroscope || !mounted) return;

        Gyroscope.setUpdateInterval(100);

        subscription = Gyroscope.addListener((data) => {
          // Gyroscope returns angular velocity (rad/s). Integrate gently
          // into a bounded offset — this gives a "look around" feel as
          // the player tilts the phone.
          const sensitivity = 0.015;
          const maxOffset = 1;

          // X rotation (pitch) → vertical parallax
          // Y rotation (roll) → horizontal parallax
          parallaxX.value = Math.max(-maxOffset, Math.min(maxOffset, parallaxX.value - data.y * sensitivity));
          parallaxY.value = Math.max(-maxOffset, Math.min(maxOffset, parallaxY.value + data.x * sensitivity));
        });
      } catch {
        // expo-sensors not available — silently fall back to drag-only
      }
    })();

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, [parallaxX, parallaxY, active]);
}
