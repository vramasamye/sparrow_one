
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const email = "ramasamy.vignesh@gmail.com"
  
  // 1. Get User and Preferences
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      preferences: true,
      socialAccounts: true,
      userTopics: {
        include: {
          topic: true
        }
      }
    }
  })

  if (!user) {
    console.log(`User ${email} not found!`)
    return
  }

  console.log(`User found: ${user.id} (${user.name})`)
  console.log("Preferences:", user.preferences)
  console.log("Social Accounts:", user.socialAccounts.map(sa => `${sa.platform} (${sa.isActive ? 'Active' : 'Inactive'})`))
  console.log("Topics:", user.userTopics.map(ut => ut.topic.name))

  // 2. Check Approved Feeds that are NOT yet Generated
  const approvedFeeds = await prisma.feed.findMany({
    where: {
      status: "APPROVED",
      generatedPosts: {
        none: {} // No generated post exists for this feed
      }
    },
    take: 5
  })

  console.log(`\nFound ${await prisma.feed.count({ where: { status: "APPROVED" } })} TOTAL Approved Feeds`)
  console.log(`Found ${await prisma.feed.count({ where: { status: "APPROVED", generatedPosts: { none: {} } } })} Approved Feeds waiting for generation`)
  
  if (approvedFeeds.length > 0) {
    console.log("Sample waiting feed:", approvedFeeds[0].title)
  }

  // 3. Check Generated Posts Status
  const generatedStats = await prisma.generatedPost.groupBy({
    by: ['status'],
    _count: { id: true }
  })
  console.log("\nGenerated Post Statuses:", generatedStats)

  // 4. Check Scheduled Posts for today/future
  const scheduledPosts = await prisma.scheduledPost.findMany({
    where: {
      userId: user.id,
      scheduledFor: {
        gte: new Date()
      }
    },
    orderBy: {
      scheduledFor: 'asc'
    }
  })

  console.log(`\nFound ${scheduledPosts.length} future scheduled posts for user`)
  scheduledPosts.forEach(p => {
    console.log(`- [${p.status}] ${p.platform} at ${p.scheduledFor.toISOString()}`)
  })

}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
