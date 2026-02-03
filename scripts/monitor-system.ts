import { PrismaClient } from "@prisma/client"
import { redis } from "../src/lib/redis"

/**
 * Real-time system monitoring
 * Run this to watch the pipeline in action
 */
async function monitorSystem() {
  const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  })

  try {
    console.clear()
    console.log("📊 SYSTEM MONITOR - Real-time Status\n")
    console.log("Press Ctrl+C to stop\n")

    let iteration = 0

    const monitor = setInterval(async () => {
      try {
        iteration++
        const now = new Date()

        console.clear()
        console.log(`📊 SYSTEM MONITOR - ${now.toISOString()}`)
        console.log(`Iteration: ${iteration} (refreshes every 5s)\n`)

        // 1. Feed Pipeline
        console.log("📰 FEED PIPELINE:")
        const feedStats = await prisma.feed.groupBy({
          by: ["status"],
          _count: true,
        })
        feedStats.forEach((s) => {
          console.log(`   ${s.status}: ${s._count}`)
        })

        // 2. Queue Status
        console.log("\n🔄 QUEUE STATUS:")
        const queueSize = await redis.zcard("queue:approved-feeds")
        const processingSize = await redis.scard("queue:processing-feeds")
        console.log(`   Queued: ${queueSize}`)
        console.log(`   Processing: ${processingSize}`)

        // 3. Generation Pipeline
        console.log("\n🤖 GENERATION PIPELINE:")
        const genStats = await prisma.generatedPost.groupBy({
          by: ["status"],
          _count: true,
        })
        genStats.forEach((s) => {
          console.log(`   ${s.status}: ${s._count}`)
        })

        // 4. Scheduled Posts
        console.log("\n📅 SCHEDULED POSTS:")
        const schedStats = await prisma.scheduledPost.groupBy({
          by: ["status", "platform"],
          _count: true,
        })
        schedStats.forEach((s) => {
          console.log(`   ${s.platform} - ${s.status}: ${s._count}`)
        })

        // 5. Recent Activity
        console.log("\n🔥 RECENT ACTIVITY (Last 5 minutes):")
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

        const recentGen = await prisma.generatedPost.count({
          where: { createdAt: { gte: fiveMinutesAgo } },
        })
        const recentScheduled = await prisma.scheduledPost.count({
          where: { createdAt: { gte: fiveMinutesAgo } },
        })
        const recentPublished = await prisma.scheduledPost.count({
          where: {
            status: "PUBLISHED",
            publishedAt: { gte: fiveMinutesAgo },
          },
        })

        console.log(`   Generated: ${recentGen}`)
        console.log(`   Scheduled: ${recentScheduled}`)
        console.log(`   Published: ${recentPublished}`)

        // 6. Next Scheduled Posts
        console.log("\n🔜 NEXT 5 POSTS:")
        const upcoming = await prisma.scheduledPost.findMany({
          where: {
            status: "SCHEDULED",
            scheduledFor: { gte: now },
          },
          include: {
            user: { select: { email: true } },
          },
          orderBy: { scheduledFor: "asc" },
          take: 5,
        })

        if (upcoming.length === 0) {
          console.log("   No posts scheduled")
        } else {
          upcoming.forEach((post) => {
            const timeUntil = Math.floor(
              (post.scheduledFor.getTime() - now.getTime()) / 1000 / 60
            )
            console.log(
              `   ${post.scheduledFor.toISOString().split("T")[1].split(".")[0]} (in ${timeUntil}m) - ${post.user.email} [${post.platform}]`
            )
          })
        }

        console.log("\n" + "=".repeat(60))
      } catch (error) {
        console.error("Monitor error:", error)
      }
    }, 5000) // Refresh every 5 seconds

    // Handle Ctrl+C
    process.on("SIGINT", async () => {
      clearInterval(monitor)
      await prisma.$disconnect()
      console.log("\n\n👋 Monitor stopped")
      process.exit(0)
    })
  } catch (error) {
    console.error("❌ Error:", error)
    await prisma.$disconnect()
  }
}

monitorSystem()
