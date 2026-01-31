import { NextRequest, NextResponse } from "next/server"
import { addHours, setHours, setMinutes, startOfDay } from "date-fns"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const scheduleSchema = z.object({
  feedId: z.string(),
  platform: z.enum(["twitter", "linkedin"]),
  content: z.string().min(1),
  scheduledFor: z.string().datetime().optional(),
})

// Optimal posting times (hour in UTC)
const OPTIMAL_TIMES = {
  twitter: [9, 12, 15, 17, 19, 21], // 6 posts per day
  linkedin: [8, 10, 12, 14, 17, 19], // 6 posts per day
}

/**
 * Maximum posts per day per platform (strict limit)
 */
const MAX_POSTS_PER_DAY = 6

/**
 * Get the next available posting slot for a user on a platform
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
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    // Use transaction with isolation to prevent race conditions
    const post = await prisma.$transaction(async (tx) => {
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
      return await tx.scheduledPost.create({
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

    return { success: true, postId: post.id }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { feedId, platform, content, scheduledFor } = scheduleSchema.parse(body)

    const platformEnum = platform.toUpperCase() as "TWITTER" | "LINKEDIN"

    // Check if user has a connected social account for this platform
    const socialAccount = await prisma.socialAccount.findFirst({
      where: {
        userId: session.user.id,
        platform: platformEnum,
        isActive: true,
      },
    })

    if (!socialAccount) {
      return NextResponse.json(
        { error: `Please connect your ${platform} account first` },
        { status: 400 }
      )
    }

    // Determine scheduling time
    let scheduleTime: Date
    if (scheduledFor) {
      scheduleTime = new Date(scheduledFor)
    } else {
      scheduleTime = await getNextPostingSlot(session.user.id, platformEnum)
    }

    // Create the scheduled post with transaction protection
    const result = await safelySchedulePost(
      session.user.id,
      socialAccount.id,
      feedId,
      platformEnum,
      content,
      scheduleTime
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to schedule post" },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      post: {
        id: result.postId,
        scheduledFor: scheduleTime,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }
    console.error("Error scheduling post:", error)
    return NextResponse.json({ error: "Failed to schedule post" }, { status: 500 })
  }
}
