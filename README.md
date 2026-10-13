# Eye Media — web platform (Eye TV first)

The Eye Media Group web platform from the [MVP SRS](https://app.notion.com/p/3d84cb59f257810aa864d64ef4f0d78f).
**Eye TV** is the first module shipping. EyeReport, Eye News and Eye Photo will slot in as further modules in this same codebase.

> **Design status:** the UI ports the approved Claude prototype. When the Figma designs arrive, the restyle
> lives in `src/styles/` (brand tokens in `tokens.css`) and in the presentational components under
> `src/components/`. Data, auth and workflows are not affected.

## What works today

**Public site (`/tv`)**
- Home: live hero, “Up next” schedule, latest reports, editor’s picks, categories.
- **Live:** any number of concurrent streams on `/tv/live`, a watch page per broadcast, and a **Live Schedule** (`/tv/schedule`) with a date strip, city filter and Lagos times.
- Archive search with category, verification and date filters, plus pagination. Results are shareable URLs and work without JavaScript.
- Video page with click-to-play Mux player (nothing loads from Mux until the viewer presses play), related videos, sharing, and SEO/Open Graph/JSON-LD metadata.
- **Report a story**: citizens submit a story with a video link and contact details, receive a reference number, and the story lands in the moderation queue. Includes rate limiting and a honeypot.
- Editorial & privacy policy page (approved by the owner), sitemap, robots.txt and a health check.

**Staff admin (`/admin`)**
- Session login: argon2id password hashing, HttpOnly cookies, rate limiting.
- **Moderation queue**: a verification checklist must be complete before approving. A note is required to flag or reject. Submitter contact details are shown only to roles allowed to see them.
- **Video registry**: create, edit, publish and unpublish, with filters and stats.
- **Live & schedule**: schedule live events (city, venue, time) with a Mux stream each, optional simulcast to YouTube/Facebook, go live, end or cancel several at once, and turn an ended stream into a replay draft. Operator guide: [docs/LIVE-STREAMING.md](docs/LIVE-STREAMING.md).
- **Audit & history**: every sign-in, moderation decision, edit and publish is recorded.
- **Staff users**: create, deactivate and reactivate accounts, each with one of five roles.

### Roles

| | Admin | Editor | Moderator | Media manager | Reporter |
|---|---|---|---|---|---|
| Review the queue (approve/flag/reject) | ✓ | ✓ | ✓ | | |
| Create/edit videos | ✓ | ✓ | | ✓ | |
| Publish/unpublish | ✓ | ✓ | | | |
| Live stream & schedule | ✓ | ✓ | | ✓ | |
| See submitter contact details | ✓ | ✓ | ✓ | | |
| Audit log | ✓ | ✓ | | | |
| Manage staff | ✓ | | | | |

These permissions are defined in one place, `src/lib/rbac.ts`. They are enforced on the server in every page and action; hiding things in the UI is cosmetic only.

## Stack

Next.js 16 (App Router, TypeScript) for **both the public site and the admin**, Drizzle ORM on **MySQL 8 / MariaDB 10.6+**, Zod validation, and Vitest plus Playwright for tests.
The backend currently lives in the Next.js app and will move to **PCF v1.1.0** later without changing the pages. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
It deploys to **cPanel “Setup Node.js App”** for now and can move to a VPS later without code changes. See [docs/DEPLOYMENT-CPANEL.md](docs/DEPLOYMENT-CPANEL.md) and [docs/DECISIONS.md](docs/DECISIONS.md).

## Local development

Requires **Node 22+** and MariaDB 10.6+ or MySQL 8.

```bash
# 1. Database (MariaDB example)
sudo mariadb -e "CREATE DATABASE eyemedia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER 'eyemedia'@'localhost' IDENTIFIED BY 'eyemedia_dev';
  GRANT ALL ON eyemedia.* TO 'eyemedia'@'localhost';"

# 2. App
cp .env.example .env          # then set IP_HASH_SECRET and SEED_ADMIN_PASSWORD
npm install
npm run db:migrate
npm run db:seed               # demo content + 5 demo staff logins (local dev only)
npm run dev                   # http://localhost:3000
```

Demo staff logins (all use `SEED_ADMIN_PASSWORD`): `admin@`, `editor@`, `moderator@`, `producer@` and `reporter@eyemedia.local`.
Use them to see how each role experiences the admin.

## Testing

| Command | What it checks |
|---|---|
| `npm run lint` / `npm run typecheck` | ESLint (Next.js rules) and strict TypeScript |
| `npm test` | Unit tests: RBAC, validation, Mux signing and webhook verification, slugs, rate limiting |
| `npm run test:e2e` | Drives the real app in Chromium: submit a story → editor logs in → checklist → approve → public page (and checks PII isn't leaked) → RBAC for the reporter role → sign-out. It also saves screenshots of every key screen to `screenshots/`. Needs a seeded database and a running server; set `E2E_PASSWORD`. |

All of this runs in GitHub Actions on every push, against a real MariaDB 10.11. The screenshots are attached to each CI run as an artifact for design review.

## Other scripts

| Command | |
|---|---|
| `npm run db:generate` | Create a migration after changing `src/db/schema.ts` (CI fails if you forget) |
| `npm run user:create -- --email x@y --name "…" --role admin` | Create or reset a staff account (password from `EYE_NEW_PASSWORD`, or generated) |
| `npm run build:cpanel` | Build the self-contained cPanel release into `release/` and `release.zip` (CI also attaches it to every passing build on `main`) |

## Project layout

```
src/app/tv/…              public Eye TV pages
src/app/admin/…           staff console (route groups: (auth) login, (console) app)
src/app/admin/actions.ts  all staff server actions (each re-checks permissions)
src/db/                   Drizzle schema + MySQL client
src/lib/                  auth, rbac, validation, queries (tv.ts public, admin.ts staff)
src/styles/               tokens.css (brand) + base/public/admin CSS
src/proxy.ts              CSP nonces + admin sign-in gate
deploy/cpanel/app.js      Passenger startup file
e2e/run.mjs               end-to-end suite
```

## Video and live (Mux)
All uploads and live streams use Mux; unpublished media is private. Setup and environment variables: [docs/MUX-SETUP.md](docs/MUX-SETUP.md). `npm run test:e2e` runs the browser suite against a built-in mock Mux, so no credentials are needed.
