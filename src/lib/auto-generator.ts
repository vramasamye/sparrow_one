import { prisma } from "@/lib/prisma"
import { generatePost } from "@/lib/ai"

/**
 * Auto-generate Twitter and LinkedIn posts for an approved feed
 * Uses GROQ with rate limit retry (waitForRateLimit: true)
 */
export async function generatePostsForFeed(feedId: string): Promise<{
  success: boolean
  twitterContent?: string
  linkedinContent?: string
  error?: string
}> {
  try {
    // 1. Get the feed
    const feed = await prisma.feed.findUnique({
      where: { id: feedId },
      include: { topic: true }
    })

    if (!feed) {
      throw new Error(`Feed ${feedId} not found`)
    }

    if (feed.status !== "APPROVED") {
      throw new Error(`Feed ${feedId} is not approved (status: ${feed.status})`)
    }

    // 2. Check if already generated
    const existing = await prisma.generatedPost.findUnique({
      where: { feedId }
    })

    if (existing && existing.status === "COMPLETED") {
      console.log(`✅ Feed ${feedId} already has generated content`)
      return {
        success: true,
        twitterContent: existing.twitterContent,
        linkedinContent: existing.linkedinContent
      }
    }

    // 3. Create or update GeneratedPost record (status: GENERATING)
    await prisma.generatedPost.upsert({
      where: { feedId },
      create: {
        feedId,
        twitterContent: "",
        linkedinContent: "",
        status: "GENERATING"
      },
      update: {
        status: "GENERATING",
        retryCount: { increment: 1 }
      }
    })

    console.log(`🤖 Generating posts for: "${feed.title.substring(0, 60)}..."`)

    // 4. Generate Twitter post (with rate limit retry)
    console.log("  📱 Generating Twitter post...")
    const twitterContent = await generatePost({
      title: feed.title,
      summary: feed.summary || "",
      url: feed.url,
      platform: "twitter",
      waitForRateLimit: true // ← Wait up to 10 minutes if rate limited
    })

    console.log("  ✅ Twitter post generated")

    // 5. Generate LinkedIn post (with rate limit retry)
    console.log("  💼 Generating LinkedIn post...")
    const linkedinContent = await generatePost({
      title: feed.title,
      summary: feed.summary || "",
      url: feed.url,
      platform: "linkedin",
      waitForRateLimit: true // ← Wait up to 10 minutes if rate limited
    })

    console.log("  ✅ LinkedIn post generated")

    // 6. Store generated content
    await prisma.generatedPost.update({
      where: { feedId },
      data: {
        twitterContent,
        linkedinContent,
        status: "COMPLETED",
        generatedAt: new Date()
      }
    })

    console.log(`✅ Generated posts stored for feed ${feedId}`)

    return {
      success: true,
      twitterContent,
      linkedinContent
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    console.error(`❌ Failed to generate posts for feed ${feedId}:`, errorMessage)

    // If feed doesn't exist, don't try to create GeneratedPost (would fail foreign key constraint)
    if (errorMessage.includes("not found")) {
      return {
        success: false,
        error: errorMessage
      }
    }

    // Update status to FAILED for other errors
    try {
      await prisma.generatedPost.upsert({
        where: { feedId },
        create: {
          feedId,
          twitterContent: "",
          linkedinContent: "",
          status: "FAILED",
          errorMessage
        },
        update: {
          status: "FAILED",
          errorMessage,
          retryCount: { increment: 1 }
        }
      })
    } catch (dbError) {
      // If upsert fails (e.g., feed was deleted between checks), just log it
      console.error(`Failed to update GeneratedPost status:`, dbError)
    }

    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Batch generate posts for multiple feeds
 */
export async function batchGeneratePosts(feedIds: string[]): Promise<{
  successful: number
  failed: number
  results: Array<{ feedId: string; success: boolean; error?: string }>
}> {
  const results = []
  let successful = 0
  let failed = 0

  for (const feedId of feedIds) {
    const result = await generatePostsForFeed(feedId)

    results.push({
      feedId,
      success: result.success,
      error: result.error
    })

    if (result.success) {
      successful++
    } else {
      failed++
    }
  }

  return { successful, failed, results }
}
