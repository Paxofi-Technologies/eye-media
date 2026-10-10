import { chromium } from 'playwright'
/**
 * End-to-end smoke suite: drives the real app in Chromium against a seeded database.
 *   npm run db:seed -- --reset && npm run build && npm start   (in another terminal)
 *   E2E_PASSWORD=<SEED_ADMIN_PASSWORD> npm run test:e2e
 * Screenshots of every key screen are written to ./screenshots for design review.
 */
import { mkdirSync } from 'node:fs'
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const OUT = process.env.E2E_SCREENSHOTS ?? 'screenshots'
const PW = process.env.E2E_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD
if (!PW) throw new Error('Set E2E_PASSWORD to the seeded staff password')
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const errors = []
const results = []
const RUN = Date.now().toString(36)
const STORY = `Collapsed drainage cover on Herbert Macaulay Way ${RUN}`
const check = (name, cond) => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}`) }

async function newPage(ctx) {
  const p = await ctx.newPage()
  p.on('console', (m) => { if (m.type() === 'error' && !/ytimg|youtube|ERR_TUNNEL_CONNECTION_FAILED/.test(m.text())) errors.push(`${p.url()} :: ${m.text()}`) })
  p.on('pageerror', (e) => errors.push(`${p.url()} :: ${e.message}`))
  return p
}

// ---------- public, desktop ----------
const desk = await browser.newContext({ viewport: { width: 1366, height: 900 } })
let p = await newPage(desk)
await p.goto(BASE + '/')
check('root redirects to /tv', p.url().endsWith('/tv'))
check('home shows LIVE NOW hero', await p.getByText('LIVE NOW').isVisible())
check('home has editor picks', await p.getByRole('heading', { name: "Editor's picks" }).isVisible())
await p.screenshot({ path: `${OUT}/01-home-desktop.png`, fullPage: true })

await p.goto(BASE + '/tv/live')
await p.screenshot({ path: `${OUT}/02-live-desktop.png` })

await p.goto(BASE + '/tv/archive')
await p.fill('#q', 'pothole')
await p.getByRole('button', { name: 'Search' }).click()
await p.waitForURL(/q=pothole/)
check('archive search finds pothole report', await p.getByText('Pothole on Admiralty Way').first().isVisible())
await p.goto(BASE + '/tv/archive?category=public-safety&range=all')
await p.screenshot({ path: `${OUT}/03-archive-desktop.png`, fullPage: true })
check('category filter returns 3', (await p.locator('.result-count').innerText()).startsWith('3'))

await p.goto(BASE + '/tv/third-mainland-bridge-gridlock-day-three')
check('detail page has title', await p.getByRole('heading', { level: 1 }).innerText() === 'Third Mainland Bridge gridlock enters its third day as repairs continue')
const ld = await p.locator('script[type="application/ld+json"]').count()
check('detail has JSON-LD', ld === 1)
await p.getByRole('button', { name: /^Play:/ }).click()
check('click-to-play injects privacy-mode iframe', (await p.locator('iframe').getAttribute('src')).startsWith('https://www.youtube-nocookie.com/embed/SlbyzVMQ44w'))
await p.screenshot({ path: `${OUT}/04-video-detail-desktop.png`, fullPage: true })

// ---------- citizen submission ----------
await p.goto(BASE + '/tv/submit')
await p.getByRole('button', { name: 'Send to the newsroom' }).click()
await p.getByText('Please fix the highlighted fields.').waitFor()
check('empty submission shows validation errors', true)
await p.waitForTimeout(800) // let React finish resetting the form after the action
await p.fill('#title', STORY)
await p.fill('#description', 'A drainage cover has collapsed near the Yaba bus stop and two okadas have already fallen in this morning.')
await p.selectOption('#category', 'public-safety')
await p.fill('#location', 'Yaba, Lagos')
await p.fill('#mediaUrl', 'https://youtu.be/SlbyzVMQ44w')
await p.fill('#name', 'Kemi A.')
await p.fill('#phone', '+234 801 234 5678')
await p.check('input[name=consent]')
await p.screenshot({ path: `${OUT}/05-submit-form.png`, fullPage: true })
await p.getByRole('button', { name: 'Send to the newsroom' }).click()
await p.getByText('your story is with our editors').waitFor({ timeout: 10000 })
const ref = await p.locator('strong').first().innerText()
check(`submission returns reference (${ref})`, /^EYE-[0-9A-Z]{6}$/.test(ref))
await p.screenshot({ path: `${OUT}/06-submit-success.png` })

// ---------- mobile ----------
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 })
const m = await newPage(mob)
await m.goto(BASE + '/tv')
const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
check('mobile home has no horizontal overflow', !overflow)
await m.screenshot({ path: `${OUT}/07-home-mobile.png`, fullPage: true })
await m.goto(BASE + '/tv/flood-watch-ajah-drains-overflow')
check('mobile detail has no horizontal overflow', !(await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)))
await m.screenshot({ path: `${OUT}/08-video-mobile.png`, fullPage: true })

// ---------- admin: bad login, then editor ----------
const ed = await browser.newContext({ viewport: { width: 1366, height: 900 } })
const a = await newPage(ed)
await a.goto(BASE + '/admin/videos')
check('admin redirects to login with next', a.url().includes('/admin/login?next=%2Fadmin%2Fvideos'))
await a.fill('#email', 'editor@eyemedia.local')
await a.fill('#password', 'wrong-password-123')
await a.getByRole('button', { name: 'Sign in' }).click()
await a.getByText('Incorrect email or password.').waitFor()
check('wrong password rejected', true)
await a.waitForTimeout(800)
await a.fill('#email', 'editor@eyemedia.local')
await a.fill('#password', PW)
await a.getByRole('button', { name: 'Sign in' }).click()
await a.waitForURL(/\/admin\/videos$/)
check('login honours next param', a.url().endsWith('/admin/videos'))
await a.screenshot({ path: `${OUT}/09-admin-registry.png`, fullPage: true })

await a.goto(BASE + '/admin')
check('queue lists new citizen submission', await a.getByText(STORY).isVisible())
await a.getByText(STORY).click()
await a.waitForURL(/id=/)
check('editor sees confidential submitter contact', await a.getByText('+234 801 234 5678').isVisible())
const approve = a.getByRole('button', { name: /Approve/ })
check('approve disabled until checklist complete', await approve.isDisabled())
await a.screenshot({ path: `${OUT}/10-admin-queue-review.png`, fullPage: true })
for (const box of await a.locator('.checklist input[type=checkbox]').all()) await box.check()
check('approve enabled after checklist', await approve.isEnabled())
await approve.click()
await a.waitForURL(BASE + '/admin')
check('approved item left the queue', !(await a.getByText(STORY).isVisible()))

// reject without note -> error
await a.locator('.q-item').first().click()
await a.waitForURL(/id=/)
await a.getByRole('button', { name: /Reject/ }).click()
check('reject requires a note', await a.getByText('Add a note explaining why').waitFor({ timeout: 8000 }).then(() => true, () => false))

// published publicly, PII not exposed
const pub = await newPage(desk)
await pub.goto(BASE + `/tv/archive?q=${RUN}&range=all`)
await pub.locator('main').getByText(STORY).first().click()
await pub.waitForURL(/\/tv\/collapsed-drainage/)
const html = await pub.content()
check('approved story is public', html.includes(STORY))
check('submitter phone never on public page', !html.includes('801 234 5678'))

// live admin + audit
await a.goto(BASE + '/admin/live')
await a.screenshot({ path: `${OUT}/11-admin-live.png`, fullPage: true })
await a.goto(BASE + '/admin/audit')
check('audit records approval', await a.getByRole('cell', { name: 'Approved & published' }).first().isVisible())
await a.screenshot({ path: `${OUT}/12-admin-audit.png`, fullPage: true })

// edit form + validation
await a.goto(BASE + '/admin/videos/new')
await a.fill('#title', 'Test draft')
await a.fill('#youtube', 'https://vimeo.com/1')
await a.getByRole('button', { name: 'Create draft' }).click()
check('invalid YouTube URL rejected', await a.getByText('Enter a YouTube video id or URL.').waitFor({ timeout: 8000 }).then(() => true, () => false))

// ---------- RBAC: reporter ----------
const rep = await browser.newContext()
const r = await newPage(rep)
await r.goto(BASE + '/admin/login')
await r.fill('#email', 'reporter@eyemedia.local'); await r.fill('#password', PW)
await r.getByRole('button', { name: 'Sign in' }).click()
await r.waitForURL(BASE + '/admin')
check('reporter gets editor-access-required on queue', await r.getByText('Editor access required').isVisible())
await r.goto(BASE + '/admin/users')
check('reporter blocked from users page', await r.getByText('Administrator access required').isVisible())
check('reporter nav hides audit', (await r.locator('.admin-nav a', { hasText: 'Audit' }).count()) === 0)
await r.screenshot({ path: `${OUT}/13-admin-reporter-restricted.png` })

// sign out
await r.getByRole('button', { name: 'Sign out' }).click()
await r.waitForURL(/\/admin\/login/)
await r.goto(BASE + '/admin/videos')
check('after sign-out admin is gated', r.url().includes('/admin/login'))

await browser.close()
console.log(results.join('\n'))
console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'No console errors')
const failed = results.filter((r) => r.startsWith('FAIL')).length + errors.length
console.log(`\n${results.length - failed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
