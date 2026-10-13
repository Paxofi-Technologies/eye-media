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
const MOCK = process.env.E2E_MOCK_URL
if (!MOCK) throw new Error('Run this suite with `npm run test:e2e` (it starts the mock Mux server).')
const mockState = async () => (await fetch(MOCK + '/__mock/state')).json()
const mockPost = async (path) => (await fetch(MOCK + path, { method: 'POST' })).json()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// A 9MB "video": a real MP4 header followed by padding, so the upload spans two 8MB chunks.
const fakeMp4 = (bytes) => {
  const buf = Buffer.alloc(bytes)
  Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]).copy(buf)
  return buf
}
const check = (name, cond) => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}`) }

async function newPage(ctx) {
  const p = await ctx.newPage()
  p.on('console', (m) => {
    if (m.type() === 'error' && !/ytimg|youtube|image\.mux\.com|mux-player|stream\.mux\.com|ERR_NAME_NOT_RESOLVED|ERR_BLOCKED_BY_CLIENT|ERR_TUNNEL_CONNECTION_FAILED|status of 404/.test(m.text())) errors.push(`${p.url()} :: ${m.text()}`) })
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
check('live page shows concurrent streams', await p.getByText(/streams on air/).isVisible())
await p.screenshot({ path: `${OUT}/02-live-desktop.png`, fullPage: true })

await p.goto(BASE + '/tv/schedule')
check('schedule has date strip with today', await p.locator('.date-strip a[aria-current="date"]').getByText('TODAY').isVisible())
check('schedule lists live now', await p.locator('.schedule-group-title', { hasText: 'Live now' }).isVisible())
await p.screenshot({ path: `${OUT}/02b-schedule-desktop.png`, fullPage: true })
await p.goto(BASE + '/tv/schedule?city=Abuja&date=2026-02-30')
check('schedule ignores invalid dates and filters by city', (await p.locator('.schedule-row').count()) <= 1)

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
await p.setInputFiles('.dropzone input[type=file]', { name: 'drainage.mp4', mimeType: 'video/mp4', buffer: fakeMp4(9 * 1024 * 1024) })
await p.getByText('✓ drainage.mp4').waitFor({ timeout: 60000 })
check('citizen uploads a video from the device straight to Mux', true)
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
const overflow = await m.evaluate(() => document.documentElement.scrollWidth > 390)
check('mobile home has no horizontal overflow', !overflow)
await m.screenshot({ path: `${OUT}/07-home-mobile.png`, fullPage: true })
await m.goto(BASE + '/tv/flood-watch-ajah-drains-overflow')
check('mobile detail has no horizontal overflow', !(await m.evaluate(() => document.documentElement.scrollWidth > 390)))
for (const path of ['/tv/live', '/tv/schedule', '/tv/archive', '/tv/submit']) {
  await m.goto(BASE + path)
  check(`mobile ${path} has no horizontal overflow`, !(await m.evaluate(() => document.documentElement.scrollWidth > 390)))
}
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
check('editor can preview the uploaded video', await a.locator('.review-panel .player .poster').isVisible())
let st = await mockState()
const asset = st.assets.find((x) => x.playback_ids.length)
const privateId = asset.playback_ids[0].id
check('unpublished upload is private (signed playback only)', asset.playback_ids.length === 1 && asset.playback_ids[0].policy === 'signed')
for (let i = 0; i < 20 && !(await mockState()).webhooks.some((w) => w.type === 'video.asset.ready' && w.status === 200); i++) await sleep(500)
check('Mux webhook (asset ready) accepted', (await mockState()).webhooks.some((w) => w.type === 'video.asset.ready' && w.status === 200))
check('forged webhook is rejected', (await mockPost('/__mock/bad-webhook')).status === 401)
const approve = a.getByRole('button', { name: /Approve/ })
check('approve disabled until checklist complete', await approve.isDisabled())
await a.screenshot({ path: `${OUT}/10-admin-queue-review.png`, fullPage: true })
for (const box of await a.locator('.checklist input[type=checkbox]').all()) await box.check()
check('approve enabled after checklist', await approve.isEnabled())
await approve.click()
await a.waitForURL(BASE + '/admin')
check('approved item left the queue', !(await a.getByText(STORY).isVisible()))
st = await mockState()
const publicPb = st.assets.find((x) => x.id === asset.id).playback_ids.find((x) => x.policy === 'public')
check('publishing adds a public playback id on Mux', Boolean(publicPb))

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
check('public page never contains the private playback id', !html.includes(privateId))
check('public page uses the public playback id (poster)', html.includes(publicPb.id))
await pub.getByRole('button', { name: /^Play:/ }).click()
check('click-to-play loads the Mux player', await pub.locator('mux-player').first().waitFor({ timeout: 15000 }).then(() => true, () => false))

// staff upload on a new registry video + pagination
await a.goto(BASE + '/admin/videos/new')
await a.fill('#title', `Staff upload ${RUN}`)
await a.selectOption('#categoryId', { index: 1 })
await a.setInputFiles('.dropzone input[type=file]', { name: 'studio.mp4', mimeType: 'video/mp4', buffer: fakeMp4(300 * 1024) })
await a.getByText('✓ studio.mp4').waitFor({ timeout: 30000 })
await a.getByRole('button', { name: 'Create draft' }).click()
await a.waitForURL(/\/admin\/videos\/[0-9a-f-]{36}\?created=1/)
check('staff video created from an uploaded file', await a.locator('.player').first().isVisible())
st = await mockState()
const staffAsset = st.assets.find((x) => x.id !== asset.id && x.playback_ids.length === 1 && x.playback_ids[0].policy === 'signed')
check('draft staff video is private on Mux', Boolean(staffAsset))
const staffUrl = a.url().split('?')[0]
for (let i = 0; i < 20 && !(await mockState()).assets.find((x) => x.id === staffAsset.id && x.status === 'ready'); i++) await sleep(500)
await sleep(1500) // webhook delivery
await a.goto(staffUrl)
await a.getByRole('button', { name: 'Publish now' }).click()
await a.waitForLoadState('networkidle')
st = await mockState()
check('publishing from the editor adds the public id', st.assets.find((x) => x.id === staffAsset.id).playback_ids.some((x) => x.policy === 'public'))
await a.goto(staffUrl)
await a.getByRole('button', { name: 'Unpublish', exact: true }).click()
await a.waitForLoadState('networkidle')
st = await mockState()
check('unpublishing removes the public id again', st.assets.find((x) => x.id === staffAsset.id).playback_ids.every((x) => x.policy === 'signed'))
await a.goto(BASE + '/admin/videos')
check('registry paginates 10 per page', (await a.locator('.admin-table tbody tr').count()) === 10 && (await a.locator('.pager').isVisible()))
await a.locator('.pager').getByRole('link', { name: 'Page 2' }).click()
await a.waitForURL(/page=2/)
check('registry page 2 loads', (await a.locator('.admin-table tbody tr').count()) > 0)

// live events on Mux: schedule → stream created → key → go live → public → simulcast → encoder stops → replay
const EVENT = `E2E live event ${RUN}`
await a.goto(BASE + '/admin/live')
await a.screenshot({ path: `${OUT}/11-admin-live.png`, fullPage: true })
await a.fill('#le-title', EVENT)
await a.fill('#le-start', '2030-01-01T10:00')
await a.fill('#le-city', 'Kano')
await a.getByRole('button', { name: 'Add to schedule' }).click()
await a.waitForURL(/\/admin\/live\/[0-9a-f-]{36}\?created=1/)
check('live event scheduled', await a.getByText('Event scheduled.').isVisible())
const eventUrl = a.url().split('?')[0]
check('stream settings are shown (RTMPS server)', await a.getByText('rtmps://global-live.mux.com:443/app').isVisible())
st = await mockState()
const stream = st.streams.at(-1)
check('a private Mux stream was created', Boolean(stream) && stream.playback_ids.length === 1 && stream.playback_ids[0].policy === 'signed')
check('stream key is hidden until requested', (await a.getByTestId('stream-key').count()) === 0 && !(await a.content()).includes(stream.stream_key))
await a.getByRole('button', { name: 'Show key' }).click()
await a.getByTestId('stream-key').waitFor()
check('editor can reveal the stream key', (await a.getByTestId('stream-key').innerText()) === stream.stream_key)
await a.screenshot({ path: `${OUT}/11b-admin-live-stream.png`, fullPage: true })

await a.getByRole('button', { name: 'Go live' }).click()
await a.getByRole('button', { name: 'End stream' }).waitFor()
st = await mockState()
check('going live adds the public playback id', (await mockState()).streams.find((x) => x.id === stream.id).playback_ids.some((x) => x.policy === 'public'))
const pubLive = await newPage(desk)
await pubLive.goto(BASE + '/tv/live')
check('new event appears with other live streams', await pubLive.getByText(EVENT).first().isVisible())
check('live page never contains the private playback id', !(await pubLive.content()).includes(stream.playback_ids[0].id))

// simulcast (optional): the destination's key is sent to Mux and never shown again
await a.goto(eventUrl)
await a.selectOption('#sc-kind', 'youtube')
await a.fill('#sc-key', 'abcd-efgh-ijkl-mnop')
await a.getByRole('button', { name: 'Add destination' }).click()
await a.getByText('Destination added.').waitFor()
st = await mockState()
check('simulcast destination added on Mux', st.streams.find((x) => x.id === stream.id).simulcast_targets.length === 1)
check('simulcast key is not displayed', !(await a.content()).includes('abcd-efgh-ijkl-mnop'))
await a.getByRole('button', { name: 'Remove' }).click()
await a.waitForLoadState('networkidle')
check('simulcast destination removed', (await mockState()).streams.find((x) => x.id === stream.id).simulcast_targets.length === 0)

// the encoder stops: Mux tells the app, which takes the event off air and keeps the recording private
await mockPost(`/__mock/live/${stream.id}/idle`)
await a.goto(eventUrl)
await a.getByRole('button', { name: 'Create replay' }).waitFor({ timeout: 10000 })
check('encoder stop ends the event via webhook', true)
check('ending removes the public playback id', (await mockState()).streams.find((x) => x.id === stream.id).playback_ids.every((x) => x.policy === 'signed'))
await a.getByRole('button', { name: 'Create replay' }).click()
await a.waitForURL(/\/admin\/videos\/[0-9a-f-]{36}\?created=1/)
check('ended event becomes a draft replay video', (await a.locator('#title').inputValue()) === EVENT)

// "go live automatically": the encoder connecting puts the event on air
await a.goto(BASE + '/admin/live')
await a.fill('#le-title', `${EVENT} auto`)
await a.fill('#le-start', '2030-01-02T10:00')
await a.check('input[name=autoLive]')
await a.getByRole('button', { name: 'Add to schedule' }).click()
await a.waitForURL(/\/admin\/live\/[0-9a-f-]{36}\?created=1/)
const autoUrl = a.url().split('?')[0]
const autoStream = (await mockState()).streams.at(-1)
await mockPost(`/__mock/live/${autoStream.id}/active`)
await a.goto(autoUrl)
await a.getByRole('button', { name: 'End stream' }).waitFor({ timeout: 10000 })
check('auto-live event goes on air when the encoder connects', true)
await a.getByRole('button', { name: 'End stream' }).click()
await a.getByRole('button', { name: 'Resume live' }).waitFor()

await a.goto(BASE + '/admin/audit?action=moderation.approved')
check('audit records approval', await a.getByRole('cell', { name: 'Approved & published' }).first().isVisible())
await a.screenshot({ path: `${OUT}/12-admin-audit.png`, fullPage: true })

// validation: a draft needs a real title
await a.goto(BASE + '/admin/videos/new')
await a.fill('#title', 'ab')
await a.getByRole('button', { name: 'Create draft' }).click()
check('too-short draft rejected', await a.getByText('Please fix the highlighted fields.').waitFor({ timeout: 8000 }).then(() => true, () => false))

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
