import { prisma } from "@/lib/prisma"
import { addHours, setHours, setMinutes, startOfDay } from "date-fns"
import { distributeNaturally } from "@/lib/natural-scheduler"

/**
 * Optimal posting times (hour in UTC)
 * Used for staggered distribution across subscribers
 */
const OPTIMAL_TIMES = {
  twitter: [9, 12, 15, 17, 19, 21], // 6 slots per day
  linkedin: [8, 10, 12, 14, 17, 19], // 6 slots per day
}

/**
 * Maximum posts per day per platform (strict limit)
 */
const MAX_POSTS_PER_DAY = 6

/**
 * Get next available posting slot for a user on a platform
 * Ensures no scheduling conflicts and enforces strict 6 posts per day limit
 */
async function getNextPostingSlot(
  userId: string,
  platform: "TWITTER" | "LINKEDIN"
): Promise<Date> {
  const now = new Date()
  const today = startOfDay(now)
  const platformKey = platform.toLowerCase() as "twitter" | "linkedin"
  const optimalTimes = OPTIMAL_TIMES[platformKey]
  const MAX_POSTS_PER_DAY = 6

  // Try to find an available slot, checking multiple days if needed
  for (let daysAhead = 0; daysAhead < 14; daysAhead++) {
    const targetDay = addHours(today, daysAhead * 24)
    const dayEnd = addHours(targetDay, 24)

    // Get existing scheduled posts for this specific day only
    const existingPosts = await prisma.scheduledPost.findMany({
      where: {
        userId,
        platform,
        scheduledFor: {
          gte: targetDay,
          lt: dayEnd, // Critical: only posts within this 24-hour period
        },
        status: { in: ["SCHEDULED", "PUBLISHING"] },
      },
      select: { scheduledFor: true },
    })

    // Enforce strict per-day limit
    if (existingPosts.length >= MAX_POSTS_PER_DAY) {
      continue // This day is full, try next day
    }

    // Build set of hours already taken on this specific day
    const scheduledHours = new Set(
      existingPosts.map((p) => new Date(p.scheduledFor).getUTCHours())
    )

    // Find next available optimal time for this day
    for (const hour of optimalTimes) {
      if (!scheduledHours.has(hour)) {
        const slotTime = setMinutes(setHours(targetDay, hour), 0)
        // Only return if slot is in the future
        if (slotTime > now) {
          return slotTime
        }
      }
    }
  }

  // Fallback: if no slot found in 14 days, schedule 15 days out
  const fallbackDay = addHours(today, 15 * 24)
  return setMinutes(setHours(fallbackDay, optimalTimes[0]), 0)
}

/**
 * Safely schedule a post with transaction protection against race conditions
 * Re-validates the slot availability within a transaction before inserting
 */
async function safelySchedulePost(
  userId: string,
  socialAccountId: string,
  feedId: string,
  platform: "TWITTER" | "LINKEDIN",
  content: string,
  scheduledFor: Date
): Promise<{ success: boolean; error?: string }> {
  try {
    // Use transaction with isolation to prevent race conditions
    await prisma.$transaction(async (tx) => {
      const dayStart = startOfDay(scheduledFor)
      const dayEnd = addHours(dayStart, 24)

      // Re-check the count within transaction to prevent race conditions
      const existingCount = await tx.scheduledPost.count({
        where: {
          userId,
          platform,
          scheduledFor: {
            gte: dayStart,
            lt: dayEnd,
          },
          status: { in: ["SCHEDULED", "PUBLISHING"] },
        },
      })

      // Enforce strict limit within transaction
      if (existingCount >= MAX_POSTS_PER_DAY) {
        throw new Error(`Daily limit of ${MAX_POSTS_PER_DAY} posts already reached for ${platform}`)
      }

      // Check if exact time slot is already taken
      const existingAtTime = await tx.scheduledPost.findFirst({
        where: {
          userId,
          platform,
          scheduledFor,
          status: { in: ["SCHEDULED", "PUBLISHING"] },
        },
      })

      if (existingAtTime) {
        throw new Error(`Time slot ${scheduledFor.toISOString()} already taken`)
      }

      // Safe to insert
      await tx.scheduledPost.create({
        data: {
          userId,
          socialAccountId,
          feedId,
          platform,
          content,
          scheduledFor,
          status: "SCHEDULED",
        },
      })
    })

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Distribute generated posts to all subscribers of a topic
 *
 * By default, uses natural scheduling with user preferences (timezone, personalized times)
 * Set USE_LEGACY_SCHEDULING=true in env to use old staggered UTC-based scheduling
 */
export async function distributeToSubscribers(feedId: string): Promise<{
  success: boolean
  usersScheduled: number
  twitterScheduled: number
  linkedinScheduled: number
  errors: string[]
}> {
  // Use natural scheduling by default (respects user timezone and preferences)
  const useLegacyScheduling = process.env.USE_LEGACY_SCHEDULING === "true"

  if (!useLegacyScheduling) {
    console.log("📅 Using natural scheduling (user preferences)")
    return await distributeNaturally(feedId)
  }

  // Legacy scheduling (for backward compatibility)
  console.log("📅 Using legacy scheduling (UTC-based)")
  return await distributeLegacy(feedId)
}

/**
 * Legacy distribution function
 * Uses staggered distribution with hardcoded UTC times (Option 2)
 * @deprecated Use distributeNaturally instead
 */
async function distributeLegacy(feedId: string): Promise<{
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
    // 1. Get the feed and generated content with topic platform config
    const feed = await prisma.feed.findUnique({
      where: { id: feedId },
      include: {
        topic: {
          select: {
            id: true,
            name: true,
            enableTwitter: true,
            enableLinkedin: true,
          }
        },
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
    console.log(`   Platforms: ${feed.topic.enableTwitter ? '🐦 Twitter' : ''} ${feed.topic.enableLinkedin ? '💼 LinkedIn' : ''}`)

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

      // Schedule Twitter post if enabled for topic and user has Twitter connected
      if (feed.topic.enableTwitter && twitterAccount && generatedPost.twitterContent) {
        try {
          const scheduledFor = await getNextPostingSlot(user.id, "TWITTER")

          const result = await safelySchedulePost(
            user.id,
            twitterAccount.id,
            feed.id,
            "TWITTER",
            generatedPost.twitterContent,
            scheduledFor
          )

          if (result.success) {
            twitterScheduled++
            userHasPosts = true
          } else {
            throw new Error(result.error || "Failed to schedule post")
          }
        } catch (error) {
          const msg = `Twitter scheduling failed for user ${user.email}: ${error instanceof Error ? error.message : "Unknown"}`
          errors.push(msg)
          console.error(`  ❌ ${msg}`)
        }
      } else if (!feed.topic.enableTwitter && twitterAccount) {
        console.log(`  ⏭️  Skipping Twitter for ${user.email} (topic disabled)`)
      }

      // Schedule LinkedIn post if enabled for topic and user has LinkedIn connected
      if (feed.topic.enableLinkedin && linkedinAccount && generatedPost.linkedinContent) {
        try {
          const scheduledFor = await getNextPostingSlot(user.id, "LINKEDIN")

          const result = await safelySchedulePost(
            user.id,
            linkedinAccount.id,
            feed.id,
            "LINKEDIN",
            generatedPost.linkedinContent,
            scheduledFor
          )

          if (result.success) {
            linkedinScheduled++
            userHasPosts = true
          } else {
            throw new Error(result.error || "Failed to schedule post")
          }
        } catch (error) {
          const msg = `LinkedIn scheduling failed for user ${user.email}: ${error instanceof Error ? error.message : "Unknown"}`
          errors.push(msg)
          console.error(`  ❌ ${msg}`)
        }
      } else if (!feed.topic.enableLinkedin && linkedinAccount) {
        console.log(`  ⏭️  Skipping LinkedIn for ${user.email} (topic disabled)`)
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
