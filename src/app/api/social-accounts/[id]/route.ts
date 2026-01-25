import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: accountId } = await params

    // Verify the account belongs to the user
    const account = await prisma.socialAccount.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
      },
    })

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    // Delete the social account
    await prisma.socialAccount.delete({
      where: { id: accountId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting social account:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
