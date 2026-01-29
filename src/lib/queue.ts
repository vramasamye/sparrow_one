import { redis } from "@/lib/redis"
import { prisma } from "@/lib/prisma"

/**
 * Simple Redis-based queue for processing approved feeds
 * Works on serverless (Vercel) without requiring persistent workers
 */

const QUEUE_KEY = "queue:approved-feeds"
const PROCESSING_KEY = "queue:processing-feeds"

export interface QueueJob {
  feedId: string
  approvedBy: string
  approvedAt: string
  priority?: number
}

/**
 * Add a feed to the processing queue
 */
export async function enqueueApprovedFeed(feedId: string, approvedBy: string): Promise<void> {
  const job: QueueJob = {
    feedId,
    approvedBy,
    approvedAt: new Date().toISOString(),
    priority: Date.now(), // Lower timestamp = higher priority (FIFO)
  }

  // Add to sorted set (sorted by timestamp for FIFO)
  await redis.zadd(QUEUE_KEY, job.priority ?? Date.now(), JSON.stringify(job))

  console.log(`✅ Enqueued feed ${feedId} for processing`)
}

/**
 * Get next job from queue (non-blocking)
 * Returns null if queue is empty
 */
export async function dequeueNextJob(): Promise<QueueJob | null> {
  // Get the job with lowest score (oldest/highest priority)
  const jobs = await redis.zrange(QUEUE_KEY, 0, 0)

  if (jobs.length === 0) {
    return null
  }

  const jobData = jobs[0]
  const job: QueueJob = JSON.parse(jobData)

  // Move to processing set (for crash recovery)
  const pipeline = redis.pipeline()
  pipeline.zrem(QUEUE_KEY, jobData)
  pipeline.sadd(PROCESSING_KEY, jobData)
  await pipeline.exec()

  return job
}

/**
 * Mark job as completed and remove from processing
 */
export async function markJobCompleted(job: QueueJob): Promise<void> {
  await redis.srem(PROCESSING_KEY, JSON.stringify(job))
  console.log(`✅ Completed job for feed ${job.feedId}`)
}

/**
 * Mark job as failed and re-queue or discard
 */
export async function markJobFailed(job: QueueJob, error: string): Promise<void> {
  await redis.srem(PROCESSING_KEY, JSON.stringify(job))

  // Could implement retry logic here
  console.error(`❌ Failed job for feed ${job.feedId}:`, error)
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const [queueSize, processingSize] = await Promise.all([
    redis.zcard(QUEUE_KEY),
    redis.scard(PROCESSING_KEY),
  ])

  return {
    queued: queueSize,
    processing: processingSize,
    total: queueSize + processingSize,
  }
}

/**
 * Peek at next jobs without dequeuing
 */
export async function peekQueue(limit: number = 10): Promise<QueueJob[]> {
  const jobs = await redis.zrange(QUEUE_KEY, 0, limit - 1)
  return jobs.map(job => JSON.parse(job))
}

/**
 * Clear the entire queue (use with caution!)
 */
export async function clearQueue(): Promise<void> {
  await redis.del(QUEUE_KEY, PROCESSING_KEY)
  console.log('🗑️  Queue cleared')
}

/**
 * Remove all queue jobs for a specific feed
 * Call this when a feed is deleted
 */
export async function removeJobsForFeed(feedId: string): Promise<number> {
  let removedCount = 0

  // Remove from queue
  const queuedJobs = await redis.zrange(QUEUE_KEY, 0, -1)
  const pipeline = redis.pipeline()

  for (const jobData of queuedJobs) {
    const job: QueueJob = JSON.parse(jobData)
    if (job.feedId === feedId) {
      pipeline.zrem(QUEUE_KEY, jobData)
      removedCount++
    }
  }

  // Remove from processing
  const processingJobs = await redis.smembers(PROCESSING_KEY)
  for (const jobData of processingJobs) {
    const job: QueueJob = JSON.parse(jobData)
    if (job.feedId === feedId) {
      pipeline.srem(PROCESSING_KEY, jobData)
      removedCount++
    }
  }

  await pipeline.exec()

  if (removedCount > 0) {
    console.log(`🗑️  Removed ${removedCount} queue jobs for feed ${feedId}`)
  }

  return removedCount
}

/**
 * Recover jobs stuck in processing (call this on startup or periodically)
 * Validates feed existence before re-queuing to avoid orphaned jobs
 */
export async function recoverStuckJobs(): Promise<number> {
  const processingJobs = await redis.smembers(PROCESSING_KEY)

  if (processingJobs.length === 0) {
    return 0
  }

  // Validate feeds exist and only recover valid jobs
  const pipeline = redis.pipeline()
  let recoveredCount = 0
  let discardedCount = 0

  for (const jobData of processingJobs) {
    const job: QueueJob = JSON.parse(jobData)

    // Check if feed still exists
    const feedExists = await prisma.feed.findUnique({
      where: { id: job.feedId },
      select: { id: true }
    })

    if (feedExists) {
      // Re-queue valid job
      pipeline.zadd(QUEUE_KEY, job.priority || Date.now(), jobData)
      pipeline.srem(PROCESSING_KEY, jobData)
      recoveredCount++
    } else {
      // Discard job for deleted feed
      pipeline.srem(PROCESSING_KEY, jobData)
      discardedCount++
      console.log(`🗑️  Discarded stuck job for deleted feed ${job.feedId}`)
    }
  }

  await pipeline.exec()

  if (recoveredCount > 0) {
    console.log(`🔄 Recovered ${recoveredCount} stuck jobs`)
  }
  if (discardedCount > 0) {
    console.log(`🗑️  Discarded ${discardedCount} jobs for deleted feeds`)
  }

  return recoveredCount
}
