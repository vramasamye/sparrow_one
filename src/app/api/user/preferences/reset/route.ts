import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * POST /api/user/preferences/reset
 * Reset user's preferences to defaults
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Reset to defaults
    const reset = await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      update: {
        timezone: "UTC",
        twitterTimes: [8, 10, 12, 14, 17, 19],
        linkedinTimes: [9, 11, 13, 16, 18, 20],
        postsPerWeek: 7,
        activeDays: [1, 2, 3, 4, 5], // Mon-Fri
        quietStart: null,
        quietEnd: null,
      },
      create: {
        userId: session.user.id,
        timezone: "UTC",
        twitterTimes: [8, 10, 12, 14, 17, 19],
        linkedinTimes: [9, 11, 13, 16, 18, 20],
        postsPerWeek: 7,
        activeDays: [1, 2, 3, 4, 5],
      },
    })

    return NextResponse.json(reset)
  } catch (error) {
    console.error("Error resetting preferences:", error)
    return NextResponse.json(
      { error: "Failed to reset preferences" },
      { status: 500 }
    )
  }
}
