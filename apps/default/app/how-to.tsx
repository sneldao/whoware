import { OnboardingFlow } from "@/components/who-ware/onboarding-flow";
import { router } from "expo-router";
import { View } from "react-native";

/**
 * Optional How to play — never gates cold start; reachable from play HUD / solved hero.
 */
export default function HowToScreen() {
  return (
    <View style={{ flex: 1 }}>
      <OnboardingFlow onComplete={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/");
      }} />
    </View>
  );
}
