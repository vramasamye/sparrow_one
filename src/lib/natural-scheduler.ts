import { prisma } from "@/lib/prisma"
import { addDays, addHours, setHours, setMinutes, startOfDay, format, getDay } from "date-fns"
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
  const preferredTimes =
    platformKey === "twitter" ? preferences.twitterTimes : preferences.linkedinTimes

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
    if (!isActiveDay(candidateDay, preferences.activeDays)) {
      continue
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
    // 1. Get the feed and generated content
    const feed = await prisma.feed.findUnique({
      where: { id: feedId },
      include: {
        topic: true,
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

      // Schedule Twitter post if user has Twitter connected
      if (twitterAccount) {
        try {
          const scheduledFor = await getNextNaturalSlot(user.id, "TWITTER")

          await prisma.scheduledPost.create({
            data: {
              userId: user.id,
              socialAccountId: twitterAccount.id,
              feedId: feed.id,
              platform: "TWITTER",
              content: generatedPost.twitterContent,
              scheduledFor,
              status: "SCHEDULED",
            },
          })

          twitterScheduled++
          userHasPosts = true

          // Log in user's timezone for debugging
          const prefs = await getUserPreferences(user.id)
          const userTime = toZonedTime(scheduledFor, prefs.timezone)
          console.log(
            `  🐦 ${user.email}: ${format(userTime, "MMM dd, HH:mm")} ${prefs.timezone}`
          )
        } catch (error) {
          const msg = `Twitter scheduling failed for user ${user.email}: ${error instanceof Error ? error.message : "Unknown"}`
          errors.push(msg)
          console.error(`  ❌ ${msg}`)
        }
      }

      // Schedule LinkedIn post if user has LinkedIn connected
      if (linkedinAccount) {
        try {
          const scheduledFor = await getNextNaturalSlot(user.id, "LINKEDIN")

          await prisma.scheduledPost.create({
            data: {
              userId: user.id,
              socialAccountId: linkedinAccount.id,
              feedId: feed.id,
              platform: "LINKEDIN",
              content: generatedPost.linkedinContent,
              scheduledFor,
              status: "SCHEDULED",
            },
          })

          linkedinScheduled++
          userHasPosts = true

          // Log in user's timezone for debugging
          const prefs = await getUserPreferences(user.id)
          const userTime = toZonedTime(scheduledFor, prefs.timezone)
          console.log(
            `  💼 ${user.email}: ${format(userTime, "MMM dd, HH:mm")} ${prefs.timezone}`
          )
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
