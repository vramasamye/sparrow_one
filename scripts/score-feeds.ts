#!/usr/bin/env tsx

/**
 * Score Existing Feeds (Local Script)
 *
 * Processes feeds in batches, respecting Llama Guard rate limits:
 * - 30 RPM (1 request every 2 seconds)
 * - 14,400 RPD
 *
 * Usage:
 *   npm run score-feeds                 # Score all PENDING feeds
 *   npm run score-feeds -- --all        # Score all feeds
 *   npm run score-feeds -- --limit 100  # Score first 100 PENDING feeds
 */

import { prisma } from '../src/lib/prisma'
import { scoreFeed } from '../src/lib/feed-scorer'
import { enqueueApprovedFeed } from '../src/lib/queue'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

interface Stats {
  total: number
  processed: number
  autoApproved: number
  autoRejected: number
  pendingReview: number
  errors: number
  startTime: number
}

async function main() {
  const args = process.argv.slice(2)
  const scoreAll = args.includes('--all')
  const limitIndex = args.indexOf('--limit')
  const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1]) : undefined

  console.log('='.repeat(60))
  console.log('🔍 Feed Scoring System')
  console.log('='.repeat(60))
  console.log()

  // Determine which feeds to score
  const where = scoreAll ? {} : { status: 'PENDING' as const }

  const totalFeeds = await prisma.feed.count({ where })
  console.log(`Total feeds to score: ${totalFeeds}`)

  if (limit) {
    console.log(`Limit: ${limit} feeds`)
  }

  console.log()

  if (totalFeeds === 0) {
    console.log('✅ No feeds to score!')
    return
  }

  // Fetch feeds
  const feeds = await prisma.feed.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true }
  })

  console.log(`Scoring ${feeds.length} feeds...`)
  console.log()

  const stats: Stats = {
    total: feeds.length,
    processed: 0,
    autoApproved: 0,
    autoRejected: 0,
    pendingReview: 0,
    errors: 0,
    startTime: Date.now()
  }

  // Process feeds one by one (rate limited internally by Llama Guard)
  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i]
    const progress = `[${i + 1}/${feeds.length}]`

    try {
      console.log(`${progress} Scoring: "${feed.title.substring(0, 50)}..."`)

      const result = await scoreFeed(feed.id)

      stats.processed++

      if (result.autoApprove) {
        stats.autoApproved++

        // Auto-approve and enqueue
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

        console.log(`  ✅ AUTO-APPROVED (score: ${result.qualityScore})`)

      } else if (result.autoReject) {
        stats.autoRejected++

        await prisma.feed.update({
          where: { id: feed.id },
          data: {
            status: 'REJECTED',
            rejectionReason: result.reasoning
          }
        })

        console.log(`  ❌ AUTO-REJECTED (score: ${result.qualityScore})`)

      } else {
        stats.pendingReview++
        console.log(`  ⏳ PENDING REVIEW (score: ${result.qualityScore})`)
      }

      // Progress update every 10 feeds
      if ((i + 1) % 10 === 0) {
        printProgress(stats)
      }

    } catch (error) {
      stats.errors++
      console.error(`  ❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    console.log()
  }

  // Final results
  console.log()
  console.log('='.repeat(60))
  console.log('✅ Scoring Complete!')
  console.log('='.repeat(60))
  console.log()

  printFinalStats(stats)
}

function printProgress(stats: Stats) {
  const elapsed = Math.round((Date.now() - stats.startTime) / 1000)
  const rate = stats.processed / elapsed
  const remaining = stats.total - stats.processed
  const eta = remaining > 0 ? Math.round(remaining / rate) : 0

  console.log()
  console.log(`  Progress: ${stats.processed}/${stats.total} (${Math.round(stats.processed / stats.total * 100)}%)`)
  console.log(`  Elapsed: ${elapsed}s | ETA: ${eta}s | Rate: ${rate.toFixed(1)} feeds/sec`)
  console.log()
}

function printFinalStats(stats: Stats) {
  const elapsed = Math.round((Date.now() - stats.startTime) / 1000)
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  console.log(`Total Processed:    ${stats.processed}/${stats.total}`)
  console.log(`Auto-Approved:      ${stats.autoApproved} (${Math.round(stats.autoApproved / stats.processed * 100)}%)`)
  console.log(`Auto-Rejected:      ${stats.autoRejected} (${Math.round(stats.autoRejected / stats.processed * 100)}%)`)
  console.log(`Pending Review:     ${stats.pendingReview} (${Math.round(stats.pendingReview / stats.processed * 100)}%)`)
  console.log(`Errors:             ${stats.errors}`)
  console.log()
  console.log(`Time Elapsed:       ${minutes}m ${seconds}s`)
  console.log(`Average Rate:       ${(stats.processed / elapsed).toFixed(2)} feeds/sec`)
  console.log()

  console.log('Admin Impact:')
  console.log(`  Before: ${stats.total} feeds to review`)
  console.log(`  After:  ${stats.pendingReview} feeds to review`)
  console.log(`  Time Saved: ${Math.round((stats.total - stats.pendingReview) / stats.total * 100)}%`)
  console.log()

  if (stats.autoApproved > 0) {
    console.log(`✅ ${stats.autoApproved} feeds queued for post generation!`)
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
