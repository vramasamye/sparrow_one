import dotenv from "dotenv"
import path from "path"
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

import { prisma } from "../src/lib/prisma"

async function main() {
  const published = await prisma.scheduledPost.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      platform: true,
      content: true,
      publishedAt: true,
      platformPostId: true,
      user: { select: { email: true } }
    },
    orderBy: { publishedAt: 'desc' },
    take: 5
  })

  console.log(`Found ${published.length} published posts:\n`)

  published.forEach(post => {
    console.log(`Platform: ${post.platform}`)
    console.log(`User: ${post.user.email}`)
    console.log(`Published: ${post.publishedAt?.toISOString()}`)
    console.log(`Platform Post ID: ${post.platformPostId || 'N/A'}`)
    console.log(`Content: ${post.content.substring(0, 100)}...`)
    console.log('')
  })

  await prisma.$disconnect()
}

main()
