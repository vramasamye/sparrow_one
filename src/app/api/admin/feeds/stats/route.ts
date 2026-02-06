import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const [pending, approved, rejected, published, activeFeeds] =
      await Promise.all([
        prisma.feed.count({ where: { status: "PENDING" } }),
        prisma.feed.count({ where: { status: "APPROVED" } }),
        prisma.feed.count({ where: { status: "REJECTED" } }),
        prisma.feed.count({ where: { status: "PUBLISHED" } }),
        prisma.rssFeed.count({ where: { isActive: true } }),
      ])

    return NextResponse.json({
      pending,
      approved,
      rejected,
      published,
      activeFeeds,
    })
  } catch (error) {
    console.error("Error fetching feed stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    )
  }
}
