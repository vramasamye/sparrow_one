#!/usr/bin/env tsx

/**
 * Setup Script for cron-job.org Integration
 *
 * This script sets up the master cron job on cron-job.org
 * Run this after deploying to Vercel or when changing cron configuration
 *
 * Usage:
 *   npm run setup-cron
 *   or
 *   tsx scripts/setup-cron.ts
 */

import { setupMasterCronJob } from "../src/lib/cron-job-org"
import dotenv from "dotenv"

// Load environment variables
dotenv.config({ path: ".env.local" })

async function main() {
  console.log("=".repeat(60))
  console.log("Setting up cron-job.org integration")
  console.log("=".repeat(60))
  console.log()

  // Validate required environment variables
  const required = [
    "CRON_JOB_ORG_API_KEY",
    "CRON_SECRET",
    "NEXT_PUBLIC_APP_URL"
  ]

  const missing = required.filter(key => !process.env[key])
  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:")
    missing.forEach(key => console.error(`   - ${key}`))
    console.log()
    console.log("Please set these in your .env.local file or environment")
    process.exit(1)
  }

  console.log("Environment variables validated ✓")
  console.log()
  console.log("Configuration:")
  console.log(`  API URL: ${process.env.NEXT_PUBLIC_APP_URL}`)
  console.log(`  Cron Secret: ${process.env.CRON_SECRET?.substring(0, 10)}...`)
  console.log()

  try {
    await setupMasterCronJob()
    console.log()
    console.log("=".repeat(60))
    console.log("✓ Setup completed successfully!")
    console.log("=".repeat(60))
    console.log()
    console.log("Next steps:")
    console.log("  1. Visit https://console.cron-job.org to view your jobs")
    console.log("  2. Verify the job is enabled and scheduled correctly")
    console.log("  3. Monitor the first execution")
    console.log()
  } catch (error) {
    console.error()
    console.error("=".repeat(60))
    console.error("❌ Setup failed!")
    console.error("=".repeat(60))
    console.error()
    console.error("Error:", error instanceof Error ? error.message : error)
    console.error()
    console.error("Troubleshooting:")
    console.error("  1. Verify your CRON_JOB_ORG_API_KEY is valid")
    console.error("  2. Check you haven't exceeded the daily limit (100 requests)")
    console.error("  3. Ensure your app URL is accessible publicly")
    console.error()
    process.exit(1)
  }
}

main()
