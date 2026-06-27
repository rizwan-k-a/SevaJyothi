import type { ComplaintRow } from "./types";

export interface DatabaseProvider {
  listComplaints(opts?: {
    limit?: number;
    forUser?: string;
    forAssignee?: string;
  }): Promise<ComplaintRow[]>;
  getComplaint(id: string): Promise<ComplaintRow | null>;
  insertComplaint(
    row: Partial<ComplaintRow> & { client_id: string },
  ): Promise<ComplaintRow>;
  updateComplaint(id: string, patch: Partial<ComplaintRow>): Promise<void>;
}
