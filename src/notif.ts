import { NativeModules } from "react-native";

// Bridge to the native NotifListenerService (Android). Everything stays on-device.
export type NotifItem = { app: string; title: string; text: string; time: number; key: string };

type NativeApi = {
  isEnabled(): Promise<boolean>;
  openSettings(): void;
  getRecent(): Promise<NotifItem[]>;
  clear(): void;
};

const M = (NativeModules as { PocketNotif?: NativeApi }).PocketNotif;

export const notif = {
  available: !!M,
  isEnabled: (): Promise<boolean> => (M ? M.isEnabled() : Promise.resolve(false)),
  openSettings: (): void => { M?.openSettings(); },
  getRecent: (): Promise<NotifItem[]> => (M ? M.getRecent() : Promise.resolve([])),
  clear: (): void => { M?.clear(); },
};
