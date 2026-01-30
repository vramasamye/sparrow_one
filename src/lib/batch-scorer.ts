/**
 * Batch Feed Scoring
 *
 * Processes unscored feeds in batches while respecting Llama Guard rate limits
 * - 30 RPM (1 request every 2 seconds)
 * - Can process ~1,800 feeds/hour safely
 */

import { prisma } from './prisma'
import { scoreFeed } from './feed-scorer'
import { enqueueApprovedFeed } from './queue'

export interface BatchScoringResult {
  total: number
  processed: number
  autoApproved: number
  autoRejected: number
  pendingReview: number
  errors: number
  duration: number
}

/**
 * Score all unscored PENDING feeds
 */
export async function scoreUnscoredFeeds(
  limit?: number
): Promise<BatchScoringResult> {
  const startTime = Date.now()

  const result: BatchScoringResult = {
    total: 0,
    processed: 0,
    autoApproved: 0,
    autoRejected: 0,
    pendingReview: 0,
    errors: 0,
    duration: 0
  }

  try {
    // Get unscored PENDING feeds
    const feeds = await prisma.feed.findMany({
      where: {
        status: 'PENDING',
        scoredAt: null  // Not yet scored
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: { id: true }
    })

    result.total = feeds.length

    if (feeds.length === 0) {
      console.log('✅ No feeds to score!')
      return result
    }

    console.log(`📊 Scoring ${feeds.length} feeds...`)
    console.log(`⏱️  Estimated time: ${Math.ceil(feeds.length * 2.5 / 60)} minutes (rate limited)`)
    console.log()

    // Process each feed (rate limited by Llama Guard)
    for (let i = 0; i < feeds.length; i++) {
      const feed = feeds[i]

      try {
        const scoringResult = await scoreFeed(feed.id)
        result.processed++

        if (scoringResult.autoApprove) {
          result.autoApproved++

          // Update status
          await prisma.feed.update({
            where: { id: feed.id },
            data: {
              status: 'APPROVED',
              approvedAt: new Date(),
              approvedBy: 'SYSTEM_AUTO'
            }
          })

          // Enqueue for post generation
          await enqueueApprovedFeed(feed.id, 'SYSTEM_AUTO')

        } else if (scoringResult.autoReject) {
          result.autoRejected++

          await prisma.feed.update({
            where: { id: feed.id },
            data: {
              status: 'REJECTED',
              rejectionReason: scoringResult.reasoning
            }
          })

        } else {
          result.pendingReview++
          // Stays in PENDING status for manual review
        }

        // Progress update every 10 feeds
        if ((i + 1) % 10 === 0 || i === feeds.length - 1) {
          const elapsed = Math.round((Date.now() - startTime) / 1000)
          const progress = Math.round(((i + 1) / feeds.length) * 100)
          console.log(`Progress: ${i + 1}/${feeds.length} (${progress}%) | ${elapsed}s elapsed`)
        }

      } catch (error) {
        result.errors++
        console.error(`Error scoring feed ${feed.id}:`, error)
      }
    }

    result.duration = Date.now() - startTime

  } catch (error) {
    console.error('Batch scoring failed:', error)
    throw error
  }

  return result
}

/**
 * Main execution
 */
async function run() {
  const args = process.argv.slice(2)
  const limitIndex = args.indexOf('--limit')
  const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1]) : undefined

  try {
    const result = await scoreUnscoredFeeds(limit)

    console.log()
    console.log('='.repeat(60))
    console.log('✅ Scoring Complete!')
    console.log('='.repeat(60))
    console.log()

    const minutes = Math.floor(result.duration / 60000)
    const seconds = Math.floor((result.duration % 60000) / 1000)

    console.log(`Results:`)
    console.log(`  Processed:      ${result.processed}/${result.total}`)
    console.log(`  Auto-Approved:  ${result.autoApproved} (${Math.round(result.autoApproved / result.processed * 100)}%)`)
    console.log(`  Auto-Rejected:  ${result.autoRejected} (${Math.round(result.autoRejected / result.processed * 100)}%)`)
    console.log(`  Pending Review: ${result.pendingReview} (${Math.round(result.pendingReview / result.processed * 100)}%)`)
    console.log(`  Errors:         ${result.errors}`)
    console.log()
    console.log(`Time: ${minutes}m ${seconds}s`)
    console.log()

    if (result.autoApproved > 0) {
      console.log(`🎉 ${result.autoApproved} feeds queued for post generation!`)
      console.log(`   These will be processed by the process-queue cron job.`)
      console.log()
    }

    if (result.pendingReview > 0) {
      console.log(`👀 ${result.pendingReview} feeds need manual review in admin panel.`)
      console.log()
    }

    console.log('Admin Impact:')
    console.log(`  Before: ${result.total} feeds to review manually`)
    console.log(`  After:  ${result.pendingReview} feeds to review manually`)
    console.log(`  Time Saved: ${Math.round((result.total - result.pendingReview) / result.total * 100)}%`)
    console.log()

  } catch (error) {
    console.error()
    console.error('='.repeat(60))
    console.error('❌ Scoring Failed!')
    console.error('='.repeat(60))
    console.error()
    console.error('Error:', error instanceof Error ? error.message : error)
    console.error()
    process.exit(1)
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
