# Deploying Eye TV on cPanel

Eye TV runs as a **Node.js application** under cPanel's *Setup Node.js App* (Phusion Passenger), with a
**MySQL/MariaDB** database created in cPanel. Builds happen in GitHub Actions, not on the server, because shared hosts
usually lack the memory to build Next.js.

## 0. Check the hosting plan supports it

In cPanel, look for **Software → Setup Node.js App**. You need:
- **Node.js 20.9 or newer** (22 recommended) in the version list;
- **MySQL 8 or MariaDB 10.6+** (*Databases → MySQL Databases*; the version is shown on the cPanel home screen);
- ideally **SSH/Terminal** access (not required, but it makes the first admin easier to create).

If Node.js 20+ is not offered, ask the host to enable it (CloudLinux “Node.js Selector”) before going further.

## 1. Create the database

*MySQL Databases* → create a database (e.g. `cpuser_eyetv`) and a user with a strong password, then add the user to the
database with **ALL PRIVILEGES**. Set the collation to `utf8mb4_unicode_ci` if your host offers the choice.

## 2. Create the Node.js app

*Setup Node.js App* → **Create application**:

| Field | Value |
|---|---|
| Node.js version | 22.x (or the newest ≥ 20.9) |
| Application mode | Production |
| Application root | e.g. `eyetv-staging` (a folder in your home directory, **not** inside `public_html`) |
| Application URL | the (sub)domain, e.g. `staging.eyetv.ng` |
| Application startup file | `app.js` |

Add these **environment variables** in the same screen, then save:

| Name | Value |
|---|---|
| `DATABASE_URL` | `mysql://DBUSER:URL-ENCODED-PASSWORD@localhost:3306/DBNAME` |
| `SITE_URL` | `https://staging.eyetv.ng` (must be `https://` in production; it switches on secure cookies, HSTS and CSP upgrades) |
| `IP_HASH_SECRET` | a long random string, e.g. the output of `openssl rand -base64 32` |
| `DB_POOL_SIZE` | `5` (optional; lower it if the host limits MySQL connections) |

Do **not** press “Run NPM Install”. The release ships its own dependencies inside `server/`.

## 3. Upload a release

### Automatic (recommended): GitHub Actions → FTPS

1. In cPanel, create an **FTP account** whose directory is the application root from step 2.
2. In GitHub, go to repository → *Settings → Secrets and variables → Actions* and add:
   `CPANEL_FTP_SERVER`, `CPANEL_FTP_USERNAME`, `CPANEL_FTP_PASSWORD`, and `CPANEL_APP_DIR` (use `/` if the FTP account is already rooted at the app folder).
3. Every push to `main` that passes CI deploys to staging. You can also run *Actions → Deploy to cPanel staging → Run workflow* by hand.

### Manual

Run `npm run build:cpanel` locally and upload the contents of `release/` (or `release.zip`, then extract it) into the application root.

Each release contains a fresh `tmp/restart.txt`. When it changes, Passenger restarts the app. On boot, `app.js`
**applies any pending database migrations** before starting the server. If a migration fails, the app refuses to start and the error is written to the app's log
(`stderr.log` in the application root).

## 4. Create the first admin

With SSH/Terminal, from the application root:

```bash
cd ~/eyetv-staging/server
source ~/nodevenv/eyetv-staging/22/bin/activate      # path shown at the top of the Node.js App page
DATABASE_URL='mysql://…' node scripts/create-user.cjs --email you@eyemedia.ng --name "Your Name" --role admin
```

The script prints a temporary password once. Sign in at `/admin/login`, then create the other staff accounts from **Staff Users**.
(Without SSH, ask the developer to run the same command against the database from a trusted machine.)

> Never run `db:seed` against staging or production. It loads demo content and refuses to run when `NODE_ENV=production`.

## 5. Verify

- `https://staging.eyetv.ng/api/health` should return `{"status":"ok"}`. Point an uptime monitor at it (for example UptimeRobot, free).
- Turn on **AutoSSL** for the domain in cPanel *SSL/TLS Status*.
- Make sure cPanel's daily **backups** include the database.

## Known cPanel constraints

- **One process, in-memory rate limits.** Login and submission limits live in memory, which is fine for a single Passenger process. Before running several instances (for example on the future VPS), move them to Redis.
- **Client IP.** Rate limiting relies on `X-Forwarded-For`, which Apache/Passenger normally set. If it's missing, submissions fall back to a site-wide cap instead of locking everyone out.
- **Native module.** Password hashing uses `@node-rs/argon2` (prebuilt for Linux x64 glibc), which works on standard CloudLinux hosts. If the host is unusual (ARM or musl), tell the developer.

## Moving to a VPS later

Copy the same `release/` folder to the VPS and run `node app.js` behind Nginx, using pm2 or systemd. Set the same environment variables and point `DATABASE_URL` at the new MySQL server (a `mysqldump` / restore moves the data). No code changes are needed.
