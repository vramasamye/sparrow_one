import { PrismaClient } from "@prisma/client"
import { redis } from "../src/lib/redis"

/**
 * End-to-end pipeline test
 * Picks one PENDING feed, manually runs it through every stage,
 * and prints the result at each step so you can see exactly where things stand.
 *
 * Run: PRODUCTION_DATABASE_URL="..." npx tsx scripts/e2e-pipeline-test.ts
 */
async function e2ePipelineTest() {
  const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  })

  try {
    console.log("=" .repeat(60))
    console.log(" 🧪 END-TO-END PIPELINE TEST")
    console.log("=" .repeat(60) + "\n")

    // ──────────────────────────────────────────
    // STEP 0: System snapshot
    // ──────────────────────────────────────────
    console.log("📊 STEP 0 — Current System State\n")

    const feedsByStatus = await prisma.feed.groupBy({ by: ["status"], _count: true })
    console.log("  Feeds by status:")
    feedsByStatus.forEach(s => console.log(`    ${s.status}: ${s._count}`))

    const genByStatus = await prisma.generatedPost.groupBy({ by: ["status"], _count: true })
    console.log("\n  Generated posts by status:")
    genByStatus.forEach(s => console.log(`    ${s.status}: ${s._count}`))

    const schedByStatus = await prisma.scheduledPost.groupBy({ by: ["status", "platform"], _count: true })
    console.log("\n  Scheduled posts:")
    schedByStatus.forEach(s => console.log(`    ${s.platform} — ${s.status}: ${s._count}`))

    const queueSize = await redis.zcard("queue:approved-feeds")
    const processingSize = await redis.scard("queue:processing-feeds")
    console.log(`\n  Redis queue: ${queueSize} queued, ${processingSize} processing`)

    // ──────────────────────────────────────────
    // STEP 1: Find a feed to test with
    // ──────────────────────────────────────────
    console.log("\n" + "─".repeat(60))
    console.log("🔍 STEP 1 — Pick a test feed\n")

    // Prefer an APPROVED feed that has no generated post yet
    let testFeed = await prisma.feed.findFirst({
      where: {
        status: "APPROVED",
        generatedPosts: { none: {} },
      },
      include: {
        topic: true,
      },
    })

    // Fallback: any APPROVED feed
    if (!testFeed) {
      testFeed = await prisma.feed.findFirst({
        where: { status: "APPROVED" },
        include: { topic: true },
      })
    }

    // Fallback: any PENDING feed (we'll note it needs approval first)
    if (!testFeed) {
      testFeed = await prisma.feed.findFirst({
        where: { status: "PENDING" },
        include: { topic: true },
      })
    }

    if (!testFeed) {
      console.log("  ❌ No feeds found at all in the database!")
      console.log("  💡 process-feeds cron is not fetching RSS content.")
      console.log("     Verify it's configured in cron-job.org.\n")
      return
    }

    console.log(`  Feed ID:    ${testFeed.id}`)
    console.log(`  Title:      ${testFeed.title}`)
    console.log(`  Topic:      ${testFeed.topic.name}`)
    console.log(`  Status:     ${testFeed.status}`)
    console.log(`  Scored:     ${testFeed.scoredAt ? "Yes" : "No"}`)
    console.log(`  Twitter:    ${testFeed.topic.enableTwitter}`)
    console.log(`  LinkedIn:   ${testFeed.topic.enableLinkedin}`)

    // ──────────────────────────────────────────
    // STEP 2: Check subscribers for this topic
    // ──────────────────────────────────────────
    console.log("\n" + "─".repeat(60))
    console.log("👥 STEP 2 — Topic subscribers & social accounts\n")

    const subscribers = await prisma.userTopic.findMany({
      where: { topicId: testFeed.topicId },
      include: {
        user: {
          include: {
            socialAccounts: { where: { isActive: true } },
            preferences: true,
          },
        },
      },
    })

    if (subscribers.length === 0) {
      console.log(`  ❌ Topic "${testFeed.topic.name}" has ZERO subscribers!`)
      console.log("  💡 No posts will ever be scheduled for this topic.")
      console.log("     Users need to subscribe to this topic.\n")
    } else {
      subscribers.forEach(sub => {
        const platforms = sub.user.socialAccounts.map(a => a.platform).join(", ")
        const hasPrefs = sub.user.preferences ? "Yes" : "No"
        console.log(`  👤 ${sub.user.email}`)
        console.log(`      Social accounts: ${platforms || "NONE ❌"}`)
        console.log(`      Has preferences: ${hasPrefs}`)
        if (sub.user.socialAccounts.length === 0) {
          console.log(`      ⚠️  No social accounts — posts will NOT be scheduled for this user`)
        }
      })
    }

    // ──────────────────────────────────────────
    // STEP 3: Check if feed is in Redis queue
    // ──────────────────────────────────────────
    console.log("\n" + "─".repeat(60))
    console.log("📦 STEP 3 — Redis queue check\n")

    const allQueuedJobs = await redis.zrange("queue:approved-feeds", 0, -1)
    const feedInQueue = allQueuedJobs.some(j => {
      try { return JSON.parse(j).feedId === testFeed!.id } catch { return false }
    })

    console.log(`  Feed in queue: ${feedInQueue ? "Yes ✅" : "No"}`)

    if (!feedInQueue && testFeed.status === "APPROVED") {
      console.log("  ⚠️  Feed is APPROVED but NOT in the Redis queue!")
      console.log("  💡 This is why process-queue won't pick it up.")
      console.log("     It needs to be manually added or re-approved.\n")
    }

    // ──────────────────────────────────────────
    // STEP 4: Check generated post for this feed
    // ──────────────────────────────────────────
    console.log("\n" + "─".repeat(60))
    console.log("🤖 STEP 4 — Generated post check\n")

    const generatedPost = await prisma.generatedPost.findUnique({
      where: { feedId: testFeed.id },
    })

    if (!generatedPost) {
      console.log("  No generated post yet — needs to be processed by queue")
    } else {
      console.log(`  Status:           ${generatedPost.status}`)
      console.log(`  Twitter content:  ${generatedPost.twitterContent ? generatedPost.twitterContent.substring(0, 80) + "..." : "null"}`)
      console.log(`  LinkedIn content: ${generatedPost.linkedinContent ? generatedPost.linkedinContent.substring(0, 80) + "..." : "null"}`)
      console.log(`  Error:            ${generatedPost.errorMessage || "none"}`)
      console.log(`  Distributed at:   ${generatedPost.distributedAt || "not yet"}`)
    }

    // ──────────────────────────────────────────
    // STEP 5: Check scheduled posts for this feed
    // ──────────────────────────────────────────
    console.log("\n" + "─".repeat(60))
    console.log("📅 STEP 5 — Scheduled posts for this feed\n")

    const scheduledPosts = await prisma.scheduledPost.findMany({
      where: { feedId: testFeed.id },
      include: { user: { select: { email: true } } },
      orderBy: { scheduledFor: "asc" },
    })

    if (scheduledPosts.length === 0) {
      console.log("  ❌ Zero scheduled posts for this feed")
    } else {
      scheduledPosts.forEach(p => {
        const timeStr = p.scheduledFor.toISOString()
        console.log(`  ${p.status.padEnd(12)} ${p.platform.padEnd(10)} ${timeStr} — ${p.user.email}`)
        if (p.errorMessage) console.log(`             ↳ Error: ${p.errorMessage}`)
      })
    }

    // ──────────────────────────────────────────
    // STEP 6: Check all upcoming posts (any feed)
    // ──────────────────────────────────────────
    console.log("\n" + "─".repeat(60))
    console.log("🔜 STEP 6 — All upcoming scheduled posts (next 48h)\n")

    const now = new Date()
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)

    const upcoming = await prisma.scheduledPost.findMany({
      where: {
        status: "SCHEDULED",
        scheduledFor: { gte: now, lte: in48h },
      },
      include: {
        user: { select: { email: true } },
        feed: { select: { title: true } },
      },
      orderBy: { scheduledFor: "asc" },
    })

    if (upcoming.length === 0) {
      console.log("  ❌ No posts scheduled in next 48 hours!")
    } else {
      upcoming.forEach(p => {
        const mins = Math.round((p.scheduledFor.getTime() - now.getTime()) / 60000)
        const label = mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`
        console.log(`  [in ${label.padEnd(5)}] ${p.platform.padEnd(10)} ${p.user.email.padEnd(40)} ${p.feed?.title.substring(0, 40) ?? "unknown"}`)
      })
    }

    // ──────────────────────────────────────────
    // STEP 7: Check overdue posts (should have published already)
    // ──────────────────────────────────────────
    console.log("\n" + "─".repeat(60))
    console.log("⏰ STEP 7 — Overdue posts (past scheduledFor, still SCHEDULED)\n")

    const overdue = await prisma.scheduledPost.findMany({
      where: {
        status: "SCHEDULED",
        scheduledFor: { lt: now },
      },
      include: { user: { select: { email: true } } },
      orderBy: { scheduledFor: "asc" },
    })

    if (overdue.length === 0) {
      console.log("  ✅ No overdue posts — publish cron is on time")
    } else {
      console.log(`  ⚠️  ${overdue.length} post(s) are OVERDUE and not publishing!`)
      overdue.forEach(p => {
        const mins = Math.round((now.getTime() - p.scheduledFor.getTime()) / 60000)
        console.log(`    ${p.platform} — ${p.user.email} — ${mins} minutes overdue`)
      })
      console.log("\n  💡 publish-posts cron may not be running. Check cron-job.org.")
    }

    // ──────────────────────────────────────────
    // SUMMARY
    // ──────────────────────────────────────────
    console.log("\n" + "=" .repeat(60))
    console.log(" 📋 SUMMARY & NEXT ACTION")
    console.log("=" .repeat(60) + "\n")

    if (testFeed.status === "PENDING") {
      console.log("  ➡️  Feed is PENDING — needs to be approved first.")
      console.log("      Go to /admin/feeds and approve it.")
      console.log("      Or wait for score-feeds cron to auto-approve.\n")
    } else if (testFeed.status === "APPROVED" && !feedInQueue) {
      console.log("  ➡️  Feed is APPROVED but NOT in Redis queue.")
      console.log("      Run this curl to re-queue it:")
      console.log(`      curl -X POST https://sparrow-one-gold.vercel.app/api/admin/fix-stuck-jobs`)
      console.log("      (with your auth cookie)\n")
    } else if (testFeed.status === "APPROVED" && feedInQueue && !generatedPost) {
      console.log("  ➡️  Feed is in queue and waiting for process-queue cron to pick it up.")
      console.log("      It runs every 15 min. Or trigger manually:")
      console.log(`      curl -X POST -H "Authorization: Bearer CRON_SECRET" \\`)
      console.log(`        https://sparrow-one-gold.vercel.app/api/cron/process-queue\n`)
    } else if (generatedPost && generatedPost.status === "COMPLETED" && scheduledPosts.length === 0) {
      console.log("  ⚠️  Posts were generated but ZERO were scheduled!")
      console.log("      Check Step 2 — subscribers need active social accounts.\n")
    } else if (overdue.length > 0) {
      console.log("  ⚠️  Posts exist but are OVERDUE — publish-posts cron isn't firing.")
      console.log("      Check cron-job.org for the publish-posts job.\n")
    } else if (upcoming.length > 0) {
      console.log("  ✅ Pipeline is healthy! Posts are scheduled and will publish on time.")
      console.log(`      Next post: in ${Math.round((upcoming[0].scheduledFor.getTime() - now.getTime()) / 60000)} minutes\n`)
    } else {
      console.log("  ℹ️  No scheduled posts yet. Wait for process-queue to run.")
      console.log("      Queue: " + queueSize + " feeds waiting.\n")
    }

  } catch (error) {
    console.error("❌ Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

e2ePipelineTest()
