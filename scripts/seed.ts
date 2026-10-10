/**
 * Loads DEMO content so the platform can be reviewed before real content exists. Demo stories, people
 * and the YouTube clip are placeholders from the approved prototype — remove them before public launch.
 * Categories are reference data and come from the migrations, not from here.
 *
 *   npm run db:seed                         # local dev: demo content + 5 demo staff logins
 *   npm run db:seed -- --reset              # local dev: wipe content and staff first
 *   node scripts/seed.cjs --demo-content    # staging: demo content only, NO logins created
 *   node scripts/seed.cjs --remove-demo     # staging/production: delete all content (keeps staff/categories)
 */
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { createDb } from '../src/db/client'
import * as schema from '../src/db/schema'
import { hashPassword } from '../src/lib/password'
import { describeError, runMigrations } from './migrate'

const DEMO_YT = 'SlbyzVMQ44w' // public clip used by the prototype to demonstrate playback

const CONTENT_TABLES = ['audit_log', 'schedule_items', 'moderation_reviews', 'submitter_contacts', 'videos']

const HOUR = 3_600_000
const ago = (h: number) => new Date(Date.now() - h * HOUR)

async function main() {
  const reset = process.argv.includes('--reset')
  const contentOnly = process.argv.includes('--demo-content')
  const removeDemo = process.argv.includes('--remove-demo')
  const production = process.env.NODE_ENV === 'production'
  // Demo *logins* never go near a server; staging may only receive content (no accounts, no passwords).
  if (production && !contentOnly && !removeDemo) {
    throw new Error('In production use --demo-content (no logins are created) or --remove-demo.')
  }

  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  // Make sure the tables (and categories) exist even if the app has never started yet.
  await runMigrations(process.env.DATABASE_URL)
  const { db, pool } = createDb(process.env.DATABASE_URL, 1)

  const clearContent = async (alsoStaff: boolean) => {
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`)
    for (const table of [...CONTENT_TABLES, ...(alsoStaff ? ['sessions', 'users'] : [])]) {
      await db.execute(sql.raw(`DELETE FROM \`${table}\``))
    }
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`)
    await db
      .update(schema.liveStream)
      .set({ title: 'Eye TV Live', description: null, categoryId: null, youtubeVideoId: null, status: 'offline', startedAt: null })
  }

  if (removeDemo) {
    await clearContent(false)
    console.log('All videos, schedule, submissions and audit entries removed. Staff accounts and categories kept.')
    await pool.end()
    return
  }
  if (reset && !production) {
    await clearContent(true)
    console.log('Existing content and staff cleared.')
  } else if ((await db.select({ id: schema.videos.id }).from(schema.videos).limit(1)).length) {
    console.log('Content already exists. Use --reset (dev) or --remove-demo first.')
    await pool.end()
    return
  }

  const cats = await db.select().from(schema.videoCategories)
  if (!cats.length) throw new Error('No categories found — run the migrations first.')
  const cat = (slug: string) => cats.find((c) => c.slug === slug)?.id ?? null

  let staff: { id: string; name: string; email: string }[] = []
  if (!contentOnly) {
    const password = process.env.SEED_ADMIN_PASSWORD
    if (!password || password.length < 12) throw new Error('Set SEED_ADMIN_PASSWORD (12+ chars) in .env')
    const passwordHash = await hashPassword(password)
    const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@eyemedia.local').toLowerCase()
    const rows = (
      [
      { email: adminEmail, name: 'Paxofi Technologies', title: 'Platform administrator', role: 'admin', passwordHash },
      { email: 'editor@eyemedia.local', name: 'Chiamaka Obi', title: 'Senior editor, Eye TV', role: 'editor', passwordHash },
      { email: 'moderator@eyemedia.local', name: 'Blessing Eze', title: 'Community desk moderator', role: 'moderator', passwordHash },
      { email: 'producer@eyemedia.local', name: 'Ngozi Fadipe', title: 'Eye Media field correspondent, Lagos Mainland', role: 'media_manager', passwordHash },
      { email: 'reporter@eyemedia.local', name: 'Tunde Balogun', title: 'Eye Media field reporter', role: 'reporter', passwordHash },
      ] as const
    ).map((u) => ({ ...u, id: randomUUID() }))
    await db.insert(schema.users).values(rows)
    staff = rows
  }
  // In --demo-content mode there are no demo accounts: credits stay as names, links stay empty.
  const personId = (name: string) => staff.find((u) => u.name === name)?.id ?? null

  type Seed = Partial<typeof schema.videos.$inferInsert> & { slug: string; title: string; category: string; hoursAgo: number; reporter: string }
  const published: Seed[] = [
    {
      slug: 'flood-watch-ajah-drains-overflow',
      title: 'Flood watch: Ajah residents wade through knee-deep water as drains overflow',
      summary: 'Heavy overnight rain overwhelms drainage across Ajah, leaving several access roads impassable.',
      description:
        "Heavy overnight rain has overwhelmed drainage across Ajah, leaving several access roads impassable. Eye Media's field team is coordinating with community volunteers and local authorities to track the response as it develops.",
      category: 'environment-sanitation', reporter: 'Ngozi Fadipe', durationSeconds: 412, location: 'Ajah, Lagos',
      tags: ['lagos', 'ajah', 'flooding', 'drainage'], featured: true, verified: true, hoursAgo: 1, viewCount: 2148,
    },
    {
      slug: 'third-mainland-bridge-gridlock-day-three',
      title: 'Third Mainland Bridge gridlock enters its third day as repairs continue',
      summary: 'Commuters face hours-long delays as repair work narrows the bridge to a single lane each way.',
      category: 'traffic-transport', reporter: 'Ngozi Fadipe', durationSeconds: 252, location: 'Third Mainland Bridge, Lagos',
      tags: ['traffic', 'third mainland bridge'], verified: true, hoursAgo: 2, viewCount: 9402,
    },
    {
      slug: 'lastma-clears-oshodi-bus-park',
      title: 'LASTMA moves to clear illegal bus park at Oshodi',
      summary: 'Enforcement officers relocate traders and drivers from the busy interchange.',
      category: 'public-safety', reporter: 'Tunde Balogun', durationSeconds: 168, location: 'Oshodi, Lagos',
      tags: ['lastma', 'oshodi'], hoursAgo: 5, viewCount: 5110,
    },
    {
      slug: 'mile-12-market-fire-traders-count-losses',
      title: 'Mile 12 market fire: traders count their losses',
      summary: 'Traders return to assess the damage after an overnight blaze swept through the produce market.',
      category: 'public-safety', reporter: 'Chiamaka Obi', durationSeconds: 185, location: 'Mile 12, Lagos',
      tags: ['fire', 'mile 12', 'market'], verified: true, hoursAgo: 8, viewCount: 3877,
    },
    {
      slug: 'lagos-assembly-debates-okada-ban',
      title: 'Lagos Assembly debates a new okada ban',
      summary: 'Lawmakers weigh an expanded restriction on commercial motorcycles across more local governments.',
      category: 'government-policy', reporter: 'Eye News desk', durationSeconds: 381, location: 'Alausa, Ikeja',
      tags: ['okada', 'assembly', 'policy'], hoursAgo: 26, viewCount: 6120,
    },
    {
      slug: 'makoko-waterfront-clean-up',
      title: 'Community clean-up turns the Makoko waterfront around',
      summary: 'Residents and volunteers clear tonnes of waste from the waterfront in a month-long effort.',
      category: 'community-voices', reporter: 'Blessing Eze', durationSeconds: 340, location: 'Makoko, Lagos',
      tags: ['makoko', 'clean-up', 'community'], verified: true, editorsPick: true, hoursAgo: 50, viewCount: 4410,
    },
    {
      slug: 'danfo-drivers-cashless-transit-rollout',
      title: 'Danfo drivers speak on the cashless transit rollout',
      summary: 'Drivers and passengers share how the switch to card payments is changing daily trips.',
      category: 'community-voices', reporter: 'Tunde Balogun', durationSeconds: 295, location: 'Ikorodu Road, Lagos',
      tags: ['danfo', 'transport', 'cashless'], editorsPick: true, hoursAgo: 74, viewCount: 2987,
    },
    {
      slug: 'admiralty-way-pothole-fixed',
      title: 'Pothole on Admiralty Way finally gets fixed — residents react',
      summary: 'After months of complaints, repair crews resurface a notorious stretch of Admiralty Way.',
      category: 'traffic-transport', reporter: 'Ngozi Fadipe', durationSeconds: 118, location: 'Lekki Phase 1, Lagos',
      tags: ['roads', 'lekki'], verified: true, editorsPick: true, hoursAgo: 98, viewCount: 1904,
    },
    {
      slug: 'frsc-checkpoint-lekki-epe-expressway',
      title: 'Inside an FRSC speed-enforcement checkpoint on the Lekki-Epe expressway',
      summary: 'Eye TV rides along with road safety officers enforcing new speed limits.',
      category: 'public-safety', reporter: 'Chiamaka Obi', durationSeconds: 212, location: 'Lekki-Epe Expressway',
      tags: ['frsc', 'road safety'], verified: true, editorsPick: true, hoursAgo: 122, viewCount: 3302,
    },
  ]

  for (const v of published) {
    const { category, hoursAgo, reporter, ...rest } = v
    const account = staff.find((u) => u.name === reporter)
    await db.insert(schema.videos).values({
      ...rest,
      categoryId: cat(category),
      providerRef: DEMO_YT,
      reporterName: reporter,
      reporterId: account?.id ?? null,
      status: 'published',
      publishedAt: ago(hoursAgo),
      createdAt: ago(hoursAgo + 1),
      updatedAt: ago(hoursAgo),
    })
  }

  // Moderation queue (from the prototype's queue panel).
  const danfo = { id: randomUUID(), title: 'Danfo cashless rollout — driver interviews' }
  await db
    .insert(schema.videos)
    .values({
      id: danfo.id,
      slug: 'danfo-cashless-driver-interviews', title: 'Danfo cashless rollout — driver interviews',
      summary: 'Raw interviews with drivers at Ojota garage.', description: 'Raw interviews recorded with six danfo drivers about the cashless rollout.',
      categoryId: cat('community-voices'), providerRef: DEMO_YT, durationSeconds: 295, location: 'Ikorodu Road, Lagos',
      reporterName: 'Tunde Balogun', reporterId: personId('Tunde Balogun'), status: 'pending', createdAt: ago(0.2),
    })
  const ojota = { id: randomUUID(), title: 'Ojota flyover pothole complaint' }
  await db
    .insert(schema.videos)
    .values({
      id: ojota.id,
      slug: 'ojota-flyover-pothole-complaint', title: 'Ojota flyover pothole complaint',
      description: 'Large pothole on the Ojota flyover causing cars to swerve into the next lane during rush hour.',
      categoryId: cat('traffic-transport'), source: 'citizen', submittedMediaUrl: 'https://drive.example.com/ojota-pothole',
      location: 'Ojota, Lagos', reporterName: 'Adebayo O.', status: 'flagged', createdAt: ago(0.7),
    })
  const alaba = { id: randomUUID(), title: 'Alaba market generator incident, aftermath' }
  await db
    .insert(schema.videos)
    .values({
      id: alaba.id,
      slug: 'alaba-market-generator-incident', title: 'Alaba market generator incident, aftermath',
      description: 'Footage of the aftermath of a generator explosion. Contains injured persons — check before publishing.',
      categoryId: cat('public-safety'), providerRef: DEMO_YT, durationSeconds: 220, location: 'Alaba, Lagos',
      reporterName: 'Chiamaka Obi', reporterId: personId('Chiamaka Obi'), status: 'pending', sensitive: true, createdAt: ago(1),
    })
  await db.insert(schema.videos).values({
    slug: 'laswa-ferry-safety-briefing-raw', title: 'LASWA ferry safety briefing — raw footage',
    description: 'Unedited footage of the LASWA press briefing on inland waterway safety.',
    categoryId: cat('government-policy'), providerRef: DEMO_YT, durationSeconds: 552, location: 'Marina, Lagos Island',
    reporterName: 'Ngozi Fadipe', reporterId: personId('Ngozi Fadipe'), status: 'pending', createdAt: ago(2),
  })
  await db.insert(schema.submitterContacts).values({
    videoId: ojota.id, reference: 'EYE-7K2M9Q', name: 'Adebayo O.', email: 'adebayo@example.com', phone: '+234 800 000 0000', consentAt: ago(0.7),
  })
  await db.insert(schema.moderationReviews).values({
    videoId: ojota.id, reviewerId: personId('Chiamaka Obi'), decision: 'flagged', notes: 'Possible duplicate of an existing report.', checklist: {},
  })

  // A rejected item so the registry shows every state.
  await db.insert(schema.videos).values({
    slug: 'yaba-street-parade-unverified', title: 'Yaba street parade footage (unverified source)',
    categoryId: cat('community-voices'), source: 'citizen', reporterName: 'Citizen upload', status: 'rejected', createdAt: ago(30),
  })

  await db.update(schema.liveStream).set({
    title: 'Flood watch: live from Ajah',
    description: "Streaming from Eye Media's Ajah field desk as officials and volunteers coordinate access routes.",
    categoryId: cat('environment-sanitation'),
    youtubeVideoId: DEMO_YT,
    status: 'live',
    startedAt: ago(0.5),
    updatedAt: new Date(),
  })

  // Schedule: next three slots relative to now, on the half hour.
  const base = new Date(Math.ceil(Date.now() / (30 * 60_000)) * 30 * 60_000)
  await db.insert(schema.scheduleItems).values([
    { startsAt: new Date(base.getTime() + 1 * HOUR), title: 'LASWA briefing on inland waterway ferry safety', categoryId: cat('government-policy') },
    { startsAt: new Date(base.getTime() + 2.5 * HOUR), title: 'Community desk: Makoko waterfront clean-up, one month on', categoryId: cat('community-voices') },
    { startsAt: new Date(base.getTime() + 4 * HOUR), title: "Weekly wrap: this week's verified reports", categoryId: null },
  ])

  const admin = staff[0] ?? { id: null, name: 'Paxofi Technologies' }
  await db.insert(schema.auditLog).values([
    { actorId: personId('Chiamaka Obi'), actorName: 'Chiamaka Obi', action: 'moderation.approved', targetType: 'video', targetLabel: published[0]!.title, notes: 'Cleared verification checklist', createdAt: ago(1) },
    { actorId: personId('Tunde Balogun'), actorName: 'Tunde Balogun', action: 'video.created', targetType: 'video', targetId: danfo.id, targetLabel: danfo.title, createdAt: ago(0.2) },
    { actorId: personId('Chiamaka Obi'), actorName: 'Chiamaka Obi', action: 'moderation.flagged', targetType: 'video', targetId: ojota.id, targetLabel: ojota.title, notes: 'Possible duplicate of an existing report', createdAt: ago(0.5) },
    { actorId: personId('Ngozi Fadipe'), actorName: 'Ngozi Fadipe', action: 'live.started', targetType: 'live', targetId: '1', targetLabel: 'Flood watch: live from Ajah', createdAt: ago(0.5) },
    { actorId: personId('Chiamaka Obi'), actorName: 'Chiamaka Obi', action: 'video.updated', targetType: 'video', targetId: alaba.id, targetLabel: alaba.title, notes: 'Marked as sensitive', createdAt: ago(0.9) },
    { actorId: admin.id, actorName: admin.name, action: 'user.created', targetType: 'user', targetLabel: 'editor@eyemedia.local', notes: 'Role: editor', createdAt: ago(200) },
  ])

  console.log(`Demo content loaded${staff.length ? ` with ${staff.length} demo staff logins` : ' (no logins created)'}.`)
  if (staff.length) console.log(`Sign in at /admin/login as ${staff[0]!.email} (or editor@/moderator@/producer@/reporter@eyemedia.local) with SEED_ADMIN_PASSWORD.`)
  await pool.end()
}

main().catch((err) => {
  console.error(describeError(err))
  process.exit(1)
})
