import { prisma } from "../src/lib/prisma"
import { processSingleFeed } from "../src/lib/feed-processor"
import { generatePost } from "../src/lib/ai"
import { Feed } from "@prisma/client"

async function main() {
  console.log("🚀 Starting feed flow test...")

  try {
    // 1. Get or Create a Topic
    console.log("1️⃣  Getting 'artificial-intelligence' topic...")
    const topic = await prisma.topic.upsert({
      where: { slug: "artificial-intelligence" },
      update: {},
      create: {
        name: "Artificial Intelligence",
        slug: "artificial-intelligence",
        description: "AI, Machine Learning, and Deep Learning news and research",
        icon: "brain",
      },
    })
    console.log(`   ✅ Topic ready: ${topic.name} (${topic.id})`)

    // 2. Get or Create an RSS Feed
    console.log("2️⃣  Getting 'OpenAI Blog' RSS feed...")
    const feedUrl = "https://openai.com/blog/rss/"
    const rssFeed = await prisma.rssFeed.upsert({
      where: { url: feedUrl },
      update: {
        topicId: topic.id,
      },
      create: {
        name: "OpenAI Blog",
        url: feedUrl,
        description: "Official OpenAI blog",
        topicId: topic.id,
      },
    })
    console.log(`   ✅ RSS Feed ready: ${rssFeed.name} (${rssFeed.id})`)

    // 3. Process the Feed (Fetch items)
    console.log("3️⃣  Processing feed (fetching items)...")
    const result = await processSingleFeed(
      rssFeed.id,
      rssFeed.url,
      rssFeed.name,
      topic.id
    )
    console.log(`   ✅ Processing Result:`, result)

    if (result.newItems === 0 && result.duplicates === 0) {
      console.warn("   ⚠️  No items found in feed. Is the feed URL correct and active?")
      // If no items, try to fetch an existing one to test generation
    }

    // 4. Select a Feed Item
    console.log("4️⃣  Selecting a feed item for post generation...")
    let feedItem: Feed | null = await prisma.feed.findFirst({
      where: { rssFeedId: rssFeed.id },
      orderBy: { publishedAt: 'desc' },
    })

    if (!feedItem) {
        console.warn("   ⚠️ No items found for this feed. Trying to find ANY feed item...")
        feedItem = await prisma.feed.findFirst({
             orderBy: { publishedAt: 'desc' },
        })
    }

    if (!feedItem) {
      console.error("   ❌ No feed items found in database to test generation.")
      process.exit(1)
    }

    console.log(`   ✅ Selected Item: "${feedItem.title}"`)
    console.log(`      URL: ${feedItem.url}`)

    // 5. Generate Posts
    console.log("5️⃣  Generating Social Media Posts...")
    
    // Twitter
    console.log("   🐦 Generating Twitter Post...")
    try {
        const twitterPost = await generatePost({
            title: feedItem.title,
            summary: feedItem.summary || feedItem.content?.substring(0, 200) || "",
            url: feedItem.url,
            platform: "twitter",
        })
        console.log("\n   --- Generated Tweet ---")
        console.log(twitterPost)
        console.log("   -----------------------")
    } catch (e) {
        console.error("   ❌ Twitter Generation Failed:", e)
    }

    // LinkedIn
    console.log("\n   💼 Generating LinkedIn Post...")
    try {
        const linkedinPost = await generatePost({
            title: feedItem.title,
            summary: feedItem.summary || feedItem.content?.substring(0, 200) || "",
            url: feedItem.url,
            platform: "linkedin",
        })
        console.log("\n   --- Generated LinkedIn Post ---")
        console.log(linkedinPost)
        console.log("   ---------------------------")
    } catch (e) {
        console.error("   ❌ LinkedIn Generation Failed:", e)
    }

    console.log("\n🎉 Test Complete!")

  } catch (error) {
    console.error("❌ Test Failed:", error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
