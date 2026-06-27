import { backend } from "../providers/backendProvider";

export const listComplaints = (opts) => backend.db.listComplaints(opts);
export const getComplaint = (id) => backend.db.getComplaint(id);
export const insertComplaint = (row) => backend.db.insertComplaint(row);
export const updateComplaint = (id, patch) => backend.db.updateComplaint(id, patch);
