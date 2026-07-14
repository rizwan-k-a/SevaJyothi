import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/components/providers/AuthProvider";
import { ShieldOff } from "lucide-react";
import { isDemoMode } from "@/lib/demo/fixtures";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { user, roles, loading } = useAuth();
  const demo = isDemoMode();
  const isAuthority = demo || roles.includes("authority");

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground bg-background">Loading portal…</div>;
  }

  if (!isAuthority) {
    return (
      <div className="flex min-h-screen flex-col bg-background pb-24 md:pb-0">
        <div className="mx-auto max-w-md rounded-3xl p-10 text-center mt-20 border border-border bg-muted/20">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-danger/10 text-danger">
            <ShieldOff className="h-6 w-6" />
          </div>
          <div className="text-mono-data text-[11px] uppercase tracking-[0.18em] text-danger">
            Restricted
          </div>
          <h1 className="mt-2 text-display text-3xl">Authority access required</h1>
          <p className="mt-3 text-[14px] text-muted-foreground">
            Your account does not have the <span className="text-foreground">authority</span> role.
            Ask a SevaJyothi administrator to grant access to this command centre.
          </p>
          <div className="mt-4 text-mono-data text-[11px] text-muted-foreground">
            UID · <span className="text-foreground">{user?.id}</span>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
