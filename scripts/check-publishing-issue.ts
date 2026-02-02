import { PrismaClient } from "@prisma/client"

/**
 * Check why posts aren't publishing
 */
async function checkPublishingIssue() {
  const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  })

  try {
    const now = new Date()
    console.log(`🕐 Current time (UTC): ${now.toISOString()}`)
    console.log(`🕐 Current time (Local): ${now.toString()}\n`)

    // Check posts that SHOULD have been published
    console.log("📋 Posts that should have been published:")
    const overduePosts = await prisma.scheduledPost.findMany({
      where: {
        status: "SCHEDULED",
        scheduledFor: {
          lte: now, // Past or current time
        },
      },
      include: {
        user: { select: { email: true } },
        socialAccount: {
          select: {
            isActive: true,
            tokenExpiresAt: true
          }
        },
      },
      orderBy: { scheduledFor: "asc" },
    })

    if (overduePosts.length === 0) {
      console.log("   ✅ No overdue posts - all caught up!\n")
    } else {
      console.log(`   ⚠️  ${overduePosts.length} posts are OVERDUE:\n`)
      overduePosts.forEach((post) => {
        const scheduled = new Date(post.scheduledFor)
        const delayMinutes = Math.floor((now.getTime() - scheduled.getTime()) / 1000 / 60)
        const accountActive = post.socialAccount.isActive ? "✓" : "✗"
        const tokenExpired = post.socialAccount.tokenExpiresAt && new Date(post.socialAccount.tokenExpiresAt) < now ? "EXPIRED" : "OK"

        console.log(`   ${scheduled.toISOString()} (${delayMinutes}min ago)`)
        console.log(`   User: ${post.user.email}`)
        console.log(`   Platform: ${post.platform}`)
        console.log(`   Account Active: ${accountActive}`)
        console.log(`   Token Status: ${tokenExpired}`)
        console.log(`   Content: ${post.content.substring(0, 60)}...`)
        console.log()
      })
    }

    // Check upcoming posts
    console.log("📅 Upcoming posts (next 2 hours):")
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const upcoming = await prisma.scheduledPost.findMany({
      where: {
        status: "SCHEDULED",
        scheduledFor: {
          gt: now,
          lte: twoHoursLater,
        },
      },
      include: {
        user: { select: { email: true } },
      },
      orderBy: { scheduledFor: "asc" },
    })

    if (upcoming.length === 0) {
      console.log("   ℹ️  No posts scheduled in next 2 hours\n")
    } else {
      upcoming.forEach((post) => {
        const scheduled = new Date(post.scheduledFor)
        const inMinutes = Math.floor((scheduled.getTime() - now.getTime()) / 1000 / 60)
        console.log(`   ${scheduled.toISOString()} (in ${inMinutes}min)`)
        console.log(`   ${post.user.email} [${post.platform}]: ${post.content.substring(0, 60)}...`)
        console.log()
      })
    }

    // Check if publish cron is configured
    console.log("🔧 Publishing Configuration Check:")
    console.log(`   Expected CRON: Every 1 minute`)
    console.log(`   Expected endpoint: /api/cron/publish-posts`)
    console.log(`   \n   ⚠️  Make sure this is configured in cron-job.org or Vercel Cron!\n`)

    // Check last publishing activity
    const lastPublished = await prisma.scheduledPost.findFirst({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      include: {
        user: { select: { email: true } },
      },
    })

    if (lastPublished && lastPublished.publishedAt) {
      const timeSincePublish = Math.floor((now.getTime() - new Date(lastPublished.publishedAt).getTime()) / 1000 / 60)
      console.log("📊 Last Publishing Activity:")
      console.log(`   Last published: ${new Date(lastPublished.publishedAt).toISOString()}`)
      console.log(`   Time ago: ${timeSincePublish} minutes`)
      console.log(`   User: ${lastPublished.user.email}`)
      console.log(`   Platform: ${lastPublished.platform}\n`)

      if (timeSincePublish > 60) {
        console.log("   ⚠️  WARNING: No posts published in over 1 hour!")
        console.log("   ⚠️  The publish-posts cron may not be running!\n")
      }
    } else {
      console.log("📊 Last Publishing Activity:")
      console.log("   ⚠️  No posts have ever been published!\n")
    }

    console.log("✅ Diagnosis complete")
  } catch (error) {
    console.error("❌ Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

checkPublishingIssue()
