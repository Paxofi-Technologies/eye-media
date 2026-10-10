/**
 * cPanel "Setup Node.js App" startup file (Phusion Passenger).
 *
 * Layout on the server (the application root you choose in cPanel):
 *   app.js        <- this file (set as "Application startup file")
 *   package.json  <- no dependencies; nothing to "Run NPM Install" for
 *   server/       <- Next.js standalone build incl. its own node_modules
 *
 * The Next.js build lives in server/ because CloudLinux's Node.js selector reserves the
 * application root's node_modules for its own virtualenv symlink.
 *
 * On boot we apply pending database migrations, then hand over to the Next.js server.
 * Passenger intercepts listen(), so the port does not matter on cPanel.
 */
const path = require('node:path')

process.env.NODE_ENV = 'production'
process.env.PORT = process.env.PORT || '3000'
process.env.HOSTNAME = process.env.HOSTNAME || '127.0.0.1'

const serverDir = path.join(__dirname, 'server')
const { runMigrations, describeError } = require(path.join(serverDir, 'scripts', 'migrate.cjs'))

runMigrations(process.env.DATABASE_URL, path.join(serverDir, 'drizzle'))
  .then(() => {
    console.log('[eye-tv] migrations up to date')
    require(path.join(serverDir, 'server.js'))
  })
  .catch((err) => {
    console.error('[eye-tv] database setup failed, refusing to start:\n  ' + describeError(err))
    process.exit(1)
  })
