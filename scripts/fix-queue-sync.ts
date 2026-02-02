import { PrismaClient } from "@prisma/client"
import { redis } from "../src/lib/redis"
import { enqueueApprovedFeed } from "../src/lib/queue"

/**
 * Sync approved feeds from database to Redis queue
 * This fixes the issue where feeds are approved but not queued
 */
async function fixQueueSync() {
  const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  })

  try {
    console.log("🔍 Checking Redis connection...")

    // Test Redis connection
    try {
      await redis.ping()
      console.log("✅ Redis is connected\n")
    } catch (error) {
      console.error("❌ Redis is DOWN! Cannot proceed.")
      console.error("   Error:", error)
      console.log("\n💡 Fix: Check your Redis connection in .env")
      console.log("   REDIS_URL or UPSTASH_REDIS_REST_URL\n")
      process.exit(1)
    }

    // Get current queue stats
    const queueSize = await redis.zcard("queue:approved-feeds")
    const processingSize = await redis.scard("queue:processing-feeds")

    console.log("📊 Current Redis Queue Status:")
    console.log(`   Queued: ${queueSize}`)
    console.log(`   Processing: ${processingSize}\n`)

    // Find approved feeds that aren't in queue yet
    console.log("🔍 Checking database for approved feeds...")

    const approvedFeeds = await prisma.feed.findMany({
      where: {
        status: "APPROVED",
      },
      select: {
        id: true,
        title: true,
        approvedAt: true,
        approvedBy: true,
      },
      orderBy: {
        approvedAt: "asc",
      },
    })

    console.log(`   Found ${approvedFeeds.length} approved feeds in database\n`)

    if (approvedFeeds.length === 0) {
      console.log("✅ No approved feeds to sync!")
      return
    }

    // Check which ones are already in Redis queue
    const queuedJobs = await redis.zrange("queue:approved-feeds", 0, -1)
    const queuedFeedIds = new Set(
      queuedJobs.map((job) => JSON.parse(job).feedId)
    )

    const feedsToEnqueue = approvedFeeds.filter(
      (feed) => !queuedFeedIds.has(feed.id)
    )

    console.log(`📋 Feeds to sync to queue: ${feedsToEnqueue.length}\n`)

    if (feedsToEnqueue.length === 0) {
      console.log("✅ All approved feeds are already in the queue!")
      return
    }

    // Enqueue missing feeds
    console.log("📤 Adding feeds to Redis queue...\n")

    for (const feed of feedsToEnqueue) {
      try {
        await enqueueApprovedFeed(
          feed.id,
          feed.approvedBy || "MANUAL_SYNC"
        )
        console.log(`   ✅ ${feed.title.substring(0, 60)}...`)
      } catch (error) {
        console.error(`   ❌ Failed to enqueue ${feed.id}:`, error)
      }
    }

    // Get updated stats
    const newQueueSize = await redis.zcard("queue:approved-feeds")

    console.log(`\n✅ Sync complete!`)
    console.log(`   Queue size: ${queueSize} → ${newQueueSize}`)
    console.log(`   Added: ${newQueueSize - queueSize} feeds\n`)

    console.log("💡 Now run the process-queue cron to start processing!")

  } catch (error) {
    console.error("❌ Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

fixQueueSync()
