import { redis } from "../src/lib/redis"
import { enqueueApprovedFeed, getQueueStats, peekQueue, recoverStuckJobs } from "../src/lib/queue"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Checking Queue Stats...")
  const stats = await getQueueStats()
  console.log("Stats:", stats)

  console.log("\nPeeking Queue (Top 5):")
  const jobs = await peekQueue(5)
  jobs.forEach(j => console.log(`- Feed: ${j.feedId}, ApprovedBy: ${j.approvedBy}`))

  // Find the waiting approved feed
  const feed = await prisma.feed.findFirst({
    where: {
      status: "APPROVED",
      generatedPosts: { none: {} }
    }
  })

  if (!feed) {
    console.log("\nNo waiting approved feed found in DB.")
    return
  }

  console.log(`\nFound waiting feed in DB: "${feed.title}" (${feed.id})`)

  // Check if it's in the queue
  const isQueued = jobs.some(j => j.feedId === feed.id)
  
  // We only peeked 5, let's check properly if the queue is large
  // But for now, if stats.queued is small, peeking is enough.
  
  if (!isQueued && stats.queued < 100) {
     // Verify deeply if stats are small
     const allJobs = await peekQueue(100)
     if (allJobs.some(j => j.feedId === feed.id)) {
       console.log("✅ Feed is already in the queue.")
       return
     }
  }

  if (!isQueued) {
    console.log("⚠️ Feed is NOT in the queue!")
    console.log("Enqueuing it now...")
    await enqueueApprovedFeed(feed.id, "MANUAL_RECOVERY")
    console.log("✅ Feed enqueued.")
  } else {
    console.log("✅ Feed is already in the queue.")
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    // Redis disconnect isn't strictly needed for script exit but good practice
    // but the redis lib might not expose it easily.
    process.exit(0) 
  })
