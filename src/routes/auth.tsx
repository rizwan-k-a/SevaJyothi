import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowLeft, Mail, Lock, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · SevaJyothi" },
      { name: "description", content: "Secure access to SevaJyothi." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";

// Quick-login panel is gated on dev builds only. Backend seeded accounts remain
// (credentials are documented separately) — only the convenience UI is hidden.
const DEV_TEST_MODE = import.meta.env.DEV;

const DEV_ACCOUNTS: Array<{ label: string; email: string; password: string; role: "authority" | "technician" }> = [
  { label: "Admin",   email: "admin@sevajyothi.dev",        password: "Admin123456", role: "authority" },
  { label: "Arjun",   email: "arjun.tech@sevajyothi.dev",   password: "Tech123456",  role: "technician" },
  { label: "Kiran",   email: "kiran.tech@sevajyothi.dev",   password: "Tech123456",  role: "technician" },
  { label: "Manoj",   email: "manoj.tech@sevajyothi.dev",   password: "Tech123456",  role: "technician" },
  { label: "Darshan", email: "darshan.tech@sevajyothi.dev", password: "Tech123456",  role: "technician" },
  { label: "Rahul",   email: "rahul.tech@sevajyothi.dev",   password: "Tech123456",  role: "technician" },
  { label: "Praveen", email: "praveen.tech@sevajyothi.dev", password: "Tech123456",  role: "technician" },
];

async function routeForUser(userId: string): Promise<"/admin" | "/technician" | "/citizen"> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role as string);
  if (roles.includes("authority")) return "/admin";
  if (roles.includes("technician")) return "/technician";
  return "/citizen";
}

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [devBusy, setDevBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      routeForUser(user.id).then((to) => navigate({ to }));
    }
  }, [user, authLoading, navigate]);

  const finishSignIn = async (uid: string) => {
    const to = await routeForUser(uid);
    navigate({ to });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || password.length < 6) {
      toast.error("Enter a valid email and 6+ character password");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/citizen`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account created", { description: "You're signed in." });
        if (data.user) {
          await supabase.rpc("app_log_event" as any, { _event_type: "login_success", _metadata: { method: "signup" } });
          await finishSignIn(data.user.id);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          // Log failure (no session — call only succeeds for authenticated; safe to ignore failure here)
          throw error;
        }
        if (data.user) {
          await supabase.rpc("app_log_event" as any, { _event_type: "login_success", _metadata: { method: "password" } });
          await finishSignIn(data.user.id);
        }
      }
    } catch (err: any) {
      const msg = err?.message ?? "Couldn't authenticate.";
      if (/invalid login/i.test(msg)) toast.error("Wrong email or password");
      else if (/already registered/i.test(msg)) toast.error("Email already registered — sign in instead");
      else toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const devLogin = async (acct: typeof DEV_ACCOUNTS[number]) => {
    setDevBusy(acct.email);
    setEmail(acct.email);
    setPassword(acct.password);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: acct.email,
        password: acct.password,
      });
      if (error) throw error;
      toast.success(`Signed in as ${acct.label}`);
      if (data.user) await finishSignIn(data.user.id);
    } catch (err: any) {
      toast.error(err?.message ?? "Dev login failed");
    } finally {
      setDevBusy(null);
    }
  };


  return (
    <div className="relative min-h-[100svh] overflow-x-hidden overflow-y-auto">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-20 h-[500px] w-[500px] rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(closest-side, oklch(0.58 0.21 264 / 0.4), transparent 70%)" }} />
        <div className="absolute -right-32 bottom-0 h-[600px] w-[600px] rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(closest-side, oklch(0.78 0.10 200 / 0.5), transparent 70%)" }} />
      </div>

      <Link to="/" className="absolute left-6 top-6 z-10 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground" data-cursor="link">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="relative mx-auto grid min-h-[100svh] max-w-md place-items-center px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          className="glass w-full rounded-3xl p-8 shadow-xl"
        >
          <div className="mb-6 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-mono-data text-accent">
            <ShieldCheck className="h-3.5 w-3.5" /> Secure access
          </div>
          <h1 className="text-display text-4xl">
            {mode === "signin" ? "Welcome back" : "Join "}
            {mode === "signup" && (
              <span className="text-accent-script text-accent text-[1.4em] leading-[0.6]">SevaJyothi</span>
            )}
          </h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            {mode === "signin"
              ? "Sign in to file reports and track resolutions."
              : "Create your citizen account. Phone OTP arrives in a later release."}
          </p>

          <a href="/admin?demo=true" className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-mono-data text-[10.5px] uppercase tracking-[0.16em] text-accent hover:bg-accent/10">
            Judges · open demo mode →
          </a>

          <div className="mt-6" />


          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              onSubmit={submit}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="space-y-3"
            >
              {mode === "signup" && (
                <Field label="Name">
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-transparent py-3 px-1 text-[15px] outline-none"
                  />
                </Field>
              )}
              <Field label="Email" icon={<Mail className="h-4 w-4 text-muted-foreground" />}>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@village.in"
                  className="w-full bg-transparent py-3 px-1 text-[15px] outline-none"
                />
              </Field>
              <Field label="Password" icon={<Lock className="h-4 w-4 text-muted-foreground" />}>
                <input
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent py-3 px-1 text-[15px] outline-none"
                />
              </Field>

              <button
                type="submit"
                disabled={loading}
                data-cursor="cta"
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[14px] font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </motion.form>
          </AnimatePresence>

          <div className="mt-6 text-center text-[12.5px] text-muted-foreground">
            {mode === "signin" ? "New to SevaJyothi?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="font-medium text-accent hover:underline"
              data-cursor="link"
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </div>

          {DEV_TEST_MODE && (
            <div className="mt-6 rounded-2xl border border-dashed border-accent/40 bg-accent/5 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-mono-data text-[10.5px] uppercase tracking-[0.16em] text-accent">
                  Dev test access
                </span>
                <span className="text-[10px] text-muted-foreground">one-click sign in</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {DEV_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    disabled={devBusy !== null}
                    onClick={() => devLogin(a)}
                    data-cursor="link"
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-white/70 px-2.5 py-2 text-left text-[12px] transition hover:border-accent hover:bg-accent/10 disabled:opacity-50"
                  >
                    <span className="font-medium">{a.label}</span>
                    <span className="text-[9.5px] uppercase tracking-wider text-muted-foreground">
                      {devBusy === a.email ? "…" : a.role === "authority" ? "Admin" : "Tech"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 border-t border-border/70 pt-5 text-center text-[11.5px] text-muted-foreground">
            Roles · <span className="text-foreground">Citizen</span> · Authority · Technician
            <div className="mt-1 text-mono-data uppercase tracking-[0.14em] text-accent">
              Citizen role assigned automatically on signup
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-input bg-white/70 px-3 transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
        {icon}
        {children}
      </div>
    </label>
  );
}

