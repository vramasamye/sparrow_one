import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * Delete a topic
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const { id } = params

    // Check if topic has RSS feeds or content
    const topic = await prisma.topic.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            rssFeeds: true,
            feeds: true,
          },
        },
      },
    })

    if (!topic) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 })
    }

    if (topic._count.rssFeeds > 0 || topic._count.feeds > 0) {
      return NextResponse.json(
        { error: "Cannot delete topic with RSS feeds or content. Delete those first." },
        { status: 400 }
      )
    }

    await prisma.topic.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete topic:", error)
    return NextResponse.json(
      { error: "Failed to delete topic" },
      { status: 500 }
    )
  }
}
