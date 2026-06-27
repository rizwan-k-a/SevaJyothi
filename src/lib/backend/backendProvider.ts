/**
 * Compatibility re-export. The canonical provider layer now lives at
 * `@/services/providers/backendProvider`. Existing imports continue to work.
 */
export {
  backend,
  type Backend,
  type AuthProvider,
  type DatabaseProvider,
  type StorageProvider,
  type RealtimeProvider,
  type NotificationProvider,
  type AnalyticsProvider,
  type AuditProvider,
  type SyncProvider,
  type ComplaintRow,
  type NotificationRow,
  type Role,
} from "@/services/providers/backendProvider";
