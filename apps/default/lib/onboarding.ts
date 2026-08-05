import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "./logger";

const ONBOARDING_KEY = "whoware.onboarding.complete";
const SOUND_KEY = "whoware.sound.enabled";

export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value === "true";
  } catch (e) {
    logger.warn("onboarding.hasCompleted", e);
    return false;
  }
}

export async function markOnboardingComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
  } catch (e) {
    logger.warn("onboarding.markComplete", e);
  }
}

export async function getSoundEnabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(SOUND_KEY);
    // Default on unless explicitly muted at the threshold.
    return value !== "false";
  } catch (e) {
    logger.warn("onboarding.getSoundEnabled", e);
    return true;
  }
}

export async function setSoundEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(SOUND_KEY, enabled ? "true" : "false");
  } catch (e) {
    logger.warn("onboarding.setSoundEnabled", e);
  }
}
