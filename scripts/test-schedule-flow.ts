import { prisma } from "../src/lib/prisma"
import { processSingleFeed } from "../src/lib/feed-processor"
import { generatePost } from "../src/lib/ai"
import { encrypt } from "../src/lib/encryption"
import { Feed, User, SocialAccount } from "@prisma/client"
import { addHours, startOfDay, setHours, setMinutes } from "date-fns"

// Mock optimal times logic from route
const OPTIMAL_TIMES = {
  twitter: [9, 12, 15, 17, 19, 21],
  linkedin: [8, 10, 12, 14, 17, 19],
}

async function getNextPostingSlot(
  userId: string,
  platform: "TWITTER" | "LINKEDIN"
): Promise<Date> {
  const now = new Date()
  const today = startOfDay(now)
  const platformKey = platform.toLowerCase() as "twitter" | "linkedin"
  const optimalTimes = OPTIMAL_TIMES[platformKey]

  const todaysPosts = await prisma.scheduledPost.findMany({
    where: {
      userId,
      platform,
      scheduledFor: {
        gte: today,
        lt: addHours(today, 24),
      },
      status: { in: ["SCHEDULED", "PUBLISHING"] },
    },
    select: { scheduledFor: true },
  })

  const scheduledHours = new Set(
    todaysPosts.map((p) => new Date(p.scheduledFor).getUTCHours())
  )

  for (const hour of optimalTimes) {
    if (!scheduledHours.has(hour)) {
      const slotTime = setMinutes(setHours(today, hour), 0)
      if (slotTime > now) {
        return slotTime
      }
    }
  }

  const tomorrow = addHours(today, 24)
  const tomorrowsFirstSlot = setMinutes(setHours(tomorrow, optimalTimes[0]), 0)
  return tomorrowsFirstSlot
}

async function main() {
  console.log("🚀 Starting Schedule Flow Test...")

  try {
    // 1. Setup User
    console.log("1️⃣  Setting up Test User...")
    const user = await prisma.user.upsert({
        where: { email: "test-scheduler@example.com" },
        update: {},
        create: {
            email: "test-scheduler@example.com",
            name: "Test Scheduler",
            role: "ADMIN"
        }
    })
    console.log(`   ✅ User ready: ${user.email} (${user.id})`)

    // 2. Setup Social Account (Mock)
    console.log("2️⃣  Setting up Mock Social Account (Twitter)...")
    const socialAccount = await prisma.socialAccount.upsert({
        where: {
            userId_platform: {
                userId: user.id,
                platform: "TWITTER"
            }
        },
        update: {
            isActive: true
        },
        create: {
            userId: user.id,
            platform: "TWITTER",
            platformUserId: "mock-twitter-id",
            platformUsername: "mock_user",
            accessToken: encrypt("mock-access-token"),
            isActive: true
        }
    })
    console.log(`   ✅ Social Account ready: ${socialAccount.platform} (${socialAccount.id})`)

    // 3. Setup Topic & Feed
    console.log("3️⃣  Ensuring Feed Data...")
    const topic = await prisma.topic.upsert({
      where: { slug: "artificial-intelligence" },
      update: {},
      create: {
        name: "Artificial Intelligence",
        slug: "artificial-intelligence",
        description: "AI news",
        icon: "brain",
      },
    })
    
    const rssFeed = await prisma.rssFeed.upsert({
      where: { url: "https://openai.com/blog/rss/" },
      update: { topicId: topic.id },
      create: {
        name: "OpenAI Blog",
        url: "https://openai.com/blog/rss/",
        topicId: topic.id,
      },
    })

    // 4. Fetch Items
    await processSingleFeed(rssFeed.id, rssFeed.url, rssFeed.name, topic.id)
    
    const feedItem = await prisma.feed.findFirst({
        where: { rssFeedId: rssFeed.id },
        orderBy: { publishedAt: 'desc' }
    })

    if (!feedItem) {
        throw new Error("No feed items found even after processing!")
    }
    console.log(`   ✅ Feed Item selected: "${feedItem.title}" `)

    // 5. Generate Content
    console.log("4️⃣  Generating Content (via AI)...")
    // NOTE: If you don't have GROQ keys set, this might fail or fallback. 
    // You can mock this string if you want to test ONLY scheduling.
    // I'll try to run it real, assuming keys are present or I can catch it. 
    
    let content = "This is a fallback content because AI generation failed or was skipped."
    try {
        content = await generatePost({
            title: feedItem.title,
            summary: feedItem.summary || "",
            url: feedItem.url,
            platform: "twitter"
        })
        console.log("   ✅ Content generated successfully.")
    } catch (e) {
        console.warn("   ⚠️ AI Generation failed (expected if no keys), using fallback content.")
        console.error(e)
    }

    // 6. Schedule Post
    console.log("5️⃣  Scheduling Post...")
    
    // Calculate next slot
    const scheduledFor = await getNextPostingSlot(user.id, "TWITTER")
    console.log(`   🕒 Calculated Slot: ${scheduledFor.toISOString()}`)

    const scheduledPost = await prisma.scheduledPost.create({
        data: {
            userId: user.id,
            socialAccountId: socialAccount.id,
            feedId: feedItem.id,
            platform: "TWITTER",
            content: content,
            scheduledFor: scheduledFor,
            status: "SCHEDULED"
        }
    })

    console.log(`   ✅ Post Scheduled! ID: ${scheduledPost.id}`)
    console.log(`      Status: ${scheduledPost.status}`)
    console.log(`      Time: ${scheduledPost.scheduledFor}`)

    // 7. Verification
    const verifiedPost = await prisma.scheduledPost.findUnique({
        where: { id: scheduledPost.id }
    })

    if (verifiedPost) {
        console.log("\n🎉 Test Complete! Post verified in database.")
    } else {
        console.error("\n❌ Test Failed! Post not found in database.")
    }

  } catch (error) {
    console.error("\n❌ Test Failed:", error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
