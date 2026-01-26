import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * Create a new RSS feed for a topic
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
    const { name, url, topicId, isActive = true } = body

    if (!name || !url || !topicId) {
      return NextResponse.json(
        { error: "Name, URL, and topicId are required" },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      )
    }

    // Check if topic exists
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
    })

    if (!topic) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 })
    }

    const rssFeed = await prisma.rssFeed.create({
      data: {
        name,
        url,
        topicId,
        isActive,
      },
      include: {
        topic: true,
      },
    })

    return NextResponse.json({ rssFeed }, { status: 201 })
  } catch (error) {
    console.error("Failed to create RSS feed:", error)

    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "RSS feed with this URL already exists" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Failed to create RSS feed" },
      { status: 500 }
    )
  }
}
