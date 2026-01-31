import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { previewSchedule } from "@/lib/natural-scheduler"

/**
 * GET /api/user/preferences/preview
 * Preview upcoming posts for the next 7 days in user's timezone
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get("days") || "7")

    if (days < 1 || days > 30) {
      return NextResponse.json(
        { error: "Days must be between 1 and 30" },
        { status: 400 }
      )
    }

    const preview = await previewSchedule(session.user.id, days)

    return NextResponse.json(preview)
  } catch (error) {
    console.error("Error generating preview:", error)
    return NextResponse.json(
      { error: "Failed to generate preview" },
      { status: 500 }
    )
  }
}
