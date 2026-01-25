// Load environment variables
import dotenv from "dotenv"
import path from "path"
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

import { prisma } from "../src/lib/prisma"

async function main() {
  console.log("🔍 Debugging Publishing System\n")
  console.log("=" .repeat(60))

  try {
    // 1. Check all scheduled posts
    console.log("\n1️⃣  All Scheduled Posts:")
    const allScheduled = await prisma.scheduledPost.findMany({
      include: {
        user: { select: { email: true } },
        socialAccount: { select: { platform: true, isActive: true } }
      },
      orderBy: { scheduledFor: 'asc' }
    })

    console.log(`   Total: ${allScheduled.length}`)
    allScheduled.forEach(post => {
      console.log(`   - ${post.platform} for ${post.user.email}`)
      console.log(`     Status: ${post.status}`)
      console.log(`     Scheduled: ${post.scheduledFor.toISOString()}`)
      console.log(`     Account Active: ${post.socialAccount.isActive}`)
      console.log(`     Content Length: ${post.content.length} chars`)
      console.log("")
    })

    // 2. Check posts due NOW
    console.log("\n2️⃣  Posts Due NOW (scheduledFor <= NOW):")
    const now = new Date()
    const dueNow = await prisma.scheduledPost.findMany({
      where: {
        status: "SCHEDULED",
        scheduledFor: { lte: now }
      },
      include: {
        user: { select: { email: true } },
        socialAccount: { select: { platform: true, isActive: true, accessToken: true } }
      }
    })

    console.log(`   Found: ${dueNow.length} posts ready to publish`)

    if (dueNow.length === 0) {
      console.log("\n   ⚠️  No posts are due for publishing!")
      console.log("   Possible reasons:")
      console.log("   - All posts scheduled for future times")
      console.log("   - No posts have status='SCHEDULED'")
      console.log("   - Posts already published")
    } else {
      dueNow.forEach(post => {
        console.log(`\n   Post ${post.id}:`)
        console.log(`     User: ${post.user.email}`)
        console.log(`     Platform: ${post.platform}`)
        console.log(`     Scheduled: ${post.scheduledFor.toISOString()}`)
        console.log(`     Account Active: ${post.socialAccount.isActive}`)
        console.log(`     Has Access Token: ${!!post.socialAccount.accessToken}`)
        console.log(`     Content: "${post.content.substring(0, 100)}..."`)
      })
    }

    // 3. Check by status
    console.log("\n3️⃣  Posts by Status:")
    const byStatus = await prisma.scheduledPost.groupBy({
      by: ['status'],
      _count: true
    })
    byStatus.forEach(stat => {
      console.log(`   ${stat.status}: ${stat._count}`)
    })

    // 4. Check social accounts
    console.log("\n4️⃣  Social Accounts:")
    const accounts = await prisma.socialAccount.findMany({
      include: {
        user: { select: { email: true } }
      }
    })

    console.log(`   Total: ${accounts.length}`)
    accounts.forEach(acc => {
      console.log(`   - ${acc.user.email}: ${acc.platform}`)
      console.log(`     Active: ${acc.isActive}`)
      console.log(`     Has Token: ${!!acc.accessToken}`)
      console.log(`     Token Length: ${acc.accessToken.length} chars`)
      console.log("")
    })

    // 5. Check encryption key
    console.log("\n5️⃣  Environment Check:")
    console.log(`   ENCRYPTION_KEY: ${process.env.ENCRYPTION_KEY ? '✅ Set' : '❌ Not set'}`)
    console.log(`   CRON_SECRET: ${process.env.CRON_SECRET ? '✅ Set' : '❌ Not set'}`)

    // 6. Suggest next steps
    console.log("\n" + "=".repeat(60))
    console.log("\n💡 Recommendations:")

    if (dueNow.length === 0) {
      console.log("\n   To test publishing immediately:")
      console.log("   1. Find a scheduled post ID from above")
      console.log("   2. Update its scheduledFor to past time:")
      console.log("      ")
      console.log("      UPDATE scheduled_posts")
      console.log("      SET \"scheduledFor\" = NOW() - INTERVAL '1 minute'")
      console.log("      WHERE id = 'your-post-id';")
      console.log("      ")
      console.log("   3. Then run: curl http://localhost:3000/api/cron/publish-posts \\")
      console.log("                  -H \"Authorization: Bearer dev-cron-secret\"")
    }

    if (accounts.length === 0) {
      console.log("\n   ⚠️  No social accounts connected!")
      console.log("   - Connect Twitter/LinkedIn via UI first")
    }

    if (!process.env.ENCRYPTION_KEY) {
      console.log("\n   ❌ ENCRYPTION_KEY not set!")
      console.log("   - Generate: openssl rand -hex 32")
      console.log("   - Add to .env.local")
    }

  } catch (error) {
    console.error("\n❌ Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
