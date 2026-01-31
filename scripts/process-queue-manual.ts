
import { dequeueNextJob, markJobCompleted, markJobFailed } from "../src/lib/queue"
import { generatePostsForFeed } from "../src/lib/auto-generator"
import { distributeToSubscribers } from "../src/lib/auto-scheduler"
import { PrismaClient } from "@prisma/client"

// Mock withDatabase since it might be complex to import depending on how it's defined
const prisma = new PrismaClient()

async function main() {
  console.log("Processing queue manually...")

  const job = await dequeueNextJob()
  
  if (!job) {
    console.log("No jobs in queue.")
    return
  }

  console.log(`Picked up job for feed: ${job.feedId}`)

  try {
    // 1. Generate
    console.log("Generating posts...")
    const genResult = await generatePostsForFeed(job.feedId)
    
    if (!genResult.success) {
      console.error("Generation failed:", genResult.error)
      await markJobFailed(job, genResult.error || "Generation failed")
      return
    }
    console.log("✅ Generation success")

    // 2. Distribute
    console.log("Distributing...")
    const distResult = await distributeToSubscribers(job.feedId)
    
    if (!distResult.success) {
      console.error("Distribution failed:", distResult.errors)
      await markJobFailed(job, "Distribution failed")
      return
    }
    console.log("✅ Distribution success")
    console.log("Scheduled Stats:", {
      users: distResult.usersScheduled,
      twitter: distResult.twitterScheduled,
      linkedin: distResult.linkedinScheduled
    })

    // 3. Complete
    await markJobCompleted(job)
    console.log("✅ Job completed")

  } catch (e) {
    console.error("Processing error:", e)
    await markJobFailed(job, e instanceof Error ? e.message : "Unknown error")
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
