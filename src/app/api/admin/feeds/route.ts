import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { enqueueApprovedFeed } from "@/lib/queue"

export async function GET(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status") || "PENDING"
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "20")
  const skip = (page - 1) * limit

  try {
    // 24-hour filter: Only show PENDING feeds from last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const whereClause: any = {
      status: status as "PENDING" | "APPROVED" | "REJECTED" | "PUBLISHED",
    }

    // Apply 24h filter only for PENDING feeds
    if (status === "PENDING") {
      whereClause.createdAt = {
        gte: twentyFourHoursAgo
      }
    }

    const [feeds, total] = await Promise.all([
      prisma.feed.findMany({
        where: whereClause,
        include: {
          topic: true,
          rssFeed: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      prisma.feed.count({
        where: whereClause,
      }),
    ])

    return NextResponse.json({
      feeds,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching feeds:", error)
    return NextResponse.json(
      { error: "Failed to fetch feeds" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { feedIds, action } = body

    if (!Array.isArray(feedIds) || feedIds.length === 0) {
      return NextResponse.json(
        { error: "No feed IDs provided" },
        { status: 400 }
      )
    }

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Use 'approve' or 'reject'" },
        { status: 400 }
      )
    }

    if (action === "approve") {
      // 1. Update all to APPROVED
      await prisma.feed.updateMany({
        where: { id: { in: feedIds } },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
          approvedBy: session.user.id,
          rejectionReason: null,
        },
      })

      // 2. Enqueue each feed individually (queue requires feedId)
      // We do this concurrently but without waiting for all to finish if we want to be fast,
      // but waiting ensures we catch queue errors.
      const queuePromises = feedIds.map(async (id) => {
        try {
          await enqueueApprovedFeed(id, session.user.id!)
          console.log(`✅ Bulk approved: Feed ${id} queued`)
        } catch (error) {
          console.error(`❌ Failed to enqueue feed ${id}:`, error)
        }
      })
      await Promise.all(queuePromises)

    } else {
      // Reject all
      await prisma.feed.updateMany({
        where: { id: { in: feedIds } },
        data: {
          status: "REJECTED",
          rejectionReason: "Bulk rejection by admin",
        },
      })
    }

    return NextResponse.json({ success: true, count: feedIds.length })
  } catch (error) {
    console.error("Error updating feeds:", error)
    return NextResponse.json(
      { error: "Failed to update feeds" },
      { status: 500 }
    )
  }
}
