import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Provider-layer guardrail: UI/routes should reach the backend through
  // @/services/providers/backendProvider, not the raw Supabase SDK.
  // Allowed leaks (auth listener, push subscription endpoints, low-level
  // offline queue) are listed in `files:` exclusions below.
  {
    files: ["src/components/**/*.{ts,tsx}", "src/routes/**/*.{ts,tsx}"],
    ignores: [
      "src/components/providers/AuthProvider.tsx",
      "src/components/notifications/NotificationCenter.tsx",
      "src/components/complaints/LifecycleTimeline.tsx",
      "src/routes/auth.tsx",
      "src/routes/admin.tsx",
      "src/routes/technician.tsx",
      "src/routes/citizen.index.tsx",
      "src/routes/__root.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "@/integrations/supabase/client",
              message:
                "UI layer must use `@/services/providers/backendProvider`. Direct SDK imports are restricted to provider adapters (see src/services/providers/adapters/lovableProvider.ts).",
            },
          ],
        },
      ],
    },
  },
  eslintPluginPrettier,
);
