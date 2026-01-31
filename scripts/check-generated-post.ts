
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const gp = await prisma.generatedPost.findFirst({
    where: { status: "DISTRIBUTED" },
    include: {
      feed: true
    }
  })

  if (!gp) {
    console.log("No DISTRIBUTED generated post found.")
    return
  }

  console.log(`Found generated post for feed: "${gp.feed.title}"`)
  console.log(`Status: ${gp.status}`)
  console.log(`Generated At: ${gp.generatedAt}`)

  // Check if any scheduled posts exist for this feed
  const scheduled = await prisma.scheduledPost.findMany({
    where: {
      feedId: gp.feedId
    }
  })

  console.log(`Scheduled posts for this feed: ${scheduled.length}`)
  
  if (scheduled.length === 0) {
    console.log("⚠️ Post is marked DISTRIBUTED but has 0 scheduled posts!")
    console.log("Resetting status to COMPLETED so it can be distributed again...")
    
    await prisma.generatedPost.update({
      where: { id: gp.id },
      data: {
        status: "COMPLETED", // Reset to COMPLETED so the distributor picks it up
        distributedAt: null
      }
    })
    console.log("✅ Reset complete.")
  } else {
    scheduled.forEach(p => {
      console.log(`- ${p.platform}: ${p.status} at ${p.scheduledFor}`)
    })
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
