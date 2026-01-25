import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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
