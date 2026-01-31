import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserPreferences } from "@/lib/natural-scheduler"

/**
 * GET /api/user/preferences
 * Get current user's scheduling preferences
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const preferences = await getUserPreferences(session.user.id)

    return NextResponse.json(preferences)
  } catch (error) {
    console.error("Error fetching preferences:", error)
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/user/preferences
 * Update current user's scheduling preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Validate timezone
    if (body.timezone) {
      try {
        // Basic validation - check if timezone string is valid
        Intl.DateTimeFormat(undefined, { timeZone: body.timezone })
      } catch (e) {
        return NextResponse.json(
          { error: "Invalid timezone" },
          { status: 400 }
        )
      }
    }

    // Validate posting times
    if (body.twitterTimes) {
      if (
        !Array.isArray(body.twitterTimes) ||
        body.twitterTimes.some((h: any) => typeof h !== "number" || h < 0 || h > 23)
      ) {
        return NextResponse.json(
          { error: "Invalid Twitter times. Must be array of hours (0-23)" },
          { status: 400 }
        )
      }
    }

    if (body.linkedinTimes) {
      if (
        !Array.isArray(body.linkedinTimes) ||
        body.linkedinTimes.some((h: any) => typeof h !== "number" || h < 0 || h > 23)
      ) {
        return NextResponse.json(
          { error: "Invalid LinkedIn times. Must be array of hours (0-23)" },
          { status: 400 }
        )
      }
    }

    // Validate postsPerWeek
    if (body.postsPerWeek !== undefined) {
      if (typeof body.postsPerWeek !== "number" || body.postsPerWeek < 1 || body.postsPerWeek > 14) {
        return NextResponse.json(
          { error: "Posts per week must be between 1 and 14" },
          { status: 400 }
        )
      }
    }

    // Validate activeDays
    if (body.activeDays) {
      if (
        !Array.isArray(body.activeDays) ||
        body.activeDays.some((d: any) => typeof d !== "number" || d < 0 || d > 6)
      ) {
        return NextResponse.json(
          { error: "Invalid active days. Must be array of days (0-6, 0=Sunday)" },
          { status: 400 }
        )
      }
    }

    // Validate quiet hours
    if (body.quietStart !== undefined) {
      if (body.quietStart !== null && (typeof body.quietStart !== "number" || body.quietStart < 0 || body.quietStart > 23)) {
        return NextResponse.json(
          { error: "Quiet start hour must be between 0 and 23, or null" },
          { status: 400 }
        )
      }
    }

    if (body.quietEnd !== undefined) {
      if (body.quietEnd !== null && (typeof body.quietEnd !== "number" || body.quietEnd < 0 || body.quietEnd > 23)) {
        return NextResponse.json(
          { error: "Quiet end hour must be between 0 and 23, or null" },
          { status: 400 }
        )
      }
    }

    // Update preferences
    const updated = await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      update: {
        ...(body.timezone && { timezone: body.timezone }),
        ...(body.twitterTimes && { twitterTimes: body.twitterTimes }),
        ...(body.linkedinTimes && { linkedinTimes: body.linkedinTimes }),
        ...(body.postsPerWeek !== undefined && { postsPerWeek: body.postsPerWeek }),
        ...(body.activeDays && { activeDays: body.activeDays }),
        ...(body.quietStart !== undefined && { quietStart: body.quietStart }),
        ...(body.quietEnd !== undefined && { quietEnd: body.quietEnd }),
      },
      create: {
        userId: session.user.id,
        timezone: body.timezone || "UTC",
        twitterTimes: body.twitterTimes || [8, 10, 12, 14, 17, 19],
        linkedinTimes: body.linkedinTimes || [9, 11, 13, 16, 18, 20],
        postsPerWeek: body.postsPerWeek || 7,
        activeDays: body.activeDays || [1, 2, 3, 4, 5],
        quietStart: body.quietStart,
        quietEnd: body.quietEnd,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating preferences:", error)
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    )
  }
}
