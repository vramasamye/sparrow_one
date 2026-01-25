import { TwitterApi } from "twitter-api-v2"

import { prisma } from "./prisma"
import { decrypt } from "./encryption"
import { isTokenExpired, refreshAccountToken } from "./token-refresh"

interface PublishResult {
  success: boolean
  platformPostId?: string
  error?: string
}

/**
 * Publish a post to Twitter
 */
async function publishToTwitter(accessToken: string, content: string): Promise<PublishResult> {
  try {
    const client = new TwitterApi(accessToken)

    const tweet = await client.v2.tweet(content)

    return {
      success: true,
      platformPostId: tweet.data.id,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("Twitter publish error:", errorMessage)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Publish a post to LinkedIn
 */
async function publishToLinkedIn(
  accessToken: string,
  userId: string,
  content: string
): Promise<PublishResult> {
  try {
    // First, get the user's LinkedIn URN
    const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!profileResponse.ok) {
      throw new Error("Failed to get LinkedIn profile")
    }

    const profile = await profileResponse.json()
    const authorUrn = `urn:li:person:${profile.sub}`

    // Create the post
    const postResponse = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: authorUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: {
              text: content,
            },
            shareMediaCategory: "NONE",
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      }),
    })

    if (!postResponse.ok) {
      const error = await postResponse.text()
      throw new Error(`LinkedIn API error: ${error}`)
    }

    const postData = await postResponse.json()

    return {
      success: true,
      platformPostId: postData.id,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("LinkedIn publish error:", errorMessage)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Process and publish scheduled posts
 */
export async function publishScheduledPosts(): Promise<void> {
  console.log("Starting post publishing job...")

  const now = new Date()

  // Find posts that are due to be published
  const postsToPublish = await prisma.scheduledPost.findMany({
    where: {
      status: "SCHEDULED",
      scheduledFor: {
        lte: now,
      },
    },
    include: {
      socialAccount: true,
      user: true,
    },
    take: 10, // Process in batches
  })

  console.log(`Found ${postsToPublish.length} posts to publish`)

  for (const post of postsToPublish) {
    // Mark as publishing
    await prisma.scheduledPost.update({
      where: { id: post.id },
      data: { status: "PUBLISHING" },
    })

    try {
      if (!post.socialAccount.isActive) {
        throw new Error("Social account is not active")
      }

      // Check if token is expired and refresh if needed
      if (isTokenExpired(post.socialAccount.tokenExpiresAt)) {
        console.log(`Token expired for account ${post.socialAccount.id}, attempting refresh...`)
        const refreshed = await refreshAccountToken(post.socialAccount.id)

        if (!refreshed) {
          throw new Error("Failed to refresh expired token. Please reconnect your account.")
        }

        // Fetch updated account with new token
        const updatedAccount = await prisma.socialAccount.findUnique({
          where: { id: post.socialAccount.id },
        })

        if (!updatedAccount) {
          throw new Error("Account not found after refresh")
        }

        post.socialAccount = updatedAccount
      }

      const accessToken = decrypt(post.socialAccount.accessToken)
      let result: PublishResult

      if (post.platform === "TWITTER") {
        result = await publishToTwitter(accessToken, post.content)
      } else if (post.platform === "LINKEDIN") {
        result = await publishToLinkedIn(
          accessToken,
          post.socialAccount.platformUserId,
          post.content
        )
      } else {
        throw new Error(`Unsupported platform: ${post.platform}`)
      }

      if (result.success) {
        // Update post as published
        await prisma.scheduledPost.update({
          where: { id: post.id },
          data: {
            status: "PUBLISHED",
            publishedAt: new Date(),
            platformPostId: result.platformPostId,
          },
        })

        // Add to user post history
        await prisma.userPostHistory.create({
          data: {
            userId: post.userId,
            platform: post.platform,
            platformPostId: result.platformPostId,
            content: post.content,
            mediaUrls: post.mediaUrls,
            publishedAt: new Date(),
          },
        })

        // Update feed status if linked
        if (post.feedId) {
          await prisma.feed.update({
            where: { id: post.feedId },
            data: { status: "PUBLISHED" },
          })
        }

        console.log(`Successfully published post ${post.id} to ${post.platform}`)
      } else {
        throw new Error(result.error || "Unknown publishing error")
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"

      // Update post as failed
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: {
          status: "FAILED",
          errorMessage,
          retryCount: { increment: 1 },
        },
      })

      console.error(`Failed to publish post ${post.id}:`, errorMessage)
    }
  }

  console.log("Post publishing job completed")
}
