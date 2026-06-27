/**
 * Backend-agnostic surface used by the offline IndexedDB engine to push
 * queued complaints. The lovable adapter delegates to database + storage.
 */
export interface SyncProvider {
  pushComplaint(payload: {
    client_id: string;
    category: string;
    description: string;
    lat: number | null;
    lng: number | null;
    accuracy: number | null;
    village: string | null;
    photoBase64?: string | null;
    photoContentType?: string | null;
    client_created_at: string;
  }): Promise<{ id: string }>;
}
