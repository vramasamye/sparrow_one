import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

/**
 * Check current user's role
 */
export async function GET() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  return NextResponse.json({
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
    },
    isAdmin: session.user.role === "ADMIN",
  })
}
