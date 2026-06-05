import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_KEY = "whoware.onboarding.complete";

export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value === "true";
  } catch {
    return false;
  }
}

export async function markOnboardingComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
  } catch {
    // Persistence unavailable — proceed anyway.
  }
}
