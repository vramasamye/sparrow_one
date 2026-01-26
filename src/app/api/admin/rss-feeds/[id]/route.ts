import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * Update an RSS feed (toggle active status, update name/url)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const { id } = await params
    const body = await request.json()
    const { name, url, isActive } = body

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (url !== undefined) {
      // Validate URL if provided
      try {
        new URL(url)
        updateData.url = url
      } catch {
        return NextResponse.json(
          { error: "Invalid URL format" },
          { status: 400 }
        )
      }
    }
    if (isActive !== undefined) updateData.isActive = isActive

    const rssFeed = await prisma.rssFeed.update({
      where: { id },
      data: updateData,
      include: {
        topic: true,
      },
    })

    return NextResponse.json({ rssFeed })
  } catch (error) {
    console.error("Failed to update RSS feed:", error)

    if (error instanceof Error && error.message.includes("Record to update not found")) {
      return NextResponse.json({ error: "RSS feed not found" }, { status: 404 })
    }

    return NextResponse.json(
      { error: "Failed to update RSS feed" },
      { status: 500 }
    )
  }
}

/**
 * Delete an RSS feed
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const { id } = await params

    await prisma.rssFeed.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete RSS feed:", error)

    if (error instanceof Error && error.message.includes("Record to delete does not exist")) {
      return NextResponse.json({ error: "RSS feed not found" }, { status: 404 })
    }

    return NextResponse.json(
      { error: "Failed to delete RSS feed" },
      { status: 500 }
    )
  }
}
