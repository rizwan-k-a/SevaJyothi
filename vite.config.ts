import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { createTanStackStartPlugin } from "@tanstack/start-plugin";

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    createTanStackStartPlugin(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: {
    port: 8081,
    host: "::",
  },
  ssr: {
    noExternal: ["framer-motion"],
  },
});
