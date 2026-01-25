import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { enqueueApprovedFeed } from "@/lib/queue"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const body = await request.json()
    const { action, rejectionReason } = body

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Use 'approve' or 'reject'" },
        { status: 400 }
      )
    }

    const updateData =
      action === "approve"
        ? {
            status: "APPROVED" as const,
            approvedAt: new Date(),
            approvedBy: session.user.id,
            rejectionReason: null,
          }
        : {
            status: "REJECTED" as const,
            rejectionReason: rejectionReason || "No reason provided",
          }

    const feed = await prisma.feed.update({
      where: { id },
      data: updateData,
      include: {
        topic: true,
        rssFeed: true,
      },
    })

    // If approved, enqueue for auto-generation and distribution
    if (action === "approve") {
      try {
        await enqueueApprovedFeed(feed.id, session.user.id)
        console.log(`✅ Feed ${feed.id} queued for auto-generation`)
      } catch (error) {
        console.error(`❌ Failed to enqueue feed ${feed.id}:`, error)
        // Don't fail the approval if queueing fails
      }
    }

    return NextResponse.json({ feed })
  } catch (error) {
    console.error("Error updating feed:", error)
    return NextResponse.json(
      { error: "Failed to update feed" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    await prisma.feed.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting feed:", error)
    return NextResponse.json(
      { error: "Failed to delete feed" },
      { status: 500 }
    )
  }
}
