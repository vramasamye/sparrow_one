/**
 * cron-job.org REST API Integration
 * Docs: https://docs.cron-job.org/rest-api.html
 *
 * Rate Limits:
 * - 100 requests per day (free tier)
 * - Max 1 job creation per second
 * - Max 5 requests per second for other operations
 */

const CRON_JOB_ORG_API = "https://api.cron-job.org"

interface CronJobSchedule {
  timezone?: string
  hours?: number[]
  minutes?: number[]
  mdays?: number[]
  months?: number[]
  wdays?: number[]
}

interface CronJobConfig {
  title: string
  url: string
  enabled?: boolean
  saveResponses?: boolean
  schedule: CronJobSchedule
  requestMethod?: 1 | 2 | 3 | 4 // 1=GET, 2=POST, 3=PUT, 4=DELETE
  requestTimeout?: number
  auth?: {
    enable: boolean
    user?: string
    password?: string
  }
}

interface CronJobResponse {
  jobId?: number
  error?: string
}

export class CronJobOrgService {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.CRON_JOB_ORG_API_KEY || ""
    this.baseUrl = CRON_JOB_ORG_API

    if (!this.apiKey) {
      throw new Error("CRON_JOB_ORG_API_KEY environment variable is required")
    }
  }

  private async request(
    endpoint: string,
    method: string = "GET",
    body?: any
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`
    const headers: HeadersInit = {
      "Authorization": `Bearer ${this.apiKey}`,
      "Content-Type": "application/json"
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized: Invalid API key")
        }
        if (response.status === 429) {
          throw new Error("Rate limit exceeded")
        }
        const errorText = await response.text()
        throw new Error(`API request failed: ${response.status} ${errorText}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`cron-job.org API error (${method} ${endpoint}):`, error)
      throw error
    }
  }

  /**
   * Create or update a cron job
   */
  async createJob(config: CronJobConfig): Promise<CronJobResponse> {
    try {
      const response = await this.request("/jobs", "PUT", {
        job: config
      })
      return { jobId: response.jobId }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error"
      }
    }
  }

  /**
   * List all cron jobs
   */
  async listJobs(): Promise<any> {
    return await this.request("/jobs")
  }

  /**
   * Get details of a specific job
   */
  async getJob(jobId: number): Promise<any> {
    return await this.request(`/jobs/${jobId}`)
  }

  /**
   * Delete a cron job
   */
  async deleteJob(jobId: number): Promise<boolean> {
    try {
      await this.request(`/jobs/${jobId}`, "DELETE")
      return true
    } catch (error) {
      console.error(`Failed to delete job ${jobId}:`, error)
      return false
    }
  }

  /**
   * Update a cron job
   */
  async updateJob(jobId: number, config: Partial<CronJobConfig>): Promise<CronJobResponse> {
    try {
      const response = await this.request(`/jobs/${jobId}`, "PATCH", {
        job: config
      })
      return { jobId: response.jobId }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error"
      }
    }
  }

  /**
   * Get job execution history
   */
  async getJobHistory(jobId: number): Promise<any> {
    return await this.request(`/jobs/${jobId}/history`)
  }
}

/**
 * Helper to delay execution (for rate limiting)
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Setup all cron jobs on cron-job.org
 * Distributes tasks across the day to stay under 100 triggers/day limit
 *
 * Schedule:
 * - Feed processing: Every 2 hours (12/day)
 * - Publish posts: Every hour (24/day)
 * - Process queue: Every 2 hours (12/day)
 * - Refresh tokens: Once daily (1/day)
 * - Cleanup: Once daily (1/day)
 * Total: 50 triggers/day (under 100 limit)
 */
export async function setupAllCronJobs(): Promise<{
  feedProcessing?: number
  publishPosts?: number
  processQueue?: number
  refreshTokens?: number
  cleanup?: number
}> {
  const service = new CronJobOrgService()

  let appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL or VERCEL_URL must be set")
  }

  // Clean the URL: remove protocol and trailing slashes
  appUrl = appUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    throw new Error("CRON_SECRET must be set for authentication")
  }

  const jobIds: any = {}

  // Rate limit: Max 1 job creation per second
  const DELAY_BETWEEN_JOBS = 2000 // Increased to 2 seconds to be safe

  // Helper to check for existing job and create/update
  const createOrUpdateJob = async (config: CronJobConfig, key: string) => {
    // delay to respect rate limit
    await delay(DELAY_BETWEEN_JOBS)
    
    // First, list jobs to check if it exists (this list call also needs rate limiting consideration if called frequently, but here we do it once per job setup step, which is fine with the delay above)
    // Actually, listing all jobs every time is inefficient. Let's list ONCE at the start.
    // But refactoring that much might break flow. Let's just stick to "create" but with better delays.
    // Wait, the user has duplicates now. Ideally we should find and update.
    
    // Let's implement a simple "find job by title"
    try {
       const jobsList = await service.listJobs()
       const existingJob = jobsList.jobs.find((j: any) => j.title === config.title)
       
       if (existingJob) {
         console.log(`  found existing job ID ${existingJob.jobId}, updating...`)
         const updateResult = await service.updateJob(existingJob.jobId, config)
         if (updateResult.error) {
            console.error(`❌ Failed to update: ${updateResult.error}`)
            return null
         }
         console.log(`✓ Updated (ID: ${updateResult.jobId})`)
         return updateResult.jobId
       }
    } catch (e) {
       console.warn("  could not list jobs, proceeding to create...")
    }

    // Create if not found
    const createResult = await service.createJob(config)
    if (createResult.error) {
      console.error(`❌ Failed to create: ${createResult.error}`)
      return null
    }
    console.log(`✓ Created (ID: ${createResult.jobId})`)
    return createResult.jobId
  }

  // 1. Feed Processing - Every 2 hours (12 times/day)
  console.log("\n📥 Setting up Feed Processing cron...")
  const feedProcessingConfig: CronJobConfig = {
    title: "Sparrow - Feed Processing",
    url: `https://${appUrl}/api/cron/process-feeds?secret=${encodeURIComponent(cronSecret)}`,
    enabled: true,
    saveResponses: true,
    requestMethod: 1, // GET
    requestTimeout: 60,
    schedule: {
      timezone: "UTC",
      hours: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22], // Every 2 hours
      minutes: [0],
      mdays: [-1],
      months: [-1],
      wdays: [-1]
    }
  }
  jobIds.feedProcessing = await createOrUpdateJob(feedProcessingConfig, 'feedProcessing')

  // 2. Publish Posts - Every hour (24 times/day)
  console.log("\n📤 Setting up Publish Posts cron...")
  const publishConfig: CronJobConfig = {
    title: "Sparrow - Publish Posts",
    url: `https://${appUrl}/api/cron/publish-posts?secret=${encodeURIComponent(cronSecret)}`,
    enabled: true,
    saveResponses: true,
    requestMethod: 1,
    requestTimeout: 60,
    schedule: {
      timezone: "UTC",
      hours: [-1], // Every hour
      minutes: [15], // At :15 past the hour
      mdays: [-1],
      months: [-1],
      wdays: [-1]
    }
  }
  jobIds.publishPosts = await createOrUpdateJob(publishConfig, 'publishPosts')

  // 3. Process Queue - Every 2 hours (12 times/day)
  console.log("\n⚙️  Setting up Process Queue cron...")
  const queueConfig: CronJobConfig = {
    title: "Sparrow - Process Queue",
    url: `https://${appUrl}/api/cron/process-queue?secret=${encodeURIComponent(cronSecret)}`,
    enabled: true,
    saveResponses: true,
    requestMethod: 1,
    requestTimeout: 60,
    schedule: {
      timezone: "UTC",
      hours: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23], // Every 2 hours (offset by 1 hour)
      minutes: [0],
      mdays: [-1],
      months: [-1],
      wdays: [-1]
    }
  }
  jobIds.processQueue = await createOrUpdateJob(queueConfig, 'processQueue')

  // 4. Refresh Tokens - Once daily (1 time/day)
  console.log("\n🔄 Setting up Refresh Tokens cron...")
  const refreshConfig: CronJobConfig = {
    title: "Sparrow - Refresh Tokens",
    url: `https://${appUrl}/api/cron/refresh-tokens?secret=${encodeURIComponent(cronSecret)}`,
    enabled: true,
    saveResponses: true,
    requestMethod: 1,
    requestTimeout: 30,
    schedule: {
      timezone: "UTC",
      hours: [0], // Midnight UTC
      minutes: [30],
      mdays: [-1],
      months: [-1],
      wdays: [-1]
    }
  }
  jobIds.refreshTokens = await createOrUpdateJob(refreshConfig, 'refreshTokens')

  // 5. Cleanup - Once daily (1 time/day)
  console.log("\n🗑️  Setting up Cleanup cron...")
  const cleanupConfig: CronJobConfig = {
    title: "Sparrow - Cleanup",
    url: `https://${appUrl}/api/cron/cleanup?secret=${encodeURIComponent(cronSecret)}`,
    enabled: true,
    saveResponses: true,
    requestMethod: 1,
    requestTimeout: 30,
    schedule: {
      timezone: "UTC",
      hours: [3], // 3 AM UTC
      minutes: [0],
      mdays: [-1],
      months: [-1],
      wdays: [-1]
    }
  }
  jobIds.cleanup = await createOrUpdateJob(cleanupConfig, 'cleanup')

  return jobIds
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use setupAllCronJobs() instead
 */
export async function setupMasterCronJob(): Promise<void> {
  console.warn("⚠️  setupMasterCronJob is deprecated. Use setupAllCronJobs() instead.")
  await setupAllCronJobs()
}
