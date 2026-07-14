import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Home,
  LogOut,
  Map,
  FileText,
  ClipboardList,
  BarChart3,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { useAuth } from "@/components/providers/AuthProvider";

type NavLink = { to: string; label: string; icon?: typeof Home };

const publicLinks: NavLink[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/citizen/report", label: "Report Issue", icon: FileText },
  { to: "/docs", label: "Documentation" },
];

const citizenLinks: NavLink[] = [
  { to: "/citizen", label: "Dashboard", icon: Home },
  { to: "/citizen/report", label: "Report", icon: FileText },
];

const technicianLinks: NavLink[] = [{ to: "/technician", label: "Jobs", icon: ClipboardList }];

const authorityLinks: NavLink[] = [
  { to: "/admin", label: "Command Center", icon: BarChart3 },
  { to: "/admin/technicians", label: "Users", icon: Users },
];

export function FloatingNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const { user, roles, signOut } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const { links, role } = useMemo<{
    links: NavLink[];
    role: "authority" | "technician" | "citizen" | "public";
  }>(() => {
    if (!user) return { links: publicLinks, role: "public" };
    if (roles.includes("authority")) return { links: authorityLinks, role: "authority" };
    if (roles.includes("technician")) return { links: technicianLinks, role: "technician" };
    return { links: citizenLinks, role: "citizen" };
  }, [user, roles]);

  if (pathname.startsWith("/auth")) return null;

  const tabs = mobileTabsForRole(role);

  return (
    <>
      <motion.header
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        className="fixed inset-x-0 top-3 z-50 flex justify-center px-3 pt-safe"
        data-cursor="nav"
      >
        <nav
          className={`glass flex w-full max-w-[760px] items-center gap-1 rounded-full transition-all duration-500 sm:w-auto ${
            scrolled ? "px-2 py-1.5 shadow-xl" : "px-2.5 py-2"
          }`}
        >
          <Link
            to={role === "authority" ? "/admin" : role === "technician" ? "/technician" : "/"}
            className="group flex items-center gap-2 rounded-full px-2.5 py-1.5 sm:px-3"
          >
            <span className="relative grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground">
              <Zap className="h-3.5 w-3.5" strokeWidth={2.5} />
              <span className="absolute inset-0 rounded-full ring-1 ring-accent/40" />
            </span>
            <span className="text-display text-[17px] tracking-tight">
              Seva
              <span className="text-accent-script text-accent text-[22px] -ml-0.5 relative -top-0.5">
                jyothi
              </span>
            </span>
            {role !== "public" && (
              <span className="ml-1 hidden rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-foreground/70 sm:inline">
                {role}
              </span>
            )}
          </Link>
          <div className="mx-1 hidden h-5 w-px bg-border/70 sm:block" />
          <ul className="hidden items-center gap-0.5 sm:flex">
            {links.map((l) => {
              const active = pathname === l.to || (l.to !== "/" && pathname.startsWith(l.to));
              return (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="relative inline-block rounded-full px-3.5 py-2 text-[13px] font-medium text-foreground/75 transition-colors hover:text-foreground"
                    data-cursor="link"
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-full bg-foreground/[0.06]"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    )}
                    <span className="relative">{l.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="ml-auto flex items-center gap-1">
            {user ? (
              <>
                <NotificationCenter />
                <button
                  onClick={async () => {
                    await signOut();
                    navigate({ to: "/" });
                  }}
                  data-cursor="button"
                  title="Sign out"
                  className="hidden min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-foreground/75 hover:text-foreground sm:inline-flex"
                >
                  <LogOut className="h-3.5 w-3.5" /> Logout
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                data-cursor="cta"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-all hover:brightness-110"
              >
                Sign in
              </Link>
            )}
          </div>
        </nav>
      </motion.header>

      {/* Mobile bottom tab bar — only when authenticated */}
      {user && tabs.length > 0 && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl sm:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <ul className="mx-auto flex max-w-md items-stretch justify-around">
            {tabs.map((t) => {
              const active = pathname === t.to || (t.to !== "/" && pathname.startsWith(t.to));
              const Icon = t.icon ?? Home;
              return (
                <li key={t.label} className="flex-1">
                  <Link
                    to={t.to}
                    className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-[10.5px] font-medium transition-colors ${
                      active ? "text-accent" : "text-foreground/60"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.5 : 2} />
                    <span>{t.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}

function mobileTabsForRole(role: "authority" | "technician" | "citizen" | "public"): NavLink[] {
  switch (role) {
    case "authority":
      return [
        { to: "/admin", label: "Queue", icon: ClipboardList },
        { to: "/admin", label: "Map", icon: Map },
        { to: "/admin", label: "Analytics", icon: BarChart3 },
        { to: "/admin/technicians", label: "Users", icon: Users },
      ];
    case "technician":
      return [
        { to: "/technician", label: "Jobs", icon: ClipboardList },
        { to: "/technician", label: "Map", icon: Map },
        { to: "/technician", label: "Updates", icon: Wrench },
      ];
    case "citizen":
      return [
        { to: "/citizen", label: "Home", icon: Home },
        { to: "/citizen/report", label: "Report", icon: FileText },
        { to: "/citizen", label: "History", icon: Bell },
      ];
    default:
      return [];
  }
}
