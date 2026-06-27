# SevaJyothi — Deployment & Backend Migration Runbook

## 1. Architecture at a glance

```
 Browser (PWA, IndexedDB, push-sw.js)
        │  HTTPS
        ▼
 TanStack Start server  ── /api/public/*  ──▶  External webhooks (push dispatcher)
        │
        ▼
 Backend provider (src/lib/backend/backendProvider.ts)
        │
        ├──▶ lovableAdapter   → Lovable Cloud (Supabase managed)        [default]
        ├──▶ supabaseAdapter  → BYO Supabase project
        ├──▶ selfHostedAdapter→ supabase/docker on your VM / k8s
        └──▶ postgresAdapter  → raw Postgres + S3 + custom auth
```

Switch providers by setting `VITE_BACKEND_PROVIDER` at build time. UI
components import only `backend` from `backendProvider.ts` and never reach
into vendor SDKs directly, so swapping vendors is a build-time change.

## 2. Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` | client | browser Data API + Realtime |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` | server | server fns acting as user |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | webhooks / privileged maintenance |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | server | Web Push signing |
| `PUSH_DISPATCH_SECRET` / `PUSH_TRIGGER_SECRET` | server | trigger → dispatcher auth |
| `VITE_BACKEND_PROVIDER` | build | `lovable` \| `supabase` \| `self-hosted` \| `postgres` |

## 3. Docker / self-host (provider = `self-hosted`)

```bash
cp .env.example .env             # fill in SUPABASE_* and VAPID_* values
docker compose up -d --build
docker compose exec db psql -U sevajyothi -d sevajyothi -f /docker-entrypoint-initdb.d/<latest>.sql
```

`supabase/migrations/*.sql` are mounted into the Postgres container's
`initdb` directory; on first boot they run in order. For subsequent
migrations, apply them with the Supabase CLI (`supabase db push`) or
`psql -f`.

## 4. Database migration strategy (Lovable Cloud → self-host)

1. **Schema** — every change in this repo lives in `supabase/migrations/`
   and is idempotent. Replay on the new database with `supabase db push`
   or `psql -f`. The migrations include: tables, RLS, GRANTs, triggers,
   analytics functions (`admin_complaint_stats_v2`, `_v3`,
   `admin_complaint_hotspots`), and the `private` schema for
   security-definer helpers.
2. **Data** — dump tables you want to keep: `pg_dump --data-only
   --table=public.complaints --table=public.profiles --table=public.user_roles
   <src_db_url> | psql <dst_db_url>`. Auth rows (`auth.users`) move via
   the Supabase Auth Admin API (`createUser` with `email_confirm: true`)
   so password hashes regenerate cleanly.
3. **Verify** — run `SELECT count(*) FROM public.complaints;` on both
   sides, then sample three rows per table.

## 5. Storage migration

The `complaint-media` bucket is private. To move it:

```bash
supabase storage download --bucket complaint-media --recursive ./media
# create the bucket on the destination, then:
supabase storage upload   --bucket complaint-media --recursive ./media
```

For S3-backed self-hosts, run `mc mirror` between the two object stores.
The bucket name and key layout (`<user_id>/<complaint_id>/<file>`) is
identical across adapters, so signed URLs continue to work.

## 6. Realtime migration

Realtime is provided by Supabase's Realtime service. On a self-host the
publication is recreated by the migrations
(`ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;`).
For the `postgresAdapter`, swap the client subscription for either
Postgres `LISTEN/NOTIFY` (server fan-out via SSE) or a managed broker
(NATS, Redis pub/sub). The UI only consumes `backend.subscribeComplaints`,
so this is a single-file change.

## 7. Auth migration

- **Lovable / Supabase / self-hosted Supabase** — GoTrue handles
  email/password. Sessions persist in `localStorage` as
  `sb-<project>-auth-token`. Re-issue VAPID + provider keys per env.
- **postgresAdapter** — implement `signIn` / `signUp` against your IdP
  (e.g. Keycloak, Auth0). Mint a JWT whose `sub` matches `public.profiles.id`
  so RLS policies on `auth.uid()` keep working.

## 8. Push migration

`public/push-sw.js` and `src/routes/api/public/send-push.ts` are vendor
neutral; they need only VAPID keys and a URL to POST to. The Postgres
trigger `private.tg_notifications_dispatch_push` POSTs to that route via
`pg_net.http_post`; update the URL inside the migration when you move
hosts.

## 9. Rollback

Every migration is reversible via the prior file's
`DROP …`/`ALTER … DROP` mirror. Keep the previous app container image
tagged (`sevajyothi:prev`) so `docker compose up -d --build` can be
rolled back with one `docker compose up -d --no-deps sevajyothi:prev`.

## 10. Operational checks

- `GET /api/public/health` (add if needed) → 200
- `SELECT admin_complaint_stats_v3();` returns within 200 ms on warm cache
- `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;`
- Push: trigger `notifications` insert → dispatcher log shows 201 to subscriber
