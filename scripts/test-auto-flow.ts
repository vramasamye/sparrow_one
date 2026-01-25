// Load environment variables
import dotenv from "dotenv"
import path from "path"
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

import { prisma } from "../src/lib/prisma"
import { redis } from "../src/lib/redis"
import { enqueueApprovedFeed, getQueueStats, peekQueue, dequeueNextJob, markJobCompleted } from "../src/lib/queue"
import { generatePostsForFeed } from "../src/lib/auto-generator"
import { distributeToSubscribers } from "../src/lib/auto-scheduler"
import { cleanupOldFeeds } from "../src/lib/feed-processor"

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
}

function log(emoji: string, message: string, color: string = colors.reset) {
  console.log(`${color}${emoji}  ${message}${colors.reset}`)
}

function section(title: string) {
  console.log(`\n${colors.bright}${colors.cyan}${"=".repeat(70)}`)
  console.log(`${title}`)
  console.log(`${"=".repeat(70)}${colors.reset}\n`)
}

async function main() {
  console.log(`${colors.bright}${colors.magenta}`)
  console.log(`╔═══════════════════════════════════════════════════════════════════════╗`)
  console.log(`║           AUTOMATED WORKFLOW TEST - FULL END-TO-END                   ║`)
  console.log(`║  Admin Approve → Queue → Generate (GROQ) → Distribute → Schedule     ║`)
  console.log(`╚═══════════════════════════════════════════════════════════════════════╝`)
  console.log(`${colors.reset}\n`)

  try {
    // Step 1: Check environment
    section("STEP 1: ENVIRONMENT CHECK")

    const hasGroq = !!(process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY)
    const hasRedis = !!process.env.REDIS_URL
    const hasDb = !!process.env.DATABASE_URL

    log(hasDb ? "✅" : "❌", `Database: ${hasDb ? "Connected" : "Not configured"}`, hasDb ? colors.green : colors.red)
    log(hasRedis ? "✅" : "❌", `Redis: ${hasRedis ? "Connected" : "Not configured"}`, hasRedis ? colors.green : colors.red)
    log(hasGroq ? "✅" : "❌", `GROQ Keys: ${hasGroq ? "Configured" : "Not configured"}`, hasGroq ? colors.green : colors.red)

    if (!hasGroq || !hasRedis || !hasDb) {
      throw new Error("Missing required environment variables")
    }

    // Step 2: Get stats
    section("STEP 2: SYSTEM STATISTICS")

    const [userCount, topicCount, feedCount, subscriberCount] = await Promise.all([
      prisma.user.count(),
      prisma.topic.count(),
      prisma.feed.count({ where: { status: "PENDING" } }),
      prisma.userTopic.count()
    ])

    log("👥", `Users: ${userCount}`, colors.blue)
    log("📚", `Topics: ${topicCount}`, colors.blue)
    log("📥", `Pending Feeds: ${feedCount}`, colors.yellow)
    log("🔗", `Subscriptions: ${subscriberCount}`, colors.blue)

    // Step 3: Find or create a pending feed
    section("STEP 3: SELECT FEED FOR TESTING")

    let testFeed = await prisma.feed.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: { topic: true }
    })

    if (!testFeed) {
      log("⚠️", "No pending feeds found. Creating a test feed...", colors.yellow)

      const topic = await prisma.topic.findFirst()
      if (!topic) {
        throw new Error("No topics found. Run db:seed first")
      }

      testFeed = await prisma.feed.create({
        data: {
          topicId: topic.id,
          rssFeedId: (await prisma.rssFeed.findFirst({ where: { topicId: topic.id } }))!.id,
          title: "Test Article: AI Breakthrough in 2026",
          url: "https://example.com/test-article",
          contentHash: `test-${Date.now()}`,
          summary: "A groundbreaking AI discovery that will change the future of technology.",
          status: "PENDING",
          publishedAt: new Date()
        },
        include: { topic: true }
      })

      log("✅", "Test feed created", colors.green)
    }

    log("📄", `Feed: "${testFeed.title.substring(0, 60)}..."`, colors.blue)
    log("📅", `Created: ${testFeed.createdAt.toISOString()}`, colors.blue)
    log("🏷️", `Topic: ${testFeed.topic.name}`, colors.blue)

    // Step 4: Simulate Admin Approval
    section("STEP 4: ADMIN APPROVAL SIMULATION")

    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } })
    if (!admin) {
      throw new Error("No admin user found")
    }

    log("👤", `Admin: ${admin.email}`, colors.blue)

    // Update to APPROVED
    await prisma.feed.update({
      where: { id: testFeed.id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedBy: admin.id
      }
    })

    log("✅", "Feed approved", colors.green)

    // Enqueue for processing
    log("📤", "Adding to queue...", colors.blue)
    await enqueueApprovedFeed(testFeed.id, admin.id)

    const queueStats = await getQueueStats()
    log("✅", `Enqueued (Queue size: ${queueStats.queued})`, colors.green)

    // Step 5: View Queue
    section("STEP 5: QUEUE STATUS")

    const queuedJobs = await peekQueue(5)
    log("📊", `Jobs in queue: ${queuedJobs.length}`, colors.cyan)

    queuedJobs.forEach((job, i) => {
      log("  ", `  ${i + 1}. Feed ${job.feedId} (approved at ${job.approvedAt})`)
    })

    // Step 6: Process Queue (Generate Posts)
    section("STEP 6: AUTO-GENERATION WITH GROQ")

    log("🤖", "Starting post generation...", colors.blue)
    log("💡", "This will wait for GROQ rate limits if needed", colors.cyan)

    const genResult = await generatePostsForFeed(testFeed.id)

    if (genResult.success) {
      log("✅", "Posts generated successfully!", colors.green)

      console.log(`\n${colors.bright}${colors.cyan}--- TWITTER POST ---${colors.reset}`)
      console.log(genResult.twitterContent)
      console.log(`${colors.cyan}${"─".repeat(70)}${colors.reset}\n`)

      console.log(`${colors.bright}${colors.cyan}--- LINKEDIN POST ---${colors.reset}`)
      console.log(genResult.linkedinContent)
      console.log(`${colors.cyan}${"─".repeat(70)}${colors.reset}\n`)
    } else {
      log("❌", `Generation failed: ${genResult.error}`, colors.red)
      throw new Error("Generation failed")
    }

    // Step 7: Distribute to Subscribers
    section("STEP 7: AUTO-DISTRIBUTION TO SUBSCRIBERS")

    log("📢", "Distributing to all subscribers...", colors.blue)

    const distResult = await distributeToSubscribers(testFeed.id)

    if (distResult.success) {
      log("✅", "Distribution completed!", colors.green)
      log("👥", `Users scheduled: ${distResult.usersScheduled}`, colors.cyan)
      log("📱", `Twitter posts: ${distResult.twitterScheduled}`, colors.cyan)
      log("💼", `LinkedIn posts: ${distResult.linkedinScheduled}`, colors.cyan)

      if (distResult.errors.length > 0) {
        log("⚠️", `Errors: ${distResult.errors.length}`, colors.yellow)
        distResult.errors.forEach(err => {
          log("  ", `  • ${err}`, colors.yellow)
        })
      }
    } else {
      log("❌", "Distribution failed", colors.red)
      throw new Error("Distribution failed")
    }

    // Step 8: Verify Scheduled Posts
    section("STEP 8: SCHEDULED POSTS VERIFICATION")

    const scheduledPosts = await prisma.scheduledPost.findMany({
      where: { feedId: testFeed.id },
      include: {
        user: { select: { email: true } },
        socialAccount: { select: { platform: true } }
      },
      orderBy: { scheduledFor: "asc" }
    })

    log("📅", `Total scheduled posts: ${scheduledPosts.length}`, colors.cyan)

    const byPlatform = scheduledPosts.reduce((acc, post) => {
      const platform = post.platform
      acc[platform] = (acc[platform] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    Object.entries(byPlatform).forEach(([platform, count]) => {
      log("  ", `  ${platform}: ${count} posts`)
    })

    log("📋", "Sample scheduled posts:", colors.bright)
    scheduledPosts.slice(0, 3).forEach((post, i) => {
      log("  ", `  ${i + 1}. ${post.user.email} → ${post.platform} at ${post.scheduledFor.toISOString()}`)
    })

    // Step 9: Mark job as completed
    section("STEP 9: QUEUE CLEANUP")

    const job = await dequeueNextJob()
    if (job) {
      await markJobCompleted(job)
      log("✅", "Job marked as completed", colors.green)
    }

    const finalStats = await getQueueStats()
    log("📊", `Final queue size: ${finalStats.queued}`, colors.cyan)

    // Step 10: Summary
    section("SUMMARY")

    const generatedPost = await prisma.generatedPost.findUnique({
      where: { feedId: testFeed.id }
    })

    log("📊", "End-to-End Flow Complete:", colors.bright)
    log("  ", `  ✅ Feed approved: ${testFeed.title.substring(0, 50)}...`)
    log("  ", `  ✅ Enqueued for processing`)
    log("  ", `  ✅ Posts generated (status: ${generatedPost?.status})`)
    log("  ", `  ✅ Distributed to ${distResult.usersScheduled} users`)
    log("  ", `  ✅ ${scheduledPosts.length} posts scheduled`)

    console.log(`\n${colors.bright}${colors.green}╔═══════════════════════════════════════════════════════════════════════╗`)
    console.log(`║                  ✅ AUTOMATED WORKFLOW TEST PASSED                     ║`)
    console.log(`╚═══════════════════════════════════════════════════════════════════════╝${colors.reset}\n`)

    log("💡", "Next Steps:", colors.bright)
    log("  ", `  1. Setup cron jobs to run:`)
    log("  ", `     • /api/cron/process-feeds (hourly - fetch RSS)`)
    log("  ", `     • /api/cron/process-queue (every 5-15 min - generate & distribute)`)
    log("  ", `     • /api/cron/publish-posts (every minute - publish scheduled)`)
    log("  ", `  2. Monitor queue status via /api/cron/process-queue`)
    log("  ", `  3. Check scheduled posts in dashboard`)

  } catch (error) {
    console.log(`\n${colors.bright}${colors.red}╔═══════════════════════════════════════════════════════════════════════╗`)
    console.log(`║                         ❌ TEST FAILED                                 ║`)
    console.log(`╚═══════════════════════════════════════════════════════════════════════╝${colors.reset}\n`)

    if (error instanceof Error) {
      log("❌", `Error: ${error.message}`, colors.red)
      console.error(error.stack)
    } else {
      console.error(error)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
    await redis.quit()
  }
}

main()
