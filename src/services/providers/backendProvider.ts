/**
 * Aggregated backend facade. UI imports `backend` from here and never
 * reaches into a vendor SDK. Swap adapters by setting VITE_BACKEND_PROVIDER.
 *
 *   import { backend } from "@/services/providers/backendProvider";
 *   const rows = await backend.db.listComplaints();
 */
import type { AuthProvider } from "./authProvider";
import type { DatabaseProvider } from "./databaseProvider";
import type { StorageProvider } from "./storageProvider";
import type { RealtimeProvider } from "./realtimeProvider";
import type { NotificationProvider } from "./notificationProvider";
import type { AnalyticsProvider } from "./analyticsProvider";
import type { AuditProvider } from "./auditProvider";
import type { SyncProvider } from "./syncProvider";
import type { ProviderName } from "./types";

import {
  lovableAuth,
  lovableDatabase,
  lovableStorage,
  lovableRealtime,
  lovableNotifications,
  lovableAnalytics,
  lovableAudit,
  lovableSync,
} from "./adapters/lovableProvider";
import { makeStubBackend } from "./adapters/stubAdapter";

export interface Backend {
  readonly name: ProviderName;
  auth: AuthProvider;
  db: DatabaseProvider;
  storage: StorageProvider;
  realtime: RealtimeProvider;
  notifications: NotificationProvider;
  analytics: AnalyticsProvider;
  audit: AuditProvider;
  sync: SyncProvider;
}

const lovable: Backend = {
  name: "lovable",
  auth: lovableAuth,
  db: lovableDatabase,
  storage: lovableStorage,
  realtime: lovableRealtime,
  notifications: lovableNotifications,
  analytics: lovableAnalytics,
  audit: lovableAudit,
  sync: lovableSync,
};

function pick(): Backend {
  const name = (
    (import.meta.env.VITE_BACKEND_PROVIDER as string | undefined) ?? "lovable"
  ).toLowerCase();
  switch (name) {
    case "supabase":
      return { name: "supabase", ...makeStubBackend("supabase") } as Backend;
    case "self-hosted":
      return { name: "self-hosted", ...makeStubBackend("self-hosted") } as Backend;
    case "postgres":
      return { name: "postgres", ...makeStubBackend("postgres") } as Backend;
    case "node-express":
      return { name: "node-express", ...makeStubBackend("node-express") } as Backend;
    default:
      return lovable;
  }
}

export const backend: Backend = pick();

export type {
  AuthProvider,
  DatabaseProvider,
  StorageProvider,
  RealtimeProvider,
  NotificationProvider,
  AnalyticsProvider,
  AuditProvider,
  SyncProvider,
};
export type { ComplaintRow, NotificationRow, Role, SessionUser, AuditEventType } from "./types";
