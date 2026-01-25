import { NextRequest, NextResponse } from "next/server"
import { ScheduledPostStatus } from "@prisma/client"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get("status")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")

    const whereClause: { userId: string; status?: ScheduledPostStatus } = {
      userId: session.user.id,
    }

    if (status && status !== "all" && Object.values(ScheduledPostStatus).includes(status as ScheduledPostStatus)) {
      whereClause.status = status as ScheduledPostStatus
    }

    const [posts, totalCount] = await Promise.all([
      prisma.scheduledPost.findMany({
        where: whereClause,
        include: {
          feed: {
            select: {
              title: true,
              url: true,
            },
          },
        },
        orderBy: [
          { status: "asc" },
          { scheduledFor: "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.scheduledPost.count({ where: whereClause }),
    ])

    return NextResponse.json({
      posts,
      hasMore: page * limit < totalCount,
      total: totalCount,
    })
  } catch (error) {
    console.error("Error fetching posts:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
