
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    include: {
      preferences: true
    }
  })

  console.log(`Checking ${users.length} users...`)
  let missing = 0

  for (const user of users) {
    if (!user.preferences) {
      console.log(`❌ User ${user.email} is MISSING preferences!`)
      missing++
    } else {
      console.log(`✅ User ${user.email} has preferences.`) 
    }
  }

  if (missing === 0) {
    console.log("\n✨ All users have preferences.")
  } else {
    console.log(`\n⚠️ ${missing} users are still missing preferences.`) 
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
