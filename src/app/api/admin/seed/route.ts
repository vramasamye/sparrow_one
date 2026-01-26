import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// IMPORTANT: This endpoint should be protected or removed after initial setup
function verifySeedSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization")
  const seedSecret = process.env.SEED_SECRET || process.env.CRON_SECRET
  if (!seedSecret) return process.env.NODE_ENV === "development"
  return authHeader === `Bearer ${seedSecret}`
}

/**
 * One-time seed endpoint for production database
 * Call this after initial deployment to populate topics and RSS feeds
 *
 * Usage:
 * curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.vercel.app/api/admin/seed
 */
export async function POST(request: NextRequest) {
  if (!verifySeedSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if already seeded
    const topicCount = await prisma.topic.count()
    if (topicCount > 0) {
      return NextResponse.json({
        message: "Database already seeded",
        topicCount
      })
    }

    // Seed topics
    const topics = await prisma.topic.createMany({
      data: [
        {
          name: "AI & Machine Learning",
          slug: "ai-ml",
          description: "Latest developments in artificial intelligence and machine learning"
        },
        {
          name: "Web Development",
          slug: "web-dev",
          description: "Modern web development trends, frameworks, and best practices"
        },
        {
          name: "Cloud & DevOps",
          slug: "cloud-devops",
          description: "Cloud computing, DevOps practices, and infrastructure"
        },
        {
          name: "Cybersecurity",
          slug: "cybersecurity",
          description: "Security news, vulnerabilities, and best practices"
        },
        {
          name: "Blockchain & Web3",
          slug: "blockchain-web3",
          description: "Blockchain technology, cryptocurrencies, and Web3"
        }
      ]
    })

    // Get created topics to link RSS feeds
    const aiTopic = await prisma.topic.findUnique({ where: { slug: "ai-ml" } })
    const webDevTopic = await prisma.topic.findUnique({ where: { slug: "web-dev" } })

    // Seed RSS feeds
    if (aiTopic) {
      await prisma.rSSFeed.createMany({
        data: [
          {
            name: "OpenAI Blog",
            url: "https://openai.com/blog/rss/",
            topicId: aiTopic.id,
            isActive: true
          },
          {
            name: "DeepMind Blog",
            url: "https://deepmind.google/blog/rss.xml",
            topicId: aiTopic.id,
            isActive: true
          }
        ]
      })
    }

    if (webDevTopic) {
      await prisma.rSSFeed.createMany({
        data: [
          {
            name: "Vercel Blog",
            url: "https://vercel.com/blog/rss",
            topicId: webDevTopic.id,
            isActive: true
          },
          {
            name: "CSS-Tricks",
            url: "https://css-tricks.com/feed/",
            topicId: webDevTopic.id,
            isActive: true
          }
        ]
      })
    }

    const feedCount = await prisma.rSSFeed.count()

    return NextResponse.json({
      success: true,
      message: "Database seeded successfully",
      topicCount: 5,
      feedCount
    })
  } catch (error) {
    console.error("Seed failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
