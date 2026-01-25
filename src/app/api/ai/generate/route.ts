import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { generatePost, type Platform } from "@/lib/ai"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkAvailability, getRateLimitStatus } from "@/lib/rate-limiter"

const generateSchema = z.object({
  feedId: z.string(),
  platform: z.enum(["twitter", "linkedin"]),
})

// GET endpoint to check rate limit status
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const status = await getRateLimitStatus()
    return NextResponse.json(status)
  } catch (error) {
    console.error("Error checking rate limit:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check rate limit before processing (Fail fast)
    const isAvailable = await checkAvailability()
    if (!isAvailable) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. System is busy.",
          waitSeconds: 60,
        },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { feedId, platform } = generateSchema.parse(body)

    // Fetch the feed item
    const feed = await prisma.feed.findUnique({
      where: { id: feedId },
      select: {
        id: true,
        title: true,
        url: true,
        summary: true,
        content: true,
      },
    })

    if (!feed) {
      return NextResponse.json({ error: "Feed not found" }, { status: 404 })
    }

    // Generate the post content (Usage is recorded inside generatePost)
    const content = await generatePost({
      title: feed.title,
      summary: feed.summary || feed.content?.substring(0, 500) || null,
      url: feed.url,
      platform: platform as Platform,
    })

    return NextResponse.json({ content })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }
    console.error("Error generating post:", error)
    
    // Handle the specific error from generatePost
    if (error instanceof Error && error.message.includes("Rate limit exceeded")) {
        return NextResponse.json({ error: "Rate limit exceeded. System is busy." }, { status: 429 })
    }

    return NextResponse.json({ error: "Failed to generate content" }, { status: 500 })
  }
}