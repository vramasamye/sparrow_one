import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "12")
    const topicId = searchParams.get("topic")

    // Get user's followed topics
    const userTopics = await prisma.userTopic.findMany({
      where: { userId: session.user.id },
      select: { topicId: true },
    })

    const topicIds = userTopics.map((ut) => ut.topicId)

    if (topicIds.length === 0) {
      return NextResponse.json({ feeds: [], hasMore: false })
    }

    // Build where clause
    const whereClause = {
      status: "APPROVED" as const,
      topicId: topicId ? topicId : { in: topicIds },
    }

    // Fetch feeds
    const [feeds, totalCount] = await Promise.all([
      prisma.feed.findMany({
        where: whereClause,
        include: {
          topic: {
            select: { name: true, slug: true },
          },
          rssFeed: {
            select: { name: true },
          },
          scheduledPosts: {
            where: {
              userId: session.user.id,
              status: { in: ["SCHEDULED", "PUBLISHING", "PUBLISHED"] }
            },
            select: {
              id: true,
              platform: true,
              scheduledFor: true,
              status: true
            }
          }
        },
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.feed.count({ where: whereClause }),
    ])

    return NextResponse.json({
      feeds,
      hasMore: page * limit < totalCount,
      total: totalCount,
    })
  } catch (error) {
    console.error("Error fetching user feeds:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
