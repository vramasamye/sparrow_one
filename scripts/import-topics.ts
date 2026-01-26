#!/usr/bin/env tsx

/**
 * Import topics and RSS feeds from JSON file
 *
 * This script imports all topics and RSS feeds from data/topics-feeds.json
 * into the database.
 *
 * Usage:
 *   # Import to local database
 *   npm run import-topics
 *
 *   # Import to production (set DATABASE_URL first)
 *   DATABASE_URL="your-production-url" npm run import-topics
 */

import { readFile } from "fs/promises"
import { join } from "path"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

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

async function main() {
  console.log("=".repeat(60))
  console.log("Importing Topics and RSS Feeds")
  console.log("=".repeat(60))
  console.log()

  try {
    // Read the JSON file
    const filePath = join(process.cwd(), "data", "topics-feeds.json")
    console.log(`Reading from: ${filePath}`)
    const fileContent = await readFile(filePath, "utf-8")
    const data: ImportData = JSON.parse(fileContent)

    console.log(`Found ${data.topics.length} topics to import`)
    console.log()

    let topicsCreated = 0
    let topicsSkipped = 0
    let feedsCreated = 0
    let feedsSkipped = 0

    // Process each topic
    for (const topicData of data.topics) {
      console.log(`\n📁 Processing: ${topicData.topic_name}`)

      // Generate slug
      const slug = topicData.topic_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")

      // Check if topic exists
      let topic = await prisma.topic.findUnique({
        where: { slug },
      })

      if (topic) {
        console.log(`   ⏭️  Topic already exists (ID: ${topic.id})`)
        topicsSkipped++
      } else {
        // Create topic
        topic = await prisma.topic.create({
          data: {
            name: topicData.topic_name,
            slug,
            description: topicData.description,
          },
        })
        console.log(`   ✅ Created topic (ID: ${topic.id})`)
        topicsCreated++
      }

      // Process feeds
      console.log(`   Processing ${topicData.feeds.length} feeds...`)

      for (const feedData of topicData.feeds) {
        try {
          // Check if feed exists
          const existingFeed = await prisma.rssFeed.findUnique({
            where: { url: feedData.url },
          })

          if (existingFeed) {
            console.log(`      ⏭️  ${feedData.source}`)
            feedsSkipped++
          } else {
            // Create feed
            await prisma.rssFeed.create({
              data: {
                name: feedData.source,
                url: feedData.url,
                topicId: topic.id,
                isActive: true,
              },
            })
            console.log(`      ✅ ${feedData.source}`)
            feedsCreated++
          }
        } catch (error) {
          console.error(`      ❌ Failed to create ${feedData.source}:`, error instanceof Error ? error.message : error)
        }
      }
    }

    console.log()
    console.log("=".repeat(60))
    console.log("Import Complete!")
    console.log("=".repeat(60))
    console.log()
    console.log("Summary:")
    console.log(`  Topics:  ${topicsCreated} created, ${topicsSkipped} skipped`)
    console.log(`  Feeds:   ${feedsCreated} created, ${feedsSkipped} skipped`)
    console.log()

  } catch (error) {
    console.error()
    console.error("=".repeat(60))
    console.error("Import Failed!")
    console.error("=".repeat(60))
    console.error()
    console.error(error instanceof Error ? error.message : error)
    console.error()
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
