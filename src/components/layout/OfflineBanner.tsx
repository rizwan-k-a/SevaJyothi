import { useOffline } from "@/components/providers/OfflineProvider";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, CloudOff, RefreshCw } from "lucide-react";

type BannerState = "hidden" | "offline" | "syncing" | "complete";

export function OfflineBanner() {
  const { online, pending, isSyncing, lastSyncTime } = useOffline();
  const [state, setState] = useState<BannerState>("hidden");

  useEffect(() => {
    if (!online) {
      setState("offline");
    } else if (online && state !== "hidden") {
      if (isSyncing) {
        setState("syncing");
      } else if (state === "syncing" || state === "offline") {
        setState("complete");
        const timer = setTimeout(() => setState("hidden"), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [online, isSyncing, state]);

  if (state === "hidden") return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[9999] w-[90%] max-w-sm -translate-x-1/2 animate-sj-fade-up">
      <div
        className="glass overflow-hidden rounded-2xl p-4 shadow-2xl transition-all duration-300"
        style={{
          background: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(24px)",
          color: "#0F172A",
          border: "1px solid rgba(255, 255, 255, 0.5)",
          transform: state === "complete" ? "scale(0.98)" : "scale(1)",
          opacity: state === "complete" ? 0.9 : 1,
        }}
      >
        {state === "offline" && (
          <>
            <div className="flex items-center gap-2 border-b border-black/10 pb-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500/20">
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
              </div>
              <h3 className="font-semibold text-slate-900">Offline Mode</h3>
            </div>

            <div className="pt-3 text-[13px] leading-relaxed text-slate-600">
              <ul className="mb-3 space-y-1">
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-slate-400" />
                  Dashboard cached
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-slate-400" />
                  Maps cached
                </li>
                {pending.length > 0 && (
                  <li className="flex items-center gap-1.5 font-medium text-yellow-600">
                    <CloudOff className="h-3 w-3 text-yellow-500" />
                    {pending.length} report{pending.length !== 1 ? "s" : ""} queued
                  </li>
                )}
                {lastSyncTime && (
                  <li className="flex items-center gap-1.5 text-slate-400">
                    <RefreshCw className="h-3 w-3" />
                    Last sync:{" "}
                    {lastSyncTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </li>
                )}
              </ul>

              <Link
                to="/citizen"
                className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-slate-100 py-2 font-medium text-slate-800 transition-colors hover:bg-slate-200"
              >
                View Queue
              </Link>
            </div>
          </>
        )}

        {state === "syncing" && (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
              <RefreshCw className="h-5 w-5 animate-spin" />
            </div>
            <h3 className="font-semibold text-slate-900">Connected</h3>
            <p className="mt-1 text-[13px] text-slate-600">
              Uploading {pending.length} report{pending.length !== 1 ? "s" : ""}...
            </p>
          </div>
        )}

        {state === "complete" && (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <Check className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-emerald-700">Sync Complete</h3>
            <p className="mt-1 text-[13px] text-emerald-600/80">All data is up to date.</p>
          </div>
        )}
      </div>
    </div>
  );
}
