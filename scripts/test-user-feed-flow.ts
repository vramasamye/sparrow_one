import { prisma } from "../src/lib/prisma"
import { processFeedsForTopics } from "../src/lib/feed-processor"
import { generatePost } from "../src/lib/ai"

async function main() {
  console.log("🚀 Starting User Feed Flow Test...")

  try {
    // 1. Find User (Admin)
    console.log("1️⃣  Finding Admin User...")
    let user = await prisma.user.findFirst({
        where: { role: "ADMIN" }
    })
    
    if (!user) {
        console.log("   ⚠️ No Admin user found. Creating one...")
        user = await prisma.user.create({
            data: {
                email: "admin-tester@example.com",
                name: "Admin Tester",
                role: "ADMIN"
            }
        })
    }
    console.log(`   ✅ User identified: ${user.email} (${user.role})`)

    // 2. Identify a Topic
    console.log("2️⃣  Identifying Topic...")
    const topicSlug = "artificial-intelligence"
    const topic = await prisma.topic.findUnique({
        where: { slug: topicSlug }
    })

    if (!topic) {
        throw new Error(`Topic '${topicSlug}' not found. Please run seed.`)
    }
    console.log(`   ✅ Topic found: ${topic.name}`)

    // 3. Ensure User Subscription
    console.log("3️⃣  Checking User Subscription...")
    const existingSub = await prisma.userTopic.findUnique({
        where: {
            userId_topicId: {
                userId: user.id,
                topicId: topic.id
            }
        }
    })

    if (!existingSub) {
        console.log("   ➕ Subscribing user to topic...")
        await prisma.userTopic.create({
            data: {
                userId: user.id,
                topicId: topic.id
            }
        })
    } else {
        console.log("   ✅ User is already subscribed.")
    }

    // 4. Fetch Feeds (Optimized for Subscribed Topic)
    console.log("4️⃣  Fetching Feeds for Subscribed Topic...")
    // In a real scenario, we'd get all topics for the user:
    const userTopics = await prisma.userTopic.findMany({
        where: { userId: user.id },
        select: { topicId: true }
    })
    const topicIds = userTopics.map(ut => ut.topicId)
    
    // Filter to just our target topic for this test to be specific
    const targetTopicIds = topicIds.filter(id => id === topic.id)
    
    if (targetTopicIds.length === 0) {
        throw new Error("User subscription failed or mismatch.")
    }

    const results = await processFeedsForTopics(targetTopicIds)
    const newItemsCount = results.reduce((acc, r) => acc + r.newItems, 0)
    console.log(`   ✅ Fetched ${newItemsCount} new items from ${results.length} feeds.`)

    // 5. Select a Feed Item (and reset to PENDING to test flow)
    console.log("5️⃣  Selecting a Feed Item...")
    let itemToProcess = await prisma.feed.findFirst({
        where: { topicId: topic.id },
        orderBy: { publishedAt: 'desc' }
    })

    if (!itemToProcess) {
        throw new Error("No feed items available to process.")
    }

    console.log(`   ✅ Selected Item: "${itemToProcess.title}"`)
    console.log(`      Current Status: ${itemToProcess.status}`)

    // Reset to PENDING to simulate new item needing approval
    if (itemToProcess.status !== "PENDING") {
        console.log("   🔄 Resetting item to PENDING for test purposes...")
        itemToProcess = await prisma.feed.update({
            where: { id: itemToProcess.id },
            data: { status: "PENDING", approvedAt: null, approvedBy: null }
        })
    }

    // 6. Approve the Item (Simulate Admin Action)
    console.log("6️⃣  Approving Item (Admin Action)...")
    if (itemToProcess.status === "PENDING") {
        itemToProcess = await prisma.feed.update({
            where: { id: itemToProcess.id },
            data: { 
                status: "APPROVED",
                approvedAt: new Date(),
                approvedBy: user.id
            }
        })
        console.log("   ✅ Item APPROVED.")
    } else {
        console.log("   ⚠️ Item was not PENDING (Unexpected).")
    }

    // 7. Generate Post using GROQ
    console.log("7️⃣  Generating Post (GROQ)...")
    try {
        const postContent = await generatePost({
            title: itemToProcess.title,
            summary: itemToProcess.summary || "",
            url: itemToProcess.url,
            platform: "linkedin" // Testing LinkedIn format
        })
        
        console.log("\n   --- Generated Content ---")
        console.log(postContent)
        console.log("   -------------------------\
")
        
        console.log("🎉 Flow Complete: Subscription -> Fetch -> Approve -> Generate")

    } catch (e) {
        console.error("   ❌ Generation Failed (Check API Keys/Limits):")
        if (e instanceof Error) console.error("      " + e.message)
    }

  } catch (error) {
    console.error("\n❌ Test Failed:", error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
