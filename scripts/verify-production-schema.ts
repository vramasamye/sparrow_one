import { PrismaClient } from "@prisma/client"

/**
 * Verify production database schema
 * Run with: PRODUCTION_DATABASE_URL="..." tsx scripts/verify-production-schema.ts
 */
async function verifyProductionSchema() {
  const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL

  if (!dbUrl) {
    console.error("❌ No database URL found. Set PRODUCTION_DATABASE_URL or DATABASE_URL")
    process.exit(1)
  }

  console.log("🔍 Connecting to database...")
  console.log(`   URL: ${dbUrl.split("@")[1]}`) // Hide credentials

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  })

  try {
    // Check if user_preferences table exists
    console.log("\n📊 Checking user_preferences table...")

    const result = await prisma.$queryRaw<
      Array<{ table_name: string }>
    >`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_preferences'`

    if (result.length === 0) {
      console.log("❌ user_preferences table does NOT exist")
      console.log("\n📝 Available tables:")
      const allTables = await prisma.$queryRaw<
        Array<{ table_name: string }>
      >`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
      allTables.forEach((t) => console.log(`   - ${t.table_name}`))
    } else {
      console.log("✅ user_preferences table EXISTS")

      // Check table structure
      const columns = await prisma.$queryRaw<
        Array<{ column_name: string; data_type: string; is_nullable: string }>
      >`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'user_preferences' ORDER BY ordinal_position`

      console.log("\n📋 Table structure:")
      columns.forEach((col) => {
        console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === "NO" ? "NOT NULL" : "NULL"}`)
      })

      // Check if any user preferences exist
      const count = await prisma.$queryRaw<
        Array<{ count: bigint }>
      >`SELECT COUNT(*) as count FROM user_preferences`
      console.log(`\n📊 Row count: ${count[0].count}`)
    }

    // Check migration status
    console.log("\n📜 Migration history (last 5):")
    const migrations = await prisma.$queryRaw<
      Array<{
        migration_name: string
        finished_at: Date | null
        applied_steps_count: number
      }>
    >`SELECT migration_name, finished_at, applied_steps_count FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5`

    migrations.forEach((m) => {
      const status = m.finished_at ? "✅" : "⏳"
      console.log(`   ${status} ${m.migration_name} (${m.applied_steps_count} steps)`)
    })

    // Check users count
    console.log("\n👥 Users in database:")
    const userCount = await prisma.user.count()
    console.log(`   Total users: ${userCount}`)

    // Check if users have preferences
    if (result.length > 0) {
      const usersWithPrefs = await prisma.$queryRaw<
        Array<{ count: bigint }>
      >`SELECT COUNT(DISTINCT u.id) as count FROM users u LEFT JOIN user_preferences up ON u.id = up."userId" WHERE up.id IS NOT NULL`
      console.log(`   Users with preferences: ${usersWithPrefs[0].count}`)
    }

    console.log("\n✅ Verification complete")
  } catch (error) {
    console.error("\n❌ Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyProductionSchema()
