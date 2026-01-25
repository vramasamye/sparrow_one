// Load environment variables from .env.local
import dotenv from "dotenv"
import path from "path"
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

import { prisma } from "../src/lib/prisma"
import { processFeedsForTopics } from "../src/lib/feed-processor"
import { generatePost } from "../src/lib/ai"
import { getAvailableKey, recordUsage, MODEL_LIMITS } from "../src/lib/rate-limiter"
import { redis } from "../src/lib/redis"

// ANSI color codes for better visibility
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
}

function log(emoji: string, message: string, color: string = colors.reset) {
  console.log(`${color}${emoji}  ${message}${colors.reset}`)
}

function section(title: string) {
  console.log(`\n${colors.bright}${colors.cyan}${"=".repeat(60)}`)
  console.log(`${title}`)
  console.log(`${"=".repeat(60)}${colors.reset}\n`)
}

async function checkRateLimitStatus() {
  section("RATE LIMIT STATUS CHECK")

  const API_KEYS = (process.env.GROQ_API_KEYS || "").split(",").map(k => k.trim()).filter(Boolean)
  if (API_KEYS.length === 0 && process.env.GROQ_API_KEY) {
    API_KEYS.push(process.env.GROQ_API_KEY)
  }

  log("🔑", `Found ${API_KEYS.length} GROQ API key(s)`, colors.blue)

  const model = "moonshotai/kimi-k2-instruct"
  const limits = MODEL_LIMITS[model]

  log("📊", `Model: ${model}`, colors.cyan)
  log("⚡", `Limits: ${limits.rpm} req/min, ${limits.rpd} req/day, ${limits.tpm} tok/min, ${limits.tpd} tok/day`, colors.cyan)

  for (let i = 0; i < API_KEYS.length; i++) {
    const key = API_KEYS[i]
    const keyId = Buffer.from(key).toString('base64').substring(0, 10)
    const now = Date.now()
    const minuteWindow = Math.floor(now / 60000)
    const dayWindow = Math.floor(now / 86400000)

    const rpmKey = `ratelimit:${keyId}:${model}:rpm:${minuteWindow}`
    const rpdKey = `ratelimit:${keyId}:${model}:rpd:${dayWindow}`
    const tpmKey = `tokenlimit:${keyId}:${model}:tpm:${minuteWindow}`
    const tpdKey = `tokenlimit:${keyId}:${model}:tpd:${dayWindow}`

    const [reqMin, reqDay, tokMin, tokDay] = await redis.mget(rpmKey, rpdKey, tpmKey, tpdKey)

    const currentRpm = parseInt(reqMin || "0", 10)
    const currentRpd = parseInt(reqDay || "0", 10)
    const currentTpm = parseInt(tokMin || "0", 10)
    const currentTpd = parseInt(tokDay || "0", 10)

    const availableRpm = limits.rpm - currentRpm
    const availableRpd = limits.rpd - currentRpd
    const availableTpm = limits.tpm - currentTpm
    const availableTpd = limits.tpd - currentTpd

    const isAvailable = currentRpm < limits.rpm && currentRpd < limits.rpd && currentTpm < limits.tpm && currentTpd < limits.tpd

    log("🔐", `Key ${i + 1} (${keyId}...):`, colors.bright)
    log("  ", `  Requests: ${currentRpm}/${limits.rpm} per min (${availableRpm} left), ${currentRpd}/${limits.rpd} per day (${availableRpd} left)`)
    log("  ", `  Tokens:   ${currentTpm}/${limits.tpm} per min (${availableTpm} left), ${currentTpd}/${limits.tpd} per day (${availableTpd} left)`)
    log("  ", `  Status:   ${isAvailable ? colors.green + "✓ AVAILABLE" : colors.red + "✗ RATE LIMITED"}${colors.reset}`)
  }

  const availableKey = await getAvailableKey(model)
  if (availableKey) {
    log("✅", "System status: READY - At least one key is available", colors.green)
  } else {
    log("⚠️", "System status: RATE LIMITED - All keys exhausted", colors.red)
  }
}

async function main() {
  console.log(`${colors.bright}${colors.blue}`)
  console.log(`╔════════════════════════════════════════════════════════════╗`)
  console.log(`║     SPARROW - FEED ADMIN APPROVAL TEST SCRIPT              ║`)
  console.log(`║     Testing: Feed Fetch → Admin Approval → AI Generation  ║`)
  console.log(`╚════════════════════════════════════════════════════════════╝`)
  console.log(`${colors.reset}\n`)

  try {
    // Step 0: Check rate limit status
    await checkRateLimitStatus()

    // Step 1: Find or create admin user
    section("STEP 1: ADMIN USER SETUP")

    let adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN" }
    })

    if (!adminUser) {
      log("➕", "No admin user found, creating one...", colors.yellow)
      adminUser = await prisma.user.create({
        data: {
          email: "admin-test@sparrow.one",
          name: "Admin Tester",
          role: "ADMIN"
        }
      })
      log("✅", `Admin user created: ${adminUser.email}`, colors.green)
    } else {
      log("✅", `Admin user found: ${adminUser.email} (${adminUser.role})`, colors.green)
    }

    // Step 2: Select a topic
    section("STEP 2: TOPIC SELECTION")

    const topicSlug = "artificial-intelligence"
    const topic = await prisma.topic.findUnique({
      where: { slug: topicSlug },
      include: {
        rssFeeds: {
          where: { isActive: true },
          take: 3
        }
      }
    })

    if (!topic) {
      throw new Error(`Topic '${topicSlug}' not found. Run: npm run db:seed`)
    }

    log("✅", `Topic: ${topic.name}`, colors.green)
    log("📡", `Active RSS feeds: ${topic.rssFeeds.length}`, colors.blue)
    topic.rssFeeds.forEach((feed, i) => {
      log("  ", `  ${i + 1}. ${feed.name}`)
    })

    // Step 3: Ensure user subscription
    section("STEP 3: USER SUBSCRIPTION")

    const subscription = await prisma.userTopic.findUnique({
      where: {
        userId_topicId: {
          userId: adminUser.id,
          topicId: topic.id
        }
      }
    })

    if (!subscription) {
      log("➕", "Subscribing admin to topic...", colors.yellow)
      await prisma.userTopic.create({
        data: {
          userId: adminUser.id,
          topicId: topic.id
        }
      })
      log("✅", "Subscription created", colors.green)
    } else {
      log("✅", "Admin already subscribed", colors.green)
    }

    // Step 4: Fetch feeds
    section("STEP 4: FEED PROCESSING")

    log("🔄", "Fetching RSS feeds...", colors.blue)
    const startTime = Date.now()

    const results = await processFeedsForTopics([topic.id])
    const duration = Date.now() - startTime

    const totalNew = results.reduce((sum, r) => sum + r.newItems, 0)
    const totalDupes = results.reduce((sum, r) => sum + r.duplicates, 0)
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    log("✅", `Completed in ${duration}ms`, colors.green)
    log("📊", `Results: ${successful} successful, ${failed} failed`, colors.cyan)
    log("📥", `New items: ${totalNew}, Duplicates: ${totalDupes}`, colors.cyan)

    results.forEach((result, i) => {
      const status = result.success ? colors.green + "✓" : colors.red + "✗"
      log("  ", `  ${status} ${result.feedName}: ${result.newItems} new, ${result.duplicates} dupes${colors.reset}`)
      if (result.error) {
        log("  ", `    Error: ${result.error}`, colors.red)
      }
    })

    // Step 5: Select a pending item
    section("STEP 5: ITEM SELECTION FOR APPROVAL")

    let feedItem = await prisma.feed.findFirst({
      where: {
        topicId: topic.id,
        status: "PENDING"
      },
      orderBy: { publishedAt: 'desc' }
    })

    if (!feedItem) {
      // If no pending items, create one from an existing item
      log("⚠️", "No pending items found, resetting an existing item...", colors.yellow)

      const existingItem = await prisma.feed.findFirst({
        where: { topicId: topic.id },
        orderBy: { publishedAt: 'desc' }
      })

      if (!existingItem) {
        throw new Error("No feed items available. Try running feed fetch first.")
      }

      feedItem = await prisma.feed.update({
        where: { id: existingItem.id },
        data: {
          status: "PENDING",
          approvedAt: null,
          approvedBy: null
        }
      })
    }

    log("✅", `Selected item: "${feedItem.title}"`, colors.green)
    log("📄", `URL: ${feedItem.url}`, colors.blue)
    log("📅", `Published: ${feedItem.publishedAt.toISOString()}`, colors.blue)
    log("🔖", `Status: ${feedItem.status}`, colors.yellow)

    // Step 6: Admin approves the item
    section("STEP 6: ADMIN APPROVAL")

    log("👤", `Admin ${adminUser.name} approving item...`, colors.blue)

    feedItem = await prisma.feed.update({
      where: { id: feedItem.id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedBy: adminUser.id
      }
    })

    log("✅", "Item APPROVED", colors.green)

    // Step 7: Check rate limit before generation
    section("STEP 7: PRE-GENERATION RATE LIMIT CHECK")
    await checkRateLimitStatus()

    // Step 8: Generate social media posts
    section("STEP 8: AI CONTENT GENERATION")

    const platforms: Array<"twitter" | "linkedin"> = ["twitter", "linkedin"]

    for (const platform of platforms) {
      log("🤖", `Generating ${platform.toUpperCase()} post...`, colors.blue)

      try {
        const startGen = Date.now()
        const postContent = await generatePost({
          title: feedItem.title,
          summary: feedItem.summary || "",
          url: feedItem.url,
          platform
        })
        const genDuration = Date.now() - startGen

        log("✅", `Generated in ${genDuration}ms`, colors.green)
        console.log(`\n${colors.bright}${colors.cyan}--- ${platform.toUpperCase()} POST ---${colors.reset}`)
        console.log(postContent)
        console.log(`${colors.cyan}${"─".repeat(60)}${colors.reset}\n`)

      } catch (error) {
        log("❌", `Generation failed for ${platform}`, colors.red)
        if (error instanceof Error) {
          log("  ", `  Error: ${error.message}`, colors.red)
        }
      }
    }

    // Step 9: Final rate limit check
    section("STEP 9: POST-GENERATION RATE LIMIT STATUS")
    await checkRateLimitStatus()

    // Step 10: Summary
    section("TEST SUMMARY")

    const stats = await prisma.feed.groupBy({
      by: ['status'],
      _count: true,
      where: { topicId: topic.id }
    })

    log("📊", "Feed item statistics:", colors.bright)
    stats.forEach(stat => {
      const emoji = stat.status === "PENDING" ? "⏳" :
                    stat.status === "APPROVED" ? "✅" :
                    stat.status === "REJECTED" ? "❌" : "📤"
      log("  ", `  ${emoji} ${stat.status}: ${stat._count}`)
    })

    console.log(`\n${colors.bright}${colors.green}╔════════════════════════════════════════════════════════════╗`)
    console.log(`║                 ✅ TEST COMPLETED SUCCESSFULLY              ║`)
    console.log(`╚════════════════════════════════════════════════════════════╝${colors.reset}\n`)

  } catch (error) {
    console.log(`\n${colors.bright}${colors.red}╔════════════════════════════════════════════════════════════╗`)
    console.log(`║                    ❌ TEST FAILED                           ║`)
    console.log(`╚════════════════════════════════════════════════════════════╝${colors.reset}\n`)

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

// Run the test
main()
