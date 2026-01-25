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
 * Get the next available posting slot for a user on a platform
 */
async function getNextPostingSlot(
  userId: string,
  platform: "TWITTER" | "LINKEDIN"
): Promise<Date> {
  const now = new Date()
  const today = startOfDay(now)
  const platformKey = platform.toLowerCase() as "twitter" | "linkedin"
  const optimalTimes = OPTIMAL_TIMES[platformKey]

  // Get today's scheduled posts for this user and platform
  const todaysPosts = await prisma.scheduledPost.findMany({
    where: {
      userId,
      platform,
      scheduledFor: {
        gte: today,
        lt: addHours(today, 24),
      },
      status: { in: ["SCHEDULED", "PUBLISHING"] },
    },
    select: { scheduledFor: true },
  })

  const scheduledHours = new Set(
    todaysPosts.map((p) => new Date(p.scheduledFor).getUTCHours())
  )

  // Find the next available optimal time today
  for (const hour of optimalTimes) {
    if (!scheduledHours.has(hour)) {
      const slotTime = setMinutes(setHours(today, hour), 0)
      if (slotTime > now) {
        return slotTime
      }
    }
  }

  // If all today's slots are taken, find first slot tomorrow
  const tomorrow = addHours(today, 24)
  const tomorrowsFirstSlot = setMinutes(setHours(tomorrow, optimalTimes[0]), 0)
  return tomorrowsFirstSlot
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

    // Create the scheduled post
    const post = await prisma.scheduledPost.create({
      data: {
        userId: session.user.id,
        socialAccountId: socialAccount.id,
        feedId,
        platform: platformEnum,
        content,
        scheduledFor: scheduleTime,
        status: "SCHEDULED",
      },
    })

    return NextResponse.json({
      success: true,
      post: {
        id: post.id,
        scheduledFor: post.scheduledFor,
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
