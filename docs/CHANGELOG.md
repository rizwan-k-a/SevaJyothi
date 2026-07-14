# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v1.0.0-rc1] - 2026-07-14
### Added
- **Production Hardening**: Implemented strict backend reachability ping in `OfflineProvider` to prevent `navigator.onLine` false positives.
- **GPS Filtering Algorithm**: Added a 10-second `watchPosition` loop in the citizen wizard to reject wildly inaccurate GPS fixes (>100m radius).
- **Battery Optimization**: Bound the technician live-tracking `watchPosition` to the Page Visibility API, stopping GPS polling when the app is backgrounded.

### Changed
- The `SyncStatusScreen` now strictly maps to `Queued`, `Syncing...`, and `Synchronization complete`, removing the ambiguous `Reconnecting...` state.

### Fixed
- Fixed an infinite React re-render loop in `OfflineProvider` by utilizing deep equality checks on the IndexedDB queue state.
- **Security**: Fixed critical storage RLS bug (`new row violates row-level security policy`) by deploying a `db-patch` edge function with exact `split_part` rules for 3-segment paths.

## [v0.3.0] - 2026-07-12
### Added
- **Deno Edge Functions**: Scaffolded `admin`, `upload-media`, and `db-patch` Edge Functions.
- Secure `upload-media` proxy to bypass complex client-side RLS limits for offline background syncs.

### Changed
- Refactored Admin User Management to utilize the new `admin` Edge Function instead of local RPCs.

### Removed
- **Security**: Removed all highly insecure PostgreSQL `auth.admin()` RPCs from the database.

### Security
- Closed a severe privilege escalation vulnerability where the frontend attempted to update `user_roles` natively.

## [v0.2.0] - 2026-06-27
### Added
- **Service Worker**: Configured `public/sw.js` to listen for the `sj-flush-complaints` Background Sync tag.
- **Technician Dashboard**: Created `/technician` route with real-time Supabase Channels subscriptions.
- **Live Routing**: Added Haversine distance calculations sorting jobs by geographic proximity.

### Fixed
- Fixed missing column references in the `handle_new_user` trigger.

## [v0.1.0] - 2026-06-15
### Added
- Initial project scaffolding using Vite, React 18, and Tailwind CSS.
- Integrated `@tanstack/react-router`.
- Supabase GoTrue Authentication implementation.
- Basic IndexedDB wrapper (`src/lib/offline/db.ts`).
- First draft of the Citizen Complaint Wizard.
