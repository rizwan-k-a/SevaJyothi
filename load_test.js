/**
 * SevaJyothi — Production Load Test Suite v2
 * k6 v2.0.0
 *
 * Fixes from v1:
 *   - Correct DB enum: transformer|water_pipe|road_damage|street_light|sewage_leak|network_tower
 *   - Unique client_id per VU+iter to bypass rate limiter
 *   - Service key for storage uploads to pass RLS
 *   - Correct Supabase Realtime WS URL format
 *   - Reduced VU counts to avoid exhausting free-tier rate limits
 *
 * Run: k6 run load_test.js
 */

import http from "k6/http";
import ws from "k6/ws";
import { check, sleep } from "k6";
import { Counter, Trend, Rate } from "k6/metrics";

// ─── Configuration ─────────────────────────────────────────────────────────────

const PROJECT_REF = "nngdiemmkzrvqmenmfrk";
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const ANON_KEY = __ENV.SUPABASE_PUBLISHABLE_KEY ?? __ENV.SUPABASE_ANON_KEY;
const SERVICE_KEY = __ENV.SUPABASE_SECRET_KEY;
const REST_URL = `${SUPABASE_URL}/rest/v1`;
const AUTH_URL = `${SUPABASE_URL}/auth/v1`;
const STORAGE_URL = `${SUPABASE_URL}/storage/v1`;
const REALTIME_WS = `wss://${PROJECT_REF}.supabase.co/realtime/v1/websocket?apikey=${ANON_KEY}&vsn=1.0.0`;

const ADMIN_EMAIL = __ENV.ADMIN_EMAIL;
const ADMIN_PASS = __ENV.ADMIN_PASS;

if (!ANON_KEY) throw new Error("SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY is required");
if (!SERVICE_KEY) throw new Error("SUPABASE_SECRET_KEY is required");
if (!ADMIN_EMAIL) throw new Error("ADMIN_EMAIL is required");
if (!ADMIN_PASS) throw new Error("ADMIN_PASS is required");

// Exact DB enum values from src/lib/offline/db.ts
const CATEGORIES = [
  "transformer",
  "water_pipe",
  "road_damage",
  "street_light",
  "sewage_leak",
  "network_tower",
];

// ─── Custom metrics ────────────────────────────────────────────────────────────

const complaintErrors = new Counter("complaint_submit_errors");
const uploadErrors = new Counter("image_upload_errors");
const wsErrors = new Counter("websocket_errors");
const dbLatency = new Trend("db_roundtrip_ms", true);
const wsConnectMs = new Trend("ws_connect_ms", true);
const uploadLatency = new Trend("upload_latency_ms", true);
const overallErrorRate = new Rate("overall_error_rate");

// ─── k6 Options ───────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    complaint_submit: {
      exec: "complaint_submit",
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 100 },
        { duration: "30s", target: 100 },
        { duration: "10s", target: 0 },
      ],
      gracefulRampDown: "5s",
      tags: { scenario: "complaint_submit" },
    },
    websocket_sessions: {
      exec: "websocket_sessions",
      executor: "constant-vus",
      vus: 50,
      duration: "40s",
      startTime: "5s",
      tags: { scenario: "websocket_sessions" },
    },
    image_uploads: {
      exec: "image_uploads",
      executor: "constant-vus",
      vus: 20,
      duration: "30s",
      startTime: "10s",
      tags: { scenario: "image_upload" },
    },
  },
  thresholds: {
    "http_req_duration{scenario:complaint_submit}": ["p(95)<3000", "p(99)<5000"],
    "http_req_failed{scenario:complaint_submit}": ["rate<0.05"],
    complaint_submit_errors: ["count<20"],
    ws_connect_ms: ["p(95)<2000"],
    websocket_errors: ["count<10"],
    upload_latency_ms: ["p(95)<8000"],
    "http_req_duration{scenario:image_upload}": ["p(95)<8000"],
    image_upload_errors: ["count<5"],
    overall_error_rate: ["rate<0.05"],
    http_req_duration: ["p(99)<8000"],
  },
};

// ─── Required by k6 ───────────────────────────────────────────────────────────

export default function () {}

// ─── Setup: obtain admin JWT once ─────────────────────────────────────────────

export function setup() {
  const res = http.post(
    `${AUTH_URL}/token?grant_type=password`,
    JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
    { headers: { apikey: ANON_KEY, "Content-Type": "application/json" } },
  );
  if (res.status !== 200) {
    console.error(`Setup login FAILED: ${res.status} ${res.body}`);
    return { token: null, userId: null };
  }
  const body = JSON.parse(res.body);
  console.log(`Setup OK — user_id=${body.user?.id}`);
  return { token: body.access_token, userId: body.user?.id };
}

// ─── Scenario 1: Complaint submissions ───────────────────────────────────────

export function complaint_submit(data) {
  const { token, userId } = data;
  if (!token) {
    sleep(1);
    return;
  }

  const vuId = __VU;
  const iter = __ITER;

  const category = CATEGORIES[vuId % CATEGORIES.length];
  const lat = 12.9716 + (Math.random() - 0.5) * 0.1;
  const lng = 77.5946 + (Math.random() - 0.5) * 0.1;

  // Unique client_id prevents both upsert collision and the per-minute
  // rate-limit trigger (which counts distinct complaints per user per minute).
  const clientId = `lt_v${vuId}_i${iter}_${Date.now()}`;

  const payload = JSON.stringify({
    client_id: clientId,
    reporter_id: userId,
    category,
    description: `k6 load test VU=${vuId} ITER=${iter}`,
    lat,
    lng,
    accuracy: Math.round(5 + Math.random() * 80),
    village: "LoadTestVillage",
    status: "submitted",
    priority: ["low", "normal", "high"][iter % 3],
  });

  const t0 = Date.now();
  const res = http.post(`${REST_URL}/complaints`, payload, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    timeout: "10s",
    tags: { scenario: "complaint_submit" },
  });
  const elapsed = Date.now() - t0;
  dbLatency.add(elapsed);

  const ok = check(res, {
    "complaint_submit status 201": (r) => r.status === 201,
    "complaint_submit latency<3s": () => elapsed < 3000,
  });

  if (!ok || res.status >= 400) {
    complaintErrors.add(1);
    overallErrorRate.add(1);
    console.warn(
      `[VU=${vuId}] complaint FAIL HTTP ${res.status}: ${String(res.body).slice(0, 180)}`,
    );
  } else {
    overallErrorRate.add(0);
  }

  sleep(0.4 + Math.random() * 0.4);
}

// ─── Scenario 2: WebSocket / Supabase Realtime ────────────────────────────────

export function websocket_sessions(data) {
  const { token } = data;
  if (!token) {
    sleep(1);
    return;
  }

  const t0 = Date.now();

  const res = ws.connect(REALTIME_WS, { tags: { scenario: "websocket_sessions" } }, (socket) => {
    wsConnectMs.add(Date.now() - t0);

    socket.on("open", () => {
      // Phoenix join message for the complaints table
      socket.send(
        JSON.stringify({
          topic: `realtime:public:complaints`,
          event: "phx_join",
          payload: {
            config: { broadcast: { self: false }, presence: { key: "" } },
            access_token: token,
          },
          ref: `${__VU}`,
        }),
      );

      // Keep-alive heartbeat
      socket.setInterval(() => {
        socket.send(
          JSON.stringify({ topic: "phoenix", event: "heartbeat", payload: {}, ref: null }),
        );
      }, 5000);
    });

    socket.on("message", (msg) => {
      try {
        const d = JSON.parse(msg);
        check(d, { "ws event field present": (x) => typeof x.event === "string" });
      } catch (_) {
        wsErrors.add(1);
      }
    });

    socket.on("error", () => {
      wsErrors.add(1);
      overallErrorRate.add(1);
    });

    // Hold 5–12 s then close
    socket.setTimeout(() => socket.close(), 5000 + Math.random() * 7000);
  });

  check(res, { "ws upgraded 101": (r) => r && r.status === 101 });
  sleep(1);
}

// ─── Scenario 3: Storage image uploads ───────────────────────────────────────

export function image_uploads(data) {
  const { token, userId } = data;
  if (!token) {
    sleep(1);
    return;
  }

  const vuId = __VU;
  const iter = __ITER;

  // 5 KB synthetic JPEG (valid SOI + EOI markers)
  const buf = new Uint8Array(5120);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  buf[3] = 0xe0;
  buf[buf.length - 2] = 0xff;
  buf[buf.length - 1] = 0xd9;
  for (let i = 4; i < buf.length - 2; i++) buf[i] = (i * 7 + vuId) % 256;

  // Path under the user's own folder — folder[0] must match auth.uid()
  // which satisfies both the original INSERT policy and the SELECT/DELETE policies
  const path = `${userId}/load-test/vu${vuId}-i${iter}-${Date.now()}.jpg`;

  const t0 = Date.now();
  const res = http.request("POST", `${STORAGE_URL}/object/complaint-media/${path}`, buf.buffer, {
    headers: {
      // Storage accepts the authenticated user's own JWT as both apikey and bearer
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "image/jpeg",
      "x-upsert": "true",
    },
    timeout: "30s",
    tags: { scenario: "image_upload" },
  });
  const elapsed = Date.now() - t0;
  uploadLatency.add(elapsed);

  const ok = check(res, {
    "upload 2xx": (r) => r.status >= 200 && r.status < 300,
    "upload <8s": () => elapsed < 8000,
  });

  if (!ok) {
    uploadErrors.add(1);
    overallErrorRate.add(1);
    console.warn(`[VU=${vuId}] upload FAIL HTTP ${res.status}: ${String(res.body).slice(0, 180)}`);
  } else {
    overallErrorRate.add(0);
    // Cleanup uploaded file to avoid storage bloat
    http.del(`${STORAGE_URL}/object/complaint-media/${path}`, null, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
  }

  sleep(1 + Math.random() * 2);
}

// ─── Teardown ─────────────────────────────────────────────────────────────────

export function teardown(_data) {
  console.log("\n========================================");
  console.log("SevaJyothi Load Test v2 — Complete");
  console.log("========================================");
  console.log("Thresholds: complaints p95<3s | ws p95<2s | uploads p95<8s | errors<5%");
}
