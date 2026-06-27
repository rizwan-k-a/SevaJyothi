/**
 * Shared types for the SevaJyothi backend provider layer.
 * Every adapter (Lovable, Supabase, self-hosted, raw Postgres, Node/Express)
 * speaks these types. UI code never imports vendor SDKs directly.
 */

export type Role = "citizen" | "technician" | "authority";

export type ComplaintStatus =
  | "submitted"
  | "triaged"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "closed";

export type ComplaintPriority = "low" | "normal" | "high" | "critical";

export type ComplaintRow = {
  id: string;
  client_id: string;
  reporter_id: string;
  assigned_to: string | null;
  category: string;
  description: string;
  status: ComplaintStatus | string;
  priority: ComplaintPriority;
  priority_score: number;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  village: string | null;
  created_at: string;
  client_created_at?: string | null;
  resolved_at: string | null;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  complaint_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type AuditEventType =
  | "login_success"
  | "login_failure"
  | "logout"
  | "complaint_sync_success"
  | "complaint_sync_failure"
  | "notification_read"
  | "technician_accepted"
  | "repair_started"
  | "repair_resolved"
  | "repair_en_route"
  | "repair_on_site";

export type RealtimeUnsubscribe = () => void;

export type SessionUser = {
  id: string;
  email: string | null;
};

export type ProviderName =
  | "lovable"
  | "supabase"
  | "self-hosted"
  | "postgres"
  | "node-express";
