import { createClient } from "@supabase/supabase-js";
import type { Database } from "../integrations/supabase/types"; // Wait, I deleted this. I will just omit type for now or use any.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
// The .env has SUPABASE_SECRET_KEY, not SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase admin environment variables.");
}

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  }
});
