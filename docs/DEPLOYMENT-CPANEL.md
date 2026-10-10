# Deploying Eye TV on cPanel — step by step

**Staging:** `https://eyetv.paxofi.com` (hidden from search engines)  ·  **Production:** the client's domain, later

Eye TV runs as a **Node.js 22** application under cPanel → *Setup Node.js App*, with a **MySQL/MariaDB** database.
You never build on the server: every release is a ready-made **`eye-tv-release.zip`** that you upload and extract.
The app updates its own database tables when it starts.

---

## Part A — One-time setup (first deployment only)

### A1. Create the subdomain

1. cPanel → **Domains** → **Create A New Domain**.
2. Domain: `eyetv.paxofi.com`. Untick “Share document root” and accept the suggested folder (it won't be used).
3. Save. Then open **SSL/TLS Status**, tick `eyetv.paxofi.com`, and click **Run AutoSSL**. Wait until the padlock is green.

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
| `SITE_URL` | `https://eyetv.paxofi.com` |
| `SITE_INDEXING` | `false` (staging must stay out of Google) |
| `IP_HASH_SECRET` | a long random string (40+ characters, e.g. from a password generator) |

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
- Before launch, remove it with **Run JS script** → **`eyetv:remove-demo`**. That deletes all videos, schedule entries, submissions and the audit log, but keeps staff accounts and categories.
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

1. Repeat **A1–A3** with the production domain and a **new, separate database**. For example: application root `eyetv-production`, `SITE_URL=https://<production domain>`, **`SITE_INDEXING=true`**, and a new `IP_HASH_SECRET`.
2. Upload the same release (**Part B**) and create the admin (**A5**). **Do not** load the demo content.
3. Point an uptime monitor (e.g. UptimeRobot, free) at `https://<production domain>/api/health`.
4. In cPanel **Backup**, confirm daily backups include the production database.

## Requirements and limits (for reference)

- Node.js **22+**, and MySQL 8 or MariaDB 10.6+.
- One app process. Login and submission rate limits are kept in memory, which is fine on cPanel. Before running several processes on a VPS, they must move to Redis.
- Password hashing uses a prebuilt Linux x64 module, which works on standard cPanel/CloudLinux servers.
- **Moving to a VPS later:** copy the same release folder, run `node app.js` behind Nginx with pm2 or systemd, and set the same variables. The data moves with `mysqldump`. No code changes are needed.
