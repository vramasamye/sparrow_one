import { prisma } from "./prisma"
import { parseFeed, type ParsedFeedItem } from "./rss-parser"

export interface ProcessingResult {
  feedId: string
  feedName: string
  success: boolean
  newItems: number
  duplicates: number
  skipped: number // Items skipped (no date, outside time window, or already fetched)
  error?: string
}

/**
 * Process all active RSS feeds (ONLY for topics with active subscribers)
 * This reduces API usage by only fetching feeds users are interested in
 *
 * Time-based filtering:
 * - First pull (lastSuccessAt is null): Fetches all January 2026 articles
 * - Subsequent pulls: Fetches only articles published after lastSuccessAt
 */
export async function processAllFeeds(): Promise<ProcessingResult[]> {
  // Get topics that have at least one user subscribed
  const subscribedTopicIds = await prisma.userTopic.findMany({
    select: { topicId: true },
    distinct: ['topicId']
  })

  const topicIds = subscribedTopicIds.map(ut => ut.topicId)

  if (topicIds.length === 0) {
    console.log("No topics have subscribers. Skipping feed processing.")
    return []
  }

  // Only get feeds for topics that have subscribers
  const activeFeeds = await prisma.rssFeed.findMany({
    where: {
      isActive: true,
      topicId: { in: topicIds }
    },
    include: { topic: true },
  })

  console.log(`Processing ${activeFeeds.length} active feeds for ${topicIds.length} subscribed topics...`)

  const results: ProcessingResult[] = []

  // Process feeds in batches of 5 to avoid overwhelming the system
  const batchSize = 5
  for (let i = 0; i < activeFeeds.length; i += batchSize) {
    const batch = activeFeeds.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map((feed) => processSingleFeed(feed.id, feed.url, feed.name, feed.topicId))
    )
    results.push(...batchResults)
  }

  return results
}

/**
 * Clean up old feeds that are older than 24 hours
 * This keeps the database clean and focused on recent content
 */
export async function cleanupOldFeeds(): Promise<number> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // Delete PENDING feeds older than 24 hours (not approved)
  const result = await prisma.feed.deleteMany({
    where: {
      status: "PENDING",
      createdAt: {
        lt: twentyFourHoursAgo
      }
    }
  })

  console.log(`🗑️  Cleaned up ${result.count} old pending feeds (>24h)`)
  return result.count
}

/**
 * Process active RSS feeds for specific topics only
 */
export async function processFeedsForTopics(topicIds: string[]): Promise<ProcessingResult[]> {
  const activeFeeds = await prisma.rssFeed.findMany({
    where: { 
        isActive: true,
        topicId: { in: topicIds }
    },
    include: { topic: true },
  })

  console.log(`Processing ${activeFeeds.length} active feeds for ${topicIds.length} topics...`)

  const results: ProcessingResult[] = []

  // Process feeds in batches of 5
  const batchSize = 5
  for (let i = 0; i < activeFeeds.length; i += batchSize) {
    const batch = activeFeeds.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map((feed) => processSingleFeed(feed.id, feed.url, feed.name, feed.topicId))
    )
    results.push(...batchResults)
  }

  return results
}

/**
 * Process a single RSS feed
 */
export async function processSingleFeed(
  feedId: string,
  feedUrl: string,
  feedName: string,
  topicId: string
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    feedId,
    feedName,
    success: false,
    newItems: 0,
    duplicates: 0,
    skipped: 0,
  }

  try {
    // Get the feed to check lastSuccessAt
    const feed = await prisma.rssFeed.findUnique({
      where: { id: feedId },
      select: { lastSuccessAt: true }
    })

    // Parse the feed
    const items = await parseFeed(feedUrl)

    // Process each item
    for (const item of items) {
      const status = await addFeedItem(topicId, feedId, item, feed?.lastSuccessAt)

      if (status === 'added') {
        result.newItems++
      } else if (status === 'duplicate') {
        result.duplicates++
      } else if (status === 'skipped') {
        result.skipped++
      }
    }

    // Update feed last fetched timestamp
    await prisma.rssFeed.update({
      where: { id: feedId },
      data: {
        lastFetchedAt: new Date(),
        lastSuccessAt: new Date(),
        fetchErrorCount: 0,
        lastError: null,
      },
    })

    result.success = true
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    result.error = errorMessage

    // Update feed with error info
    await prisma.rssFeed.update({
      where: { id: feedId },
      data: {
        lastFetchedAt: new Date(),
        fetchErrorCount: { increment: 1 },
        lastError: errorMessage,
      },
    })
  }

  return result
}

/**
 * Add a feed item if it doesn't already exist
 * Returns: 'added' | 'duplicate' | 'skipped'
 *
 * Time-based filtering:
 * - First pull (lastSuccessAt is null): Get all January 2026 articles
 * - Subsequent pulls: Get articles published after lastSuccessAt
 */
async function addFeedItem(
  topicId: string,
  rssFeedId: string,
  item: ParsedFeedItem,
  lastSuccessAt: Date | null | undefined
): Promise<'added' | 'duplicate' | 'skipped'> {
  try {
    // SKIP if no publishedAt date
    if (!item.publishedAt) {
      console.log(`⏭️  Skipping item (no publishedAt): "${item.title.substring(0, 50)}..."`)
      return 'skipped'
    }

    const itemDate = new Date(item.publishedAt)

    // Time-based filtering logic
    if (lastSuccessAt === null || lastSuccessAt === undefined) {
      // FIRST PULL: Get articles from the last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      if (itemDate < thirtyDaysAgo) {
        console.log(`⏭️  Skipping item (first pull - older than 30 days): "${item.title.substring(0, 50)}..."`)
        return 'skipped'
      }
    } else {
      // SUBSEQUENT PULLS: Only get items published after last successful fetch
      if (itemDate <= lastSuccessAt) {
        console.log(`⏭️  Skipping item (already fetched): "${item.title.substring(0, 50)}..."`)
        return 'skipped'
      }
    }

    // Check if item already exists by content hash
    const existing = await prisma.feed.findUnique({
      where: { contentHash: item.contentHash },
    })

    if (existing) {
      return 'duplicate'
    }

    // Ensure author is a string (some feeds return objects)
    let authorString: string | null = null
    if (typeof item.author === "string") {
      authorString = item.author
    } else if (item.author && typeof item.author === "object") {
      // Handle various object structures for author
      const authorObj = item.author as any
      authorString = authorObj.name || authorObj.displayName || JSON.stringify(item.author).substring(0, 100)
      
      // Handle the specific structure seen in Google blog feeds
      if (Array.isArray(authorObj.name) && authorObj.name.length > 0) {
        authorString = authorObj.name[0]
      }
    }

    // Create new feed item
    await prisma.feed.create({
      data: {
        topicId,
        rssFeedId,
        title: item.title,
        url: item.url,
        contentHash: item.contentHash,
        summary: item.summary,
        content: item.content,
        imageUrl: item.imageUrl,
        author: authorString,
        publishedAt: item.publishedAt,
        status: "PENDING",
      },
    })

    return 'added'
  } catch (error) {
    // Handle unique constraint violation (race condition)
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint failed")
    ) {
      return 'duplicate'
    }
    throw error
  }
}

/**
 * Get processing statistics
 */
export async function getProcessingStats() {
  const [pendingCount, approvedCount, rejectedCount, publishedCount, feedCount] =
    await Promise.all([
      prisma.feed.count({ where: { status: "PENDING" } }),
      prisma.feed.count({ where: { status: "APPROVED" } }),
      prisma.feed.count({ where: { status: "REJECTED" } }),
      prisma.feed.count({ where: { status: "PUBLISHED" } }),
      prisma.rssFeed.count({ where: { isActive: true } }),
    ])

  return {
    pending: pendingCount,
    approved: approvedCount,
    rejected: rejectedCount,
    published: publishedCount,
    activeFeeds: feedCount,
  }
}
