import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const topics = await prisma.topic.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { rssFeeds: true },
        },
        userTopics: {
          where: { userId: session.user.id },
          select: { id: true },
        },
      },
      orderBy: { name: "asc" },
    })

    const topicsWithFollowing = topics.map((topic) => ({
      id: topic.id,
      name: topic.name,
      slug: topic.slug,
      description: topic.description,
      icon: topic.icon,
      _count: topic._count,
      isFollowing: topic.userTopics.length > 0,
    }))

    return NextResponse.json(topicsWithFollowing)
  } catch (error) {
    console.error("Error fetching topics:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
