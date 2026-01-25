import { prisma } from "./prisma"
import { decrypt, encrypt } from "./encryption"

interface TokenRefreshResult {
  accountId: string
  platform: string
  success: boolean
  error?: string
}

/**
 * Refresh Twitter OAuth tokens
 */
async function refreshTwitterToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const response = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Twitter token refresh failed: ${error}`)
  }

  return response.json()
}

/**
 * Refresh LinkedIn OAuth tokens
 */
async function refreshLinkedInToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`LinkedIn token refresh failed: ${error}`)
  }

  return response.json()
}

/**
 * Refresh a single social account's token on-demand
 */
export async function refreshAccountToken(accountId: string): Promise<boolean> {
  try {
    const account = await prisma.socialAccount.findUnique({
      where: { id: accountId },
    })

    if (!account) {
      console.error(`Account ${accountId} not found`)
      return false
    }

    if (!account.refreshToken) {
      console.error(`Account ${accountId} has no refresh token`)
      return false
    }

    const decryptedRefreshToken = decrypt(account.refreshToken)

    if (account.platform === "TWITTER") {
      const tokens = await refreshTwitterToken(decryptedRefreshToken)

      await prisma.socialAccount.update({
        where: { id: account.id },
        data: {
          accessToken: encrypt(tokens.access_token),
          refreshToken: encrypt(tokens.refresh_token),
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          lastTokenRefresh: new Date(),
        },
      })

      console.log(`Successfully refreshed Twitter token for account ${account.id}`)
      return true
    } else if (account.platform === "LINKEDIN") {
      const tokens = await refreshLinkedInToken(decryptedRefreshToken)

      await prisma.socialAccount.update({
        where: { id: account.id },
        data: {
          accessToken: encrypt(tokens.access_token),
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          lastTokenRefresh: new Date(),
        },
      })

      console.log(`Successfully refreshed LinkedIn token for account ${account.id}`)
      return true
    }

    return false
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error(`Failed to refresh token for account ${accountId}:`, errorMessage)
    return false
  }
}

/**
 * Check if a token is expired or will expire soon (within 5 minutes)
 */
export function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false // No expiration info, assume valid
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
  return expiresAt <= fiveMinutesFromNow
}

/**
 * Refresh expiring OAuth tokens
 * Runs every 6 hours, refreshes tokens expiring within 48 hours
 */
export async function refreshExpiringTokens(): Promise<TokenRefreshResult[]> {
  console.log("Starting token refresh job...")

  const results: TokenRefreshResult[] = []

  // Find tokens expiring in the next 48 hours
  const expirationThreshold = new Date(Date.now() + 48 * 60 * 60 * 1000)

  const expiringAccounts = await prisma.socialAccount.findMany({
    where: {
      isActive: true,
      refreshToken: { not: null },
      tokenExpiresAt: {
        lte: expirationThreshold,
      },
    },
  })

  console.log(`Found ${expiringAccounts.length} accounts with expiring tokens`)

  for (const account of expiringAccounts) {
    const result: TokenRefreshResult = {
      accountId: account.id,
      platform: account.platform,
      success: false,
    }

    try {
      if (!account.refreshToken) {
        result.error = "No refresh token available"
        results.push(result)
        continue
      }

      const decryptedRefreshToken = decrypt(account.refreshToken)

      if (account.platform === "TWITTER") {
        const tokens = await refreshTwitterToken(decryptedRefreshToken)

        await prisma.socialAccount.update({
          where: { id: account.id },
          data: {
            accessToken: encrypt(tokens.access_token),
            refreshToken: encrypt(tokens.refresh_token), // Twitter rotates refresh tokens
            tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            lastTokenRefresh: new Date(),
          },
        })

        result.success = true
      } else if (account.platform === "LINKEDIN") {
        const tokens = await refreshLinkedInToken(decryptedRefreshToken)

        await prisma.socialAccount.update({
          where: { id: account.id },
          data: {
            accessToken: encrypt(tokens.access_token),
            // LinkedIn doesn't rotate refresh tokens
            tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            lastTokenRefresh: new Date(),
          },
        })

        result.success = true
      }

      console.log(`Successfully refreshed ${account.platform} token for account ${account.id}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      result.error = errorMessage
      console.error(`Failed to refresh token for account ${account.id}:`, errorMessage)

      // After multiple failures, mark account as inactive
      const currentAccount = await prisma.socialAccount.findUnique({
        where: { id: account.id },
      })

      // If this is a persistent failure, deactivate the account
      if (currentAccount && !result.success) {
        // We'd track retry count in a real implementation
        console.warn(`Account ${account.id} may need re-authentication`)
      }
    }

    results.push(result)
  }

  console.log(`Token refresh job completed. ${results.filter((r) => r.success).length}/${results.length} successful`)

  return results
}
