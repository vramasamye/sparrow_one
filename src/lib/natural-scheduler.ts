import { prisma } from "@/lib/prisma"
import { addDays, addHours, setHours, setMinutes, startOfDay, format, getDay, startOfWeek as dateStartOfWeek } from "date-fns"
import { toZonedTime, fromZonedTime } from "date-fns-tz"

/**
 * Default posting times if user hasn't set preferences
 */
const DEFAULT_PREFERENCES = {
  timezone: "UTC",
  twitterTimes: [8, 10, 12, 14, 17, 19],
  linkedinTimes: [9, 11, 13, 16, 18, 20],
  postsPerWeek: 7,
  activeDays: [1, 2, 3, 4, 5], // Monday-Friday
  quietStart: null,
  quietEnd: null,
}

/**
 * Maximum posts per day per platform (strict limit)
 */
const MAX_POSTS_PER_DAY = 6

/**
 * Get user's scheduling preferences
 */
export async function getUserPreferences(userId: string) {
  const preferences = await prisma.userPreferences.findUnique({
    where: { userId },
  })

  if (!preferences) {
    // Create default preferences
    return await prisma.userPreferences.create({
      data: {
        userId,
        ...DEFAULT_PREFERENCES,
      },
    })
  }

  return {
    ...preferences,
    twitterTimes: preferences.twitterTimes as number[],
    linkedinTimes: preferences.linkedinTimes as number[],
    activeDays: preferences.activeDays as number[],
  }
}

/**
 * Check if a time is within quiet hours
 */
function isWithinQuietHours(
  hour: number,
  quietStart: number | null,
  quietEnd: number | null
): boolean {
  if (quietStart === null || quietEnd === null) {
    return false
  }

  // Handle quiet hours that cross midnight
  if (quietStart > quietEnd) {
    return hour >= quietStart || hour < quietEnd
  }

  return hour >= quietStart && hour < quietEnd
}

/**
 * Check if a day is an active posting day
 */
function isActiveDay(date: Date, activeDays: number[]): boolean {
  const dayOfWeek = getDay(date) // 0=Sunday, 6=Saturday
  return activeDays.includes(dayOfWeek)
}

/**
 * Count posts scheduled for the current week
 */
async function getPostsThisWeek(
  userId: string,
  platform: "TWITTER" | "LINKEDIN"
): Promise<number> {
  const now = new Date()
  const startOfWeek = startOfDay(now)
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()) // Sunday

  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(endOfWeek.getDate() + 7) // Next Sunday

  const count = await prisma.scheduledPost.count({
    where: {
      userId,
      platform,
      scheduledFor: {
        gte: startOfWeek,
        lt: endOfWeek,
      },
      status: { in: ["SCHEDULED", "PUBLISHING", "PUBLISHED"] },
    },
  })

  return count
}

/**
 * Get next natural posting slot for a user on a platform
 * Respects user's timezone, preferred times, active days, and quiet hours
 */
export async function getNextNaturalSlot(
  userId: string,
  platform: "TWITTER" | "LINKEDIN"
): Promise<Date> {
  const preferences = await getUserPreferences(userId)
  const platformKey = platform.toLowerCase() as "twitter" | "linkedin"
  const preferredTimes: number[] = (platformKey === "twitter"
    ? preferences.twitterTimes
    : preferences.linkedinTimes) as number[]

  // Get current time in user's timezone
  const now = new Date()
  const userNow = toZonedTime(now, preferences.timezone)
  const todayInUserTz = startOfDay(userNow)

  // Check posts per week limit
  const postsThisWeek = await getPostsThisWeek(userId, platform)
  if (postsThisWeek >= preferences.postsPerWeek) {
    // Hit weekly limit, schedule for next week
    const nextWeek = addDays(todayInUserTz, 7)
    const nextSlot = setMinutes(setHours(nextWeek, preferredTimes[0]), 0)
    // Convert back to UTC
    return fromZonedTime(nextSlot, preferences.timezone)
  }

  // Get existing scheduled posts for this user and platform
  const existingPosts = await prisma.scheduledPost.findMany({
    where: {
      userId,
      platform,
      scheduledFor: { gte: now },
      status: { in: ["SCHEDULED", "PUBLISHING"] },
    },
    select: { scheduledFor: true },
  })

  // Convert existing posts to user's timezone and extract hours
  const scheduledSlots = new Map<string, Set<number>>()
  for (const post of existingPosts) {
    const postInUserTz = toZonedTime(post.scheduledFor, preferences.timezone)
    const dateKey = format(postInUserTz, "yyyy-MM-dd")
    if (!scheduledSlots.has(dateKey)) {
      scheduledSlots.set(dateKey, new Set())
    }
    scheduledSlots.get(dateKey)!.add(postInUserTz.getHours())
  }

  // Try to find an available slot starting from today
  for (let daysAhead = 0; daysAhead < 14; daysAhead++) {
    const candidateDay = addDays(todayInUserTz, daysAhead)
    const dateKey = format(candidateDay, "yyyy-MM-dd")
    const currentHour = daysAhead === 0 ? userNow.getHours() : 0

    // Check if this is an active day
    if (!isActiveDay(candidateDay, preferences.activeDays as number[])) {
      continue
    }

    // Enforce strict per-day limit (6 posts maximum per day per platform)
    const postsOnThisDay = scheduledSlots.get(dateKey)?.size || 0
    if (postsOnThisDay >= MAX_POSTS_PER_DAY) {
      continue // This day is full, try next day
    }

    // Try each preferred time slot
    for (const hour of preferredTimes) {
      // Skip if slot is in the past today
      if (daysAhead === 0 && hour <= currentHour) {
        continue
      }

      // Check if slot is already scheduled
      if (scheduledSlots.get(dateKey)?.has(hour)) {
        continue
      }

      // Check quiet hours
      if (isWithinQuietHours(hour, preferences.quietStart, preferences.quietEnd)) {
        continue
      }

      // Found an available slot!
      const slotInUserTz = setMinutes(setHours(candidateDay, hour), 0)

      // Convert to UTC for storage
      return fromZonedTime(slotInUserTz, preferences.timezone)
    }
  }

  // Fallback: If no slot found in 14 days, use first slot 2 weeks from now
  const fallbackDay = addDays(todayInUserTz, 14)
  const fallbackSlot = setMinutes(setHours(fallbackDay, preferredTimes[0]), 0)
  return fromZonedTime(fallbackSlot, preferences.timezone)
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
  scheduledFor: Date,
  timezone: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Use transaction with isolation to prevent race conditions
    await prisma.$transaction(async (tx) => {
      // Convert to user's timezone for day boundary check
      const scheduledInUserTz = toZonedTime(scheduledFor, timezone)
      const dayStartInUserTz = startOfDay(scheduledInUserTz)
      const dayEndInUserTz = addDays(dayStartInUserTz, 1)

      // Convert back to UTC for database query
      const dayStartUTC = fromZonedTime(dayStartInUserTz, timezone)
      const dayEndUTC = fromZonedTime(dayEndInUserTz, timezone)

      // Re-check the count within transaction to prevent race conditions
      const existingCount = await tx.scheduledPost.count({
        where: {
          userId,
          platform,
          scheduledFor: {
            gte: dayStartUTC,
            lt: dayEndUTC,
          },
          status: { in: ["SCHEDULED", "PUBLISHING"] },
        },
      })

      // Enforce strict limit within transaction
      if (existingCount >= MAX_POSTS_PER_DAY) {
        throw new Error(`Daily limit of ${MAX_POSTS_PER_DAY} posts already reached for ${platform}`)
      }

      // Check if exact time slot is already taken (within 1 minute tolerance)
      const oneMinuteBefore = new Date(scheduledFor.getTime() - 60000)
      const oneMinuteAfter = new Date(scheduledFor.getTime() + 60000)

      const existingAtTime = await tx.scheduledPost.findFirst({
        where: {
          userId,
          platform,
          scheduledFor: {
            gte: oneMinuteBefore,
            lte: oneMinuteAfter,
          },
          status: { in: ["SCHEDULED", "PUBLISHING"] },
        },
      })

      if (existingAtTime) {
        throw new Error(`Time slot ${format(scheduledInUserTz, "MMM dd, HH:mm")} already taken`)
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
 * Distribute generated posts to all subscribers using natural scheduling
 * Each user gets posts scheduled according to their personal preferences
 */
export async function distributeNaturally(feedId: string): Promise<{
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
        generatedPosts: true,
      },
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
              where: { isActive: true },
            },
            preferences: true,
          },
        },
      },
    })

    if (subscribers.length === 0) {
      console.log(`⚠️  No subscribers for topic ${feed.topic.name}`)
      return {
        success: true,
        usersScheduled: 0,
        twitterScheduled: 0,
        linkedinScheduled: 0,
        errors: [],
      }
    }

    console.log(`📢 Distributing naturally to ${subscribers.length} subscribers...`)
    console.log(`   Platforms: ${feed.topic.enableTwitter ? '🐦 Twitter' : ''} ${feed.topic.enableLinkedin ? '💼 LinkedIn' : ''}`)

    // 3. Update status to DISTRIBUTING
    await prisma.generatedPost.update({
      where: { id: generatedPost.id },
      data: { status: "DISTRIBUTING" },
    })

    // 4. Schedule posts for each subscriber with their natural times
    for (const subscription of subscribers) {
      const user = subscription.user
      let userHasPosts = false

      // Ensure user has preferences (create if not exists)
      if (!user.preferences) {
        await getUserPreferences(user.id)
      }

      // Get user's connected social accounts
      const twitterAccount = user.socialAccounts.find((sa) => sa.platform === "TWITTER")
      const linkedinAccount = user.socialAccounts.find((sa) => sa.platform === "LINKEDIN")

      // Schedule Twitter post if enabled for topic and user has Twitter connected
      if (feed.topic.enableTwitter && twitterAccount && generatedPost.twitterContent) {
        try {
          const scheduledFor = await getNextNaturalSlot(user.id, "TWITTER")
          const prefs = await getUserPreferences(user.id)

          const result = await safelySchedulePost(
            user.id,
            twitterAccount.id,
            feed.id,
            "TWITTER",
            generatedPost.twitterContent,
            scheduledFor,
            prefs.timezone
          )

          if (result.success) {
            twitterScheduled++
            userHasPosts = true

            // Log in user's timezone for debugging
            const userTime = toZonedTime(scheduledFor, prefs.timezone)
            console.log(
              `  🐦 ${user.email}: ${format(userTime, "MMM dd, HH:mm")} ${prefs.timezone}`
            )
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
          const scheduledFor = await getNextNaturalSlot(user.id, "LINKEDIN")
          const prefs = await getUserPreferences(user.id)

          const result = await safelySchedulePost(
            user.id,
            linkedinAccount.id,
            feed.id,
            "LINKEDIN",
            generatedPost.linkedinContent,
            scheduledFor,
            prefs.timezone
          )

          if (result.success) {
            linkedinScheduled++
            userHasPosts = true

            // Log in user's timezone for debugging
            const userTime = toZonedTime(scheduledFor, prefs.timezone)
            console.log(
              `  💼 ${user.email}: ${format(userTime, "MMM dd, HH:mm")} ${prefs.timezone}`
            )
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
        distributedAt: new Date(),
      },
    })

    console.log(`✅ Natural distribution complete:`)
    console.log(`   Users: ${usersScheduled}/${subscribers.length}`)
    console.log(`   Twitter: ${twitterScheduled} posts (personalized times)`)
    console.log(`   LinkedIn: ${linkedinScheduled} posts (personalized times)`)

    return {
      success: true,
      usersScheduled,
      twitterScheduled,
      linkedinScheduled,
      errors,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error(`❌ Natural distribution failed for feed ${feedId}:`, errorMessage)

    // Update status to FAILED
    await prisma.generatedPost.updateMany({
      where: { feedId },
      data: {
        status: "FAILED",
        errorMessage,
      },
    })

    return {
      success: false,
      usersScheduled,
      twitterScheduled,
      linkedinScheduled,
      errors: [...errors, errorMessage],
    }
  }
}

/**
 * Preview upcoming posts for a user
 * Shows next 7 days of scheduled posts in their timezone
 */
export async function previewSchedule(
  userId: string,
  days: number = 7
): Promise<
  {
    date: string
    dayName: string
    posts: {
      time: string
      platform: "TWITTER" | "LINKEDIN"
      content: string
    }[]
  }[]
> {
  const preferences = await getUserPreferences(userId)
  const now = new Date()
  const userNow = toZonedTime(now, preferences.timezone)

  const preview = []

  for (let i = 0; i < days; i++) {
    const date = addDays(startOfDay(userNow), i)
    const dateKey = format(date, "yyyy-MM-dd")
    const dayName = format(date, "EEEE, MMM d")

    // Get scheduled posts for this day
    const startOfDayUTC = fromZonedTime(date, preferences.timezone)
    const endOfDayUTC = fromZonedTime(addDays(date, 1), preferences.timezone)

    const posts = await prisma.scheduledPost.findMany({
      where: {
        userId,
        scheduledFor: {
          gte: startOfDayUTC,
          lt: endOfDayUTC,
        },
        status: { in: ["SCHEDULED", "PUBLISHING"] },
      },
      select: {
        scheduledFor: true,
        platform: true,
        content: true,
      },
      orderBy: { scheduledFor: "asc" },
    })

    preview.push({
      date: dateKey,
      dayName,
      posts: posts.map((post) => {
        const postInUserTz = toZonedTime(post.scheduledFor, preferences.timezone)
        return {
          time: format(postInUserTz, "HH:mm"),
          platform: post.platform,
          content: post.content.substring(0, 60) + (post.content.length > 60 ? "..." : ""),
        }
      }),
    })
  }

  return preview
}
