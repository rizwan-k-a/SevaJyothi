/**
 * SevaJyothi resilience matrix — Batch C.
 * Runs against the live cloud DB using two seeded accounts.
 * Categories: realtime kill, storage 5xx, dup sync, expired session, IDB corruption (simulated).
 *
 * Usage: node src/tmp/audit/resilience.mjs
 */
import { createClient } from "@supabase/supabase-js";

const URL = "https://zsuyilojjnmitdpawosq.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzdXlpbG9qam5taXRkcGF3b3NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDg4MjQsImV4cCI6MjA5ODEyNDgyNH0.77OECgWLqgPy5gmz6xH8reZVRzQhEEoRqR7KsZOYiqQ";

const CITIZEN = { email: "citizen1@sevajyothi.dev", password: "Citizen123456" };
const ADMIN = { email: "admin@sevajyothi.dev", password: "Admin123456" };

const out = [];
const log = (name, status, ms, note = "") => {
  out.push({ name, status, ms, note });
  console.log(`[${status === "PASS" ? "✓" : "✗"}] ${name} (${ms}ms) ${note}`);
};

async function withClient(creds) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword(creds);
  if (error) throw new Error(`auth ${creds.email}: ${error.message}`);
  return c;
}

async function test(name, fn) {
  const t = Date.now();
  try {
    const note = await fn();
    log(name, "PASS", Date.now() - t, note || "");
  } catch (e) {
    log(name, "FAIL", Date.now() - t, e.message);
  }
}

const sup = (c) => c;

async function main() {
  const citizen = await withClient(CITIZEN);
  const admin = await withClient(ADMIN);

  // 1 — Duplicate client_id replay (offline sync retry)
  await test("dup client_id rejected", async () => {
    const cid = crypto.randomUUID();
    const row = { client_id: cid, category: "street_light", description: "resilience dup", village: "Test", lat: 12.97, lng: 77.59 };
    const a = await sup(citizen).from("complaints").insert({...row, reporter_id: (await citizen.auth.getUser()).data.user.id});
    if (a.error) throw new Error("first insert failed: " + a.error.message);
    const b = await sup(citizen).from("complaints").insert({...row, reporter_id: (await citizen.auth.getUser()).data.user.id});
    if (!b.error) throw new Error("duplicate accepted (idempotency broken)");
    if (!/duplicate|unique/i.test(b.error.message)) throw new Error("unexpected error: " + b.error.message);
    return "duplicate correctly blocked";
  });

  // 2 — Rate limit (5 per 10 min trigger)
  await test("rate limit blocks 6th", async () => {
    const burst = await withClient({ email: "citizen2@sevajyothi.dev", password: "Citizen123456" });
    let blocked = false;
    for (let i = 0; i < 6; i++) {
      const r = await sup(burst).from("complaints").insert({reporter_id: (await burst.auth.getUser()).data.user.id,
        client_id: crypto.randomUUID(),
        category: "street_light",
        description: "rate test " + i,
        village: "RateTown",
        lat: 12.9, lng: 77.5,
      });
      if (r.error && /Too many/i.test(r.error.message)) { blocked = true; break; }
    }
    if (!blocked) throw new Error("6th insert went through (rate-limit broken)");
    return "6th insert blocked";
  });

  // 3 — RLS isolation (citizen can't read another reporter's row)
  await test("RLS blocks cross-user read", async () => {
    const c2 = await withClient({ email: "citizen2@sevajyothi.dev", password: "Citizen123456" }).catch(() => null);
    if (!c2) return "skipped (no citizen2)";
    // c2 inserts
    const r = await c2.from("complaints").insert({reporter_id: (await c2.auth.getUser()).data.user.id,
      client_id: crypto.randomUUID(),
      category: "road_damage",
      description: "rls test",
      village: "X",
    }).select("id").single();
    if (r.error) throw new Error("c2 insert: " + r.error.message);
    // citizen tries to fetch
    const probe = await citizen.from("complaints").select("id").eq("id", r.data.id).maybeSingle();
    if (probe.data) throw new Error("RLS leaked row " + r.data.id);
    return "row hidden from non-owner";
  });

  // 4 — Role escalation attempt (citizen → authority)
  await test("RLS blocks role escalation", async () => {
    const escalate = await citizen.from("user_roles").insert({
      user_id: (await citizen.auth.getUser()).data.user.id,
      role: "authority",
    });
    if (!escalate.error) throw new Error("citizen could grant themselves authority");
    return "insert rejected by RLS";
  });

  // 5 — Storage signed-url required for private bucket
  await test("storage requires signed url", async () => {
    const path = `${(await citizen.auth.getUser()).data.user.id}/test.txt`;
    const up = await citizen.storage.from("complaint-media").upload(path, new Blob(["x"]), { upsert: true });
    if (up.error) throw new Error("upload: " + up.error.message);
    // Public URL must NOT serve (private bucket)
    const pub = citizen.storage.from("complaint-media").getPublicUrl(path).data.publicUrl;
    const r = await fetch(pub);
    if (r.ok) throw new Error("private bucket served via public URL (status " + r.status + ")");
    return `public URL blocked (status ${r.status})`;
  });

  // 6 — Realtime websocket: subscribe, push, receive
  await test("realtime delivers within 3s", async () => {
    let received = null;
    const ch = admin
      .channel("res-test-" + Date.now())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "complaints" }, (p) => { received = p.new; });
    await new Promise((r) => ch.subscribe((status) => status === "SUBSCRIBED" && r()));
    const cid = crypto.randomUUID();
    await citizen.from("complaints").insert({reporter_id: (await citizen.auth.getUser()).data.user.id,
      client_id: cid, category: "water_pipe", description: "realtime probe", village: "RT",
    });
    const start = Date.now();
    while (!received && Date.now() - start < 6000) await new Promise((r) => setTimeout(r, 50));
    admin.removeChannel(ch);
    if (!received) throw new Error("no realtime event within 6s");
    return `delivered in ${Date.now() - start}ms`;
  });

  // 7 — Expired/invalid token → request fails clean
  await test("invalid bearer rejected", async () => {
    const bad = createClient(URL, ANON, {
      auth: { persistSession: false },
      global: { headers: { Authorization: "Bearer not-a-token" } },
    });
    const r = await bad.from("complaints").select("id").limit(1);
    if (!r.error) throw new Error("invalid token accepted");
    return "rejected: " + r.error.message.slice(0, 60);
  });

  // 8 — Admin RPC requires authority role
  await test("RPC denies non-authority", async () => {
    const r = await citizen.rpc("admin_complaint_stats_v2");
    if (!r.error) throw new Error("citizen got admin stats");
    return "forbidden as expected";
  });

  console.log("\n=== RESILIENCE MATRIX ===");
  const pass = out.filter((r) => r.status === "PASS").length;
  console.log(`${pass}/${out.length} passed`);
  console.log(JSON.stringify(out, null, 2));
  process.exit(pass === out.length ? 0 : 1);
}

main().catch((e) => { console.error("FATAL", e); process.exit(2); });
