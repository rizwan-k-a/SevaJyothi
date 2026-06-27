/**
 * Typed stubs for future adapters. Selecting one of these via
 * VITE_BACKEND_PROVIDER produces a clear runtime error instead of silently
 * falling back to Lovable. Implement each surface to ship a real adapter.
 */
import type { AuthProvider } from "../authProvider";
import type { DatabaseProvider } from "../databaseProvider";
import type { StorageProvider } from "../storageProvider";
import type { RealtimeProvider } from "../realtimeProvider";
import type { NotificationProvider } from "../notificationProvider";
import type { AnalyticsProvider } from "../analyticsProvider";
import type { AuditProvider } from "../auditProvider";
import type { SyncProvider } from "../syncProvider";

function panic(label: string): never {
  throw new Error(`backend: ${label} adapter not yet implemented`);
}

function stub<T extends object>(label: string): T {
  return new Proxy({} as T, {
    get: (_t, p) => () => panic(`${label}.${String(p)}`),
  });
}

export function makeStubBackend(name: string) {
  return {
    auth: stub<AuthProvider>(`${name}.auth`),
    db: stub<DatabaseProvider>(`${name}.db`),
    storage: stub<StorageProvider>(`${name}.storage`),
    realtime: stub<RealtimeProvider>(`${name}.realtime`),
    notifications: stub<NotificationProvider>(`${name}.notifications`),
    analytics: stub<AnalyticsProvider>(`${name}.analytics`),
    audit: stub<AuditProvider>(`${name}.audit`),
    sync: stub<SyncProvider>(`${name}.sync`),
  };
}
