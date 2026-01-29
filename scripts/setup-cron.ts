#!/usr/bin/env tsx

/**
 * Setup Script for cron-job.org Integration
 *
 * This script sets up multiple cron jobs on cron-job.org
 * Each job runs on its own schedule optimized for the 100 triggers/day limit
 *
 * Usage:
 *   npm run setup-cron                    (uses balanced strategy)
 *   npm run setup-cron balanced           (96 runs/day - recommended)
 *   npm run setup-cron light              (48 runs/day - minimal automation)
 *   npm run setup-cron full               (50 runs/day - complete automation)
 *
 * Strategies:
 *   balanced - Queue every 20min (72), Posts every 1hr (24) = 96/day
 *   light    - Queue every 30min (48), Posts every 1hr (24) = 48/day
 *   full     - All 5 jobs automated = 50/day
 */

import { setupAllCronJobs, getCronStrategy, type CronStrategy } from "../src/lib/cron-job-org"
import dotenv from "dotenv"

// Load environment variables
dotenv.config({ path: ".env.local" })

// Get strategy from command line argument
const args = process.argv.slice(2)
let strategy: CronStrategy = 'balanced' // Default

if (args.length > 0) {
  const inputStrategy = args[0].toLowerCase()
  if (['balanced', 'light', 'full'].includes(inputStrategy)) {
    strategy = inputStrategy as CronStrategy
  } else {
    console.error(`\n❌ Invalid strategy: ${args[0]}`)
    console.error(`   Valid options: balanced, light, full\n`)
    process.exit(1)
  }
}

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
  console.log(`  Strategy: ${strategy}`)
  console.log(`  API URL: ${process.env.NEXT_PUBLIC_APP_URL}`)
  console.log(`  Cron Secret: ${process.env.CRON_SECRET?.substring(0, 10)}...`)
  console.log()

  // Get strategy details
  const strategyConfig = getCronStrategy(strategy)

  console.log(`Setting up cron jobs using '${strategyConfig.name}' strategy`)
  console.log(`${strategyConfig.description}`)
  console.log(`Total runs per day: ${strategyConfig.totalRuns}`)

  try {
    const jobIds = await setupAllCronJobs(strategy)

    console.log()
    console.log("=".repeat(60))
    console.log("✓ Setup completed successfully!")
    console.log("=".repeat(60))
    console.log()
    console.log("Created/Updated Jobs:")

    if (jobIds.processQueue) {
      console.log(`  ⚙️  Process Queue: ID ${jobIds.processQueue}`)
    }
    if (jobIds.publishPosts) {
      console.log(`  📤 Publish Posts: ID ${jobIds.publishPosts}`)
    }
    if (jobIds.feedProcessing) {
      console.log(`  📥 Feed Processing: ID ${jobIds.feedProcessing}`)
    }
    if (jobIds.refreshTokens) {
      console.log(`  🔄 Refresh Tokens: ID ${jobIds.refreshTokens}`)
    }
    if (jobIds.cleanup) {
      console.log(`  🗑️  Cleanup: ID ${jobIds.cleanup}`)
    }

    console.log()
    console.log(`Total triggers per day: ${strategyConfig.totalRuns} (under 100 limit) ✓`)
    console.log()

    // Show which jobs are manual
    const manualJobs = []
    if (!strategyConfig.jobs.processFeeds?.enabled) manualJobs.push('process-feeds')
    if (!strategyConfig.jobs.refreshTokens?.enabled) manualJobs.push('refresh-tokens')
    if (!strategyConfig.jobs.cleanup?.enabled) manualJobs.push('cleanup')

    if (manualJobs.length > 0) {
      console.log("Manual Jobs (run when needed):")
      if (manualJobs.includes('process-feeds')) {
        console.log(`  📥 Feed Processing: ${process.env.NEXT_PUBLIC_APP_URL}/api/cron/process-feeds?secret=...`)
      }
      if (manualJobs.includes('refresh-tokens')) {
        console.log(`  🔄 Refresh Tokens: ${process.env.NEXT_PUBLIC_APP_URL}/api/cron/refresh-tokens?secret=...`)
      }
      if (manualJobs.includes('cleanup')) {
        console.log(`  🗑️  Cleanup: ${process.env.NEXT_PUBLIC_APP_URL}/api/cron/cleanup?secret=...`)
      }
      console.log()
    }

    console.log("Next steps:")
    console.log("  1. Visit https://console.cron-job.org to view your jobs")
    console.log("  2. Verify all jobs are enabled and scheduled correctly")
    console.log("  3. Monitor the first execution of each job")
    console.log("  4. Check job history for any failures")
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
    console.error("  4. Check that all API endpoints are deployed and working")
    console.error()
    process.exit(1)
  }
}

main()
