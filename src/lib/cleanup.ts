import { prisma } from "./prisma"

interface CleanupResult {
  job: string
  deletedCount: number
  error?: string
}

/**
 * Delete rejected feeds older than 7 days
 */
export async function cleanupRejectedFeeds(): Promise<CleanupResult> {
  const result: CleanupResult = {
    job: "Rejected Feeds Cleanup",
    deletedCount: 0,
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const deleted = await prisma.feed.deleteMany({
      where: {
        status: "REJECTED",
        updatedAt: {
          lt: sevenDaysAgo,
        },
      },
    })

    result.deletedCount = deleted.count
    console.log(`Cleaned up ${deleted.count} rejected feeds`)
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Unknown error"
    console.error("Error cleaning up rejected feeds:", error)
  }

  return result
}

/**
 * Delete pending feeds older than 48 hours
 */
export async function cleanupOldPendingFeeds(): Promise<CleanupResult> {
  const result: CleanupResult = {
    job: "Old Pending Feeds Cleanup",
    deletedCount: 0,
  }

  try {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)

    const deleted = await prisma.feed.deleteMany({
      where: {
        status: "PENDING",
        createdAt: {
          lt: fortyEightHoursAgo,
        },
      },
    })

    result.deletedCount = deleted.count
    console.log(`Cleaned up ${deleted.count} old pending feeds`)
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Unknown error"
    console.error("Error cleaning up old pending feeds:", error)
  }

  return result
}

/**
 * Clean up old cancelled/failed scheduled posts (older than 30 days)
 */
export async function cleanupOldPosts(): Promise<CleanupResult> {
  const result: CleanupResult = {
    job: "Old Posts Cleanup",
    deletedCount: 0,
  }

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const deleted = await prisma.scheduledPost.deleteMany({
      where: {
        status: {
          in: ["CANCELLED", "FAILED"],
        },
        updatedAt: {
          lt: thirtyDaysAgo,
        },
      },
    })

    result.deletedCount = deleted.count
    console.log(`Cleaned up ${deleted.count} old cancelled/failed posts`)
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Unknown error"
    console.error("Error cleaning up old posts:", error)
  }

  return result
}

/**
 * Truncate old user post history (keep last 90 days)
 */
export async function cleanupOldPostHistory(): Promise<CleanupResult> {
  const result: CleanupResult = {
    job: "Old Post History Cleanup",
    deletedCount: 0,
  }

  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

    const deleted = await prisma.userPostHistory.deleteMany({
      where: {
        publishedAt: {
          lt: ninetyDaysAgo,
        },
      },
    })

    result.deletedCount = deleted.count
    console.log(`Cleaned up ${deleted.count} old post history entries`)
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Unknown error"
    console.error("Error cleaning up old post history:", error)
  }

  return result
}

/**
 * Run all cleanup jobs
 */
export async function runAllCleanupJobs(): Promise<CleanupResult[]> {
  console.log("Starting cleanup jobs...")

  const results = await Promise.all([
    cleanupRejectedFeeds(),
    cleanupOldPendingFeeds(),
    cleanupOldPosts(),
    cleanupOldPostHistory(),
  ])

  const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0)
  console.log(`Cleanup jobs completed. Total records deleted: ${totalDeleted}`)

  return results
}
