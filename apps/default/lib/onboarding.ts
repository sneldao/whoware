import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "./logger";

const ONBOARDING_KEY = "whoware.onboarding.complete";
const SOUND_KEY = "whoware.sound.enabled";

/** Progressive in-room coaches — shown once at the moment of need. */
export type CoachTipId = "wrongGuess" | "unlockNext" | "nameIdentity";

const COACH_KEYS: Record<CoachTipId, string> = {
  wrongGuess: "whoware.coach.wrongGuess",
  unlockNext: "whoware.coach.unlockNext",
  nameIdentity: "whoware.coach.nameIdentity",
};

export const COACH_COPY: Record<CoachTipId, string> = {
  wrongGuess: "Guesses are limited — another memory might help.",
  unlockNext: "More rooms mean more signal, and a lower score ceiling.",
  nameIdentity: "Search or pick a figure when you're ready. Restraint scores higher.",
};

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

/** Returns true the first time this tip is consumed (and marks it seen). */
export async function consumeCoachTip(id: CoachTipId): Promise<boolean> {
  const key = COACH_KEYS[id];
  try {
    const seen = await AsyncStorage.getItem(key);
    if (seen === "true") return false;
    await AsyncStorage.setItem(key, "true");
    return true;
  } catch (e) {
    logger.warn("onboarding.consumeCoachTip", e);
    return false;
  }
}
