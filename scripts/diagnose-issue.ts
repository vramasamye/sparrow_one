import { prisma } from "../src/lib/prisma"
import { redis } from "../src/lib/redis"
import { getQueueStats, peekQueue } from "../src/lib/queue"
import { getDetailedRateLimitStatus } from "../src/lib/rate-limiter"

async function diagnose() {
  console.log("🔍 Diagnosing Feed Processing Issue...\n")

  try {
    // 1. Check GROQ API Keys
    console.log("📋 Step 1: Checking GROQ API Keys")
    const GROQ_API_KEYS = (process.env.GROQ_API_KEYS || "").split(",").map(k => k.trim()).filter(Boolean)
    const GROQ_API_KEY = process.env.GROQ_API_KEY

    if (GROQ_API_KEYS.length > 0) {
      console.log(`✅ Found ${GROQ_API_KEYS.length} GROQ API keys configured`)
    } else if (GROQ_API_KEY) {
      console.log("✅ Found 1 GROQ API key configured")
    } else {
      console.log("❌ No GROQ API keys found!")
      console.log("   Set GROQ_API_KEYS or GROQ_API_KEY in .env.local")
    }

    // 2. Check rate limit status
    console.log("\n📊 Step 2: Checking GROQ Rate Limits")
    try {
      const rateLimitStatus = await getDetailedRateLimitStatus("moonshotai/kimi-k2-instruct")
      console.log(`   Total Keys: ${rateLimitStatus.totalKeys}`)
      console.log(`   Available Keys: ${rateLimitStatus.availableKeys}`)

      if (rateLimitStatus.availableKeys === 0) {
        console.log("⚠️  All keys are rate limited!")
        rateLimitStatus.keys.forEach((key, idx) => {
          console.log(`   Key ${idx + 1}:`)
          console.log(`     - Requests/min: ${key.requests.perMinute.used}/${key.requests.perMinute.limit}`)
          console.log(`     - Requests/day: ${key.requests.perDay.used}/${key.requests.perDay.limit}`)
        })
      } else {
        console.log(`✅ ${rateLimitStatus.availableKeys} key(s) available for use`)
      }
    } catch (error) {
      console.log("⚠️  Could not check rate limits (Redis may not be connected)")
    }

    // 3. Check database feeds
    console.log("\n📋 Step 3: Checking Database Feeds")
    const feedStats = await prisma.feed.groupBy({
      by: ['status'],
      _count: true
    })

    console.log("   Feed Status:")
    feedStats.forEach(stat => {
      console.log(`   - ${stat.status}: ${stat._count}`)
    })

    const approvedFeeds = await prisma.feed.findMany({
      where: { status: "APPROVED" },
      select: {
        id: true,
        title: true,
        approvedAt: true,
        topic: {
          select: {
            name: true,
            enableTwitter: true,
            enableLinkedin: true
          }
        }
      },
      orderBy: { approvedAt: 'desc' },
      take: 5
    })

    if (approvedFeeds.length === 0) {
      console.log("\n❌ No approved feeds found!")
      console.log("   This is the issue - feeds need to be APPROVED before they can be processed")
      console.log("   Go to the admin panel and approve some feeds first")
    } else {
      console.log(`\n✅ Found ${approvedFeeds.length} approved feed(s):`)
      approvedFeeds.forEach((feed, idx) => {
        console.log(`   ${idx + 1}. ${feed.title.substring(0, 60)}...`)
        console.log(`      Topic: ${feed.topic.name}`)
        console.log(`      Platforms: ${feed.topic.enableTwitter ? 'Twitter' : ''} ${feed.topic.enableLinkedin ? 'LinkedIn' : ''}`)
        console.log(`      Approved: ${feed.approvedAt?.toISOString()}`)
      })
    }

    // 4. Check GeneratedPosts
    console.log("\n📝 Step 4: Checking Generated Posts")
    const genPostStats = await prisma.generatedPost.groupBy({
      by: ['status'],
      _count: true
    })

    if (genPostStats.length === 0) {
      console.log("   ❌ No generated posts found!")
      console.log("   This means approved feeds are not being processed by the queue")
    } else {
      console.log("   Generated Post Status:")
      genPostStats.forEach(stat => {
        console.log(`   - ${stat.status}: ${stat._count}`)
      })
    }

    // Check for recent generated posts
    const recentGenPosts = await prisma.generatedPost.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      include: {
        feed: {
          select: {
            title: true,
            status: true
          }
        }
      }
    })

    if (recentGenPosts.length > 0) {
      console.log("\n   Recent Generated Posts:")
      recentGenPosts.forEach((post, idx) => {
        console.log(`   ${idx + 1}. Status: ${post.status}`)
        console.log(`      Feed: ${post.feed.title.substring(0, 50)}...`)
        console.log(`      Created: ${post.createdAt.toISOString()}`)
        if (post.errorMessage) {
          console.log(`      Error: ${post.errorMessage}`)
        }
      })
    }

    // 5. Check Queue
    console.log("\n📬 Step 5: Checking Redis Queue")
    try {
      const queueStats = await getQueueStats()
      console.log(`   Queued Jobs: ${queueStats.queued}`)
      console.log(`   Processing Jobs: ${queueStats.processing}`)

      if (queueStats.queued === 0 && approvedFeeds.length > 0) {
        console.log("\n⚠️  Issue Found: Approved feeds exist but queue is empty!")
        console.log("   When a feed is approved, it should be automatically added to the queue")
        console.log("   This suggests the approval process may not be queueing feeds properly")
      }

      if (queueStats.queued > 0) {
        console.log("\n   Next jobs in queue:")
        const nextJobs = await peekQueue(3)
        nextJobs.forEach((job, idx) => {
          console.log(`   ${idx + 1}. Feed ID: ${job.feedId}`)
          console.log(`      Approved by: ${job.approvedBy}`)
          console.log(`      Approved at: ${job.approvedAt}`)
        })
      }
    } catch (error) {
      console.log("⚠️  Could not check queue (Redis may not be connected)")
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // 6. Check ScheduledPosts
    console.log("\n📅 Step 6: Checking Scheduled Posts")
    const scheduledStats = await prisma.scheduledPost.groupBy({
      by: ['status', 'platform'],
      _count: true
    })

    if (scheduledStats.length === 0) {
      console.log("   ❌ No scheduled posts found!")
      console.log("   Even if posts are generated, they need to be scheduled for users")
    } else {
      console.log("   Scheduled Post Status:")
      scheduledStats.forEach(stat => {
        console.log(`   - ${stat.platform} ${stat.status}: ${stat._count}`)
      })
    }

    // Check recent scheduled posts
    const recentScheduled = await prisma.scheduledPost.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: {
        platform: true,
        status: true,
        scheduledFor: true,
        createdAt: true,
        user: {
          select: { email: true }
        }
      }
    })

    if (recentScheduled.length > 0) {
      console.log("\n   Recent Scheduled Posts:")
      recentScheduled.forEach((post, idx) => {
        console.log(`   ${idx + 1}. ${post.platform} - ${post.status}`)
        console.log(`      User: ${post.user.email}`)
        console.log(`      Scheduled for: ${post.scheduledFor.toISOString()}`)
      })
    }

    // 7. Check User Subscriptions
    console.log("\n👥 Step 7: Checking User Subscriptions")
    const userTopics = await prisma.userTopic.findMany({
      include: {
        user: {
          select: { email: true }
        },
        topic: {
          select: { name: true }
        }
      },
      take: 5
    })

    if (userTopics.length === 0) {
      console.log("   ⚠️  No user subscriptions found!")
      console.log("   Users need to subscribe to topics to receive posts")
    } else {
      console.log(`   ✅ Found ${userTopics.length} subscription(s)`)
      userTopics.forEach((sub, idx) => {
        console.log(`   ${idx + 1}. ${sub.user.email} -> ${sub.topic.name}`)
      })
    }

    // 8. Summary
    console.log("\n" + "=".repeat(60))
    console.log("📊 DIAGNOSIS SUMMARY")
    console.log("=".repeat(60))

    const issues: string[] = []
    const suggestions: string[] = []

    if (!GROQ_API_KEYS.length && !GROQ_API_KEY) {
      issues.push("❌ No GROQ API keys configured")
      suggestions.push("Set GROQ_API_KEYS in .env.local")
    }

    if (approvedFeeds.length === 0) {
      issues.push("❌ No approved feeds")
      suggestions.push("Go to /admin/feeds and approve some feeds")
    }

    if (approvedFeeds.length > 0) {
      try {
        const queueStats = await getQueueStats()
        if (queueStats.queued === 0) {
          issues.push("❌ Approved feeds not in queue")
          suggestions.push("Try re-approving a feed to trigger queueing")
        }
      } catch (error) {
        issues.push("⚠️  Cannot check queue (Redis issue)")
        suggestions.push("Check Redis connection: " + (error instanceof Error ? error.message : ''))
      }
    }

    if (genPostStats.length === 0 && approvedFeeds.length > 0) {
      issues.push("❌ No posts generated from approved feeds")
      suggestions.push("Run the process-queue cron job manually")
    }

    if (userTopics.length === 0) {
      issues.push("⚠️  No user subscriptions")
      suggestions.push("Users need to subscribe to topics at /feed")
    }

    if (issues.length === 0) {
      console.log("✅ No critical issues found!")
      console.log("   System appears to be working correctly")
    } else {
      console.log("\nIssues Found:")
      issues.forEach(issue => console.log(`   ${issue}`))
      console.log("\nSuggested Actions:")
      suggestions.forEach((s, idx) => console.log(`   ${idx + 1}. ${s}`))
    }

  } catch (error) {
    console.error("\n❌ Diagnostic script failed:")
    console.error(error)
  } finally {
    await prisma.$disconnect()
    await redis.quit()
  }
}

diagnose()
