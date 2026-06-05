import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";

interface UsePushNotificationsResult {
  permissionStatus: "unknown" | "granted" | "denied" | "pending";
  isRegistered: boolean;
  isOptedIn: boolean;
  isBusy: boolean;
  toggleNotifications: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function usePushNotifications(identityId: string | null): UsePushNotificationsResult {
  const [permissionStatus, setPermissionStatus] = useState<"unknown" | "granted" | "denied" | "pending">("unknown");
  const [isBusy, setIsBusy] = useState(false);

  const registerToken = useMutation(api.notifications.registerToken);
  const unregisterToken = useMutation(api.notifications.unregisterToken);
  const subscription = useQuery(
    api.notifications.getSubscription,
    identityId ? { identityId } : "skip",
  );

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (Platform.OS === "web") {
        if (!cancelled) setPermissionStatus("denied");
        return;
      }
      const settings = await Notifications.getPermissionsAsync();
      if (!cancelled) {
        setPermissionStatus(settings.granted ? "granted" : settings.canAskAgain ? "pending" : "denied");
      }
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web" || !identityId) return false;

    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) {
      setPermissionStatus("granted");
    } else if (existing.canAskAgain) {
      const result = await Notifications.requestPermissionsAsync();
      setPermissionStatus(result.granted ? "granted" : "denied");
      if (!result.granted) return false;
    } else {
      setPermissionStatus("denied");
      return false;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: undefined,
    });
    const token = tokenData.data;
    if (!token) return false;

    const platform = (Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web") as
      | "ios"
      | "android"
      | "web";

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "WhoWare drops",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
      });
    }

    await registerToken({ identityId, expoPushToken: token, platform });
    return true;
  }, [identityId, registerToken]);

  const toggleNotifications = useCallback(async () => {
    if (!identityId || isBusy) return;
    setIsBusy(true);
    try {
      if (subscription?.isOptedIn) {
        await unregisterToken({ identityId });
      } else {
        await requestPermission();
      }
    } finally {
      setIsBusy(false);
    }
  }, [identityId, isBusy, requestPermission, subscription?.isOptedIn, unregisterToken]);

  return {
    permissionStatus,
    isRegistered: Boolean(subscription),
    isOptedIn: subscription?.isOptedIn ?? false,
    isBusy,
    toggleNotifications,
    requestPermission,
  };
}
