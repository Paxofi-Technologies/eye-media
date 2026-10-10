# Engineering decisions (Eye TV MVP)

Short records of the choices made while building. The architecture itself (Next.js public + admin, PCF v1.1.0 as the
target backend, Vite removed) was approved by the owner on 10 Oct 2026. See [ARCHITECTURE.md](ARCHITECTURE.md).

| # | Decision | Why |
|---|---|---|
| D1 | **One repo, `eye-media`, with Eye TV as the first module** under `/tv` | The SRS defines one platform with four pillars sharing identity, RBAC, moderation and media. Separate repos would duplicate that backbone. The routes match SRS §5. |
| D2 | **Next.js 16 (App Router) + TypeScript** for both the public site and admin. **Vite removed** (owner decision, 10 Oct 2026). | Server-rendered pages are fast on Nigerian mobile networks and good for SEO (NFR-02, FR-10). One deployable unit suits cPanel hosting. |
| D3 | **MySQL 8 / MariaDB 10.6+ via Drizzle ORM** | Owner requirement: cPanel hosting. Drizzle has no binary engine (unlike Prisma), so it runs anywhere Node runs. IDs are app-generated UUIDs and JSON is stored as TEXT, so the same schema works on MySQL and MariaDB. |
| D4 | **Deploy to cPanel “Setup Node.js App” on Node 22; the release zip is built in CI and uploaded by hand** | Shared hosts can't reliably build Next.js. The release is self-contained, with `server/` kept out of the app root because of how CloudLinux handles `node_modules`. Migrations run automatically on boot. Node 22 is the minimum: Node 20 reaches end-of-life in April 2026. |
| D5 | **YouTube as the only video/live provider for MVP** (`provider` column ready for more) | SRS §10 / FR-04: no custom streaming infrastructure. YouTube handles transcoding, CDN and live ingest for free. |
| D6 | **The YouTube stream key is never stored in Eye TV** | The prototype showed it in the admin. It's a broadcast secret that belongs in YouTube Studio or OBS; Eye TV only needs the public video id to embed. |
| D7 | **Citizen video links are not embedded publicly.** Staff re-upload approved footage to the Eye TV channel. | Third-party links are untrusted (malware, rights, takedowns). Approval requires an Eye TV YouTube video to be attached. |
| D8 | **Approval requires the full verification checklist; flag/reject require a note** | Enforces “open access + professional gatekeeping” on the server, not just in the UI. |
| D9 | **Submitter PII lives in its own table** and is shown only to roles with `submission.contact.view` | NFR-05: public queries can't leak it by accident. The e2e suite asserts this. |
| D10 | **Session auth built in** (argon2id, hashed session tokens in the DB, HttpOnly SameSite cookies) | Five staff roles don't justify an external IdP for MVP. The structure is ready for SSO or 2FA later. |
| D11 | **Strict CSP with per-request nonces**, privacy-enhanced YouTube embeds, click-to-play | Defence against XSS. No third-party requests until the viewer chooses to play. |
| D12 | **Styling in plain CSS with brand tokens** (ported from the prototype) | The Figma redesign is expected soon, so this keeps the swap cheap and avoids committing to a CSS framework the designer may not use. |
| D13 | **Staging at eyetv.paxofi.com, closed to search engines** (`SITE_INDEXING` off) | The same release later moves to the production domain with `SITE_INDEXING=true`. Staging can't be indexed and compete with the real site. |
| D14 | **Backend: PCF v1.1.0 is the target. Eye TV ships first with an interim Next.js server layer.** | Owner decision, 10 Oct 2026: keep momentum now and move to PCF once concluded. Pages only call query modules and server actions, so the backend can be swapped behind them. Plan in [ARCHITECTURE.md](ARCHITECTURE.md). |

## Open items for the product owner / client (SRS §13)

- ~~Final editorial policy and privacy/consent wording~~ — approved by the owner (10 Oct 2026).
- Contributor terms and the data-retention period for submitter details.
- Production YouTube channel for Eye TV, plus who holds the channel credentials.
- Production domain. (cPanel with Node.js 22 is confirmed, and staging will be eyetv.paxofi.com.)
- Whether direct video upload (rather than links) is needed for MVP. That would need storage and a size policy.
