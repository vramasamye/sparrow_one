import dotenv from "dotenv"
import path from "path"
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

import { prisma } from "../src/lib/prisma"

async function main() {
  const accounts = await prisma.socialAccount.findMany({
    where: { platform: "TWITTER" },
    select: {
      id: true,
      platformUserId: true,
      platformUsername: true,
      tokenExpiresAt: true,
      lastTokenRefresh: true,
      refreshToken: true,
      isActive: true,
      user: { select: { email: true } }
    }
  })

  console.log(`Found ${accounts.length} Twitter accounts:\n`)

  accounts.forEach(account => {
    console.log(`Account: ${account.user.email}`)
    console.log(`  ID: ${account.id}`)
    console.log(`  Username: ${account.platformUsername || 'N/A'}`)
    console.log(`  Active: ${account.isActive}`)
    console.log(`  Has Refresh Token: ${!!account.refreshToken}`)
    console.log(`  Token Expires At: ${account.tokenExpiresAt?.toISOString() || 'N/A'}`)
    console.log(`  Last Refresh: ${account.lastTokenRefresh?.toISOString() || 'N/A'}`)

    if (account.tokenExpiresAt) {
      const now = new Date()
      const isExpired = account.tokenExpiresAt <= now
      const timeUntilExpiry = account.tokenExpiresAt.getTime() - now.getTime()
      const hoursUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60 * 60))

      console.log(`  Status: ${isExpired ? '❌ EXPIRED' : `✅ Valid (${hoursUntilExpiry}h remaining)`}`)
    }
    console.log('')
  })

  await prisma.$disconnect()
}

main()
