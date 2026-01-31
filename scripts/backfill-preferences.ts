
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Checking for users without preferences...")

  // Find users who have NO preferences
  const usersWithoutPrefs = await prisma.user.findMany({
    where: {
      preferences: null
    },
    select: {
      id: true,
      email: true,
      name: true
    }
  })

  console.log(`Found ${usersWithoutPrefs.length} users without preferences.`)

  for (const user of usersWithoutPrefs) {
    console.log(`Creating default preferences for user: ${user.email} (${user.id})`)
    
    try {
      await prisma.userPreferences.create({
        data: {
          userId: user.id
          // Defaults from schema will apply automatically
        }
      })
      console.log(`✅ Success for ${user.email}`)
    } catch (e) {
      console.error(`❌ Failed for ${user.email}:`, e)
    }
  }

  console.log("Backfill complete.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
