import { PrismaClient } from "@prisma/client"

/**
 * Verify that posts are being scheduled correctly
 * Run with: PRODUCTION_DATABASE_URL="..." tsx scripts/verify-scheduled-posts.ts
 */
async function verifyScheduledPosts() {
  const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL

  if (!dbUrl) {
    console.error("❌ No database URL found. Set PRODUCTION_DATABASE_URL or DATABASE_URL")
    process.exit(1)
  }

  console.log("🔍 Connecting to database...")
  console.log(`   URL: ${dbUrl.split("@")[1]}`) // Hide credentials

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  })

  try {
    // 1. Check user subscriptions
    console.log("\n📋 User Subscriptions:")
    const subscriptions = await prisma.userTopic.findMany({
      include: {
        user: { select: { email: true } },
        topic: { select: { name: true } },
      },
    })
    console.log(`   Total subscriptions: ${subscriptions.length}`)
    subscriptions.forEach((sub) => {
      console.log(`   - ${sub.user.email} → ${sub.topic.name}`)
    })

    // 2. Check social accounts
    console.log("\n🔗 Social Accounts:")
    const accounts = await prisma.socialAccount.findMany({
      where: { isActive: true },
      include: {
        user: { select: { email: true } },
      },
    })
    console.log(`   Active accounts: ${accounts.length}`)
    accounts.forEach((acc) => {
      const expiry = acc.tokenExpiresAt
        ? new Date(acc.tokenExpiresAt).toISOString().split("T")[0]
        : "N/A"
      console.log(`   - ${acc.user.email}: ${acc.platform} (expires: ${expiry})`)
    })

    // 3. Check queue status
    console.log("\n📊 Queue Status:")
    const queueStats = await prisma.generatedPost.groupBy({
      by: ["status"],
      _count: true,
    })
    queueStats.forEach((stat) => {
      console.log(`   ${stat.status}: ${stat._count}`)
    })

    // 4. Check scheduled posts
    console.log("\n📅 Scheduled Posts:")
    const scheduledStats = await prisma.scheduledPost.groupBy({
      by: ["status", "platform"],
      _count: true,
    })
    scheduledStats.forEach((stat) => {
      console.log(`   ${stat.platform} - ${stat.status}: ${stat._count}`)
    })

    // 5. Recent scheduled posts
    console.log("\n🔜 Upcoming Scheduled Posts (Next 24 hours):")
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const upcoming = await prisma.scheduledPost.findMany({
      where: {
        status: "SCHEDULED",
        scheduledFor: {
          gte: now,
          lte: tomorrow,
        },
      },
      include: {
        user: { select: { email: true } },
      },
      orderBy: { scheduledFor: "asc" },
      take: 20,
    })

    if (upcoming.length === 0) {
      console.log("   ⚠️  No posts scheduled for next 24 hours!")
    } else {
      upcoming.forEach((post) => {
        const scheduledTime = new Date(post.scheduledFor).toISOString().replace("T", " ").split(".")[0]
        const preview = post.content.substring(0, 50) + "..."
        console.log(`   ${scheduledTime} - ${post.user.email} [${post.platform}]: ${preview}`)
      })
    }

    // 6. Recent published posts
    console.log("\n✅ Recently Published Posts (Last 24 hours):")
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const published = await prisma.scheduledPost.findMany({
      where: {
        status: "PUBLISHED",
        publishedAt: {
          gte: yesterday,
        },
      },
      include: {
        user: { select: { email: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: 10,
    })

    if (published.length === 0) {
      console.log("   ⚠️  No posts published in last 24 hours!")
    } else {
      published.forEach((post) => {
        const publishedTime = post.publishedAt
          ? new Date(post.publishedAt).toISOString().replace("T", " ").split(".")[0]
          : "N/A"
        const preview = post.content.substring(0, 50) + "..."
        console.log(`   ${publishedTime} - ${post.user.email} [${post.platform}]: ${preview}`)
      })
    }

    // 7. Failed posts
    console.log("\n❌ Failed Posts (Last 24 hours):")
    const failed = await prisma.scheduledPost.findMany({
      where: {
        status: "FAILED",
        updatedAt: {
          gte: yesterday,
        },
      },
      include: {
        user: { select: { email: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    })

    if (failed.length === 0) {
      console.log("   ✅ No failed posts!")
    } else {
      failed.forEach((post) => {
        console.log(`   ${post.user.email} [${post.platform}]: ${post.errorMessage}`)
      })
    }

    // 8. Check last processed feed
    console.log("\n🔄 Last Processed Feed:")
    const lastProcessed = await prisma.generatedPost.findFirst({
      where: {
        status: { in: ["COMPLETED", "DISTRIBUTED"] },
      },
      include: {
        feed: { select: { title: true } },
      },
      orderBy: { generatedAt: "desc" },
    })

    if (lastProcessed) {
      console.log(`   ${lastProcessed.feed.title}`)
      console.log(`   Status: ${lastProcessed.status}`)
      console.log(`   Generated: ${lastProcessed.generatedAt.toISOString()}`)
      if (lastProcessed.distributedAt) {
        console.log(`   Distributed: ${lastProcessed.distributedAt.toISOString()}`)
      }
    } else {
      console.log("   ⚠️  No feeds have been processed yet!")
    }

    console.log("\n✅ Verification complete")
  } catch (error) {
    console.error("\n❌ Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyScheduledPosts()
