/**
 * Public push-dispatch endpoint.
 *
 * Caller: the Postgres trigger `tg_notifications_dispatch_push` (via pg_net)
 *         after a row is inserted into public.notifications.
 * Auth:   `x-dispatch-secret` header must equal PUSH_TRIGGER_SECRET.
 * Body:   { notification_id: uuid }
 *
 * Process:
 *   1. Load notification row (service role) -> recipient user_id, title, body.
 *   2. Load all push_subscriptions for that user.
 *   3. web-push.sendNotification for each; prune 404/410 subscriptions.
 *
 * Runs on Cloudflare Workers with nodejs_compat — `web-push` uses Node crypto,
 * which is supported. No CORS — this endpoint is internal-by-secret.
 */

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/send-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const dispatchSecret = process.env.PUSH_TRIGGER_SECRET;
        const vapidPublic = process.env.VAPID_PUBLIC_KEY;
        const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
        const vapidSubject = process.env.VAPID_SUBJECT || "mailto:ops@sevajyothi.app";

        if (!dispatchSecret || !vapidPublic || !vapidPrivate) {
          return new Response("Push not configured", { status: 503 });
        }

        const given = request.headers.get("x-dispatch-secret");
        if (!given || given !== dispatchSecret) {
          return new Response("Forbidden", { status: 403 });
        }

        let body: { notification_id?: string } = {};
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const notificationId = body.notification_id;
        if (!notificationId || typeof notificationId !== "string") {
          return new Response("Missing notification_id", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: notif, error: notifErr } = await supabaseAdmin
          .from("notifications")
          .select("id, user_id, type, title, body, complaint_id")
          .eq("id", notificationId)
          .maybeSingle();
        if (notifErr || !notif) {
          return new Response("Notification not found", { status: 404 });
        }

        const { data: subs, error: subsErr } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth")
          .eq("user_id", notif.user_id);
        if (subsErr) return new Response("Subscriptions query failed", { status: 500 });
        if (!subs || subs.length === 0) {
          return Response.json({ delivered: 0, pruned: 0 });
        }

        const webpush = (await import("web-push")).default;
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
          subs.map(async (s) => {
            try {
              await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                payload,
                { TTL: 60 * 60 * 24 }
              );
              delivered++;
            } catch (err: any) {
              const status = err?.statusCode;
              if (status === 404 || status === 410) toPrune.push(s.id);
            }
          })
        );

        if (toPrune.length > 0) {
          await supabaseAdmin.from("push_subscriptions").delete().in("id", toPrune);
        }

        return Response.json({ delivered, pruned: toPrune.length });
      },
    },
  },
});

function routeForNotification(type: string | null, complaintId: string | null): string {
  if (!type) return "/";
  if (type === "assignment_alert") return "/technician";
  if (type === "new_complaint_alert") return "/admin";
  if (complaintId) return `/citizen?c=${complaintId}`;
  return "/citizen";
}
