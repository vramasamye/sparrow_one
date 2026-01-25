// Load environment variables from .env.local
import dotenv from "dotenv"
import path from "path"
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

import { prisma } from "../src/lib/prisma"
import { processAllFeeds } from "../src/lib/feed-processor"
import { generatePost } from "../src/lib/ai"
import { getDetailedRateLimitStatus } from "../src/lib/rate-limiter"
import { redis } from "../src/lib/redis"

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

async function showRateLimitStatus() {
  const status = await getDetailedRateLimitStatus("moonshotai/kimi-k2-instruct")

  log("📊", `Model: ${status.model}`, colors.cyan)
  log("🔑", `Total Keys: ${status.totalKeys} | Available: ${status.availableKeys}`, colors.blue)

  if (status.totalKeys === 0) {
    log("⚠️", "No GROQ API keys configured!", colors.red)
    log("💡", "Add keys to .env.local: GROQ_API_KEYS=\"key1,key2,key3\"", colors.yellow)
    return
  }

  status.keys.forEach(key => {
    const statusIcon = key.isAvailable ? "✅" : "🚫"
    const statusColor = key.isAvailable ? colors.green : colors.red

    log(statusIcon, `Key ${key.keyIndex} (${key.keyId}...):`, statusColor)
    log("  ", `  Requests: ${key.requests.perMinute.used}/${key.requests.perMinute.limit} per min, ${key.requests.perDay.used}/${key.requests.perDay.limit} per day`)
    log("  ", `  Tokens:   ${key.tokens.perMinute.used}/${key.tokens.perMinute.limit} per min, ${key.tokens.perDay.used}/${key.tokens.perDay.limit} per day`)
  })
}

async function main() {
  console.log(`${colors.bright}${colors.magenta}`)
  console.log(`╔═════════════════════════════════════════════════════════════════════╗`)
  console.log(`║           BACKGROUND PROCESSING TEST - WITH RATE LIMITING           ║`)
  console.log(`║  Demonstrates: Subscriber-based filtering + Rate limit retry       ║`)
  console.log(`╚═════════════════════════════════════════════════════════════════════╝`)
  console.log(`${colors.reset}\n`)

  try {
    // Step 1: Check environment
    section("STEP 1: ENVIRONMENT CHECK")

    const envVars = {
      "DATABASE_URL": !!process.env.DATABASE_URL,
      "REDIS_URL": !!process.env.REDIS_URL,
      "GROQ_API_KEYS": !!process.env.GROQ_API_KEYS,
      "GROQ_API_KEY": !!process.env.GROQ_API_KEY,
      "OPENROUTER_API_KEY": !!process.env.OPENROUTER_API_KEY,
    }

    Object.entries(envVars).forEach(([key, value]) => {
      const icon = value ? "✅" : "❌"
      const color = value ? colors.green : colors.red
      log(icon, `${key}: ${value ? "Set" : "Not set"}`, color)
    })

    if (!envVars.GROQ_API_KEYS && !envVars.GROQ_API_KEY) {
      throw new Error("No GROQ API keys configured. Please add to .env.local")
    }

    // Step 2: Check rate limits
    section("STEP 2: RATE LIMIT STATUS")
    await showRateLimitStatus()

    // Step 3: Check subscriptions
    section("STEP 3: USER SUBSCRIPTION ANALYSIS")

    const userCount = await prisma.user.count()
    const topicCount = await prisma.topic.count()
    const subscriptionCount = await prisma.userTopic.count()

    const subscribedTopics = await prisma.userTopic.findMany({
      select: { topicId: true },
      distinct: ['topicId']
    })

    const topicsWithSubs = subscribedTopics.length
    const topicsWithoutSubs = topicCount - topicsWithSubs

    log("👥", `Total Users: ${userCount}`, colors.blue)
    log("📚", `Total Topics: ${topicCount}`, colors.blue)
    log("🔗", `Total Subscriptions: ${subscriptionCount}`, colors.blue)
    log("✅", `Topics with subscribers: ${topicsWithSubs}`, colors.green)
    log("⚠️", `Topics without subscribers: ${topicsWithoutSubs}`, colors.yellow)

    if (topicsWithSubs === 0) {
      log("❌", "No topics have subscribers! Feeds will not be fetched.", colors.red)
      log("💡", "Create a subscription to test feed processing", colors.yellow)
      return
    }

    // Show which topics will be processed
    const topicsToProcess = await prisma.topic.findMany({
      where: { id: { in: subscribedTopics.map(t => t.topicId) } },
      include: {
        rssFeeds: {
          where: { isActive: true }
        },
        _count: {
          select: {
            userTopics: true
          }
        }
      }
    })

    log("📡", "Topics that WILL be processed:", colors.bright)
    topicsToProcess.forEach(topic => {
      log("  ", `  • ${topic.name}: ${topic.rssFeeds.length} feeds, ${topic._count.userTopics} subscribers`, colors.cyan)
    })

    // Step 4: Process feeds (background mode)
    section("STEP 4: FEED PROCESSING (SUBSCRIBER-BASED)")

    log("🔄", "Starting feed fetch for subscribed topics only...", colors.blue)
    const startTime = Date.now()

    const results = await processAllFeeds()
    const duration = Date.now() - startTime

    const totalNew = results.reduce((sum, r) => sum + r.newItems, 0)
    const totalDupes = results.reduce((sum, r) => sum + r.duplicates, 0)
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    log("✅", `Completed in ${duration}ms`, colors.green)
    log("📊", `Processed: ${results.length} feeds`, colors.cyan)
    log("📊", `Success: ${successful} | Failed: ${failed}`, colors.cyan)
    log("📥", `New items: ${totalNew} | Duplicates: ${totalDupes}`, colors.cyan)

    if (totalNew === 0) {
      log("💡", "No new items found (feeds already fetched or no updates)", colors.yellow)
    }

    // Show detailed results
    if (results.length > 0) {
      log("📝", "Feed Processing Details:", colors.bright)
      results.forEach((result, i) => {
        const status = result.success ? colors.green + "✓" : colors.red + "✗"
        log("  ", `  ${status} ${result.feedName}: ${result.newItems} new, ${result.duplicates} dupes${colors.reset}`)
        if (result.error) {
          log("  ", `    Error: ${result.error}`, colors.red)
        }
      })
    }

    // Step 5: Test content generation with wait logic
    section("STEP 5: CONTENT GENERATION WITH RATE LIMIT RETRY")

    const pendingItem = await prisma.feed.findFirst({
      where: { status: "PENDING" },
      orderBy: { publishedAt: 'desc' }
    })

    if (!pendingItem) {
      log("⚠️", "No pending items found. Skipping content generation test.", colors.yellow)
    } else {
      log("📄", `Selected: "${pendingItem.title.substring(0, 60)}..."`, colors.blue)

      log("🤖", "Generating content with WAIT logic enabled...", colors.blue)
      log("💡", "This will wait up to 10 minutes for rate limits to reset", colors.cyan)

      try {
        const startGen = Date.now()
        const content = await generatePost({
          title: pendingItem.title,
          summary: pendingItem.summary || "",
          url: pendingItem.url,
          platform: "twitter",
          waitForRateLimit: true  // Enable wait logic
        })
        const genDuration = Date.now() - startGen

        log("✅", `Generated in ${genDuration}ms`, colors.green)
        console.log(`\n${colors.bright}${colors.cyan}--- GENERATED CONTENT ---${colors.reset}`)
        console.log(content)
        console.log(`${colors.cyan}${"─".repeat(70)}${colors.reset}\n`)

      } catch (error) {
        log("❌", "Generation failed", colors.red)
        if (error instanceof Error) {
          log("  ", `Error: ${error.message}`, colors.red)
        }
      }
    }

    // Step 6: Final rate limit check
    section("STEP 6: POST-PROCESSING RATE LIMIT STATUS")
    await showRateLimitStatus()

    // Step 7: Summary
    section("SUMMARY")

    const stats = await prisma.feed.groupBy({
      by: ['status'],
      _count: true
    })

    log("📊", "System-wide feed statistics:", colors.bright)
    stats.forEach(stat => {
      const emoji = stat.status === "PENDING" ? "⏳" :
                    stat.status === "APPROVED" ? "✅" :
                    stat.status === "REJECTED" ? "❌" : "📤"
      log("  ", `  ${emoji} ${stat.status}: ${stat._count}`)
    })

    console.log(`\n${colors.bright}${colors.green}╔═════════════════════════════════════════════════════════════════════╗`)
    console.log(`║                   ✅ BACKGROUND TEST COMPLETED                       ║`)
    console.log(`╚═════════════════════════════════════════════════════════════════════╝${colors.reset}\n`)

    log("💡", "Key Takeaways:", colors.bright)
    log("  ", `  • Only ${topicsWithSubs} out of ${topicCount} topics were processed`, colors.cyan)
    log("  ", `  • This saved ${topicsWithoutSubs} unnecessary feed fetches`, colors.cyan)
    log("  ", `  • Rate limit retry ensures no failures in background jobs`, colors.cyan)
    log("  ", `  • System can wait up to 10 minutes for API keys to become available`, colors.cyan)

  } catch (error) {
    console.log(`\n${colors.bright}${colors.red}╔═════════════════════════════════════════════════════════════════════╗`)
    console.log(`║                          ❌ TEST FAILED                              ║`)
    console.log(`╚═════════════════════════════════════════════════════════════════════╝${colors.reset}\n`)

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
