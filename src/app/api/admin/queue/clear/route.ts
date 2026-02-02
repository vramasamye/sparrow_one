import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { clearQueue } from "@/lib/queue"

/**
 * POST /api/admin/queue/clear
 * Clear entire queue (admin only, use with caution)
 */
export async function POST() {
  try {
    // Check authentication and admin role
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 })
    }

    // Clear queue
    await clearQueue()

    console.log(`Admin cleared queue`)

    return NextResponse.json({
      success: true,
      message: "Queue cleared successfully",
    })
  } catch (error) {
    console.error("Failed to clear queue:", error)
    return NextResponse.json(
      { error: "Failed to clear queue" },
      { status: 500 }
    )
  }
}
