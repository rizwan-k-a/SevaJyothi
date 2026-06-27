import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

export const Route = createFileRoute("/citizen")({
  component: CitizenLayout,
});

function CitizenLayout() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="grid min-h-[100svh] place-items-center">
        <div className="text-mono-data text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Loading session…
        </div>
      </div>
    );
  }

  if (!user) return null;
  return <Outlet />;
}
