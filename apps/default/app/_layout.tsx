import { theme } from "@/lib/theme";
import {
  OG_IMAGE_URL,
  SITE_DESCRIPTION,
  SITE_TITLE,
} from "@/lib/site";
import { ImmersionShellProvider, useImmersionShell } from "@/lib/immersion-shell";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Platform, StyleSheet, View } from "react-native";
import Head from "expo-router/head";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

const secureStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};

const isNative = Platform.OS === "ios" || Platform.OS === "android";
const isWeb = Platform.OS === "web";

function ShellFrame({ children }: { children: React.ReactNode }) {
  const { fullBleed } = useImmersionShell();
  return (
    <View style={[styles.root, isWeb && (fullBleed ? styles.rootBleed : styles.rootWeb)]}>
      <View style={[styles.inner, isWeb && (fullBleed ? styles.innerBleed : styles.innerWeb)]}>
        {children}
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <ConvexAuthProvider client={convex} storage={isNative ? secureStorage : undefined}>
      <ImmersionShellProvider>
        <Head>
          <title>{SITE_TITLE}</title>
          <meta name="description" content={SITE_DESCRIPTION} />
          <meta property="og:title" content={SITE_TITLE} />
          <meta property="og:description" content={SITE_DESCRIPTION} />
          <meta property="og:image" content={OG_IMAGE_URL} />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:image" content={OG_IMAGE_URL} />
          <link rel="icon" type="image/png" href="/favicon-32.png" />
        </Head>
        <ShellFrame>
          <Stack screenOptions={{ headerShown: false }} />
        </ShellFrame>
      </ImmersionShellProvider>
    </ConvexAuthProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.canvas,
  },
  rootWeb: {
    backgroundColor: "#080D1A",
    alignItems: "center",
  },
  rootBleed: {
    alignItems: "stretch",
    backgroundColor: "#080502",
  },
  inner: {
    flex: 1,
  },
  innerWeb: {
    width: "100%",
    maxWidth: 560,
    backgroundColor: theme.canvas,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.inkAlpha4,
  },
  innerBleed: {
    width: "100%",
    maxWidth: 100_000,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    backgroundColor: "#080502",
  },
});
