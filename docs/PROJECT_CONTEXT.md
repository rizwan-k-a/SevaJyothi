# SEVAJYOTHI: DEFINITIVE ENGINEERING HANDBOOK & PROJECT CONTEXT

This document is the **single source of truth** for the SevaJyothi project. It is written exhaustively to allow any future engineering team or AI coding assistant (GitHub Copilot, Claude Code, Cursor, Gemini, etc.) to immediately assume development without losing project context.

---

## 1. PROJECT OVERVIEW
**Project Name**: SevaJyothi
**Project Vision**: Provide an ultra-reliable, offline-capable civic grievance reporting system for rural India, bridging the gap between citizens reporting infrastructure failures and the technicians deployed to fix them.
**Problem Statement**: Rural infrastructure fails frequently, but poor internet connectivity prevents citizens from reporting it reliably. Furthermore, managing field technicians in these low-connectivity zones is highly inefficient.
**Target Users**:
- **Citizens**: Rural residents with intermittent internet.
- **Technicians**: Field workers requiring geographic routing and offline capabilities.
- **Authorities/Admins**: Dispatchers managing approvals and system health.
**Primary Goals**: Never lose a complaint due to network failure, enforce strict Role-Based Access Control (RBAC), optimize technician battery/network usage, and deliver a premium glassmorphic UI.
**Current Completion Status**: Core engine complete. Production hardening (offline sync, GPS accuracy, strict RBAC) is finished.
**Major Features**: IndexedDB-backed offline queue, Service Worker background sync, throttled live GPS tracking, edge-function secured admin portals, and automated resolution workflows.

---

## 2. SYSTEM ARCHITECTURE
- **Frontend**: React 18, Vite, `@tanstack/react-router`, Tailwind CSS (oklch color spaces), Framer Motion, Lucide React.
- **Backend**: Supabase (PostgreSQL 15, GoTrue Auth, Storage, Deno Edge Functions).
- **Offline-First Architecture**: `idb` (IndexedDB) acts as the local source of truth for citizens. `OfflineProvider` monitors actual backend reachability (not just `navigator.onLine`).
- **Background Sync**: Service Worker intercepts `sj-flush-complaints` sync events to push data in the background.
- **Security Layer**: Row Level Security (RLS) secures direct DB reads/writes. Privileged operations (user deletion, role updates, offline media proxy) are pushed into server-side Supabase Edge Functions invoked via JWT.

---

## 3. DATABASE ARCHITECTURE (HIGH-LEVEL)
The database relies on a strict separation of concerns. Authentication is handled by `auth.users`. Authorization is handled by `public.user_roles`. Domain data lives in `public.complaints` and `public.complaint_events`. All tables are strictly locked down with RLS. (See Section 20 for exhaustive details).

---

## 4. AUTHENTICATION FLOW
- **Citizen Flow**: Signs up. Postgres Trigger automatically assigns the `citizen` role. Grants immediate access to `/citizen`.
- **Technician Flow**: Signs up. Trigger assigns the `technician` role but inserts them into `technician_applications` as `pending`. They are blocked from the dashboard until an Admin approves them.
- **Authority Flow**: Admins log in and are routed to `/admin`.
- **Route Protection**: The `AuthProvider` fetches roles globally. Protected routes check this context and render a `<Restricted />` fallback if the user lacks the required role.

---

## 5. OFFLINE-FIRST DESIGN (HIGH-LEVEL)
- **Philosophy**: Network availability is treated as a progressive enhancement. The app must function identically offline.
- **Implementation**: Complaints write to IndexedDB. The `OfflineProvider` polls a lightweight Supabase endpoint (`checkConnection()`) to verify true reachability, avoiding `navigator.onLine` false positives. Once reachable, the queue is flushed automatically. (See Section 23 for exhaustive details).

---

## 6. COMPLETE FEATURE LIST
- **Universal Auth**: Role-aware login/registration.
- **Citizen Dashboard**: List of historical reports with sync statuses.
- **Citizen Reporting Wizard**: 3-step offline-capable form (Category, Photo, High-Accuracy GPS).
- **Client-side Image Compression**: Reduces payload sizes for rural bandwidth.
- **Technician Dashboard**: Real-time job list (Supabase Channels) sorted by live Haversine distance.
- **Technician Resolution**: Job completion wizard (Notes, Photo upload).
- **Admin Dashboard**: User analytics and metrics.
- **Admin Technician Management**: Approve, Suspend, Restore, Delete workflows.
- **Developer Documentation**: Interactive in-app architectural docs (`/docs`).

---

## 7. CURRENT UI STRUCTURE
- **Design Language**: Glassmorphism (`.glass` backdrop-blur), rounded corners (`rounded-3xl`), vibrant `oklch` accents.
- **Layouts**: Mobile-first `Shell` component with a sticky bottom navigation bar respecting `env(safe-area-inset-bottom)`.
- **Views**:
  - `/citizen`: Citizen Portal.
  - `/technician`: Field Workspace.
  - `/admin`: Central Dispatch / Authority.
  - `/citizen/report`: Stepper-based wizard prioritizing thumb-reachability.

---

## 8. ALL IMPLEMENTED WORKFLOWS
- **Citizen Registration**: Unverified email -> Trigger -> Auto-login.
- **Technician Approval**: Admin clicks 'Approve' -> Edge Function -> Updates `technician_applications` -> Technician unlocked.
- **Complaint Creation**: Category -> Photo -> GPS (watchPosition) -> Save to IndexedDB -> Wait for network -> Flush to Supabase.
- **Complaint Resolution**: Technician selects job -> Uploads photo -> Edge Function bypasses strict RLS for offline sync -> Status changes to 'resolved'.
- **Admin User Management**: Admin selects user -> Calls Edge Function -> Safely modifies `auth.users` and `user_roles`.

---

## 9. MAJOR DECISIONS MADE (OVERVIEW)
- **Deno Edge Functions**: Used to completely eliminate insecure Postgres RPCs that historically accessed `auth.admin()`.
- **Custom RLS Path Parsing**: Supabase Storage RLS fails on 3-segment paths (`uid/folder/file`). We implemented custom `split_part()` logic to ensure technicians can only upload to their specific job folders.
- **Page Visibility API**: Used to aggressively throttle the technician's GPS `watchPosition` to save battery when the app is backgrounded.

---

## 10. ISSUES FIXED
- **Infinite React Re-renders**: Fixed deeply nested state updates in `OfflineProvider` by memoizing IndexedDB comparisons.
- **Admin RPC Privilege Escalation**: Eradicated a security flaw where frontend RPCs attempted to elevate privileges. Moved to Edge Functions.
- **RLS Storage Violations**: Fixed the infamous `new row violates row-level security policy` on technician uploads by deploying precise `db-patch` SQL fixes.
- **Trigger Crashes**: Fixed missing column references (`created_at`) in the `handle_new_user` Postgres trigger.
- **False "Online" States**: Replaced standard `navigator.onLine` with true HTTP backend pings.

---

## 11. KNOWN ISSUES (OVERVIEW)
- **Assignment UI**: Admins cannot currently assign complaints to technicians via the UI (must be done in DB).
- **Service Worker Lifecycle**: Workbox caching strategies require tuning for Vite/TanStack Router compatibility.
- **Technician Image Compression**: Only the citizen flow currently compresses images before upload. (See Section 27 for full list).

---

## 12. CURRENT STATUS
- **Production Ready**: JWT Auth, RBAC Triggers, Edge Functions, Offline Sync Engine, GPS Filtering algorithm, Storage RLS.
- **Requires Testing**: Real-world field testing of Background Sync on low-end Android devices.
- **Requires Implementation**: Job Assignment UI, Push Notifications.

---

## 13. DEVELOPMENT GUIDELINES (OVERVIEW)
- **Strict TypeScript**: Avoid `any`.
- **Security First**: Never modify the frontend to bypass an RLS error. Fix the RLS policy.
- **Component Colocation**: Keep components close to where they are used unless they are globally shared (`src/components/ui`). (See Section 26 for strict rules).

---

## 14. FUTURE ROADMAP (OVERVIEW)
- **Priority 1**: Admin Complaint Assignment UI based on geolocation.
- **Priority 2**: Technician-side image compression.
- **Priority 3**: Service Worker Push Notifications (FCM).

---

## 15. DEPLOYMENT GUIDE (OVERVIEW)
- **Build**: `npm run build`
- **Env**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **Edge**: `npx supabase functions deploy <name>`. (See Section 29 for full checklist).

---

## 16. AI HANDOFF (OVERVIEW)
(See Section 30 for the definitive Bootstrap Prompt).

---

## 17. COMPLETE PROJECT TIMELINE
1. **Initial Setup**: Scaffolded Vite + React + Tailwind. Integrated TanStack Router.
2. **Design System**: Implemented glassmorphic CSS variables and core UI shells.
3. **Authentication**: Integrated Supabase GoTrue. Disabled email verification for rural accessibility.
4. **RBAC Implementation**: Created Postgres triggers to assign roles. Built `user_roles` architecture.
5. **Offline Engine V1**: Implemented `idb` queue and `saveComplaint`.
6. **Technician Workflow**: Added real-time Supabase subscriptions and Haversine distance calculations.
7. **Admin Rewrite**: Discovered severe security flaws in RPCs. Migrated all privileged admin actions to Deno Edge Functions.
8. **Storage & RLS Fixes**: Addressed major blockers where technicians couldn't upload resolution photos. Authored transient `db-patch` edge functions to deploy raw SQL fixes.
9. **Production Hardening**: Rewrote `navigator.onLine` logic to use true backend pings. Integrated Page Visibility API to save battery on live tracking. Built the `SyncStatusScreen` state machine.

---

## 18. DECISION LOG
- **Decision**: Use Supabase instead of Firebase.
  - *Reason*: PostgreSQL provides robust relational integrity and RLS, which is vastly superior for complex civic data than NoSQL documents.
- **Decision**: Use IndexedDB (`idb`) over `localStorage`.
  - *Reason*: `localStorage` is synchronous, blocks the main thread, and has a 5MB limit (cannot hold Base64 images).
- **Decision**: Deno Edge Functions over Postgres RPCs for Admin tasks.
  - *Reason*: RPCs executing as `security definer` bypass RLS, opening massive security holes if input validation fails. Edge Functions provide a secure, isolated sandbox to verify JWTs before utilizing the `service_role` key.
- **Decision**: Technician Approval Workflow.
  - *Reason*: Prevents malicious actors from registering as technicians and marking critical infrastructure as "resolved".
- **Decision**: Citizens Bypass Approval.
  - *Reason*: Maximizes reporting volume. Bad data can be filtered by Admins later.
- **Decision**: Service Worker Background Sync.
  - *Reason*: Ensures complaints are synced even if the user closes the PWA immediately after hitting "Submit" while offline.

---

## 19. COMPLETE FILE MAP

**`src/`**
- `config/supabase.ts`: Initializes the singleton Supabase client.

**`src/components/`**
- `providers/AuthProvider.tsx`: Global auth state, session management, RBAC enforcement.
- `providers/OfflineProvider.tsx`: The heart of the offline engine. Manages IndexedDB queue state, backend connectivity pings, and the auto-flush lifecycle.
- `map/ComplaintMap.tsx`: Lazy-loaded interactive map for technicians.
- `ui/*`: Shared atomic components (buttons, inputs).

**`src/lib/`**
- `offline/db.ts`: Direct wrapper over IndexedDB. Handles CRUD for the local queue and contains the `flushPendingComplaints` logic.
- `offline/sync.ts`: Service worker registration and Background Sync API triggers.
- `image/compress.ts`: Canvas-based client-side image compression.

**`src/routes/`**
- `__root.tsx`: The master layout and provider boundary.
- `auth.tsx`: Auth wizard.
- `citizen.report.tsx`: The offline-first complaint wizard. Contains the advanced `watchPosition` GPS filtering algorithm.
- `technician.tsx`: The field dashboard. Contains the battery-optimized live tracking logic.
- `admin.technicians.tsx`: Admin data table interacting with the `admin` Edge Function.

**`supabase/functions/`**
- `admin/index.ts`: Secure user management (Approve/Suspend/Delete).
- `upload-media/index.ts`: Secure proxy for uploading offline-queued photos using `service_role` to bypass complex client-side RLS limitations during background syncs.
- `db-patch/index.ts`: Transient utility to execute SQL migrations without the Supabase CLI.

**`supabase/migrations/`**
- Contains the immutable chronological history of the database schema. **Never modify old migrations; always create new ones.**

---

## 20. COMPLETE DATABASE REFERENCE

**Table: `public.user_roles`**
- **Purpose**: Defines user authorization.
- **Columns**: `user_id` (PK, references auth.users), `role` (text).
- **RLS**: `SELECT` for authenticated users (own role only). `INSERT/UPDATE` disabled (handled by triggers).

**Table: `public.technician_applications`**
- **Purpose**: Holding pen for new technicians.
- **Columns**: `user_id` (PK), `status` (text), `created_at`.
- **RLS**: Technicians can `SELECT` own. Admins can `SELECT/UPDATE` all.

**Table: `public.complaints`**
- **Purpose**: Core entity.
- **Columns**: `id` (uuid, PK), `client_id` (text, UNIQUE, maps to IndexedDB id), `reporter_id` (uuid), `category` (text), `description` (text), `status` (text), `assigned_to` (uuid), `lat/lng` (float), `accuracy` (float), `photo_path` (text), `resolution_note` (text), `resolution_photo_path` (text).
- **RLS**: Citizens can `INSERT/SELECT` own. Technicians can `SELECT` assigned and `UPDATE` status/resolution fields.

**Table: `public.complaint_events`**
- **Purpose**: Audit log.
- **Columns**: `id`, `complaint_id`, `event`, `actor_id`, `meta`.
- **RLS**: `INSERT` allowed for related users.

**Triggers**:
- `handle_new_user`: Fires on `auth.users` INSERT. Reads `raw_user_meta_data` and populates `user_roles` and `technician_applications`.

---

## 21. COMPLETE API REFERENCE

**Edge Function: `admin`**
- **Purpose**: User management.
- **Input**: `{ action: 'approve' | 'suspend' | 'restore' | 'delete', targetUserId: string }`
- **Output**: `{ ok: true }` or `{ error: string }`
- **Permissions**: Verifies the invoking JWT has the `authority` role via `user_roles` lookup before proceeding.
- **Used by**: `/admin/technicians`

**Edge Function: `upload-media`**
- **Purpose**: Proxy offline photo uploads.
- **Input**: `{ path: string, dataUrl: string, contentType: string }`
- **Output**: `{ ok: true }`
- **Permissions**: Verifies JWT. Uses `service_role` to upload to Storage, bypassing client RLS.

**Storage API**:
- **Bucket**: `complaint-media`
- **Citizen Upload Path**: `[uid]/[client_id].jpg`
- **Technician Upload Path**: `[uid]/resolutions/[complaint_id].jpg`

---

## 22. SECURITY MODEL

- **Authentication**: Handled wholly by GoTrue. Passwords never touch our code.
- **Authorization**: Extracted from `auth.users` into `public.user_roles` to allow foreign key relations and RLS enforcement.
- **RLS Philosophy**: "Default Deny". Every table has RLS enabled. If a policy isn't explicitly written, access is denied.
- **Role Hierarchy**: 
  - `authority`: Full read/write over complaints, read/update over users.
  - `technician`: Read assigned complaints, update resolution fields only.
  - `citizen`: Read/write strictly their own data.
- **Storage Policies**: Enforced using `split_part(name, '/', 1) = (select auth.uid()::text)`. Ensure files are sandboxed by user ID.

---

## 23. OFFLINE ENGINE (DEEP DIVE)

- **Queue Lifecycle**: User clicks "Submit" -> `saveComplaint(idb)` -> `OfflineProvider` state updates -> UI shows "Queued" -> `OfflineProvider` polls `checkConnection()` -> If true, invokes `flushNow()`.
- **Connectivity Detection**: `navigator.onLine` is untrustworthy. We execute `supabase.from("profiles").select("id").limit(1)`. If it returns without a network error, the backend is reachable.
- **Conflict Handling**: `complaints.client_id` has a `UNIQUE` constraint. Upserts (`onConflict: 'client_id'`) ensure that if a background sync and foreground sync race, no duplicates are created.
- **Retry Strategy**: Exponential backoff array: `[1, 2, 5, 10, 30]`. Failed items increment `attempt_count` and set `next_retry_at`.
- **Service Worker**: Registers `sj-flush-complaints` with the browser's Background Sync API. Wakes up the app silently to trigger `flushNow()`.

---

## 24. MAP ENGINE

- **Location Acquisition**: We do not use single-shot `getCurrentPosition`. We use a 10-second `watchPosition` window to collect multiple readings.
- **GPS Accuracy Filtering**: The app stores the reading with the *lowest* accuracy radius (in meters). Readings > 100m are rejected unless no better reading is found before the timeout.
- **Technician Live Tracking**: Uses `watchPosition` throttled to 5-second state updates. Heavily optimized by binding to `document.addEventListener("visibilitychange")`—tracking completely stops when the app goes to the background to save battery.

---

## 25. UI DESIGN SYSTEM

- **Color Palette**: `oklch` based. `primary` (vibrant blue/purple), `accent` (bright pink/orange), `success`, `warning`, `danger`.
- **Glassmorphism**: `.glass` utility applies `bg-white/40`, `backdrop-blur-md`, and custom border highlights.
- **Typography**: Inter/Outfit. Massive display headers (`text-display text-[clamp(...)]`).
- **Cards**: Heavy padding (`p-6`), rounded corners (`rounded-3xl`), subtle hover scaling (`whileTap={{ scale: 0.97 }}`).
- **Responsive Rules**: Mobile-first. Inputs and buttons are massive (min-height 48px) to accommodate field workers using the app outdoors with dirty hands.

---

## 26. CODING RULES (STRICT DIRECTIVES FOR AI)

1. **NEVER BYPASS RLS**: If a database write fails due to an RLS policy, FIX THE POLICY in a migration file. Do not alter the frontend to "hack" around it.
2. **NEVER EXPOSE `service_role`**: The service role key is strictly for Edge Functions. Never place it in Vite environment variables.
3. **PRESERVE OFFLINE-FIRST**: Never write a direct `supabase.from('complaints').insert()` in the Citizen report flow. It MUST go through `saveComplaint()` in IndexedDB first.
4. **THROTTLE SENSORS**: Never bind `watchPosition` without a timeout or throttle. Respect the technician's battery.
5. **KEEP BACKEND AUTHORITATIVE**: The frontend UI state (e.g., `<Restricted />`) is a convenience. The true security is the RLS policy.
6. **NO DUPLICATE LOGIC**: Use existing hooks (`useAuth`, `useOffline`) and utilities (`compressImageFile`).

---

## 27. KNOWN LIMITATIONS

1. **Tech Debt**: Admin Complaint Assignment UI is missing. Admins must assign jobs via direct DB interaction.
2. **Feature**: Technician images are uploaded uncompressed. This wastes bandwidth.
3. **Feature**: No push notifications. Technicians must open the app to see new jobs (though realtime sockets work while open).
4. **Priority Order**: 1. Assignment UI. 2. Technician Image Compression. 3. Push Notifications.

---

## 28. NEXT DEVELOPMENT TASKS (BACKLOG)

1. **Priority 1: Admin Assignment UI**
   - *Description*: Build a view in `/admin` to list unassigned complaints and assign them to active technicians.
   - *Dependencies*: `user_roles` (fetch active techs), `complaints` (update `assigned_to`).
   - *Complexity*: Medium.

2. **Priority 2: Technician Photo Compression**
   - *Description*: Apply `compressImageFile()` in `technician.tsx` before uploading resolution photos.
   - *Dependencies*: `src/lib/image/compress.ts`.
   - *Complexity*: Low.

3. **Priority 3: Service Worker Push (FCM)**
   - *Description*: Integrate Firebase Cloud Messaging or Web Push API to alert technicians of new assignments.
   - *Dependencies*: Service worker modifications, Edge Function trigger on `complaints` UPDATE.
   - *Complexity*: High.

---

## 29. DEPLOYMENT CHECKLIST

- [ ] **Database**: All migrations applied successfully. Triggers active.
- [ ] **Storage**: `complaint-media` bucket created.
- [ ] **Authentication**: Email confirmations disabled (or configured with SMTP if required later).
- [ ] **Edge Functions**: `admin`, `upload-media`, `db-patch` deployed with secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- [ ] **Environment**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` populated in production hosting (Vercel/Netlify).
- [ ] **PWA**: Manifest verified. Icons present.
- [ ] **Security**: Review RLS policies. Ensure no tables are public read/write.

---

## 30. AI BOOTSTRAP PROMPT

**Copy and paste the exact text below into ANY AI coding assistant to bootstrap it with full project context:**

```text
You are joining the development of "SevaJyothi", a React 18, Vite, TanStack Router, and Supabase application. 

**CRITICAL PREREQUISITE**: Before writing a single line of code, you MUST thoroughly read the `PROJECT_CONTEXT.md` file located in the root directory. It is the definitive engineering specification for this project.

**Core Directives**:
1. **Architecture**: We use a strict Offline-First architecture backed by IndexedDB. Do NOT bypass IndexedDB for citizen complaints.
2. **Security**: We use strict PostgreSQL Row Level Security (RLS) and Deno Edge Functions for privileged actions. NEVER bypass RLS by hacking the frontend, and NEVER expose the `service_role` key to the client.
3. **Coding Style**: Use Tailwind, Lucide React, and Framer Motion. Follow the glassmorphism design language (`.glass`).
4. **Execution**: Read the existing files you need to modify first. Do not rewrite completed modules or duplicate existing logic (e.g., use existing Context Providers).
5. **Goal**: Proceed with the user's prompt, asking for clarification only if the request fundamentally violates the rules outlined in `PROJECT_CONTEXT.md`.
```

---
*End of Document. SevaJyothi Engineering Handbook - Final Revision.*
