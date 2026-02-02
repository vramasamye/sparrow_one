
import { PrismaClient } from "@prisma/client"
import { enqueueApprovedFeed } from "../src/lib/queue"

const prisma = new PrismaClient()

async function main() {
  // 1. Find all APPROVED feeds
  const approvedFeeds = await prisma.feed.findMany({
    where: {
      status: "APPROVED"
    },
    include: {
      generatedPosts: true
    }
  })

  console.log(`Total APPROVED feeds: ${approvedFeeds.length}`)

  for (const feed of approvedFeeds) {
    const gp = feed.generatedPosts[0]
    
    // CASE A: No generated post yet
    if (!gp) {
      console.log(`- Enqueuing: "${feed.title}" (No GP)`)
      await enqueueApprovedFeed(feed.id, "RECOVERY_ALL")
      continue
    }

    // CASE B: GP exists but is FAILED
    if (gp.status === "FAILED") {
      console.log(`- Enqueuing: "${feed.title}" (FAILED GP, retrying)`)
      await enqueueApprovedFeed(feed.id, "RECOVERY_RETRY")
      continue
    }

    // CASE C: GP is COMPLETED but not distributed
    if (gp.status === "COMPLETED") {
       console.log(`- Enqueuing: "${feed.title}" (COMPLETED but not distributed)`)
       await enqueueApprovedFeed(feed.id, "RECOVERY_DIST")
       continue
    }

    // CASE D: GP is DISTRIBUTED - verify it actually has scheduled posts
    if (gp.status === "DISTRIBUTED") {
      const scheduledCount = await prisma.scheduledPost.count({
        where: { feedId: feed.id }
      })
      if (scheduledCount === 0) {
        console.log(`- Enqueuing: "${feed.title}" (DISTRIBUTED but 0 scheduled posts)`)
        // Reset GP status so distributor picks it up
        await prisma.generatedPost.update({
          where: { id: gp.id },
          data: { status: "COMPLETED", distributedAt: null }
        })
        await enqueueApprovedFeed(feed.id, "RECOVERY_DIST_FIX")
      } else {
        console.log(`- Skipping: "${feed.title}" (Already has ${scheduledCount} scheduled posts)`)
      }
    }
  }

  console.log("\nQueue backfill complete.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
