import { PrismaClient } from "@prisma/client"

/**
 * Verify that Prisma client knows about user_preferences table
 * This checks if the deployed code has the updated Prisma client
 */
async function verifyPrismaClient() {
  const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  })

  try {
    console.log("🔍 Verifying Prisma Client Configuration\n")

    // Test 1: Check if userPreferences model exists in Prisma client
    console.log("1️⃣ Testing userPreferences model access...")
    try {
      const count = await prisma.userPreferences.count()
      console.log(`   ✅ userPreferences model exists`)
      console.log(`   ✅ Can query table: ${count} rows found\n`)
    } catch (error) {
      console.log(`   ❌ userPreferences model NOT accessible`)
      console.log(`   Error: ${error}\n`)
      throw error
    }

    // Test 2: Check if user.preferences relation works
    console.log("2️⃣ Testing user.preferences relation...")
    try {
      const user = await prisma.user.findFirst({
        include: { preferences: true },
      })
      console.log(`   ✅ user.preferences relation works`)
      console.log(`   User: ${user?.email}`)
      console.log(`   Has preferences: ${user?.preferences ? "Yes" : "No"}\n`)
    } catch (error) {
      console.log(`   ❌ user.preferences relation NOT working`)
      console.log(`   Error: ${error}\n`)
      throw error
    }

    // Test 3: Check if userTopic.findMany with preferences works
    console.log("3️⃣ Testing userTopic query with preferences...")
    try {
      const subscriptions = await prisma.userTopic.findMany({
        take: 1,
        include: {
          user: {
            include: {
              preferences: true,
              socialAccounts: true,
            },
          },
        },
      })
      console.log(`   ✅ Complex query with preferences works`)
      console.log(`   Found ${subscriptions.length} subscription(s)\n`)
    } catch (error) {
      console.log(`   ❌ Complex query with preferences FAILED`)
      console.log(`   Error: ${error}\n`)
      throw error
    }

    // Test 4: Try to create a default preference
    console.log("4️⃣ Testing preference creation...")
    const testUser = await prisma.user.findFirst({
      where: { preferences: null },
    })

    if (testUser) {
      try {
        await prisma.userPreferences.create({
          data: {
            userId: testUser.id,
            timezone: "UTC",
            twitterTimes: [8, 10, 12, 14, 17, 19],
            linkedinTimes: [9, 11, 13, 16, 18, 20],
            postsPerWeek: 7,
            activeDays: [1, 2, 3, 4, 5],
          },
        })
        console.log(`   ✅ Can create preferences`)
        console.log(`   Created preference for: ${testUser.email}\n`)
      } catch (error) {
        console.log(`   ❌ Cannot create preferences`)
        console.log(`   Error: ${error}\n`)
        throw error
      }
    } else {
      console.log(`   ℹ️  All users already have preferences\n`)
    }

    console.log("✅ ALL TESTS PASSED!")
    console.log("✅ Prisma client is correctly configured with user_preferences\n")

    return true
  } catch (error) {
    console.error("\n❌ PRISMA CLIENT VERIFICATION FAILED")
    console.error("The deployed code still has the OLD Prisma client!")
    console.error("\nTo fix:")
    console.error("1. Run: npx prisma generate")
    console.error("2. Commit and push to trigger new deployment")
    console.error("3. Or set: USE_LEGACY_SCHEDULING=true in Vercel env\n")
    return false
  } finally {
    await prisma.$disconnect()
  }
}

verifyPrismaClient().then((success) => {
  process.exit(success ? 0 : 1)
})
