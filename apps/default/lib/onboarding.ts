import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "./logger";

const ONBOARDING_KEY = "whoware.onboarding.complete";

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
    // Persistence unavailable — proceed anyway.
  }
}
