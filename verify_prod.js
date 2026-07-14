import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;
const SUPABASE_ANON = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
const VERIFY_ADMIN_EMAIL = process.env.VERIFY_ADMIN_EMAIL;
const VERIFY_ADMIN_PASSWORD = process.env.VERIFY_ADMIN_PASSWORD;

if (!SUPABASE_URL) throw new Error("SUPABASE_URL is required");
if (!SUPABASE_SECRET) throw new Error("SUPABASE_SECRET_KEY is required");

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  const report = {};

  console.log("Testing Auth...");
  const { data: users, error: userErr } = await admin.auth.admin.listUsers();
  report.users = userErr ? `FAIL: ${userErr.message}` : users?.users?.length + " users found";

  console.log("Testing Admin Account...");
  if (!VERIFY_ADMIN_EMAIL || !VERIFY_ADMIN_PASSWORD) {
    console.log("\n[4] Verifying Admin Account... skipped (VERIFY_ADMIN_EMAIL / VERIFY_ADMIN_PASSWORD not set)");
  } else {
    console.log("\n[4] Verifying Admin Account (env-provided)...");
    const adminAccount = users?.users?.find((u) => u.email === VERIFY_ADMIN_EMAIL);
  if (adminAccount) {
    const { data: roles } = await admin
      .from("user_roles")
      .select("*")
      .eq("user_id", adminAccount.id);
    report.adminAccount = { exists: true, roles };
  } else {
    report.adminAccount = { exists: false };
  }

  console.log("Testing Tables...");
  const tables = [
    "profiles",
    "user_roles",
    "complaints",
    "complaint_events",
    "notifications",
    "technician_applications",
    "signup_rate_limit",
    "security_audit_log",
    "push_subscriptions",
  ];
  for (const t of tables) {
    const { data, error } = await admin.from(t).select("*").limit(1);
    report[t] = error ? `FAIL: ${error.message}` : "PASS";
  }

  console.log("Testing Storage...");
  const { data: buckets, error: bucketErr } = await admin.storage.listBuckets();
  report.buckets = bucketErr ? `FAIL: ${bucketErr.message}` : buckets.map((b) => b.name);

  console.log(JSON.stringify(report, null, 2));
}

run();
