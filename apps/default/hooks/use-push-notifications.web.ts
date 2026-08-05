import { useCallback, useState } from "react";

interface UsePushNotificationsResult {
  permissionStatus: "unknown" | "granted" | "denied" | "pending";
  isRegistered: boolean;
  isOptedIn: boolean;
  isBusy: boolean;
  toggleNotifications: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
}

/**
 * Web stub — expo-notifications push-token listeners are unsupported on web
 * and would otherwise log noisy no-op warnings on every boot.
 */
export function usePushNotifications(_identityId: string | null): UsePushNotificationsResult {
  const [isBusy] = useState(false);

  const requestPermission = useCallback(async () => false, []);
  const toggleNotifications = useCallback(async () => undefined, []);

  return {
    permissionStatus: "denied",
    isRegistered: false,
    isOptedIn: false,
    isBusy,
    toggleNotifications,
    requestPermission,
  };
}
