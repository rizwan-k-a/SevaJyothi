# ARCHITECTURE DECISION RECORDS (ADR)

This document captures the major architectural decisions made during the development of SevaJyothi. 

## ADR-001: React + Vite
- **Date**: Project Inception
- **Problem**: Need a fast, modern frontend framework capable of PWA compilation and deep client-side state management.
- **Decision**: Use React 18 with Vite.
- **Alternatives considered**: Next.js (App Router), Vue, Svelte.
- **Why rejected**: Next.js introduces SSR overhead which conflicts heavily with our strict offline-first PWA requirements. We need a pure SPA that operates entirely from cached Service Worker assets when offline.
- **Consequences**: Faster build times, pure client-side routing via TanStack, but loses SEO benefits (acceptable for a logged-in dashboard app).
- **Future considerations**: Migration to React Compiler for deeper performance optimization once stable.

## ADR-002: Supabase
- **Date**: Project Inception
- **Problem**: Need a Backend-as-a-Service (BaaS) with strong relational guarantees and strict security.
- **Decision**: Supabase (PostgreSQL).
- **Alternatives considered**: Firebase, AWS Amplify, Appwrite.
- **Why rejected**: Firebase's NoSQL model breaks down when modeling complex civic grievances spanning multiple tables (users, roles, complaints, events). PostgreSQL's Row Level Security (RLS) is unmatched for our RBAC needs.
- **Consequences**: Heavy reliance on writing raw SQL migrations. Strict security guarantees.
- **Future considerations**: Database scaling and read-replicas if deployment expands state-wide.

## ADR-003: Offline-First Architecture
- **Date**: Early Development
- **Problem**: Rural citizens have intermittent or zero internet when reporting infrastructure failures.
- **Decision**: Treat the local device as the source of truth until a sync succeeds.
- **Alternatives considered**: Graceful degradation (showing errors when offline).
- **Why rejected**: Graceful degradation causes high abandonment rates for civic apps. Users won't wait to submit reports.
- **Consequences**: Immense complexity in state management, requiring local queueing and background sync.
- **Future considerations**: Multi-device synchronization if users switch devices before the queue flushes.

## ADR-004: IndexedDB for Queue Architecture
- **Date**: Early Development
- **Problem**: Need to store pending citizen complaints, including heavy Base64 image payloads, locally.
- **Decision**: IndexedDB using the `idb` wrapper.
- **Alternatives considered**: `localStorage`, Redux Persist.
- **Why rejected**: `localStorage` blocks the main thread and has a 5MB limit, instantly failing when users capture 2-3 high-res photos.
- **Consequences**: Asynchronous API across the app. Requires schema versioning for client-side storage.
- **Future considerations**: Migrating to OPFS (Origin Private File System) for even faster large asset storage.

## ADR-005: Service Worker & Background Sync
- **Date**: Mid Development
- **Problem**: Users may click "Submit" while offline and immediately close the browser, preventing the queue from ever flushing.
- **Decision**: Implement a Service Worker utilizing the Background Sync API (`sj-flush-complaints`).
- **Alternatives considered**: Forcing the user to keep the app open.
- **Why rejected**: Terrible UX.
- **Consequences**: Requires PWA installation. Heavily reliant on browser support (excellent on Android Chrome, nonexistent on iOS Safari).
- **Future considerations**: Adding Periodic Background Sync to pull new jobs for technicians proactively.

## ADR-006: Technician Approval Workflow
- **Date**: Mid Development
- **Problem**: Preventing malicious actors from signing up as technicians and marking critical infrastructure reports as "resolved".
- **Decision**: Insert all new technicians into a `technician_applications` table with a 'pending' status. Block dashboard access until an Admin manually approves.
- **Alternatives considered**: Invite-only registration.
- **Why rejected**: Too high administrative overhead for onboarding rural workers.
- **Consequences**: Requires an Admin UI and secure Edge Functions to manage states.
- **Future considerations**: Automated KYC or identity verification integration.

## ADR-007: Citizen Login (Bypass Approval)
- **Date**: Early Development
- **Problem**: Maximize complaint reporting volume without creating friction.
- **Decision**: Citizens are instantly granted the 'citizen' role via a Postgres Trigger and bypass all approval flows. Email confirmation is explicitly disabled.
- **Alternatives considered**: OTP verification, manual approval.
- **Why rejected**: Any friction causes drop-off.
- **Consequences**: Potential for spam.
- **Future considerations**: Implement spam detection algorithms or rate-limiting on complaint submissions.

## ADR-008: Edge Functions for Admin/User Administration
- **Date**: Late Development
- **Problem**: The frontend needed to update user roles and approve technicians, but accessing `auth.admin()` via frontend RPCs creates massive privilege escalation risks.
- **Decision**: Remove all insecure RPCs. Route privileged operations through secure Deno Edge Functions.
- **Alternatives considered**: PostgreSQL Security Definer RPCs.
- **Why rejected**: Extremely dangerous if input validation is bypassed, as they execute as the postgres superuser. Edge functions provide a secure, isolated sandbox to verify JWTs first.
- **Consequences**: Adds deployment complexity. Requires Deno runtime knowledge.
- **Future considerations**: None. This is the optimal security posture.

## ADR-009: RLS (Row Level Security)
- **Date**: Project Inception
- **Problem**: Securing data inherently at the database level so leaked frontend code cannot result in data breaches.
- **Decision**: Default Deny. Every table has RLS.
- **Alternatives considered**: Security through obscurity or Backend API middleware.
- **Why rejected**: Supabase is designed around direct client-to-DB connections. Middleware defeats the architecture.
- **Consequences**: Complex SQL authoring.
- **Future considerations**: Comprehensive automated testing for RLS policies.

## ADR-010: Storage Proxy (upload-media Edge Function)
- **Date**: Late Development (Bug Fix)
- **Problem**: The offline sync engine caused `new row violates row-level security policy` errors because complex Storage RLS policies frequently failed during background syncs (e.g. expired tokens, deep nested paths).
- **Decision**: Proxy all offline media uploads through an `upload-media` Edge Function using `service_role`.
- **Alternatives considered**: Loosening Storage RLS policies.
- **Why rejected**: Creates a severe security vulnerability.
- **Consequences**: Slightly increased latency on image uploads.
- **Future considerations**: Implementing signed URLs instead.

## ADR-011: Maps & Marker Clustering
- **Date**: Mid Development
- **Problem**: Displaying jobs geographically to technicians.
- **Decision**: Leaflet/React-Leaflet lazy-loaded via Suspense.
- **Alternatives considered**: Mapbox GL JS, Google Maps.
- **Why rejected**: Leaflet is entirely open-source, lightweight, and requires no API keys, which aligns with minimizing external dependencies.
- **Consequences**: Slower rendering for >10,000 markers (requires clustering plugins).
- **Future considerations**: Migrate to Mapbox if performance degrades heavily.

## ADR-012: GPS Filtering Algorithm
- **Date**: Production Hardening
- **Problem**: Mobile GPS APIs often return wildly inaccurate coordinates (e.g., 2000m radius) immediately upon waking up, causing bad data.
- **Decision**: Implement a 10-second `watchPosition` loop. Record the reading with the tightest accuracy radius, ignoring anything >100m.
- **Alternatives considered**: `getCurrentPosition` with `enableHighAccuracy`.
- **Why rejected**: Still frequently returns the cached cell-tower location rather than the true GPS lock.
- **Consequences**: Delays complaint submission slightly as the UI waits for a lock.
- **Future considerations**: Allowing users to manually pin their location on a map.

## ADR-013: Progressive Web App (PWA)
- **Date**: Project Inception
- **Problem**: App store distribution is slow, heavily regulated, and requires users to download heavy binaries.
- **Decision**: PWA.
- **Alternatives considered**: React Native, Flutter.
- **Why rejected**: A single unified web codebase drastically reduces development overhead.
- **Consequences**: Subpar background execution on iOS compared to Android.
- **Future considerations**: Wrapping the PWA in Capacitor if native device hardware (Bluetooth, deep background processing) is required.
