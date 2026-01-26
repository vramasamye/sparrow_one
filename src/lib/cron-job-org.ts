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
 * Setup the master cron job on cron-job.org
 */
export async function setupMasterCronJob(): Promise<void> {
  const service = new CronJobOrgService()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL or VERCEL_URL must be set")
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    throw new Error("CRON_SECRET must be set for authentication")
  }

  const masterJobConfig: CronJobConfig = {
    title: "Sparrow.one Master Cron",
    url: `https://${appUrl}/api/cron/master?secret=${encodeURIComponent(cronSecret)}`,
    enabled: true,
    saveResponses: true,
    requestMethod: 1, // GET
    requestTimeout: 30,
    schedule: {
      timezone: "UTC",
      hours: [0], // Run at midnight UTC
      minutes: [0],
      mdays: [-1], // Every day
      months: [-1], // Every month
      wdays: [-1] // Every day of week
    }
  }

  console.log("Creating master cron job on cron-job.org...")
  const result = await service.createJob(masterJobConfig)

  if (result.error) {
    throw new Error(`Failed to create cron job: ${result.error}`)
  }

  console.log(`✓ Master cron job created successfully (ID: ${result.jobId})`)
}
