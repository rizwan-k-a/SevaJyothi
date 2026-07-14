/**
 * Browser-side push subscription manager.
 *
 * Lifecycle:
 *   1. Register dedicated messaging worker at /push-sw.js (own scope).
 *   2. Ask the user for Notification permission (only on explicit click).
 *   3. Call pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC_KEY }).
 *   4. Persist endpoint + keys into public.push_subscriptions (RLS = own user).
 *
 * Safe to call multiple times — idempotent on the user's existing subscription.
 */

import { supabase } from "@/config/supabase";

// Public VAPID key — safe to ship in client bundle.
const VAPID_PUBLIC_KEY =
  "BKHT32eA_AK9YWZdF6xSkKazKNKD1eWWQc9igT0IX09yLeMv_S20VHsbaBzZfS8qoDo7rViE-5ZLQLLfiykUfoY";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushPermission(): NotificationPermission {
  if (!pushSupported()) return "denied";
  return Notification.permission;
}

export async function registerPushWorker(): Promise<ServiceWorkerRegistration> {
  if (!pushSupported()) throw new Error("Push not supported on this device");
  // Dedicated scope = "/push-sw.js" so it never collides with any app-shell worker.
  const existing = await navigator.serviceWorker.getRegistration("/push-sw.js");
  if (existing) return existing;
  return navigator.serviceWorker.register("/push-sw.js", { scope: "/push-sw.js" });
}

export async function subscribeToPush(): Promise<{
  status: "subscribed" | "denied" | "unsupported";
}> {
  if (!pushSupported()) return { status: "unsupported" };

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { status: "denied" };

  const reg = await registerPushWorker();

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
    });
  }

  const json = sub.toJSON();
  const endpoint = json.endpoint!;
  const p256dh = json.keys?.p256dh || arrayBufferToBase64(sub.getKey("p256dh"));
  const auth = json.keys?.auth || arrayBufferToBase64(sub.getKey("auth"));

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { status: "denied" };

  await supabase.from("push_subscriptions").upsert(
    {
      user_id: uid,
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  return { status: "subscribed" };
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  }
}
