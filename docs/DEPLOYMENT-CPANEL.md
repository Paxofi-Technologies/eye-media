# Deploying Eye TV on cPanel — step by step

**Staging:** `https://eyetv.paxofi.com` (hidden from search engines)  ·  **Production:** the client's domain, later

Eye TV runs as a **Node.js 22** application under cPanel → *Setup Node.js App*, with a **MySQL/MariaDB** database.
You never build on the server: every release is a ready-made **`eye-tv-release.zip`** that you upload and extract.

> **There is no SQL file to import.** You only create an empty database (A2). The app creates and updates its own
> tables when it starts, and so do the *Run JS script* commands, so the order you do things in doesn't matter.

---

## Part A — One-time setup (first deployment only)

### A1. Create the subdomain

1. cPanel → **Domains** → **Create A New Domain**.
2. Domain: `eyetv.paxofi.com`. Untick “Share document root” and accept the suggested folder (it won't be used).
3. Save, then give the subdomain an SSL certificate **before** opening it in a browser. See **A1b**.

### A1b. SSL certificate (required, because paxofi.com goes through Cloudflare)

`eyetv.paxofi.com` is **Proxied** (orange cloud) in Cloudflare, and Cloudflare connects to your server only over
HTTPS with a valid certificate (SSL mode *Full (strict)*). Until the subdomain has a certificate on the cPanel side,
visitors see **Cloudflare error 526 “Invalid SSL certificate”**. Pick **one** of the following:

**Option 1 (recommended): Cloudflare Origin Certificate.** It works while proxied and lasts 15 years.
1. Cloudflare dashboard → **paxofi.com** → **SSL/TLS** → **Origin Server** → **Create Certificate**.
2. Keep “Generate private key and CSR with Cloudflare”, RSA. Hostnames: `eyetv.paxofi.com` (or `*.paxofi.com` to cover future subdomains). Validity: 15 years. Click **Create**.
3. Keep that page open. You need both the **Origin Certificate** and the **Private Key** (shown only once).
4. cPanel → **SSL/TLS** → **Manage SSL sites** → Domain: `eyetv.paxofi.com`. Paste the certificate into **Certificate (CRT)** and the key into **Private Key (KEY)** → **Install Certificate**.

**Option 2: cPanel AutoSSL.**
1. cPanel → **SSL/TLS Status** → tick `eyetv.paxofi.com` → **Run AutoSSL**.
2. If it fails because of the proxy: in Cloudflare → **DNS**, set the `eyetv` record to **DNS only** (grey cloud), run AutoSSL again, wait for the green padlock, then switch the record back to **Proxied**.

Also in Cloudflare, for this subdomain:
- Keep the SSL/TLS mode at **Full (strict)**. Do **not** use *Flexible*: it sends traffic to your server unencrypted and causes redirect loops.
- Turn **Rocket Loader off**: it rewrites scripts and breaks Eye TV's security policy (pages would load without interactivity). *Speed → Optimization → Content Optimization → Rocket Loader*, or a Configuration Rule for `eyetv.paxofi.com`.

### A2. Create the database

1. cPanel → **MySQL® Databases**.
2. **Create New Database** called `eyetv`. cPanel adds your prefix, e.g. `cpuser_eyetv`. Write the full name down.
3. **Add New User** called `eyetv` with a strong generated password, e.g. `cpuser_eyetv`. Write both down.
4. **Add User To Database**: pick that user and database, then tick **ALL PRIVILEGES** → *Make Changes*.

### A3. Create the Node.js application

1. cPanel → **Setup Node.js App** → **Create Application**.
2. Fill in:

| Field | Value |
|---|---|
| Node.js version | **22.x** (the newest 22 offered) |
| Application mode | **Production** |
| Application root | `eyetv-staging` |
| Application URL | `eyetv.paxofi.com` |
| Application startup file | `app.js` |

3. Under **Environment variables**, click **Add Variable** for each row:

| Name | Value |
|---|---|
| `DATABASE_URL` | `mysql://cpuser_eyetv:PASSWORD@localhost:3306/cpuser_eyetv`. If the password contains symbols such as `@ : / # ? &`, replace them with `%40 %3A %2F %23 %3F %26`. |
| `SITE_URL` | `https://eyetv.paxofi.com` (no slash at the end) |
| `SITE_INDEXING` | `false` (staging must stay out of Google) |
| `IP_HASH_SECRET` | a long random string (40+ characters, e.g. from a password generator) |
| `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_KEY_PRIVATE`, `MUX_WEBHOOK_SECRET` | From your Mux dashboard: follow **docs/MUX-SETUP.md** (Eye-TV-Mux-Setup-Guide.pdf). Without them video upload and live streaming are switched off. |
| `EYE_REPORT_WEBHOOK_SECRET` | Shared secret with the EyeReport platform: **64 random letters and numbers** (e.g. `openssl rand -hex 32`, minimum 40), different for staging and production. Needed for the EyeReport hand-off. See docs/EYE-REPORT-INTEGRATION.md. |
| `EYE_REPORT_CALLBACK_URL` | The https address on EyeReport where Eye TV reports publish/reject decisions (given by the EyeReport team). Optional until EyeReport is ready. |

4. Click **Create**. **Do not** click “Run NPM Install”: the release already contains everything it needs.
5. Leave this page open. You'll come back to it.

### A4. Upload the first release — follow Part B below

### A5. Create your admin login (no SSH needed)

1. Back in **Setup Node.js App** → *Edit* (pencil) on the Eye TV app.
2. Add two temporary variables: `EYE_ADMIN_EMAIL` = your email, and `EYE_ADMIN_NAME` = your name. Click **Save**.
3. Scroll to **Run JS script**, choose **`eyetv:create-admin`**, and click **Run JS script**.
4. The output window shows `Temporary password (shown once): …`. **Copy it now**, because it is not stored anywhere.
5. **Delete** the two `EYE_ADMIN_*` variables and click **Save**.
6. Open `https://eyetv.paxofi.com/admin/login`, sign in, and create the other staff accounts under **Staff Users**.

> To reset a forgotten admin password later, repeat A5. Running it for an existing email resets that account's password.

### A6. (Staging only) Load the demo content for the owner

So the owner sees a full site, load the same demo stories as the prototype. This creates **no logins**.

- **Run JS script** → **`eyetv:demo-content`**.
- Before launch, remove it with **Run JS script** → **`eyetv:remove-demo`**. That deletes all videos, schedule entries and the audit log, but keeps staff accounts and categories.
  Never run `eyetv:demo-content` on production.

---

## Part B — Every deployment (upload a new release)

You'll receive **`eye-tv-release.zip`** from the developer. Every passing build on `main` also produces one under GitHub → *Actions* → *cPanel release package* → *Artifacts*.

1. cPanel → **File Manager** → open the application root folder **`eyetv-staging`**.
2. **Keep a rollback copy:** if a folder called `server` exists, rename it to `server-previous`. First delete any older `server-previous`.
3. Click **Upload**, select `eye-tv-release.zip`, and wait for 100%. Then go back to the folder.
4. Right-click `eye-tv-release.zip` → **Extract** → extract into `/home/CPANELUSER/eyetv-staging` → **Extract Files**. Allow it to overwrite `app.js`, `package.json` and `tmp/restart.txt`.
5. Delete `eye-tv-release.zip` from the server.
6. **Setup Node.js App** → click **Restart** on the Eye TV app. (The new `tmp/restart.txt` usually triggers a restart on its own; the button makes sure.)
7. **Check:** open `https://eyetv.paxofi.com/api/health`. It should show `{"status":"ok"}`. Then open the home page.

### If something goes wrong — roll back

1. File Manager: delete `server`, then rename `server-previous` back to `server`.
2. **Restart** the app.
3. Send the developer the last lines of **`stderr.log`** from the application root. If a database update fails, the app refuses to start, so the error will be in that file.

---

## Part C — Moving from staging to the production domain (later)

1. Repeat **A1–A3** with the production domain and a **new, separate database**. For example: application root `eyetv-production`, `SITE_URL=https://<production domain>`, **`SITE_INDEXING=true`**, a new `IP_HASH_SECRET`.
2. Upload the same release (**Part B**) and create the admin (**A5**). **Do not** load the demo content.
3. Point an uptime monitor (e.g. UptimeRobot, free) at `https://<production domain>/api/health`.
4. In cPanel **Backup**, confirm daily backups include the production database.

## Troubleshooting

| What you see | Cause | Fix |
|---|---|---|
| Cloudflare **526 Invalid SSL certificate** | No valid certificate for the subdomain on cPanel | **A1b** |
| Cloudflare **521/522/523** | The Node.js app is stopped or crashed | *Setup Node.js App* → **Start App** / **Restart**; then read `stderr.log` in the application root |
| *Run JS script* output says **Access denied for user** | Wrong user or password in `DATABASE_URL`, or the user isn't added to the database | Re-check **A2** step 4 and `DATABASE_URL` (encode special characters) |
| Output says **Unknown database** | The database name in `DATABASE_URL` is missing the cPanel prefix | Use the full name, e.g. `cpuser_eyetv` |
| Output says **ZodError … email / name** | `EYE_ADMIN_EMAIL` / `EYE_ADMIN_NAME` missing or invalid | Set both, click **Save**, run again |
| Pages show but buttons/forms don't react | Cloudflare **Rocket Loader** is on | Turn it off (**A1b**) |
| No “Drag & drop or click to upload” box, or “not set up on this server yet” | Mux variables missing | Follow MUX-SETUP.md, then **Restart** |
| Links contain `//` | Old release with a trailing slash in `SITE_URL` | Remove the trailing slash, or upload the latest release |

Every *Run JS script* command and the app itself print the real database error (with a code such as
`ER_ACCESS_DENIED_ERROR`) instead of only “Failed query”. Copy that line when asking for help.

## Requirements and limits (for reference)

- Node.js **22+**, and MySQL 8 or MariaDB 10.6+.
- **Videos** are stored, converted and delivered by Mux (up to 500MB per upload), so they do not use cPanel disk space or bandwidth. Old files from before Mux (if `MEDIA_DIR` is still set) stay playable and should be backed up with the database.
- One app process. Login rate limits are kept in memory, which is fine on cPanel. Before running several processes on a VPS, they must move to Redis.
- Password hashing uses a prebuilt Linux x64 module, which works on standard cPanel/CloudLinux servers.
- **Moving to a VPS later:** copy the same release folder, run `node app.js` behind Nginx with pm2 or systemd, and set the same variables. The data moves with `mysqldump`. No code changes are needed.
