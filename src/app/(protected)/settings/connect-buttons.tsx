"use client"

import { useState } from "react"
import { Loader2, LogOut, Plus } from "lucide-react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface ConnectButtonProps {
  platform: "twitter" | "linkedin"
  disabled?: boolean
}

export function ConnectButton({ platform, disabled }: ConnectButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleConnect() {
    if (disabled) return
    setLoading(true)
    try {
      await signIn(platform, {
        callbackUrl: "/settings",
      })
    } catch {
      toast.error(`Failed to connect ${platform}`)
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleConnect} disabled={loading || disabled}>
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Plus className="mr-2 h-4 w-4" />
      )}
      Connect
    </Button>
  )
}

interface DisconnectButtonProps {
  platform: "twitter" | "linkedin"
  accountId: string
}

export function DisconnectButton({ platform, accountId }: DisconnectButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDisconnect() {
    setLoading(true)
    try {
      const response = await fetch(`/api/social-accounts/${accountId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to disconnect")
      }

      toast.success(`${platform === "twitter" ? "Twitter" : "LinkedIn"} disconnected`)
      router.refresh()
    } catch {
      toast.error(`Failed to disconnect ${platform}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" onClick={handleDisconnect} disabled={loading}>
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="mr-2 h-4 w-4" />
      )}
      Disconnect
    </Button>
  )
}
