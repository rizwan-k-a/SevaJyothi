import type { NotificationRow } from "./types";

export interface NotificationProvider {
  list(userId: string, limit?: number): Promise<NotificationRow[]>;
  markRead(id: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
  savePushSubscription(sub: PushSubscriptionJSON, userAgent: string): Promise<void>;
  removePushSubscription(endpoint: string): Promise<void>;
}
