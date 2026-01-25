import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: topicId } = await params

    // Check if topic exists
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
    })

    if (!topic) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 })
    }

    // Create user topic association
    await prisma.userTopic.create({
      data: {
        userId: session.user.id,
        topicId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    // Handle unique constraint violation (already following)
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Already following topic" }, { status: 400 })
    }
    console.error("Error following topic:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: topicId } = await params

    // Delete user topic association
    await prisma.userTopic.deleteMany({
      where: {
        userId: session.user.id,
        topicId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error unfollowing topic:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
