import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envContent = fs.readFileSync(".env", "utf-8");
const env = {};
envContent.split("\n").forEach((line) => {
  if (line.trim() && !line.startsWith("#")) {
    const [key, ...val] = line.split("=");
    if (key)
      env[key.trim()] = val
        .join("=")
        .trim()
        .replace(/^["'](.*)["']$/, "$1");
  }
});

const SUPABASE_URL = env["VITE_SUPABASE_URL"] || env["SUPABASE_URL"];
const SUPABASE_SERVICE_KEY = env["SUPABASE_SECRET_KEY"];
const SUPABASE_ANON_KEY = env["VITE_SUPABASE_PUBLISHABLE_KEY"] || env["VITE_SUPABASE_ANON_KEY"];

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_KEY === "your-secret-key") {
  console.error("FATAL: SUPABASE_SECRET_KEY is missing or invalid. Admin tests will fail.");
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runTests() {
  console.log("=== FINAL PRODUCTION VERIFICATION PASS ===");

  // 1. Verify service role active
  console.log("\n[1] Verifying Service Role (Admin Client)...");
  const { data: adminCheck, error: adminErr } = await adminClient
    .from("profiles")
    .select("id")
    .limit(1);
  if (adminErr) {
    console.log("❌ Service Role Check Failed:", adminErr.message);
  } else {
    console.log("✅ Service Role Check Passed");
  }

  // 2. Verify server auth (Signup)
  console.log("\n[2] Verifying Auth (Signup)...");
  const testEmail = `test_cit_${Date.now()}@example.com`;
  const { data: signupData, error: signupErr } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: "TestPassword123!",
    email_confirm: true,
  });
  if (signupErr) {
    console.log("❌ Citizen Signup Failed:", signupErr.message);
  } else {
    console.log(`✅ Citizen Signup Passed (User ID: ${signupData.user.id})`);

    // Simulate role assignment
    const { error: roleErr } = await adminClient.from("user_roles").insert({
      user_id: signupData.user.id,
      role: "citizen",
    });
    if (roleErr) console.log("❌ Role Assignment Failed:", roleErr.message);
    else console.log("✅ Role Assignment Passed");

    // Clean up
    await adminClient.auth.admin.deleteUser(signupData.user.id);
  }

  // 3. Verify storage bucket
  console.log("\n[3] Verifying Storage Bucket...");
  const { data: bucketData, error: bucketErr } =
    await adminClient.storage.getBucket("complaint-media");
  if (bucketErr) {
    console.log("❌ Bucket Check Failed:", bucketErr.message);
  } else {
    console.log("✅ Bucket 'complaint-media' exists.");
    const testBuffer = Buffer.from("test image content");
    const fileName = `test_${Date.now()}.txt`;
    const { error: uploadErr } = await adminClient.storage
      .from("complaint-media")
      .upload(fileName, testBuffer);
    if (uploadErr) {
      console.log("❌ Image Upload Failed:", uploadErr.message);
    } else {
      console.log("✅ Image Upload Passed");
      const { data: signedUrlData, error: urlErr } = await adminClient.storage
        .from("complaint-media")
        .createSignedUrl(fileName, 60);
      if (urlErr) {
        console.log("❌ Signed URL Generation Failed:", urlErr.message);
      } else {
        console.log("✅ Signed URL Generated:", signedUrlData.signedUrl);
      }
      // Cleanup
      await adminClient.storage.from("complaint-media").remove([fileName]);
    }
  }

  // 4. Verify admin account
  console.log("\n[4] Verifying Admin Account (rizurizz3737@gmail.com)...");
  const { data: adminLogin, error: adminLoginErr } = await anonClient.auth.signInWithPassword({
    email: "rizurizz3737@gmail.com",
    password: "@rizwanka",
  });
  if (adminLoginErr) {
    console.log("❌ Admin Login Failed:", adminLoginErr.message);
  } else {
    const { data: adminRole } = await anonClient
      .from("user_roles")
      .select("role")
      .eq("user_id", adminLogin.user.id)
      .single();
    if (adminRole?.role === "authority") {
      console.log("✅ Admin Login Passed. Role verified as 'authority'.");
    } else {
      console.log(
        "❌ Admin Login Passed, but role is NOT 'authority'. Current role:",
        adminRole?.role,
      );
    }
  }

  // 7. Verify push pipeline structure
  console.log("\n[7] Verifying Push Pipeline Structure...");
  const hasPushSw = fs.existsSync("./public/push-sw.js") || fs.existsSync("./public/sw.js");
  console.log(
    hasPushSw ? "✅ Service Worker (sw.js / push-sw.js) exists." : "❌ Service Worker missing.",
  );
  const hasSendPushRoute = fs.existsSync("./src/routes/api/public/send-push.ts");
  console.log(hasSendPushRoute ? "✅ send-push.ts route exists." : "❌ send-push.ts missing.");

  // Verify table
  const { error: pushTableErr } = await adminClient
    .from("push_subscriptions")
    .select("id")
    .limit(1);
  if (pushTableErr) {
    console.log("❌ push_subscriptions table query failed:", pushTableErr.message);
  } else {
    console.log("✅ push_subscriptions table exists and is readable by admin.");
  }
}

runTests().catch(console.error);
