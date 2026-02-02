
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const topics = await prisma.topic.findMany({
    include: {
      _count: {
        select: {
          userTopics: true,
          feeds: {
            where: {
              status: "APPROVED"
            }
          }
        }
      }
    }
  })

  console.log("Topic Statistics:")
  for (const topic of topics) {
    console.log(`- Topic: ${topic.name}`)
    console.log(`  Subscribers: ${topic._count.userTopics}`)
    console.log(`  Approved Feeds: ${topic._count.feeds}`)
    
    if (topic._count.userTopics > 0 && topic._count.feeds > 0) {
      // Check if these approved feeds have generated posts
      const approvedFeeds = await prisma.feed.findMany({
        where: {
          topicId: topic.id,
          status: "APPROVED"
        },
        include: {
          generatedPosts: true
        }
      })
      
      const missingGeneration = approvedFeeds.filter(f => f.generatedPosts.length === 0).length
      const waitingDistribution = approvedFeeds.filter(f => 
        f.generatedPosts.length > 0 && f.generatedPosts[0].status === "COMPLETED"
      ).length
      
      console.log(`  Waiting for Generation: ${missingGeneration}`)
      console.log(`  Waiting for Distribution: ${waitingDistribution}`)
    }
    console.log("")
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
