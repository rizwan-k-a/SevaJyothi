# DO NOT TOUCH: REGRESSION-PREVENTION HANDBOOK

This document identifies the most critical and fragile parts of the SevaJyothi codebase. Future AI assistants must treat these modules as highly sensitive. 

This is **NOT** documentation. This is a catalog of fragile modules that have historically caused regressions. Modifying these sections without understanding their deep inter-dependencies will break the application.

---

## 1. Authentication Flow
- **Files Involved**: `src/components/providers/AuthProvider.tsx`, `src/routes/auth.tsx`
- **Purpose**: Global state management for Supabase sessions and RBAC role fetching.
- **Why it is fragile**: The `user_roles` check is completely separate from the GoTrue session. A race condition exists between the auth state changing and the role being fetched from the database.
- **What breaks if modified incorrectly**: Users get locked out, stuck on "Loading...", or routed to restricted screens because their role isn't loaded before the route transitions.
- **Safe modifications**: Styling updates to the Auth wizard.
- **Unsafe modifications**: Refactoring `supabase.auth.onAuthStateChange` or removing the `user_roles` query from the provider.
- **Known historical bugs**: React infinite render loop caused by setting state without equality checks during session refresh.
- **Verification**: Verify Citizen login, Technician login, Admin login.

## 2. Route Configuration
- **Files Involved**: `src/routes/__root.tsx`, `src/routes/*.tsx`
- **Purpose**: TanStack file-based routing architecture.
- **Why it is fragile**: Routes are dynamically typed based on the file tree. Protected routes rely on Context data that must be fully hydrated.
- **What breaks if modified incorrectly**: TypeScript compiler fails to generate the route tree. Users can access `/admin` or `/technician` without proper roles if the protective boundaries are removed.
- **Safe modifications**: Adding new leaf nodes (e.g., `/docs/new`).
- **Unsafe modifications**: Modifying the `Loader` functions in `__root.tsx` without understanding the AuthProvider initialization.
- **Verification**: Build command passes. No TS routing errors.

## 3. OfflineProvider
- **Files Involved**: `src/components/providers/OfflineProvider.tsx`
- **Purpose**: Manages the IndexedDB queue, connectivity detection, and auto-flush lifecycle.
- **Why it is fragile**: Handles complex async loops, exponential backoff, and network polling within a React `useEffect`.
- **What breaks if modified incorrectly**: Infinite background flushes, React re-render loops, false "online" positives that cause the app to hang trying to upload to unreachable endpoints.
- **Safe modifications**: Altering the toast messages for success/failure.
- **Unsafe modifications**: Removing the `checkConnection` backend ping or disabling the `flushing.current` re-entry guard lock.
- **Known historical bugs**: `navigator.onLine` returned `true` on dead WiFi, causing the app to lock up during sync attempts. Fixed by implementing a lightweight backend ping (`supabase.from("profiles").limit(1)`).
- **Verification**: Toggle network offline -> submit -> toggle online -> verify auto-flush without duplicate entries.

## 4. IndexedDB Queue
- **Files Involved**: `src/lib/offline/db.ts`
- **Purpose**: Source of truth for citizen complaints before they reach Supabase.
- **Why it is fragile**: Runs completely decoupled from React state. Schema upgrades are catastrophic if not handled gracefully.
- **What breaks if modified incorrectly**: Loss of citizen grievance data if the store is dropped or if `flushPendingComplaints` throws unhandled promise rejections.
- **Safe modifications**: Adding new priority constants or adjusting the exponential backoff array values.
- **Unsafe modifications**: Changing the `id` generation logic or altering the schema version without a proper upgrade path.
- **Verification**: Queue 5 complaints offline. Ensure all 5 persist after a hard page refresh.

## 5. Background Sync
- **Files Involved**: `src/lib/offline/sync.ts`, `public/sw.js`
- **Purpose**: Wakes up the app to flush the IndexedDB queue when the OS detects a network connection, even if the user closed the tab.
- **Why it is fragile**: Background Sync API is highly browser-dependent and notoriously difficult to debug.
- **What breaks if modified incorrectly**: Syncs fail silently when the app is in the background.
- **Safe modifications**: Adding telemetry logs to the sync event.
- **Unsafe modifications**: Removing the `postMessage` bridge between the Service Worker and the client window.
- **Verification**: Test the `sj-flush-complaints` sync tag via Chrome DevTools.

## 6. Service Worker
- **Files Involved**: `public/sw.js`
- **Purpose**: Handles PWA asset caching and intercepts the Background Sync event.
- **Why it is fragile**: Aggressive caching can trap users on old versions of the app indefinitely.
- **What breaks if modified incorrectly**: Blank screens, stale CSS, or complete PWA installation failure.
- **Safe modifications**: Updating the cache key version string.
- **Unsafe modifications**: Implementing a `CacheFirst` strategy on API endpoints (e.g., Supabase URLs).
- **Verification**: Verify Lighthouse PWA score and `npm run build` behavior.

## 7. Complaint Submission
- **Files Involved**: `src/routes/citizen.report.tsx`
- **Purpose**: The 3-step citizen wizard.
- **Why it is fragile**: Orchestrates image compression, GPS acquisition, and IndexedDB insertion synchronously.
- **What breaks if modified incorrectly**: Base64 images become too large for IndexedDB, or GPS locking times out and prevents submission entirely.
- **Safe modifications**: Changing wizard copy, adjusting colors.
- **Unsafe modifications**: Bypassing `compressImageFile` (which destroys rural bandwidth) or calling `supabase.from('complaints').insert()` directly instead of writing to IndexedDB.
- **Verification**: Submit a complaint with a 5MB image offline. Verify compression logs and IndexedDB write.

## 8. Complaint Resolution
- **Files Involved**: `src/routes/technician.tsx`
- **Purpose**: Allows technicians to upload proof of work.
- **Why it is fragile**: Relies on a highly specific 3-segment storage path (`uid/resolutions/job_id.jpg`) that must match the RLS policy exactly.
- **What breaks if modified incorrectly**: `new row violates row-level security policy` error on upload.
- **Safe modifications**: Updating the resolution notes text area UI.
- **Unsafe modifications**: Altering the path structure in `upload()` without simultaneously updating the database RLS.
- **Known historical bugs**: Failed to upload due to complex RLS limitations; solved by authoring exact `split_part` RLS policies.
- **Verification**: Technician logs in -> uploads photo -> status updates to 'resolved'.

## 9. Admin Edge Function
- **Files Involved**: `supabase/functions/admin/index.ts`
- **Purpose**: A secure proxy for `auth.admin.*` user management functions.
- **Why it is fragile**: It acts as the ultimate security gatekeeper.
- **What breaks if modified incorrectly**: Massive privilege escalation vulnerability. Any user could potentially suspend or delete other users.
- **Safe modifications**: Adding more logging to the function.
- **Unsafe modifications**: Removing the JWT verification, removing the `user_roles` `authority` check.
- **Known historical bugs**: Original frontend RPC implementation allowed privilege escalation. Rewritten securely into this Deno Edge function.
- **Verification**: Attempt to call the Edge function using a Citizen JWT. Verify it rejects with a 403.

## 10. Technician Approval Pipeline
- **Files Involved**: Database Triggers (`handle_new_user`), `user_roles`, `technician_applications`.
- **Purpose**: Prevents malicious actors from claiming to be technicians.
- **Why it is fragile**: Spans three database tables via automated Postgres triggers.
- **What breaks if modified incorrectly**: Technicians never get marked 'pending', completely locking them out forever, or auto-approve immediately.
- **Safe modifications**: Changing the frontend "Pending Approval" screen UI.
- **Unsafe modifications**: Modifying the trigger logic in SQL without understanding how `raw_user_meta_data` is injected during signup.
- **Verification**: Register a tech -> check `technician_applications` row exists -> Admin approves -> Tech can access dashboard.

## 11. RLS Policies
- **Files Involved**: All SQL migrations.
- **Purpose**: The absolute floor of the security model.
- **Why it is fragile**: Syntax is complex. A single `OR` instead of an `AND` can leak the entire database.
- **What breaks if modified incorrectly**: Data leaks, or massive `violates row-level security policy` errors that crash the app for legitimate users.
- **Safe modifications**: None. Never touch unless requested.
- **Unsafe modifications**: Changing `auth.uid()` checks, adding `true` fallbacks.
- **Verification**: Ensure citizens can only read their own rows in `complaints`.

## 12. Storage Policies
- **Files Involved**: SQL migrations targeting `storage.objects`.
- **Purpose**: Secures `complaint-media`.
- **Why it is fragile**: Supabase `storage.foldername()` fails on paths deeper than 2 levels.
- **What breaks if modified incorrectly**: Technicians cannot upload resolution photos.
- **Safe modifications**: None.
- **Unsafe modifications**: Altering the `split_part(name, '/', N)` logic.
- **Known historical bugs**: The primary cause of the critical Technician Resolution bug. Fixed via precise `split_part` logic in `db-patch`.
- **Verification**: Upload to `uid/resolutions/jobid.jpg`.

## 13. User Roles
- **Files Involved**: `public.user_roles`
- **Purpose**: Defines RBAC.
- **Why it is fragile**: Joined globally across almost all RLS policies.
- **What breaks if modified incorrectly**: Entire system locks down.
- **Safe modifications**: Adding new roles to the enum structure.
- **Unsafe modifications**: Allowing client-side `INSERT` into `user_roles`.
- **Verification**: Only the `service_role` (via trigger or edge function) should be able to write to this table.

## 14. GPS/Location Services
- **Files Involved**: `src/routes/citizen.report.tsx`, `src/routes/technician.tsx`
- **Purpose**: Acquires geo-coordinates for complaints and technician routing.
- **Why it is fragile**: Drains mobile battery heavily if left on. GPS hardware can return absurdly inaccurate results initially.
- **What breaks if modified incorrectly**: Technicians' batteries die in hours, or complaints are logged miles away from reality.
- **Safe modifications**: UI formatting of the coordinates.
- **Unsafe modifications**: Removing the 10-second `watchPosition` filtering logic or the `visibilitychange` throttle.
- **Verification**: Check accuracy display formats properly (±X m) and updates throttle on backgrounding.

## 15. ComplaintMap
- **Files Involved**: `src/components/map/ComplaintMap.tsx`
- **Purpose**: Renders the Leaflet/Mapbox instance.
- **Why it is fragile**: Heavy dependency, lazy-loaded to prevent slowing down initial JS parse.
- **What breaks if modified incorrectly**: The entire technician dashboard crashes if the map component fails to load while offline.
- **Safe modifications**: Altering marker colors.
- **Unsafe modifications**: Removing the `Suspense` boundary and `lazy()` import in `technician.tsx`.
- **Known historical bugs**: Map crashed the app when initialized offline. Fixed by lazy-loading with an offline fallback component.
- **Verification**: Turn off network, load technician dashboard, verify fallback UI renders instead of crashing.

## 16. Floating Navigation
- **Files Involved**: `Shell` component.
- **Purpose**: Bottom tab bar for mobile navigation.
- **Why it is fragile**: Bound to iOS/Android safe areas (`env(safe-area-inset-bottom)`).
- **What breaks if modified incorrectly**: Buttons become unclickable because they render underneath the iOS home indicator.
- **Safe modifications**: Icon swaps.
- **Unsafe modifications**: Removing the `calc()` padding values in the `Shell` layout.
- **Verification**: Test on iOS Safari simulator to ensure the bottom bar isn't obscured.

## 17. Admin/User Management
- **Files Involved**: `src/routes/admin.technicians.tsx`
- **Purpose**: The UI for calling the Admin Edge Function.
- **Why it is fragile**: Handles complex paginated data fetching and optimistic UI updates for suspensions/approvals.
- **What breaks if modified incorrectly**: The UI desyncs from the database state, showing a user as "Active" when they are suspended.
- **Safe modifications**: Table styling.
- **Unsafe modifications**: Removing the `mutate` calls that refetch the user list after an Edge Function completes.
- **Verification**: Suspend a user. Ensure they disappear from the "Active" tab and appear in the "Suspended" tab immediately.

## 18. Database Migrations
- **Files Involved**: `supabase/migrations/*.sql`
- **Purpose**: The immutable history of the schema.
- **Why it is fragile**: Modifying a past migration destroys the ability to build the database from scratch locally.
- **What breaks if modified incorrectly**: Local Supabase CLI `start` commands fail completely.
- **Safe modifications**: None.
- **Unsafe modifications**: Editing any existing `.sql` file.
- **Verification**: `npx supabase db reset` must pass.

## 19. Edge Functions
- **Files Involved**: `supabase/functions/*/index.ts`
- **Purpose**: Secure server-side execution.
- **Why it is fragile**: Deno execution environment differs from Node. Requires specific JWT passing structures.
- **What breaks if modified incorrectly**: CORS errors, 500 Internal Server Errors that the frontend cannot decipher.
- **Safe modifications**: Extracting logic into utility files inside the function directory.
- **Unsafe modifications**: Altering the `corsHeaders` responses to `OPTIONS` requests.
- **Verification**: Edge function returns `200 OK`.

## 20. Environment Variables
- **Files Involved**: `.env`
- **Purpose**: Holds Supabase URLs and Keys.
- **Why it is fragile**: The app cannot start without them.
- **What breaks if modified incorrectly**: Complete failure of the Supabase client initialization.
- **Safe modifications**: Adding new non-secret `VITE_` variables.
- **Unsafe modifications**: Adding the `SERVICE_ROLE_KEY` to the Vite environment.
- **Verification**: `npm run build` succeeds and client connects to DB.

---

## ========================
## REGRESSION CHECKLIST
## ========================

Every future AI MUST verify this checklist before considering a task complete:

- [ ] `npm run build` passes
- [ ] TypeScript passes
- [ ] No React warnings
- [ ] No console errors
- [ ] Citizen registration works
- [ ] Citizen login works
- [ ] Technician registration routes to 'Pending'
- [ ] Technician approval unlocks dashboard
- [ ] Complaint creation writes to DB (or queue if offline)
- [ ] Complaint assignment is valid
- [ ] Complaint resolution succeeds without RLS errors
- [ ] Offline queue persists across reloads
- [ ] Automatic sync fires when the backend is reachable
- [ ] Background sync wakes the app via Service Worker
- [ ] GPS location filters for best accuracy
- [ ] Map renders or falls back gracefully
- [ ] Admin dashboard analytics load
- [ ] User Administration (Suspend/Restore) works
- [ ] Edge Functions return HTTP 200
- [ ] Storage uploads succeed for all roles
- [ ] RLS policies prevent cross-tenant reads
- [ ] Service Worker installs without cache errors
- [ ] PWA install prompt is available
- [ ] Mobile responsiveness is maintained

---

## ========================
## PROJECT STABILITY SCORE
## ========================

### 1. Offline Sync Engine: 9/10
*Very Stable, Highly Complex.* 
The auto-flush and background sync logic is rock solid after implementing the backend reachability ping, but the asynchronous flow makes it inherently sensitive to naive refactoring. **Modify with extreme caution.**

### 2. Authentication & RBAC: 10/10
*Extremely Stable.*
Postgres triggers and Edge Functions completely lock down the role management. It is virtually impenetrable as long as the Edge Function JWT validations are not altered.

### 3. Database RLS Policies: 8/10
*Stable, but Fragile.*
The storage policies specifically rely on complex string parsing (`split_part`) to validate 3-segment paths. Any change to the storage bucket folder structure requires a corresponding, highly precise SQL migration. **Modify with extreme caution.**

### 4. UI / Design System: 9/10
*Very Stable, Low Risk.*
The atomic components and `.glass` utilities are highly reusable. Safe to modify and extend as long as mobile safe-areas are respected.

### 5. GPS & Location Engine: 7/10
*Functional, Moderately Sensitive.*
The filtering algorithm correctly rejects poor fixes and the throttling saves battery. However, geolocation APIs behave radically differently across iOS Safari and Android Chrome in background states. Minor tweaks can cause massive battery regressions. **Modify with caution.**

### Highest-Risk Areas
1. **`OfflineProvider.tsx`**: Do not touch the `useEffect` async synchronization loops.
2. **`supabase/functions/admin`**: Do not touch the security JWT validation logic.
3. **Storage RLS Policies**: Do not touch the `split_part` logic without extensive manual testing.

**This document must become the permanent regression-prevention handbook for SevaJyothi.**
