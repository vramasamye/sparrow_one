import { prisma } from "@/lib/prisma"
import { addHours, setHours, setMinutes, startOfDay } from "date-fns"

/**
 * Optimal posting times (hour in UTC)
 * Used for staggered distribution across subscribers
 */
const OPTIMAL_TIMES = {
  twitter: [9, 12, 15, 17, 19, 21], // 6 slots per day
  linkedin: [8, 10, 12, 14, 17, 19], // 6 slots per day
}

/**
 * Get next available posting slot for a user on a platform
 * Ensures no scheduling conflicts
 */
async function getNextPostingSlot(
  userId: string,
  platform: "TWITTER" | "LINKEDIN"
): Promise<Date> {
  const now = new Date()
  const today = startOfDay(now)
  const platformKey = platform.toLowerCase() as "twitter" | "linkedin"
  const optimalTimes = OPTIMAL_TIMES[platformKey]

  // Get existing scheduled posts for this user and platform
  const existingPosts = await prisma.scheduledPost.findMany({
    where: {
      userId,
      platform,
      scheduledFor: { gte: today },
      status: { in: ["SCHEDULED", "PUBLISHING"] },
    },
    select: { scheduledFor: true },
  })

  const scheduledHours = new Set(
    existingPosts.map((p) => new Date(p.scheduledFor).getUTCHours())
  )

  // Find next available optimal time today
  for (const hour of optimalTimes) {
    if (!scheduledHours.has(hour)) {
      const slotTime = setMinutes(setHours(today, hour), 0)
      if (slotTime > now) {
        return slotTime
      }
    }
  }

  // All today's slots taken, use first slot tomorrow
  const tomorrow = addHours(today, 24)
  return setMinutes(setHours(tomorrow, optimalTimes[0]), 0)
}

/**
 * Distribute generated posts to all subscribers of a topic
 * Uses staggered distribution (Option 2) - cycles through optimal times
 */
export async function distributeToSubscribers(feedId: string): Promise<{
  success: boolean
  usersScheduled: number
  twitterScheduled: number
  linkedinScheduled: number
  errors: string[]
}> {
  const errors: string[] = []
  let usersScheduled = 0
  let twitterScheduled = 0
  let linkedinScheduled = 0

  try {
    // 1. Get the feed and generated content
    const feed = await prisma.feed.findUnique({
      where: { id: feedId },
      include: {
        topic: true,
        generatedPosts: true
      }
    })

    if (!feed) {
      throw new Error(`Feed ${feedId} not found`)
    }

    const generatedPost = feed.generatedPosts[0]
    if (!generatedPost || generatedPost.status !== "COMPLETED") {
      throw new Error(`Feed ${feedId} does not have generated content`)
    }

    // 2. Get all users subscribed to this topic
    const subscribers = await prisma.userTopic.findMany({
      where: { topicId: feed.topicId },
      include: {
        user: {
          include: {
            socialAccounts: {
              where: { isActive: true }
            }
          }
        }
      }
    })

    if (subscribers.length === 0) {
      console.log(`⚠️  No subscribers for topic ${feed.topic.name}`)
      return {
        success: true,
        usersScheduled: 0,
        twitterScheduled: 0,
        linkedinScheduled: 0,
        errors: []
      }
    }

    console.log(`📢 Distributing to ${subscribers.length} subscribers...`)

    // 3. Update status to DISTRIBUTING
    await prisma.generatedPost.update({
      where: { id: generatedPost.id },
      data: { status: "DISTRIBUTING" }
    })

    // 4. Schedule posts for each subscriber
    for (const subscription of subscribers) {
      const user = subscription.user
      let userHasPosts = false

      // Get user's connected social accounts
      const twitterAccount = user.socialAccounts.find(sa => sa.platform === "TWITTER")
      const linkedinAccount = user.socialAccounts.find(sa => sa.platform === "LINKEDIN")

      // Schedule Twitter post if user has Twitter connected
      if (twitterAccount) {
        try {
          const scheduledFor = await getNextPostingSlot(user.id, "TWITTER")

          await prisma.scheduledPost.create({
            data: {
              userId: user.id,
              socialAccountId: twitterAccount.id,
              feedId: feed.id,
              platform: "TWITTER",
              content: generatedPost.twitterContent,
              scheduledFor,
              status: "SCHEDULED"
            }
          })

          twitterScheduled++
          userHasPosts = true
        } catch (error) {
          const msg = `Twitter scheduling failed for user ${user.email}: ${error instanceof Error ? error.message : "Unknown"}`
          errors.push(msg)
          console.error(`  ❌ ${msg}`)
        }
      }

      // Schedule LinkedIn post if user has LinkedIn connected
      if (linkedinAccount) {
        try {
          const scheduledFor = await getNextPostingSlot(user.id, "LINKEDIN")

          await prisma.scheduledPost.create({
            data: {
              userId: user.id,
              socialAccountId: linkedinAccount.id,
              feedId: feed.id,
              platform: "LINKEDIN",
              content: generatedPost.linkedinContent,
              scheduledFor,
              status: "SCHEDULED"
            }
          })

          linkedinScheduled++
          userHasPosts = true
        } catch (error) {
          const msg = `LinkedIn scheduling failed for user ${user.email}: ${error instanceof Error ? error.message : "Unknown"}`
          errors.push(msg)
          console.error(`  ❌ ${msg}`)
        }
      }

      if (userHasPosts) {
        usersScheduled++
      } else {
        const msg = `User ${user.email} has no connected social accounts`
        errors.push(msg)
        console.log(`  ⚠️  ${msg}`)
      }
    }

    // 5. Update status to DISTRIBUTED
    await prisma.generatedPost.update({
      where: { id: generatedPost.id },
      data: {
        status: "DISTRIBUTED",
        distributedAt: new Date()
      }
    })

    console.log(`✅ Distribution complete:`)
    console.log(`   Users: ${usersScheduled}/${subscribers.length}`)
    console.log(`   Twitter: ${twitterScheduled} posts`)
    console.log(`   LinkedIn: ${linkedinScheduled} posts`)

    return {
      success: true,
      usersScheduled,
      twitterScheduled,
      linkedinScheduled,
      errors
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error(`❌ Distribution failed for feed ${feedId}:`, errorMessage)

    // Update status to FAILED
    await prisma.generatedPost.updateMany({
      where: { feedId },
      data: {
        status: "FAILED",
        errorMessage
      }
    })

    return {
      success: false,
      usersScheduled,
      twitterScheduled,
      linkedinScheduled,
      errors: [...errors, errorMessage]
    }
  }
}

/**
 * Get distribution statistics for a feed
 */
export async function getDistributionStats(feedId: string) {
  const scheduledPosts = await prisma.scheduledPost.groupBy({
    by: ['platform', 'status'],
    where: { feedId },
    _count: true
  })

  return {
    feedId,
    breakdown: scheduledPosts.map(sp => ({
      platform: sp.platform,
      status: sp.status,
      count: sp._count
    }))
  }
}
