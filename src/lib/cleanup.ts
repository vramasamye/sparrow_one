import { prisma } from "./prisma"

interface CleanupResult {
  job: string
  deletedCount: number
  error?: string
}

/**
 * Delete rejected feeds older than 24 hours (or ALL if force=true)
 */
export async function cleanupRejectedFeeds(force = false): Promise<CleanupResult> {
  const result: CleanupResult = {
    job: "Rejected Feeds Cleanup",
    deletedCount: 0,
  }

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const where = force 
      ? { status: "REJECTED" } // Delete ALL rejected if force=true
      : { 
          status: "REJECTED",
          updatedAt: {
            lt: twentyFourHoursAgo,
          },
        }

    // @ts-ignore - Prisma where clause is compatible but TS might complain about simple vs complex object
    const deleted = await prisma.feed.deleteMany({
      where: where as any,
    })

    result.deletedCount = deleted.count
    console.log(`Cleaned up ${deleted.count} rejected feeds ${force ? '(ALL)' : '(older than 24 hours)'}`)
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
 * Clean up old cancelled/failed scheduled posts (older than 24 hours)
 */
export async function cleanupOldPosts(): Promise<CleanupResult> {
  const result: CleanupResult = {
    job: "Old Posts Cleanup",
    deletedCount: 0,
  }

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const deleted = await prisma.scheduledPost.deleteMany({
      where: {
        status: {
          in: ["CANCELLED", "FAILED"],
        },
        updatedAt: {
          lt: twentyFourHoursAgo,
        },
      },
    })

    result.deletedCount = deleted.count
    console.log(`Cleaned up ${deleted.count} old cancelled/failed posts (older than 24 hours)`)
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
export async function runAllCleanupJobs(force = false): Promise<CleanupResult[]> {
  console.log(`Starting cleanup jobs... ${force ? '(FORCE MODE)' : ''}`)

  const results = await Promise.all([
    cleanupRejectedFeeds(force),
    cleanupOldPendingFeeds(),
    cleanupOldPosts(),
    cleanupOldPostHistory(),
  ])

  const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0)
  console.log(`Cleanup jobs completed. Total records deleted: ${totalDeleted}`)

  return results
}
