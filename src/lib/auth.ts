import { PrismaAdapter } from "@auth/prisma-adapter"
import NextAuth from "next-auth"

import { authConfig } from "@/lib/auth.config"
import { prisma } from "@/lib/prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }

      // Always fetch fresh role from database (in case it was changed)
      if (token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true },
          })
          token.role = dbUser?.role || "USER"
        } catch (error) {
          console.error("Error fetching user role:", error)
          token.role = "USER" // Default to USER if database query fails
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
    async signIn({ user, account }) {
      try {
        // Only run this logic for the primary sign-in (not when linking accounts)
        if (account?.provider === "google" && user.email) {
          // Check if this is the first user and make them admin
          const userCount = await prisma.user.count()

          if (userCount === 1) {
            // This user was just created by the adapter, make them admin
            // Use email to find the user since id might be the OAuth provider id
            await prisma.user.updateMany({
              where: { email: user.email },
              data: { role: "ADMIN" },
            })
            console.log(`Made first user (${user.email}) an admin`)
          }
        }
      } catch (error) {
        // Log the error but don't block sign in
        console.error("Error in signIn callback:", error)
      }

      // Always allow sign in - don't block authentication
      return true
    },
  },
  events: {
    async createUser({ user }) {
      try {
        if (user.id) {
          await prisma.userPreferences.create({
            data: {
              userId: user.id,
            },
          })
          console.log(`Created default preferences for new user ${user.id}`)
        }
      } catch (error) {
        console.error("Error creating default user preferences:", error)
      }
    },
    async linkAccount({ user, account }) {
      try {
        // When a user links a new OAuth account (Twitter/LinkedIn for posting)
        if (account.provider === "twitter" || account.provider === "linkedin") {
          const { encrypt } = await import("@/lib/encryption")

          const platform = account.provider.toUpperCase() as "TWITTER" | "LINKEDIN"

          // Store the social account for posting
          await prisma.socialAccount.upsert({
            where: {
              userId_platform: {
                userId: user.id!,
                platform,
              },
            },
            update: {
              accessToken: encrypt(account.access_token || ""),
              refreshToken: account.refresh_token ? encrypt(account.refresh_token) : null,
              tokenExpiresAt: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
              platformUserId: account.providerAccountId,
              isActive: true,
              lastTokenRefresh: new Date(),
            },
            create: {
              userId: user.id!,
              platform,
              platformUserId: account.providerAccountId,
              accessToken: encrypt(account.access_token || ""),
              refreshToken: account.refresh_token ? encrypt(account.refresh_token) : null,
              tokenExpiresAt: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
              lastTokenRefresh: new Date(),
            },
          })

          console.log(`Linked ${platform} account for user ${user.id}`)
        }
      } catch (error) {
        console.error("Error in linkAccount event:", error)
        // Don't throw - this is an event, not a callback that blocks auth
      }
    },
  },
})