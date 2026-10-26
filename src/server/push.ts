import "server-only";
import { db } from "@/server/db";

// Phone push notifications through Expo's push service: the app registers an Expo push token per device
// (/api/mobile/push-devices); we post the message to Expo, which delivers it through Firebase (Android) or APNs.
// Sending never fails the action that caused it (a message, an application…): errors are logged and dropped.

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
/** Expo accepts up to 100 messages per request. */
const BATCH = 100;

export type PushMessage = {
  title: string;
  body?: string | null;
  /** Read by the app when the notification is tapped (which screen to open). */
  data?: Record<string, string>;
};

type Ticket = { status: "ok"; id: string } | { status: "error"; message?: string; details?: { error?: string } };

/** True for the token format the app sends (Expo push tokens). */
export const isExpoPushToken = (token: string) => /^Expo(nent)?PushToken\[[\w-]+\]$/.test(token);

/** Sends one notification to every phone of a member. Resolves when done; never throws. */
export async function sendPush(userId: string, message: PushMessage) {
  try {
    const devices = await db.pushDevice.findMany({ where: { userId }, select: { token: true } });
    if (!devices.length) return;
    const gone: string[] = [];
    for (let i = 0; i < devices.length; i += BATCH) {
      const tokens = devices.slice(i, i + BATCH).map((d) => d.token);
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          // Optional: with "Enhanced push security" on in Expo, only requests carrying this token are accepted.
          ...(process.env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(
          tokens.map((to) => ({
            to,
            title: message.title,
            body: message.body ?? undefined,
            data: message.data ?? {},
            sound: "default",
            priority: "high",
            channelId: "default",
          })),
        ),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        console.error("[push] Expo answered", res.status, (await res.text().catch(() => "")).slice(0, 200));
        continue;
      }
      const tickets = ((await res.json().catch(() => null)) as { data?: Ticket[] } | null)?.data ?? [];
      tickets.forEach((t, j) => {
        if (t.status === "error") {
          // The app was uninstalled or the token expired: stop sending to it.
          if (t.details?.error === "DeviceNotRegistered") gone.push(tokens[j]!);
          else console.error("[push] not sent:", t.details?.error ?? t.message);
        }
      });
    }
    if (gone.length) await db.pushDevice.deleteMany({ where: { token: { in: gone } } });
  } catch (e) {
    console.error("[push] failed:", e instanceof Error ? e.message : e);
  }
}
