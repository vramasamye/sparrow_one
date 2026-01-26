import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"
import { prisma } from "@/lib/prisma"

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return process.env.NODE_ENV === "development"
  return authHeader === `Bearer ${cronSecret}`
}

interface Feed {
  source: string
  url: string
  reliability: string
  content_type: string
}

interface TopicData {
  topic_id: string
  topic_name: string
  description: string
  category: string
  update_frequency: string
  feeds: Feed[]
}

interface ImportData {
  topics: TopicData[]
}

/**
 * Import topics and RSS feeds from JSON file
 *
 * Protected endpoint - requires CRON_SECRET authorization
 *
 * Usage:
 * curl -X POST https://your-app.vercel.app/api/admin/import-topics \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 */
export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Read the JSON file
    const filePath = join(process.cwd(), "data", "topics-feeds.json")
    const fileContent = await readFile(filePath, "utf-8")
    const data: ImportData = JSON.parse(fileContent)

    const results = {
      topics: {
        created: 0,
        skipped: 0,
        errors: [] as string[],
      },
      feeds: {
        created: 0,
        skipped: 0,
        errors: [] as string[],
      },
      details: [] as any[],
    }

    // Process each topic
    for (const topicData of data.topics) {
      try {
        // Generate slug from topic name
        const slug = topicData.topic_name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")

        // Check if topic already exists
        let topic = await prisma.topic.findUnique({
          where: { slug },
        })

        if (topic) {
          console.log(`Topic "${topicData.topic_name}" already exists (${topic.id})`)
          results.topics.skipped++
        } else {
          // Create topic
          topic = await prisma.topic.create({
            data: {
              name: topicData.topic_name,
              slug,
              description: topicData.description,
            },
          })
          console.log(`Created topic: ${topicData.topic_name} (${topic.id})`)
          results.topics.created++
        }

        // Process feeds for this topic
        const topicResult = {
          topic: topicData.topic_name,
          topicId: topic.id,
          feeds: {
            created: [] as string[],
            skipped: [] as string[],
            errors: [] as string[],
          },
        }

        for (const feedData of topicData.feeds) {
          try {
            // Check if feed URL already exists
            const existingFeed = await prisma.rssFeed.findUnique({
              where: { url: feedData.url },
            })

            if (existingFeed) {
              console.log(`  Feed "${feedData.source}" already exists`)
              topicResult.feeds.skipped.push(feedData.source)
              results.feeds.skipped++
            } else {
              // Create RSS feed
              await prisma.rssFeed.create({
                data: {
                  name: feedData.source,
                  url: feedData.url,
                  topicId: topic.id,
                  isActive: true,
                },
              })
              console.log(`  Created feed: ${feedData.source}`)
              topicResult.feeds.created.push(feedData.source)
              results.feeds.created++
            }
          } catch (error) {
            const errorMsg = `Failed to create feed "${feedData.source}": ${error instanceof Error ? error.message : "Unknown error"}`
            console.error(`  ${errorMsg}`)
            topicResult.feeds.errors.push(errorMsg)
            results.feeds.errors.push(errorMsg)
          }
        }

        results.details.push(topicResult)
      } catch (error) {
        const errorMsg = `Failed to process topic "${topicData.topic_name}": ${error instanceof Error ? error.message : "Unknown error"}`
        console.error(errorMsg)
        results.topics.errors.push(errorMsg)
      }
    }

    return NextResponse.json({
      success: true,
      message: "Import completed",
      summary: {
        topics: `${results.topics.created} created, ${results.topics.skipped} skipped`,
        feeds: `${results.feeds.created} created, ${results.feeds.skipped} skipped`,
      },
      results,
    })
  } catch (error) {
    console.error("Import failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
