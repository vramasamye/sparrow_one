#!/usr/bin/env tsx

/**
 * Check scheduled posts status
 * Usage: npx tsx scripts/check-scheduled-posts.ts
 */

import { prisma } from "../src/lib/prisma"

async function main() {
  console.log("🔍 Checking Scheduled Posts Status\n")

  try {
    // Connect to database
    await prisma.$connect()
    console.log("✅ Database connected\n")

    const now = new Date()

    // Get scheduled posts summary
    const scheduled = await prisma.scheduledPost.count({
      where: { status: "SCHEDULED" }
    })

    const scheduledDue = await prisma.scheduledPost.count({
      where: {
        status: "SCHEDULED",
        scheduledFor: { lte: now }
      }
    })

    const publishing = await prisma.scheduledPost.count({
      where: { status: "PUBLISHING" }
    })

    const published = await prisma.scheduledPost.count({
      where: { status: "PUBLISHED" }
    })

    const failed = await prisma.scheduledPost.count({
      where: { status: "FAILED" }
    })

    console.log("📊 SUMMARY")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log(`Total Scheduled:     ${scheduled}`)
    console.log(`Due Now:             ${scheduledDue} 🔴`)
    console.log(`Publishing:          ${publishing}`)
    console.log(`Published:           ${published}`)
    console.log(`Failed:              ${failed}`)
    console.log("")

    // Get upcoming posts (next 24 hours)
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const upcoming = await prisma.scheduledPost.findMany({
      where: {
        status: "SCHEDULED",
        scheduledFor: {
          gte: now,
          lte: tomorrow
        }
      },
      include: {
        user: { select: { email: true } },
        socialAccount: { select: { platform: true, platformUsername: true } }
      },
      orderBy: { scheduledFor: "asc" },
      take: 10
    })

    if (upcoming.length > 0) {
      console.log("📅 UPCOMING (Next 24 hours)")
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      upcoming.forEach(post => {
        const timeUntil = Math.round((post.scheduledFor.getTime() - now.getTime()) / 60000)
        console.log(
          `${post.scheduledFor.toISOString()} (in ${timeUntil}m) - ${post.platform} - ${post.user.email}`
        )
      })
      console.log("")
    }

    // Get overdue posts
    const overdue = await prisma.scheduledPost.findMany({
      where: {
        status: "SCHEDULED",
        scheduledFor: { lte: now }
      },
      include: {
        user: { select: { email: true } },
        socialAccount: { select: { platform: true, platformUsername: true } }
      },
      orderBy: { scheduledFor: "asc" },
      take: 10
    })

    if (overdue.length > 0) {
      console.log("⚠️  OVERDUE POSTS")
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      overdue.forEach(post => {
        const minutesOverdue = Math.round((now.getTime() - post.scheduledFor.getTime()) / 60000)
        console.log(
          `${post.scheduledFor.toISOString()} (${minutesOverdue}m ago) - ${post.platform} - ${post.user.email}`
        )
        console.log(`  Content: ${post.content.substring(0, 60)}...`)
        console.log(`  ID: ${post.id}`)
        console.log("")
      })
    } else if (scheduledDue > 0) {
      console.log("⚠️  Posts due but not found in query (check time zones)")
      console.log("")
    }

    // Get recent failures
    const recentFailures = await prisma.scheduledPost.findMany({
      where: { status: "FAILED" },
      include: {
        user: { select: { email: true } },
        socialAccount: { select: { platform: true } }
      },
      orderBy: { updatedAt: "desc" },
      take: 5
    })

    if (recentFailures.length > 0) {
      console.log("❌ RECENT FAILURES")
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      recentFailures.forEach(post => {
        console.log(`${post.platform} - ${post.user.email}`)
        console.log(`  Error: ${post.errorMessage}`)
        console.log(`  Retries: ${post.retryCount}`)
        console.log(`  ID: ${post.id}`)
        console.log("")
      })
    }

    // Check for stuck "PUBLISHING" posts
    const stuckPublishing = await prisma.scheduledPost.findMany({
      where: {
        status: "PUBLISHING",
        updatedAt: {
          lte: new Date(now.getTime() - 5 * 60 * 1000) // Updated more than 5 minutes ago
        }
      }
    })

    if (stuckPublishing.length > 0) {
      console.log("🔧 STUCK IN PUBLISHING STATE")
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      console.log(`Found ${stuckPublishing.length} posts stuck in PUBLISHING state`)
      console.log("These should be reset to SCHEDULED or FAILED")
      console.log("")
    }

    await prisma.$disconnect()

  } catch (error) {
    console.error("❌ Error:", error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

main()
