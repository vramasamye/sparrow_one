import { PrismaClient } from "@prisma/client"

/**
 * Check why distributed feeds aren't creating scheduled posts
 */
async function checkDistributionIssue() {
  const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  })

  try {
    console.log("🔍 Investigating Distribution Issue\n")

    // 1. Check distributed feeds and their scheduled posts
    console.log("1️⃣ Distributed Feeds vs Scheduled Posts:\n")

    const distributedFeeds = await prisma.generatedPost.findMany({
      where: { status: "DISTRIBUTED" },
      include: {
        feed: {
          select: {
            id: true,
            title: true,
            topicId: true,
            topic: { select: { name: true } },
          },
        },
      },
      orderBy: { distributedAt: "desc" },
      take: 10, // Last 10
    })

    console.log(`Total Distributed Feeds: ${distributedFeeds.length}\n`)

    for (const genPost of distributedFeeds) {
      // Count scheduled posts for this feed
      const scheduledCount = await prisma.scheduledPost.count({
        where: { feedId: genPost.feed.id },
      })

      console.log(`Feed: ${genPost.feed.title.substring(0, 60)}`)
      console.log(`  Topic: ${genPost.feed.topic.name}`)
      console.log(`  Distributed: ${genPost.distributedAt?.toISOString()}`)
      console.log(`  Scheduled Posts: ${scheduledCount}`)

      if (scheduledCount === 0) {
        // Check topic subscribers
        const subscribers = await prisma.userTopic.count({
          where: { topicId: genPost.feed.topicId },
        })

        const subscribersWithAccounts = await prisma.userTopic.count({
          where: {
            topicId: genPost.feed.topicId,
            user: {
              socialAccounts: {
                some: { isActive: true },
              },
            },
          },
        })

        console.log(`  ⚠️  NO SCHEDULED POSTS!`)
        console.log(`  Topic Subscribers: ${subscribers}`)
        console.log(`  Subscribers with Social Accounts: ${subscribersWithAccounts}`)
      }

      console.log()
    }

    // 2. Check all scheduled posts
    console.log("\n2️⃣ All Scheduled Posts:\n")

    const allScheduled = await prisma.scheduledPost.findMany({
      include: {
        user: { select: { email: true } },
        feed: {
          select: {
            title: true,
            topic: { select: { name: true } },
          },
        },
      },
      orderBy: { scheduledFor: "asc" },
    })

    console.log(`Total Scheduled Posts: ${allScheduled.length}\n`)

    const byStatus = await prisma.scheduledPost.groupBy({
      by: ["status"],
      _count: true,
    })

    byStatus.forEach((s) => {
      console.log(`  ${s.status}: ${s._count}`)
    })

    console.log("\n3️⃣ Scheduled Posts Breakdown by User:\n")

    const byUser = await prisma.scheduledPost.groupBy({
      by: ["userId", "status"],
      _count: true,
    })

    const userEmails = await prisma.user.findMany({
      select: { id: true, email: true },
    })

    const userMap = new Map(userEmails.map((u) => [u.id, u.email]))

    byUser.forEach((s) => {
      console.log(`  ${userMap.get(s.userId)}: ${s.status} = ${s._count}`)
    })

    // 4. Check if there's a pattern with failed distributions
    console.log("\n4️⃣ Failed Generations:\n")

    const failed = await prisma.generatedPost.findMany({
      where: { status: "FAILED" },
      include: {
        feed: {
          select: {
            title: true,
            topic: { select: { name: true } },
          },
        },
      },
      take: 5,
    })

    if (failed.length === 0) {
      console.log("  ✅ No failed generations\n")
    } else {
      failed.forEach((f) => {
        console.log(`  ${f.feed.title.substring(0, 60)}`)
        console.log(`    Topic: ${f.feed.topic.name}`)
        console.log(`    Error: ${f.errorMessage}`)
        console.log()
      })
    }

    // 5. Check timing of scheduled posts
    console.log("5️⃣ Scheduled Post Times:\n")

    const scheduledTimes = await prisma.scheduledPost.findMany({
      where: { status: "SCHEDULED" },
      select: {
        scheduledFor: true,
        userId: true,
        platform: true,
      },
      orderBy: { scheduledFor: "asc" },
    })

    const now = new Date()
    scheduledTimes.forEach((s) => {
      const isPast = s.scheduledFor < now
      const status = isPast ? "⏰ OVERDUE" : "🔜 UPCOMING"
      console.log(
        `  ${status} ${s.scheduledFor.toISOString()} - ${userMap.get(s.userId)} [${s.platform}]`
      )
    })

    console.log("\n✅ Investigation complete")
  } catch (error) {
    console.error("❌ Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDistributionIssue()
