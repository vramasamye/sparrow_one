import { NextRequest, NextResponse } from "next/server"
import { CronJobOrgService } from "@/lib/cron-job-org"

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return process.env.NODE_ENV === "development"
  return authHeader === `Bearer ${cronSecret}`
}

/**
 * Manage cron-job.org jobs
 *
 * GET /api/cron/manage - List all jobs
 * POST /api/cron/manage - Create a new job
 * DELETE /api/cron/manage?jobId=123 - Delete a job
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const service = new CronJobOrgService()
    const jobs = await service.listJobs()
    return NextResponse.json({ success: true, jobs })
  } catch (error) {
    console.error("Failed to list cron jobs:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get("jobId")

  if (!jobId) {
    return NextResponse.json(
      { error: "jobId parameter is required" },
      { status: 400 }
    )
  }

  try {
    const service = new CronJobOrgService()
    const success = await service.deleteJob(parseInt(jobId))

    return NextResponse.json({ success })
  } catch (error) {
    console.error("Failed to delete cron job:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
