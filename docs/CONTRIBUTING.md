# Contributing to SevaJyothi

Welcome to the SevaJyothi project. Whether you are a human developer or an AI coding assistant, you **must** strictly adhere to the following guidelines before committing code or opening a pull request.

## 1. Branch Strategy
- `main`: Production-ready code. Locked.
- `staging`: Integration branch.
- `feat/feature-name`: For new features.
- `fix/bug-name`: For bug fixes.

## 2. Commit Message Format
We follow Conventional Commits:
- `feat: [module] description`
- `fix: [module] description`
- `docs: update PROJECT_CONTEXT.md`
- `chore: update dependencies`

## 3. Architecture Rules
- **Offline-First**: Never bypass IndexedDB for core data entry.
- **Security-First**: Never implement client-side workarounds for RLS errors. Fix the database policies.
- **Backend-Authoritative**: Never trust frontend validations. Enforce at the DB/Edge Function layer.

## 4. Coding Conventions
- **TypeScript**: Strict mode is enforced. No `any` types.
- **React**: Functional components only. Hooks must be heavily memoized (`useMemo`, `useCallback`) when dealing with IndexedDB or mapping instances.
- **UI**: Use `.glass` utilities for styling. Respect `env(safe-area-inset-bottom)`.

## 5. Migration Rules
- **Immutable History**: Never edit an existing `.sql` migration file in `supabase/migrations`.
- **Naming**: Always prefix new migrations with the current timestamp (e.g., `20260814120000_feature.sql`).
- **Documentation**: Any schema change MUST be documented in `PROJECT_CONTEXT.md`.

## 6. Pull Request Checklist
Before requesting review, you must verify:
- [ ] Code compiles without TS errors (`npm run build`).
- [ ] No React warnings or console errors.
- [ ] Tested in Offline Mode (Network throttled to Offline in DevTools).
- [ ] Tested on Mobile viewport.
- [ ] Updated `PROJECT_CONTEXT.md` and `CHANGELOG.md`.

## 7. Security Rules
- NEVER hardcode `service_role` keys in the frontend.
- NEVER expose sensitive user data (`auth.users`) to the client without aggressive RLS filtering.
- ALWAYS use Edge Functions for privileged administrative operations.
