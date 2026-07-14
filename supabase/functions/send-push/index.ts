/**
 * send-push Edge Function
 *
 * Caller: Postgres trigger tg_notifications_dispatch_push (via pg_net)
 *         after a row is inserted into public.notifications.
 * Auth:   withSupabase({ auth: 'secret' }) — caller sends SUPABASE_SECRET_KEY in apikey header.
 *         Additionally validates x-dispatch-secret header for extra security.
 * Body:   { notification_id: uuid }
 *
 * Process:
 *   1. Load notification row (supabaseAdmin) → recipient user_id, title, body.
 *   2. Load all push_subscriptions for that user.
 *   3. web-push sendNotification for each; prune 404/410 subscriptions.
 */

import { withSupabase } from "npm:@supabase/server";
import webpush from "npm:web-push";

function routeForNotification(type: string | null, complaintId: string | null): string {
  if (!type) return "/";
  if (type === "assignment_alert") return "/technician";
  if (type === "new_complaint_alert") return "/admin";
  if (complaintId) return `/citizen?c=${complaintId}`;
  return "/citizen";
}

export default {
  fetch: withSupabase({ auth: "secret:*" }, async (req, ctx) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { status: 204 });
    }

    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    // Secondary dispatch-secret check (defence in depth)
    const dispatchSecret = Deno.env.get("PUSH_TRIGGER_SECRET");
    if (dispatchSecret) {
      const given = req.headers.get("x-dispatch-secret");
      if (!given || given !== dispatchSecret) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:ops@sevajyothi.app";

    if (!vapidPublic || !vapidPrivate) {
      return Response.json({ error: "Push not configured — VAPID keys missing" }, { status: 503 });
    }

    let body: { notification_id?: string } = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const notificationId = body.notification_id;
    if (!notificationId || typeof notificationId !== "string") {
      return Response.json({ error: "Missing notification_id" }, { status: 400 });
    }

    // Load notification
    const { data: notif, error: notifErr } = await ctx.supabaseAdmin
      .from("notifications")
      .select("id, user_id, type, title, body, complaint_id")
      .eq("id", notificationId)
      .maybeSingle();

    if (notifErr || !notif) {
      return Response.json({ error: "Notification not found" }, { status: 404 });
    }

    // Load push subscriptions for this user
    const { data: subs, error: subsErr } = await ctx.supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", notif.user_id);

    if (subsErr) {
      return Response.json({ error: "Subscriptions query failed" }, { status: 500 });
    }

    if (!subs || subs.length === 0) {
      return Response.json({ delivered: 0, pruned: 0 });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const payload = JSON.stringify({
      title: notif.title,
      body: notif.body,
      type: notif.type,
      complaint_id: notif.complaint_id,
      url: routeForNotification(notif.type, notif.complaint_id),
    });

    let delivered = 0;
    const toPrune: string[] = [];

    await Promise.all(
      subs.map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 60 * 60 * 24 },
          );
          delivered++;
        } catch (err: any) {
          const status = err?.statusCode;
          if (status === 404 || status === 410) toPrune.push(s.id);
        }
      }),
    );

    if (toPrune.length > 0) {
      await ctx.supabaseAdmin.from("push_subscriptions").delete().in("id", toPrune);
    }

    return Response.json({ delivered, pruned: toPrune.length });
  }),
};
