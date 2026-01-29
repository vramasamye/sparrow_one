import { cache } from "react"
import { auth } from "./auth"
import { prisma } from "./prisma"

/**
 * Get the current authenticated user session (cached per request)
 */
export const getAuthSession = cache(async () => {
  return await auth()
})

/**
 * Get user role (cached per request)
 */
export const getUserRole = cache(async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  return user?.role
})

/**
 * Check if user is admin (cached per request)
 */
export const isAdmin = cache(async (userId: string) => {
  const role = await getUserRole(userId)
  return role === "ADMIN"
})

/**
 * Get authenticated admin user or return null
 * Use this in admin routes to verify admin access
 */
export const getAuthenticatedAdmin = cache(async () => {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    return null
  }

  const role = await getUserRole(session.user.id)

  if (role !== "ADMIN") {
    return null
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
  }
})

