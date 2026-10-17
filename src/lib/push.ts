// Web push for reminders: this browser asks for permission, subscribes with the
// site's public key and saves the subscription (RLS: the user's own row). The
// hourly reminders job (/api/cron/reminders) sends to it at the user's local
// evening check-in time. Off unless NEXT_PUBLIC_VAPID_PUBLIC_KEY is set.
import { createClient } from "@/lib/supabase/client";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function pushSupported(): boolean {
  return (
    !!KEY &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration() {
  return navigator.serviceWorker.register("/sw.js");
}

/** Is this browser already subscribed? */
export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  return !!(await reg?.pushManager.getSubscription());
}

/** Ask, subscribe and save. Throws a readable message when it can't. */
export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error("This browser can't show reminders.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are blocked for this site — allow them in the browser's settings.");
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) }));
  const json = sub.toJSON();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dhaka";
  const { error } = await createClient()
    .from("push_subscriptions")
    .upsert({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "", tz }, { onConflict: "user_id,endpoint" });
  if (error) throw new Error(/does not exist|schema cache/i.test(error.message) ? "Reminders need the database update — run db/supabase.sql." : error.message);
}

/** Stop reminders on this browser. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await createClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}
