// Local scheduled notifications for timers and calendar reminders. Everything is on-device
// (no push, no server). We deliberately use INEXACT scheduling: exact alarms need the
// Play-restricted SCHEDULE_EXACT_ALARM/USE_EXACT_ALARM and Doze can delay them anyway, so a
// reminder may arrive within ~an hour under deep Doze — acceptable for v1, and nothing to grant.
//
// NOTE: distinct from ./notif.ts, which is the native NotificationListenerService *reader*.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const CHANNEL_ID = "reminders";

// Show the notification even when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let permGranted = false;

// Create the Android channel and request permission once, on first use (contextual prompt —
// best practice, not at app launch). Safe to call repeatedly. Returns whether we may post.
export async function ensureNotify(): Promise<boolean> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: "Reminders & timers",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 400, 150, 400],
        lightColor: "#FF9800",
      });
    }
    let status = (await Notifications.getPermissionsAsync()).status;
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    permGranted = status === "granted";
    return permGranted;
  } catch {
    return false;
  }
}

// Schedule a one-off notification at an absolute time. Returns its id, or null if it could
// not be scheduled (permission denied, time already passed, or an error). Never throws.
export async function scheduleAt(when: Date, title: string, body?: string): Promise<string | null> {
  try {
    if (!when || isNaN(when.getTime()) || when.getTime() <= Date.now() + 500) return null;
    if (!permGranted && !(await ensureNotify())) return null;
    return await Notifications.scheduleNotificationAsync({
      content: { title, body: body ?? "", sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL_ID },
    });
  } catch {
    return null;
  }
}

// Schedule after N seconds (used by the countdown timer).
export function scheduleIn(seconds: number, title: string, body?: string): Promise<string | null> {
  return scheduleAt(new Date(Date.now() + Math.round(seconds * 1000)), title, body);
}

// Cancel a previously scheduled notification. No-op on null/empty. Never throws.
export async function cancel(id: string | null | undefined): Promise<void> {
  if (!id) return;
  try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
}
