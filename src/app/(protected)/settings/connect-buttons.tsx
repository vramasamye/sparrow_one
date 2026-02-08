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
    <Button
      onClick={handleConnect}
      disabled={loading || disabled}
      variant="outline"
      size="sm"
      className="w-full gap-2"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Plus className="h-3.5 w-3.5" />
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
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDisconnect}
      disabled={loading}
      className="w-full gap-2 text-muted-foreground hover:text-destructive"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <LogOut className="h-3.5 w-3.5" />
      )}
      Disconnect
    </Button>
  )
}
