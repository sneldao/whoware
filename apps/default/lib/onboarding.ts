import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "./logger";

const ONBOARDING_KEY = "whoware.onboarding.complete";
const SOUND_KEY = "whoware.sound.enabled";
const COLD_OPEN_KEY = "whoware.coldOpen.seen";

/** Progressive in-room coaches — shown once at the moment of need. */
export type CoachTipId = "wrongGuess" | "unlockNext" | "nameIdentity" | "researchDay";

const COACH_KEYS: Record<CoachTipId, string> = {
  wrongGuess: "whoware.coach.wrongGuess",
  unlockNext: "whoware.coach.unlockNext",
  nameIdentity: "whoware.coach.nameIdentity",
  researchDay: "whoware.coach.researchDay",
};

export const COACH_COPY: Record<CoachTipId, string> = {
  wrongGuess: "Proximity feedback will guide your next guess — check era and region!",
  unlockNext: "Exploring more memories uncovers crucial props and era clues.",
  nameIdentity: "Name the figure whenever you feel confident in your hypothesis.",
  researchDay: "Today's figure is research tier — an obscure one. Open memories and spend clues; deduction matters more than recognition.",
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

/** Returns true if the player has already seen the Act I brand reveal. */
export async function hasSeenColdOpen(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(COLD_OPEN_KEY);
    return value === "true";
  } catch (e) {
    logger.warn("onboarding.hasSeenColdOpen", e);
    return false;
  }
}

export async function markColdOpenSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(COLD_OPEN_KEY, "true");
  } catch (e) {
    logger.warn("onboarding.markColdOpenSeen", e);
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
