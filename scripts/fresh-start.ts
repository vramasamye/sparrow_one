import { PrismaClient } from "@prisma/client"
import { redis } from "../src/lib/redis"

/**
 * Fresh start: Clear approved feeds and queue
 * Use this to reset the system and start monitoring from scratch
 */
async function freshStart() {
  const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  })

  try {
    console.log("🧹 FRESH START - Clearing System\n")

    // 1. Show current state
    console.log("📊 Current State:")
    const approvedCount = await prisma.feed.count({
      where: { status: "APPROVED" },
    })
    const queueSize = await redis.zcard("queue:approved-feeds")
    const processingSize = await redis.scard("queue:processing-feeds")
    const scheduledCount = await prisma.scheduledPost.count({
      where: { status: "SCHEDULED" },
    })

    console.log(`   Approved Feeds: ${approvedCount}`)
    console.log(`   Redis Queue: ${queueSize}`)
    console.log(`   Redis Processing: ${processingSize}`)
    console.log(`   Scheduled Posts: ${scheduledCount}\n`)

    // 2. Ask for confirmation
    console.log("⚠️  This will:")
    console.log("   - Change all APPROVED feeds to PENDING")
    console.log("   - Clear Redis queue")
    console.log("   - Keep existing scheduled posts")
    console.log("   - NOT delete any data\n")

    // For safety, require explicit confirmation via env var
    if (process.env.CONFIRM_FRESH_START !== "yes") {
      console.log("❌ Aborted: Set CONFIRM_FRESH_START=yes to proceed\n")
      console.log("Run with: CONFIRM_FRESH_START=yes PRODUCTION_DATABASE_URL=... tsx scripts/fresh-start.ts")
      return
    }

    console.log("✅ Confirmed, proceeding...\n")

    // 3. Clear approved feeds (change to PENDING)
    console.log("🔄 Resetting approved feeds to PENDING...")
    const result = await prisma.feed.updateMany({
      where: { status: "APPROVED" },
      data: { status: "PENDING" },
    })
    console.log(`   ✅ Reset ${result.count} feeds to PENDING\n`)

    // 4. Clear Redis queue
    console.log("🔄 Clearing Redis queue...")
    await redis.del("queue:approved-feeds")
    await redis.del("queue:processing-feeds")
    console.log(`   ✅ Cleared Redis queue\n`)

    // 5. Clear failed generated posts (optional cleanup)
    console.log("🔄 Cleaning up failed generations...")
    const failedCleanup = await prisma.generatedPost.deleteMany({
      where: { status: "FAILED" },
    })
    console.log(`   ✅ Deleted ${failedCleanup.count} failed generations\n`)

    // 6. Show new state
    console.log("📊 New State:")
    const newApprovedCount = await prisma.feed.count({
      where: { status: "APPROVED" },
    })
    const newQueueSize = await redis.zcard("queue:approved-feeds")
    const newScheduledCount = await prisma.scheduledPost.count({
      where: { status: "SCHEDULED" },
    })

    console.log(`   Approved Feeds: ${newApprovedCount}`)
    console.log(`   Redis Queue: ${newQueueSize}`)
    console.log(`   Scheduled Posts: ${newScheduledCount}\n`)

    console.log("✅ FRESH START COMPLETE!\n")
    console.log("📋 Next Steps:")
    console.log("1. Go to /admin/feeds and approve some feeds")
    console.log("2. Watch them get queued automatically")
    console.log("3. Monitor /admin/queue for processing")
    console.log("4. Check scheduled posts appear\n")
  } catch (error) {
    console.error("❌ Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

freshStart()
