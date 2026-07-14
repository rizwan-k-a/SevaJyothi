# AI SESSION HISTORY

This document preserves the reasoning, journey, and architectural evolution of SevaJyothi. It is written to give future AI coding assistants deep context into *why* the codebase is structured the way it is, beyond just reading the code itself.

## Phase 1: Inception & The Offline-First Mandate
The project began with a strict mandate: SevaJyothi must work for rural citizens regardless of network connectivity. 
**Idea Abandoned**: Initially, we considered a simple "try/catch" graceful degradation where the app would alert the user to "try again later" if offline.
**Why Abandoned**: High friction leads to abandonment. We realized the app had to *guarantee* submission. 
**Final Architecture**: We built an IndexedDB layer (`idb`) that acts as the absolute source of truth. The React frontend writes to `idb` and assumes success. The `OfflineProvider` polls the backend and automatically flushes the queue when a true connection is established.

## Phase 2: Authentication & RBAC Challenges
We implemented Supabase Auth. We needed three distinct roles: Citizen, Technician, and Authority.
**Mistake Made**: We attempted to store roles in `auth.users` raw metadata and relied on client-side Postgres RPCs executed as `auth.uid()` to approve technicians and manage roles.
**Bug Discovered**: This created a massive privilege escalation flaw. Because the RPCs were trying to execute actions they didn't have permission for, they either failed silently or required `SECURITY DEFINER` (which is highly insecure if input isn't sanitized perfectly).
**Redesign**: We ripped out all admin-related RPCs. We scaffolded Deno Edge Functions (`/supabase/functions/admin`) which act as secure proxies. The Edge Function verifies the caller's JWT, checks their role in `user_roles`, and only then uses the `service_role` key to modify `auth.users` safely.

## Phase 3: The Storage RLS Nightmare
With technicians in the field, we needed them to upload resolution photos. The storage path was defined as `technician_id/resolutions/job_id.jpg`.
**Bug Discovered**: Technicians were continually hit with `new row violates row-level security policy`. 
**Why it happened**: Supabase's built-in `storage.foldername()` function is hardcoded to return a 2-segment array (uid, filename). It completely choked on our 3-segment path.
**Lesson Learned**: Relying on built-in helper functions for complex bucket structures in Supabase is dangerous. 
**Fix**: We wrote a transient `db-patch` edge function to deploy 4 highly customized SQL RLS policies using `split_part(name, '/', 1) = auth.uid()::text` to precisely extract the UID from the complex path.

## Phase 4: GPS Filtering & Battery Drain
We implemented live tracking for technicians so they could see jobs sorted by proximity.
**Mistake Made**: We used standard `watchPosition` running continuously.
**Consequence**: It drained mobile batteries rapidly and often returned terrible coordinate accuracy (e.g., 2000m radius) when waking up.
**Redesign**: We refactored `watchPosition` heavily. For citizens, we built a 10-second filtering loop that collects multiple readings and keeps only the most accurate one, rejecting anything >100m. For technicians, we throttled state updates to every 5 seconds and bound the watcher to the Page Visibility API (`visibilitychange`), shutting down the GPS hardware instantly when the app is backgrounded.

## Phase 5: The "Online" False Positive
**Bug Discovered**: The queue auto-flush would trigger, but immediately fail, leaving the UI stuck.
**Why it happened**: We relied on `navigator.onLine`. This boolean returns `true` if the device is connected to a WiFi router, *even if that router has no internet connection*. 
**Final Architecture**: We implemented `checkConnection()` inside `OfflineProvider`, which actively executes a highly optimized network request to the Supabase backend. The queue only flushes when the backend truly responds.

## Conclusion
SevaJyothi's architecture is not standard; it is highly defensive. It assumes the network will fail, the GPS will lie, and the client cannot be trusted. Future AIs must read this document and respect these defensive postures before suggesting "simpler" implementations that would ultimately fail in rural India.
