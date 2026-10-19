/**
 * Builds a self-contained cPanel release in ./release (and release.zip).
 *   npm run build:cpanel
 * Upload the contents of ./release to the Node.js application root on the server.
 */
import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { build } from 'esbuild'

const root = process.cwd()
const out = path.join(root, 'release')
const server = path.join(out, 'server')
const run = (cmd, env = {}) => execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } })

rmSync(out, { recursive: true, force: true })
run('npx next build', { NEXT_OUTPUT: 'standalone' })

// Next.js standalone server + its traced node_modules.
cpSync(path.join(root, '.next/standalone'), server, { recursive: true })
cpSync(path.join(root, '.next/static'), path.join(server, '.next/static'), { recursive: true })
if (existsSync(path.join(root, 'public'))) cpSync(path.join(root, 'public'), path.join(server, 'public'), { recursive: true })
cpSync(path.join(root, 'drizzle'), path.join(server, 'drizzle'), { recursive: true })
// Never ship local secrets.
rmSync(path.join(server, '.env'), { force: true })

// CLI scripts bundled to plain CommonJS so they run with the server's Node without tsx.
// Native / heavy packages resolve from the standalone node_modules at runtime.
mkdirSync(path.join(server, 'scripts'), { recursive: true })
for (const name of ['migrate', 'create-user', 'seed']) {
  await build({
    entryPoints: [path.join(root, 'scripts', `${name}.ts`)],
    outfile: path.join(server, 'scripts', `${name}.cjs`),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    external: ['@node-rs/argon2', 'dotenv'],
    logLevel: 'warning',
  })
}
// argon2 (native) is traced by Next; dotenv is dev-only, so stub it for the bundled scripts.
mkdirSync(path.join(server, 'node_modules/dotenv'), { recursive: true })
writeFileSync(path.join(server, 'node_modules/dotenv/package.json'), JSON.stringify({ name: 'dotenv', main: 'index.js' }))
writeFileSync(path.join(server, 'node_modules/dotenv/index.js'), 'module.exports = { config() {} }\n')
writeFileSync(path.join(server, 'node_modules/dotenv/config.js'), '')

cpSync(path.join(root, 'deploy/cpanel/app.js'), path.join(out, 'app.js'))
writeFileSync(
  path.join(out, 'package.json'),
  JSON.stringify(
    {
      name: 'eye-tv',
      private: true,
      main: 'app.js',
      engines: { node: '>=22' },
      // Shown under "Run JS script" in cPanel → Setup Node.js App (no SSH needed).
      scripts: {
        'eyetv:migrate': 'node server/scripts/migrate.cjs',
        'eyetv:create-admin': 'node server/scripts/create-user.cjs --role admin',
        'eyetv:demo-content': 'node server/scripts/seed.cjs --demo-content',
        'eyetv:remove-demo': 'node server/scripts/seed.cjs --remove-demo',
      },
    },
    null,
    2,
  ) + '\n',
)
// Passenger restarts the app whenever tmp/restart.txt changes, so every release carries a fresh one.
mkdirSync(path.join(out, 'tmp'), { recursive: true })
writeFileSync(path.join(out, 'tmp', 'restart.txt'), new Date().toISOString() + '\n')

run('cd release && rm -f ../release.zip && zip -qr ../release.zip .')
console.log('\nRelease ready: ./release (and release.zip)')
