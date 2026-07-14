# TESTING GUIDE

This document outlines the complete manual testing procedures for SevaJyothi. Every major PR must be verified against these procedures.

## 1. Authentication Tests
- **Citizen Signup**: Use a random email. Verify instant access to `/citizen`.
- **Technician Signup**: Use a random email. Verify redirection to "Pending Approval" screen.
- **Admin Login**: Verify access to `/admin`.
- **Logout**: Verify redirection to `/auth` and clearing of IndexedDB auth state.

## 2. Admin & User Administration Tests
- **Technician Approval**: As an Admin, go to `/admin/technicians`. Click "Approve" on a pending technician.
  - *Expected Result*: Row moves to "Active" tab immediately.
- **Suspension**: Click "Suspend" on an active tech.
  - *Expected Result*: Row moves to "Suspended" tab. Tech can no longer read complaints.
- **Deletion**: Click "Delete". Verify complete removal from UI and `auth.users`.
- **Edge Function Verification**: Open Network tab. Ensure actions trigger `https://[project].supabase.co/functions/v1/admin`.

## 3. Citizen Tests
- **Online Submission**: Navigate to `/citizen/report`. Fill form. Click "Submit".
  - *Expected Result*: Transitions to "Synchronization complete". Complaint appears in Supabase `complaints` table.
- **My Reports**: Navigate to `/citizen`. Ensure the newly created report is visible.

## 4. Offline & Background Sync Tests
- **Offline Submission**: Turn off WiFi/Data. Submit a report.
  - *Expected Result*: Transitions to "Queued - Waiting for internet connection".
- **IndexedDB Check**: Open DevTools -> Application -> IndexedDB -> `sevajyothi`. Verify the complaint row exists.
- **Automatic Sync**: Turn WiFi back on. Keep the app open.
  - *Expected Result*: UI automatically changes to "Synchronization complete". IndexedDB queue is emptied.
- **Background Sync**: Turn off WiFi. Submit. **Close the browser tab.** Turn on WiFi.
  - *Expected Result*: The Service Worker detects the connection, flushes the queue, and the complaint appears in the Supabase backend despite the app being closed.

## 5. GPS & Map Tests
- **GPS Accuracy Filtering**: Open `/citizen/report`. Ensure the UI displays "Locating...", waits briefly, and then renders exact coordinates with an `Accuracy ±X m` metric.
- **Map Rendering**: Login as a technician. Ensure `ComplaintMap` renders without crashing.
- **Live Technician Tracking**: Background the app. Open another tab. Come back to the app.
  - *Expected Result*: The `watchPosition` should pause while backgrounded (saving battery) and resume instantly upon visibility.

## 6. Technician Tests
- **Assigned Jobs**: Verify jobs assigned to the technician ID appear in the dashboard.
- **Sorting**: Ensure jobs are sorted nearest-to-farthest based on live GPS.
- **Resolution**: Click "Resolve". Upload a photo. Click complete.
  - *Expected Result*: Job disappears from active queue. `status` becomes `resolved` in Supabase.

## 7. Storage & RLS Tests
- **Citizen Upload**: Verify the image is stored in `complaint-media/[reporter_uid]/[complaint_id].jpg`.
- **Technician Upload**: Verify image is stored in `complaint-media/[tech_uid]/resolutions/[complaint_id].jpg`.
- **RLS Boundary Violation**: Attempt to update another user's complaint using the browser console.
  - *Expected Result*: PostgREST returns a 401/403 or `violates row-level security policy`.

## 8. PWA & Mobile Testing
- **Installation**: Use Chrome on Android. Verify the "Install App" prompt appears.
- **Standalone Mode**: Launch from home screen. Ensure browser address bar is hidden.
- **Safe Area Insets**: Ensure the bottom navigation bar does not overlap with the iOS home indicator or Android gesture bar.

## 9. Failure Conditions & Recovery Procedures
- **IndexedDB Corruption**: If the queue locks up, clear site data via DevTools. The app must recover gracefully on next load.
- **Edge Function 500s**: If the admin function crashes, the UI must show a toast error, not crash the React tree.
