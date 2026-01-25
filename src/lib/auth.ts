import { PrismaAdapter } from "@auth/prisma-adapter"
import NextAuth from "next-auth"

import { authConfig } from "@/lib/auth.config"
import { prisma } from "@/lib/prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }

      // Always fetch fresh role from database (in case it was changed)
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true },
        })
        token.role = dbUser?.role || "USER"
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
    async signIn({ user }) {
      // Make the first user an admin
      const userCount = await prisma.user.count()
      if (userCount === 0 && user.id) {
        // This is the first user, make them admin
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "ADMIN" },
        })
      }
      return true
    },
  },
  events: {
    async linkAccount({ user, account }) {
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
      }
    },
  },
})