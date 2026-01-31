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
    // 1. Get the feed with topic platform config
    const feed = await prisma.feed.findUnique({
      where: { id: feedId },
      include: {
        topic: {
          select: {
            id: true,
            name: true,
            enableTwitter: true,
            enableLinkedin: true,
          }
        }
      }
    })

    if (!feed) {
      throw new Error(`Feed ${feedId} not found`)
    }

    if (feed.status !== "APPROVED") {
      throw new Error(`Feed ${feedId} is not approved (status: ${feed.status})`)
    }

    // 2. Validate at least one platform enabled
    if (!feed.topic.enableTwitter && !feed.topic.enableLinkedin) {
      throw new Error(`Topic ${feed.topic.name} has no platforms enabled`)
    }

    // 3. Check if already generated
    const existing = await prisma.generatedPost.findUnique({
      where: { feedId }
    })

    if (existing && existing.status === "COMPLETED") {
      console.log(`✅ Feed ${feedId} already has generated content`)
      return {
        success: true,
        twitterContent: existing.twitterContent ?? undefined,
        linkedinContent: existing.linkedinContent ?? undefined
      }
    }

    // 4. Create or update GeneratedPost record (status: GENERATING)
    await prisma.generatedPost.upsert({
      where: { feedId },
      create: {
        feedId,
        twitterContent: null,
        linkedinContent: null,
        status: "GENERATING"
      },
      update: {
        status: "GENERATING",
        retryCount: { increment: 1 }
      }
    })

    console.log(`🤖 Generating posts for: "${feed.title.substring(0, 60)}..."`)

    // 5. Conditionally generate Twitter post
    let twitterContent: string | null = null
    if (feed.topic.enableTwitter) {
      console.log("  📱 Generating Twitter post...")
      twitterContent = await generatePost({
        title: feed.title,
        summary: feed.summary || "",
        url: feed.url,
        platform: "twitter",
        waitForRateLimit: true // ← Wait up to 10 minutes if rate limited
      })
      console.log("  ✅ Twitter post generated")
    } else {
      console.log("  ⏭️  Skipping Twitter (disabled for this topic)")
    }

    // 6. Conditionally generate LinkedIn post
    let linkedinContent: string | null = null
    if (feed.topic.enableLinkedin) {
      console.log("  💼 Generating LinkedIn post...")
      linkedinContent = await generatePost({
        title: feed.title,
        summary: feed.summary || "",
        url: feed.url,
        platform: "linkedin",
        waitForRateLimit: true // ← Wait up to 10 minutes if rate limited
      })
      console.log("  ✅ LinkedIn post generated")
    } else {
      console.log("  ⏭️  Skipping LinkedIn (disabled for this topic)")
    }

    // 7. Store generated content (null for disabled platforms)
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
      twitterContent: twitterContent ?? undefined,
      linkedinContent: linkedinContent ?? undefined
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
          twitterContent: null,
          linkedinContent: null,
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
