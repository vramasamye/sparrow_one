import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const email = "ramasamy.vignesh@gmail.com"
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      userTopics: {
        include: {
          topic: {
            include: {
              feeds: {
                where: {
                  status: "APPROVED"
                }
              }
            }
          }
        }
      }
    }
  })

  if (!user) {
    console.log("User not found")
    return
  }

  console.log(`User: ${user.email}`)
  console.log(`Topics subscribed: ${user.userTopics.length}`)
  
  for (const ut of user.userTopics) {
    console.log(`- ${ut.topic.name}: ${ut.topic.feeds.length} approved feeds`)
    if (ut.topic.feeds.length > 0) {
       for (const feed of ut.topic.feeds) {
         console.log(`  * [${feed.id}] ${feed.title}`)
       }
    }
  }

  // Check all approved feeds generally
  const allApproved = await prisma.feed.count({ where: { status: "APPROVED" } })
  console.log(`
Total approved feeds in DB: ${allApproved}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
