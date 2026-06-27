import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowLeft, Mail, Lock, ShieldCheck, Loader2, User, Phone, MapPin, Wrench, Car } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { citizenSignup, technicianSignup } from "@/lib/auth/signup.functions";

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
type SignupRole = "citizen" | "technician";

async function routeForUser(userId: string): Promise<"/admin" | "/technician" | "/citizen" | "pending"> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role as string);
  if (roles.includes("authority")) return "/admin";
  if (roles.includes("technician")) return "/technician";
  if (roles.includes("citizen")) return "/citizen";
  return "pending";
}

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [mode, setMode] = useState<Mode>("signin");
  const [signupRole, setSignupRole] = useState<SignupRole>("citizen");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [technicalSkill, setTechnicalSkill] = useState("");
  const [vehicleAvailable, setVehicleAvailable] = useState(false);
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      routeForUser(user.id).then(async (to) => {
        if (to === "pending") {
          await supabase.auth.signOut();
        } else {
          navigate({ to });
        }
      });
    }
  }, [user, authLoading, navigate]);

  const finishSignIn = async (uid: string) => {
    const to = await routeForUser(uid);
    if (to === "pending") {
      toast.info("Your technician access request is pending administrator approval.");
      await supabase.auth.signOut();
    } else {
      navigate({ to });
    }
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
        if (signupRole === "citizen") {
          await citizenSignup({
            data: {
              email,
              password,
              display_name: displayName || email.split("@")[0],
              phone,
              region,
            }
          });
          
          toast.success("Account created", { description: "Signing you in..." });
          
          // Now standard login will succeed since the account was created server-side
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          if (data.user) await finishSignIn(data.user.id);

        } else {
          await technicianSignup({
            data: {
              email,
              password,
              display_name: displayName || email.split("@")[0],
              phone,
              region,
              technical_skill: technicalSkill,
              vehicle_available: vehicleAvailable,
            }
          });
          
          toast.success("Application submitted", { description: "Your technician request is pending admin approval." });
          // Note: technician signup doesn't log them in automatically because they are pending approval.
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) {
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
              ? "Sign in to access your dashboard."
              : "Create an account to access the platform."}
          </p>

          <div className="mt-8" />

          <AnimatePresence mode="wait">
            <motion.form
              key={mode + (mode === "signup" ? signupRole : "")}
              onSubmit={submit}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="space-y-3"
            >
              {mode === "signup" && (
                <div className="mb-6 flex overflow-hidden rounded-2xl border border-input p-1">
                  <button
                    type="button"
                    onClick={() => setSignupRole("citizen")}
                    className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                      signupRole === "citizen" 
                        ? "bg-emerald-500 text-white shadow-sm" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Citizen
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignupRole("technician")}
                    className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                      signupRole === "technician" 
                        ? "bg-orange-500 text-white shadow-sm" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Technician
                  </button>
                </div>
              )}

              {mode === "signup" && signupRole === "technician" && (
                <div className="mb-4 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-600 dark:text-orange-400">
                  <strong>Approval Required:</strong> Technician accounts require manual review and approval by a district administrator before access is granted.
                </div>
              )}

              {mode === "signup" && (
                <Field label="Full Name" icon={<User className="h-4 w-4 text-muted-foreground" />}>
                  <input
                    value={displayName}
                    required
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

              {mode === "signup" && signupRole === "technician" && (
                <>
                  <Field label="Phone Number" icon={<Phone className="h-4 w-4 text-muted-foreground" />}>
                    <input
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 90000 00000"
                      className="w-full bg-transparent py-3 px-1 text-[15px] outline-none"
                    />
                  </Field>
                  <Field label="Service Region" icon={<MapPin className="h-4 w-4 text-muted-foreground" />}>
                    <input
                      required
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder="District or Zone"
                      className="w-full bg-transparent py-3 px-1 text-[15px] outline-none"
                    />
                  </Field>
                  <Field label="Technical Skill" icon={<Wrench className="h-4 w-4 text-muted-foreground" />}>
                    <input
                      required
                      value={technicalSkill}
                      onChange={(e) => setTechnicalSkill(e.target.value)}
                      placeholder="e.g. Electrical, Plumbing"
                      className="w-full bg-transparent py-3 px-1 text-[15px] outline-none"
                    />
                  </Field>
                  <label className="flex items-center gap-3 rounded-2xl border border-input bg-white/70 px-4 py-3 cursor-pointer">
                    <Car className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[13px] font-medium text-foreground flex-1">Vehicle Available</span>
                    <input 
                      type="checkbox" 
                      checked={vehicleAvailable}
                      onChange={(e) => setVehicleAvailable(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                    />
                  </label>
                </>
              )}

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
                className={`mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[14px] font-medium text-primary-foreground transition-all hover:brightness-110 disabled:opacity-60 ${
                  mode === "signup" && signupRole === "technician" ? "bg-orange-600" : "bg-primary"
                }`}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "signin" ? "Sign in" : signupRole === "technician" ? "Submit Application" : "Create account"}
              </button>
            </motion.form>
          </AnimatePresence>

          <div className="mt-6 text-center text-[12.5px] text-muted-foreground">
            {mode === "signin" ? "New to SevaJyothi?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setSignupRole("citizen");
              }}
              className="font-medium text-accent hover:underline"
              data-cursor="link"
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </div>

          <div className="mt-8 border-t border-border/70 pt-5 text-center text-[11.5px] text-muted-foreground">
            Roles · <span className="text-emerald-500">Citizen</span> · <span className="text-orange-500">Technician</span>
            <div className="mt-1 text-mono-data uppercase tracking-[0.14em] text-accent">
              Access controlled production system
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
