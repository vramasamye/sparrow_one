import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: postId } = await params

    // Verify the post belongs to the user
    const post = await prisma.scheduledPost.findFirst({
      where: {
        id: postId,
        userId: session.user.id,
      },
    })

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    if (post.status !== "SCHEDULED") {
      return NextResponse.json(
        { error: "Can only cancel scheduled posts" },
        { status: 400 }
      )
    }

    // Cancel the post
    await prisma.scheduledPost.update({
      where: { id: postId },
      data: { status: "CANCELLED" },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error cancelling post:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
