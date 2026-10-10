# Eye Media — architecture (approved 10 Oct 2026)

## Decision

| Layer | Now (Eye TV MVP) | Target |
|---|---|---|
| Public web | **Next.js 16 + React + TypeScript** | same |
| Admin | **Next.js 16 (same app)**. **Vite removed** by owner decision. | same |
| Backend / business logic | **Interim:** Next.js server code (server actions + query modules) | **PCF v1.1.0** (PHP 8.4 modular monolith), EyeTV module |
| Database | MySQL 8 / MariaDB 10.6+ | same database, same tables |
| Hosting | cPanel *Setup Node.js App* (Node 22) | Node app plus a PCF PHP app on the same cPanel, then a VPS later |
| Media | YouTube VOD + YouTube Live, with a provider field ready for others | same |

The owner chose to **continue with the current build** and move the backend to PCF v1.1.0 later, once that work is
concluded. Public pages and admin screens stay in Next.js permanently. Only the data layer underneath them changes.

## How the code is split today (the migration seam)

```
 Next.js pages & components (public /tv, admin /admin)      ← stays as-is
        │ read                         │ write
        ▼                              ▼
 src/lib/tv.ts, src/lib/admin.ts    src/app/admin/actions.ts, src/app/tv/submit/actions.ts
 (query functions)                  (server actions: validate → authorize → change → audit)
        │                              │
        └──────────────┬───────────────┘
                       ▼
            src/db (Drizzle) → MySQL
```

Rules that keep the move to PCF cheap:

- **Pages and components never touch the database directly.** They call the query functions or the server actions only.
- **Validation (`src/lib/validation.ts`) and permissions (`src/lib/rbac.ts`) are plain modules.** They become the API contract and PCF's authorisation rules.
- **The e2e suite (`e2e/run.mjs`) tests through the browser,** so it checks the same behaviour before and after the backend swap.

## Migration plan to PCF v1.1.0 (when scheduled)

1. **API contract** (ClickUp P0-ARCH-04). Derive versioned REST endpoints (`/api/v1/tv/...`) from the query functions and server actions above. Request and response shapes come from the Zod schemas.
2. **EyeTV PCF module** (TV-BE-01 to 07). Implement the endpoints on PCF: Router → Controller → PDO persistence, with transactions and request IDs. Database: reuse the existing tables. Move ownership of migrations from `drizzle/` to PCF.
3. **Auth.** PCF issues and validates staff sessions. Next.js forwards the session cookie on server-side calls, and the role and permission map moves across unchanged.
4. **Swap the data layer.** Re-implement `src/lib/tv.ts`, `src/lib/admin.ts` and the server actions as thin HTTP clients to PCF, keeping the same function signatures. Pages don't change.
5. **Verify.** The unit and e2e suites must pass unchanged against the PCF backend.
6. **Deploy.** The PCF app is a CI-built package with `vendor/`, uploaded by File Manager (PCF's “Profile C”) to a PHP 8.4 site on the same cPanel. The Next.js app stays on Setup Node.js App.

Hosting requirements PCF adds: **PHP ≥ 8.4** with `pdo_mysql` and `json`. Redis is optional, because PCF ships in-memory cache and queue
implementations. When Redis becomes available on the VPS, it should also replace the in-memory rate limiter in the Node app.
