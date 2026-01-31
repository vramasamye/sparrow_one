import { prisma } from "./prisma"

/**
 * Database connection manager for cron jobs in serverless environments
 *
 * Handles:
 * - Neon database wake-up (sleeps after inactivity)
 * - Explicit connection/disconnection for serverless
 * - Retry logic with exponential backoff
 * - Connection pooling
 */

const MAX_RETRIES = 5
const INITIAL_DELAY_MS = 1000

/**
 * Connect to database with retry logic for Neon wake-up
 * Neon databases sleep after inactivity and take ~1-3 seconds to wake up
 */
export async function connectDatabase(): Promise<void> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Explicitly connect Prisma
      await prisma.$connect()

      // Test the connection with a simple query
      await prisma.$queryRaw`SELECT 1`

      console.log(`✅ Database connected successfully (attempt ${attempt})`)
      return
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      const isConnectionError =
        lastError.message.includes("Can't reach database") ||
        lastError.message.includes("Engine is not yet connected") ||
        lastError.message.includes("Connection refused") ||
        lastError.message.includes("ECONNREFUSED")

      if (isConnectionError && attempt < MAX_RETRIES) {
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        const delayMs = INITIAL_DELAY_MS * Math.pow(2, attempt - 1)
        console.log(
          `⏳ Database connection attempt ${attempt}/${MAX_RETRIES} failed. ` +
          `Retrying in ${delayMs}ms... (Neon may be waking up)`
        )
        await new Promise(resolve => setTimeout(resolve, delayMs))
      } else if (!isConnectionError) {
        // Non-connection error, fail immediately
        console.error(`❌ Database error (not connection-related):`, lastError.message)
        throw lastError
      }
    }
  }

  // All retries failed
  console.error(`❌ Failed to connect to database after ${MAX_RETRIES} attempts`)
  throw new Error(
    `Database connection failed after ${MAX_RETRIES} retries. ` +
    `Last error: ${lastError?.message || 'Unknown'}`
  )
}

/**
 * Disconnect from database (cleanup for serverless)
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect()
    console.log("✅ Database disconnected")
  } catch (error) {
    console.warn("⚠️  Database disconnect warning:", error)
    // Don't throw, as this is just cleanup
  }
}

/**
 * Execute a function with automatic database connection/disconnection
 * Handles all connection management automatically
 *
 * @example
 * ```typescript
 * await withDatabase(async () => {
 *   const posts = await prisma.scheduledPost.findMany({...})
 *   // ... do work
 * })
 * ```
 */
export async function withDatabase<T>(
  fn: () => Promise<T>
): Promise<T> {
  try {
    await connectDatabase()
    const result = await fn()
    return result
  } finally {
    await disconnectDatabase()
  }
}

/**
 * Test database connectivity (useful for health checks)
 */
export async function testDatabaseConnection(): Promise<{
  connected: boolean
  latencyMs?: number
  error?: string
}> {
  const startTime = Date.now()

  try {
    await connectDatabase()
    const latencyMs = Date.now() - startTime
    await disconnectDatabase()

    return { connected: true, latencyMs }
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
