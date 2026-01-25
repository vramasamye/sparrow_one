import dotenv from "dotenv"
import path from "path"
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

import { prisma } from "../src/lib/prisma"

async function main() {
  const failedPosts = await prisma.scheduledPost.findMany({
    where: { status: "FAILED" },
    select: {
      id: true,
      platform: true,
      status: true,
      errorMessage: true,
      content: true,
      user: { select: { email: true } }
    }
  })

  console.log(`Found ${failedPosts.length} failed posts:\n`)

  failedPosts.forEach(post => {
    console.log(`Post ID: ${post.id}`)
    console.log(`User: ${post.user.email}`)
    console.log(`Platform: ${post.platform}`)
    console.log(`Error: ${post.errorMessage || 'No error message'}`)
    console.log(`Content: ${post.content.substring(0, 100)}...`)
    console.log('')
  })

  await prisma.$disconnect()
}

main()
