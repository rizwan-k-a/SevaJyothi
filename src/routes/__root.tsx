import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { IntelligentCursor } from "../components/cursor/IntelligentCursor";
import { FloatingNav } from "../components/layout/FloatingNav";
import { OfflineProvider } from "../components/providers/OfflineProvider";
import { AuthProvider } from "../components/providers/AuthProvider";
import { usePWA } from "../hooks/use-pwa";
import { Toaster } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-display text-7xl">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Signal lost</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The route you requested doesn't exist on the SevaJyothi network.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-90"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    // Analytics/telemetry can go here
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-2xl text-left">
        {import.meta.env.DEV ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 font-mono text-sm text-red-600 dark:text-red-400">
            <h1 className="mb-4 text-xl font-bold uppercase tracking-wider text-red-500">
              Runtime Exception
            </h1>
            <div className="mb-2 font-bold">
              {error.name}: {error.message}
            </div>
            <pre className="mt-4 whitespace-pre-wrap rounded-md bg-black/10 p-4 text-xs leading-relaxed opacity-90 overflow-auto max-h-[500px]">
              {error.stack}
            </pre>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  router.invalidate();
                  reset();
                }}
                className="rounded-md bg-red-500 px-4 py-2 text-white hover:bg-red-600"
              >
                Retry Render
              </button>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-md text-center">
            <h1 className="text-display text-3xl">
              {error.name === "ChunkLoadError" || error.message.includes("fetch")
                ? "Feature unavailable offline"
                : "Something interrupted the signal"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {error.name === "ChunkLoadError" || error.message.includes("fetch")
                ? "Connect to the internet to load this part of the application."
                : "Your data is safe. Try again or return to the home network."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => {
                  router.invalidate();
                  reset();
                }}
                className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
              >
                Retry
              </button>
              <a
                href="/"
                className="inline-flex items-center justify-center rounded-full border border-input bg-background px-5 py-2.5 text-sm font-medium"
              >
                Home
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Seva Jyothi - Rural infrastructure intelligence" },
      {
        name: "description",
        content:
          "Offline-first infrastructure fault reporting built for villages operating beyond the network edge.",
      },
      { name: "theme-color", content: "#0F172A" },
      // iOS / Safari PWA
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "SevaJyothi" },
      { name: "format-detection", content: "telephone=no" },
      { property: "og:title", content: "SevaJyothi" },
      { property: "og:description", content: "Rural infrastructure should never wait for signal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { rel: "icon", href: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      {
        rel: "stylesheet",
        href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
        crossOrigin: "",
      },
      {
        rel: "stylesheet",
        href: "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css",
        crossOrigin: "",
      },
      {
        rel: "stylesheet",
        href: "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css",
        crossOrigin: "",
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Allison&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <>
      <HeadContent />
      {children}
      <Scripts />
    </>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  usePWA();

  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("[SevaJyothi] Unhandled async rejection:", event.reason);
      // Fail safely without crashing the UI thread.
    };
    const handleError = (event: ErrorEvent) => {
      console.error("[SevaJyothi] Global error:", event.error);
    };

    window.addEventListener("unhandledrejection", handleRejection);
    window.addEventListener("error", handleError);
    return () => {
      window.removeEventListener("unhandledrejection", handleRejection);
      window.removeEventListener("error", handleError);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OfflineProvider>
          <IntelligentCursor />
          <FloatingNav />
          <main className="relative">
            <Outlet />
          </main>
          <Toaster position="top-center" theme="light" richColors closeButton />
        </OfflineProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
