import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * Get all topics with their RSS feeds
 */
export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })

  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const topics = await prisma.topic.findMany({
      include: {
        rssFeeds: {
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            rssFeeds: true,
            feeds: true,
          },
        },
      },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ topics })
  } catch (error) {
    console.error("Failed to fetch topics:", error)
    return NextResponse.json(
      { error: "Failed to fetch topics" },
      { status: 500 }
    )
  }
}

/**
 * Create a new topic
 */
export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })

  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { name, description } = body

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      )
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")

    const topic = await prisma.topic.create({
      data: {
        name,
        slug,
        description: description || null,
      },
      include: {
        _count: {
          select: {
            rssFeeds: true,
            feeds: true,
          },
        },
      },
    })

    return NextResponse.json({ topic }, { status: 201 })
  } catch (error) {
    console.error("Failed to create topic:", error)

    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Topic with this name already exists" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Failed to create topic" },
      { status: 500 }
    )
  }
}
