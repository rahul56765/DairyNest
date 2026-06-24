import { useEffect, useRef } from "react";
import { Platform, Vibration, AppState } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { storage } from "@/src/utils/storage";

const PUSH_TOKEN_KEY = "dn_push_token";

// Foreground handler: show banner + vibrate
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "DairyNest",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#3A5940",
    sound: "default",
    enableVibrate: true,
    showBadge: true,
  });
}

async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (!Device.isDevice) {
    // Push tokens not available in simulators/emulators that aren't physical
    // We still try, but it usually returns nothing
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    final = status;
  }
  if (final !== "granted") return null;

  try {
    const projectId =
      (Constants?.expoConfig as any)?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId;
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : ({} as any)
    );
    return tokenResp.data || null;
  } catch (e) {
    console.warn("Failed to get Expo push token", e);
    return null;
  }
}

/**
 * Mounts a global push listener and registers the device with the backend
 * whenever a user is signed in. Should be rendered exactly once (in _layout).
 */
export function PushNotificationsGate() {
  const { user } = useAuth();
  const receivedSub = useRef<Notifications.Subscription | null>(null);
  const responseSub = useRef<Notifications.Subscription | null>(null);

  // Set up listeners once
  useEffect(() => {
    ensureAndroidChannel();

    receivedSub.current = Notifications.addNotificationReceivedListener(() => {
      // Vibrate on every incoming push (foreground)
      Vibration.vibrate([0, 250, 250, 250]);
    });

    responseSub.current = Notifications.addNotificationResponseReceivedListener(() => {
      // Could deep-link based on data?.kind here
    });

    return () => {
      receivedSub.current?.remove();
      responseSub.current?.remove();
    };
  }, []);

  // Register/Refresh push token when a user signs in
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const token = await getExpoPushToken();
      if (!token || cancelled) return;
      try {
        await api.post("/push/register", { token, platform: Platform.OS });
        await storage.setItem(PUSH_TOKEN_KEY, token);
      } catch (e) {
        console.warn("Push token registration failed", e);
      }
    })();

    // Re-register when app returns from background (token can change)
    const sub = AppState.addEventListener("change", async (s) => {
      if (s === "active" && user) {
        const token = await getExpoPushToken();
        if (token) {
          try { await api.post("/push/register", { token, platform: Platform.OS }); } catch {}
        }
      }
    });
    return () => { cancelled = true; sub.remove(); };
  }, [user?.id]);

  return null;
}
