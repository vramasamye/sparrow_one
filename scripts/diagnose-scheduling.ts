import { PrismaClient } from "@prisma/client"
import { redis } from "../src/lib/redis"

/**
 * Diagnose why posts aren't being scheduled
 */
async function diagnoseScheduling() {
  const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  })

  try {
    console.log("🔍 SCHEDULING DIAGNOSIS\n")

    // 1. Check queue
    console.log("1️⃣ Redis Queue Status:")
    const queueSize = await redis.zcard("queue:approved-feeds")
    const processingSize = await redis.scard("queue:processing-feeds")
    console.log(`   Queued: ${queueSize}`)
    console.log(`   Processing: ${processingSize}\n`)

    if (queueSize === 0 && processingSize === 0) {
      console.log("   ⚠️  Queue is empty!\n")
      return
    }

    // 2. Check generated posts status
    console.log("2️⃣ Generated Posts Status:")
    const generatedStats = await prisma.generatedPost.groupBy({
      by: ["status"],
      _count: true,
    })
    generatedStats.forEach((stat) => {
      console.log(`   ${stat.status}: ${stat._count}`)
    })
    console.log()

    // 3. Check last generation attempt
    console.log("3️⃣ Last Generation Attempt:")
    const lastGenerated = await prisma.generatedPost.findFirst({
      orderBy: { createdAt: "desc" },
      include: {
        feed: {
          select: {
            title: true,
            topicId: true,
            topic: { select: { name: true } },
          },
        },
      },
    })

    if (lastGenerated) {
      console.log(`   Feed: ${lastGenerated.feed.title}`)
      console.log(`   Topic: ${lastGenerated.feed.topic.name}`)
      console.log(`   Status: ${lastGenerated.status}`)
      console.log(`   Created: ${lastGenerated.createdAt.toISOString()}`)
      if (lastGenerated.errorMessage) {
        console.log(`   ❌ Error: ${lastGenerated.errorMessage}`)
      }
      console.log()

      // 4. Check if topic has subscribers
      console.log("4️⃣ Topic Subscription Check:")
      const subscribers = await prisma.userTopic.findMany({
        where: { topicId: lastGenerated.feed.topicId },
        include: {
          user: {
            select: {
              email: true,
              socialAccounts: {
                where: { isActive: true },
                select: { platform: true, isActive: true },
              },
            },
          },
        },
      })

      console.log(`   Topic: ${lastGenerated.feed.topic.name}`)
      console.log(`   Subscribers: ${subscribers.length}`)

      if (subscribers.length === 0) {
        console.log(`   ❌ NO SUBSCRIBERS! This is why posts aren't scheduled.\n`)
        console.log(`   💡 Solution: Subscribe users to this topic in the dashboard.\n`)
      } else {
        console.log(`\n   Subscriber Details:`)
        subscribers.forEach((sub) => {
          const platforms = sub.user.socialAccounts
            .map((sa) => sa.platform)
            .join(", ")
          console.log(`   - ${sub.user.email}`)
          console.log(`     Connected: ${platforms || "NONE"}`)

          if (sub.user.socialAccounts.length === 0) {
            console.log(`     ❌ NO SOCIAL ACCOUNTS CONNECTED`)
          }
        })
        console.log()
      }
    } else {
      console.log("   ⚠️  No generated posts found!\n")
    }

    // 5. Check all topics and their subscribers
    console.log("5️⃣ All Topics & Subscriptions:")
    const topics = await prisma.topic.findMany({
      include: {
        _count: {
          select: {
            userTopics: true,
            feeds: true,
          },
        },
      },
    })

    topics.forEach((topic) => {
      console.log(`   ${topic.name}:`)
      console.log(`     Subscribers: ${topic._count.userTopics}`)
      console.log(`     Feeds: ${topic._count.feeds}`)
      console.log(
        `     Twitter: ${topic.enableTwitter ? "✓" : "✗"}, LinkedIn: ${topic.enableLinkedin ? "✓" : "✗"}`
      )
    })
    console.log()

    // 6. Check users with social accounts
    console.log("6️⃣ Users with Social Accounts:")
    const usersWithAccounts = await prisma.user.findMany({
      include: {
        socialAccounts: {
          where: { isActive: true },
        },
        userTopics: {
          include: {
            topic: { select: { name: true } },
          },
        },
      },
    })

    usersWithAccounts.forEach((user) => {
      console.log(`   ${user.email}:`)
      console.log(
        `     Social Accounts: ${user.socialAccounts.map((sa) => sa.platform).join(", ") || "NONE"}`
      )
      console.log(
        `     Subscribed Topics: ${user.userTopics.map((ut) => ut.topic.name).join(", ") || "NONE"}`
      )
      console.log()
    })

    // 7. Summary and recommendations
    console.log("📊 DIAGNOSIS SUMMARY:\n")

    const totalUsers = usersWithAccounts.length
    const usersWithSocial = usersWithAccounts.filter(
      (u) => u.socialAccounts.length > 0
    ).length
    const usersWithSubscriptions = usersWithAccounts.filter(
      (u) => u.userTopics.length > 0
    ).length
    const usersFullySetup = usersWithAccounts.filter(
      (u) => u.socialAccounts.length > 0 && u.userTopics.length > 0
    ).length

    console.log(`Total Users: ${totalUsers}`)
    console.log(`Users with Social Accounts: ${usersWithSocial}`)
    console.log(`Users with Topic Subscriptions: ${usersWithSubscriptions}`)
    console.log(`Users Fully Setup (both): ${usersFullySetup}\n`)

    if (usersFullySetup === 0) {
      console.log("❌ PROBLEM FOUND!")
      console.log("   No users have BOTH social accounts AND topic subscriptions.")
      console.log("\n💡 SOLUTION:")
      console.log("   1. Users must connect Twitter/LinkedIn in Settings")
      console.log("   2. Users must subscribe to topics in Dashboard")
      console.log("   3. Only then will posts be scheduled for them\n")
    } else {
      console.log("✅ Users are properly configured.")
      console.log("   The issue might be in the distribution logic.\n")
    }
  } catch (error) {
    console.error("❌ Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

diagnoseScheduling()
