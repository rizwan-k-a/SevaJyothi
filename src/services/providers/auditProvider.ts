import type { AuditEventType } from "./types";

export interface AuditProvider {
  log(
    event: AuditEventType,
    metadata?: Record<string, unknown>,
    complaintId?: string | null,
  ): Promise<void>;
}

/** Collect non-PII client metadata that's safe to send with every audit event. */
export function clientContext(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  return {
    ua: navigator.userAgent,
    online: navigator.onLine,
    path: window.location.pathname,
    lang: navigator.language,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    ts: new Date().toISOString(),
  };
}
