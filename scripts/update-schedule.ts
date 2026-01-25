import dotenv from "dotenv"
import path from "path"
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

import { prisma } from "../src/lib/prisma"

async function main() {
  // Get the first scheduled post
  const posts = await prisma.scheduledPost.findMany({
    where: { status: "SCHEDULED" },
    take: 1
  })

  if (posts.length === 0) {
    console.log("No scheduled posts found")
    return
  }

  const post = posts[0]
  console.log(`Updating post ${post.id}`)
  console.log(`Current scheduledFor: ${post.scheduledFor}`)

  // Update to 1 minute ago
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000)

  await prisma.scheduledPost.update({
    where: { id: post.id },
    data: { scheduledFor: oneMinuteAgo }
  })

  console.log(`Updated scheduledFor: ${oneMinuteAgo.toISOString()}`)
  console.log("✅ Post ready for publishing")

  await prisma.$disconnect()
}

main()
