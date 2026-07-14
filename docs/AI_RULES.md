# SEVAJYOTHI AI ENGINEERING CONSTITUTION

This document is the permanent engineering constitution of the SevaJyothi project. 

**Every future AI assistant (GitHub Copilot Agent, Claude Code, Cursor, Gemini CLI, VS Code Agent, ChatGPT, etc.) MUST read and obey this file before writing any code.**

The rules contained herein are absolute. Future AI assistants MUST treat these rules as immutable unless explicitly overridden by the project owner.

---

## CORE PRINCIPLES

The project is permanently:
- **Offline-first**
- **Security-first**
- **Backend-authoritative**
- **Type-safe**
- **Least-privilege**

These principles are immutable.

---

## ARCHITECTURE RULES

The AI **MUST NOT**:
- remove offline-first architecture
- replace IndexedDB
- replace Service Worker
- remove Background Sync
- remove Supabase
- replace authentication architecture
- redesign routing
- redesign folder structure
- rewrite architecture without explicit approval

The AI **MUST**:
- reuse existing services
- reuse existing hooks
- reuse existing APIs
- reuse existing components
- preserve separation of concerns
- keep business logic outside UI components
- maintain modular architecture

---

## SECURITY RULES

**NEVER**:
- expose Service Role keys
- expose secrets
- bypass RLS
- disable RLS
- create "allow all" policies
- leak `auth.users` data
- trust frontend validation
- perform privileged operations in the browser

**ALWAYS**:
- enforce permissions on backend
- follow least privilege
- validate all inputs
- sanitize outputs

---

## OFFLINE RULES

Offline-first is mandatory.

**NEVER**:
- replace IndexedDB with LocalStorage
- remove queue
- remove sync worker
- remove retry logic

**ALWAYS**:
- queue offline actions
- synchronize automatically
- preserve user data
- prevent data loss
- recover gracefully

Manual Retry buttons are fallback mechanisms ONLY. Automatic synchronization is mandatory.

---

## DATABASE RULES

**NEVER**:
- bypass migrations
- edit production tables manually
- duplicate schema
- duplicate RPCs

**ALWAYS**:
- create migrations
- document schema changes
- update `PROJECT_CONTEXT.md`
- preserve backward compatibility

---

## EDGE FUNCTION RULES

Edge Functions **MUST**:
- validate input
- return structured errors
- never swallow exceptions
- never return generic errors in development
- log failures
- use `service_role` ONLY where appropriate

---

## FRONTEND RULES

**NEVER**:
- duplicate components
- duplicate business logic
- duplicate API calls
- hardcode users
- hardcode IDs
- hardcode environment values

**ALWAYS**:
- use reusable components
- keep components focused
- maintain responsive layouts
- preserve accessibility

---

## TYPESCRIPT RULES

Strict mode is mandatory.

**NEVER**:
- use `any`
- disable strict mode
- ignore compiler errors

**ALWAYS**:
- use explicit types
- maintain type safety
- remove dead code
- eliminate warnings

---

## UI RULES

**PRESERVE**:
- SevaJyothi branding
- typography
- spacing
- colors
- glassmorphism
- responsive layouts

**NEVER** redesign the UI without explicit approval.

---

## TESTING RULES

Every significant change **MUST** verify:
- `npm run build`
- TypeScript compilation
- no console errors
- no React warnings
- no broken routes
- no broken authentication
- no RLS violations
- no offline regressions

**NEVER** claim success without verification.

---

## DOCUMENTATION RULES

Whenever architecture changes:

**ALWAYS** update:
- `PROJECT_CONTEXT.md`
- `README.md`
- `KNOWN_HISTORY.md`
- `AI_RULES.md` (if required)

---

## PROHIBITED ACTIONS

The AI **MUST NEVER**:
- introduce mock data into production
- delete migrations
- delete Edge Functions without approval
- rewrite completed modules
- remove security
- disable authentication
- ignore lint/build failures
- claim production readiness without proof

---

## BEHAVIOR RULES

The AI **MUST**:
- understand existing architecture first
- minimize changes
- preserve compatibility
- explain trade-offs before major refactors
- prefer incremental improvements
- avoid unnecessary rewrites
- respect existing design decisions

**This document is authoritative.**
