import {
  supabaseAuth,
  supabaseDatabase,
  supabaseStorage,
  supabaseRealtime,
  supabaseNotifications,
} from "./supabaseProvider";

const supabaseBackend = {
  name: "supabase",
  auth: supabaseAuth,
  db: supabaseDatabase,
  storage: supabaseStorage,
  realtime: supabaseRealtime,
  notifications: supabaseNotifications,
};

export function getProvider() {
  const providerName = import.meta.env.VITE_BACKEND_PROVIDER ?? "supabase";
  
  switch (providerName) {
    case "supabase":
      return supabaseBackend;
    case "postgres":
    case "node":
    case "firebase":
      throw new Error(`Provider ${providerName} is planned but not fully implemented yet.`);
    default:
      return supabaseBackend;
  }
}

export const backend = getProvider();
