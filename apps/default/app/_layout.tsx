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

export default function RootLayout() {
    return (
        <ConvexAuthProvider client={convex} storage={isNative ? secureStorage : undefined}>
            <Head>
                <title>WhoWare — Daily History Guessing Game</title>
                <meta name="description" content="Step into panoramic memories from a historical figure's life. Inspect clues. Guess the identity. New puzzle every day." />
            </Head>
            <View style={[styles.root, isWeb && styles.rootWeb]}>
                <View style={[styles.inner, isWeb && styles.innerWeb]}>
                    <Stack screenOptions={{ headerShown: false }} />
                </View>
            </View>
        </ConvexAuthProvider>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: "#070A12",
    },
    rootWeb: {
        backgroundColor: "#080D1A",
        alignItems: "center",
    },
    inner: {
        flex: 1,
    },
    innerWeb: {
        width: "100%",
        maxWidth: 560,
        backgroundColor: "#070A12",
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: "rgba(255, 247, 237, 0.04)",
    },
});
