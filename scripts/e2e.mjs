/**
 * Runs the end-to-end suite against a production build with a mock Mux (no real credentials needed).
 *   npm run build            # once
 *   npm run db:seed -- --reset
 *   E2E_PASSWORD=<SEED_ADMIN_PASSWORD> npm run test:e2e
 */
import { spawn } from 'node:child_process'
import { generateKeyPairSync } from 'node:crypto'
import { startMockMux } from '../e2e/mock-mux.mjs'

const APP_PORT = Number(process.env.E2E_APP_PORT ?? 3000)
const MOCK_PORT = Number(process.env.E2E_MOCK_PORT ?? 4010)
const appUrl = `http://localhost:${APP_PORT}`
const tokenId = 'test-token-id'
const tokenSecret = 'test-token-secret'
const webhookSecret = 'test-webhook-secret'
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const keyB64 = Buffer.from(privateKey.export({ type: 'pkcs8', format: 'pem' })).toString('base64')

const mock = await startMockMux({ port: MOCK_PORT, appUrl, tokenId, tokenSecret, webhookSecret })

const app = spawn('npx', ['next', 'start', '-p', String(APP_PORT)], {
  stdio: ['ignore', 'inherit', 'inherit'],
  env: {
    ...process.env,
    SITE_URL: appUrl,
    MUX_API_BASE: mock.url,
    MUX_TOKEN_ID: tokenId,
    MUX_TOKEN_SECRET: tokenSecret,
    MUX_WEBHOOK_SECRET: webhookSecret,
    MUX_SIGNING_KEY_ID: 'test-key-id',
    MUX_SIGNING_KEY_PRIVATE: keyB64,
  },
})

async function waitForApp() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${appUrl}/api/health`)).ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('The app did not start in time.')
}

let code = 1
try {
  await waitForApp()
  code = await new Promise((resolve) => {
    const t = spawn('node', ['e2e/run.mjs'], {
      stdio: 'inherit',
      env: { ...process.env, E2E_BASE_URL: appUrl, E2E_MOCK_URL: mock.url },
    })
    t.on('exit', (c) => resolve(c ?? 1))
  })
} finally {
  app.kill()
  mock.close()
}
process.exit(code)
